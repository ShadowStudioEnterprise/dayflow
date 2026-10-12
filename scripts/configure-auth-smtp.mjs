import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { pathToFileURL } from 'node:url'

function requireValue(env, name) {
  const value = env[name]?.trim()
  if (!value || /YOUR_|CHANGE_ME|example\./i.test(value))
    throw new Error(`Configura ${name} en el archivo privado.`)
  return value
}

export function smtpPayload(env) {
  const port = Number(requireValue(env, 'DAYFLOW_SMTP_PORT'))
  const limit = Number(requireValue(env, 'DAYFLOW_AUTH_EMAILS_PER_HOUR'))
  if (![465, 587, 2525].includes(port))
    throw new Error('Usa un puerto SMTP con TLS: 465, 587 o 2525.')
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000)
    throw new Error('DAYFLOW_AUTH_EMAILS_PER_HOUR debe estar entre 1 y 1000.')
  const email = requireValue(env, 'DAYFLOW_SMTP_FROM')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error('DAYFLOW_SMTP_FROM debe ser una dirección válida.')
  const host = requireValue(env, 'DAYFLOW_SMTP_HOST')
  if (!/^[a-z0-9.-]+$/i.test(host)) throw new Error('Host SMTP inválido.')
  return {
    smtp_host: host,
    smtp_port: port,
    smtp_user: requireValue(env, 'DAYFLOW_SMTP_USER'),
    smtp_pass: requireValue(env, 'DAYFLOW_SMTP_PASS'),
    smtp_admin_email: email,
    smtp_sender_name: requireValue(env, 'DAYFLOW_SMTP_SENDER_NAME'),
    rate_limit_email_sent: limit,
    external_email_enabled: true,
    mailer_autoconfirm: false,
    mailer_secure_email_change_enabled: true,
  }
}

export async function configureSmtp({ mode, env, appUrl, fetchImpl = fetch }) {
  if (!['check', 'apply'].includes(mode)) throw new Error('Usa check o apply.')
  const ref = requireValue(env, 'DAYFLOW_SUPABASE_PROJECT_REF')
  if (!/^[a-z]{20}$/.test(ref) || appUrl !== `https://${ref}.supabase.co`)
    throw new Error('El proyecto SMTP no coincide con .env.local.')
  const token = requireValue(env, 'SUPABASE_ACCESS_TOKEN')
  const endpoint = `https://api.supabase.com/v1/projects/${ref}/config/auth`
  async function request(method, body) {
    let response
    try {
      response = await fetchImpl(endpoint, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(30000),
      })
    } catch {
      throw new Error('No se pudo contactar con Supabase Management API.')
    }
    // Responses may contain credentials: never log response bodies or errors.
    if (!response.ok)
      throw new Error(`Management API: HTTP ${response.status}.`)
    try {
      return await response.json()
    } catch {
      throw new Error('Respuesta de Management API inválida.')
    }
  }
  const payload = mode === 'apply' ? smtpPayload(env) : null
  const before = await request('GET')
  if (before.hook_send_email_enabled)
    throw new Error(
      'Hay un Send Email Hook activo; revisa su configuración antes de usar SMTP.',
    )
  if (payload) await request('PATCH', payload)
  const current = payload ? await request('GET') : before
  const ready = Boolean(
    current.smtp_host &&
    current.smtp_user &&
    current.smtp_admin_email &&
    current.smtp_port &&
    current.external_email_enabled === true &&
    current.mailer_autoconfirm === false &&
    current.rate_limit_email_sent > 0,
  )
  // Supabase may redact the SMTP password on reads; delivery is checked separately.
  const matches =
    !payload ||
    Object.entries(payload).every(
      ([key, value]) =>
        key === 'smtp_pass' || String(current[key]) === String(value),
    )
  if (!ready || !matches)
    throw new Error(
      'SMTP no está preparado o los ajustes aplicados no coinciden.',
    )
  return {
    project: ref,
    smtpConfigured: true,
    confirmationRequired: true,
    emailsPerHour: current.rate_limit_email_sent,
    externalDeliveryVerified: false,
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const env = parseEnv(
      readFileSync(process.argv[3] ?? '.env.smtp.local', 'utf8'),
    )
    const app = parseEnv(readFileSync('.env.local', 'utf8'))
    // Only this specific environment variable can override the private file.
    if (process.env.SUPABASE_ACCESS_TOKEN)
      env.SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN
    console.log(
      JSON.stringify(
        await configureSmtp({
          mode: process.argv[2],
          env,
          appUrl: app.VITE_SUPABASE_URL,
        }),
        null,
        2,
      ),
    )
  } catch (error) {
    // Filesystem errors can contain private paths; only our own errors are shown.
    console.error(
      error.code ? 'No se pudo leer la configuración privada.' : error.message,
    )
    process.exitCode = 1
  }
}
