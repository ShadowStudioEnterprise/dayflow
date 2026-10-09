import { execFileSync } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { createClient } from '@supabase/supabase-js'

// Explicit remote integration test. Secrets remain in memory; output contains no
// JWTs, passwords, application content, emails or user IDs. Only run on the linked
// project for which temporary accounts and fixture mutations are authorized.
const phase = process.argv[2]
if (!['before', 'after'].includes(phase)) throw new Error('Use before or after')
const env = parseEnv(readFileSync('.env.local', 'utf8'))
const ref = readFileSync('supabase/.temp/project-ref', 'utf8').trim()
const url = `https://${ref}.supabase.co`
if (env.VITE_SUPABASE_URL !== url) throw new Error('Linked project mismatch')
let keys
try {
  keys = JSON.parse(
    execFileSync(
      process.execPath,
      [
        'node_modules/supabase/dist/supabase.js',
        'projects',
        'api-keys',
        '--project-ref',
        ref,
        '--reveal',
        '-o',
        'json',
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 },
    ),
  )
} catch {
  throw new Error('Cannot obtain administrative API credentials')
}
const serviceKey = keys.find((k) => k.name === 'service_role')?.api_key
if (!serviceKey) throw new Error('Missing service credential')
const publicKey = env.VITE_SUPABASE_ANON_KEY
const options = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
}
const admin = createClient(url, serviceKey, options)
const run = randomUUID()
const report = {
  project_ref: ref,
  phase,
  run,
  started_at: new Date().toISOString(),
  auth: 'Admin-created, confirmed temporary accounts; password sign-in; real JWTs',
  tests: [],
  cleanup: [],
}
const users = []
mkdirSync('.toolchains', { recursive: true })
const ledger = `.toolchains/security-audit-${run}.json`
const tables = [
  'tasks',
  'notes',
  'events',
  'reminders',
  'subtasks',
  'tags',
  'inbox',
  'devices',
  'entity_links',
  'note_tags',
  'task_tags',
  'event_tags',
  'profiles',
  'sync_heads',
  'sync_changes',
  'sync_operations',
  'sync_records',
  'push_subscriptions',
  'push_deliveries',
]
const synced = tables.slice(0, 12)
const entityName = (table) =>
  ({
    entity_links: 'links',
    note_tags: 'noteTags',
    task_tags: 'taskTags',
    event_tags: 'eventTags',
  })[table] ?? table
