import { _android, chromium, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

// Dedicated emulator and isolated application ID only. Never clears app/user data.
const serial = process.env.DAYFLOW_ANDROID_SERIAL || 'emulator-5560'
if (!/^emulator-\d+$/.test(serial))
  throw new Error('La suite sólo admite un emulador dedicado.')
const sdk =
  process.env.ANDROID_HOME || resolve(process.env.LOCALAPPDATA, 'Android/Sdk')
const adb = resolve(sdk, 'platform-tools/adb.exe')
const pkg = 'com.dayflow.app.local'
const run = (...args) =>
  execFileSync(adb, ['-s', serial, ...args], {
    windowsHide: true,
    encoding: 'utf8',
    timeout: 30000,
    stdio: 'pipe',
  })
const shell = (...args) => run('shell', ...args)
const launch = () =>
  shell('am', 'start', '-n', `${pkg}/com.dayflow.app.MainActivity`)
const results = 'test-results-android'
await mkdir(results, { recursive: true })
run('reverse', 'tcp:54321', 'tcp:54321')
launch()
const device = (await _android.devices()).find(
  (item) => item.serial() === serial,
)
if (!device) throw new Error('Emulador no disponible.')
device.setDefaultTimeout(30000)
const page = await (await device.webView({ pkg })).page()
page.setDefaultTimeout(20000)
const errors = []
page.on('pageerror', (error) => errors.push(error.name))
const browser = await chromium.launch()
const web = await browser.newPage()
const password = `Dayflow-${randomUUID()}-9a!`
const email = `dayflow-android-${randomUUID()}@dayflow.test`
const native = (method, options) =>
  page.evaluate(
    async ({ method, options }) =>
      window.Capacitor.Plugins.LocalNotifications[method](options),
    { method, options },
  )
const scheduled = () => native('getAll', { state: 'SCHEDULED' })
async function navigate(path) {
  await page.goto(`http://localhost${path}`)
}
async function sync(target) {
  await target.goto(
    target === page
      ? 'http://localhost/settings'
      : 'http://127.0.0.1:5173/settings',
  )
  await target
    .getByRole('button', { name: 'Sincronizar ahora', exact: true })
    .click()
  await expect(
    target.getByText('Sincronizado · 0 operaciones pendientes'),
  ).toBeVisible({ timeout: 30000 })
}
async function reminder(title, delay) {
  await navigate('/reminders')
  await page
    .getByRole('button', { name: 'Nuevo recordatorio', exact: true })
    .click()
  const at = new Date(Math.ceil((Date.now() + delay) / 60000) * 60000)
  await page.getByLabel('Título', { exact: true }).fill(title)
  await page
    .getByLabel('Fecha', { exact: true })
    .fill(at.toISOString().slice(0, 10))
  await page
    .getByLabel('Hora', { exact: true })
    .fill(at.toISOString().slice(11, 16))
  await page.getByLabel('Zona horaria', { exact: true }).selectOption('UTC')
  await page
    .getByRole('button', { name: 'Guardar recordatorio', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  return at
}
try {
  const savedSession = await page.evaluate(() =>
    Object.keys(localStorage).some((key) => key.endsWith('-auth-token')),
  )
  if (savedSession) {
    await navigate('/settings')
    await page
      .getByRole('button', { name: 'Cerrar sesión', exact: true })
      .click()
    await expect(
      page.getByRole('heading', { name: /Un lugar para tu/ }),
    ).toBeVisible()
  }
  await navigate('/auth/register')
  await page.getByLabel('Tu nombre').fill('Prueba Android')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Revisa tu correo')
  let confirmation
  await expect
    .poll(
      async () => {
        const response = await fetch(
          `http://127.0.0.1:54324/view/latest.html?query=${encodeURIComponent(`to:${email}`)}`,
        )
        if (!response.ok) return false
        confirmation = [...(await response.text()).matchAll(/href="([^"]+)"/g)]
          .map((match) => match[1].replaceAll('&amp;', '&'))
          .find((link) =>
            link.startsWith('http://127.0.0.1:54321/auth/v1/verify?'),
          )
        return Boolean(confirmation)
      },
      { timeout: 20000 },
    )
    .toBe(true)
  const verified = await fetch(confirmation, { redirect: 'manual' })
  const callback = new URL(verified.headers.get('location'))
  expect(
    callback.protocol === 'dayflow:' &&
      callback.hostname === 'auth' &&
      callback.pathname === '/callback' &&
      callback.searchParams.has('code'),
  ).toBe(true)
  // Pass only the verified own-app callback, and never log its code.
  shell(
    'am',
    'start',
    '-a',
    'android.intent.action.VIEW',
    '-d',
    `'${callback.href}'`,
    '-p',
    pkg,
  )
  await expect(
    page.getByRole('heading', { name: /Hoy, con un poco/ }),
  ).toBeVisible({ timeout: 20000 })
  console.log('PASS Android: registro y retorno PKCE real.')

  await web.goto('http://127.0.0.1:5173/auth/login')
  await web.getByLabel('Email').fill(email)
  await web.getByLabel('Contraseña').fill(password)
  await web.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await expect(
    web.getByRole('heading', { name: /Hoy, con un poco/ }),
  ).toBeVisible()
  await web.locator('a[href="/tasks"]:visible').first().click()
  const title = `Desde web ${randomUUID().slice(0, 8)}`
  await web.getByLabel('Título de la nueva tarea').fill(title)
  await web.getByLabel('Título de la nueva tarea').press('Enter')
  await sync(web)
  await sync(page)
  await navigate('/tasks')
  await expect(
    page.getByRole('button', { name: `Abrir tarea ${title}`, exact: true }),
  ).toBeVisible()
  await page
    .getByRole('checkbox', { name: `Completar ${title}`, exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: `Abrir tarea ${title}`, exact: true }),
  ).toHaveCount(0)
  await sync(page)
  await sync(web)
  await web.goto('http://127.0.0.1:5173/tasks?view=all')
  await web.getByRole('button', { name: 'Todas', exact: true }).click()
  await expect(
    web.getByRole('checkbox', { name: `Reabrir ${title}`, exact: true }),
  ).toBeChecked()
  console.log('PASS Android: sincronización bidireccional con navegador.')

  // Grants apply exclusively to this disposable emulator's local test package.
  shell('pm', 'grant', pkg, 'android.permission.POST_NOTIFICATIONS')
  shell('appops', 'set', pkg, 'SCHEDULE_EXACT_ALARM', 'allow')
  await navigate('/settings')
  await page
    .getByRole('button', { name: 'Actualizar programación', exact: true })
    .click()
  expect((await native('checkPermissions')).display).toBe('granted')
  expect((await native('checkExactNotificationSetting')).exact_alarm).toBe(
    'granted',
  )
  const reminderTitle = `Aviso Android ${randomUUID().slice(0, 8)}`
  const at = await reminder(reminderTitle, 25000)
  await expect(
    page.getByText('Programado en este dispositivo', { exact: false }),
  ).toBeVisible()
  await expect
    .poll(async () =>
      (await scheduled()).notifications.some(
        (item) => item.title === reminderTitle,
      ),
    )
    .toBe(true)
  await page.screenshot({ path: `${results}/scheduled.png` })
  shell('input', 'keyevent', '3')
  console.log(
    `Esperando entrega Android en segundo plano (${Math.ceil((at.getTime() - Date.now()) / 1000)} s).`,
  )
  await expect
    .poll(
      () => {
        const notifications = shell('dumpsys', 'notification', '--noredact')
        return (
          notifications.includes(pkg) && notifications.includes(reminderTitle)
        )
      },
      { timeout: 100000, intervals: [1000, 2000] },
    )
    .toBe(true)
  launch()
  await expect
    .poll(async () =>
      (await native('getDeliveredNotifications')).notifications.some(
        (item) => item.title === reminderTitle,
      ),
    )
    .toBe(true)
  console.log(
    'PASS Android: entrega real en segundo plano verificada por el sistema y el plugin.',
  )
  await reminder('Aviso que debe cancelarse al salir', 600000)
  await expect
    .poll(async () => (await scheduled()).notifications.length)
    .toBeGreaterThan(0)
  await navigate('/settings')
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Iniciar sesión', exact: true }),
  ).toBeVisible()
  await expect
    .poll(async () => (await scheduled()).notifications.length)
    .toBe(0)
  await expect
    .poll(
      async () =>
        (await native('getDeliveredNotifications')).notifications.length,
    )
    .toBe(0)
  expect(errors).toEqual([])
  await writeFile(
    `${results}/result.json`,
    JSON.stringify(
      {
        auth: true,
        sync: true,
        backgroundDelivery: true,
        logoutCancellation: true,
        errors,
      },
      null,
      2,
    ),
  )
  console.log(
    'PASS Android: logout cancela pendientes y retira avisos entregados; sin errores JavaScript.',
  )
} catch (error) {
  await page.screenshot({ path: `${results}/failure.png` }).catch(() => {})
  // Do not print callback URLs, auth fields, or command lines containing codes.
  console.error(
    `Fallo en la comprobación Android: ${error.name}. Consulta la captura local.`,
  )
  await writeFile(`${results}/failure.txt`, String(error.message))
  process.exitCode = 1
} finally {
  await browser.close()
  await device.close()
}
