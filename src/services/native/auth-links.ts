export function authRedirect(
  native: boolean,
  origin: string,
  recovery = false,
) {
  return native
    ? `dayflow://auth/callback${recovery ? '?next=recovery' : ''}`
    : `${origin}${recovery ? '/auth/update-password' : '/'}`
}

export function parseAuthLink(value: string) {
  // WebView 124 parses custom-scheme authorities as part of pathname. Check the
  // exact callback first, then use HTTPS parsing only to read its query safely.
  if (!/^dayflow:\/\/auth\/callback(?:[?#]|$)/.test(value)) return null
  let url: URL
  try {
    url = new URL(`https:${value.slice('dayflow:'.length)}`)
  } catch {
    return null
  }
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'auth' ||
    url.pathname !== '/callback'
  )
    return null
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next')
  if (
    url.username ||
    url.password ||
    url.port ||
    url.hash ||
    url.searchParams.has('error') ||
    !code ||
    code.length > 2048 ||
    url.searchParams.getAll('code').length !== 1 ||
    (next !== null && next !== 'recovery')
  )
    throw new Error(
      'El enlace de acceso no es válido o ha caducado. Solicita uno nuevo desde este dispositivo.',
    )
  return { code, path: next === 'recovery' ? '/auth/update-password' : '/' }
}

export function createAuthLinkHandler(dependencies: {
  exchange(code: string): Promise<void>
  navigate(path: string): void | Promise<void>
  error(message: string): void
}) {
  const handled = new Set<string>()
  return async (value: string) => {
    let code: string | undefined
    try {
      const link = parseAuthLink(value)
      if (!link || handled.has(link.code)) return
      code = link.code
      handled.add(code)
      await dependencies.exchange(code)
      dependencies.error('')
      await dependencies.navigate(link.path)
      if (handled.size > 20) handled.delete(handled.values().next().value!)
    } catch {
      if (code) handled.delete(code)
      dependencies.error(
        'No se pudo abrir el enlace de acceso. Solicita uno nuevo desde esta aplicación y ábrelo en este dispositivo.',
      )
    }
  }
}
