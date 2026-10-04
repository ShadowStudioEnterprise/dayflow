import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { access, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'
import { localStatus, publicLocalConfig } from './local-backend.mjs'

const run = promisify(execFile)
const root = fileURLToPath(new URL('../', import.meta.url))
const packageId = 'com.dayflow.app.local'
const ports = ['tcp:54321', 'tcp:54324']

export function devicesFrom(output) {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(
      (line) =>
        line && !line.startsWith('List of devices') && !line.startsWith('*'),
    )
    .map((line) => {
      const [serial, state, ...details] = line.split(/\s+/)
      return {
        serial,
        state,
        model:
          details.find((value) => value.startsWith('model:'))?.slice(6) || '',
      }
    })
}

export function selectDevice(devices, serial) {
  if (!devices.length)
    throw new Error(
      'No hay dispositivos. Conecta Android por USB, activa la depuración y acepta la autorización en su pantalla.',
    )
  if (!serial && devices.length !== 1)
    throw new Error(
      'Hay varios dispositivos. Indica el SERIAL al final del comando.',
    )
  const device = serial
    ? devices.find((item) => item.serial === serial)
    : devices[0]
  if (!device) throw new Error('El SERIAL indicado no está conectado.')
  if (device.state !== 'device')
    throw new Error(
      device.state === 'unauthorized'
        ? 'Desbloquea Android y acepta la autorización USB del ordenador.'
        : `Dispositivo no disponible (${device.state}). Revisa el cable y la conexión ADB.`,
    )
  return device
}

export function missingTunnels(output) {
  const existing = new Map(
    output
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => line.trim().split(/\s+/).slice(-2)),
  )
  for (const port of ports) {
    if (existing.has(port) && existing.get(port) !== port)
      throw new Error(
        `El puerto ${port} ya apunta a otro servicio. Se conserva; revisa adb reverse --list.`,
      )
  }
  return ports.filter((port) => !existing.has(port))
}

export function apkInfo(output) {
  const id = output.match(/^package: name='([^']+)'/m)?.[1]
  const minSdk = Number(
    output.match(/^(?:minSdkVersion|sdkVersion):'(\d+)'/m)?.[1],
  )
  if (id !== packageId || !Number.isSafeInteger(minSdk) || minSdk < 1)
    throw new Error(
      'El APK no corresponde a Dayflow Local o no permite comprobar su versión mínima de Android.',
    )
  return { id, minSdk }
}

export async function installAndConnect(adb, apk, missing, install) {
  const created = []
  try {
    for (const port of missing) {
      await adb(['reverse', '--no-rebind', port, port])
      created.push(port)
    }
    if (install) {
      const output = await adb(['install', '-r', apk], 180000)
      if (!/\bSuccess\b/.test(output))
        throw new Error(
          'Android no confirmó la instalación. Se conserva la instalación anterior; no se desinstala automáticamente.',
        )
    }
    const output = await adb([
      'shell',
      'am',
      'start',
      '-W',
      '-n',
      `${packageId}/com.dayflow.app.MainActivity`,
    ])
    if (!/^Status: ok\s*$/m.test(output))
      throw new Error('Android no confirmó el arranque. Revisa el dispositivo.')
  } catch (error) {
    const cleanup = await Promise.allSettled(
      created.map((port) => adb(['reverse', '--remove', port])),
    )
    if (cleanup.some((result) => result.status === 'rejected'))
      throw new Error(
        `${error.message} No se pudieron retirar todos los túneles creados; revisa adb reverse --list.`,
      )
    throw error
  }
}

