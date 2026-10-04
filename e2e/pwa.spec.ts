import { test, expect, chromium, type Page } from '@playwright/test'
import { login } from './auth-fixture.ts'

async function ready(page: Page) {
  await page.goto('/settings')
  await expect(
    page.getByText('Lista para abrir sin conexión.', { exact: true }),
  ).toBeVisible()
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
}

test('Web Push registra por consentimiento, recibe en el worker real y se revoca al cerrar sesión', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['notifications'], {
    origin: 'http://127.0.0.1:4177',
  })
  // Only the browser's external subscription endpoint and Supabase HTTP boundary are simulated.
  // The production worker, IndexedDB identity, message channel and notification API are real.
  await page.addInitScript(() => {
    let sub: object | null = null
    Object.defineProperty(PushManager.prototype, 'getSubscription', {
      value: async () => sub,
    })
    Object.defineProperty(PushManager.prototype, 'subscribe', {
      value: async () => {
        sub = {
          endpoint: 'https://fcm.googleapis.com/fcm/send/test',
          toJSON: () => ({ keys: { p256dh: 'test-key', auth: 'test-auth' } }),
          unsubscribe: async () => {
            sub = null
            return true
          },
        }
        return sub
      },
    })
  })
  await login(page)
  await ready(page)
  let registered = false
  let revoked = false
  await page.route(
    'https://dayflow-e2e.supabase.co/rest/v1/rpc/dayflow_register_push',
    (route) => {
      registered = true
      return route.fulfill({ json: '00000000-0000-4000-8000-000000000003' })
    },
  )
  await page.route(
    'https://dayflow-e2e.supabase.co/rest/v1/push_subscriptions**',
    (route) => {
      if (route.request().method() === 'DELETE') {
        revoked = true
        return route.fulfill({ status: 204 })
      }
      return route.fulfill({
        json: { id: '00000000-0000-4000-8000-000000000003' },
      })
    },
  )
  await page
    .getByRole('button', { name: 'Activar avisos web', exact: true })
    .click()
  await expect(
    page.getByText('Avisos web activados para esta cuenta.', { exact: true }),
  ).toBeVisible()
  expect(registered).toBe(true)
  const worker = context
    .serviceWorkers()
    .find((item) => item.url().endsWith('/sw.js'))!
  // Inject a push event: a fake external subscription cannot receive an actual FCM delivery.
  await worker.evaluate(
    async (data) => {
      const work: Promise<unknown>[] = []
      const event = new Event('push')
      Object.defineProperties(event, {
        data: { value: { json: () => data } },
        waitUntil: { value: (promise: Promise<unknown>) => work.push(promise) },
      })
      self.dispatchEvent(event)
      await Promise.all(work)
    },
    {
      userId: '00000000-0000-4000-8000-000000000001',
      reminderId: '00000000-0000-4000-8000-000000000002',
      at: new Date().toISOString(),
      title: 'Private title',
    },
  )
  const notifications = () =>
    page.evaluate(async () =>
      (await (await navigator.serviceWorker.ready).getNotifications()).map(
        (item) => ({ title: item.title, body: item.body }),
      ),
    )
  await expect.poll(notifications).toEqual([
    {
      title: 'Dayflow · Recordatorio',
      body: 'Tienes un recordatorio pendiente. Abre Dayflow para consultarlo.',
    },
  ])
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()
  await expect(page).toHaveURL(/auth\/login/)
  expect(revoked).toBe(true)
  await expect.poll(notifications).toEqual([])
  const identity = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready
    return new Promise((resolve) => {
      const channel = new MessageChannel()
      channel.port1.onmessage = ({ data }) => {
        channel.port1.close()
        resolve(data.userId)
      }
      registration.active!.postMessage({ type: 'DAYFLOW_PUSH_GET' }, [
        channel.port2,
      ])
    })
  })
  expect(identity).toBeNull()
})

test('Web Push muestra el permiso denegado sin afirmar que está activado', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(Notification, 'requestPermission', {
      value: async () => 'denied',
    })
  })
  await login(page)
  await ready(page)
  await page
    .getByRole('button', { name: 'Activar avisos web', exact: true })
    .click()
  await expect(
    page.getByText(
      'Permiso no concedido. Revisa los permisos de este sitio en tu navegador.',
    ),
  ).toBeVisible()
  await expect(
    page.getByText('Avisos web activados para esta cuenta.', { exact: true }),
  ).toHaveCount(0)
})
test.beforeEach(async ({ request }) => {
  await request.post('/__test/reset')
})

test('manifest, iconos y caché contienen sólo archivos públicos de la aplicación', async ({
  page,
  request,
}) => {
  await login(page)
  await ready(page)
  // Full Chromium refuses installation in Playwright's isolated/incognito contexts.
  // Check installability in a separate temporary persistent profile, without suppressing errors.
  const installContext = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
  })
  try {
    const installPage = await installContext.newPage()
    await installPage.goto('http://127.0.0.1:4177/')
    await installPage.evaluate(async () => {
      await navigator.serviceWorker.ready
    })
    const cdp = await installContext.newCDPSession(installPage)
    const installability = await cdp.send('Page.getInstallabilityErrors')
    expect(installability.installabilityErrors).toEqual([])
    await cdp.detach()
  } finally {
    await installContext.close()
  }
  const manifest = await (await request.get('/manifest.webmanifest')).json()
  expect(manifest).toMatchObject({
    name: 'Dayflow',
    display: 'standalone',
    start_url: '/',
    scope: '/',
  })
  for (const icon of manifest.icons) {
    const response = await request.get(icon.src)
    expect(response.headers()['content-type']).toBe('image/png')
    expect(response.ok()).toBe(true)
  }
  const urls = await page.evaluate(async () => {
    const keys = await caches.keys()
    return (
      await Promise.all(
        keys.map(async (key) =>
          (await (await caches.open(key)).keys()).map((request) => request.url),
        ),
      )
    ).flat()
  })
  expect(urls.some((url) => url.includes('/index.html'))).toBe(true)
  expect(urls.some((url) => url.includes('NotesPage-'))).toBe(true)
  expect(
    urls.every((url) => new URL(url).origin === 'http://127.0.0.1:4177'),
  ).toBe(true)
  expect(
    urls.every(
      (url) =>
        !/supabase|auth\/v1|rest\/v1/.test(
          new URL(url).pathname.replace(/\/assets\/supabase-[^/]+\.js$/, ''),
        ),
    ),
  ).toBe(true)
})

