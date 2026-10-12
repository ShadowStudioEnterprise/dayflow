import { test } from 'node:test'
import assert from 'node:assert/strict'
import { configureSmtp, smtpPayload } from './configure-auth-smtp.mjs'

const env = {
  DAYFLOW_SUPABASE_PROJECT_REF: 'abcdefghijklmnopqrst',
  SUPABASE_ACCESS_TOKEN: 'private-management-token',
  DAYFLOW_SMTP_HOST: 'smtp.provider.test',
  DAYFLOW_SMTP_PORT: '587',
  DAYFLOW_SMTP_USER: 'smtp-user',
  DAYFLOW_SMTP_PASS: 'private-smtp-password',
  DAYFLOW_SMTP_FROM: 'no-reply@auth.dayflow.test',
  DAYFLOW_SMTP_SENDER_NAME: 'Dayflow',
  DAYFLOW_AUTH_EMAILS_PER_HOUR: '30',
}
const appUrl = `https://${env.DAYFLOW_SUPABASE_PROJECT_REF}.supabase.co`

test('rechaza proyecto distinto y credenciales de ejemplo antes de contactar la API', async () => {
  const fetchImpl = () => assert.fail('No debe contactar la API')
  await assert.rejects(
    configureSmtp({
      mode: 'apply',
      env,
      appUrl: 'https://other.supabase.co',
      fetchImpl,
    }),
    /no coincide/,
  )
  await assert.rejects(
    configureSmtp({
      mode: 'apply',
      env: { ...env, DAYFLOW_SMTP_PASS: 'YOUR_SMTP_PASSWORD' },
      appUrl,
      fetchImpl,
    }),
    /DAYFLOW_SMTP_PASS/,
  )
  assert.throws(() => smtpPayload({ ...env, DAYFLOW_SMTP_PORT: '25' }), /TLS/)
  assert.throws(
    () => smtpPayload({ ...env, DAYFLOW_AUTH_EMAILS_PER_HOUR: '0' }),
    /entre 1 y 1000/,
  )
})

test('aplica solo correo y verifica por lectura posterior sin exponer secretos', async () => {
  const calls = []
  const payload = smtpPayload(env)
  const fetchImpl = async (_url, options) => {
    calls.push(options)
    return Response.json(
      calls.length === 1 ? {} : { ...payload, smtp_pass: '' },
    )
  }
  const result = await configureSmtp({ mode: 'apply', env, appUrl, fetchImpl })
  assert.deepEqual(
    calls.map((c) => c.method),
    ['GET', 'PATCH', 'GET'],
  )
  const sent = JSON.parse(calls[1].body)
  assert.equal(sent.mailer_autoconfirm, false)
  assert.equal(sent.smtp_pass, env.DAYFLOW_SMTP_PASS)
  assert.equal(Object.hasOwn(sent, 'site_url'), false)
  assert.equal(Object.hasOwn(sent, 'disable_signup'), false)
  assert.equal(result.externalDeliveryVerified, false)
  assert.equal(JSON.stringify(result).includes('private-'), false)
})

test('check es solo lectura y no precisa la contraseña SMTP', async () => {
  const calls = []
  const fetchImpl = async (_url, options) => {
    calls.push(options.method)
    return Response.json(smtpPayload(env))
  }
  await configureSmtp({
    mode: 'check',
    env: { ...env, DAYFLOW_SMTP_PASS: '' },
    appUrl,
    fetchImpl,
  })
  assert.deepEqual(calls, ['GET'])
})

test('no modifica un proyecto con Send Email Hook activo', async () => {
  let requests = 0
  await assert.rejects(
    configureSmtp({
      mode: 'apply',
      env,
      appUrl,
      fetchImpl: async () => {
        requests++
        return Response.json({ hook_send_email_enabled: true })
      },
    }),
    /Hook activo/,
  )
  assert.equal(requests, 1)
})

test('errores remotos no revelan respuesta ni token y una lectura diferente falla', async () => {
  await assert.rejects(
    configureSmtp({
      mode: 'check',
      env,
      appUrl,
      fetchImpl: async () => new Response('private-token', { status: 403 }),
    }),
    { message: 'Management API: HTTP 403.' },
  )
  await assert.rejects(
    configureSmtp({
      mode: 'check',
      env,
      appUrl,
      fetchImpl: async () => {
        throw new Error('private-token')
      },
    }),
    { message: 'No se pudo contactar con Supabase Management API.' },
  )
  await assert.rejects(
    configureSmtp({
      mode: 'apply',
      env,
      appUrl,
      fetchImpl: async () =>
        Response.json({ ...smtpPayload(env), mailer_autoconfirm: true }),
    }),
    /no está preparado/,
  )
})
