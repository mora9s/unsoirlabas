import { expect, test } from '@playwright/test'

const upcomingKey = 'un-soir-la-bas-upcoming-v1'
const journalsKey = 'un-soir-la-bas-journals-v1'
const recoveryKey = 'un-soir-la-bas-unsaved-chapters-v1'
const trips = [
  { id: 'trip-tokyo', destination: 'Tokyo', departure: '2027-04-12' },
  { id: 'trip-lisbon', destination: 'Lisbonne', departure: '2027-05-03' },
]
const story = 'Le vent frais du matin et le premier café partagé. Ce sont nos souvenirs.'

async function openChapterEditor(page: import('@playwright/test').Page, destination: string) {
  await page.getByTestId('upcoming-trip').filter({ hasText: destination }).getByRole('button', { name: /^(?:Ouvrir le carnet|Carnet)$/ }).click()
  await page.getByRole('button', { name: new RegExp(`Écrire un chapitre pour ${destination}`) }).click()
}

async function seed(page: import('@playwright/test').Page) {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.evaluate(({ upcomingKey, trips }) => localStorage.setItem(upcomingKey, JSON.stringify(trips)), { upcomingKey, trips })
  await page.reload()
}

test('recovers a separate unsaved Tokyo chapter after reload and navigation, preserving photos, order, cover and tone', async ({ page }) => {
  await seed(page)
  await openChapterEditor(page, 'Tokyo')
  await page.getByLabel('Le titre de votre journée').fill('Brouillon Tokyo')
  await page.getByLabel('Souvenirs de la journée').fill('Un café sur le port.')
  await page.getByLabel('Aventure', { exact: true }).check()
  await page.getByLabel('Votre récit, à votre façon').fill(story)
  await page.getByLabel('Importer des photos').setInputFiles(['public/assets/el-nido-bay.jpg', 'public/assets/el-nido-big-lagoon.jpg'])
  const items = page.getByTestId('media-item')
  await expect(items).toHaveCount(2)
  await items.nth(1).getByRole('button', { name: 'Choisir en couverture' }).click()
  await items.nth(1).getByRole('button', { name: /Déplacer .* vers le précédent/ }).click()
  await page.getByRole('button', { name: 'Le carnet', exact: true }).click()
  await openChapterEditor(page, 'Tokyo')
  await expect(page.getByRole('heading', { name: 'Reprendre votre chapitre ?' })).toBeVisible()
  await expect(page.getByText('Brouillon Tokyo')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Reprendre votre chapitre ?' })).toBeVisible()
  await page.getByRole('button', { name: 'Reprendre le chapitre' }).click()
  await expect(page.getByLabel('Le titre de votre journée')).toHaveValue('Brouillon Tokyo')
  await expect(page.getByLabel('Aventure', { exact: true })).toBeChecked()
  await expect(items).toHaveCount(2)
  await expect(items.nth(0).getByRole('button', { name: 'Couverture', exact: true })).toHaveAttribute('aria-pressed', 'true')
  const recovered = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), recoveryKey)
  expect(recovered.drafts).toHaveLength(1)
  expect(recovered.drafts[0].scope).toBe('trip:trip-tokyo:new')
  expect(recovered.drafts[0].draft.media.map((photo: { name: string }) => photo.name)).toEqual(['el-nido-big-lagoon.jpg', 'el-nido-bay.jpg'])
  const resumedId = recovered.drafts[0].draft.id
  await page.getByRole('button', { name: 'Prévisualiser', exact: true }).click()
  await page.getByRole('button', { name: 'Ajouter au voyage' }).click()
  await expect(page).toHaveURL(new RegExp(`journey/trip-tokyo/${resumedId}$`))
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).journals[0].chapters[0], journalsKey)
  expect(saved.id).toBe(resumedId)
  expect(saved.media.map((photo: { name: string }) => photo.name)).toEqual(['el-nido-big-lagoon.jpg', 'el-nido-bay.jpg'])
  expect(saved.coverId).toBe(saved.media[0].id)
  expect(await page.evaluate(key => localStorage.getItem(key), recoveryKey)).toBeNull()
})

