import { test, expect, type Page } from '@playwright/test'
import { login } from './auth-fixture.ts'

const sizes = [
  { width: 320, height: 568 },
  { width: 360, height: 640 },
  { width: 390, height: 844 },
  { width: 640, height: 360 },
  { width: 768, height: 1024 },
]

async function fits(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
}

async function dialogFits(page: Page) {
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  expect(
    await dialog.evaluate((element) => {
      const box = element.getBoundingClientRect()
      return (
        box.left >= 0 &&
        box.right <= innerWidth + 1 &&
        box.top >= 0 &&
        box.bottom <= innerHeight + 1 &&
        element.scrollWidth <= element.clientWidth + 1
      )
    }),
  ).toBe(true)
}

for (const size of sizes) {
  test(`mobile layout ${size.width}x${size.height}`, async ({ page }, info) => {
    test.setTimeout(90000)
    await page.setViewportSize(size)
    await login(page)
    for (const route of [
      '/',
      '/inbox',
      '/tasks',
      '/notes',
      '/calendar',
      '/reminders',
      '/settings',
      '/profile',
      '/tags',
      '/search',
    ]) {
      await page.goto(route)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await fits(page)
    }
    await page.getByRole('button', { name: 'Abrir navegación' }).click()
    await expect(
      page.getByRole('navigation', { name: 'Navegación principal' }),
    ).toBeVisible()
    await page.screenshot({ path: info.outputPath('navigation.png') })
    await page.getByRole('button', { name: 'Cerrar menú', exact: true }).click()
    if (size.width === 320) {
      await page.getByRole('button', { name: 'Abrir navegación' }).click()
      await page.setViewportSize({ width: 1024, height: 768 })
      await expect(
        page.getByRole('button', { name: 'Cerrar navegación' }),
      ).toHaveCount(0)
      expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
        'hidden',
      )
      await page.setViewportSize(size)
      await page.getByRole('button', { name: 'Abrir navegación' }).click()
      await page
        .locator('#sidebar')
        .getByRole('link', { name: 'Configuración', exact: true })
        .click()
      await expect(
        page.getByRole('navigation', { name: 'Navegación principal' }),
      ).toBeHidden()
    }
    await page.goto('/tasks')
    await page.getByRole('button', { name: 'Nueva tarea', exact: true }).click()
    await dialogFits(page)
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
    await page.goto('/calendar')
    await page
      .getByRole('button', { name: 'Nuevo evento', exact: true })
      .click()
    await dialogFits(page)
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
    await page.goto('/reminders')
    await page
      .getByRole('button', { name: 'Nuevo recordatorio', exact: true })
      .click()
    await dialogFits(page)
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
    await page.goto('/notes')
    await page.getByRole('button', { name: 'Nueva nota', exact: true }).click()
    await page
      .getByRole('textbox', { name: /Título/ })
      .fill('Nota para comprobar la pantalla móvil')
    await page.getByRole('button', { name: 'Crear nota', exact: true }).click()
    const body = page.getByRole('textbox', { name: 'Contenido de la nota' })
    await body.fill(
      Array.from(
        { length: 30 },
        (_, index) =>
          `Línea ${index + 1}: un texto de prueba para desplazar el editor.`,
      ).join('\n'),
    )
    await expect(
      page.getByText('Guardado en este dispositivo', { exact: true }),
    ).toBeVisible()
    await dialogFits(page)
    await page.getByRole('dialog').evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    const saved = page.getByText('Guardado en este dispositivo', {
      exact: true,
    })
    const box = await saved.boundingBox()
    expect(box && box.y >= 0 && box.y + box.height <= size.height).toBeTruthy()
    await page.screenshot({ path: info.outputPath('note-editor.png') })
    await page.getByRole('button', { name: 'Listo', exact: true }).click()
    // A short viewport models the space left above the on-screen keyboard.
    await page.setViewportSize({ width: size.width, height: 300 })
    await page
      .getByRole('button', {
        name: 'Abrir nota: Nota para comprobar la pantalla móvil',
      })
      .click()
    await dialogFits(page)
    await page.getByRole('button', { name: 'Listo', exact: true }).click()
    await page.setViewportSize(size)
    if (size.width === 768) {
      // Model a keyboard that shrinks only VisualViewport, leaving layout height intact.
      await page.evaluate(() => {
        const viewport = Object.assign(new EventTarget(), {
          height: 280,
          offsetTop: 0,
          scale: 1,
        })
        Object.defineProperty(window, 'visualViewport', {
          value: viewport,
          configurable: true,
        })
      })
      await page
        .getByRole('button', {
          name: 'Abrir nota: Nota para comprobar la pantalla móvil',
        })
        .click()
      const box = await page.getByRole('dialog').boundingBox()
      expect(box && box.y >= 0 && box.y + box.height <= 281).toBeTruthy()
      await page.getByRole('button', { name: 'Listo', exact: true }).click()
    }
    await page.goto('/settings')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(
      page.getByRole('heading', {
        name: 'Diagnóstico de notificaciones',
        exact: true,
      }),
    ).toBeVisible()
    await page.screenshot({
      path: info.outputPath('settings.png'),
      fullPage: true,
    })
  })
}
