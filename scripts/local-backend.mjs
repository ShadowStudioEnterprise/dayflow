import { spawn, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFile, writeFile } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'

const root = fileURLToPath(new URL('../', import.meta.url))
const require = createRequire(import.meta.url)
const cli = resolve(
  dirname(require.resolve('supabase/package.json')),
  'dist/supabase.js',
)
const run = promisify(execFile)

export async function localStatus() {
  try {
    const { stdout } = await run(
      process.execPath,
      [cli, 'status', '-o', 'json'],
      { cwd: root, windowsHide: true, timeout: 30000 },
    )
    return JSON.parse(stdout)
  } catch {
    throw new Error(
      'Supabase local no está disponible. Abre Docker Desktop y ejecuta npm run backend:start.',
    )
  }
}

export function publicLocalConfig(status) {
  const url = status.API_URL
  const key = status.PUBLISHABLE_KEY || status.ANON_KEY
  if (
    url !== 'http://127.0.0.1:54321' ||
    typeof key !== 'string' ||
    key.length < 20
  )
    throw new Error(
      'No se encontró la configuración pública del Supabase local de Dayflow.',
    )
  return { url, key }
}

export async function configureLocal() {
  const { url, key } = publicLocalConfig(await localStatus())
  const path = resolve(root, '.env.local')
  const previous = await readFile(path, 'utf8').catch((error) => {
    if (error.code === 'ENOENT') return ''
    throw error
  })
  const oldUrl = previous.match(
    /^\s*VITE_SUPABASE_URL\s*=\s*["']?([^\s"']+)/m,
  )?.[1]
  if (oldUrl && oldUrl !== url)
    throw new Error(
      '.env.local ya apunta a otro proyecto. Se conserva; configura el entorno local en una copia separada.',
    )
  const kept = previous
    .replace(
      /^\s*(?:VITE_SUPABASE_(?:URL|ANON_KEY)|VITE_LOCAL_MAILBOX_URL)\s*=.*(?:\r?\n|$)/gm,
      '',
    )
    .trimEnd()
  await writeFile(
    path,
    `${kept ? `${kept}\n` : ''}VITE_SUPABASE_URL=${url}\nVITE_SUPABASE_ANON_KEY=${key}\nVITE_LOCAL_MAILBOX_URL=http://127.0.0.1:54324\n`,
    'utf8',
  )
  console.log(
    'Dayflow conectada al backend local. Reinicia Vite o recompila la PWA para usarlo.',
  )
  console.log(
    'Aplicación: http://127.0.0.1:5173 · Studio: http://127.0.0.1:54323 · Correo local: http://127.0.0.1:54324',
  )
}

async function command(args) {
  const log = createWriteStream(resolve(root, '.supabase-local.log'), {
    flags: 'a',
  })
  const child = spawn(process.execPath, [cli, ...args], {
    cwd: root,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout.pipe(log, { end: false })
  child.stderr.pipe(log, { end: false })
  try {
    await new Promise((resolve, reject) => {
      child.once('error', reject)
      child.once('close', (code) =>
        code === 0
          ? resolve()
          : reject(
              new Error(
                'Supabase no pudo completar la operación. Comprueba Docker Desktop y consulta .supabase-local.log.',
              ),
            ),
      )
    })
  } finally {
    log.end()
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const action = process.argv[2]
    if (action === 'start') {
      console.log(
        'Arrancando Supabase local; la primera descarga puede tardar unos minutos. Progreso en .supabase-local.log.',
      )
      await command([
        'start',
        '--exclude',
        'storage-api,imgproxy,edge-runtime,logflare,vector,supavisor',
      ])
      await configureLocal()
    } else if (action === 'configure') await configureLocal()
    else if (action === 'stop') {
      await command(['stop'])
      console.log(
        'Supabase local detenido. Sus datos se conservan para el próximo arranque.',
      )
    } else
      throw new Error(
        'Uso: node scripts/local-backend.mjs start|configure|stop',
      )
  } catch (error) {
    // Child-process errors can contain local admin keys in stdout; never echo them.
    console.error(
      error?.code
        ? 'No se pudo consultar Supabase local. Ejecuta npm run backend:start con Docker activo.'
        : error.message,
    )
    process.exitCode = 1
  }
}
