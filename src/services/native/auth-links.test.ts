import { expect, it, vi } from 'vitest'
import {
  authRedirect,
  createAuthLinkHandler,
  parseAuthLink,
} from './auth-links'

it('usa callbacks nativos PKCE y conserva los destinos web existentes', () => {
  expect(authRedirect(true, 'capacitor://localhost')).toBe(
    'dayflow://auth/callback',
  )
  expect(authRedirect(true, 'capacitor://localhost', true)).toBe(
    'dayflow://auth/callback?next=recovery',
  )
  expect(authRedirect(false, 'https://dayflow.test')).toBe(
    'https://dayflow.test/',
  )
  expect(authRedirect(false, 'https://dayflow.test', true)).toBe(
    'https://dayflow.test/auth/update-password',
  )
})
it('sólo admite el callback propio con código y destinos cerrados', () => {
  expect(
    parseAuthLink('dayflow://auth/callback?code=abc&next=recovery'),
  ).toEqual({ code: 'abc', path: '/auth/update-password' })
  for (const url of [
    'https://evil.test/?code=abc',
    'dayflow://other/callback?code=abc',
    'dayflow:///auth/callback?code=abc',
    'dayflow://auth.evil/callback?code=abc',
    'dayflow://auth/callback/../callback?code=abc',
    'dayflow://user@auth/callback?code=abc',
    'bad-url',
  ])
    expect(parseAuthLink(url)).toBeNull()
  for (const query of [
    'code=abc&next=https://evil.test',
    'code=abc&code=def',
    'error=expired',
    'code=abc#access_token=secret',
  ])
    expect(() => parseAuthLink(`dayflow://auth/callback?${query}`)).toThrow()
})
it('interpreta el callback en WebViews que no separan la autoridad de esquemas propios', () => {
  const OriginalURL = URL
  vi.stubGlobal(
    'URL',
    class extends OriginalURL {
      constructor(value: string, base?: string | URL) {
        super(value, base)
        if (value.startsWith('dayflow:')) {
          Object.defineProperty(this, 'hostname', { value: '' })
          Object.defineProperty(this, 'pathname', { value: '//auth/callback' })
        }
      }
    },
  )
  try {
    expect(
      parseAuthLink('dayflow://auth/callback?code=abc&next=recovery'),
    ).toEqual({ code: 'abc', path: '/auth/update-password' })
  } finally {
    vi.unstubAllGlobals()
  }
})
it('canjea una sola vez un enlace recibido al lanzar y reanudar; navega sólo tras éxito', async () => {
  const exchange = vi.fn(async () => {})
  const navigate = vi.fn()
  const error = vi.fn()
  const handle = createAuthLinkHandler({ exchange, navigate, error })
  await Promise.all([
    handle('dayflow://auth/callback?code=abc'),
    handle('dayflow://auth/callback?code=abc'),
  ])
  expect(exchange).toHaveBeenCalledTimes(1)
  expect(navigate).toHaveBeenCalledWith('/')
  expect(exchange.mock.invocationCallOrder[0]).toBeLessThan(
    navigate.mock.invocationCallOrder[0]!,
  )
})
it('permite reintentar un error de red y no expone tokens ni mensajes externos', async () => {
  const exchange = vi
    .fn()
    .mockRejectedValueOnce(new Error('secret'))
    .mockResolvedValueOnce(undefined)
  const navigate = vi.fn()
  const error = vi.fn()
  const handle = createAuthLinkHandler({ exchange, navigate, error })
  await handle('dayflow://auth/callback?code=abc&next=recovery')
  expect(navigate).not.toHaveBeenCalled()
  expect(error.mock.calls[0]?.[0]).not.toContain('secret')
  await handle('dayflow://auth/callback?code=abc&next=recovery')
  expect(navigate).toHaveBeenCalledWith('/auth/update-password')
})
