import { createServer } from 'vite'
import { publicLocalConfig, localStatus } from './local-backend.mjs'

const { url, key } = publicLocalConfig(await localStatus())
const server = await createServer({
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(url),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(key),
  },
  server: { host: '127.0.0.1', port: 4181, strictPort: true },
})
await server.listen()
console.log('Dayflow lista para las pruebas contra Supabase local en 4181.')
