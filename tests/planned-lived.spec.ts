import { expect, test } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'
import { unzipSync, zipSync } from 'fflate'

const upcomingKey = 'un-soir-la-bas-upcoming-v1'
const journalsKey = 'un-soir-la-bas-journals-v1'
const trips = [
  { id: 'trip-tokyo', destination: 'Tokyo', departure: '2027-04-12', plan: { ideas: [], stops: [{ id: 'step-garden', place: 'Jardin du Nord', point: {lat:35.68,lon:139.76} }, { id: 'step-river', place: 'Rive du Sud' }], notes: '' } },
  { id: 'trip-lisbon', destination: 'Lisbonne', departure: '2027-05-03', plan: { ideas: [], stops: [{ id: 'step-market', place: 'Marché central' }], notes: '' } },
]

async function seed(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.evaluate(({ upcomingKey, trips }) => localStorage.setItem(upcomingKey, JSON.stringify(trips)), { upcomingKey, trips })
  await page.reload()
}

async function isDetailsOpen(card: import('@playwright/test').Locator) { return card.locator('details').evaluate(node => (node as HTMLDetailsElement).open) }

async function recordStep(page: import('@playwright/test').Page, destination: string, place: string) {
  await page.getByRole('button', { name: new RegExp(`^(Ouvrir la carte de|Carte de) ${destination}$`) }).click()
  await page.getByRole('navigation',{name:'Navigation du voyage'}).getByRole('link',{name:'Programme',exact:true}).click()
  if (!await page.locator('.planner-organize').evaluate(node => (node as HTMLDetailsElement).open)) await page.locator('.planner-organize > summary').click()
  await page.getByRole('button', { name: `Raconter ${place}` }).click()
  await expect(page.getByTestId('planned-step-context')).toContainText(`Étape prévue · ${place}`)
  const ritual = await page.getByRole('heading', { name: 'Le rituel du soir' }).isVisible().catch(() => false)
  if (ritual) {
    await page.getByRole('button', { name: 'Écrire quelques lignes' }).click()
    await expect(page.getByLabel('Votre texte du soir')).toHaveValue('')
    await page.getByLabel('Votre texte du soir').fill(`Nos mots pour ${place}.`)
    await page.getByRole('button', { name: 'Relire la proposition' }).click()
    await expect(page.getByLabel('Titre')).toHaveValue(place)
    await expect(page.getByLabel('Votre récit relu')).toHaveValue(`Nos mots pour ${place}.`)
    await page.getByRole('button', { name: /Accepter et enregistrer dans/ }).click()
  } else {
    await expect(page.getByLabel('Le titre de votre journée')).toHaveValue(place)
    await expect(page.getByLabel('Souvenirs de la journée')).toHaveValue('')
    await expect(page.getByLabel('Votre récit, à votre façon')).toHaveValue('')
    await page.getByLabel('Souvenirs de la journée').fill(`Nos mots pour ${place}.`)
    await page.getByLabel('Votre récit, à votre façon').fill(`Notre récit personnel à ${place}.`)
    await page.getByRole('button', { name: 'Prévisualiser', exact: true }).click()
    await page.getByRole('button', { name: 'Ajouter au voyage' }).click()
  }
  await expect(page.getByTestId('custom-chapter')).toContainText(place)
}

