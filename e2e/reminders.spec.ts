import { test, expect, type Page } from '@playwright/test'
import { login } from './auth-fixture.ts'

async function fillReminder(page: Page, title = 'Llamar a Clara') {
  await page.getByLabel('Título', { exact: true }).fill(title)
  await page.getByLabel('Fecha', { exact: true }).fill('2026-10-24')
  await page.getByLabel('Hora', { exact: true }).fill('09:00')
  await page
    .getByLabel('Zona horaria', { exact: true })
    .selectOption('Europe/Madrid')
}
async function save(page: Page) {
  await page
    .getByRole('button', { name: 'Guardar recordatorio', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
}
test.beforeEach(async ({ page }) => {
  await login(page)
  await page.goto('/reminders')
  await expect(
    page.getByRole('heading', { name: 'Tus recordatorios.' }),
  ).toBeVisible()
})
test('crea, edita y elimina sin prometer alarmas web; persiste al recargar', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page
    .getByRole('button', { name: 'Nuevo recordatorio', exact: true })
    .click()
  await fillReminder(page)
  await save(page)
  await expect(page.getByText('Guardado · sin alarma web')).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: /Llamar a Clara/ }).click()
  await page.getByLabel('Título', { exact: true }).fill('Llamar a Ana')
  await save(page)
  await page.getByRole('button', { name: /Llamar a Ana/ }).click()
  await page
    .getByRole('button', { name: 'Eliminar recordatorio', exact: true })
    .click()
  await page.getByRole('button', { name: 'Confirmar eliminación' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(
    page.getByRole('heading', { name: 'Un lugar para recordar.' }),
  ).toBeVisible()
  expect(errors).toEqual([])
})
test('vincula una tarea y muestra una serie en el calendario con filtro', async ({
  page,
}) => {
  await page.goto('/tasks?create=1')
  await page.getByLabel('Título', { exact: true }).fill('Preparar viaje')
  await page.getByRole('button', { name: 'Crear tarea', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: /Abrir tarea Preparar viaje/ }).click()
  await page.getByRole('link', { name: 'Crear recordatorio' }).click()
  await expect(page.getByLabel('Título', { exact: true })).toHaveValue(
    'Preparar viaje',
  )
  await expect(page.getByLabel('Asociar con')).not.toHaveValue('')
  await fillReminder(page, 'Revisar equipaje')
  await page.getByLabel('Repetición').selectOption('custom')
  await page.getByLabel('Regla RRULE').fill('FREQ=DAILY;COUNT=3')
  await save(page)
  await expect(
    page.getByRole('link', { name: 'Tarea: Preparar viaje' }),
  ).toBeVisible()
  await page.goto('/settings')
  await page
    .getByLabel('Zona horaria', { exact: true })
    .selectOption('Europe/Madrid')
  await page.goto('/calendar?day=2026-10-24&view=agenda')
  const agenda = page.getByRole('region', { name: 'Agenda del mes' })
  await expect(
    agenda.getByRole('button', { name: /Revisar equipaje/ }),
  ).toHaveCount(3)
  await expect(
    agenda.getByRole('button', { name: /Revisar equipaje/ }).last(),
  ).toContainText('09:00')
  await page
    .getByRole('checkbox', { name: 'Recordatorios', exact: true })
    .uncheck()
  await expect(
    agenda.getByRole('button', { name: /Revisar equipaje/ }),
  ).toHaveCount(0)
  await page
    .getByRole('checkbox', { name: 'Recordatorios', exact: true })
    .check()
  await agenda
    .getByRole('button', { name: /Revisar equipaje/ })
    .first()
    .click()
  await expect(
    page.getByRole('dialog', { name: 'Editar recordatorio' }),
  ).toBeVisible()
})
test('protege cambios sin guardar, valida DST y permite desactivar avisos', async ({
  page,
}) => {
  await page
    .getByRole('button', { name: 'Nuevo recordatorio', exact: true })
    .click()
  await fillReminder(page)
  await page.getByLabel('Fecha', { exact: true }).fill('2027-03-28')
  await page.getByLabel('Hora', { exact: true }).fill('02:30')
  await page
    .getByRole('button', { name: 'Guardar recordatorio', exact: true })
    .click()
  await expect(page.getByRole('alert')).toContainText('cambio horario')
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(
    page.getByText('Tienes cambios sin guardar.', { exact: false }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Seguir editando' }).click()
  await page.getByLabel('Hora', { exact: true }).fill('09:00')
  await page.getByLabel('Solicitar aviso para este recordatorio').uncheck()
  await save(page)
  await expect(page.getByText('Avisos desactivados')).toBeVisible()
  await page.getByLabel('Filtrar recordatorios').selectOption('enabled')
  await expect(
    page.getByRole('heading', { name: 'Sin coincidencias' }),
  ).toBeVisible()
  await page.getByLabel('Filtrar recordatorios').selectOption('disabled')
  await expect(
    page.getByRole('button', { name: /Llamar a Clara/ }),
  ).toBeVisible()
})
test('separa cuentas, muestra permisos reales y funciona sin conexión con la app abierta', async ({
  page,
  context,
}) => {
  await page
    .getByRole('button', { name: 'Nuevo recordatorio', exact: true })
    .click()
  await fillReminder(page, 'Recordatorio privado')
  await context.setOffline(true)
  await save(page)
  await expect(page.getByText('Guardado · sin alarma web')).toBeVisible()
  await context.setOffline(false)
  await page.goto('/settings')
  await expect(
    page.getByRole('heading', { name: 'Notificaciones en este dispositivo' }),
  ).toBeVisible()
  await expect(
    page.getByText(/esta versión web no envía alarmas/),
  ).toBeVisible()
  await page.getByLabel('Permitir avisos en este dispositivo').uncheck()
  await expect(
    page.getByText('Estado actualizado en este dispositivo.'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await login(page, '00000000-0000-4000-8000-000000000002')
  await page.goto('/reminders')
  await expect(
    page.getByRole('button', { name: /Recordatorio privado/ }),
  ).toHaveCount(0)
})