test('isolates recovery by trip and can explicitly discard without creating a saved chapter', async ({ page }) => {
  await seed(page)
  await openChapterEditor(page, 'Tokyo')
  await page.getByLabel('Le titre de votre journée').fill('Brouillon à garder')
  await page.getByLabel('Votre récit, à votre façon').fill(story)
  await page.getByRole('button', { name: 'Le carnet', exact: true }).click()
  await openChapterEditor(page, 'Lisbonne')
  await expect(page.getByRole('heading', { name: 'Reprendre votre chapitre ?' })).toHaveCount(0)
  await page.getByLabel('Le titre de votre journée').fill('Brouillon Lisbonne')
  await page.getByLabel('Votre récit, à votre façon').fill(story)
  await page.getByRole('button', { name: 'Le carnet', exact: true }).click()
  await openChapterEditor(page, 'Tokyo')
  await expect(page.getByRole('heading', { name: 'Reprendre votre chapitre ?' })).toBeVisible()
  await page.getByRole('button', { name: 'Abandonner ce brouillon' }).click()
  await expect(page.getByRole('heading', { name: 'Reprendre votre chapitre ?' })).toHaveCount(0)
  await expect(page.getByLabel('Le titre de votre journée')).toHaveValue('Une nouvelle journée à Tokyo')
  const saved = await page.evaluate(key => localStorage.getItem(key), journalsKey)
  expect(saved).toBeNull()
  const pending = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).drafts, recoveryKey)
  expect(pending.map((item: { scope: string }) => item.scope)).toEqual(['trip:trip-lisbon:new'])
})

test('recovers edits separately from the saved chapter and does not overwrite it until confirmed save', async ({ page }) => {
  await seed(page)
  await openChapterEditor(page, 'Tokyo')
  await page.getByLabel('Le titre de votre journée').fill('Chapitre enregistré')
  await page.getByLabel('Souvenirs de la journée').fill('Première note.')
  await page.getByLabel('Votre récit, à votre façon').fill(story)
  await page.getByRole('button', { name: 'Prévisualiser', exact: true }).click()
  await page.getByRole('button', { name: 'Ajouter au voyage' }).click()
  await page.getByRole('button', { name: 'Modifier cette journée' }).click()
  await page.getByLabel('Le titre de votre journée').fill('Modification non enregistrée')
  await page.getByLabel('Spontané', { exact: true }).check()
  await page.getByRole('button', { name: 'Le carnet', exact: true }).click()
  await page.getByTestId('upcoming-trip').filter({ hasText: 'Tokyo' }).getByRole('button', { name: /^(?:Ouvrir le carnet|Carnet)$/ }).click()
  await page.getByRole('button', { name: /Modifier/ }).click()
  await expect(page.getByRole('heading', { name: 'Reprendre votre chapitre ?' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Reprendre votre chapitre ?' })).toBeVisible()
  await page.getByRole('button', { name: 'Reprendre le chapitre' }).click()
  await expect(page.getByLabel('Le titre de votre journée')).toHaveValue('Modification non enregistrée')
  const savedTitle = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).journals[0].chapters[0].title, journalsKey)
  expect(savedTitle).toBe('Chapitre enregistré')
})

test('quota or corrupt recovery data never claims persistence or replaces original bytes', async ({ page }) => {
  await seed(page)
  await page.evaluate(key => localStorage.setItem(key, '{broken recovery bytes'), recoveryKey)
  await openChapterEditor(page, 'Tokyo')
  await page.getByLabel('Le titre de votre journée').fill('Données à ne pas perdre')
  await page.getByLabel('Votre récit, à votre façon').fill(story)
  await expect(page.getByRole('alert')).toContainText('brouillons non enregistrés')
  expect(await page.evaluate(key => localStorage.getItem(key), recoveryKey)).toBe('{broken recovery bytes')
  await page.evaluate(key => {
    localStorage.removeItem(key)
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException('quota', 'QuotaExceededError')
      original.call(this, name, value)
    }
  }, recoveryKey)
  await page.getByLabel('Souvenirs de la journée').fill('Une mise à jour après effacement du stockage.')
  await expect(page.getByRole('alert')).toContainText('stockage est plein')
  expect(await page.evaluate(key => localStorage.getItem(key), recoveryKey)).toBeNull()
  await expect(page.getByLabel('Le titre de votre journée')).toHaveValue('Données à ne pas perdre')
})
