import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { expect, test, type Page } from '@playwright/test'

async function prepare(page: Page) {
  await page.goto('/#tools')
  await page.getByRole('button', { name: /^(Télécharger pour le hors connexion|Actualiser la copie hors connexion)$/ }).click()
  await expect(page.getByRole('status')).toContainText('Application disponible hors connexion', { timeout: 30000 })
}

const media = [
  '/assets/el-nido-bay.jpg',
  '/assets/el-nido-lagoon.jpg',
  '/assets/chocolate-hills.jpg',
  '/assets/el-nido-big-lagoon.jpg',
  '/assets/bacuit-island.jpg',
  '/assets/manila-jeepney.jpg',
  '/assets/limestone-island.jpg',
  '/assets/port-barton.jpg',
  '/assets/manila-sunset.jpg',
  '/assets/nakabuang-beach.webm',
]

test('ships the finite travel media in the shell and decodes a bundled image while offline', async ({ page, context }) => {
  await prepare(page)
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker?.controller))).toBe(true)
  const cached = await page.evaluate(async paths => {
    const cachesByName = await caches.keys()
    const shell = await caches.open(cachesByName.find(name => name.startsWith('unsoirlabas-offline-'))!)
    return Promise.all(paths.map(async path => {
      const response = await shell.match(path)
      return { path, status: response?.status, type: response?.headers.get('content-type'), bytes: response ? (await response.arrayBuffer()).byteLength : 0 }
    }))
  }, media)
  expect(cached).toHaveLength(10)
  expect(cached.reduce((total, entry) => total + entry.bytes, 0)).toBeLessThanOrEqual(8_300_000)
  expect(cached.every(entry => entry.status === 200 && entry.bytes > 0)).toBe(true)
  expect(cached.find(entry => entry.path.endsWith('.webm'))?.type).toContain('video/webm')
  expect(cached.filter(entry => entry.path.endsWith('.jpg')).every(entry => entry.type?.startsWith('image/jpeg'))).toBe(true)

  await context.setOffline(true)
  const decoded = await page.evaluate(async () => {
    const image = new Image()
    image.src = '/assets/manila-sunset.jpg'
    await image.decode()
    return { width: image.naturalWidth, height: image.naturalHeight }
  })
  expect(decoded.width).toBeGreaterThan(0)
  expect(decoded.height).toBeGreaterThan(0)
  const offlineResponse = await page.evaluate(async () => {
    const response = await fetch('/assets/manila-sunset.jpg')
    return { status: response.status, bytes: (await response.arrayBuffer()).byteLength }
  })
  expect(offlineResponse).toMatchObject({ status: 200, bytes: cached.find(entry => entry.path.endsWith('manila-sunset.jpg'))?.bytes })
})

test('serves an offline video byte range as a valid 206 response', async ({ page, context }) => {
  await prepare(page)
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker?.controller))).toBe(true)
  await context.setOffline(true)
  const result = await page.evaluate(async () => {
    const response = await fetch('/assets/nakabuang-beach.webm', { headers: { Range: 'bytes=0-1023' } })
    const body = await response.arrayBuffer()
    return {
      status: response.status,
      contentRange: response.headers.get('content-range'),
      contentLength: response.headers.get('content-length'),
      acceptRanges: response.headers.get('accept-ranges'),
      bytes: body.byteLength,
      contentType: response.headers.get('content-type'),
    }
  })
  expect(result).toEqual({
    status: 206,
    contentRange: 'bytes 0-1023/5006527',
    contentLength: '1024',
    acceptRanges: 'bytes',
    bytes: 1024,
    contentType: 'video/webm',
  })
})

test('serves the last video bytes for an offline suffix range', async ({ page, context }) => {
  await prepare(page)
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker?.controller))).toBe(true)
  await context.setOffline(true)
  const result = await page.evaluate(async () => {
    const response = await fetch('/assets/nakabuang-beach.webm', { headers: { Range: 'bytes=-1024' } })
    return { status: response.status, range: response.headers.get('content-range'), bytes: (await response.arrayBuffer()).byteLength }
  })
  expect(result).toEqual({ status: 206, range: 'bytes 5005503-5006526/5006527', bytes: 1024 })
})

test('deletes the partial shell and rejects installation when a mandatory precache entry fails', async () => {
  const listeners = new Map<string, (event: { waitUntil: (promise: Promise<unknown>) => void }) => void>()
  const deleted: string[] = []
  const self = {
    addEventListener: (name: string, listener: (event: { waitUntil: (promise: Promise<unknown>) => void }) => void) => listeners.set(name, listener),
    skipWaiting: async () => undefined,
    clients: { claim: async () => undefined },
  }
  const caches = {
    open: async () => ({ addAll: async () => { throw new Error('mandatory precache request failed') } }),
    delete: async (name: string) => { deleted.push(name); return true },
    keys: async () => [],
  }
  const script = readFileSync(new URL('../dist/offline-worker.js', import.meta.url), 'utf8')
  runInNewContext(script, { self, caches, Promise, Math, Response, Request: class { constructor(public url: string) {} }, URL })
  let installation!: Promise<unknown>
  listeners.get('install')!({ waitUntil: promise => { installation = promise } })
  let failure: unknown
  try {
    await installation
  } catch (error) {
    failure = error
  }
  expect(String(failure)).toContain('mandatory precache request failed')
  expect(deleted).toHaveLength(1)
  expect(deleted[0]).toMatch(/^unsoirlabas-offline-[a-f0-9]{16}$/)
})
