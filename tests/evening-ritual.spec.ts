import { Buffer } from 'node:buffer'
import { expect, test } from '@playwright/test'

const upcomingKey = 'un-soir-la-bas-upcoming-v1'
const journalsKey = 'un-soir-la-bas-journals-v1'
const trips = [
  { id: 'trip-tokyo', destination: 'Tokyo', departure: '2027-04-12' },
  { id: 'trip-lisbon', destination: 'Lisbonne', departure: '2027-05-03' },
]
const note = 'Le vent frais et le premier café partagé.'
const photos = [
  'public/assets/el-nido-bay.jpg', 'public/assets/el-nido-big-lagoon.jpg',
  'public/assets/el-nido-lagoon.jpg', 'public/assets/bacuit-island.jpg',
]

async function seed(page: import('@playwright/test').Page, width = 390) {
  await page.setViewportSize({ width, height: 844 })
  await page.goto('/')
  await page.evaluate(({ upcomingKey, trips }) => localStorage.setItem(upcomingKey, JSON.stringify(trips)), { upcomingKey, trips })
  await page.reload()
}

async function openRitual(page: import('@playwright/test').Page, destination: string) {
  await page.getByTestId('upcoming-trip').filter({ hasText: destination }).getByRole('button', { name: /^(?:Ouvrir le carnet|Carnet)$/ }).click()
  await page.getByRole('button', { name: new RegExp(`Écrire un chapitre pour ${destination}`) }).click()
}

async function writeAndSave(page: import('@playwright/test').Page, destination: string, text = note) {
  const ritual = page.locator('.evening-ritual')
  await ritual.getByRole('button', { name: 'Écrire quelques lignes' }).click()
  await ritual.getByLabel('Votre texte du soir').fill(text)
  await ritual.getByRole('button', { name: 'Relire la proposition' }).click()
  await expect(ritual.getByTestId('ritual-review')).toContainText(text)
  await ritual.getByRole('button', { name: `Accepter et enregistrer dans ${destination}` }).click()
  await expect(page.getByTestId('custom-chapter')).toContainText(text)
}

test('rituel court garde le voyage choisi, relit le texte local et ne fabrique aucun fait', async ({ page }) => {
  await seed(page)
  await openRitual(page, 'Tokyo')
  const ritual = page.locator('.evening-ritual')
  await expect(ritual.getByRole('heading', { name: 'Le rituel du soir' })).toBeVisible()
  await expect(ritual).toContainText('Tokyo')
  await ritual.getByRole('button', { name: 'Écrire quelques lignes' }).click()
  await ritual.getByLabel('Votre texte du soir').fill(note)
  await ritual.getByRole('button', { name: 'Relire la proposition' }).click()
  await expect(ritual.getByTestId('ritual-review')).toContainText(note)
  await expect(ritual.getByTestId('ritual-review')).not.toContainText('2027-04-12')
  await expect(ritual.getByTestId('ritual-review')).not.toContainText('Lisbonne')
  await ritual.getByRole('button', { name: 'Accepter et enregistrer dans Tokyo' }).click()
  await expect(page.getByTestId('custom-chapter')).toContainText(note)
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).journals, journalsKey)
  expect(saved.find((journal: { destination: string }) => journal.destination === 'Tokyo').chapters).toHaveLength(1)
  expect(saved.map((journal: { destination: string }) => journal.destination)).toEqual(['Tokyo'])
})

test('trois photos maximum au premier récit seulement, les voyages restent isolés', async ({ page }) => {
  await seed(page)
  await openRitual(page, 'Tokyo')
  const ritual = page.locator('.evening-ritual')
  await ritual.getByLabel('Ajouter jusqu’à 3 photos').setInputFiles(photos)
  await expect(ritual.getByTestId('ritual-photo')).toHaveCount(3)
  await expect(ritual.getByRole('status')).toContainText('3 photos ajoutées')
  await writeAndSave(page, 'Tokyo')
  const tokyo = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).journals, journalsKey)
  expect(tokyo.find((journal: { destination: string }) => journal.destination === 'Tokyo').chapters[0].media).toHaveLength(3)
  expect(tokyo.map((journal: { destination: string }) => journal.destination)).toEqual(['Tokyo'])

  await page.getByRole('button', { name: 'Le carnet', exact: true }).click()
  await openRitual(page, 'Tokyo')
  await expect(page.getByTestId('creator')).toBeVisible()
  await page.getByLabel('Importer des photos').setInputFiles(photos)
  await expect(page.getByTestId('media-item')).toHaveCount(4)
  await page.getByRole('button', { name: 'Le carnet', exact: true }).click()
  await openRitual(page, 'Lisbonne')
  await expect(page.locator('.evening-ritual')).toContainText('Lisbonne')
  await expect(page.getByTestId('ritual-photo')).toHaveCount(0)
})

