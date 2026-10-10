import { test, expect, type Page } from '@playwright/test'
import { login } from './auth-fixture.ts'

const calendarUrl = '/calendar?day=2026-09-24'
async function newEvent(page: Page, title: string) {
  await page.getByRole('button', { name: 'Nuevo evento', exact: true }).click()
  await page.getByLabel('Título', { exact: true }).fill(title)
}
async function save(page: Page) {
  await page.getByRole('button', { name: 'Crear evento', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
}
test.beforeEach(async ({ page }) => {
  await login(page)
  await page.goto('/settings')
  await page.getByLabel('Zona horaria').selectOption('Europe/Madrid')
  await page.goto(calendarUrl)
  await expect(
    page.getByRole('heading', { name: 'Tu calendario.' }),
  ).toBeVisible()
})
test('crea un evento con hora, lo edita y persiste al recargar', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await newEvent(page, 'Reunión del proyecto')
  await page.getByLabel('Hora de inicio', { exact: true }).fill('14:30')
  await page.getByLabel('Hora de fin', { exact: true }).fill('15:30')
  await page.getByRole('textbox', { name: /Lugar/ }).fill('Sala tranquila')
  await save(page)
  const agenda = page.getByRole('region', { name: 'Agenda del día' })
  await expect(agenda).toContainText('14:30')
  await agenda.getByRole('button', { name: /Reunión del proyecto/ }).click()
  await page.getByLabel('Título', { exact: true }).fill('Reunión revisada')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.reload()
  await expect(agenda).toContainText('Reunión revisada')
  await expect(agenda).toContainText('Sala tranquila')
  expect(errors).toEqual([])
})
test('el último día completo es incluido y la navegación respeta las preferencias', async ({
  page,
}) => {
  await newEvent(page, 'Encuentro de tres días')
  await page.getByLabel('Todo el día').check()
  await page.getByLabel('Último día (incluido)').fill('2026-09-26')
  await save(page)
  await page.getByRole('button', { name: 'Agenda', exact: true }).click()
  const agenda = page.getByRole('region', { name: 'Agenda del mes' })
  await expect(
    agenda.getByRole('button', { name: /Encuentro de tres días/ }),
  ).toHaveCount(3)
  await page.getByRole('button', { name: 'Mes', exact: true }).click()
  await page.locator('button[data-day="2026-09-27"]').click()
  await expect(
    page.getByRole('region', { name: 'Agenda del día' }),
  ).not.toContainText('Encuentro de tres días')
  await page.getByRole('button', { name: 'Mes siguiente' }).click()
  await expect(
    page.getByRole('heading', { name: 'octubre de 2026' }),
  ).toBeVisible()
  await page.getByLabel('Ir al mes').fill('2026-12')
  await page.getByRole('button', { name: 'Mes siguiente' }).click()
  await expect(
    page.getByRole('heading', { name: 'enero de 2027' }),
  ).toBeVisible()
  await page.goto('/settings')
  await page
    .getByRole('combobox', { name: 'Primer día de la semana' })
    .selectOption('sunday')
  await page.goto(calendarUrl)
  await expect(page.getByRole('columnheader').first()).toHaveText('dom')
})
test('muestra tareas fechadas, filtra tipos y abre el editor de tareas existente', async ({
  page,
}) => {
  await newEvent(page, 'Evento visible')
  await save(page)
  await page.goto('/tasks')
  await page.getByRole('button', { name: 'Nueva tarea', exact: true }).click()
  await page.getByLabel('Título', { exact: true }).fill('Entrega del diseño')
  await page.getByLabel('Fecha límite', { exact: true }).fill('2026-09-24')
  await page.getByRole('button', { name: 'Crear tarea', exact: true }).click()
  await page.goto(calendarUrl)
  const agenda = page.getByRole('region', { name: 'Agenda del día' })
  await expect(agenda).toContainText('Entrega del diseño')
  await page.getByRole('checkbox', { name: 'Eventos', exact: true }).uncheck()
  await expect(agenda).not.toContainText('Evento visible')
  await page.getByRole('checkbox', { name: 'Tareas', exact: true }).uncheck()
  await expect(agenda).not.toContainText('Entrega del diseño')
  await page.getByRole('checkbox', { name: 'Tareas', exact: true }).check()
  await agenda.getByRole('button', { name: /Entrega del diseño/ }).click()
  await expect(page).toHaveURL(/\/tasks\?task=/)
  await expect(page.getByLabel('Título', { exact: true })).toHaveValue(
    'Entrega del diseño',
  )
})
test('una serie se proyecta sin duplicar registros, y se edita y elimina completa', async ({
  page,
}) => {
  await newEvent(page, 'Lectura diaria')
  await page
    .getByRole('combobox', { name: 'Repetir', exact: true })
    .selectOption('custom')
  await page.getByLabel('Regla RRULE').fill('FREQ=DAILY;COUNT=3')
  await save(page)
  await page.getByRole('button', { name: 'Agenda', exact: true }).click()
  const agenda = page.getByRole('region', { name: 'Agenda del mes' })
  await expect(
    agenda.getByRole('button', { name: /Lectura diaria/ }),
  ).toHaveCount(3)
  await agenda
    .getByRole('button', { name: /Lectura diaria/ })
    .nth(1)
    .click()
  await expect(page.getByText(/Editas toda la serie/)).toBeVisible()
  await page.getByLabel('Título', { exact: true }).fill('Leer un capítulo')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(
    agenda.getByRole('button', { name: /Leer un capítulo/ }),
  ).toHaveCount(3)
  await agenda
    .getByRole('button', { name: /Leer un capítulo/ })
    .first()
    .click()
  await page.getByRole('button', { name: 'Eliminar serie' }).click()
  await page.getByRole('button', { name: 'Confirmar eliminación' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(
    agenda.getByRole('button', { name: /Leer un capítulo/ }),
  ).toHaveCount(0)
  const rows = await page.evaluate(
    () =>
      new Promise<{ deletedAt?: string }[]>((resolve) => {
        const open = indexedDB.open('dayflow')
        open.onsuccess = () => {
          const db = open.result
          const request = db
            .transaction('events')
            .objectStore('events')
            .getAll()
          request.onsuccess = () => {
            resolve(request.result)
            db.close()
          }
        }
      }),
  )
  expect(rows).toHaveLength(1)
  expect(rows[0]?.deletedAt).toBeTruthy()
})
test('a 320px permite crear offline y conserva el evento tras reconectar', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Oscuro', exact: true }).click()
  await page.goto(calendarUrl)
  await newEvent(page, 'Plan sin conexión')
  await context.setOffline(true)
  expect(
    await page.evaluate(() => {
      const dialog = document.querySelector('dialog')!
      return (
        document.documentElement.scrollWidth <= innerWidth &&
        dialog.scrollWidth <= dialog.clientWidth
      )
    }),
  ).toBe(true)
  await save(page)
  await expect(
    page.getByRole('region', { name: 'Agenda del día' }),
  ).toContainText('Plan sin conexión')
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await context.setOffline(false)
  await page.reload()
  await expect(
    page.getByRole('region', { name: 'Agenda del día' }),
  ).toContainText('Plan sin conexión')
})
test('protege cambios sin guardar y rechaza horas inexistentes', async ({
  page,
}) => {
  await newEvent(page, 'Borrador')
  await page.getByLabel('Fecha de inicio', { exact: true }).fill('2026-03-29')
  await page.getByLabel('Fecha de fin', { exact: true }).fill('2026-03-29')
  await page.getByLabel('Hora de inicio', { exact: true }).fill('02:30')
  await page.getByRole('button', { name: 'Crear evento', exact: true }).click()
  await expect(page.getByText(/Esta hora no existe o se repite/)).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click()
  await page.getByRole('button', { name: 'Seguir editando' }).click()
  await expect(page.getByLabel('Título', { exact: true })).toHaveValue(
    'Borrador',
  )
  await page.goBack()
  await expect(
    page.getByRole('group', { name: 'Cambios sin guardar' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Descartar cambios' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
test('un formulario obsoleto no sobrescribe una edición de otra pestaña', async ({
  page,
  context,
}) => {
  await newEvent(page, 'Evento inicial')
  await save(page)
  await page
    .getByRole('region', { name: 'Agenda del día' })
    .getByRole('button', { name: /Evento inicial/ })
    .click()
  const other = await context.newPage()
  await other.route('https://dayflow-e2e.supabase.co/**', (route) =>
    route.abort(),
  )
  await other.goto(page.url())
  await other
    .getByLabel('Título', { exact: true })
    .fill('Versión de otra pestaña')
  await other.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(other.getByRole('dialog')).toHaveCount(0)
  await page.getByLabel('Título', { exact: true }).fill('Mi edición')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByRole('alert')).toContainText('otra pestaña')
  await expect(page.getByLabel('Título', { exact: true })).toHaveValue(
    'Mi edición',
  )
  await other.close()
})
test('otra cuenta no ve los eventos locales de la anterior', async ({
  page,
}) => {
  await newEvent(page, 'Reunión privada')
  await save(page)
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await login(page, '00000000-0000-4000-8000-000000000002')
  await page.goto(calendarUrl)
  await expect(
    page.getByRole('region', { name: 'Agenda del día' }),
  ).not.toContainText('Reunión privada')
  await expect(
    page.getByText('Un día con espacio para lo que importa.'),
  ).toBeVisible()
})

test('semana y día conservan fecha, filtros, creación y navegación entre años', async ({
  page,
}) => {
  await newEvent(page, 'Plan semanal')
  await page.getByLabel('Hora de inicio', { exact: true }).fill('09:30')
  await page.getByLabel('Hora de fin', { exact: true }).fill('10:30')
  await save(page)
  await newEvent(page, 'Día reservado')
  await page.getByLabel('Todo el día').check()
  await save(page)
  await page.getByRole('button', { name: 'Semana', exact: true }).click()
  const week = page.getByRole('region', { name: 'Vista semanal', exact: true })
  await expect(week.getByRole('columnheader')).toHaveCount(8)
  await expect(
    week.getByRole('button', { name: /Plan semanal/ }),
  ).toContainText('09:30')
  await expect(
    week.getByRole('button', { name: /Día reservado/ }),
  ).toContainText('Todo el día')
  await page.getByLabel('Eventos', { exact: true }).uncheck()
  await expect(week.getByRole('button', { name: /Plan semanal/ })).toHaveCount(
    0,
  )
  await page.getByLabel('Eventos', { exact: true }).check()
  await week
    .getByRole('button', { name: 'Ver día 2026-09-24', exact: true })
    .click()
  const day = page.getByRole('region', { name: 'Vista diaria', exact: true })
  await expect(day.getByRole('columnheader')).toHaveCount(2)
  await day.getByRole('button', { name: /Plan semanal/ }).click()
  await expect(page.getByLabel('Título', { exact: true })).toHaveValue(
    'Plan semanal',
  )
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Día siguiente', exact: true }).click()
  await expect(page.getByLabel('Ir al día')).toHaveValue('2026-09-25')
  await day.getByRole('button', { name: 'Crear evento el 2026-09-25' }).click()
  await expect(page.getByLabel('Fecha de inicio', { exact: true })).toHaveValue(
    '2026-09-25',
  )
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByLabel('Ir al día').fill('2026-12-31')
  await expect(page).toHaveURL(/(?:\?|&)day=2026-12-31(?:&|$)/)
  await page.getByRole('button', { name: 'Día siguiente', exact: true }).click()
  await expect(page.getByLabel('Ir al día')).toHaveValue('2027-01-01')
  await page.getByRole('button', { name: 'Semana', exact: true }).click()
  await expect(
    week.getByRole('button', { name: 'Ver día 2026-12-28' }),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('button', { name: 'Semana', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await page
    .getByRole('button', { name: 'Semana siguiente', exact: true })
    .click()
  await expect(page.getByLabel('Ir al día')).toHaveValue('2027-01-08')
})

test('horario semanal respeta domingo, formato de 12 horas y no desborda a 320px', async ({
  page,
}) => {
  await page.goto('/settings')
  await page.getByLabel('Primer día de la semana').selectOption('sunday')
  await page.getByLabel('Formato horario').selectOption('12')
  await page.goto('/calendar?view=week&day=2026-10-25')
  const week = page.getByRole('region', { name: 'Vista semanal', exact: true })
  await expect(week.getByRole('columnheader').nth(1)).toContainText('dom')
  await expect(
    week.getByRole('rowheader', { name: '1 p. m.', exact: true }),
  ).toHaveCount(1)
  await page.setViewportSize({ width: 320, height: 780 })
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true)
  await expect(week.getByRole('region')).toBeVisible()
  await week
    .getByRole('button', { name: 'Ver día 2026-10-31', exact: true })
    .click()
  await expect(
    page.getByRole('region', { name: 'Vista diaria', exact: true }),
  ).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true)
})
