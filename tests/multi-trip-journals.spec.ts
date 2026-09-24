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
  await page.getByTestId('upcoming-trip').filter({ hasText: destination }).getByRole('button', { name: /^(?:Ouvrir le carnet|Carnet)$/ }).click()
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

test('Partager globalement choisit un chapitre sauvegardé parmi plusieurs voyages, conserve sa source et exporte ses mots', async ({ page }, testInfo) => {
  await seed(page)
  await createChapter(page, 'Un matin à Tokyo', true)
  const tokyoData = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).journals.find((item: { destination: string }) => item.destination === 'Tokyo').chapters[0], journalsKey)
  await page.getByRole('button', { name: 'Le carnet', exact: true }).click()
  await createChapter(page, 'Un soir à Lisbonne')
  const lisbonData = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).journals.find((item: { destination: string }) => item.destination === 'Lisbonne').chapters[0], journalsKey)

  await page.getByRole('button', { name: 'Partager', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Quel chapitre partager/ })).toBeVisible()
  const chooser = page.getByTestId('share-chapter-picker')
  await expect(chooser.getByRole('button', { name: /Un matin à Tokyo/ })).toBeVisible()
  await expect(chooser.getByRole('button', { name: /Un soir à Lisbonne/ })).toBeVisible()
  await expect(chooser.getByRole('button', { name: /Démo · Philippines · Jour 03/ })).toBeVisible()
  await chooser.getByRole('button', { name: /Un matin à Tokyo/ }).click()
  await expect(page).toHaveURL(new RegExp(`#share-trip/${encodeURIComponent('trip-tokyo')}/${encodeURIComponent(tokyoData.id)}$`))
  await page.reload()
  const studio = page.getByTestId('share-studio')
  await expect(studio.getByTestId('story-preview')).toContainText('Un matin à Tokyo')
  await expect(studio.getByTestId('story-preview')).not.toContainText('Un soir à Lisbonne')
  await expect(studio.getByTestId('story-preview').locator('img')).toHaveAttribute('src', tokyoData.media[0].src)
  await expect(page.getByLabel('La légende proposée')).toHaveValue(`Un matin à Tokyo\n\n${story.replace(/\s+/g, ' ')}`)
  await page.evaluate(() => {
    const calls = { texts: [] as string[], images: [] as string[] }
    Object.assign(window, { selectedExportCalls: calls })
    const fillText = CanvasRenderingContext2D.prototype.fillText
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxWidth) { calls.texts.push(text); fillText.call(this, text, x, y, maxWidth) }
    const drawImage = CanvasRenderingContext2D.prototype.drawImage
    CanvasRenderingContext2D.prototype.drawImage = function (image: CanvasImageSource, ...coordinates: number[]) {
      if (image instanceof HTMLImageElement) calls.images.push(image.src)
      return Reflect.apply(drawImage, this, [image, ...coordinates])
    }
  })
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Télécharger', exact: true }).click()
  const download = await pending
  const pngPath = testInfo.outputPath('selected-tokyo.png')
  await download.saveAs(pngPath)
  const png = await readFile(pngPath)
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  expect(png.readUInt32BE(16)).toBe(1080)
  expect(png.readUInt32BE(20)).toBe(1920)
  const decoded = await page.evaluate(dataUrl => new Promise<number[]>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve([image.naturalWidth, image.naturalHeight])
    image.onerror = () => reject(new Error('Export PNG impossible à décoder'))
    image.src = dataUrl
  }), `data:image/png;base64,${png.toString('base64')}`)
  expect(decoded).toEqual([1080, 1920])
  const exportCalls = await page.evaluate(() => (window as unknown as { selectedExportCalls: { texts: string[]; images: string[] } }).selectedExportCalls)
  expect(exportCalls.texts.join(' ')).toContain('Un matin à Tokyo')
  expect(exportCalls.texts.join(' ')).toContain('Le vent frais du matin')
  expect(exportCalls.images).toEqual([tokyoData.media[0].src])
  const route = page.url()
  await page.getByRole('link', { name: 'Retour à cette journée' }).click()
  await expect(page).toHaveURL(/#journey\/trip-tokyo\//)
  await page.goBack()
  await expect(page).toHaveURL(route)
  await page.getByRole('button', { name: 'Partager', exact: true }).click()
  await expect(chooser.getByRole('button', { name: /Un soir à Lisbonne/ })).toBeVisible()
  await chooser.getByRole('button', { name: /Un soir à Lisbonne/ }).click()
  await expect(page).toHaveURL(new RegExp(`#share-trip/trip-lisbon/${encodeURIComponent(lisbonData.id)}$`))
  await expect(page.getByTestId('share-studio').getByTestId('story-preview')).toContainText('Un soir à Lisbonne')
  await expect(page.getByTestId('share-studio').getByTestId('story-preview').locator('img')).toHaveCount(0)
  await expect(page.getByLabel('La légende proposée')).toHaveValue(`Un soir à Lisbonne\n\n${story.replace(/\s+/g, ' ')}`)
  await page.getByRole('button', { name: 'Partager', exact: true }).click()
  await chooser.getByRole('button', { name: /Démo · Philippines · Jour 03/ }).click()
  await expect(page.getByTestId('share-studio').getByText('El Nido · Palawan', { exact: true })).toBeVisible()
})

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
  await page.getByRole('button', { name: 'Outils et sauvegarde du carnet' }).click()
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
  await fresh.getByRole('button', { name: 'Outils et sauvegarde du carnet' }).click()
  await fresh.getByLabel('Choisir une sauvegarde ZIP').setInputFiles(archivePath)
  await expect(fresh.getByRole('heading', { name: 'Restaurer ce carnet ?' })).toBeVisible()
  await expect(fresh.getByRole('heading', { name: 'Restaurer ce carnet ?' }).locator('..')).toContainText('2 carnets')
  expect(await fresh.evaluate(key => localStorage.getItem(key), journalsKey)).toBeNull()
  const safetyPending = fresh.waitForEvent('download')
  await fresh.getByRole('button', { name: /télécharger la copie de sécurité/i }).click()
  const safetyDownload = await safetyPending
  await safetyDownload.saveAs(testInfo.outputPath('multi-trip-safety.zip'))
  await fresh.getByRole('checkbox', { name: /je confirme que la copie de sécurité est téléchargée et vérifiée/i }).check()
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
  await page.getByTestId('upcoming-trip').filter({ hasText: 'Tokyo' }).getByRole('button', { name: /^(?:Ouvrir le carnet|Carnet)$/ }).click()
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
  await page.getByTestId('upcoming-trip').filter({ hasText: 'Tokyo' }).getByRole('button', { name: /^(?:Ouvrir le carnet|Carnet)$/ }).click()
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

