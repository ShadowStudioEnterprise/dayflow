import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { build } from 'vite'

// Separate production builds and backend fixtures; never overwrite dist or native assets.
process.env.VITE_SUPABASE_URL = 'https://dayflow-e2e.supabase.co'
// A public test VAPID key: these fixtures never send to a real push provider.
process.env.VITE_WEB_PUSH_PUBLIC_KEY =
  'BKxX8XSyZ1mkwbXJhxLSK3O-m-lcUiw6MBpxry9FFnTMYRjNnTw6OTkuVaLA0qO60Wbfzwi1sBNrx-eSAUCIbVo'
process.env.VITE_SUPABASE_ANON_KEY = 'public-anon-test-key-not-a-secret'
for (const version of ['a', 'b']) {
  await build({
    build: { outDir: `dist-pwa-test/${version}` },
    plugins: [
      {
        name: 'test-build-marker',
        transformIndexHtml: () => [
          {
            tag: 'meta',
            attrs: { name: 'test-build', content: version },
            injectTo: 'head',
          },
        ],
      },
    ],
  })
}
let version = 'a'
const mime = {
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
}
createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1:4177').pathname
  if (
    request.method === 'POST' &&
    ['/__test/reset', '/__test/update'].includes(pathname)
  ) {
    version = pathname.endsWith('update') ? 'b' : 'a'
    response.writeHead(204).end()
    return
  }
  const root = resolve('dist-pwa-test', version)
  const path = resolve(root, `.${decodeURIComponent(pathname)}`)
  if (path !== root && !path.startsWith(root + sep)) {
    response.writeHead(403).end()
    return
  }
  try {
    const data = await readFile(path)
    response
      .writeHead(200, {
        'Content-Type': mime[extname(path)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      })
      .end(data)
  } catch {
    if (extname(path) || pathname.startsWith('/__test/')) {
      response.writeHead(404).end()
      return
    }
    response
      .writeHead(200, {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-store',
      })
      .end(await readFile(resolve(root, 'index.html')))
  }
}).listen(4177, '127.0.0.1', () =>
  console.log('PWA production fixtures ready on 4177'),
)
