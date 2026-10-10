import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { stripVTControlCharacters } from 'node:util'

// Preserve every attempt, including failures, rather than reporting only the last run.
const [input, output] = process.argv.slice(2)
if (!input || !output)
  throw new Error(
    'Usage: node scripts/summarize-e2e-investigation.mjs report.json evidence.json',
  )
const report = JSON.parse(fs.readFileSync(input, 'utf8'))
const clean = (value) => value && stripVTControlCharacters(value)
const attempts = []
const attemptCounts = new Map()
function visit(suites) {
  for (const suite of suites ?? []) {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        for (const result of test.results ?? []) {
          const key = `${test.projectName}:${spec.id}`
          if (result.retry === 0) {
            const scenario = `${test.projectName}:${spec.file}:${spec.line}`
            const count = (attemptCounts.get(scenario) ?? 0) + 1
            attemptCounts.set(scenario, count)
            attemptCounts.set(key, count)
          }
          const attachments = (result.attachments ?? []).map((attachment) => {
            const file = attachment.path
            const exists = file && fs.existsSync(file)
            return {
              name: attachment.name,
              path:
                file &&
                path.relative(process.cwd(), file).replaceAll('\\', '/'),
              ...(exists
                ? {
                    sha256: crypto
                      .createHash('sha256')
                      .update(fs.readFileSync(file))
                      .digest('hex'),
                  }
                : {}),
              ...(attachment.body
                ? {
                    text: Buffer.from(attachment.body, 'base64').toString(
                      'utf8',
                    ),
                  }
                : {}),
            }
          })
          attempts.push({
            project: test.projectName,
            specId: spec.id,
            attemptNumber: attemptCounts.get(key),
            title: spec.title,
            file: spec.file,
            line: spec.line,
            retry: result.retry,
            workerIndex: result.workerIndex,
            status: result.status,
            startTime: result.startTime,
            durationMs: result.duration,
            errors: (result.errors ?? []).map((error) => clean(error.message)),
            attachments,
          })
        }
      }
    }
    visit(suite.suites)
  }
}
visit(report.suites)
const byProject = {}
for (const attempt of attempts) {
  const counts = (byProject[attempt.project] ??= {})
  counts[attempt.status] = (counts[attempt.status] ?? 0) + 1
}
fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(
  output,
  JSON.stringify(
    {
      sourceReportSha256: crypto
        .createHash('sha256')
        .update(fs.readFileSync(input))
        .digest('hex'),
      config: {
        workers: report.config.workers,
        projects: report.config.projects.map(
          ({ name, repeatEach, retries }) => ({ name, repeatEach, retries }),
        ),
      },
      stats: report.stats,
      errors: report.errors,
      byProject,
      attempts,
    },
    null,
    2,
  ) + '\n',
)
console.log(JSON.stringify({ stats: report.stats, byProject }))
