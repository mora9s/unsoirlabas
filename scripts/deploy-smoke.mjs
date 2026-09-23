#!/usr/bin/env node
import { chromium } from '@playwright/test'

function usage() {
  console.error('Usage: node scripts/deploy-smoke.mjs --url <https://deployment> --expected-sha <40-hex-commit>')
  process.exit(2)
}

const args = process.argv.slice(2)
const option = name => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}
const rawUrl = option('--url')
const expectedSha = option('--expected-sha')
if (!rawUrl || !expectedSha || !/^[a-f0-9]{40}$/i.test(expectedSha)) usage()

let target
try {
  target = new URL(rawUrl)
} catch {
  usage()
}
if (target.protocol !== 'https:' && target.hostname !== 'localhost' && target.hostname !== '127.0.0.1') {
  throw new Error('Use HTTPS for remote deployments (HTTP is allowed only on localhost).')
}
const base = target.origin
const failures = []
const check = (condition, message) => {
  if (!condition) failures.push(message)
  console.log(`${condition ? 'PASS' : 'FAIL'} ${message}`)
}

const metaResponse = await fetch(new URL('/deployment.json', base), { redirect: 'follow' })
let metadata
try {
  metadata = await metaResponse.json()
} catch {
  metadata = null
}
const deployedSha = metadata?.commitSha
check(metaResponse.ok && /^[a-f0-9]{40}$/i.test(deployedSha ?? ''), 'deployment metadata contains a full commit SHA')
check(typeof deployedSha === 'string' && deployedSha.toLowerCase() === expectedSha.toLowerCase(), `deployed SHA matches expected ${expectedSha}`)

const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}),
})
try {
  const page = await browser.newPage()
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') pageErrors.push(message.text()) })
  for (const [path, label, width] of [
    ['/', 'home/countdown', 390],
    ['/#create', 'create', 390],
    ['/#share', 'share', 390],
    ['/', 'home desktop', 1280],
  ]) {
    await page.setViewportSize({ width, height: 844 })
    const response = await page.goto(new URL(path, base).href, { waitUntil: 'networkidle' })
    check(response === null || response.ok(), `${label} route responds successfully`)
    const routeVisible = await page.evaluate(label => {
      if (label === 'home/countdown' || label === 'home desktop') return Boolean(document.querySelector('main'))
      if (label === 'create') return Boolean(document.querySelector('textarea, input'))
      return Boolean(document.querySelector('[data-testid="share-chapter-picker"]'))
    }, label)
    check(routeVisible, `${label} route renders its expected surface`)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    check(overflow <= 1, `${label} layout has no horizontal overflow at ${width}px`)
  }
  const health = await fetch(new URL('/api/voice/health', base), { redirect: 'manual' })
  const contentType = health.headers.get('content-type') ?? ''
  const payload = contentType.includes('application/json') ? await health.json().catch(() => null) : null
  const unavailable = health.status === 404 || (health.ok && !payload)
  const createResponse = await page.goto(new URL('/#create', base).href, { waitUntil: 'networkidle' })
  const voiceEntry = page.getByRole('button', { name: 'Commencer le récit du soir' })
  const entryCount = await voiceEntry.count()
  const privateNotice = await page.getByText('Le récit vocal est réservé à l’accès privé pour le moment.').count()
  if (unavailable) {
    check(entryCount === 0 && privateNotice > 0, `voice API is unavailable (HTTP ${health.status}) and UI does not advertise it`)
  } else if (health.ok && payload) {
    check(entryCount > 0 || privateNotice > 0, 'voice UI explicitly represents its availability')
  } else {
    check(false, `voice health endpoint status is supported (received ${health.status})`)
  }
  check(createResponse === null || createResponse.ok(), 'create route remains available after voice availability check')
  check(pageErrors.length === 0, `browser has no page/console errors${pageErrors.length ? `: ${pageErrors.join('; ')}` : ''}`)
} finally {
  await browser.close()
}

if (failures.length) {
  console.error(`Deployment smoke failed: ${failures.length} check(s).`)
  process.exit(1)
}
console.log(`Deployment smoke passed for ${deployedSha}.`)
