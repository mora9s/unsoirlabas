import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const upcomingKey = 'un-soir-la-bas-upcoming-v1'
const journalsKey = 'un-soir-la-bas-journals-v1'
function dayOffset(offset: number) {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() + offset)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

test('matrice visuelle full-page : vide, 1, 3 voyages et photo rendue aux largeurs 320/390/1440', async ({ page }, testInfo) => {
  const photoSrc = `data:image/jpeg;base64,${(await readFile(new URL('../public/assets/el-nido-bay.jpg', import.meta.url))).toString('base64')}`
  const widths = [320, 390, 1440]
  const scenarios = [
    { name: 'empty', trips: [], journals: [] },
    { name: 'one-trip', trips: [{ id: 'one', destination: 'Kyoto', departure: dayOffset(18) }], journals: [] },
    { name: 'three-trips', trips: [
      { id: 'next', destination: 'Lisbonne', departure: dayOffset(8) },
      { id: 'later-a', destination: 'Kyoto', departure: dayOffset(26) },
      { id: 'later-b', destination: 'Séoul', departure: dayOffset(44) },
    ], journals: [] },
    { name: 'personal-photo', trips: [{ id: 'photo-trip', destination: 'Palawan', departure: dayOffset(-32), endDate: dayOffset(-24) }], journals: [{
      tripId: 'photo-trip', destination: 'Palawan', departure: dayOffset(-32), chapters: [{ id: 'photo-page', title: 'L’eau au matin', story: 'Une journée claire.', memories: 'Lagon', tone: 'Contemplatif', media: [{ id: 'real-photo', name: 'lagon.jpg', src: photoSrc }], coverId: 'real-photo', status: 'draft',
    }],
    }] },
  ]
  for (const scenario of scenarios) {
    for (const width of widths) {
      await page.setViewportSize({ width, height: 844 })
      await page.goto('/')
      await page.evaluate(({ upcomingKey, journalsKey, trips, journals }) => {
        localStorage.setItem(upcomingKey, JSON.stringify(trips))
        localStorage.setItem(journalsKey, JSON.stringify({ version: 1, journals }))
      }, { upcomingKey, journalsKey, trips: scenario.trips, journals: scenario.journals })
      await page.reload()
      const metrics = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth, offenders: Array.from(document.querySelectorAll('body *')).map(element => ({ tag: element.tagName, cls: typeof element.className === 'string' ? element.className : '', text: element.textContent?.trim().slice(0, 35), right: Math.round(element.getBoundingClientRect().right) })).filter(element => element.right > innerWidth + 1).slice(0, 8) }))
      expect(metrics.scroll - metrics.client, `${scenario.name}: overflow at ${width}px; ${JSON.stringify(metrics.offenders)}`).toBeLessThanOrEqual(1)
      if (scenario.name === 'personal-photo') expect(await page.locator('.memory-cover img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0)
      await page.screenshot({ path: testInfo.outputPath(`home-${width}-${scenario.name}.png`), fullPage: true })
    }
  }
})