test('arranca en una ventana nueva sin red, carga módulos no visitados y conserva cambios', async ({
  page,
  context,
}) => {
  await login(page)
  await ready(page)
  await page.goto('/inbox')
  await page.getByLabel('Nueva captura').fill('Idea antes del viaje')
  await page.getByLabel('Nueva captura').press('Enter')
  await expect(
    page.getByRole('button', { name: 'Organizar Idea antes del viaje' }),
  ).toBeVisible()
  await context.setOffline(true)
  await page.close()
  const offline = await context.newPage()
  await offline.goto('/inbox')
  await expect(
    offline.getByRole('button', { name: 'Organizar Idea antes del viaje' }),
  ).toBeVisible()
  await offline.getByLabel('Nueva captura').fill('Idea sin cobertura')
  await offline.getByLabel('Nueva captura').press('Enter')
  await expect(
    offline.getByRole('button', { name: 'Organizar Idea sin cobertura' }),
  ).toBeVisible()
  await offline.goto('/notes')
  await expect(
    offline.getByRole('heading', { name: 'Tus notas.' }),
  ).toBeVisible()
  await offline.goto('/profile')
  await expect(
    offline.getByRole('heading', { name: 'Perfil', exact: true }),
  ).toBeVisible()
  await expect(
    offline
      .locator('.profile-stat')
      .filter({ has: offline.getByText('Por organizar', { exact: true }) })
      .locator('.profile-stat-value'),
  ).toHaveText('2')
  await offline.goto('/calendar')
  await expect(
    offline.getByRole('heading', { name: 'Tu calendario.' }),
  ).toBeVisible()
  await offline.goto('/inbox')
  await expect(
    offline.getByRole('button', { name: 'Organizar Idea sin cobertura' }),
  ).toBeVisible()
  await offline.goto('/settings')
  await offline
    .getByRole('button', { name: 'Comprobar actualizaciones' })
    .click()
  await expect(
    offline.getByRole('alert').filter({ hasText: 'No se pudo comprobar' }),
  ).toBeVisible()
  await context.setOffline(false)
})

test('una actualización espera a todas las ventanas y conserva un borrador abierto', async ({
  page,
  context,
  request,
}) => {
  await login(page)
  await ready(page)
  const editor = await context.newPage()
  await editor.goto('/inbox')
  await editor.getByLabel('Nueva captura').fill('Borrador sin guardar')
  await request.post('/__test/update')
  await page.getByRole('button', { name: 'Comprobar actualizaciones' }).click()
  await expect(page.getByText(/Hay una nueva versión lista/)).toBeVisible()
  await expect(editor.getByLabel('Nueva captura')).toHaveValue(
    'Borrador sin guardar',
  )
  await expect(editor.locator('meta[name="test-build"]')).toHaveAttribute(
    'content',
    'a',
  )
  await page.close()
  await expect(editor.getByLabel('Nueva captura')).toHaveValue(
    'Borrador sin guardar',
  )
  await editor.getByLabel('Nueva captura').press('Enter')
  await expect(
    editor.getByRole('button', { name: 'Organizar Borrador sin guardar' }),
  ).toBeVisible()
  await editor.close()
  const updated = await context.newPage()
  await updated.goto('/inbox')
  await expect(updated.locator('meta[name="test-build"]')).toHaveAttribute(
    'content',
    'b',
  )
  await expect(
    updated.getByRole('button', { name: 'Organizar Borrador sin guardar' }),
  ).toBeVisible()
})

test('la caché de arranque no abre datos privados después de cerrar sesión', async ({
  page,
  context,
}) => {
  await login(page)
  await ready(page)
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()
  await expect(page).toHaveURL(/auth\/login/)
  await context.setOffline(true)
  await page.goto('/inbox')
  await expect(
    page.getByRole('heading', { name: 'Un lugar para tu día.' }),
  ).toBeVisible()
  await expect(page.getByLabel('Nueva captura')).toHaveCount(0)
})

test('instalación legible a 320 px y en oscuro, sin desbordamiento ni errores de página', async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await login(page)
  await ready(page)
  if (testInfo.project.name === 'pwa-mobile') {
    await page.setViewportSize({ width: 320, height: 780 })
    await page.getByRole('button', { name: 'Oscuro', exact: true }).click()
  }
  await expect(
    page.getByRole('heading', { name: 'Instalación y actualizaciones' }),
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  const section = page.getByRole('region', {
    name: 'Instalación y actualizaciones',
  })
  await section.screenshot({ path: testInfo.outputPath('installation.png') })
  expect(errors).toEqual([])
})
