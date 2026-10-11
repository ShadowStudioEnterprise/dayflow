import { test, expect } from '@playwright/test'

// These checks do not prove email reception or delivery of a real Web Push.
test('final origin serves Auth routes and JavaScript workers publicly', async ({
  request,
}) => {
  for (const route of [
    '/',
    '/profile',
    '/auth/login',
    '/auth/register',
    '/auth/reset-password',
    '/auth/update-password',
  ]) {
    const response = await request.get(route)
    expect(response.status(), route).toBe(200)
    expect(new URL(response.url()).origin).toBe(
      'https://dayflow-by-shadowstudio.vercel.app',
    )
    expect(response.headers()['content-type']).toContain('text/html')
  }
  for (const route of ['/sw.js', '/push-worker.js']) {
    const response = await request.get(route)
    expect(response.status(), route).toBe(200)
    expect(response.headers()['content-type']).toMatch(/javascript/)
    expect(response.headers()['cache-control']).toContain('must-revalidate')
    if (route === '/sw.js') {
      expect(response.headers()['service-worker-allowed']).toBe('/')
      expect(await response.text()).toContain('push-worker.js')
    }
  }
})

test('Auth forms load and profile requires a session on the final origin', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  for (const [route, title] of [
    ['/auth/register', 'Haz espacio para lo importante.'],
    ['/auth/reset-password', 'Volvamos a entrar.'],
    ['/auth/update-password', 'Una nueva contraseña.'],
  ]) {
    await page.goto(route)
    await expect(
      page.getByRole('heading', { name: title, exact: true }),
    ).toBeVisible()
    await expect(
      page.getByText('El acceso se activará al configurar Supabase.', {
        exact: false,
      }),
    ).toHaveCount(0)
  }
  await page.goto('/profile')
  await expect(page).toHaveURL(/\/auth\/login$/)
  await expect(
    page.getByRole('button', { name: 'Iniciar sesión', exact: true }),
  ).toBeEnabled()
  expect(errors).toEqual([])
})

test('production worker activates and update check completes', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/setup/settings')
  await expect(
    page.getByText('Lista para abrir sin conexión.', { exact: true }),
  ).toBeVisible({ timeout: 45000 })
  const registration = await page.evaluate(async () => {
    const worker = await navigator.serviceWorker.ready
    return { scope: worker.scope, script: worker.active?.scriptURL }
  })
  expect(registration).toEqual({
    scope: 'https://dayflow-by-shadowstudio.vercel.app/',
    script: 'https://dayflow-by-shadowstudio.vercel.app/sw.js',
  })
  await page
    .getByRole('button', { name: 'Comprobar actualizaciones', exact: true })
    .click()
  await expect(
    page.getByText('Comprobación realizada.', { exact: false }),
  ).toBeVisible()
  expect(errors).toEqual([])
})
