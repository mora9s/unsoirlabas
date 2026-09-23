import { expect, test } from '@playwright/test'

const consoleErrors: string[] = []

test.beforeEach(async ({ page }) => {
  consoleErrors.length = 0
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => consoleErrors.push(error.message))
  await page.goto('/')
})

test.afterEach(async () => {
  expect(consoleErrors, `Erreurs/warnings console: ${consoleErrors.join('\n')}`).toEqual([])
})

test('accueil éditorial et chapitre complet', async ({ page }) => {
  await expect(page.getByRole('heading', { name: /Philippines/i }).first()).toBeVisible()
  const cards = page.getByTestId('day-card')
  await expect(cards).toHaveCount(3)
  await expect(page.locator('[data-testid="day-card"][data-status="published"]')).toHaveCount(1)
  await expect(page.locator('[data-testid="day-card"][data-status="draft"]')).toHaveCount(1)
  await expect(page.locator('[data-testid="day-card"][data-status="upcoming"]')).toHaveCount(1)

  await page.getByRole('button', { name: 'Découvrir le jour 3' }).click()
  const detail = page.getByTestId('day-detail')
  await expect(detail).toBeVisible()
  await expect(detail.getByRole('heading', { name: /Entre lagons et falaises à El Nido/i })).toBeVisible()
  await expect(detail.locator('img')).toHaveCount(7)
  await expect(detail.locator('video[controls]')).toHaveCount(1)
  await expect(detail.getByText(/Big Lagoon|Bacuit|El Nido/i).first()).toBeVisible()
})

test('atelier fonctionnel, prévisualisation et persistance', async ({ page }) => {
  await page.getByRole('button', { name: 'Créer', exact: true }).click()
  const creator = page.getByTestId('creator')
  await expect(creator).toBeVisible()

  const input = creator.locator('input[type="file"]')
  await input.setInputFiles([
    'public/assets/el-nido-big-lagoon.jpg',
    'public/assets/el-nido-bay.jpg',
  ])
  await expect(creator.getByTestId('media-item')).toHaveCount(2)

  await creator.getByLabel('Souvenirs de la journée').fill('Kayak au lever du jour, eau turquoise et déjeuner sur le bateau.')
  await creator.getByLabel('Aventure').check()
  await creator.getByRole('button', { name: 'Générer le récit' }).click()
  const story = creator.locator('textarea')
  await expect(story).not.toHaveValue('')
  await expect(story).toHaveValue(/kayak|turquoise|bateau/i)

  await creator.getByRole('button', { name: 'Prévisualiser' }).click()
  await expect(creator.getByTestId('day-preview')).toBeVisible()
  await creator.getByRole('button', { name: 'Ajouter au voyage' }).click()
  await expect(creator.getByText(/ajoutée au voyage/i)).toBeVisible()
  const persisted = await page.evaluate(() => localStorage.getItem('philippines-trip'))
  expect(persisted).toBeTruthy()
})

test('studio social, presse-papiers et téléchargement', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.getByRole('button', { name: 'Partager', exact: true }).click()
  await page.getByTestId('share-chapter-picker').getByRole('button', { name: /Démo · Philippines · Jour 03/ }).click()
  const studio = page.getByTestId('share-studio')
  await expect(studio).toBeVisible()
  await expect(studio.getByTestId('story-preview')).toBeVisible()
  await expect(studio.getByTestId('post-preview')).toBeVisible()

  await studio.getByRole('button', { name: 'Copier la légende' }).click()
  const clipboard = await page.evaluate(() => navigator.clipboard.readText())
  expect(clipboard.length).toBeGreaterThan(20)

  const download = page.waitForEvent('download')
  await studio.getByRole('button', { name: 'Télécharger' }).click()
  const file = await download
  expect(await file.suggestedFilename()).toMatch(/\.(svg|html|png|jpg|jpeg)$/i)
})

test('responsive sans débordement ni média cassé', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
  const broken = await page.locator('img').evaluateAll((images) =>
    images.filter((image) => !(image as HTMLImageElement).complete || (image as HTMLImageElement).naturalWidth === 0).length,
  )
  expect(broken).toBe(0)
})
