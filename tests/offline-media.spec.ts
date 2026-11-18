import { expect, test } from '@playwright/test'

test('le téléchargement explicite garde les médias livrés et les plages vidéo hors ligne', async ({ page, context }) => {
  await page.goto('/#tools')
  await page.getByRole('button', { name: 'Télécharger pour le hors connexion' }).click()
  await expect(page.getByRole('status')).toContainText('Application disponible hors connexion', { timeout: 30000 })
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  const cache = await page.evaluate(async () => {
    const name = (await caches.keys()).find(key => key.startsWith('unsoirlabas-offline-'))!
    const entries = await (await caches.open(name)).keys()
    return { name, urls: entries.map(entry => entry.url) }
  })
  expect(cache.name).toMatch(/^unsoirlabas-offline-[a-f0-9]{16}$/)
  expect(cache.urls.some(url => url.includes('/assets/nakabuang-beach.webm'))).toBe(true)
  expect(cache.urls.every(url => new URL(url).origin === new URL(page.url()).origin && !new URL(url).pathname.startsWith('/api/'))).toBe(true)
  await context.setOffline(true)
  const result = await page.evaluate(async () => {
    const image = new Image()
    image.src = '/assets/manila-sunset.jpg'
    await image.decode()
    const fetchRange = async (range: string) => {
      const response = await fetch('/assets/nakabuang-beach.webm', { headers: { Range: range } })
      return { status: response.status, range: response.headers.get('content-range'), length: (await response.arrayBuffer()).byteLength }
    }
    return { width: image.naturalWidth, first: await fetchRange('bytes=0-1023'), last: await fetchRange('bytes=-1024'), invalid: await fetchRange('bytes=-0') }
  })
  expect(result.width).toBeGreaterThan(0)
  expect(result.first).toEqual({ status: 206, range: 'bytes 0-1023/5006527', length: 1024 })
  expect(result.last).toEqual({ status: 206, range: 'bytes 5005503-5006526/5006527', length: 1024 })
  expect(result.invalid).toEqual({ status: 416, range: 'bytes */5006527', length: 0 })
})