test('le lien prévu/vécu est explicite, stable sur réordre/suppression et indépendant entre voyages', async ({ page }, testInfo) => {
  await seed(page)
  await recordStep(page, 'Tokyo', 'Jardin du Nord')
  await page.screenshot({ path: testInfo.outputPath('planned-lived-chapter.png'), fullPage: true })
  const chapterId = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).journals.find((journal: { tripId: string }) => journal.tripId === 'trip-tokyo').chapters[0].id, journalsKey)
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).journals.find((journal: { tripId: string }) => journal.tripId === 'trip-tokyo').chapters[0].plannedStep, journalsKey)).toEqual({ tripId: 'trip-tokyo', stepId: 'step-garden', place: 'Jardin du Nord' })
  await page.getByRole('button', { name: 'Mes voyages', exact: true }).click()
  await page.getByRole('button', { name: 'Ouvrir la carte de Tokyo' }).click()
  await page.getByRole('navigation',{name:'Navigation du voyage'}).getByRole('link',{name:'Programme',exact:true}).click()
  if (!await page.locator('.planner-organize').evaluate(node => (node as HTMLDetailsElement).open)) await page.locator('.planner-organize > summary').click()
  await page.getByRole('button', { name: 'Monter Rive du Sud' }).click()
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).find((trip: { id: string }) => trip.id === 'trip-tokyo').plan.stops.map((stop: { id: string }) => stop.id).join(','), upcomingKey)).toBe('step-river,step-garden')
  const reordered = await page.evaluate(({ upcomingKey, journalsKey }) => {
    const plan = JSON.parse(localStorage.getItem(upcomingKey)!).find((trip: { id: string }) => trip.id === 'trip-tokyo').plan.stops
    const chapter = JSON.parse(localStorage.getItem(journalsKey)!).journals.find((journal: { tripId: string }) => journal.tripId === 'trip-tokyo').chapters[0]
    return { order: plan.map((stop: { id: string }) => stop.id), link: chapter.plannedStep }
  }, { upcomingKey, journalsKey })
  expect(reordered.order).toEqual(['step-river', 'step-garden'])
  expect(reordered.link).toEqual({ tripId: 'trip-tokyo', stepId: 'step-garden', place: 'Jardin du Nord' })
  await page.getByRole('button', { name: 'Retirer l’étape Jardin du Nord' }).click()
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).find((trip: { id: string }) => trip.id === 'trip-tokyo').plan.stops.length, upcomingKey)).toBe(1)
  const afterRemoval = await page.evaluate(({ upcomingKey, journalsKey }) => {
    const chapter = JSON.parse(localStorage.getItem(journalsKey)!).journals.find((journal: { tripId: string }) => journal.tripId === 'trip-tokyo').chapters[0]
    const plan = JSON.parse(localStorage.getItem(upcomingKey)!).find((trip: { id: string }) => trip.id === 'trip-tokyo').plan.stops
    return { chapter, plan }
  }, { upcomingKey, journalsKey })
  expect(afterRemoval.chapter).toMatchObject({ id: chapterId, plannedStep: { stepId: 'step-garden' } })
  expect(afterRemoval.chapter).not.toHaveProperty('date')
  expect(afterRemoval.plan.map((stop: { id: string }) => stop.id)).toEqual(['step-river'])
  await page.getByRole('button', { name: '← Tous les voyages' }).click()
  await recordStep(page, 'Lisbonne', 'Marché central')
  const journals = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).journals, journalsKey)
  expect(journals.find((journal: { tripId: string }) => journal.tripId === 'trip-tokyo').chapters[0]).toMatchObject({ id: chapterId, plannedStep: { tripId: 'trip-tokyo', stepId: 'step-garden', place: 'Jardin du Nord' } })
  expect(journals.find((journal: { tripId: string }) => journal.tripId === 'trip-lisbon').chapters[0].plannedStep).toEqual({ tripId: 'trip-lisbon', stepId: 'step-market', place: 'Marché central' })
  await page.getByRole('button', { name: 'Mes voyages', exact: true }).click()
  const tokyo = page.getByTestId('upcoming-trip').filter({ hasText: 'Tokyo' })
  if (!await isDetailsOpen(tokyo)) await tokyo.locator('details > summary').click()
  await tokyo.getByRole('button', { name: 'Ouvrir le carnet', exact: true }).click()
  await expect(page.getByTestId('journal-chapter-card').filter({ hasText: 'Jardin du Nord' })).toContainText('Étape prévue retirée du plan')
  await expect(page.getByTestId('journal-chapter-card').filter({ hasText: 'Jardin du Nord' })).toContainText('Jardin du Nord')
})

