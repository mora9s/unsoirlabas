import { expect, test } from '@playwright/test'

test('la migration historique ne dépasse pas la limite de carnets et garde la source intacte', async ({ page }) => {
  await page.goto('/')
  const before = await page.evaluate(() => {
    const legacy = JSON.stringify({ version: 1, drafts: [{ id: 'ancien', title: 'Une journée', memories: 'Au bord de mer.', tone: 'Contemplatif', story: 'La journée.', media: [], coverId: '', status: 'draft' }] })
    localStorage.setItem('philippines-trip', legacy)
    localStorage.setItem('un-soir-la-bas-journals-v1', JSON.stringify({ version: 1, journals: Array.from({ length: 12 }, (_, index) => ({ tripId: `trip-${index}`, destination: `Voyage ${index}`, departure: '2027-04-12', chapters: [] })) }))
    return legacy
  })
  await page.reload()
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('un-soir-la-bas-journals-v1') || '{}').journals)).toHaveLength(12)
  expect(await page.evaluate(() => localStorage.getItem('philippines-trip'))).toBe(before)
})
