import { expect, type Page } from '@playwright/test'

// Only Playwright intercepts these endpoints. No test bypass exists in application code.
export async function login(
  page: Page,
  id = '00000000-0000-4000-8000-000000000001',
  options: { sync?: boolean } = {},
) {
  // Older module tests intentionally exercise local storage with an unconfigured sync backend.
  if (!options.sync)
    await page
      .context()
      .route('https://dayflow-e2e.supabase.co/rest/v1/**', (route) =>
        route.fulfill({
          status: 404,
          json: {
            code: 'PGRST202',
            message: 'Sync migration absent in this fixture',
          },
        }),
      )
  await page
    .context()
    .routeWebSocket('wss://dayflow-e2e.supabase.co/**', (socket) =>
      socket.close(),
    )
  const user = {
    id,
    aud: 'authenticated',
    role: 'authenticated',
    email: `${id.slice(-1)}@dayflow.test`,
    email_confirmed_at: new Date().toISOString(),
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { name: 'Ana' },
    created_at: '2026-09-20T00:00:00Z',
  }
  const exp = Math.floor(Date.now() / 1000) + 3600
  const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: id, aud: 'authenticated', role: 'authenticated', exp })).toString('base64url')}.test-signature`
  await page.route(
    'https://dayflow-e2e.supabase.co/auth/v1/**',
    async (route) => {
      if (route.request().url().includes('/token'))
        await route.fulfill({
          json: {
            access_token: token,
            refresh_token: `refresh-${id}`,
            expires_in: 3600,
            expires_at: exp,
            token_type: 'bearer',
            user,
          },
        })
      else if (route.request().url().includes('/user'))
        await route.fulfill({ json: user })
      else if (route.request().url().includes('/logout'))
        await route.fulfill({ status: 204 })
      else await route.abort()
    },
  )
  await page.goto('/auth/login')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Contraseña').fill('una-contraseña-de-prueba')
  await page
    .getByRole('button', { name: 'Iniciar sesión', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Hoy, con un poco más de calma.' }),
  ).toBeVisible()
  // Follow the app's navigation after login; a new document load can race the auth redirect.
  await page.locator('a[href="/tasks"]:visible').first().click()
  await expect(page.getByRole('heading', { name: 'Tus tareas.' })).toBeVisible()
}
