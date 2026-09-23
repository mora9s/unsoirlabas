/// <reference types="node" />
import { expect, test } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { unzipSync, zipSync } from 'fflate'

const key = 'philippines-trip'
const upcomingKey = 'un-soir-la-bas-upcoming-v1'
const upcoming = [{ id: 'trip-1', destination: 'Kyoto', departure: '2027-04-12', plan: { ideas: [{ id: 'idea-1', text: 'Visiter le marché Nishiki' }], stops: [{ id: 'stop-1', place: 'Gion', date: '2027-04-13' }], notes: 'Réserver un ryokan.' } }]
const photo = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAEf/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9k='
const original = JSON.stringify({ version: 1, drafts: [{ id: 'chapitre-source', title: 'Le départ', memories: 'Un premier café.', tone: 'Spontané', story: 'Le premier matin.', media: [{ id: 'photo-source', name: 'café du matin.jpg', src: photo }], coverId: 'photo-source', status: 'draft' }] })

async function seed(page: import('@playwright/test').Page, raw = original) {
  await page.goto('/')
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key, raw })
  await page.reload()
}

test('archive ZIP réelle, prévisualisation et restauration explicite', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true })
  })
  await seed(page)
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: upcomingKey, value: upcoming })
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Sauvegarder dans Drive' }).click()
  const download = await pending
  expect(download.suggestedFilename()).toMatch(/^philippines-carnet-\d{4}-\d{2}-\d{2}-\d{4}\.zip$/)
  const path = testInfo.outputPath('carnet.zip')
  await download.saveAs(path)
  const zip = unzipSync(await readFile(path))
  expect(Object.keys(zip).sort()).toEqual(expect.arrayContaining(['manifest.json', 'upcoming.json', 'media/001-chapitre-source/001-photo-source.jpg']))
  expect(JSON.parse(new TextDecoder().decode(zip['upcoming.json']))).toEqual(upcoming)
  const manifest = JSON.parse(new TextDecoder().decode(zip['manifest.json']))
  expect(manifest).toMatchObject({ product: 'Un soir là-bas', format: 'les-jours-au-large-journal', version: 1, tripId: 'philippines-18-jours', records: 1, media: 1, upcoming: { path: 'upcoming.json', bytes: zip['upcoming.json'].byteLength } })
  expect(manifest.journal.drafts[0].media[0].name).toBe('café du matin.jpg')
  await page.evaluate(({ key, upcomingKey }) => {
    localStorage.setItem(key, JSON.stringify({ version: 1, drafts: [] }))
    localStorage.setItem(upcomingKey, JSON.stringify([{ id: 'local-trip', destination: 'Osaka', departure: '2027-05-01' }]))
  }, { key, upcomingKey })
  await page.reload()
  await page.getByLabel('Choisir une sauvegarde ZIP').setInputFiles(path)
  await expect(page.getByRole('heading', { name: 'Restaurer ce carnet ?' })).toBeVisible()
  await expect(page.getByText(/préparatifs de voyage de l’archive remplaceront ceux/)).toContainText('1 voyage')
  await expect(page.getByRole('heading', { name: 'Restaurer ce carnet ?' })).toBeFocused()
  const beforeTrip = await page.evaluate(key => localStorage.getItem(key), key)
  await page.evaluate(key => localStorage.setItem(key, '{invalid-json'), upcomingKey)
  await page.getByRole('button', { name: 'Restaurer ce carnet' }).click()
  await expect(page.getByRole('alert')).toContainText('Les préparatifs déjà enregistrés sont illisibles')
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(beforeTrip)
  expect(await page.evaluate(key => localStorage.getItem(key), upcomingKey)).toBe('{invalid-json')
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: upcomingKey, value: [{ id: 'local-trip', destination: 'Osaka', departure: '2027-05-01' }] })
  const beforeUpcoming = await page.evaluate(key => localStorage.getItem(key), upcomingKey)
  await page.evaluate(() => {
    const originalSetItem = Storage.prototype.setItem
    let failOnce = true
    Object.defineProperty(window, '__restoreOriginalSetItem', { value: originalSetItem, configurable: true })
    Storage.prototype.setItem = function (key, value) {
      if (failOnce && key === 'philippines-trip') { failOnce = false; throw new DOMException('quota', 'QuotaExceededError') }
      return originalSetItem.call(this, key, value)
    }
  })
  await page.getByRole('button', { name: 'Restaurer ce carnet' }).click()
  await expect(page.getByRole('alert')).toContainText('Le carnet et les préparatifs déjà présents n’ont pas été modifiés')
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(beforeTrip)
  expect(await page.evaluate(key => localStorage.getItem(key), upcomingKey)).toBe(beforeUpcoming)
  await page.evaluate(() => { Storage.prototype.setItem = (window as unknown as { __restoreOriginalSetItem: Storage['setItem'] }).__restoreOriginalSetItem })
  await page.getByRole('button', { name: 'Restaurer ce carnet' }).click()
  await expect(page.getByRole('status')).toContainText('Le carnet a été restauré')
  const restored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key)
  expect(restored.drafts).toHaveLength(1)
  expect(restored.drafts[0]).toMatchObject({ id: 'chapitre-source', title: 'Le départ', memories: 'Un premier café.', tone: 'Spontané', story: 'Le premier matin.', coverId: 'photo-source', status: 'draft' })
  expect(restored.drafts[0].media).toEqual([{ id: 'photo-source', name: 'café du matin.jpg', src: photo }])
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), upcomingKey)).toEqual(upcoming)
  await page.reload()
  await page.getByRole('button', { name: 'Planifier Kyoto' }).click()
  await expect(page.getByText('Visiter le marché Nishiki')).toBeVisible()
  await expect(page.getByLabel('Notes de préparation')).toHaveValue('Réserver un ryokan.')
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
})

