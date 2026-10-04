import { randomUUID } from 'node:crypto'
import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from '@playwright/test'

// No intercepted HTTP, fake Auth, or test bypass: these tests use the local Docker stack.
const password = `Dayflow-${randomUUID()}-9a!`
const mail = 'http://127.0.0.1:54324'
const api = 'http://127.0.0.1:54321'

async function emailLink(
  request: APIRequestContext,
  email: string,
  type: string,
) {
  let link: string | undefined
  await expect
    .poll(
      async () => {
        const response = await request.get(
          `${mail}/view/latest.html?query=${encodeURIComponent(`to:${email}`)}`,
        )
        if (!response.ok()) return false
        const html = await response.text()
        const links = [...html.matchAll(/href="([^"]+)"/g)].map((match) =>
          match[1]!.replaceAll('&amp;', '&'),
        )
        link = links.find((value) => {
          try {
            const url = new URL(value)
            return (
              url.origin === api &&
              url.pathname === '/auth/v1/verify' &&
              url.searchParams.get('type') === type
            )
          } catch {
            return false
          }
        })
        return Boolean(link)
      },
      {
        timeout: 20000,
        message:
          'El correo local debe contener un enlace de verificación válido.',
      },
    )
    .toBe(true)
  return link!
}

async function register(page: Page, request: APIRequestContext) {
  const email = `dayflow-e2e-${randomUUID()}@dayflow.test`
  await page.goto('/auth/register')
  await page.getByLabel('Tu nombre').fill('Prueba local')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Revisa tu correo')
  await page.goto(await emailLink(request, email, 'signup'))
  await expect(
    page.getByRole('heading', { name: 'Hoy, con un poco más de calma.' }),
  ).toBeVisible()
  return email
}

async function login(page: Page, email: string, pass = password) {
  await page.goto('/auth/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill(pass)
  await page
    .getByRole('button', { name: 'Iniciar sesión', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Hoy, con un poco más de calma.' }),
  ).toBeVisible()
}

async function sync(page: Page) {
  if (new URL(page.url()).pathname !== '/settings')
    await page.locator('a[href="/settings"]:visible').first().click()
  await page
    .getByRole('button', { name: 'Sincronizar ahora', exact: true })
    .click()
  await expect(
    page.getByText('Sincronizado · 0 operaciones pendientes'),
  ).toBeVisible({ timeout: 20000 })
}

test('registro, correo de confirmación, recuperación y cierre de sesión reales', async ({
  page,
  request,
}) => {
  const email = await register(page, request)
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()
  await expect(page).toHaveURL(/\/auth\/login$/)
  await page.getByRole('link', { name: '¿Has olvidado tu contraseña?' }).click()
  await expect(
    page.getByRole('heading', { name: 'Volvamos a entrar.' }),
  ).toBeVisible()
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Enviar enlace', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('recibirás un enlace')
  await page.goto(await emailLink(request, email, 'recovery'))
  await expect(
    page.getByRole('heading', { name: 'Una nueva contraseña.' }),
  ).toBeVisible()
  const next = `${password}-changed`
  await page.getByLabel('Contraseña').fill(next)
  await page
    .getByRole('button', { name: 'Guardar contraseña', exact: true })
    .click()
  await expect(page.getByRole('status')).toContainText('Contraseña guardada')
  await login(page, email, next)
  await sync(page)
})

test('dos instalaciones sincronizan con RPC y WebSocket reales, recuperan offline y aíslan otra cuenta', async ({
  page,
  request,
  browser,
}) => {
  const email = await register(page, request)
  const secondContext = await browser.newContext({
    baseURL: 'http://127.0.0.1:4181',
  })
  const otherContext = await browser.newContext({
    baseURL: 'http://127.0.0.1:4181',
  })
  try {
    const second = await secondContext.newPage()
    let changes = 0
    second.on('websocket', (socket) =>
      socket.on('framereceived', (frame) => {
        try {
          const message = JSON.parse(String(frame.payload))
          const event = Array.isArray(message) ? message[3] : message.event
          const payload = Array.isArray(message) ? message[4] : message.payload
          if (
            event === 'postgres_changes' &&
            payload?.data?.table === 'sync_heads'
          )
            changes++
        } catch {
          // Ignore frames which are not Realtime JSON messages.
        }
      }),
    )
    await login(second, email)
    await sync(page)
    await sync(second)
    await second.goto('/tasks')
    await expect(
      second.getByRole('heading', { name: 'Tus tareas.' }),
    ).toBeVisible()
    const before = changes
    await page.goto('/tasks')
    const title = `Tarea real ${randomUUID().slice(0, 8)}`
    await page.getByLabel('Título de la nueva tarea').fill(title)
    await page.getByLabel('Título de la nueva tarea').press('Enter')
    await expect(
      page.getByRole('button', { name: `Abrir tarea ${title}`, exact: true }),
    ).toBeVisible()
    await sync(page)
    await expect.poll(() => changes, { timeout: 20000 }).toBeGreaterThan(before)
    await expect(
      second.getByRole('button', { name: `Abrir tarea ${title}`, exact: true }),
    ).toBeVisible({ timeout: 20000 })
    await secondContext.setOffline(true)
    await second
      .getByRole('checkbox', { name: `Completar ${title}`, exact: true })
      .click()
    await expect(
      second.getByRole('button', { name: `Abrir tarea ${title}`, exact: true }),
    ).toHaveCount(0)
    await secondContext.setOffline(false)
    await sync(second)
    await sync(page)
    await page.locator('a[href="/tasks"]:visible').first().click()
    await page.getByRole('button', { name: 'Todas', exact: true }).click()
    await expect(
      page.getByRole('checkbox', { name: `Reabrir ${title}`, exact: true }),
    ).toBeChecked({ timeout: 20000 })
    const other = await otherContext.newPage()
    await register(other, request)
    await sync(other)
    await other.goto('/tasks')
    await other.getByRole('button', { name: 'Todas', exact: true }).click()
    await expect(
      other.getByRole('button', { name: `Abrir tarea ${title}`, exact: true }),
    ).toHaveCount(0)
    // An authenticated REST read uses the new account's own token and real server RLS.
    const result = await other.evaluate(async (title) => {
      const modulePath = '/src/services/supabase/client.ts'
      const { supabase } = await import(modulePath)
      const { data: identity } = await supabase.auth.getUser()
      const { data, error } = await supabase!
        .from('tasks')
        .select('id')
        .eq('title', title)
      return {
        ownSession: Boolean(identity.user?.id),
        count: data?.length,
        error: error?.code,
      }
    }, title)
    expect(result).toMatchObject({
      ownSession: true,
      count: 0,
      error: undefined,
    })
  } finally {
    await secondContext.close()
    await otherContext.close()
  }
})
