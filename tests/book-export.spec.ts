import { expect, test } from '@playwright/test'
import { readFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

const bookOne = {
  tripId: 'trip-a', destination: 'Montréal', departure: '',
  chapters: [
    { id: 'long', title: 'Le matin à Québec', story: ('Été, café, déjà-vu — et l’air salé près du port. '.repeat(85)), memories: '', tone: '', media: [], coverId: '', status: 'draft' },
    { id: 'second', title: 'Les ruelles', story: 'À Montréal, nous avons gardé notre propre récit. 🥐', memories: '', tone: '', media: [], coverId: '', status: 'draft' },
    { id: 'blank', title: 'Une étape future', story: '', memories: '', tone: '', media: [], coverId: '', status: 'draft' },
  ],
}
const bookTwo = { tripId: 'trip-b', destination: 'Lisbonne', departure: '', chapters: [{ id: 'private-b', title: 'Confidentiel Lisbonne', story: 'Ne doit pas apparaître dans le livre Montréal.', memories: '', tone: '', media: [], coverId: '', status: 'draft' }] }
const image = `data:image/jpeg;base64,${(await readFile('public/assets/el-nido-bay.jpg')).toString('base64')}`

async function seed(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.evaluate(({ a, b, image }) => localStorage.setItem('un-soir-la-bas-journals-v1', JSON.stringify({ version: 1, journals: [
    { ...a, chapters: a.chapters.map((chapter, index) => index === 1 ? { ...chapter, media: [{ id: 'photo-1', name: 'baie.jpg', src: image, width: 1400, height: 933 }], coverId: 'photo-1' } : chapter) }, b,
  ] })), { a: bookOne, b: bookTwo, image })
  await page.goto('/#trip/trip-a')
}

test('exports selected journal only, manual order, embedded local photo and paginated French text', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await seed(page)
  await page.getByRole('button', { name: 'Composer le livre PDF' }).click()
  const dialog = page.getByRole('dialog', { name: /Composer le livre de Montréal/ })
  await expect(dialog).toContainText('1 étape sans récit ni photo laissée hors du livre')
  await expect(dialog).not.toContainText('Confidentiel Lisbonne')
  await dialog.getByLabel('Titre de couverture').fill('Notre Québec — été')
  await dialog.getByLabel('Ajouter une photo de couverture (facultatif)').check()
  await dialog.getByRole('combobox').selectOption('photo-1')
  await dialog.getByLabel('Votre conclusion (facultative, écrite par vous)').fill('Conclusion choisie : déjà-vu, café, lumière.')
  await dialog.getByRole('button', { name: 'Monter Les ruelles' }).click()
  const beforeStorage = await page.evaluate(() => localStorage.getItem('un-soir-la-bas-journals-v1'))
  const downloadPromise = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Télécharger le PDF' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('notre-quebec-ete.pdf')
  const output = testInfo.outputPath('personal-book-fixture.pdf')
  await download.saveAs(output)
  await mkdir('evidence', { recursive: true })
  await download.saveAs(path.resolve('evidence/personal-book-fixture.pdf'))
  const pdf = await readFile(output)
  expect(pdf.subarray(0, 8).toString('ascii')).toBe('%PDF-1.4')
  expect(pdf.toString('latin1')).toContain('/Subtype /Image')
  expect(pdf.toString('latin1')).toContain('/Count ')
  expect(await page.evaluate(() => localStorage.getItem('un-soir-la-bas-journals-v1'))).toBe(beforeStorage)
})