test('une archive ZIP fraîche restaure le lien prévu/vécu, tandis qu’un chapitre legacy reste compatible', async ({ page, browser }, testInfo) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }) })
  await seed(page)
  await recordStep(page, 'Tokyo', 'Jardin du Nord')
  await page.getByRole('button', { name: 'Mes voyages', exact: true }).click()
  await page.getByRole('button', { name: 'Outils et sauvegarde du carnet' }).click()
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Sauvegarder dans Drive' }).click()
  const download = await pending
  const path = testInfo.outputPath('planned-lived.zip')
  await download.saveAs(path)
  const archive = unzipSync(await readFile(path))
  const manifest = JSON.parse(new TextDecoder().decode(archive['manifest.json']))
  const personal = JSON.parse(new TextDecoder().decode(archive[manifest.personalJournals.path]))
  expect(personal.journals.find((journal: { tripId: string }) => journal.tripId === 'trip-tokyo').chapters[0].plannedStep).toEqual({ tripId: 'trip-tokyo', stepId: 'step-garden', place: 'Jardin du Nord' })

  const roundTripContext = await browser.newContext()
  const roundTrip = await roundTripContext.newPage()
  await roundTrip.goto('/')
  await roundTrip.getByRole('button', { name: 'Outils et sauvegarde du carnet' }).click()
  await roundTrip.getByLabel('Choisir une sauvegarde ZIP').setInputFiles(path)
  const roundTripSafety = roundTrip.waitForEvent('download')
  await roundTrip.getByRole('button', { name: /télécharger la copie de sécurité/i }).click()
  await (await roundTripSafety).saveAs(testInfo.outputPath('planned-lived-roundtrip-safety.zip'))
  await roundTrip.getByRole('checkbox', { name: /je confirme que la copie de sécurité est téléchargée et vérifiée/i }).check()
  await roundTrip.getByRole('button', { name: 'Restaurer ce carnet' }).click()
  await expect(roundTrip.getByRole('status')).toContainText('restaurées sur cet appareil')
  expect(await roundTrip.evaluate(key => JSON.parse(localStorage.getItem(key)!).journals.find((journal: { tripId: string }) => journal.tripId === 'trip-tokyo').chapters[0].plannedStep, journalsKey)).toEqual({ tripId: 'trip-tokyo', stepId: 'step-garden', place: 'Jardin du Nord' })
  await roundTripContext.close()

  // Rebuild an otherwise valid legacy v2 ZIP whose personal chapter has no optional linkage.
  const legacyPayload = structuredClone(personal)
  delete legacyPayload.journals.find((journal: { tripId: string }) => journal.tripId === 'trip-tokyo').chapters[0].plannedStep
  const payloadBytes = new TextEncoder().encode(JSON.stringify(legacyPayload))
  archive['personal-journals.json'] = payloadBytes
  manifest.personalJournals.bytes = payloadBytes.byteLength
  const { sha256 } = await import('@noble/hashes/sha2.js')
  const { bytesToHex } = await import('@noble/hashes/utils.js')
  manifest.personalJournals.sha256 = bytesToHex(sha256(payloadBytes))
  archive['manifest.json'] = new TextEncoder().encode(JSON.stringify(manifest))
  const legacyPath = testInfo.outputPath('planned-lived-legacy.zip')
  await writeFile(legacyPath, zipSync(archive, { level: 0 }))
  const freshContext = await browser.newContext()
  const fresh = await freshContext.newPage()
  await fresh.goto('/')
  await fresh.getByRole('button', { name: 'Outils et sauvegarde du carnet' }).click()
  await fresh.getByLabel('Choisir une sauvegarde ZIP').setInputFiles(legacyPath)
  await expect(fresh.getByRole('heading', { name: 'Restaurer ce carnet ?' })).toBeVisible()
  const safety = fresh.waitForEvent('download')
  await fresh.getByRole('button', { name: /télécharger la copie de sécurité/i }).click()
  await (await safety).saveAs(testInfo.outputPath('planned-lived-safety.zip'))
  await fresh.getByRole('checkbox', { name: /je confirme que la copie de sécurité est téléchargée et vérifiée/i }).check()
  await fresh.getByRole('button', { name: 'Restaurer ce carnet' }).click()
  await expect(fresh.getByRole('status')).toContainText('restaurées sur cet appareil')
  const restored = await fresh.evaluate(key => JSON.parse(localStorage.getItem(key)!), journalsKey)
  expect(restored.journals.find((journal: { tripId: string }) => journal.tripId === 'trip-tokyo').chapters[0]).not.toHaveProperty('plannedStep')
  await freshContext.close()
})


test('Raconter depuis la carte puis retrouver le souvenir sur le marqueur',async({page})=>{
 await seed(page)
 await page.getByRole('button',{name:'Ouvrir la carte de Tokyo'}).click()
 await page.locator('.trip-stop-row').filter({hasText:'Jardin du Nord'}).getByRole('link',{name:/Raconter/}).click()
 await expect(page.getByTestId('planned-step-context')).toContainText('Jardin du Nord')
 await expect(page.getByRole('alert').filter({hasText:/introuvable/i})).toHaveCount(0)
 const ritual=await page.getByRole('heading',{name:'Le rituel du soir'}).isVisible().catch(()=>false)
 if(ritual){await page.getByRole('button',{name:'Écrire quelques lignes'}).click();await page.getByLabel('Votre texte du soir').fill('Un jardin tranquille.');await page.getByRole('button',{name:'Relire la proposition'}).click();await page.getByRole('button',{name:/Accepter et enregistrer dans/}).click()}
 else {await page.getByLabel('Souvenirs de la journée').fill('Un jardin tranquille.');await page.getByLabel('Votre récit, à votre façon').fill('Un jardin tranquille.');await page.getByRole('button',{name:'Prévisualiser',exact:true}).click();await page.getByRole('button',{name:'Ajouter au voyage'}).click()}
 await expect(page.getByTestId('custom-chapter')).toContainText('Jardin du Nord')
 await page.goto('/#explore/trip-tokyo')
 await page.evaluate(key=>{const data=JSON.parse(localStorage.getItem(key)!);data.journals.find((j:{tripId:string})=>j.tripId==='trip-tokyo').chapters[0].plannedStep.tripId='trip-lisbon';localStorage.setItem(key,JSON.stringify(data))},journalsKey)
 await page.reload()
 await expect(page.locator('.trip-stop-row').filter({hasText:'Jardin du Nord'}).getByRole('link',{name:/Raconter/})).toBeVisible()
 await page.evaluate(key=>{const data=JSON.parse(localStorage.getItem(key)!);data.journals.find((j:{tripId:string})=>j.tripId==='trip-tokyo').chapters[0].plannedStep.tripId='trip-tokyo';localStorage.setItem(key,JSON.stringify(data))},journalsKey)
 await page.reload()
 await page.locator('.trip-stop-row').filter({hasText:'Jardin du Nord'}).getByRole('button',{name:/Jardin du Nord/}).click()
 await page.getByRole('region',{name:'Fiche du lieu'}).getByRole('link',{name:'Lire le souvenir'}).click()
 await expect(page.getByTestId('custom-chapter')).toContainText('Jardin du Nord')
})
