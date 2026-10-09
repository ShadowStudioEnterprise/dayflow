import { test, expect } from '@playwright/test'
import { login } from './auth-fixture.ts'

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-25T10:00:00Z'))
  await login(page)
  await page.goto('/settings')
  await page
    .getByLabel('Zona horaria', { exact: true })
    .selectOption('Europe/Madrid')
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Tareas de hoy', exact: true }),
  ).toBeVisible()
})
test('captura para hoy, completa offline y conserva el resultado al recargar', async ({
  page,
  context,
}) => {
  await expect(page.getByText('Tu día tiene espacio.')).toBeVisible()
  await context.setOffline(true)
  const input = page.getByLabel('Título de la tarea para hoy')
  await input.fill('Un paso importante')
  await input.press('Enter')
  await expect(
    page.getByRole('list', { name: 'Tareas para hoy' }),
  ).toContainText('Un paso importante')
  await expect(
    page.getByRole('list', { name: 'Resumen del día' }),
  ).toContainText('1 tarea por atender')
  await page
    .getByRole('checkbox', {
      name: 'Completar Un paso importante',
      exact: true,
    })
    .click()
  await expect(page.getByText('Tu día tiene espacio.')).toBeVisible()
  await context.setOffline(false)
  await page.reload()
  await expect(page.getByText('Tu día tiene espacio.')).toBeVisible()
  await page.getByRole('link', { name: 'Explorar mis tareas' }).click()
  await page.getByRole('button', { name: 'Completadas', exact: true }).click()
  await expect(
    page.getByRole('checkbox', { name: 'Reabrir Un paso importante' }),
  ).toBeChecked()
})
test('reúne vencidas, eventos y recordatorios y abre sus editores desde Hoy', async ({
  page,
}) => {
  // This scenario creates three entities and reloads before opening each editor.
  test.setTimeout(60_000)
  await page.goto('/tasks?create=1')
  await page
    .getByLabel('Título', { exact: true })
    .fill('Revisar propuesta pendiente')
  await page.getByLabel('Fecha límite', { exact: true }).fill('2026-09-24')
  await page.getByRole('button', { name: 'Crear tarea', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.goto('/calendar?day=2026-09-25&create=1')
  await page.getByLabel('Título', { exact: true }).fill('Reunión de diseño')
  await page.getByLabel('Hora de inicio', { exact: true }).fill('14:00')
  await page.getByLabel('Hora de fin', { exact: true }).fill('15:00')
  await page.getByRole('button', { name: 'Crear evento', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.goto('/reminders?create=1')
  await page.getByLabel('Título', { exact: true }).fill('Llamar a Marta')
  await page.getByLabel('Fecha', { exact: true }).fill('2026-09-26')
  await page.getByLabel('Hora', { exact: true }).fill('09:00')
  await page
    .getByRole('button', { name: 'Guardar recordatorio', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.goto('/')
  await expect(
    page.getByRole('list', { name: 'Tareas vencidas' }),
  ).toContainText('Revisar propuesta pendiente')
  await expect(
    page.getByRole('region', { name: 'Eventos de hoy' }),
  ).toContainText('14:00')
  await expect(
    page.getByRole('region', { name: 'Próximos recordatorios' }),
  ).toContainText('Mañana')
  await page.getByRole('link', { name: /Reunión de diseño/ }).click()
  await expect(page.getByLabel('Título', { exact: true })).toHaveValue(
    'Reunión de diseño',
  )
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await page.goto('/')
  await page.getByRole('link', { name: /Llamar a Marta/ }).click()
  await expect(page.getByLabel('Título', { exact: true })).toHaveValue(
    'Llamar a Marta',
  )
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await page.goto('/')
  await page
    .getByRole('button', { name: 'Abrir tarea Revisar propuesta pendiente' })
    .click()
  await expect(page.getByLabel('Título', { exact: true })).toHaveValue(
    'Revisar propuesta pendiente',
  )
})
test('actualiza medianoche y zona, respeta tema oscuro y cabe en 320 px', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page
    .getByLabel('Título de la tarea para hoy')
    .fill(
      'Una tarea con un título largo para revisar el diseño en pantallas pequeñas',
    )
  await page.getByLabel('Título de la tarea para hoy').press('Enter')
  await expect(
    page.getByRole('list', { name: 'Tareas para hoy' }),
  ).toBeVisible()
  await page.clock.setFixedTime(new Date('2026-09-25T22:05:00Z'))
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.locator('.date-line time')).toHaveAttribute(
    'datetime',
    '2026-09-26',
  )
  await expect(
    page.getByRole('list', { name: 'Tareas vencidas' }),
  ).toBeVisible()
  await page.goto('/settings')
  await page
    .getByLabel('Zona horaria', { exact: true })
    .selectOption('America/Los_Angeles')
  await page.getByRole('button', { name: 'Oscuro', exact: true }).click()
  await page.goto('/')
  await page.setViewportSize({ width: 320, height: 740 })
  await expect(page.locator('.date-line time')).toHaveAttribute(
    'datetime',
    '2026-09-25',
  )
  await expect(
    page.getByRole('list', { name: 'Tareas para hoy' }),
  ).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  expect(errors).toEqual([])
})
test('el panel no mezcla datos al cambiar de cuenta', async ({ page }) => {
  await page
    .getByLabel('Título de la tarea para hoy')
    .fill('Plan privado de Ana')
  await page.getByLabel('Título de la tarea para hoy').press('Enter')
  await expect(
    page.getByRole('list', { name: 'Tareas para hoy' }),
  ).toContainText('Plan privado de Ana')
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Iniciar sesión', exact: true }),
  ).toBeVisible()
  await login(page, '00000000-0000-4000-8000-000000000002')
  await page.goto('/')
  await expect(page.getByText('Tu día tiene espacio.')).toBeVisible()
  await expect(page.getByText('Plan privado de Ana')).toHaveCount(0)
})
