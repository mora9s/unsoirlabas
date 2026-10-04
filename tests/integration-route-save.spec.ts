import { test, expect } from '@playwright/test'

test('a rejected route write retains the editor and never reports success', async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', route => route.abort())
  await page.goto('/')
  const original = JSON.stringify([{ id: 'cebu', destination: 'Cebu', departure: '2027-02-01', plan: { ideas: [], notes: '', stops: [{ id: 'port', place: 'Port', point: { lat: 10.3, lon: 123.9 }, notes: 'À conserver' }] } }])
  await page.evaluate(value => localStorage.setItem('un-soir-la-bas-upcoming-v1', value), original)
  await page.goto('/#plan/cebu/map')
  await page.locator('.route-stop-strip button').first().click()
  await page.getByLabel('Nom du lieu', { exact: true }).fill('Port renommé')
  await page.evaluate(() => {
    const write = Storage.prototype.setItem
    Storage.prototype.setItem = function(key, value) { if (key === 'un-soir-la-bas-upcoming-v1') throw new DOMException('Quota', 'QuotaExceededError'); return write.call(this, key, value) }
  })
  await page.getByRole('button', { name: 'Enregistrer cette escale', exact: true }).click()
  await expect(page.getByRole('alert').first()).toContainText('Impossible d’enregistrer')
  await expect(page.getByLabel('Nom du lieu', { exact: true })).toHaveValue('Port renommé')
  await expect(page.locator('.route-message').filter({ hasText: 'Étape mise à jour' })).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('un-soir-la-bas-upcoming-v1'))).toBe(original)
})