test('voix indisponible retombe sur le texte local et le brouillon survit au rechargement', async ({ page }) => {
  await seed(page)
  await page.route('**/api/voice/**', route => route.fulfill({ status: 503, body: 'offline fixture' }))
  await openRitual(page, 'Tokyo')
  const ritual = page.locator('.evening-ritual')
  await ritual.getByRole('button', { name: 'Raconter à voix haute' }).click()
  const voice = page.getByTestId('voice-narration')
  await voice.getByLabel('Importer un enregistrement audio').setInputFiles({ name: 'soir.webm', mimeType: 'audio/webm', buffer: Buffer.from('fixture-only-audio') })
  await voice.getByRole('button', { name: 'Transcrire en français' }).click()
  await expect(voice.getByRole('button', { name: 'Réessayer l’opération' })).toBeVisible()
  await expect(voice.getByText(/en attente/i)).toBeVisible()
  await expect(ritual.getByRole('button', { name: 'Écrire quelques lignes' })).toBeVisible()
  await ritual.getByRole('button', { name: 'Écrire quelques lignes' }).click()
  await ritual.getByLabel('Votre texte du soir').fill(note)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Reprendre votre chapitre ?' })).toBeVisible()
  await page.getByRole('button', { name: 'Reprendre le chapitre' }).click()
  await expect(page.getByLabel('Votre récit, à votre façon')).toHaveValue(note)
})

test('les enregistrements, transcriptions et propositions restent isolés par voyage après navigation et rechargement', async ({ page }) => {
  await seed(page)
  await page.route('**/api/voice/**', route => {
    const url = route.request().url()
    if (url.includes('/jobs/')) return route.fulfill({ json: url.includes('tokyo-draft') ? { status: 'completed', result: { transcriptVersion: 1, title: 'TOKYO_PROPOSAL_SECRET', paragraphs: [{ text: 'TOKYO_PROPOSAL_SECRET', supportingSegmentIds: ['tokyo-segment'] }] } } : { status: 'completed', result: { segments: [{ id: 'tokyo-segment', start: 0, end: 3, text: 'TOKYO_TRANSCRIPT_SECRET' }] } } })
    if (url.endsWith('/transcriptions')) return route.fulfill({ status: 202, json: { jobId: 'tokyo-job' } })
    if (url.endsWith('/drafts')) return route.fulfill({ status: 202, json: { jobId: 'tokyo-draft' } })
    return route.fulfill({ json: {} })
  })
  await openRitual(page, 'Tokyo')
  await page.locator('.evening-ritual').getByRole('button', { name: 'Raconter à voix haute' }).click()
  const tokyoVoice = page.getByTestId('voice-narration')
  await tokyoVoice.getByLabel('Importer un enregistrement audio').setInputFiles({ name: 'tokyo.webm', mimeType: 'audio/webm', buffer: Buffer.from('tokyo-private-audio') })
  await tokyoVoice.getByRole('button', { name: 'Transcrire en français' }).click()
  await expect(tokyoVoice.getByLabel('Votre transcription')).toHaveValue('TOKYO_TRANSCRIPT_SECRET')
  await tokyoVoice.getByRole('button', { name: 'Écrire une proposition avec l’IA' }).click()
  await expect(tokyoVoice.getByLabel('Titre proposé')).toHaveValue('TOKYO_PROPOSAL_SECRET')

  await page.getByRole('button', { name: 'Le carnet', exact: true }).click()
  await openRitual(page, 'Lisbonne')
  await page.locator('.evening-ritual').getByRole('button', { name: 'Raconter à voix haute' }).click()
  const lisbonVoice = page.getByTestId('voice-narration')
  await expect(lisbonVoice.getByText('Audio conservé sur cet appareil', { exact: true })).toHaveCount(0)
  await expect(lisbonVoice.getByLabel('Votre transcription')).toHaveCount(0)
  await expect(lisbonVoice.getByText('TOKYO_PROPOSAL_SECRET')).toHaveCount(0)
  await page.reload()
  await page.locator('.evening-ritual').getByRole('button', { name: 'Raconter à voix haute' }).click()
  await expect(page.getByTestId('voice-narration').getByText('TOKYO_TRANSCRIPT_SECRET')).toHaveCount(0)

  await page.getByRole('button', { name: 'Le carnet', exact: true }).click()
  await openRitual(page, 'Tokyo')
  await page.locator('.evening-ritual').getByRole('button', { name: 'Raconter à voix haute' }).click()
  await expect(page.getByTestId('voice-narration').getByLabel('Votre transcription')).toHaveValue('TOKYO_TRANSCRIPT_SECRET')
  await expect(page.getByTestId('voice-narration').getByLabel('Titre proposé')).toHaveValue('TOKYO_PROPOSAL_SECRET')
})

