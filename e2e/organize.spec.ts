import { test, expect, type Page } from '@playwright/test'
import { login } from './auth-fixture.ts'
test.setTimeout(60000)
async function capture(page: Page, title: string) {
  await page.goto('/inbox')
  await page.getByLabel('Nueva captura').fill(title)
  await page.getByLabel('Nueva captura').press('Enter')
  await expect(
    page.getByRole('button', { name: `Organizar ${title}`, exact: true }),
  ).toBeVisible()
}
async function convert(page: Page, title: string, kind: string) {
  await page
    .getByRole('button', { name: `Organizar ${title}`, exact: true })
    .click()
  await page.getByLabel('Convertir en').selectOption(kind)
  await page
    .getByRole('button', { name: 'Convertir captura', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
}
test.beforeEach(async ({ page }) => {
  await login(page)
})

test('relaciona notas, tareas y eventos en ambos sentidos, protege borradores y desvincula offline', async ({
  page,
  context,
}) => {
  await capture(page, 'Plan relacionado')
  await convert(page, 'Plan relacionado', 'tasks')
  await page.getByRole('link', { name: 'Abrir tarea', exact: true }).click()
  await expect(page).toHaveURL(/\/tasks\?task=/)
  const taskUrl = page.url()
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await capture(page, 'Resumen relacionado')
  await convert(page, 'Resumen relacionado', 'notes')
  await page.getByRole('link', { name: 'Abrir nota', exact: true }).click()
  await page.getByRole('button', { name: 'Listo', exact: true }).click()
  await page.goto('/calendar?day=2026-09-24&view=day')
  await page.getByRole('button', { name: 'Nuevo evento', exact: true }).click()
  await page.getByLabel('Título', { exact: true }).fill('Encuentro relacionado')
  await page.getByRole('button', { name: 'Crear evento', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.goto(taskUrl)
  const panel = page.getByRole('group', {
    name: 'Elementos relacionados',
    exact: true,
  })
  await panel.getByRole('button', { name: 'Vincular un elemento' }).click()
  await panel.getByLabel('Buscar elementos').fill('resumen')
  await context.setOffline(true)
  await panel
    .getByRole('button', {
      name: 'Vincular nota: Resumen relacionado',
      exact: true,
    })
    .click()
  await expect(
    panel.getByRole('link', {
      name: 'Abrir nota relacionada: Resumen relacionado',
    }),
  ).toBeVisible()
  await context.setOffline(false)
  await panel.getByLabel('Buscar elementos').fill('encuentro')
  await panel
    .getByRole('button', {
      name: 'Vincular evento: Encuentro relacionado',
      exact: true,
    })
    .click()
  await expect(
    panel.getByRole('link', {
      name: 'Abrir evento relacionado: Encuentro relacionado',
    }),
  ).toBeVisible()
  await page.reload()
  await expect(panel.getByRole('link')).toHaveCount(2)
  await page.getByLabel('Título', { exact: true }).fill('Borrador sin guardar')
  await panel.getByRole('link', { name: /Abrir nota relacionada/ }).click()
  await expect(
    page.getByRole('group', { name: 'Cambios sin guardar' }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Seguir editando', exact: true })
    .click()
  await expect(page.getByLabel('Título', { exact: true })).toHaveValue(
    'Borrador sin guardar',
  )
  await panel.getByRole('link', { name: /Abrir nota relacionada/ }).click()
  await page
    .getByRole('button', { name: 'Descartar cambios', exact: true })
    .click()
  await expect(page.getByRole('dialog', { name: 'Editar nota' })).toBeVisible()
  await expect(
    panel.getByRole('link', {
      name: 'Abrir tarea relacionada: Plan relacionado',
    }),
  ).toBeVisible()
  await panel.getByRole('button', { name: 'Vincular un elemento' }).click()
  await panel.getByLabel('Tipo de elemento').selectOption('event')
  await panel
    .getByRole('button', {
      name: 'Vincular evento: Encuentro relacionado',
      exact: true,
    })
    .click()
  await page
    .getByLabel('Título de la nota', { exact: true })
    .fill('Resumen actualizado')
  await panel.getByRole('link', { name: /Abrir evento relacionado/ }).click()
  await expect(page.getByLabel('Título', { exact: true })).toHaveValue(
    'Encuentro relacionado',
  )
  await expect(
    panel.getByRole('link', {
      name: 'Abrir nota relacionada: Resumen actualizado',
    }),
  ).toBeVisible()
  await context.setOffline(true)
  await panel
    .getByRole('button', {
      name: 'Desvincular Resumen actualizado',
      exact: true,
    })
    .click()
  await expect(
    panel.getByRole('link', { name: /Abrir nota relacionada/ }),
  ).toHaveCount(0)
  await context.setOffline(false)
  await page.reload()
  await expect(panel.getByRole('link')).toHaveCount(1)
  await panel.getByRole('link', { name: /Abrir tarea relacionada/ }).click()
  await panel.getByRole('link', { name: /Abrir nota relacionada/ }).click()
  await expect(page.getByLabel('Título de la nota')).toHaveValue(
    'Resumen actualizado',
  )
  await expect(
    panel.getByRole('link', { name: /Abrir evento relacionado/ }),
  ).toHaveCount(0)
  await page.setViewportSize({ width: 320, height: 780 })
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true)
})
test('captura offline, edita, convierte a tarea y conserva una sola copia al recargar', async ({
  page,
  context,
}) => {
  await page.goto('/inbox')
  await expect(page.getByLabel('Nueva captura')).toBeVisible()
  await context.setOffline(true)
  await page.getByLabel('Nueva captura').fill('Comprar monitor')
  await page.getByLabel('Nueva captura').press('Enter')
  await page.getByRole('button', { name: 'Organizar Comprar monitor' }).click()
  await page.getByLabel('Texto de la captura').fill('Comparar pantallas')
  await page.getByRole('button', { name: 'Guardar texto' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await convert(page, 'Comparar pantallas', 'tasks')
  await context.setOffline(false)
  await page.getByRole('link', { name: 'Abrir tarea', exact: true }).click()
  await expect(page.getByLabel('Título', { exact: true })).toHaveValue(
    'Comparar pantallas',
  )
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await page.reload()
  await expect(
    page.getByRole('button', {
      name: 'Abrir tarea Comparar pantallas',
      exact: true,
    }),
  ).toHaveCount(1)
  await page.goto('/inbox')
  await expect(
    page.getByRole('button', { name: 'Organizar Comparar pantallas' }),
  ).toHaveCount(0)
})
test('convierte a nota, evento y recordatorio conservando texto y fechas', async ({
  page,
}) => {
  await capture(page, 'Ideas para el viaje')
  await convert(page, 'Ideas para el viaje', 'notes')
  await page.getByRole('link', { name: 'Abrir nota', exact: true }).click()
  await expect(
    page.getByRole('textbox', { name: 'Contenido de la nota' }),
  ).toHaveText('Ideas para el viaje')
  await page.getByRole('button', { name: 'Listo', exact: true }).click()
  await capture(page, 'Encuentro de equipo')
  await page
    .getByRole('button', { name: 'Organizar Encuentro de equipo' })
    .click()
  await page.getByLabel('Convertir en').selectOption('events')
  await page.getByLabel('Todo el día').check()
  await page.getByLabel('Fecha', { exact: true }).fill('2026-10-24')
  await page.getByLabel('Último día (incluido)').fill('2026-10-26')
  await page.getByRole('button', { name: 'Convertir captura' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('link', { name: 'Abrir evento', exact: true }).click()
  await expect(page.getByLabel('Título', { exact: true })).toHaveValue(
    'Encuentro de equipo',
  )
  await expect(page.getByLabel('Último día (incluido)')).toHaveValue(
    '2026-10-26',
  )
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await capture(page, 'Llamar al taller')
  await page.getByRole('button', { name: 'Organizar Llamar al taller' }).click()
  await page.getByLabel('Convertir en').selectOption('reminders')
  await page.getByLabel('Fecha', { exact: true }).fill('2026-10-25')
  await page.getByLabel('Hora', { exact: true }).fill('10:30')
  await page.getByRole('button', { name: 'Convertir captura' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page
    .getByRole('link', { name: 'Abrir recordatorio', exact: true })
    .click()
  await expect(page.getByLabel('Título', { exact: true })).toHaveValue(
    'Llamar al taller',
  )
  await expect(page.getByLabel('Hora', { exact: true })).toHaveValue('10:30')
})
test('búsqueda agrupada sin acentos, filtros, teclado y apertura de Inbox a 320px', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await capture(page, 'Órbita tarea')
  await convert(page, 'Órbita tarea', 'tasks')
  await capture(page, 'Órbita nota')
  await convert(page, 'Órbita nota', 'notes')
  await capture(page, 'Órbita captura')
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Oscuro', exact: true }).click()
  await page.goto('/inbox')
  await page.getByRole('heading', { name: 'Tu Inbox.' }).click()
  await page.keyboard.press('Control+k')
  const search = page.getByLabel('Buscar en todos tus elementos')
  await expect(search).toBeFocused()
  await search.fill('orbita')
  await expect(
    page.getByRole('region', { name: 'Notas', exact: true }),
  ).toContainText('Órbita nota')
  await expect(
    page.getByRole('region', { name: 'Tareas', exact: true }),
  ).toContainText('Órbita tarea')
  await page.setViewportSize({ width: 320, height: 740 })
  expect(
    await page
      .getByRole('dialog')
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true)
  await page
    .getByRole('combobox', { name: 'Tipo', exact: true })
    .selectOption('inbox')
  await expect(
    page.getByRole('region', { name: 'Notas', exact: true }),
  ).toHaveCount(0)
  await search.focus()
  await search.press('ArrowDown')
  await expect(
    page.getByRole('link', { name: 'Órbita captura', exact: true }),
  ).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(
    page.getByRole('dialog', { name: 'Organizar captura' }),
  ).toBeVisible()
  await expect(page.getByLabel('Texto de la captura')).toHaveValue(
    'Órbita captura',
  )
  expect(errors).toEqual([])
})
test('una etiqueta agrupa notas, tareas y eventos; renombrar y eliminar conserva documentos', async ({
  page,
}) => {
  await page.goto('/tags')
  await page
    .getByRole('button', { name: 'Nueva etiqueta', exact: true })
    .click()
  await page.getByLabel('Nombre de la etiqueta').fill('Proyecto común')
  await page.getByRole('button', { name: 'Guardar etiqueta' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  for (const [kind, label] of [
    ['tasks', 'tarea'],
    ['notes', 'nota'],
    ['events', 'evento'],
  ]) {
    const title = `Plan ${label}`
    await capture(page, title)
    await convert(page, title, kind!)
    await page
      .getByRole('link', { name: `Abrir ${label}`, exact: true })
      .click()
    await page
      .getByRole('checkbox', { name: 'Proyecto común', exact: true })
      .click()
    await expect(
      page.getByRole('checkbox', { name: 'Proyecto común', exact: true }),
    ).toBeChecked()
    await page
      .getByRole('button', {
        name: kind === 'notes' ? 'Listo' : 'Cancelar',
        exact: true,
      })
      .click()
  }
  await page.goto('/tags')
  await page.getByRole('link', { name: 'Ver elementos', exact: true }).click()
  await expect(page.getByText('3 resultados en este dispositivo')).toBeVisible()
  for (const label of ['Tareas', 'Notas', 'Eventos'])
    await expect(
      page.getByRole('region', { name: label, exact: true }),
    ).toBeVisible()
  await page.goto('/tags')
  await page
    .getByRole('button', { name: 'Editar etiqueta Proyecto común' })
    .click()
  await page.getByLabel('Nombre de la etiqueta').fill('Proyecto revisado')
  await page.getByRole('button', { name: 'Guardar etiqueta' }).click()
  await page
    .getByRole('button', { name: 'Editar etiqueta Proyecto revisado' })
    .click()
  await page
    .getByRole('button', { name: 'Eliminar etiqueta', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Confirmar eliminación', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.goto('/search')
  await page.getByLabel('Buscar en todos tus elementos').fill('Plan')
  await expect(page.getByText('3 resultados en este dispositivo')).toBeVisible()
  await expect(page.getByText('Proyecto revisado')).toHaveCount(0)
})
test('una captura modificada en otra pestaña protege el borrador y permite descartar antes de salir', async ({
  page,
  context,
}) => {
  await capture(page, 'Borrador compartido')
  await page
    .getByRole('button', { name: 'Organizar Borrador compartido' })
    .click()
  const other = await context.newPage()
  await other.goto('/inbox')
  await other
    .getByRole('button', { name: 'Organizar Borrador compartido' })
    .click()
  await other.getByLabel('Texto de la captura').fill('Nueva versión')
  await other.getByRole('button', { name: 'Guardar texto' }).click()
  await expect(other.getByRole('dialog')).toHaveCount(0)
  await page.getByLabel('Texto de la captura').fill('Mi borrador')
  await page.getByRole('button', { name: 'Guardar texto' }).click()
  await expect(page.getByRole('alert')).toContainText('ha cambiado')
  await expect(page.getByLabel('Texto de la captura')).toHaveValue(
    'Mi borrador',
  )
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click()
  await page
    .getByRole('button', { name: 'Descartar cambios', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Organizar Nueva versión' }),
  ).toBeVisible()
  await other.close()
})
test('cambiar de cuenta aísla Inbox, etiquetas y resultados de búsqueda', async ({
  page,
}) => {
  await capture(page, 'Información privada')
  await page.goto('/tags')
  await page
    .getByRole('button', { name: 'Nueva etiqueta', exact: true })
    .click()
  await page.getByLabel('Nombre de la etiqueta').fill('Etiqueta privada')
  await page.getByRole('button', { name: 'Guardar etiqueta' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Iniciar sesión', exact: true }),
  ).toBeVisible()
  await login(page, '00000000-0000-4000-8000-000000000002')
  await page.goto('/inbox')
  await expect(page.getByText('Información privada')).toHaveCount(0)
  await page.goto('/tags')
  await expect(page.getByText('Etiqueta privada')).toHaveCount(0)
  await page.goto('/search')
  await page.getByLabel('Buscar en todos tus elementos').fill('privada')
  await expect(page.getByText('0 resultados en este dispositivo')).toBeVisible()
})
