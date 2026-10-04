import { test, expect } from '@playwright/test'

test('sin configuración muestra preparación y permite explorar módulos', async ({
  page,
  isMobile,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page).toHaveURL(/\/setup/)
  await expect(
    page.getByRole('heading', { name: 'Hoy, con un poco más de calma.' }),
  ).toBeVisible()
  const navigation = page.getByRole('navigation', {
    name: isMobile ? 'Navegación móvil' : 'Navegación principal',
  })
  await navigation.getByRole('link', { name: 'Tareas', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Tus tareas empiezan aquí.' }),
  ).toBeVisible()
  expect(errors).toEqual([])
})

test('tema y preferencias persisten al recargar', async ({ page }) => {
  await page.goto('/setup/settings')
  await page.getByRole('button', { name: 'Oscuro', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByLabel('Zona horaria').selectOption('Europe/Madrid')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByLabel('Zona horaria')).toHaveValue('Europe/Madrid')
})

test('búsqueda captura foco y Escape cierra el diálogo', async ({ page }) => {
  await page.goto('/setup')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.keyboard.press('Control+k')
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('320px no tiene desplazamiento horizontal y reconoce desconexión', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto('/setup')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await context.setOffline(true)
  await expect(page.getByRole('status')).toHaveText('Sin conexión')
  await context.setOffline(false)
})

test('sin backend no simula inicio de sesión', async ({ page }) => {
  await page.goto('/auth/login')
  await expect(
    page.getByRole('button', { name: 'Iniciar sesión' }),
  ).toBeDisabled()
  await expect(
    page.getByText('El acceso se activará al configurar Supabase.', {
      exact: false,
    }),
  ).toBeVisible()
})