test('archive invalide ou annulée ne modifie jamais le stockage', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true })
  })
  await seed(page)
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: upcomingKey, value: upcoming })
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
  delete legacyManifest.upcoming
  delete legacy['upcoming.json']
  legacy['manifest.json'] = new TextEncoder().encode(JSON.stringify(legacyManifest))
  const legacyPath = testInfo.outputPath('ancienne-marque.zip')
  await writeFile(legacyPath, zipSync(legacy))
  const localUpcoming = [{ id: 'keep-me', destination: 'Lyon', departure: '2027-06-10' }]
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: upcomingKey, value: localUpcoming })
  await page.getByLabel('Choisir une sauvegarde ZIP').setInputFiles(legacyPath)
  await expect(page.getByRole('heading', { name: 'Restaurer ce carnet ?' })).toBeVisible()
  await expect(page.getByText(/ne contient pas de préparatifs de voyage/)).toContainText('seront conservés')
  await page.getByRole('button', { name: 'Annuler' }).click()
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(original)
  expect(await page.evaluate(key => localStorage.getItem(key), upcomingKey)).toBe(JSON.stringify(localUpcoming))
  await page.getByLabel('Choisir une sauvegarde ZIP').setInputFiles(legacyPath)
  await expect(page.getByRole('heading', { name: 'Restaurer ce carnet ?' })).toBeVisible()
  await page.getByRole('button', { name: 'Restaurer ce carnet' }).click()
  await expect(page.getByRole('status')).toContainText('restauré')
  expect(await page.evaluate(key => localStorage.getItem(key), upcomingKey)).toBe(JSON.stringify(localUpcoming))
  const tripAfterLegacyRestore = await page.evaluate(key => localStorage.getItem(key), key)
  altered['media/001-chapitre-source/001-photo-source.jpg'][2] ^= 1
  const tamperedPath = testInfo.outputPath('modifie.zip')
  await writeFile(tamperedPath, zipSync(altered))
  await page.getByLabel('Choisir une sauvegarde ZIP').setInputFiles(tamperedPath)
  await expect(page.getByRole('alert')).toContainText('a été modifié')
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(tripAfterLegacyRestore)
  const tamperedUpcoming = unzipSync(await readFile(path))
  tamperedUpcoming['upcoming.json'][tamperedUpcoming['upcoming.json'].length - 2] ^= 1
  const tamperedUpcomingPath = testInfo.outputPath('preparatifs-modifies.zip')
  await writeFile(tamperedUpcomingPath, zipSync(tamperedUpcoming))
  await page.getByLabel('Choisir une sauvegarde ZIP').setInputFiles(tamperedUpcomingPath)
  await expect(page.getByRole('alert')).toContainText('collection des prochains voyages a été modifiée')
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(tripAfterLegacyRestore)
  const invalidUpcoming = unzipSync(await readFile(path))
  const invalidTrips = JSON.parse(new TextDecoder().decode(invalidUpcoming['upcoming.json']))
  invalidTrips[0].unknown = true
  invalidUpcoming['upcoming.json'] = new TextEncoder().encode(JSON.stringify(invalidTrips))
  const invalidManifest = JSON.parse(new TextDecoder().decode(invalidUpcoming['manifest.json']))
  invalidManifest.upcoming.bytes = invalidUpcoming['upcoming.json'].byteLength
  invalidManifest.upcoming.sha256 = createHash('sha256').update(invalidUpcoming['upcoming.json']).digest('hex')
  invalidUpcoming['manifest.json'] = new TextEncoder().encode(JSON.stringify(invalidManifest))
  const invalidUpcomingPath = testInfo.outputPath('preparatifs-schema-invalide.zip')
  await writeFile(invalidUpcomingPath, zipSync(invalidUpcoming))
  await page.getByLabel('Choisir une sauvegarde ZIP').setInputFiles(invalidUpcomingPath)
  await expect(page.getByRole('alert')).toContainText('collection des prochains voyages est invalide')
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(tripAfterLegacyRestore)
  const unknownFields = unzipSync(await readFile(path))
  const unknownManifest = JSON.parse(new TextDecoder().decode(unknownFields['manifest.json']))
  unknownManifest.journal.drafts[0].unexpected = 'ne doit pas être restauré'
  unknownFields['manifest.json'] = new TextEncoder().encode(JSON.stringify(unknownManifest))
  const unknownPath = testInfo.outputPath('champ-inconnu.zip')
  await writeFile(unknownPath, zipSync(unknownFields))
  await page.getByLabel('Choisir une sauvegarde ZIP').setInputFiles(unknownPath)
  await expect(page.getByRole('alert')).toContainText('champs inconnus')
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(tripAfterLegacyRestore)
  await page.getByLabel('Choisir une sauvegarde ZIP').setInputFiles(path)
  await expect(page.getByRole('heading', { name: 'Restaurer ce carnet ?' })).toBeVisible()
  await page.getByRole('button', { name: 'Annuler' }).click()
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(tripAfterLegacyRestore)
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
