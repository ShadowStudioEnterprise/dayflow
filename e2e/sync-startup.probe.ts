import { test, expect } from '@playwright/test'
import { login } from './auth-fixture.ts'
import { createSyncBackend } from './sync-fixture.ts'

test('retener SyncRuntime deshabilita la sincronización hasta registrar el motor', async ({
  page,
  context,
}, testInfo) => {
  test.setTimeout(60000)
  const backend = await createSyncBackend()
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  let held!: () => void
  const requested = new Promise<void>((resolve) => {
    held = resolve
  })
  try {
    await backend.connect(context)
    await login(page, undefined, { sync: true })
    backend.setUnavailable(true)
    await page
      .getByLabel('Título de la nueva tarea')
      .fill('Evidencia de arranque')
    await page.getByLabel('Título de la nueva tarea').press('Enter')
    await expect(
      page.getByRole('button', {
        name: 'Abrir tarea Evidencia de arranque',
        exact: true,
      }),
    ).toBeVisible()
    await page.route('**/src/services/sync/SyncRuntime.tsx*', async (route) => {
      held()
      await gate
      await route.continue()
    })
    await page.goto('/settings', { waitUntil: 'domcontentloaded' })
    await requested
    const button = page.getByRole('button', {
      name: 'Sincronizar ahora',
      exact: true,
    })
    await expect(button).toBeDisabled()
    await expect(page.getByText('Preparando sincronización…')).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
    await testInfo.attach('before-runtime-registration', {
      body: Buffer.from(
        (await page.locator('.sync-settings').first().innerText()) +
          '\n' +
          'Acción deshabilitada; sin alerta de arranque.',
      ),
      contentType: 'text/plain',
    })
    const unavailable = page.waitForResponse(
      (response) =>
        response.url().includes('/rpc/dayflow_pull') &&
        response.status() === 503,
    )
    release()
    await unavailable
    await expect(button).toBeEnabled()
    await expect(page.locator('.sync-settings strong').first()).toContainText(
      'Error de sincronización',
    )
    await button.click()
    await expect(page.getByRole('alert')).toContainText(
      'No se pudo contactar con Supabase',
    )
    await expect(
      page.getByRole('button', { name: 'Exportar cambios pendientes' }),
    ).toBeEnabled()
    await testInfo.attach('after-runtime-registration', {
      body: Buffer.from(
        (await page.locator('.sync-settings').first().innerText()) +
          '\n' +
          (await page.getByRole('alert').innerText()),
      ),
      contentType: 'text/plain',
    })
  } finally {
    release()
    await context.unroute('**/src/services/sync/SyncRuntime.tsx*')
    await backend.close()
  }
})
