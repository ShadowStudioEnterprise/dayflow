import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const destination = realpathSync(
  resolve(process.argv[2] ?? resolve(root, 'deployment/web')),
)
const inside = relative(root, destination)
if (!inside || inside.startsWith('..') || isAbsolute(inside))
  throw new Error('La exportación debe estar en un subdirectorio del proyecto.')
const manifest = JSON.parse(
  readFileSync(resolve(destination, '.openai/hosting.json'), 'utf8'),
)
if (!manifest.project_id || manifest.static?.directory !== 'dist')
  throw new Error('Falta la identidad y configuración estática de Sites.')
const dist = resolve(root, 'dist')
for (const name of [
  'index.html',
  'sw.js',
  'push-worker.js',
  'manifest.webmanifest',
  '_headers',
]) {
  if (!existsSync(resolve(dist, name)))
    throw new Error(
      `Falta ${name}. Ejecuta npm run build antes de preparar la publicación.`,
    )
}
const digest = createHash('sha256')
let files = 0
function inspect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort(
    (a, b) => a.name.localeCompare(b.name),
  )) {
    const path = resolve(directory, entry.name)
    if (entry.isSymbolicLink())
      throw new Error('No se publican enlaces simbólicos.')
    if (entry.isDirectory()) inspect(path)
    else {
      if (
        entry.name.startsWith('.env') ||
        /\.(?:pem|key|p12|jks|map)$/.test(entry.name)
      )
        throw new Error('Archivo privado o de desarrollo en dist.')
      digest
        .update(relative(dist, path).replaceAll('\\', '/'))
        .update('\0')
        .update(readFileSync(path))
        .update('\0')
      files++
    }
  }
}
inspect(dist)
mkdirSync(resolve(destination, 'dist'), { recursive: true })
// Keep old hashed assets so a tab open during publication can finish its current version.
cpSync(dist, resolve(destination, 'dist'), { recursive: true, force: true })
writeFileSync(
  resolve(destination, 'release.json'),
  JSON.stringify(
    { application: 'Dayflow', buildSha256: digest.digest('hex'), files },
    null,
    2,
  ) + '\n',
)
console.log(JSON.stringify({ destination, files, prepared: true }))
