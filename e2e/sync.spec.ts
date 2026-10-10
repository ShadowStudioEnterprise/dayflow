import { test, expect, type Page } from '@playwright/test'
import { login } from './auth-fixture.ts'
import { createSyncBackend } from './sync-fixture.ts'
test.setTimeout(60000)

async function sync(page: Page) {
  // After reload, wait for the current settings screen instead of starting a competing load.
  if (new URL(page.url()).pathname !== '/settings') await page.goto('/settings')
  await page
    .getByRole('button', { name: 'Sincronizar ahora', exact: true })
    .click()
  await expect(page.locator('.sync-settings strong').first()).toHaveText(
    'Sin pendientes',
  )
  await expect(
    page.getByText('0 operaciones pendientes', { exact: true }),
  ).toBeVisible()
  await expect(page.locator('.sync-summary time')).toBeVisible()
  await expect(
    page.getByText('Sincronización completada.', { exact: true }),
  ).toBeVisible()
}
test('dos dispositivos convergen, recuperan cambios offline y transmiten borrados', async ({
  page,
  context,
  browser,
}) => {
  const backend = await createSyncBackend()
  const other = await browser.newContext({ baseURL: 'http://127.0.0.1:4175' })
  try {
    await backend.connect(context)
    await backend.connect(other)
    await login(page, undefined, { sync: true })
    const second = await other.newPage()
    await login(second, undefined, { sync: true })
    await sync(page)
    await sync(second)
    await page.goto('/tasks')
    await page
      .getByLabel('Título de la nueva tarea')
      .fill('Compartida entre dispositivos')
    await page.getByLabel('Título de la nueva tarea').press('Enter')
    await sync(page)
    await sync(second)
    await second.goto('/tasks')
    await expect(
      second.getByRole('button', {
        name: 'Abrir tarea Compartida entre dispositivos',
        exact: true,
      }),
    ).toBeVisible()
    await second.locator('.sync-indicator').click()
    await expect(second.locator('.sync-summary time')).toBeVisible()
    await other.setOffline(true)
    await expect(second.locator('.sync-settings strong').first()).toHaveText(
      'Sin conexión',
    )
    await second.goBack()
    await second
      .getByRole('checkbox', {
        name: 'Completar Compartida entre dispositivos',
        exact: true,
      })
      .click()
    await second.locator('.sync-indicator').click()
    await expect(
      second.getByText('Guardado local', { exact: true }),
    ).toBeVisible()
    await expect(
      second.locator('.sync-summary > div').nth(1).locator('dd'),
    ).toContainText(/[1-9]\d* operaci/)
    await expect(second.locator('.sync-summary time')).toBeVisible()
    await expect(
      second.getByText(/no garantiza el estado actual del servidor/),
    ).toBeVisible()
    await expect(second.getByText('Sincronizado', { exact: true })).toHaveCount(
      0,
    )
    await other.setOffline(false)
    await sync(second)
    await sync(page)
    await page.goto('/tasks?view=all')
    await page.getByRole('button', { name: 'Todas', exact: true }).click()
    await page
      .getByRole('button', {
        name: 'Abrir tarea Compartida entre dispositivos',
        exact: true,
      })
      .click()
    await page
      .getByRole('button', { name: 'Eliminar tarea', exact: true })
      .click()
    await page.getByRole('button', { name: 'Confirmar eliminación' }).click()
    await sync(page)
    await sync(second)
    await second.goto('/tasks?view=all')
    await second.getByRole('button', { name: 'Todas', exact: true }).click()
    await expect(
      second.getByRole('button', {
        name: 'Abrir tarea Compartida entre dispositivos',
        exact: true,
      }),
    ).toHaveCount(0)
    await second.goto('/settings')
    await expect(second.locator('.sync-devices li')).toHaveCount(2)
  } finally {
    await other.close()
    await backend.close()
  }
})
test('recupera una respuesta perdida y conserva las operaciones durante un fallo del servidor', async ({
  page,
  context,
}) => {
  const backend = await createSyncBackend()
  try {
    await backend.connect(context)
    await login(page, undefined, { sync: true })
    await sync(page)
    const responseLost = backend.loseResponse()
    await page.goto('/tasks')
    await page.getByLabel('Título de la nueva tarea').fill('Una sola copia')
    await page.getByLabel('Título de la nueva tarea').press('Enter')
    await responseLost
    await expect(page.locator('.sync-indicator')).toContainText(
      'Error de sincronización',
    )
    await sync(page)
    await page.reload()
    await sync(page)
    await page.goto('/tasks')
    await expect(
      page.getByRole('button', {
        name: 'Abrir tarea Una sola copia',
        exact: true,
      }),
    ).toHaveCount(1)
    backend.setUnavailable(true)
    await page
      .getByLabel('Título de la nueva tarea')
      .fill('Guardada durante el fallo')
    await page.getByLabel('Título de la nueva tarea').press('Enter')
    await page.goto('/settings')
    await page
      .getByRole('button', { name: 'Sincronizar ahora', exact: true })
      .click()
    await expect(
      page
        .getByRole('alert')
        .filter({ hasText: /No se pudo contactar con Supabase/ }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Exportar cambios pendientes' }),
    ).toBeEnabled()
    backend.setUnavailable(false)
    await sync(page)
  } finally {
    await backend.close()
  }
})
test('dos ediciones offline conservan la perdedora como copia recuperable', async ({
  page,
  context,
  browser,
}) => {
  const backend = await createSyncBackend()
  const other = await browser.newContext({ baseURL: 'http://127.0.0.1:4175' })
  try {
    await backend.connect(context)
    await backend.connect(other)
    await login(page, undefined, { sync: true })
    await page.getByLabel('Título de la nueva tarea').fill('Borrador inicial')
    await page.getByLabel('Título de la nueva tarea').press('Enter')
    await sync(page)
    const second = await other.newPage()
    await login(second, undefined, { sync: true })
    await sync(second)
    await second.goto('/tasks')
    await expect(
      second.getByRole('button', {
        name: 'Abrir tarea Borrador inicial',
        exact: true,
      }),
    ).toBeVisible()
    await other.setOffline(true)
    await second
      .getByRole('button', {
        name: 'Abrir tarea Borrador inicial',
        exact: true,
      })
      .click()
    await second
      .getByLabel('Título', { exact: true })
      .fill('Versión antigua conservada')
    await second
      .getByRole('button', { name: 'Guardar cambios', exact: true })
      .click()
    await page.goto('/tasks')
    await page
      .getByRole('button', {
        name: 'Abrir tarea Borrador inicial',
        exact: true,
      })
      .click()
    await page
      .getByLabel('Título', { exact: true })
      .fill('Versión remota más reciente')
    await page
      .getByRole('button', { name: 'Guardar cambios', exact: true })
      .click()
    await sync(page)
    await other.setOffline(false)
    await sync(second)
    await expect(
      second
        .locator('.sync-conflict')
        .getByRole('heading', { name: 'Versión antigua conservada' }),
    ).toBeVisible()
    await second
      .getByRole('button', { name: 'Restaurar como copia', exact: true })
      .click()
    await sync(second)
    await second.goto('/tasks')
    await expect(
      second.getByRole('button', {
        name: 'Abrir tarea Versión antigua conservada (copia)',
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      second.getByRole('button', {
        name: 'Abrir tarea Versión remota más reciente',
        exact: true,
      }),
    ).toBeVisible()
  } finally {
    await other.close()
    await backend.close()
  }
})