test('120-character French single-token cover title is extracted within the page and leaves room for its photo', async ({ page }, testInfo) => {
  const longTitle = 'ÉtéMontréal—Lumière'.repeat(8).slice(0, 120)
  const chapterTitle = 'Récit—Magnifique'.repeat(8).slice(0, 120)
  const image = `data:image/jpeg;base64,${(await readFile('public/assets/el-nido-bay.jpg')).toString('base64')}`
  await page.addInitScript(({ image, chapterTitle }) => localStorage.setItem('un-soir-la-bas-journals-v1', JSON.stringify({ version: 1, journals: [{ tripId: 'trip-long-title', destination: 'Montréal destination très longue qui reste entièrement lisible', departure: '', chapters: [{ id: 'long-title', title: chapterTitle, story: 'Un récit pour vérifier la couverture.', memories: '', tone: '', media: [{ id: 'cover-photo', name: 'baie.jpg', src: image, width: 1400, height: 933 }], coverId: 'cover-photo', status: 'draft' }] }] })), { image, chapterTitle })
  await page.goto('/#trip/trip-long-title')
  await page.getByRole('button', { name: 'Composer le livre PDF' }).click()
  const dialog = page.getByRole('dialog', { name: /Composer le livre/ })
  await dialog.getByLabel('Titre de couverture').fill(longTitle)
  await dialog.getByLabel('Ajouter une photo de couverture (facultatif)').check()
  await dialog.getByRole('combobox').selectOption('cover-photo')
  const downloadPromise = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Télécharger le PDF' }).click()
  const download = await downloadPromise
  const output = testInfo.outputPath('long-title-book.pdf')
  await download.saveAs(output)
  const { execFileSync } = await import('node:child_process')
  const extracted = execFileSync('pdftotext', [output, '-'], { encoding: 'utf8' }).replace(/\s+/g, ' ')
  expect(extracted.replace(/\s/g, '')).toContain(longTitle.replace(/\s/g, ''))
  expect(extracted.replace(/\s/g, '')).toContain(chapterTitle.replace(/\s/g, ''))
  expect(extracted).toContain('Montréal destination très longue qui reste entièrement lisible')
  expect(extracted).not.toContain('Confidentiel Lisbonne')
  const bbox = execFileSync('pdftotext', ['-bbox', output, '-'], { encoding: 'utf8' })
  const titleLines = [...bbox.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]+)<\/word>/g)]
    .filter(([, , , , , word]) => longTitle.includes(word))
  expect(titleLines.length).toBeGreaterThan(1)
  expect(titleLines.every(([, xMin, yMin, xMax, yMax]) => Number(xMin) >= 58 && Number(xMax) <= 537 && Number(yMin) > 0 && Number(yMax) < 842)).toBe(true)
  const pdfSource = (await readFile(output)).toString('latin1')
  const coverPlacement = pdfSource.match(/q ([\d.]+) 0 0 ([\d.]+) ([\d.]+) ([\d.]+) cm \/Im1 Do Q/)
  expect(coverPlacement).not.toBeNull()
  const imageTop = 841.89 - Number(coverPlacement![4]) - Number(coverPlacement![2])
  const lastCoverTextY = Math.max(...titleLines.map(([, , , , yMax]) => Number(yMax)))
  expect(lastCoverTextY).toBeLessThan(imageTop)
})

test('short authored book downloads a compact two-page PDF', async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('un-soir-la-bas-journals-v1', JSON.stringify({ version: 1, journals: [{ tripId: 'trip-short', destination: 'Montréal', departure: '', chapters: [{ id: 'short', title: 'Un soir doux', story: 'La lumière tombe. Nous gardons ces mots.', memories: '', tone: '', media: [], coverId: '', status: 'draft' }] }] })))
  await page.goto('/#trip/trip-short')
  await expect(page.getByTestId('trip-journal')).toContainText('Un soir doux')
  await page.getByRole('button', { name: 'Composer le livre PDF' }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Télécharger le PDF' }).click()
  const download = await downloadPromise
  const output = testInfo.outputPath('short-book.pdf')
  await download.saveAs(output)
  const pdf = (await readFile(output)).toString('latin1')
  expect(pdf.startsWith('%PDF-1.4')).toBe(true)
  expect(pdf).toContain('/Count 2')
})
