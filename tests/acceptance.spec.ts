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

test('bibliothèque classe les voyages selon une fin explicite et conserve les anciens enregistrements', async ({ page }) => {
  const today = new Date()
  const iso = (offset: number) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }
  await page.evaluate(({ future, past, today }) => localStorage.setItem('un-soir-la-bas-upcoming-v1', JSON.stringify([
    { id: 'future', destination: 'Kyoto', departure: future },
    { id: 'ended', destination: 'Lisbonne', departure: past, endDate: past },
    { id: 'no-end', destination: 'Népal', departure: past },
    { id: 'ending-today', destination: 'Bohol', departure: past, endDate: today },
  ])), { future: iso(30), past: iso(-30), today: iso(0) })
  await page.reload()
  await expect(page.getByRole('heading', { name: /prochains départs/i })).toBeVisible()
  await expect(page.getByTestId('upcoming-trip')).toHaveCount(3)
  await expect(page.getByTestId('past-trip')).toHaveCount(1)
  await expect(page.getByTestId('past-trip')).toContainText('Lisbonne')
  await expect(page.getByTestId('upcoming-trip').filter({ hasText: 'Népal' })).toBeVisible()
  await expect(page.getByTestId('upcoming-trip').filter({ hasText: 'Bohol' })).toBeVisible()
  await expect(page.getByTestId('upcoming-trip').filter({ hasText: 'Népal' })).not.toContainText('PASSÉ')
})

test('un carnet reste dans les souvenirs et ouvrable après le retrait du voyage à venir', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.setItem('un-soir-la-bas-upcoming-v1', JSON.stringify([{ id: 'retained', destination: 'Osaka', departure: '2027-10-03' }]))
    localStorage.setItem('un-soir-la-bas-journals-v1', JSON.stringify({ version: 1, journals: [{ tripId: 'retained', destination: 'Osaka', departure: '2027-10-03', chapters: [] }] }))
  })
  await page.reload()
  await page.getByRole('button', { name: 'Retirer Osaka' }).click()
  const memory = page.getByTestId('past-trip').filter({ hasText: 'Osaka' })
  await expect(memory).toBeVisible()
  await memory.getByRole('button', { name: /ouvrir le carnet/i }).click()
  await expect(page.getByTestId('trip-journal').getByRole('heading', { name: /Osaka/i })).toBeVisible()
})

test('création accepte une date de fin facultative et rejette une fin antérieure au départ', async ({ page }) => {
  await page.getByRole('button', { name: /préparer un voyage/i }).click()
  const form = page.getByRole('region', { name: /faire place à l’attente/i })
  const future = new Date(Date.now() + 86400000 * 30)
  const start = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`
  const earlier = new Date(future.getTime() - 86400000)
  const endBefore = `${earlier.getFullYear()}-${String(earlier.getMonth() + 1).padStart(2, '0')}-${String(earlier.getDate()).padStart(2, '0')}`
  await form.getByLabel('Destination').fill('Kyoto')
  await form.getByLabel('Date de départ').fill(start)
  await form.getByLabel('Date de fin (facultative)').fill(endBefore)
  await form.getByLabel('Date de fin (facultative)').evaluate((input: HTMLInputElement) => input.removeAttribute('min'))
  await form.getByRole('button', { name: /ajouter au décompte/i }).click()
  await expect(page.getByRole('alert')).toContainText(/fin.*après|fin.*départ/i)
  await form.getByLabel('Date de fin (facultative)').fill('')
  await form.getByRole('button', { name: /ajouter au décompte/i }).click()
  await expect(page.getByTestId('upcoming-trip')).toContainText('Kyoto')
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('un-soir-la-bas-upcoming-v1') || '[]'))
  expect(stored.find((trip: { destination: string }) => trip.destination === 'Kyoto')).not.toHaveProperty('endDate')
})

test('bibliothèque reste lisible sans débordement à 320, 390 et 1440 px', async ({ page }) => {
  const dateOffset = (offset: number) => {
    const date = new Date()
    date.setHours(12, 0, 0, 0)
    date.setDate(date.getDate() + offset)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 960 })
    await page.goto('/')
    await page.evaluate(({ future, old }) => localStorage.setItem('un-soir-la-bas-upcoming-v1', JSON.stringify([
      { id: 'tokyo', destination: 'Kyoto', departure: future },
      { id: 'memories', destination: 'Lisbonne', departure: old, endDate: old },
      { id: 'ongoing', destination: 'Népal', departure: old },
    ])), { future: dateOffset(18), old: dateOffset(-20) })
    await page.reload()
    await expect(page.getByRole('heading', { name: /partir, puis se souvenir/i })).toBeVisible()
    const metrics = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))
    expect(metrics.scroll - metrics.width, `débordement à ${width}px`).toBeLessThanOrEqual(1)
    await page.screenshot({ path: `screenshots/travel-library-${width}.png`, fullPage: false })
  }
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
