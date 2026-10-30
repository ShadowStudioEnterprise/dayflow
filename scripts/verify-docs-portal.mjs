const expected = process.env.PORTAL_EXPECTED_SHA
if (!/^[a-f0-9]{40}$/.test(expected ?? '')) {
  throw new Error('PORTAL_EXPECTED_SHA must be a full commit SHA')
}

const origin = 'https://dayflow-docs.vercel.app'
const deadline = Date.now() + 5 * 60 * 1000
let lastResult = 'No response'
while (Date.now() < deadline) {
  try {
    const response = await fetch(
      `${origin}/portal-version.json?t=${Date.now()}`,
      {
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      },
    )
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const version = await response.json()
    if (version.sha === expected) {
      const page = await fetch(`${origin}/verification`, {
        signal: AbortSignal.timeout(15000),
      })
      if (!page.ok || !(await page.text()).includes('Dayflow Docs')) {
        throw new Error('Verification page is unavailable')
      }
      console.log(`Published documentation verified: ${expected} at ${origin}`)
      process.exit(0)
    }
    lastResult = `Published SHA: ${version.sha}`
  } catch (error) {
    lastResult = error.message
  }
  console.log(`Waiting for ${expected}: ${lastResult}`)
  await new Promise((resolve) => setTimeout(resolve, 10000))
}
throw new Error(`Portal did not publish ${expected}: ${lastResult}`)
