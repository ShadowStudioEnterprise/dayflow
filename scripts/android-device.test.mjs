import test from 'node:test'
import assert from 'node:assert/strict'
import {
  devicesFrom,
  selectDevice,
  missingTunnels,
  apkInfo,
  installAndConnect,
} from './android-device.mjs'

test('no instala en un destino ausente, ambiguo o no autorizado', () => {
  const devices = devicesFrom(
    'List of devices attached\nphone unauthorized usb:1\nemulator-5560 device product:sdk model:Test_Phone\n',
  )
  assert.throws(() => selectDevice([]), /No hay/)
  assert.throws(() => selectDevice(devices), /varios/)
  assert.throws(() => selectDevice(devices, 'phone'), /autorización/)
  assert.throws(() => selectDevice(devices, 'missing'), /no está conectado/)
  assert.equal(selectDevice(devices, 'emulator-5560').model, 'Test_Phone')
})
test('sólo acepta el paquete local y un SDK mínimo verificable', () => {
  assert.deepEqual(
    apkInfo(
      "package: name='com.dayflow.app.local' versionCode='1'\nminSdkVersion:'24'\ntargetSdkVersion:'36'",
    ),
    { id: 'com.dayflow.app.local', minSdk: 24 },
  )
  assert.throws(() =>
    apkInfo("package: name='com.dayflow.app'\nsdkVersion:'24'"),
  )
  assert.throws(() => apkInfo("package: name='com.dayflow.app.local'"))
})
test('preserva túneles existentes y rechaza redirigir puertos ocupados', () => {
  assert.deepEqual(
    missingTunnels('host tcp:54321 tcp:54321\nhost tcp:9999 tcp:8888'),
    ['tcp:54324'],
  )
  assert.throws(
    () => missingTunnels('host tcp:54321 tcp:8000'),
    /otro servicio/,
  )
})
test('instala conservando datos, crea sólo el túnel que falta y abre la variante local', async () => {
  const calls = []
  await installAndConnect(
    async (args) => {
      calls.push(args)
      return args[0] === 'install' ? 'Success' : 'Status: ok\n'
    },
    'local.apk',
    ['tcp:54324'],
    true,
  )
  assert.deepEqual(calls, [
    ['reverse', '--no-rebind', 'tcp:54324', 'tcp:54324'],
    ['install', '-r', 'local.apk'],
    [
      'shell',
      'am',
      'start',
      '-W',
      '-n',
      'com.dayflow.app.local/com.dayflow.app.MainActivity',
    ],
  ])
})
test('ante fallo de instalación retira sólo túneles creados; nunca desinstala ni borra datos', async () => {
  const calls = []
  await assert.rejects(
    installAndConnect(
      async (args) => {
        calls.push(args)
        if (args[0] === 'install') throw new Error('signature mismatch')
        return ''
      },
      'local.apk',
      ['tcp:54324'],
      true,
    ),
    /signature mismatch/,
  )
  assert.deepEqual(calls.at(-1), ['reverse', '--remove', 'tcp:54324'])
  assert.equal(calls.length, 3)
})
test('un conflicto al crear el segundo túnel conserva el del otro proceso', async () => {
  const calls = []
  await assert.rejects(
    installAndConnect(
      async (args) => {
        calls.push(args)
        if (args[1] === '--no-rebind' && args[2] === 'tcp:54324')
          throw new Error('occupied')
        return ''
      },
      'local.apk',
      ['tcp:54321', 'tcp:54324'],
      true,
    ),
    /occupied/,
  )
  assert.deepEqual(calls.at(-1), ['reverse', '--remove', 'tcp:54321'])
  assert.equal(calls.length, 3)
})
test('reconectar no instala y un arranque rechazado no se anuncia como éxito', async () => {
  const calls = []
  await assert.rejects(
    installAndConnect(
      async (args) => {
        calls.push(args)
        return 'Error: activity not found'
      },
      'local.apk',
      [],
      false,
    ),
    /no confirmó el arranque/,
  )
  assert.equal(calls.length, 1)
  assert.equal(calls[0][0], 'shell')
})
