import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { validateDocs } from './validate-docs.mjs'

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dayflow-docs-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  for (const name of [
    'README.md',
    'docs/README.md',
    'docs/architecture.md',
    'docs/database.md',
    'docs/sync.md',
    'docs/verification.md',
    'docs/release-validation.md',
    'docs/notifications-policy.md',
    'docs/audits/README.md',
  ]) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true })
    fs.writeFileSync(path.join(root, name), '# Título\n')
  }
  fs.mkdirSync(path.join(root, 'supabase/migrations'), { recursive: true })
  fs.writeFileSync(
    path.join(root, 'docs/README.md'),
    fs
      .readdirSync(path.join(root, 'docs'))
      .filter((f) => f.endsWith('.md') && f !== 'README.md')
      .map((f) => `[guide](${f})`)
      .join('\n'),
  )
  return root
}
test('valid links, Unicode headings, references and fenced examples', (t) => {
  const root = fixture(t)
  fs.writeFileSync(
    path.join(root, 'README.md'),
    '[ok](docs/sync.md#título)\n[ref][sync]\n[sync]: docs/sync.md\n```md\n[example](missing.md)\n```\n',
  )
  assert.deepEqual(validateDocs(root), [])
})
test('rejects missing paths, anchors, reference definitions and required files', (t) => {
  const root = fixture(t)
  fs.writeFileSync(
    path.join(root, 'README.md'),
    '[broken](missing.md)\n[anchor](docs/sync.md#missing)\n[ref][unknown]\n',
  )
  fs.unlinkSync(path.join(root, 'docs/architecture.md'))
  const errors = validateDocs(root).join('\n')
  for (const fragment of [
    'missing target',
    'missing anchor',
    'undefined reference',
    'Missing required',
  ])
    assert.ok(errors.includes(fragment))
})
test('rejects undocumented and removed migrations and unindexed guides', (t) => {
  const root = fixture(t)
  fs.writeFileSync(
    path.join(root, 'supabase/migrations/202610040005_web_push.sql'),
    '-- sql',
  )
  fs.writeFileSync(
    path.join(root, 'docs/database.md'),
    '`202610040006_removed.sql`',
  )
  fs.writeFileSync(path.join(root, 'docs/new.md'), '# New')
  const errors = validateDocs(root).join('\n')
  for (const fragment of [
    'Undocumented migration',
    'unknown migration',
    'Guide missing',
  ])
    assert.ok(errors.includes(fragment))
})
