import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { unzipSync } from 'fflate'

const upcomingKey = 'un-soir-la-bas-upcoming-v1'
const journalsKey = 'un-soir-la-bas-journals-v1'
const legacyKey = 'philippines-trip'
const trips = [
  { id: 'trip-tokyo', destination: 'Tokyo', departure: '2027-04-12' },
  { id: 'trip-lisbon', destination: 'Lisbonne', departure: '2027-05-03' },
]
const story = 'Le vent frais du matin et le premier café partagé. Ce sont nos souvenirs, sans date ni lieu ajoutés au récit.'

async function seed(page: import('@playwright/test').Page) {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.evaluate(({ upcomingKey, trips }) => localStorage.setItem(upcomingKey, JSON.stringify(trips)), { upcomingKey, trips })
  await page.reload()
}

async function createChapter(page: import('@playwright/test').Page, title: string, withPhoto = false) {
  const destination = title.includes('Tokyo') ? 'Tokyo' : 'Lisbonne'
  await page.getByTestId('upcoming-trip').filter({ hasText: destination }).getByRole('button', { name: 'Carnet', exact: true }).click()
  await page.getByRole('button', { name: new RegExp(`Écrire un chapitre pour ${destination}`) }).click()
  await page.reload()
  await expect(page.locator('[data-testid="creator"]:visible')).toHaveCount(1)
  await page.getByLabel('Le titre de votre journée').fill(title)
  await page.getByLabel('Souvenirs de la journée').fill('Le vent et le café du matin.')
  await page.getByLabel('Votre récit, à votre façon').fill(story)
  if (withPhoto) await page.locator('[aria-label="Importer des photos"]:visible').first().setInputFiles('public/assets/el-nido-bay.jpg')
  await page.getByRole('button', { name: 'Prévisualiser', exact: true }).click()
  await page.getByRole('button', { name: 'Ajouter au voyage' }).click()
  await expect(page.getByTestId('custom-chapter').getByRole('heading', { name: title })).toBeVisible()
}

test('deux voyages ont des carnets indépendants : écriture, reload, édition et partage', async ({ page }) => {
  await seed(page)
  await createChapter(page, 'Un matin à Tokyo', true)
  const tokyoRoute = page.url()
  await page.getByRole('button', { name: 'Le carnet', exact: true }).click()
  await createChapter(page, 'Un soir à Lisbonne')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Un soir à Lisbonne' })).toBeVisible()
  await page.getByRole('button', { name: 'Le carnet', exact: true }).click()
  await page.getByRole('button', { name: /Ouvrir le carnet/ }).first().click()
  await expect(page.getByTestId('trip-journal').locator('h1')).toContainText('Tokyo')
  await expect(page.getByTestId('journal-chapter-card')).toContainText('Un matin à Tokyo')
  await expect(page.getByTestId('journal-chapter-card')).not.toContainText('Lisbonne')
  await page.getByRole('button', { name: 'Lire', exact: true }).click()
  await expect(page).toHaveURL(tokyoRoute)
  await page.getByRole('button', { name: 'Modifier cette journée' }).click()
  await page.getByLabel('Le titre de votre journée').fill('Tokyo, un matin clair')
  await page.getByRole('button', { name: 'Prévisualiser', exact: true }).click()
  await page.getByRole('button', { name: 'Ajouter au voyage' }).click()
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).journals.map((item: { destination: string; chapters: { title: string }[] }) => [item.destination, item.chapters.map(chapter => chapter.title)]), journalsKey)).toEqual([
    ['Lisbonne', ['Un soir à Lisbonne']], ['Tokyo', ['Tokyo, un matin clair']],
  ])
  await page.getByRole('button', { name: 'Préparer le partage' }).click()
  await expect(page.getByTestId('share-studio').getByTestId('story-preview')).toContainText('Tokyo, un matin clair')
  await expect(page.getByTestId('share-studio').getByTestId('story-preview')).not.toContainText('Lisbonne')
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
})

