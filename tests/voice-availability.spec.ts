import { expect, test } from '@playwright/test'

test('atelier vocal fidèle au contexte de déploiement', async ({ page }) => {
  const voiceRequests: string[] = []
  const errors: string[] = []
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (request.url().includes('/api/voice/')) voiceRequests.push(request.url()) })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/#create')
  const entry = page.getByRole('button', { name: 'Commencer le récit du soir' })
  const publicBuild = (globalThis as { process?: { env?: Record<string, string> } }).process?.env?.VERCEL === '1'
  if (publicBuild) {
    await expect(entry).toHaveCount(0)
    await expect(page.getByText('Le récit vocal est réservé à l’accès privé pour le moment.')).toBeVisible()
    await expect(page.getByLabel('Souvenirs de la journée')).toBeEnabled()
    await page.getByLabel('Souvenirs de la journée').fill('Une promenade au bord de l’eau.')
    await page.getByRole('button', { name: 'Générer le récit' }).click()
    await expect(page.getByLabel('Votre récit, à votre façon')).toHaveValue(/promenade au bord de l’eau/)
    expect(voiceRequests).toEqual([])
  } else {
    await expect(entry).toBeVisible()
    await expect(page.getByText('Le récit vocal est réservé à l’accès privé pour le moment.')).toHaveCount(0)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
  expect(errors).toEqual([])
})
