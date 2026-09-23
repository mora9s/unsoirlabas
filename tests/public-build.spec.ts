import { expect, test } from '@playwright/test'

test.skip(!process.env.PUBLIC_BUILD_SMOKE, 'runs only against the public Vercel build')

test('public build never advertises the private voice workflow', async ({ page }) => {
  const voiceRequests: string[] = []
  page.on('request', request => {
    if (request.url().includes('/api/voice/')) voiceRequests.push(request.url())
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/#create')
  await expect(page.getByRole('button', { name: 'Commencer le récit du soir' })).toHaveCount(0)
  await expect(page.getByText('Le récit vocal est réservé à l’accès privé pour le moment.')).toBeVisible()
  await expect(page.getByLabel('Souvenirs de la journée')).toBeEnabled()
  await page.getByLabel('Souvenirs de la journée').fill('Une promenade au bord de l’eau.')
  await page.getByRole('button', { name: 'Générer le récit' }).click()
  await expect(page.getByLabel('Votre récit, à votre façon')).toHaveValue(/promenade au bord de l’eau/)
  expect(voiceRequests).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
})