test('migration Philippines non destructive puis archive ZIP restaure les carnets multi-voyage', async ({ page, browser }, testInfo) => {
  await seed(page)
  const legacyRaw = JSON.stringify({ version: 1, drafts: [{ id: 'old-chapter', title: 'Une page historique', memories: 'Le lagon et le vent.', tone: 'Contemplatif', story, media: [], coverId: '', status: 'draft' }] })
  await page.evaluate(({ legacyKey, legacyRaw }) => localStorage.setItem(legacyKey, legacyRaw), { legacyKey, legacyRaw })
  await page.reload()
  await expect(page.getByText('Philippines', { exact: true }).first()).toBeVisible()
  expect(await page.evaluate(key => localStorage.getItem(key), legacyKey)).toBe(legacyRaw)
  await createChapter(page, 'Un matin à Tokyo', true)
  const personalPhoto = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).journals.find((item: { destination: string }) => item.destination === 'Tokyo').chapters[0].media[0].src, journalsKey)
  await page.getByRole('button', { name: 'Le carnet', exact: true }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Sauvegarder dans Drive' }).click()
  const download = await downloadPromise
  const archivePath = testInfo.outputPath('multi-trip.zip')
  await download.saveAs(archivePath)
  const archive = unzipSync(await readFile(archivePath))
  const manifest = JSON.parse(new TextDecoder().decode(archive['manifest.json']))
  expect(manifest.personalJournals.journals.map((item: { destination: string }) => item.destination)).toEqual(['Philippines', 'Tokyo'])
  const freshContext = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const fresh = await freshContext.newPage()
  await fresh.goto('/')
  await fresh.getByLabel('Choisir une sauvegarde ZIP').setInputFiles(archivePath)
  await expect(fresh.getByRole('heading', { name: 'Restaurer ce carnet ?' })).toBeVisible()
  await expect(fresh.getByRole('heading', { name: 'Restaurer ce carnet ?' }).locator('..')).toContainText('2 carnets')
  expect(await fresh.evaluate(key => localStorage.getItem(key), journalsKey)).toBeNull()
  await fresh.getByRole('button', { name: 'Restaurer ce carnet' }).click()
  await expect(fresh.getByRole('status')).toContainText('restaurés')
  const restored = await fresh.evaluate(key => JSON.parse(localStorage.getItem(key)!), journalsKey)
  expect(restored.journals.map((item: { destination: string }) => item.destination)).toEqual(['Philippines', 'Tokyo'])
  expect(restored.journals.find((item: { destination: string }) => item.destination === 'Tokyo').chapters[0].media[0].src).toBe(personalPhoto)
  expect(restored.journals.find((item: { destination: string }) => item.destination === 'Tokyo').chapters[0].media[0].src).toMatch(/^data:image\/jpeg;base64,/)
  await freshContext.close()
})

test('un stockage de carnets corrompu est conservé et empêche un faux succès', async ({ page }) => {
  await seed(page)
  const raw = '{broken journal bytes'
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key: journalsKey, raw })
  await page.getByTestId('upcoming-trip').filter({ hasText: 'Tokyo' }).getByRole('button', { name: 'Carnet', exact: true }).click()
  await page.getByRole('button', { name: /Écrire un chapitre pour Tokyo/ }).click()
  await page.getByLabel('Le titre de votre journée').fill('Une page à conserver')
  await page.getByLabel('Souvenirs de la journée').fill('Le premier café.')
  await page.getByLabel('Votre récit, à votre façon').fill(story)
  await page.getByRole('button', { name: 'Prévisualiser', exact: true }).click()
  await page.getByRole('button', { name: 'Ajouter au voyage' }).click()
  await expect(page.getByRole('alert')).toContainText('ne peuvent pas être lus')
  expect(await page.evaluate(key => localStorage.getItem(key), journalsKey)).toBe(raw)
  await expect(page).toHaveURL(/trip-create\/trip-tokyo$/)
})

test('un quota plein au moment de sauvegarder un chapitre affiche une erreur et garde les données', async ({ page }) => {
  await seed(page)
  await page.getByTestId('upcoming-trip').filter({ hasText: 'Tokyo' }).getByRole('button', { name: 'Carnet', exact: true }).click()
  await page.getByRole('button', { name: /Écrire un chapitre pour Tokyo/ }).click()
  await page.getByLabel('Le titre de votre journée').fill('Une page temporaire')
  await page.getByLabel('Souvenirs de la journée').fill('Le premier café.')
  await page.getByLabel('Votre récit, à votre façon').fill(story)
  await page.evaluate(key => {
    const originalSet = Storage.prototype.setItem
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException('quota', 'QuotaExceededError')
      originalSet.call(this, name, value)
    }
  }, journalsKey)
  await page.getByRole('button', { name: 'Prévisualiser', exact: true }).click()
  await page.getByRole('button', { name: 'Ajouter au voyage' }).click()
  await expect(page.getByRole('alert')).toContainText('stockage est plein')
  expect(await page.evaluate(key => localStorage.getItem(key), journalsKey)).toBeNull()
  await expect(page).toHaveURL(/trip-create\/trip-tokyo$/)
})

