import { expect, test } from '@playwright/test'
import { login } from './auth-fixture.ts'

test('Acceso permite localizar y corregir el primer error con el teclado', async ({
  page,
}) => {
  await page.goto('/auth/login')
  const email = page.getByLabel('Email')
  const password = page.getByLabel('Contraseña', { exact: true })
  await password.press('Enter')
  await expect(email).toBeFocused()
  await expect(email).toHaveAccessibleDescription(/correo|email/i)
  await email.fill('ana@dayflow.test')
  await expect(email).toHaveAttribute('aria-invalid', 'false')
  await email.press('Enter')
  await expect(password).toBeFocused()
  await expect(password).toHaveAccessibleDescription(/contraseña/i)
})

test('navega con teclado y corrige los errores de Tareas y Eventos a 320 px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.emulateMedia({ colorScheme: 'dark' })
  await login(page)
  await page
    .getByRole('button', { name: 'Nueva tarea', exact: true })
    .press('Enter')
  const task = page.getByRole('form', { name: 'Crear tarea' })
  const taskTitle = task.getByLabel('Título', { exact: true })
  await task.getByRole('button', { name: 'Crear tarea' }).press('Enter')
  await expect(taskTitle).toBeFocused()
  await expect(taskTitle).toHaveAccessibleDescription('Escribe un título.')
  await taskTitle.fill('Preparar el viaje')
  await expect(taskTitle).toHaveAttribute('aria-invalid', 'false')
  const details = task.locator('details')
  await details.locator('summary').press('Enter')
  const startDate = task.getByLabel('Fecha de inicio', { exact: true })
  await startDate.fill('2026-11-20')
  await details.locator('summary').press('Enter')
  await task.getByRole('button', { name: 'Crear tarea' }).press('Enter')
  const startTime = task.getByLabel('Hora de inicio', { exact: true })
  await expect(startTime).toBeFocused()
  await expect(startTime).toHaveAccessibleDescription(
    'Añade una hora de inicio.',
  )
  await startTime.fill('10:00')
  await task.getByRole('button', { name: 'Crear tarea' }).press('Enter')
  await expect(
    page.getByRole('button', { name: 'Abrir tarea Preparar el viaje' }),
  ).toBeVisible()

  const searchShortcut = process.platform === 'darwin' ? 'Meta+k' : 'Control+k'
  await page.keyboard.press(searchShortcut)
  const search = page.getByRole('searchbox', {
    name: 'Buscar en todos tus elementos',
  })
  await expect(search).toBeFocused()
  await search.press('Escape')
  await expect(search).toHaveCount(0)
  await page.locator('a[href="/calendar"]:visible').first().press('Enter')
  await expect(page).toHaveURL(/\/calendar/)
  await page
    .getByRole('button', { name: 'Nuevo evento', exact: true })
    .press('Enter')
  const event = page.getByRole('form', { name: 'Crear evento' })
  const eventTitle = event.getByLabel('Título', { exact: true })
  const endDate = event.getByLabel('Fecha de fin', { exact: true })
  const originalDate = await endDate.inputValue()
  await endDate.clear()
  const create = event.getByRole('button', { name: 'Crear evento' })
  await create.press('Enter')
  await expect(eventTitle).toBeFocused()
  await expect(eventTitle).toHaveAccessibleDescription('Escribe un título.')
  await eventTitle.fill('Viaje')
  await create.press('Enter')
  await expect(endDate).toBeFocused()
  await expect(endDate).toHaveAccessibleDescription(
    'Selecciona una fecha final.',
  )
  await endDate.fill(originalDate)
  await create.press('Enter')
  await expect(event).toHaveCount(0)
})
