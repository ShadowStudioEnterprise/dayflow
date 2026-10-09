import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export function validateDocs(root) {
  const errors = []
  const required = [
    'README.md',
    'docs/README.md',
    'docs/architecture.md',
    'docs/database.md',
    'docs/sync.md',
    'docs/verification.md',
    'docs/release-validation.md',
    'docs/notifications-policy.md',
    'docs/audits/README.md',
  ]
  const walk = (dir) =>
    fs.existsSync(dir)
      ? fs
          .readdirSync(dir, { withFileTypes: true })
          .flatMap((e) =>
            e.isDirectory()
              ? ['.vitepress', 'node_modules'].includes(e.name)
                ? []
                : walk(path.join(dir, e.name))
              : e.name.endsWith('.md')
                ? [path.join(dir, e.name)]
                : [],
          )
      : []
  for (const name of required)
    if (!fs.existsSync(path.join(root, name)))
      errors.push(`Missing required document: ${name}`)
  const files = [
    path.join(root, 'README.md'),
    ...walk(path.join(root, 'docs')),
  ].filter((f) => fs.existsSync(f))
  const strip = (text) =>
    text
      .replace(/^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\1[^\n]*$/gm, '')
      .replace(/<!--[\s\S]*?-->/g, '')
  const texts = new Map(
    files.map((f) => [f, strip(fs.readFileSync(f, 'utf8'))]),
  )
  const anchors = (text) => {
    const counts = new Map()
    return new Set(
      [...text.matchAll(/^ {0,3}#{1,6}\s+(.+?)\s*#*$/gm)].map((m) => {
        const slug = m[1]
          .replace(/<[^>]+>/g, '')
          .toLowerCase()
          .replace(/[^\p{L}\p{N}_\-\s]/gu, '')
          .replace(/\s/g, '-')
        const n = counts.get(slug) ?? 0
        counts.set(slug, n + 1)
        return n ? `${slug}-${n}` : slug
      }),
    )
  }
  for (const [file, text] of texts) {
    const refs = new Map(
      [...text.matchAll(/^ {0,3}\[([^\]]+)\]:\s*<?([^\s>]+)>?/gm)].map((m) => [
        m[1].toLowerCase(),
        m[2],
      ]),
    )
    const links = [
      ...text.matchAll(
        /!?\[[^\]\n]*\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+["'][^\n]*?["'])?\s*\)/g,
      ),
    ].map((m) => m[1] ?? m[2])
    for (const m of text.matchAll(/!?\[([^\]\n]+)\]\[([^\]\n]*)\]/g)) {
      const id = (m[2] || m[1]).toLowerCase()
      if (!refs.has(id))
        errors.push(`${path.relative(root, file)}: undefined reference ${id}`)
      else links.push(refs.get(id))
    }
    links.push(...refs.values())
    for (const link of links) {
      if (/^[a-z][a-z\d+.-]*:|^\/\//i.test(link)) continue
      let decoded
      try {
        decoded = decodeURIComponent(link)
      } catch {
        errors.push(`${file}: invalid URL encoding ${link}`)
        continue
      }
      const [pathname, hash] = decoded.split('#')
      const target = pathname
        ? path.resolve(path.dirname(file), pathname.split('?')[0])
        : file
      if (!fs.existsSync(target)) {
        errors.push(`${path.relative(root, file)}: missing target ${link}`)
        continue
      }
      if (
        hash &&
        target.endsWith('.md') &&
        !anchors(
          texts.get(target) ?? strip(fs.readFileSync(target, 'utf8')),
        ).has(hash)
      )
        errors.push(`${path.relative(root, file)}: missing anchor ${link}`)
    }
  }
  const migrationsDir = path.join(root, 'supabase/migrations')
  const migrations = fs.existsSync(migrationsDir)
    ? fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'))
    : []
  const database = texts.get(path.join(root, 'docs/database.md')) ?? ''
  for (const migration of migrations)
    if (!database.includes(migration))
      errors.push(`Undocumented migration in docs/database.md: ${migration}`)
  for (const [file, text] of texts)
    for (const m of text.matchAll(/\b\d{12,14}_[a-zA-Z0-9_]+\.sql\b/g))
      if (!migrations.includes(m[0]))
        errors.push(`${path.relative(root, file)}: unknown migration ${m[0]}`)
  const index = texts.get(path.join(root, 'docs/README.md')) ?? ''
  for (const file of files.filter(
    (f) =>
      path.dirname(f) === path.join(root, 'docs') &&
      path.basename(f) !== 'README.md',
  ))
    if (!index.includes(`(${path.basename(file)})`))
      errors.push(`Guide missing from docs/README.md: ${path.basename(file)}`)
  return [...new Set(errors)]
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const errors = validateDocs(path.resolve(process.argv[2] ?? '.'))
  if (errors.length) {
    console.error(errors.join('\n'))
    process.exitCode = 1
  } else
    console.log(
      'Documentation valid: required files, local links, Markdown headings, index and migrations.',
    )
}
