import { build } from 'vite'
import { writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { localStatus, publicLocalConfig } from './local-backend.mjs'
import config from '../capacitor.config.ts'

const root = fileURLToPath(new URL('../', import.meta.url))
const assets = resolve(root, 'android/app/src/local/assets')
const { url, key } = publicLocalConfig(await localStatus())
await build({
  root,
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(url),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(key),
    'import.meta.env.VITE_LOCAL_MAILBOX_URL': JSON.stringify(''),
  },
  build: { outDir: resolve(assets, 'public'), emptyOutDir: true },
})
await mkdir(assets, { recursive: true })
await writeFile(
  resolve(assets, 'capacitor.config.json'),
  JSON.stringify(
    {
      ...config,
      appId: 'com.dayflow.app.local',
      appName: 'Dayflow Local',
      server: { hostname: 'localhost', androidScheme: 'http' },
    },
    null,
    2,
  ),
)
console.log(
  'Recursos Android locales preparados. Compila assembleLocal y conecta adb reverse tcp:54321 tcp:54321.',
)
