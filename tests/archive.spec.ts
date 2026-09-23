/// <reference types="node" />
import { expect, test } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'
import { unzipSync, zipSync } from 'fflate'

const key = 'philippines-trip'
const upcomingKey = 'un-soir-la-bas-upcoming-v1'
const upcoming = [{ id: 'voyage-kyoto', destination: 'Kyoto', departure: '2027-04-12' }]
const photo = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAEf/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9k='
const original = JSON.stringify({ version: 1, drafts: [{ id: 'chapitre-source', title: 'Le départ', memories: 'Un premier café.', tone: 'Spontané', story: 'Le premier matin.', media: [{ id: 'photo-source', name: 'café du matin.jpg', src: photo }], coverId: 'photo-source', status: 'draft' }] })

async function seed(page: import('@playwright/test').Page, raw = original, trips = upcoming) {
  await page.goto('/')
  await page.evaluate(({ key, raw, upcomingKey, trips }) => { localStorage.setItem(key, raw); localStorage.setItem(upcomingKey, JSON.stringify(trips)) }, { key, raw, upcomingKey, trips })
  await page.reload()
}

test('archive ZIP réelle, prévisualisation et restauration explicite', async ({ page, browser }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true })
  })
  await seed(page)
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Sauvegarder dans Drive' }).click()
  const download = await pending
  expect(download.suggestedFilename()).toMatch(/^philippines-carnet-\d{4}-\d{2}-\d{2}-\d{4}\.zip$/)
  const path = testInfo.outputPath('carnet.zip')
  await download.saveAs(path)
  const zip = unzipSync(await readFile(path))
  expect(Object.keys(zip).sort()).toEqual(expect.arrayContaining(['manifest.json', 'media/001-chapitre-source/001-photo-source.jpg']))
  const manifest = JSON.parse(new TextDecoder().decode(zip['manifest.json']))
  expect(manifest).toMatchObject({ product: 'Un soir là-bas', format: 'les-jours-au-large-journal', version: 2, tripId: 'philippines-18-jours', records: 1, media: 1, upcoming: { version: 1, trips: upcoming } })
  expect(manifest.journal.drafts[0].media[0].name).toBe('café du matin.jpg')
  const freshContext = await browser.newContext()
  const fresh = await freshContext.newPage()
  await fresh.goto('/')
  await fresh.getByLabel('Choisir une sauvegarde ZIP').setInputFiles(path)
  await expect(fresh.getByRole('heading', { name: 'Restaurer ce carnet ?' })).toBeVisible()
  await expect(fresh.getByRole('heading', { name: 'Restaurer ce carnet ?' })).toBeFocused()
  expect(await fresh.evaluate(key => localStorage.getItem(key), key)).toBeNull()
  expect(await fresh.evaluate(key => localStorage.getItem(key), upcomingKey)).toBeNull()
  await fresh.getByRole('button', { name: 'Restaurer ce carnet' }).click()
  await expect(fresh.getByRole('status')).toContainText('restaurés')
  const restored = await fresh.evaluate(key => JSON.parse(localStorage.getItem(key)!), key)
  expect(restored.drafts).toHaveLength(1)
  expect(restored.drafts[0]).toMatchObject({ id: 'chapitre-source', title: 'Le départ', memories: 'Un premier café.', tone: 'Spontané', story: 'Le premier matin.', coverId: 'photo-source', status: 'draft' })
  expect(restored.drafts[0].media).toEqual([{ id: 'photo-source', name: 'café du matin.jpg', src: photo }])
  expect(await fresh.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  expect(await fresh.evaluate(key => JSON.parse(localStorage.getItem(key)!), upcomingKey)).toEqual(upcoming)
  await expect(fresh.getByTestId('upcoming-trip')).toContainText('Kyoto')
  await freshContext.close()
})

