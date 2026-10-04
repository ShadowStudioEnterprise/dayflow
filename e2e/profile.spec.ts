import { test, expect, type Page } from '@playwright/test'
import { login } from './auth-fixture.ts'

async function openWorkspace(page: Page) {
  if ((page.viewportSize()?.width ?? 1200) <= 800)
    await page
      .getByRole('button', { name: 'Abrir navegación', exact: true })
      .click()
  await page.getByRole('button', { name: 'Mi espacio', exact: true }).click()
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-04T10:00:00Z'))
  await login(page)
  await page.goto('/settings')
  await page
    .getByLabel('Zona horaria', { exact: true })
    .selectOption('Europe/Madrid')
})

for (const status of [204, 503]) {
  test(`cierra sesión desde Mi espacio y protege las rutas privadas (HTTP ${status})`, async ({
    page,
  }) => {
    await page.goto('/profile')
    let attempts = 0
    let release!: () => void
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    await page.route(
      'https://dayflow-e2e.supabase.co/auth/v1/logout**',
      async (route) => {
        attempts++
        await pending
        await route.fulfill(
          status === 204
            ? { status }
            : {
                status,
                json: { message: 'Servicio temporalmente no disponible.' },
              },
        )
      },
    )
    await openWorkspace(page)
    const menu = page.getByRole('group', { name: 'Opciones de Mi espacio' })
    await menu
      .getByRole('button', { name: 'Cerrar sesión', exact: true })
      .click()
    await expect(
      menu.getByRole('button', { name: 'Cerrando sesión…', exact: true }),
    ).toBeDisabled()
    release()
    // Supabase clears the local session even when server-side revocation returns an error.
    await expect(page).toHaveURL(/\/auth\/login$/)
    expect(attempts).toBe(1)
    await page.goto('/profile')
    await expect(page).toHaveURL(/\/auth\/login$/)
  })
}

test('menú accesible, perfil vivo y estadísticas después de completar y reabrir una tarea', async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  for (const title of ['Tarea terminada', 'Tarea pendiente']) {
    await page.getByLabel('Título de la tarea para hoy').fill(title)
    await page.getByLabel('Título de la tarea para hoy').press('Enter')
    await expect(
      page.getByRole('checkbox', { name: `Completar ${title}`, exact: true }),
    ).toBeVisible()
  }
  await page
    .getByRole('checkbox', { name: 'Completar Tarea terminada', exact: true })
    .click()
  await openWorkspace(page)
  await expect(
    page.getByRole('button', { name: 'Mi espacio', exact: true }),
  ).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('button', { name: 'Mi espacio', exact: true }),
  ).toBeFocused()
  await expect(
    page.getByRole('group', { name: 'Opciones de Mi espacio' }),
  ).toHaveCount(0)
  await page.keyboard.press('Enter')
  await page.keyboard.press('Tab')
  await expect(
    page.getByRole('link', { name: 'Perfil', exact: true }),
  ).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/profile$/)
  await expect(
    page.getByRole('heading', { name: 'Perfil', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('group', { name: 'Opciones de Mi espacio' }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('region', { name: 'Datos de mi perfil' }),
  ).toContainText('Ana')
  await expect(page.getByRole('progressbar')).toHaveAttribute('value', '50')
  await expect(
    page
      .locator('.profile-stat')
      .filter({ has: page.getByText('Tareas completadas', { exact: true }) })
      .locator('.profile-stat-value'),
  ).toHaveText('1')
  await expect(
    page.getByRole('list', { name: 'Tareas completadas por día' }),
  ).toContainText('1')
  await page.screenshot({
    path: testInfo.outputPath('profile.png'),
    fullPage: true,
  })
  await page.getByRole('link', { name: 'Ver mis tareas', exact: true }).click()
  await page.getByRole('button', { name: 'Completadas', exact: true }).click()
  await page
    .getByRole('checkbox', { name: 'Reabrir Tarea terminada', exact: true })
    .click()
  await page.goto('/profile')
  await expect(page.getByRole('progressbar')).toHaveAttribute('value', '0')
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Perfil', exact: true }),
  ).toBeVisible()
  expect(errors).toEqual([])
})

test('perfil vacío, tema oscuro, anchura mínima y menú con barra contraída', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Oscuro', exact: true }).click()
  if ((page.viewportSize()?.width ?? 1200) > 800) {
    await page.getByRole('button', { name: 'Contraer barra lateral' }).click()
    await openWorkspace(page)
    await expect(
      page.getByRole('link', { name: 'Perfil', exact: true }),
    ).toBeVisible()
    await page.locator('.main-content').click({ position: { x: 500, y: 30 } })
    await expect(
      page.getByRole('group', { name: 'Opciones de Mi espacio' }),
    ).toHaveCount(0)
  }
  await openWorkspace(page)
  await page.getByRole('link', { name: 'Perfil', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Perfil', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText('Cuando añadas tareas, verás aquí tu progreso.'),
  ).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.setViewportSize({ width: 320, height: 740 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await openWorkspace(page)
  await page
    .getByRole('link', { name: 'Ajustes de mi espacio', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Configuración', exact: true }),
  ).toBeVisible()
})