async function main() {
  const [action = 'devices', serial, ...extra] = process.argv.slice(2)
  if (
    !['devices', 'check', 'install', 'connect'].includes(action) ||
    extra.length ||
    (action === 'devices' && serial)
  )
    throw new Error(
      'Uso: npm run android:device -- devices|check|install|connect [SERIAL]',
    )
  const sdk =
    process.env.ANDROID_HOME ||
    process.env.ANDROID_SDK_ROOT ||
    (process.platform === 'win32'
      ? resolve(process.env.LOCALAPPDATA || '', 'Android/Sdk')
      : resolve(
          homedir(),
          process.platform === 'darwin' ? 'Library/Android/sdk' : 'Android/Sdk',
        ))
  const executable = resolve(
    sdk,
    'platform-tools',
    process.platform === 'win32' ? 'adb.exe' : 'adb',
  )
  await access(executable).catch(() => {
    throw new Error(
      'No se encuentra ADB. Configura ANDROID_HOME con la carpeta del SDK de Android.',
    )
  })
  const command = async (args, timeout = 30000) => {
    try {
      return (
        await run(executable, args, {
          windowsHide: true,
          timeout,
          maxBuffer: 1024 * 1024,
        })
      ).stdout
    } catch {
      throw new Error(
        'ADB no pudo completar la operación. Revisa el dispositivo, la conexión USB y la compatibilidad de la firma instalada.',
      )
    }
  }
  const devices = devicesFrom(await command(['devices', '-l']))
  if (action === 'devices') {
    if (devices.length) console.table(devices)
    else
      console.log(
        'No hay Android conectado. Activa la depuración USB y acepta la autorización del ordenador.',
      )
    return
  }
  const device = selectDevice(devices, serial)
  const adb = (args, timeout) =>
    command(['-s', device.serial, ...args], timeout)
  const api = Number(
    (await adb(['shell', 'getprop', 'ro.build.version.sdk'])).trim(),
  )
  if (!Number.isSafeInteger(api) || api < 1)
    throw new Error('No se pudo consultar la versión Android del dispositivo.')
  const apk = resolve(root, 'android/app/build/outputs/apk/local/app-local.apk')
  await access(apk).catch(() => {
    throw new Error(
      'Falta el APK local. Ejecuta npm run native:android:local y después assembleLocal; consulta docs/android-local.md.',
    )
  })
  const versions = (await readdir(resolve(sdk, 'build-tools'))).sort((a, b) =>
    b.localeCompare(a, undefined, { numeric: true }),
  )
  let aapt
  for (const version of versions) {
    const candidate = resolve(
      sdk,
      'build-tools',
      version,
      process.platform === 'win32' ? 'aapt2.exe' : 'aapt2',
    )
    if (
      await access(candidate).then(
        () => true,
        () => false,
      )
    ) {
      aapt = candidate
      break
    }
  }
  if (!aapt)
    throw new Error(
      'Falta aapt2. Instala Android SDK Build-Tools para comprobar el APK.',
    )
  const metadata = apkInfo(
    (
      await run(aapt, ['dump', 'badging', apk], {
        windowsHide: true,
        timeout: 30000,
      })
    ).stdout,
  )
  if (api < metadata.minSdk)
    throw new Error(
      `El APK necesita API ${metadata.minSdk}; el dispositivo usa API ${api}.`,
    )
  publicLocalConfig(await localStatus())
  const mail = await fetch('http://127.0.0.1:54324/', {
    signal: AbortSignal.timeout(5000),
  }).catch(() => null)
  if (!mail?.ok)
    throw new Error(
      'El buzón local no está disponible. Ejecuta npm run backend:start.',
    )
  const missing = missingTunnels(await adb(['reverse', '--list']))
  if (action === 'connect') {
    const installed = await adb(['shell', 'pm', 'path', packageId])
    if (!installed.trim().startsWith('package:'))
      throw new Error(
        'Dayflow Local no está instalada. Usa primero el comando install.',
      )
  }
  console.log(
    `${device.model || device.serial}: API ${api}. APK Dayflow Local compatible; backend y correo activos.`,
  )
  if (action === 'check') {
    console.log(
      `Diagnóstico correcto. Túneles por crear: ${missing.length}. No se ha instalado ni abierto la app.`,
    )
    return
  }
  await installAndConnect(adb, apk, missing, action === 'install')
  console.log(
    'Dayflow Local abierta. Correo en el navegador de Android: http://127.0.0.1:54324',
  )
  console.log(
    'Los permisos de notificaciones se solicitan desde la app. Repite connect si se pierde el túnel USB.',
  )
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(
      error.code
        ? 'No se pudo consultar el SDK o ejecutar sus herramientas. Revisa ANDROID_HOME y docs/android-local.md.'
        : error.message,
    )
    process.exitCode = 1
  })
}
