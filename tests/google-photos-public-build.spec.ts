import { expect, test } from '@playwright/test'

const albumUrl = 'https://photos.app.goo.gl/y4cpr6M1oJZZHwro7'

test.skip(!process.env.PUBLIC_BUILD_SMOKE, 'requires the Vercel public production build')

test('configured Vercel build keeps the Google Photos Picker available', async ({ page }) => {
  test.skip(!process.env.PUBLIC_BUILD_CONFIGURED_SMOKE, 'requires a public build with the public OAuth client ID')
  await page.goto('/#create')

  await expect(page.getByRole('button', { name: 'Choisir dans Google Photos' })).toBeEnabled()
  await expect(page.getByRole('heading', { name: 'Ajoutez vos photos au carnet' })).toHaveCount(0)
})

test('unconfigured Vercel build offers the shared album and local upload, not a disabled Picker', async ({ page }) => {
  await page.goto('/#create')

  await expect(page.getByRole('link', { name: 'Ouvrir l’album' })).toHaveAttribute('href', albumUrl)
  await expect(page.getByRole('heading', { name: 'Ajoutez vos photos au carnet' })).toBeVisible()
  await expect(page.getByText(/n’est pas configuré sur cette version publique/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Choisir dans Google Photos' })).toHaveCount(0)
  await expect(page.getByLabel('Importer des photos')).toBeEnabled()
})
