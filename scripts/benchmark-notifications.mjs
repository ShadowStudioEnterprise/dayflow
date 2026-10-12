import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'

const root = process.cwd()
const source = 'b4ff64e99846c60028171cdc38cd45155e1fd1fd'
const output =
  process.argv[2] ?? '.toolchains/notifications-capacity-emitter.json'
const npm =
  process.env.npm_execpath ??
  path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js')
const worktree = path.resolve(
  root,
  '.toolchains',
  `notifications-source-${randomUUID()}`,
)
if (!worktree.startsWith(path.resolve(root, '.toolchains') + path.sep))
  throw new Error('Unsafe worktree path')
mkdirSync(path.dirname(worktree), { recursive: true })
const report = {
  generated_at: new Date().toISOString(),
  scope:
    'Local Deno CPU; synthetic RPC, signing and transport; no real sends or production capacity claim.',
  baseline: execFileSync('git', ['rev-parse', 'dev'], {
    encoding: 'utf8',
  }).trim(),
  instrumented_source: source,
  samples: [],
}
try {
  execFileSync('git', ['worktree', 'add', '--detach', worktree, source], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  for (const [version, handler] of [
    ['dev', './index.ts'],
    [
      'instrumented',
      pathToFileURL(
        path.join(worktree, 'supabase/functions/push-dispatch/index.ts'),
      ).href,
    ],
  ]) {
    for (let sample = 1; sample <= 3; sample++) {
      const result = JSON.parse(
        execFileSync(
          process.execPath,
          [
            npm,
            'exec',
            '--yes',
            '--package=deno@2.9.6',
            '--',
            'deno',
            'run',
            '--allow-env',
            '--allow-read',
            '--config',
            'supabase/functions/push-dispatch/deno.capacity.json',
            'supabase/functions/push-dispatch/capacity-bench.ts',
            handler,
          ],
          {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout: 60000,
          },
        ),
      )
      report.samples.push({ version, sample, ...result })
    }
  }
} finally {
  execFileSync('git', ['worktree', 'remove', '--force', worktree], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}
mkdirSync(path.dirname(path.resolve(output)), { recursive: true })
writeFileSync(output, JSON.stringify(report, null, 2) + '\n')
console.log(
  JSON.stringify({
    saved: output,
    samples: report.samples.length,
    scenarios: report.samples.reduce((n, s) => n + s.results.length, 0),
  }),
)