test('archive invalide ou annulée ne modifie jamais le stockage', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true })
  })
  await seed(page)
  await page.getByLabel('Choisir une sauvegarde ZIP').setInputFiles({ name: 'faux.zip', mimeType: 'application/zip', buffer: Buffer.from('pas une archive') })
  await expect(page.getByRole('alert')).toContainText('ne peut pas être ouverte')
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(original)
  await page.getByLabel('Choisir une sauvegarde ZIP').setInputFiles({ name: 'trop-grand.zip', mimeType: 'application/zip', buffer: Buffer.alloc(25 * 1024 * 1024 + 1) })
  await expect(page.getByRole('alert')).toContainText('moins de 25 Mo')
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(original)
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Sauvegarder dans Drive' }).click()
  const download = await pending
  const path = testInfo.outputPath('annulation.zip')
  await download.saveAs(path)
  const altered = unzipSync(await readFile(path))
  const legacy = unzipSync(await readFile(path))
  const legacyManifest = JSON.parse(new TextDecoder().decode(legacy['manifest.json']))
  legacyManifest.product = 'Les jours au large'
  legacy['manifest.json'] = new TextEncoder().encode(JSON.stringify(legacyManifest))
  const legacyPath = testInfo.outputPath('ancienne-marque.zip')
  await writeFile(legacyPath, zipSync(legacy))
  await page.getByLabel('Choisir une sauvegarde ZIP').setInputFiles(legacyPath)
  await expect(page.getByRole('heading', { name: 'Restaurer ce carnet ?' })).toBeVisible()
  await page.getByRole('button', { name: 'Annuler' }).click()
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(original)
  altered['media/001-chapitre-source/001-photo-source.jpg'][2] ^= 1
  const tamperedPath = testInfo.outputPath('modifie.zip')
  await writeFile(tamperedPath, zipSync(altered))
  await page.getByLabel('Choisir une sauvegarde ZIP').setInputFiles(tamperedPath)
  await expect(page.getByRole('alert')).toContainText('a été modifié')
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(original)
  const unknownFields = unzipSync(await readFile(path))
  const unknownManifest = JSON.parse(new TextDecoder().decode(unknownFields['manifest.json']))
  unknownManifest.journal.drafts[0].unexpected = 'ne doit pas être restauré'
  unknownFields['manifest.json'] = new TextEncoder().encode(JSON.stringify(unknownManifest))
  const unknownPath = testInfo.outputPath('champ-inconnu.zip')
  await writeFile(unknownPath, zipSync(unknownFields))
  await page.getByLabel('Choisir une sauvegarde ZIP').setInputFiles(unknownPath)
  await expect(page.getByRole('alert')).toContainText('champs inconnus')
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(original)
  await page.getByLabel('Choisir une sauvegarde ZIP').setInputFiles(path)
  await expect(page.getByRole('heading', { name: 'Restaurer ce carnet ?' })).toBeVisible()
  await page.getByRole('button', { name: 'Annuler' }).click()
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(original)
})

test('une archive historique sans voyages conserve les décomptes actuels', async ({ page }, testInfo) => {
  await seed(page)
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Sauvegarder dans Drive' }).click()
  const download = await pending
  const generated = testInfo.outputPath('generated.zip')
  await download.saveAs(generated)
  const legacy = unzipSync(await readFile(generated))
  const manifest = JSON.parse(new TextDecoder().decode(legacy['manifest.json']))
  manifest.product = 'Les jours au large'
  manifest.version = 1
  delete manifest.upcoming
  delete manifest.personalJournals
  legacy['manifest.json'] = new TextEncoder().encode(JSON.stringify(manifest))
  const path = testInfo.outputPath('legacy-v1.zip')
  await writeFile(path, zipSync(legacy))

  await page.evaluate(key => localStorage.setItem(key, JSON.stringify({ version: 1, journals: [{ tripId: 'unrelated-trip', destination: 'Oslo', departure: '', chapters: [] }] })), 'un-soir-la-bas-journals-v1')
  await page.getByLabel('Choisir une sauvegarde ZIP').setInputFiles(path)
  await expect(page.getByRole('heading', { name: 'Restaurer ce carnet ?' })).toBeVisible()
  await expect(page.locator('.restore-preview')).toContainText('seront remplacés par aucun carnet multi-voyage')
  await page.getByRole('button', { name: 'Restaurer ce carnet' }).click()
  await expect(page.getByRole('status')).toContainText('restauré')
  expect(await page.evaluate(key => localStorage.getItem(key), upcomingKey)).toBe(JSON.stringify(upcoming))
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).journals.map((item: { destination: string; chapters: { id: string }[] }) => [item.destination, item.chapters.map(chapter => chapter.id)]), 'un-soir-la-bas-journals-v1')).toEqual([['Philippines', ['chapitre-source']]])
})

test('un échec quota sur le second stockage rétablit les deux valeurs exactes', async ({ page }, testInfo) => {
  await seed(page)
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Sauvegarder dans Drive' }).click()
  const download = await pending
  const path = testInfo.outputPath('quota-restore.zip')
  await download.saveAs(path)
  await page.getByLabel('Choisir une sauvegarde ZIP').setInputFiles(path)
  await expect(page.getByRole('heading', { name: 'Restaurer ce carnet ?' })).toBeVisible()
  await page.evaluate(() => {
    const originalSet = Storage.prototype.setItem
    Storage.prototype.setItem = function (name, value) {
      if (name === 'un-soir-la-bas-upcoming-v1' && value !== '[]') throw new DOMException('quota', 'QuotaExceededError')
      originalSet.call(this, name, value)
    }
  })
  await page.getByRole('button', { name: 'Restaurer ce carnet' }).click()
  await expect(page.getByRole('alert')).toContainText('stockage est plein')
  expect(await page.evaluate(({ key, upcomingKey }) => [localStorage.getItem(key), localStorage.getItem(upcomingKey)], { key, upcomingKey })).toEqual([original, JSON.stringify(upcoming)])
})

test('la sauvegarde reste disponible sans Web Crypto sur le réseau local', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'crypto', { value: undefined, configurable: true })
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true })
  })
  await seed(page)
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Sauvegarder dans Drive' }).click()
  const download = await pending
  expect(download.suggestedFilename()).toMatch(/\.zip$/)
  await expect(page.getByRole('status')).toContainText('Archive téléchargée')
})
