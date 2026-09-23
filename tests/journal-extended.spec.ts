/// <reference types="node" />
import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const photos = [
  'public/assets/el-nido-big-lagoon.jpg',
  'public/assets/el-nido-bay.jpg',
  'public/assets/bacuit-island.jpg',
]

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
  test(`toutes les surfaces sans débordement à ${viewport.width} px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const errors: string[] = []
    const externalRequests: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => {
      if (['error', 'warning'].includes(message.type())) errors.push(message.text())
    })
    page.on('request', request => {
      const url = new URL(request.url())
      if (url.protocol.startsWith('http') && url.hostname !== '127.0.0.1') externalRequests.push(url.href)
    })

    for (const route of ['carnet', 'day-3', 'create', 'share', 'day-1', 'day-8']) {
      await page.goto(`/#${route}`)
      await page.waitForLoadState('networkidle')
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
      expect(overflow, route).toBeLessThanOrEqual(1)
      await expect(page.locator('main h1:visible').first()).toBeVisible()
      // Start every lazy image, then poll with a bounded assertion: none is skipped.
      await page.locator('img').evaluateAll(images => images.forEach(image => { (image as HTMLImageElement).loading = 'eager' }))
      await expect.poll(() => page.locator('img').evaluateAll(images => images.every(image => (image as HTMLImageElement).complete)), { timeout: 7_000 }).toBe(true)
      const failures = await page.locator('img').evaluateAll(images => images.filter(image => (image as HTMLImageElement).naturalWidth === 0).length)
      expect(failures, route).toBe(0)
      if (['carnet', 'day-3', 'create', 'share'].includes(route)) {
        await page.screenshot({ path: testInfo.outputPath(`${route}-${viewport.width}.png`), fullPage: true })
      }
    }
    expect(errors).toEqual([])
    expect(externalRequests).toEqual([])
  })
}

test('couverture, ordre, suppression et reprise du brouillon après rechargement', async ({ page }) => {
  await page.goto('/#create')
  const creator = page.getByTestId('creator')
  await creator.locator('input[type="file"]').setInputFiles(photos)
  const items = creator.getByTestId('media-item')
  await expect(items).toHaveCount(3)
  await items.nth(1).getByRole('button', { name: 'Choisir en couverture' }).click()
  await creator.getByRole('button', { name: 'Déplacer el-nido-bay.jpg vers le précédent' }).click()
  await expect(items.first().locator('img')).toHaveAttribute('alt', /el-nido-bay/)
  await expect(items.first().getByRole('button', { name: 'Couverture', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await creator.getByRole('button', { name: 'Supprimer bacuit-island.jpg' }).click()
  await expect(items).toHaveCount(2)
  await creator.getByLabel('Le titre de votre journée').fill('Notre matin sur l’eau')
  await creator.getByLabel('Souvenirs de la journée').fill('Kayak turquoise, déjeuner sur le bateau et pluie au retour.')
  await creator.getByLabel('Aventure', { exact: true }).check()
  await creator.getByRole('button', { name: 'Générer le récit' }).click()
  await expect(creator.getByLabel('Votre récit, à votre façon')).toHaveValue(/pluie au retour/)
  await creator.getByRole('button', { name: 'Prévisualiser' }).click()
  await creator.getByRole('button', { name: 'Ajouter au voyage' }).click()
  await expect(creator.getByText(/ajoutée au voyage/)).toBeVisible()
  await expect(page).toHaveURL(/#draft\//)
  await page.getByRole('button', { name: 'Modifier cette journée' }).click()
  await creator.getByRole('button', { name: 'Prévisualiser' }).click()
  await creator.getByRole('button', { name: 'Ajouter au voyage' }).click()
  await expect(page).toHaveURL(/#draft\//)
  const trip = await page.evaluate(() => JSON.parse(localStorage.getItem('philippines-trip')!))
  expect(trip.drafts).toHaveLength(1)
  expect(trip.drafts[0].media).toHaveLength(2)
  expect(trip.drafts[0].media[0].name).toBe('el-nido-bay.jpg')
  expect(trip.drafts[0].coverId).toBe(trip.drafts[0].media[0].id)
  await page.goto('/#carnet')
  await page.reload()
  await page.getByRole('button', { name: 'Modifier Notre matin sur l’eau', exact: true }).click()
  await expect(creator.getByLabel('Le titre de votre journée')).toHaveValue('Notre matin sur l’eau')
  await expect(items).toHaveCount(2)
  await expect(creator.getByLabel('Votre récit, à votre façon')).toHaveValue(/pluie au retour/)
})

test('navigation clavier, ancres du chapitre et historique', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Aller au contenu' })).toBeFocused()
  await page.getByRole('button', { name: 'Découvrir le jour 3' }).click()
  await page.getByRole('link', { name: 'Les instants', exact: true }).click()
  await expect(page.getByTestId('day-detail')).toBeVisible()
  await page.getByRole('button', { name: /Jour suivant/ }).click()
  await expect(page.getByRole('heading', { name: 'Les collines de Bohol' })).toBeVisible()
  await page.goBack()
  await expect(page.getByTestId('day-detail')).toBeVisible()
})

test('export PNG réellement décodable aux deux formats', async ({ page }, testInfo) => {
  await page.goto('/#share')
  await page.getByTestId('share-chapter-picker').getByRole('button', { name: /Démo · Philippines · Jour 03/ }).click()
  for (const format of ['story', 'post'] as const) {
    await page.getByRole('button', { name: format === 'story' ? 'Story 9:16' : 'Publication / carrousel 4:5', exact: true }).click()
    const pending = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Télécharger', exact: true }).click()
    const download = await pending
    expect(download.suggestedFilename()).toBe(`philippines-jour-03-${format}.png`)
    const path = testInfo.outputPath(`${format}.png`)
    await download.saveAs(path)
    const png = await readFile(path)
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
    expect(png.readUInt32BE(16)).toBe(1080)
    expect(png.readUInt32BE(20)).toBe(format === 'story' ? 1920 : 1350)
    expect(png.length).toBeGreaterThan(10000)
  }
})
