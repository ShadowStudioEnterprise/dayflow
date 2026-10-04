import { createECDH, randomBytes } from 'node:crypto'
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  unlinkSync,
} from 'node:fs'
import { execFileSync } from 'node:child_process'
import { parseEnv } from 'node:util'
import assert from 'node:assert/strict'

// CLI output and errors can contain secrets. Report only the failed step.
function cli(label, args) {
  try {
    return execFileSync(
      process.execPath,
      ['node_modules/supabase/dist/supabase.js', ...args],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 180000,
      },
    )
  } catch {
    throw new Error(
      `${label} falló. Revisa tu sesión de Supabase y la configuración del proyecto.`,
    )
  }
}
const env = parseEnv(readFileSync('.env.local', 'utf8'))
const ref = readFileSync('supabase/.temp/project-ref', 'utf8').trim()
assert.match(ref, /^[a-z]{20}$/)
assert.equal(
  env.VITE_SUPABASE_URL,
  `https://${ref}.supabase.co`,
  'El proyecto enlazado no coincide con .env.local',
)
const secretsPath = '.env.web-push.local'
if (!existsSync(secretsPath)) {
  const ecdh = createECDH('prime256v1')
  ecdh.generateKeys()
  writeFileSync(
    secretsPath,
    [
      `DAYFLOW_PUSH_PUBLIC_KEY=${ecdh.getPublicKey().toString('base64url')}`,
      `DAYFLOW_PUSH_PRIVATE_KEY=${ecdh.getPrivateKey().toString('base64url')}`,
      `DAYFLOW_PUSH_CRON_SECRET=${randomBytes(32).toString('base64url')}`,
      `DAYFLOW_PUSH_SUBJECT=${env.VITE_SUPABASE_URL}`,
      '',
    ].join('\n'),
    { flag: 'wx' },
  )
}
const secrets = parseEnv(readFileSync(secretsPath, 'utf8'))
assert.match(secrets.DAYFLOW_PUSH_PUBLIC_KEY, /^[A-Za-z0-9_-]{87}$/)
assert.match(secrets.DAYFLOW_PUSH_CRON_SECRET, /^[A-Za-z0-9_-]{43}$/)
assert.equal(secrets.DAYFLOW_PUSH_SUBJECT, env.VITE_SUPABASE_URL)
console.log('Aplicando migraciones pendientes…')
cli('Migraciones', ['db', 'push', '--linked', '--yes', '--skip-vault'])
console.log('Configurando secretos de Web Push…')
cli('Secretos', [
  'secrets',
  'set',
  '--project-ref',
  ref,
  '--env-file',
  secretsPath,
])
console.log('Desplegando el emisor…')
cli('Edge Function', [
  'functions',
  'deploy',
  'push-dispatch',
  '--project-ref',
  ref,
  '--use-api',
  '--no-verify-jwt',
])
const url = `${env.VITE_SUPABASE_URL}/functions/v1/push-dispatch`
assert.equal(
  (await fetch(url, { method: 'POST' })).status,
  401,
  'El emisor debe rechazar peticiones sin autorización',
)
const probe = await fetch(url, {
  method: 'POST',
  headers: { Authorization: `Bearer ${secrets.DAYFLOW_PUSH_CRON_SECRET}` },
})
assert.equal(probe.status, 200, 'No se activa Cron hasta comprobar el emisor')
console.log('Emisor verificado; configurando comprobación cada minuto…')
const quote = (value) => `'${value.replaceAll("'", "''")}'`
const sql = `
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
do $body$
declare v_id uuid;
begin
  select id into v_id from vault.secrets where name = 'dayflow_push_cron_secret';
  if v_id is null then perform vault.create_secret(${quote(secrets.DAYFLOW_PUSH_CRON_SECRET)}, 'dayflow_push_cron_secret');
  else perform vault.update_secret(v_id, ${quote(secrets.DAYFLOW_PUSH_CRON_SECRET)}); end if;
end $body$;
create or replace function public.dayflow_invoke_push() returns bigint
language plpgsql security definer set search_path = '' as $fn$
declare v_request bigint;
begin
  if exists(select 1 from public.push_subscriptions) then
    select net.http_post(url := ${quote(url)},
      headers := jsonb_build_object('Content-Type','application/json','Authorization',
        'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'dayflow_push_cron_secret')),
      body := '{}'::jsonb, timeout_milliseconds := 55000) into v_request;
  end if;
  return v_request;
end $fn$;
revoke all on function public.dayflow_invoke_push() from public, anon, authenticated;
select cron.schedule('dayflow-web-push', '* * * * *', 'select public.dayflow_invoke_push()');
`
mkdirSync('.toolchains', { recursive: true })
const sqlPath = '.toolchains/push-deploy-secret.sql'
try {
  writeFileSync(sqlPath, sql)
  cli('Cron y Vault', ['db', 'query', '--linked', '--file', sqlPath])
} finally {
  if (existsSync(sqlPath)) unlinkSync(sqlPath)
}
const local = readFileSync('.env.local', 'utf8')
  .replace(/^VITE_WEB_PUSH_PUBLIC_KEY=.*\r?\n?/gm, '')
  .trimEnd()
writeFileSync(
  '.env.local',
  `${local}\nVITE_WEB_PUSH_PUBLIC_KEY=${secrets.DAYFLOW_PUSH_PUBLIC_KEY}\n`,
)
console.log(
  'Web Push desplegado. Clave pública guardada en .env.local. Ejecuta npm run build para actualizar la PWA.',
)
