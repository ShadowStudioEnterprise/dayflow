import { test, expect, type Page } from '@playwright/test'
import { login } from './auth-fixture.ts'

async function createNote(page: Page, title: string) {
  await page.getByRole('button', { name: 'Nueva nota', exact: true }).click()
  await page.getByRole('textbox', { name: /Título/ }).fill(title)
  await page.getByRole('button', { name: 'Crear nota', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Editar nota' })).toBeVisible()
  await expect(
    page.getByRole('textbox', { name: 'Contenido de la nota' }),
  ).toBeVisible()
}
test.beforeEach(async ({ page }) => {
  await login(page)
  await page.goto('/notes')
  await expect(page.getByRole('heading', { name: 'Tus notas.' })).toBeVisible()
})

test('crea, edita formato, autoguarda y persiste al recargar', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await createNote(page, 'Cuaderno de ideas')
  const body = page.getByRole('textbox', { name: 'Contenido de la nota' })
  await body.fill('Una idea importante')
  // Use the browser selection API: mobile emulation and host OS map shortcuts differently.
  await body.evaluate((element) => {
    const range = document.createRange()
    range.selectNodeContents(element)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
  })
  await page.getByRole('button', { name: 'Negrita', exact: true }).click()
  await expect(body.locator('strong')).toHaveText('Una idea importante')
  await page
    .getByRole('textbox', { name: 'Título de la nota' })
    .fill('Ideas del proyecto')
  await page.getByRole('button', { name: 'Lavanda', exact: true }).click()
  await expect(
    page.getByText('Guardado en este dispositivo', { exact: true }),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('textbox', { name: 'Título de la nota' }),
  ).toHaveValue('Ideas del proyecto')
  await expect(body.locator('strong')).toHaveText('Una idea importante')
  await expect(
    page.getByRole('button', { name: 'Lavanda', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Listo', exact: true }).click()
  await page.getByRole('searchbox', { name: 'Buscar notas' }).fill('importante')
  await expect(
    page.getByRole('button', { name: 'Abrir nota: Ideas del proyecto' }),
  ).toBeVisible()
  await page
    .getByRole('searchbox', { name: 'Buscar notas' })
    .fill('inexistente')
  await expect(
    page.getByRole('heading', { name: 'No encontramos esa idea.' }),
  ).toBeVisible()
  expect(errors).toEqual([])
})

test('checklist y enlaces seguros sobreviven a la reapertura', async ({
  page,
}) => {
  await createNote(page, 'Preparativos')
  const body = page.getByRole('textbox', { name: 'Contenido de la nota' })
  await body.fill('Revisar propuesta')
  await page.getByRole('button', { name: 'Checklist', exact: true }).click()
  await body.getByRole('checkbox').check()
  await body.press('Control+End')
  await body.press('Enter')
  await body.press('Enter')
  await page.getByRole('button', { name: 'Enlace', exact: true }).click()
  await page.getByLabel('Dirección del enlace').fill('javascript:alert(1)')
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('enlace completo')
  await page.getByLabel('Dirección del enlace').fill('https://example.com')
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
  await page.getByRole('button', { name: 'Listo', exact: true }).click()
  await page.getByRole('button', { name: 'Abrir nota: Preparativos' }).click()
  await expect(body.getByRole('checkbox')).toBeChecked()
  await expect(body.getByRole('link')).toHaveAttribute(
    'href',
    'https://example.com',
  )
})

test('fija, archiva, restaura y elimina sin borrar físicamente el registro', async ({
  page,
}) => {
  await createNote(page, 'Para conservar')
  await page.getByRole('button', { name: 'Listo', exact: true }).click()
  await page
    .getByRole('button', { name: 'Fijar nota: Para conservar', exact: true })
    .click()
  await page.getByRole('button', { name: /^Fijadas/ }).click()
  await page.getByRole('button', { name: 'Abrir nota: Para conservar' }).click()
  await expect(
    page.getByRole('button', { name: 'Desfijar', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Archivar', exact: true }).click()
  await page.getByRole('button', { name: 'Listo', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Abrir nota: Para conservar' }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: /^Archivo/ }).click()
  await page.getByRole('button', { name: 'Abrir nota: Para conservar' }).click()
  await page.getByRole('button', { name: 'Restaurar', exact: true }).click()
  await page.getByRole('button', { name: 'Listo', exact: true }).click()
  await page.getByRole('button', { name: /^Mis notas/ }).click()
  await page.getByRole('button', { name: 'Abrir nota: Para conservar' }).click()
  await page.getByRole('button', { name: 'Eliminar', exact: true }).click()
  await page.getByRole('button', { name: 'Conservar nota' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Eliminar', exact: true }).click()
  await page.getByRole('button', { name: 'Eliminar nota', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Abrir nota: Para conservar' }),
  ).toHaveCount(0)
  const rows = await page.evaluate(
    () =>
      new Promise<{ deletedAt?: string }[]>((resolve) => {
        const request = indexedDB.open('dayflow')
        request.onsuccess = () => {
          const db = request.result
          const rows = db.transaction('notes').objectStore('notes').getAll()
          rows.onsuccess = () => {
            resolve(rows.result)
            db.close()
          }
        }
      }),
  )
  expect(rows).toHaveLength(1)
  expect(rows[0]?.deletedAt).toBeTruthy()
})

test('320px, modo oscuro, offline y cierre inmediato guardan el último texto', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Oscuro', exact: true }).click()
  await page.goto('/notes')
  await createNote(page, 'Sin conexión')
  await context.setOffline(true)
  const body = page.getByRole('textbox', { name: 'Contenido de la nota' })
  await body.fill('Escrito sin red, justo antes de cerrar.')
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(
    page.getByText('Sin conexión · puedes seguir escribiendo'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Abrir nota: Sin conexión' }).click()
  await expect(body).toHaveText('Escrito sin red, justo antes de cerrar.')
  expect(
    await page.evaluate(() => {
      const dialog = document.querySelector('dialog')!
      return (
        document.documentElement.scrollWidth <= innerWidth &&
        dialog.scrollWidth <= dialog.clientWidth
      )
    }),
  ).toBe(true)
  await context.setOffline(false)
  await page.reload()
  await expect(body).toHaveText('Escrito sin red, justo antes de cerrar.')
})

test('un conflicto conserva el borrador y permite guardar ambas versiones', async ({
  page,
  context,
}) => {
  await createNote(page, 'Nota compartida entre pestañas')
  const noteUrl = page.url()
  const other = await context.newPage()
  await other.route('https://dayflow-e2e.supabase.co/**', (route) =>
    route.abort(),
  )
  await other.goto(noteUrl)
  await other
    .getByRole('textbox', { name: 'Contenido de la nota' })
    .fill('Versión de la segunda pestaña')
  await expect(
    other.getByText('Guardado en este dispositivo', { exact: true }),
  ).toBeVisible()
  await page
    .getByRole('textbox', { name: 'Contenido de la nota' })
    .fill('Mi borrador original')
  await expect(page.getByRole('alert')).toContainText('otra pestaña')
  await page.getByRole('button', { name: 'Listo', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Guardar como copia' }).click()
  await expect(
    page.getByRole('textbox', { name: 'Título de la nota' }),
  ).toHaveValue('Nota compartida entre pestañas (copia)')
  await expect(
    page.getByRole('textbox', { name: 'Contenido de la nota' }),
  ).toHaveText('Mi borrador original')
  await page.getByRole('button', { name: 'Listo', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Abrir nota:', exact: false }),
  ).toHaveCount(2)
  await other.close()
})

test('las notas de una cuenta no aparecen al cambiar de usuario', async ({
  page,
}) => {
  await createNote(page, 'Idea privada')
  await page.getByRole('button', { name: 'Listo', exact: true }).click()
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await login(page, '00000000-0000-4000-8000-000000000002')
  await page.goto('/notes')
  await expect(
    page.getByRole('heading', { name: 'Todo empieza con una idea.' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Abrir nota: Idea privada' }),
  ).toHaveCount(0)
})

test('volver atrás guarda primero los cambios pendientes', async ({ page }) => {
  await createNote(page, 'Antes de salir')
  await page
    .getByRole('textbox', { name: 'Contenido de la nota' })
    .fill('Última frase antes de volver.')
  await page.goBack()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Abrir nota: Antes de salir' }).click()
  await expect(
    page.getByRole('textbox', { name: 'Contenido de la nota' }),
  ).toHaveText('Última frase antes de volver.')
})

test('el borrado desde otra pestaña no desmonta el editor ni pierde el texto', async ({
  page,
  context,
}) => {
  await createNote(page, 'Idea en curso')
  const other = await context.newPage()
  await other.route('https://dayflow-e2e.supabase.co/**', (route) =>
    route.abort(),
  )
  await other.goto(page.url())
  await other.getByRole('button', { name: 'Eliminar', exact: true }).click()
  await other
    .getByRole('button', { name: 'Eliminar nota', exact: true })
    .click()
  await expect(other.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('dialog')).toBeVisible()
  await page
    .getByRole('textbox', { name: 'Contenido de la nota' })
    .fill('Este texto debe seguir aquí.')
  await expect(page.getByRole('alert')).toContainText('ya no está disponible')
  await page.getByRole('button', { name: 'Guardar como copia' }).click()
  await expect(
    page.getByRole('textbox', { name: 'Título de la nota' }),
  ).toHaveValue('Idea en curso (copia)')
  await expect(
    page.getByRole('textbox', { name: 'Contenido de la nota' }),
  ).toHaveText('Este texto debe seguir aquí.')
  await other.close()
})
