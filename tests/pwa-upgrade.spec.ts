import { expect, test } from '@playwright/test'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'

const download = /^(Télécharger pour le hors connexion|Actualiser la copie hors connexion)$/

test('un ancien onglet charge un vrai module conservé sans exposer API ou URL voisines', async ({ page, context }) => {
  await page.goto('/#tools')
  await page.getByRole('button', { name: download }).click()
  await expect(page.getByRole('status')).toContainText('Application disponible hors connexion', { timeout: 30000 })
  const oldPath = await page.evaluate(async () => {
    const current = await caches.open((await caches.keys()).find(k => k.startsWith('unsoirlabas-offline-'))!)
    const request = (await current.keys()).find(r => /\/assets\/route-geography-.*\.js$/.test(r.url))!
    const response = (await current.match(request))!
    const previous = await caches.open('unsoirlabas-offline-previous-test')
    await previous.put('/assets/route-geography-previous1.js', response)
    await previous.put('/api/private-previous1.js', new Response('secret'))
    await previous.put('/assets/notversioned.js', new Response('not versioned'))
    return '/assets/route-geography-previous1.js'
  })
  await context.setOffline(true)
  const result = await page.evaluate(async path => {
    const module = await import(/* @vite-ignore */ path)
    const blocked = async (url: string) => { try { await fetch(url); return false } catch { return true } }
    return { exports: Object.keys(module).length, queryBlocked: await blocked(path + '?other=1'), apiBlocked: await blocked('/api/private-previous1.js'), unversionedBlocked: await blocked('/assets/notversioned.js') }
  }, oldPath)
  expect(result.exports).toBeGreaterThan(0)
  expect(result).toMatchObject({ queryBlocked: true, apiBlocked: true, unversionedBlocked: true })
})

test('une installation de mise à jour échouée conserve la copie précédente sans annoncer son succès', async ({ browser }) => {
  const root = join(process.cwd(), 'dist')
  const original = await readFile(join(root, 'offline-worker.js'), 'utf8')
  const currentVersion = JSON.parse(await readFile(join(root, 'offline-version.json'), 'utf8')).version as string
  const nextVersion = currentVersion === 'unsoirlabas-offline-0000000000000000' ? 'unsoirlabas-offline-1111111111111111' : 'unsoirlabas-offline-0000000000000000'
  const broken = original.replace(currentVersion, nextVersion).replace('const FILES=[', 'const FILES=["/missing-upgrade-fixture.js",')
  let upgrading = false, serveBroken = true, missingRequests = 0
  const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.webm': 'video/webm', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' }
  const server = createServer(async (req, res) => {
    const path = new URL(req.url!, 'http://localhost').pathname
    if (path === '/missing-upgrade-fixture.js') { missingRequests++; res.writeHead(404).end(); return }
    if (upgrading && path === '/offline-worker.js') { res.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' }).end(serveBroken ? broken : original); return }
    if (upgrading && path === '/offline-version.json') { res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify({ version: nextVersion })); return }
    if (path.includes('..')) { res.writeHead(404).end(); return }
    try { const file = path === '/' ? '/index.html' : path; const data = await readFile(join(root, file)); res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(data) }
    catch { res.writeHead(404).end() }
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('server address')
  const context = await browser.newContext({ baseURL: `http://127.0.0.1:${address.port}` })
  try {
    const page = await context.newPage()
    await page.goto('/#tools')
    await page.getByRole('button', { name: download }).click()
    await expect(page.getByRole('status')).toContainText('Application disponible hors connexion', { timeout: 30000 })
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
    upgrading = true
    await page.getByRole('button', { name: 'Actualiser la copie hors connexion' }).click()
    await expect(page.getByRole('status')).toContainText('Actualisation incomplète', { timeout: 30000 })
    await expect(page.getByRole('status')).toContainText('copie précédente reste disponible')
    expect(missingRequests).toBeGreaterThan(0)
    expect(await page.evaluate(() => caches.keys())).toContain(currentVersion)
    expect(await page.evaluate(() => caches.keys())).not.toContain(nextVersion)
    // The installing worker can already be gone when update() returns. A stale
    // ready STATUS must still not be mistaken for the advertised new version.
    await expect.poll(() => page.evaluate(async () => !(await navigator.serviceWorker.getRegistration('/'))?.installing)).toBe(true)
    serveBroken = false
    await page.getByRole('button', { name: 'Actualiser la copie hors connexion' }).click()
    await expect(page.getByRole('status')).toContainText('Actualisation incomplète', { timeout: 30000 })
    await expect(page.getByRole('button', { name: 'Actualiser la copie hors connexion' })).toBeEnabled()
    await expect(page.getByRole('complementary', { name: 'Disponibilité hors connexion' })).toContainText('Application téléchargée')
    await context.setOffline(true)
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Pages personnelles' })).toBeVisible()
  } finally {
    await context.close()
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }
})
