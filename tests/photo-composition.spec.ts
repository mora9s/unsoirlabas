/// <reference types="node" />
import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { unzipSync } from 'fflate'
import { proposePhotoComposition } from '../src/photo-composition'
import type { Media } from '../src/journal'

const photo = (id: string, src: string, width: number, height: number): Media => ({ id, name: `${id}.jpg`, src, width, height })

test('composition does not mutate either journey source, and a portrait can win when landscape data is unavailable', () => {
  const tokyo = [photo('tokyo-portrait', 'data:image/jpeg;base64,TOKYO', 500, 900)]
  const lisbon = [photo('lisbon-wide', 'data:image/jpeg;base64,LISBON', 900, 500)]
  const tokyoBefore = structuredClone(tokyo)
  const lisbonBefore = structuredClone(lisbon)
  expect(proposePhotoComposition(tokyo).coverId).toBe('tokyo-portrait')
  expect(proposePhotoComposition(lisbon).coverId).toBe('lisbon-wide')
  expect(tokyo).toEqual(tokyoBefore)
  expect(lisbon).toEqual(lisbonBefore)
})

test('composition deterministically prefers landscape dimensions and keeps exact duplicate bytes informational', () => {
  const proposal = proposePhotoComposition([
    photo('portrait', 'data:image/jpeg;base64,AAAA', 600, 1000),
    photo('wide', 'data:image/jpeg;base64,BBBB', 1200, 800),
    photo('same-bytes', 'data:image/jpeg;base64,AAAA', 600, 1000),
  ])
  expect(proposal.coverId).toBe('wide')
  expect(proposal.mediaIds).toEqual(['wide', 'portrait', 'same-bytes'])
  expect(proposal.duplicateGroups).toEqual([['portrait', 'same-bytes']])
  const storedProposal = proposePhotoComposition([
    photo('stored-a', 'blob:journey-one', 1200, 800),
    photo('stored-b', 'blob:journey-two', 1200, 800),
    photo('stored-c', 'blob:other-bytes', 1200, 800),
  ], new Map([['stored-a', new Uint8Array([1, 2, 3])], ['stored-b', new Uint8Array([1, 2, 3])], ['stored-c', new Uint8Array([1, 2, 4])]]))
  expect(storedProposal.duplicateGroups).toEqual([['stored-a', 'stored-b']])
  expect(proposePhotoComposition([])).toEqual({ coverId: '', mediaIds: [], duplicateGroups: [] })
})

test('composition cancellation leaves imported source unchanged; accepting preserves duplicates and stable IDs', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/#create')
  const creator = page.getByTestId('creator')
  const picker = creator.locator('input[type="file"]')
  await picker.setInputFiles(['public/assets/el-nido-big-lagoon.jpg', 'public/assets/el-nido-bay.jpg', 'public/assets/el-nido-bay.jpg'])
  const media = creator.getByTestId('media-item')
  await expect(media).toHaveCount(3)
  const original = await media.evaluateAll(items => items.map(item => ({
    id: item.getAttribute('data-testid') && item.querySelector('img')?.getAttribute('alt'),
    pressed: item.querySelector('[aria-pressed="true"]') !== null,
    name: item.querySelector('img')?.getAttribute('alt'),
  })))
  await creator.getByRole('button', { name: 'Proposer une composition' }).click()
  const proposal = creator.getByTestId('composition-preview')
  await expect(proposal).toContainText('Doublon exact possible')
  await expect(proposal.getByRole('listitem')).toHaveCount(3)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  await page.screenshot({ path: testInfo.outputPath('photo-composition-390.png'), fullPage: true })
  await proposal.getByRole('button', { name: 'Annuler' }).click()
  await expect(media).toHaveCount(3)
  expect(await media.evaluateAll(items => items.map(item => item.querySelector('img')?.getAttribute('alt')))).toEqual(original.map(item => item.name))

  await creator.getByRole('button', { name: 'Proposer une composition' }).click()
  await creator.getByTestId('composition-preview').getByRole('button', { name: 'Accepter cette composition' }).click()
  await expect(media).toHaveCount(3)
  await expect(creator.getByRole('status')).toContainText('Toutes vos photos ont été conservées')
  const accepted = await media.evaluateAll(items => items.map(item => ({ alt: item.querySelector('img')?.getAttribute('alt'), cover: item.querySelector('[aria-pressed="true"]') !== null })))
  expect(accepted).toHaveLength(3)
  expect(accepted.filter(item => item.cover)).toHaveLength(1)
  expect(new Set(accepted.map(item => item.alt)).size).toBeLessThan(3)
  expect(original).toHaveLength(3)

  await creator.getByLabel('Le titre de votre journée').fill('Souvenirs composés')
  await creator.getByLabel('Souvenirs de la journée').fill('Un matin en images.')
  await creator.getByRole('button', { name: 'Générer le récit' }).click()
  await creator.getByRole('button', { name: 'Prévisualiser' }).click()
  await creator.getByRole('button', { name: 'Ajouter au voyage' }).click()
  await expect(page).toHaveURL(/#draft/)
  await page.goto('/')
  await page.getByRole('button', { name: 'Outils et sauvegarde du carnet' }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Sauvegarder dans Drive' }).click()
  const download = await downloadPromise
  const archivePath = testInfo.outputPath('composed-photos.zip')
  await download.saveAs(archivePath)
  const archive = unzipSync(await readFile(archivePath))
  const manifest = JSON.parse(new TextDecoder().decode(archive['manifest.json']))
  const saved = manifest.journal.drafts.find((draft: { title: string }) => draft.title === 'Souvenirs composés')
  expect(saved.media).toHaveLength(3)
  expect(saved.media.map((photo: { name: string }) => photo.name)).toEqual(['el-nido-big-lagoon.jpg', 'el-nido-bay.jpg', 'el-nido-bay.jpg'])
  expect(saved.coverId).toBe(saved.media[0].id)
})
