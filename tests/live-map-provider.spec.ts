import { expect, test } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const trip = { id: 'philippines-probe', destination: 'Philippines · essai de données', departure: '2027-03-10' }
const outputDirectory = join(process.cwd(), 'evidence/map-stay')

test.skip(!process.env.LIVE_MAP_PROVIDER_SMOKE, 'Run explicitly: LIVE_MAP_PROVIDER_SMOKE=1 npm run test:acceptance -- --grep "live provider Philippines"')

test('live provider Philippines — explicit Nominatim geocode and bounded Overpass search', async ({ page }) => {
  await page.addInitScript(({ trip }) => localStorage.setItem('un-soir-la-bas-upcoming-v1', JSON.stringify([trip])), { trip })
  await page.goto('/#plan/philippines-probe')
  await mkdir(outputDirectory, { recursive: true })
  const observations: unknown[] = []
  for (const query of ['Cebu City, Philippines', 'Panglao, Bohol, Philippines']) {
    await page.getByLabel('Ville ou étape à explorer').fill(query)
    await page.getByRole('button', { name: 'Rechercher une destination' }).click()
    const radio = page.getByRole('radio', { name: new RegExp(query.split(',')[0], 'i') }).first()
    await expect(radio).toBeVisible({ timeout: 30_000 })
    await radio.check()
    await page.getByRole('button', { name: 'Explorer autour' }).first().click()
    const list = page.locator('.stay-results')
    await expect(list).toBeVisible({ timeout: 45_000 })
    const error = await page.locator('.stay-message').textContent()
    const countsText = await page.locator('.stay-category h4').allTextContents()
    const resultCache = await page.evaluate(() => {
      const raw = localStorage.getItem('un-soir-la-bas-osm-cache-v1')
      return raw ? JSON.parse(raw).at(-1) : null
    })
    observations.push({ query, message: error, categories: countsText, observedAt: resultCache?.observedAt, osmTimestamp: resultCache?.osmTimestamp, totalReturned: resultCache?.places?.length ?? 0,
      samples: resultCache?.places?.slice(0, 10).map((place: { name: string; category: string; sourceId: string }) => ({ name: place.name, category: place.category, sourceId: place.sourceId })) ?? [] })
    await page.screenshot({ path: join(outputDirectory, query.startsWith('Cebu') ? 'live-cebu.png' : 'live-panglao.png'), fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    const map = page.locator('.stay-map')
    await expect(map).toBeVisible()
    await expect.poll(() => map.locator('img.leaflet-tile').evaluateAll(images => images.filter(image => (image as HTMLImageElement).naturalWidth > 0).length), { timeout: 15000 }).toBeGreaterThan(0)
    await map.screenshot({ path: join(outputDirectory, query.startsWith('Cebu') ? 'live-cebu-map.png' : 'live-panglao-map.png') })
  }
  await writeFile(join(outputDirectory, 'live-probe.json'), JSON.stringify(observations, null, 2) + '\n')
  console.log('PHILIPPINES_LIVE_PROVIDER_PROBE', JSON.stringify(observations))
})
