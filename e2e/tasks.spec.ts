import { test, expect } from '@playwright/test'
import { login } from './auth-fixture.ts'

test('login → crear → editar → completar → persistir y reabrir', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await login(page)
  await page.getByLabel('Título de la nueva tarea').fill('Preparar reunión')
  await page.getByLabel('Título de la nueva tarea').press('Enter')
  await page
    .getByRole('button', { name: 'Abrir tarea Preparar reunión' })
    .click()
  const dialog = page.getByRole('dialog')
  await dialog
    .getByLabel('Título', { exact: true })
    .fill('Preparar reunión semanal')
  await dialog
    .getByRole('combobox', { name: 'Prioridad', exact: true })
    .selectOption('high')
  await dialog.getByLabel('Fecha límite', { exact: true }).fill('2026-09-21')
  await dialog.getByLabel('Nueva subtarea').fill('Revisar documentos')
  await dialog.getByRole('button', { name: 'Añadir', exact: true }).click()
  await dialog
    .getByRole('checkbox', { name: 'Completar subtarea Revisar documentos' })
    .click()
  await expect(
    dialog.getByRole('checkbox', {
      name: 'Reabrir subtarea Revisar documentos',
    }),
  ).toBeChecked()
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(dialog).toHaveCount(0)
  await page
    .getByRole('checkbox', {
      name: 'Completar Preparar reunión semanal',
      exact: true,
    })
    .click()
  await page.getByRole('button', { name: 'Completadas', exact: true }).click()
  await expect(
    page.getByRole('checkbox', {
      name: 'Reabrir Preparar reunión semanal',
      exact: true,
    }),
  ).toBeChecked()
  await page.reload()
  await page.getByRole('button', { name: 'Completadas', exact: true }).click()
  await page
    .getByRole('checkbox', {
      name: 'Reabrir Preparar reunión semanal',
      exact: true,
    })
    .click()
  await page.getByRole('button', { name: 'Pendientes', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Abrir tarea Preparar reunión semanal' }),
  ).toBeVisible()
  expect(errors).toEqual([])
})

test('recurrencia crea la siguiente tarea una sola vez', async ({ page }) => {
  await login(page)
  await page.getByRole('button', { name: 'Nueva tarea', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Título', { exact: true }).fill('Leer un capítulo')
  await dialog.getByLabel('Fecha límite', { exact: true }).fill('2026-09-20')
  await dialog
    .getByText('Inicio, repetición y zona horaria', { exact: true })
    .click()
  await dialog
    .getByRole('combobox', { name: 'Repetir', exact: true })
    .selectOption('custom')
  await dialog
    .getByRole('textbox', { name: /^Regla RRULE/ })
    .fill('FREQ=DAILY;COUNT=2')
  await dialog.getByRole('button', { name: 'Crear tarea', exact: true }).click()
  await page
    .getByRole('checkbox', { name: 'Completar Leer un capítulo', exact: true })
    .click()
  await page.getByRole('button', { name: 'Todas', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Abrir tarea Leer un capítulo' }),
  ).toHaveCount(2)
  await page
    .getByRole('checkbox', { name: 'Reabrir Leer un capítulo', exact: true })
    .click()
  await expect(
    page.getByRole('checkbox', {
      name: 'Completar Leer un capítulo',
      exact: true,
    }),
  ).toHaveCount(2)
  await page
    .getByRole('checkbox', { name: 'Completar Leer un capítulo', exact: true })
    .first()
    .click()
  await expect(
    page.getByRole('button', { name: 'Abrir tarea Leer un capítulo' }),
  ).toHaveCount(2)
})

test('sin red guarda tareas y las conserva al reconectar', async ({
  page,
  context,
}) => {
  await login(page)
  await context.setOffline(true)
  await page.getByLabel('Título de la nueva tarea').fill('Trabajo sin conexión')
  await page.getByLabel('Título de la nueva tarea').press('Enter')
  await expect(
    page.getByRole('button', { name: 'Abrir tarea Trabajo sin conexión' }),
  ).toBeVisible()
  await context.setOffline(false)
  await page.reload()
  await expect(
    page.getByRole('button', { name: 'Abrir tarea Trabajo sin conexión' }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Abrir tarea Trabajo sin conexión' })
    .click()
  await page
    .getByRole('button', { name: 'Eliminar tarea', exact: true })
    .click()
  await page.getByRole('button', { name: 'Confirmar eliminación' }).click()
  await expect(
    page.getByRole('button', { name: 'Abrir tarea Trabajo sin conexión' }),
  ).toHaveCount(0)
  await page.reload()
  await expect(
    page.getByRole('button', { name: 'Abrir tarea Trabajo sin conexión' }),
  ).toHaveCount(0)
})

test('filtra por texto, prioridad y estado; no desborda a 320px', async ({
  page,
}) => {
  await login(page)
  await page.setViewportSize({ width: 320, height: 740 })
  for (const title of ['Comprar monitor', 'Enviar propuesta']) {
    await page.getByLabel('Título de la nueva tarea').fill(title)
    await page.getByLabel('Título de la nueva tarea').press('Enter')
    await expect(
      page.getByRole('button', { name: `Abrir tarea ${title}` }),
    ).toBeVisible()
  }
  await page.getByLabel('Buscar tareas').fill('monitor')
  await expect(
    page.getByRole('button', { name: 'Abrir tarea Enviar propuesta' }),
  ).toHaveCount(0)
  await page
    .getByRole('button', { name: 'Abrir tarea Comprar monitor' })
    .click()
  const dialog = page.getByRole('dialog')
  await dialog
    .getByRole('combobox', { name: 'Prioridad', exact: true })
    .selectOption('urgent')
  await dialog
    .getByRole('combobox', { name: 'Estado', exact: true })
    .selectOption('in_progress')
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true)
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click()
  await page.getByLabel('Buscar tareas').clear()
  await page.getByText('Filtros y orden', { exact: true }).click()
  await page
    .getByRole('combobox', { name: 'Prioridad', exact: true })
    .selectOption('urgent')
  await expect(
    page.getByRole('button', { name: 'Abrir tarea Enviar propuesta' }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Abrir tarea Comprar monitor' }),
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
})

test('una segunda cuenta no ve los datos locales de la primera', async ({
  page,
}) => {
  await login(page)
  await page.getByLabel('Título de la nueva tarea').fill('Tarea privada de Ana')
  await page.getByLabel('Título de la nueva tarea').press('Enter')
  await expect(
    page.getByRole('button', { name: 'Abrir tarea Tarea privada de Ana' }),
  ).toBeVisible()
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Iniciar sesión', exact: true }),
  ).toBeVisible()
  await login(page, '00000000-0000-4000-8000-000000000002')
  await expect(
    page.getByRole('button', { name: 'Abrir tarea Tarea privada de Ana' }),
  ).toHaveCount(0)
})