function requireCondition(condition, label) {
  if (!condition) throw new Error(label)
}
function record(label, condition, response) {
  report.tests.push({
    test: label,
    pass: Boolean(condition),
    ...(response
      ? {
          http_status: response.status,
          error_code: response.data?.code ?? null,
        }
      : {}),
  })
  requireCondition(condition, `Failed test: ${label}`)
}
async function request(actor, path, method = 'GET', body, extraHeaders = {}) {
  const isService = actor === 'service'
  const token = isService
    ? serviceKey
    : typeof actor === 'string'
      ? actor
      : actor?.token
  const headers = {
    apikey: isService ? serviceKey : publicKey,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
    ...extraHeaders,
  }
  if (token) headers.Authorization = `Bearer ${token}`
  let response
  try {
    response = await fetch(`${url}/rest/v1/${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(20000),
    })
  } catch {
    throw new Error('HTTP request failed or timed out')
  }
  let data
  try {
    data = await response.json()
  } catch {
    data = null
  }
  return { status: response.status, data }
}
const rpc = (actor, name, body = {}) =>
  request(actor, `rpc/${name}`, 'POST', body)
async function graphql(actor, query) {
  const service = actor === 'service'
  const headers = {
    apikey: service ? serviceKey : publicKey,
    'Content-Type': 'application/json',
  }
  if (actor)
    headers.Authorization = `Bearer ${service ? serviceKey : actor.token}`
  let response
  try {
    response = await fetch(`${url}/graphql/v1`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(20000),
    })
  } catch {
    throw new Error('HTTP request failed or timed out')
  }
  return { status: response.status, data: await response.json() }
}
const graphqlDisabled = (r) =>
  r.status === 200 &&
  !r.data.data &&
  r.data.errors?.some(
    (e) => e.message === 'pg_graphql extension is not enabled.',
  )
function operation(
  row,
  entity = 'tasks',
  id = randomUUID(),
  action = 'create',
) {
  return { id, entity, entityId: row.id, action, row }
}
async function apply(actor, op, label) {
  const r = await rpc(actor, 'dayflow_apply_operation', { p_operation: op })
  record(label, r.status === 200 && r.data?.accepted === true, r)
  return r.data
}
async function rejected(actor, name, args, label, codes) {
  const r = await rpc(actor, name, args)
  record(
    label,
    r.status >= 400 && r.status < 500 && codes.includes(r.data?.code),
    r,
  )
}
function fixtureRows(user) {
  const now = new Date().toISOString()
  const base = (id) => ({
    id,
    user_id: user.id,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version: 1,
  })
  const ids = Object.fromEntries(synced.map((t) => [t, randomUUID()]))
  return {
    tasks: {
      ...base(ids.tasks),
      title: 'Security audit task',
      description: null,
      status: 'pending',
      priority: 'none',
      start_at: null,
      due_at: null,
      due_date: null,
      recurrence_rule: null,
      completed_at: null,
      timezone: 'Europe/Madrid',
      recurrence_anchor: null,
      next_occurrence_id: null,
    },
    notes: {
      ...base(ids.notes),
      title: 'Security audit note',
      content: { type: 'doc', content: [] },
      plain_text_content: '',
      color: 'default',
      is_pinned: false,
      is_archived: false,
    },
    events: {
      ...base(ids.events),
      title: 'Security audit event',
      description: null,
      start_at: null,
      end_at: null,
      start_date: '2026-10-10',
      end_date: '2026-10-11',
      timezone: 'Europe/Madrid',
      all_day: true,
      location: null,
      recurrence_rule: null,
    },
    reminders: {
      ...base(ids.reminders),
      title: 'Security audit reminder',
      description: null,
      task_id: ids.tasks,
      event_id: null,
      note_id: null,
      trigger_at: '2099-01-01T00:00:00Z',
      recurrence_rule: null,
      notification_enabled: true,
      timezone: 'Europe/Madrid',
    },
    subtasks: {
      ...base(ids.subtasks),
      title: 'Security audit subtask',
      task_id: ids.tasks,
      position: 0,
      is_completed: false,
    },
    tags: { ...base(ids.tags), name: 'Security audit tag', color: 'default' },
    inbox: { ...base(ids.inbox), title: 'Security audit inbox' },
    devices: {
      ...base(ids.devices),
      name: 'Security audit device',
      platform: 'web',
      push_token: null,
      last_seen_at: now,
    },
    entity_links: {
      ...base(ids.entity_links),
      source_type: 'note',
      source_id: ids.notes,
      target_type: 'task',
      target_id: ids.tasks,
    },
    note_tags: {
      ...base(ids.note_tags),
      entity_id: ids.notes,
      tag_id: ids.tags,
    },
    task_tags: {
      ...base(ids.task_tags),
      entity_id: ids.tasks,
      tag_id: ids.tags,
    },
    event_tags: {
      ...base(ids.event_tags),
      entity_id: ids.events,
      tag_id: ids.tags,
    },
  }
}
async function pullAll(actor, label) {
  let cursor = '0'
  let pages = 0
  const changes = []
  for (; pages < 100; pages++) {
    const r = await rpc(actor, 'dayflow_pull', { p_after: cursor, p_limit: 3 })
    requireCondition(
      r.status === 200 && Array.isArray(r.data?.changes),
      `${label}: page failed`,
    )
    requireCondition(
      r.data.changes.every((c) => c.row?.user_id === actor.id),
      `${label}: foreign owner`,
    )
    changes.push(...r.data.changes)
    const next = r.data.cursor
    if (r.data.changes.length === 0) break
    requireCondition(
      BigInt(next) > BigInt(cursor),
      `${label}: cursor did not advance`,
    )
    cursor = next
  }
  record(
    label,
    pages > 0 &&
      pages < 100 &&
      changes.length === (label.includes('final') ? 14 : 12),
  )
  return changes
}
let failed = false
try {
  for (const label of ['A', 'B']) {
    const email = `dayflow-security-${run}-${label.toLowerCase()}@example.com`
    const password = randomBytes(24).toString('base64url')
    const made = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name: 'Temporary security audit',
        dayflow_security_audit: run,
      },
    })
    requireCondition(
      !made.error && made.data.user?.id,
      `Temporary account ${label} creation failed`,
    )
    const user = { id: made.data.user.id, label }
    users.push(user)
    writeFileSync(
      ledger,
      JSON.stringify({
        run,
        project_ref: ref,
        users: users.map((u) => ({ id: u.id, label: u.label })),
      }),
    )
    const client = createClient(url, publicKey, options)
    const signed = await client.auth.signInWithPassword({ email, password })
    requireCondition(
      !signed.error && signed.data.session?.access_token,
      `Account ${label} sign-in failed`,
    )
    user.token = signed.data.session.access_token
    user.client = client
    const claims = JSON.parse(
      Buffer.from(user.token.split('.')[1], 'base64url').toString('utf8'),
    )
    record(
      `jwt_${label}_identity`,
      claims.sub === user.id && claims.role === 'authenticated',
    )
    const authenticated = await client.auth.getUser(user.token)
    record(
      `jwt_${label}_server_validation`,
      !authenticated.error && authenticated.data.user?.id === user.id,
    )
    user.rows = fixtureRows(user)
    user.ops = {}
    user.receipts = {}
    for (const table of synced) {
      const op = operation(user.rows[table], entityName(table))
      user.ops[table] = op
      user.receipts[table] = await apply(
        user,
        op,
        `${label}_create_${table}_via_rpc`,
      )
    }
    const subscription = await rpc(user, 'dayflow_register_push', {
      p_endpoint: `https://fcm.googleapis.com/fcm/send/dayflow-security-${run}-${label}`,
      p_p256dh: 'A'.repeat(87),
      p_auth: 'B'.repeat(22),
    })
    record(
      `${label}_register_push`,
      subscription.status === 200 && typeof subscription.data === 'string',
      subscription,
    )
    user.subscription = subscription.data
    // The reminder is in 2099, so Cron never selects it. A service claim exercises
    // the reservation and produces an isolated delivery row without sending Push.
    const clock = await rpc(user, 'dayflow_pull', { p_after: '0', p_limit: 1 })
    requireCondition(
      clock.status === 200 && clock.data?.serverTime,
      'Fixture clock unavailable',
    )
    const claim = await rpc('service', 'dayflow_claim_push', {
      p_subscription: user.subscription,
      p_reminder: user.rows.reminders.id,
      p_version: 1,
      p_at: clock.data.serverTime,
    })
    record(
      `service_${label}_valid_claim`,
      claim.status === 200 && typeof claim.data === 'string',
      claim,
    )
    console.log(
      `${phase}: temporary account ${label}, legitimate RPC writes verified`,
    )
  }
  for (const actor of users) {
    const other = users.find((u) => u !== actor)
    const gql = await graphql(
      actor,
      `query {
      own: tasksCollection(filter:{id:{eq:"${actor.rows.tasks.id}"}}) { edges { node { id } } }
      foreign: tasksCollection(filter:{id:{eq:"${other.rows.tasks.id}"}}) { edges { node { id } } }
    }`,
    )
    if (graphqlDisabled(gql)) {
      report.graphql = {
        enabled: false,
        reason: 'pg_graphql extension is not enabled',
      }
      record(`${actor.label}_graphql_disabled`, true, gql)
    } else {
      record(
        `${actor.label}_graphql_own_task`,
        gql.status === 200 &&
          !gql.data.errors &&
          gql.data.data?.own?.edges?.length === 1,
        gql,
      )
      record(
        `${actor.label}_graphql_foreign_task_hidden`,
        gql.status === 200 &&
          !gql.data.errors &&
          gql.data.data?.foreign?.edges?.length === 0,
        gql,
      )
      const mutations = await graphql(
        actor,
        'query { __schema { mutationType { fields { name } } } }',
      )
      const names =
        mutations.data.data?.__schema?.mutationType?.fields?.map(
          (f) => f.name,
        ) ?? []
      record(
        `${actor.label}_graphql_task_mutations_not_exposed`,
        mutations.status === 200 &&
          !mutations.data.errors &&
          !names.some((name) =>
            /^(insertInto|update|delete)tasksCollection$/i.test(name),
          ),
        mutations,
      )
    }
    for (const table of tables) {
      if (table === 'push_deliveries') {
        const r = await request(
          actor,
          `${table}?select=*&subscription_id=eq.${actor.subscription}`,
        )
        record(
          `${actor.label}_${table}_denied`,
          [401, 403].includes(r.status) && r.data?.code === '42501',
          r,
        )
        const service = await request(
          'service',
          `${table}?select=*&subscription_id=eq.${actor.subscription}`,
        )
        record(
          `service_${actor.label}_${table}_authorized`,
          service.status === 200 &&
            Array.isArray(service.data) &&
            service.data.length === 1,
          service,
        )
        continue
      }
      const own = await request(
        actor,
        `${table}?select=*&user_id=eq.${actor.id}`,
      )
      const foreign = await request(
        actor,
        `${table}?select=*&user_id=eq.${other.id}`,
      )
      const hidden = ['sync_records', 'push_deliveries'].includes(table)
      if (hidden) {
        record(
          `${actor.label}_${table}_denied`,
          [401, 403].includes(own.status) &&
            [401, 403].includes(foreign.status),
          own,
        )
      } else {
        record(
          `${actor.label}_own_${table}`,
          own.status === 200 &&
            own.data.length > 0 &&
            own.data.every((r) => r.user_id === actor.id),
          own,
        )
        record(
          `${actor.label}_foreign_${table}_hidden`,
          foreign.status === 200 && foreign.data.length === 0,
          foreign,
        )
      }
      const service = await request(
        'service',
        `${table}?select=*&user_id=in.(${actor.id},${other.id})`,
      )
      record(
        `service_${actor.label}_${table}_both_owners`,
        service.status === 200 &&
          service.data.some((r) => r.user_id === actor.id) &&
          service.data.some((r) => r.user_id === other.id),
        service,
      )
    }
    await pullAll(actor, `${actor.label}_paginated_pull_isolated`)
    for (const action of ['create', 'update', 'delete']) {
      const row = {
        ...other.rows.tasks,
        version: 2,
        updated_at: new Date().toISOString(),
        ...(action === 'delete'
          ? { deleted_at: new Date().toISOString() }
          : {}),
      }
      await rejected(
        actor,
        'dayflow_apply_operation',
        { p_operation: operation(row, 'tasks', randomUUID(), action) },
        `${actor.label}_rpc_${action}_foreign_owner_denied`,
        ['42501'],
      )
    }
    const spoofed = { ...actor.rows.tasks, id: other.rows.tasks.id }
    await rejected(
      actor,
      'dayflow_apply_operation',
      { p_operation: operation(spoofed) },
      `${actor.label}_foreign_id_spoof_denied`,
      ['23505'],
    )
    for (const table of synced) {
      const body = actor.rows[table]
      for (const method of ['POST', 'PATCH', 'DELETE']) {
        const query = method === 'POST' ? '' : `?id=eq.${other.rows[table].id}`
        const r = await request(
          actor,
          `${table}${query}`,
          method,
          method === 'DELETE' ? undefined : body,
        )
        record(
          `${actor.label}_direct_${method}_${table}_denied`,
          [401, 403].includes(r.status) && r.data?.code === '42501',
          r,
        )
      }
    }
    for (const table of [
      'sync_operations',
      'sync_changes',
      'sync_heads',
      'sync_records',
      'push_deliveries',
    ]) {
      const filter =
        table === 'push_deliveries'
          ? `subscription_id=eq.${other.subscription}`
          : `user_id=eq.${other.id}`
      const body = {
        sync_operations: { retries: 99 },
        sync_changes: { entity: 'tasks' },
        sync_heads: { last_seq: 99 },
        sync_records: { entity: 'tasks' },
        push_deliveries: { attempts: 99 },
      }[table]
      for (const method of ['POST', 'PATCH', 'DELETE']) {
        const r = await request(
          actor,
          `${table}${method === 'POST' ? '' : `?${filter}`}`,
          method,
          method === 'DELETE' ? undefined : body,
        )
        record(
          `${actor.label}_direct_${method}_${table}_denied`,
          [401, 403].includes(r.status) && r.data?.code === '42501',
          r,
        )
      }
    }
    const wrongOwner = await request(
      actor,
      `profiles?user_id=eq.${actor.id}`,
      'PATCH',
      { user_id: other.id },
    )
    record(
      `${actor.label}_profile_owner_change_denied`,
      wrongOwner.status >= 400 && wrongOwner.status < 500,
      wrongOwner,
    )
    const foreignProfile = await request(
      actor,
      `profiles?user_id=eq.${other.id}`,
      'PATCH',
      { name: 'Unauthorized change' },
    )
    record(
      `${actor.label}_foreign_profile_update_empty`,
      foreignProfile.status === 200 && foreignProfile.data.length === 0,
      foreignProfile,
    )
    const ownProfile = await request(
      actor,
      `profiles?user_id=eq.${actor.id}`,
      'PATCH',
      { name: `Audit ${actor.label}` },
    )
    record(
      `${actor.label}_own_profile_update`,
      ownProfile.status === 200 && ownProfile.data.length === 1,
      ownProfile,
    )
    const foreignInsert = await request(actor, 'profiles', 'POST', {
      user_id: other.id,
      name: 'Unauthorized profile',
    })
    record(
      `${actor.label}_foreign_profile_insert_denied`,
      foreignInsert.status === 403 && foreignInsert.data?.code === '42501',
      foreignInsert,
    )
    const profileDelete = await request(
      actor,
      `profiles?user_id=eq.${other.id}`,
      'DELETE',
    )
    record(
      `${actor.label}_profile_delete_denied`,
      profileDelete.status === 403 && profileDelete.data?.code === '42501',
      profileDelete,
    )
    for (const method of ['POST', 'PATCH']) {
      const r = await request(
        actor,
        `push_subscriptions${method === 'PATCH' ? `?id=eq.${other.subscription}` : ''}`,
        method,
        { p256dh: 'C'.repeat(87) },
      )
      record(
        `${actor.label}_direct_${method}_push_subscriptions_denied`,
        r.status === 403 && r.data?.code === '42501',
        r,
      )
    }
    const crossRelations = {
      subtasks: { task_id: other.rows.tasks.id },
      reminders: { task_id: other.rows.tasks.id },
      tasks: { next_occurrence_id: other.rows.tasks.id },
      note_tags: { tag_id: other.rows.tags.id },
      task_tags: { entity_id: other.rows.tasks.id },
      event_tags: { entity_id: other.rows.events.id },
      entity_links: { target_id: other.rows.tasks.id },
    }
    for (const [table, fields] of Object.entries(crossRelations)) {
      const row = { ...actor.rows[table], id: randomUUID(), ...fields }
      await rejected(
        actor,
        'dayflow_apply_operation',
        { p_operation: operation(row, entityName(table)) },
        `${actor.label}_cross_reference_${table}_denied`,
        table === 'entity_links' ? ['P0001'] : ['23503'],
      )
    }
    for (const entity of [
      'profiles',
      'sync_changes',
      'push_subscriptions',
      'tasks;drop table public.tasks',
    ])
      await rejected(
        actor,
        'dayflow_apply_operation',
        { p_operation: operation(actor.rows.tasks, entity) },
        `${actor.label}_unallowed_entity_${entity.split(';')[0]}_denied`,
        ['22023'],
      )
    await rejected(
      actor,
      'dayflow_apply_operation',
      {
        p_operation: operation({
          ...actor.rows.tasks,
          id: randomUUID(),
          rogue: true,
        }),
      },
      `${actor.label}_unknown_field_denied`,
      ['22023'],
    )
    const receipt = await rpc(actor, 'dayflow_apply_operation', {
      p_operation: actor.ops.tasks,
    })
    record(
      `${actor.label}_exact_replay_idempotent`,
      receipt.status === 200 &&
        JSON.stringify(receipt.data) === JSON.stringify(actor.receipts.tasks),
      receipt,
    )
    await rejected(
      actor,
      'dayflow_apply_operation',
      {
        p_operation: {
          ...actor.ops.tasks,
          row: { ...actor.rows.tasks, title: 'Altered replay' },
        },
      },
      `${actor.label}_altered_replay_denied`,
      ['22023'],
    )
    await rejected(
      actor,
      'dayflow_apply_operation',
      { p_operation: operation(actor.rows.tasks, 'tasks', other.ops.tasks.id) },
      `${actor.label}_foreign_operation_id_denied`,
      ['22023'],
    )
    await rejected(
      actor,
      'dayflow_apply_operation',
      {
        p_operation: operation({
          ...actor.rows.tasks,
          id: randomUUID(),
          updated_at: new Date(Date.now() + 600000).toISOString(),
        }),
      },
      `${actor.label}_future_clock_denied`,
      ['22023'],
    )
    const badEndpoint = await rpc(actor, 'dayflow_register_push', {
      p_endpoint: 'https://127.0.0.1/a',
      p_p256dh: 'A'.repeat(87),
      p_auth: 'B'.repeat(22),
    })
    record(
      `${actor.label}_arbitrary_push_endpoint_denied`,
      badEndpoint.status === 400 && badEndpoint.data?.code === 'P0001',
      badEndpoint,
    )
    const steal = await rpc(actor, 'dayflow_register_push', {
      p_endpoint: `https://fcm.googleapis.com/fcm/send/dayflow-security-${run}-${other.label}`,
      p_p256dh: 'C'.repeat(87),
      p_auth: 'D'.repeat(22),
    })
    record(
      `${actor.label}_foreign_push_registration_denied`,
      steal.status === 400 && steal.data?.code === 'P0001',
      steal,
    )
    const foreignDelete = await request(
      actor,
      `push_subscriptions?id=eq.${other.subscription}`,
      'DELETE',
    )
    record(
      `${actor.label}_foreign_push_delete_empty`,
      foreignDelete.status === 200 && foreignDelete.data.length === 0,
      foreignDelete,
    )
    console.log(`${phase}: ${actor.label}, RLS and adversarial writes verified`)
  }
  const privateFunctions = {
    dayflow_push_candidates: {
      p_after: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
    },
    dayflow_claim_push: {
      p_subscription: null,
      p_reminder: null,
      p_version: null,
      p_at: null,
    },
    dayflow_invoke_push: {},
    dayflow_table: { p_entity: 'tasks' },
    dayflow_wins: { a: {}, b: {} },
    dayflow_append: { p_entity: 'tasks', p_row: {}, p_stamp: {} },
    dayflow_push_endpoint: { p_endpoint: 'https://127.0.0.1/a' },
    dayflow_capture: {},
    handle_new_user: {},
    audit_entity_update: {},
    validate_entity_link: {},
    validate_event_timezone: {},
    validate_task_timezone: {},
  }
  for (const actor of [null, ...users]) {
    const label = actor?.label ?? 'anon'
    for (const [name, args] of Object.entries(privateFunctions))
      await rejected(actor, name, args, `${label}_${name}_http_denied`, [
        '42501',
        'PGRST202',
      ])
    if (!actor) {
      const schema = await request(
        null,
        'tasks?select=id&limit=0',
        'GET',
        undefined,
        {
          'Accept-Profile': 'dayflow_schema_audit_unknown',
        },
      )
      record(
        'http_unknown_schema_rejected',
        schema.status === 406 && schema.data?.code === 'PGRST106',
        schema,
      )
      const catalog = JSON.parse(
        readFileSync(
          'docs/audits/2026-10-09-supabase-catalog.json',
          'utf8',
        ).replace(/^\uFEFF/, ''),
      )
      const candidates = [
        ...new Set(catalog.schemas.map((s) => s.schema)),
      ].sort()
      report.exposed_schemas = []
      report.schema_probes = []
      for (const candidate of candidates) {
        const checked = await request(
          'service',
          `dayflow_audit_absent_${run.replaceAll('-', '')}`,
          'GET',
          undefined,
          { 'Accept-Profile': candidate },
        )
        const exposed = checked.status !== 406
        const knownOutcome = exposed
          ? [404, 403].includes(checked.status) &&
            ['PGRST205', '42501'].includes(checked.data?.code)
          : checked.data?.code === 'PGRST106'
        record(
          `http_schema_${candidate}_profile_checked`,
          knownOutcome,
          checked,
        )
        report.schema_probes.push({
          schema: candidate,
          exposed,
          http_status: checked.status,
          error_code: checked.data?.code,
        })
        if (exposed) report.exposed_schemas.push(candidate)
      }
      const gql = await graphql(
        null,
        `query { tasksCollection(filter:{id:{eq:"${users[0].rows.tasks.id}"}}) { edges { node { id } } } }`,
      )
      record(
        graphqlDisabled(gql)
          ? 'anon_graphql_disabled'
          : 'anon_graphql_private_task_denied',
        gql.status === 200 &&
          ((Array.isArray(gql.data.errors) &&
            !gql.data.data?.tasksCollection) ||
            gql.data.data?.tasksCollection?.edges?.length === 0),
        gql,
      )
      const serviceGql = await graphql(
        'service',
        `query {
        a: tasksCollection(filter:{id:{eq:"${users[0].rows.tasks.id}"}}) { edges { node { id } } }
        b: tasksCollection(filter:{id:{eq:"${users[1].rows.tasks.id}"}}) { edges { node { id } } }
      }`,
      )
      record(
        graphqlDisabled(serviceGql)
          ? 'service_graphql_disabled'
          : 'service_graphql_both_accounts_authorized',
        graphqlDisabled(serviceGql) ||
          (serviceGql.status === 200 &&
            !serviceGql.data.errors &&
            serviceGql.data.data?.a?.edges?.length === 1 &&
            serviceGql.data.data?.b?.edges?.length === 1),
        serviceGql,
      )
      for (const [name, args] of Object.entries({
        dayflow_pull: {},
        dayflow_apply_operation: { p_operation: null },
        dayflow_register_push: {
          p_endpoint: null,
          p_p256dh: null,
          p_auth: null,
        },
      }))
        await rejected(actor, name, args, `anon_${name}_http_denied`, [
          '42501',
          'PGRST202',
        ])
      for (const table of tables) {
        const r = await request(null, `${table}?select=*&limit=1`)
        record(
          `anon_${table}_http_denied`,
          [401, 403].includes(r.status) && r.data?.code === '42501',
          r,
        )
        const fixture = users[0]
        const filter =
          table === 'push_deliveries'
            ? `subscription_id=eq.${fixture.subscription}`
            : `user_id=eq.${fixture.id}`
        const body =
          table === 'push_deliveries'
            ? { attempts: 99 }
            : { user_id: fixture.id }
        for (const method of ['POST', 'PATCH', 'DELETE']) {
          const mutation = await request(
            null,
            `${table}${method === 'POST' ? '' : `?${filter}`}`,
            method,
            method === 'DELETE' ? undefined : body,
          )
          record(
            `anon_direct_${method}_${table}_denied`,
            [401, 403].includes(mutation.status) &&
              mutation.data?.code === '42501',
            mutation,
          )
        }
      }
    }
  }
  for (const actor of users) {
    const op = actor.ops.tasks
    const stored = await request(actor, `tasks?id=eq.${op.entityId}`)
    record(
      `${actor.label}_task_unchanged_after_attacks`,
      stored.status === 200 &&
        stored.data.length === 1 &&
        stored.data[0].title === actor.rows.tasks.title &&
        stored.data[0].version === 1,
      stored,
    )
    const other = users.find((u) => u !== actor)
    const parts = actor.token.split('.')
    const forged = {
      ...JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')),
      sub: other.id,
      role: 'service_role',
    }
    parts[1] = Buffer.from(JSON.stringify(forged)).toString('base64url')
    const forgedResponse = await request(
      parts.join('.'),
      `tasks?user_id=eq.${other.id}`,
    )
    record(
      `${actor.label}_forged_jwt_denied`,
      forgedResponse.status === 401,
      forgedResponse,
    )
    await rejected(
      actor,
      'dayflow_pull',
      { p_after: '-1', p_limit: 3 },
      `${actor.label}_bad_cursor_denied`,
      ['22023'],
    )
    await rejected(
      actor,
      'dayflow_pull',
      { p_after: '0', p_limit: 101 },
      `${actor.label}_bad_page_limit_denied`,
      ['22023'],
    )
    const now = new Date().toISOString()
    const updated = {
      ...actor.rows.tasks,
      title: 'Authorized update',
      updated_at: now,
      version: 2,
    }
    await apply(
      actor,
      operation(updated, 'tasks', randomUUID(), 'update'),
      `${actor.label}_authorized_update`,
    )
    const tombstone = {
      ...updated,
      updated_at: new Date(Date.now() + 10).toISOString(),
      deleted_at: new Date().toISOString(),
      version: 3,
    }
    await apply(
      actor,
      operation(tombstone, 'tasks', randomUUID(), 'delete'),
      `${actor.label}_authorized_soft_delete`,
    )
    const row = await request(actor, `tasks?id=eq.${updated.id}`)
    record(
      `${actor.label}_authorized_tombstone_persisted`,
      row.status === 200 &&
        row.data.length === 1 &&
        row.data[0].deleted_at !== null,
      row,
    )
    const remove = await request(
      actor,
      `push_subscriptions?id=eq.${actor.subscription}`,
      'DELETE',
    )
    record(
      `${actor.label}_authorized_push_delete`,
      remove.status === 200 && remove.data.length === 1,
      remove,
    )
    await pullAll(actor, `${actor.label}_final_paginated_pull_isolated`)
  }
  const candidates = await rpc('service', 'dayflow_push_candidates', {
    p_after: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  })
  record(
    'service_candidates_authorized',
    candidates.status === 200 && candidates.data.length === 0,
    candidates,
  )
  const claim = await rpc('service', 'dayflow_claim_push', {
    p_subscription: randomUUID(),
    p_reminder: randomUUID(),
    p_version: 1,
    p_at: new Date().toISOString(),
  })
  record(
    'service_claim_invalid_fixture_returns_null',
    claim.status === 200 && claim.data === null,
    claim,
  )
} catch (error) {
  failed = true
  // Only our fixed labels are printable; never serialize Supabase error objects.
  report.failure =
    error instanceof Error &&
    /^(Failed test:|Temporary account |Account |HTTP request |.*: page failed|.*: foreign owner|.*: cursor did not advance)/.test(
      error.message,
    )
      ? error.message
      : 'Integration test failed; inspect the sanitized test results'
  console.error(report.failure)
} finally {
  for (const user of users) {
    try {
      await user.client?.auth.signOut({ scope: 'local' })
    } catch {
      /* admin deletion revokes sessions */
    }
    let cleanup = false
    try {
      const removed = await admin.auth.admin.deleteUser(user.id)
      const checked = await admin.auth.admin.getUserById(user.id)
      cleanup = !removed.error && Boolean(checked.error) && !checked.data.user
    } catch {
      cleanup = false
    }
    report.cleanup.push({ account: user.label, deleted: cleanup })
    if (!cleanup) failed = true
    // Check all application rows cascade away, retaining only a boolean.
    for (const table of tables.filter((t) => t !== 'push_deliveries')) {
      try {
        const r = await request(
          'service',
          `${table}?select=user_id&user_id=eq.${user.id}`,
        )
        const clean =
          r.status === 200 && Array.isArray(r.data) && r.data.length === 0
        report.cleanup.push({ account: user.label, table, empty: clean })
        if (!clean) failed = true
      } catch {
        report.cleanup.push({ account: user.label, table, empty: false })
        failed = true
      }
    }
    if (user.subscription) {
      try {
        const r = await request(
          'service',
          `push_deliveries?select=subscription_id&subscription_id=eq.${user.subscription}`,
        )
        const clean =
          r.status === 200 && Array.isArray(r.data) && r.data.length === 0
        report.cleanup.push({
          account: user.label,
          table: 'push_deliveries',
          empty: clean,
        })
        if (!clean) failed = true
      } catch {
        report.cleanup.push({
          account: user.label,
          table: 'push_deliveries',
          empty: false,
        })
        failed = true
      }
    }
  }
  if (users.length === 2 && report.cleanup.every((c) => c.deleted ?? c.empty))
    unlinkSync(ledger)
  report.finished_at = new Date().toISOString()
  report.pass =
    !failed && users.length === 2 && report.tests.every((t) => t.pass)
  writeFileSync(
    `docs/audits/2026-10-09-supabase-api-${phase}.json`,
    JSON.stringify(report, null, 2) + '\n',
  )
  console.log(
    `${phase}: ${report.tests.filter((t) => t.pass).length}/${report.tests.length} checks passed; cleanup ${report.cleanup.every((c) => c.deleted ?? c.empty) ? 'verified' : 'incomplete'}`,
  )
  if (failed) process.exitCode = 1
}