test('un changement de voyage pendant une requête vocale active ne rattache pas son résultat au suivant', async ({ page }) => {
  await seed(page)
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/voice/health', async route => { await pending; await route.fulfill({ json: { ok: true } }) })
  await page.route('**/api/voice/**', route => route.fulfill({ json: { status: 'completed', result: { segments: [{ id: 'late', start: 0, end: 1, text: 'LATE_TOKYO_SECRET' }] } } }))
  await openRitual(page, 'Tokyo')
  await page.locator('.evening-ritual').getByRole('button', { name: 'Raconter à voix haute' }).click()
  const voice = page.getByTestId('voice-narration')
  await voice.getByLabel('Importer un enregistrement audio').setInputFiles({ name: 'tokyo.webm', mimeType: 'audio/webm', buffer: Buffer.from('active-tokyo-audio') })
  await voice.getByRole('button', { name: 'Transcrire en français' }).click()
  await page.getByRole('button', { name: 'Le carnet', exact: true }).click()
  await openRitual(page, 'Lisbonne')
  release()
  await expect(page.getByTestId('voice-narration').getByText('LATE_TOKYO_SECRET')).toHaveCount(0)
  await expect(page.getByTestId('voice-narration').getByLabel('Votre transcription')).toHaveCount(0)
})

test('l’atelier complet retrouve la limite historique de douze photos après le rituel', async ({ page }) => {
  await seed(page)
  await openRitual(page, 'Tokyo')
  await page.getByRole('button', { name: 'Ouvrir l’atelier complet' }).click()
  await expect(page.getByLabel('Importer des photos')).toBeEnabled()
  await page.getByLabel('Importer des photos').setInputFiles(photos)
  await expect(page.getByTestId('media-item')).toHaveCount(4)
  await expect(page.getByText(/12 photos maximum/)).toBeVisible()
})

test('les imports verrouillent la saisie concurrente et la sauvegarde jusqu’à leur fin', async ({ page }) => {
  await page.addInitScript(() => {
    const decode = HTMLImageElement.prototype.decode
    HTMLImageElement.prototype.decode = function () {
      if (this.src.startsWith('blob:')) return new Promise<void>(resolve => { (window as Window & { __releaseImageDecode?: () => void }).__releaseImageDecode = resolve })
      return decode.call(this)
    }
  })
  await seed(page)
  await openRitual(page, 'Tokyo')
  await page.getByRole('button', { name: 'Ouvrir l’atelier complet' }).click()
  await page.getByLabel('Souvenirs de la journée').fill('Import en cours')
  await page.locator('#story').fill('Import en cours')
  await page.getByRole('button', { name: 'Prévisualiser' }).click()
  await page.getByLabel('Importer des photos').setInputFiles(photos.slice(0, 1))
  await expect.poll(() => page.evaluate(() => Boolean((window as Window & { __releaseImageDecode?: () => void }).__releaseImageDecode))).toBe(true)
  await expect(page.getByLabel('Importer des photos')).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Ajouter au voyage' })).toBeDisabled()
  await page.evaluate(() => (window as Window & { __releaseImageDecode?: () => void }).__releaseImageDecode?.())
  await expect(page.getByTestId('media-item')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Ajouter au voyage' })).toBeEnabled()
})

test('captures responsive sans erreurs console sur le rituel de chaque voyage', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  for (const width of [320, 390, 1440]) {
    await seed(page, width)
    await openRitual(page, width === 1440 ? 'Lisbonne' : 'Tokyo')
    await expect(page.locator('.evening-ritual')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), `horizontal overflow at ${width}px`).toBe(false)
    await page.screenshot({ path: testInfo.outputPath(`evening-ritual-${width}.png`), fullPage: true })
  }
  expect(errors).toEqual([])
})
