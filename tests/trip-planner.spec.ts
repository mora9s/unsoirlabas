import { expect, test } from '@playwright/test'

function nextDate(days: number) {
  const date = new Date(); date.setHours(12, 0, 0, 0); date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

test('un voyage devient un espace de préparation durable et adressable', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Préparer un voyage' }).click()
  await page.getByLabel('Destination').fill('Kyoto')
  await page.getByLabel('Date de départ').fill(nextDate(30))
  await page.getByRole('button', { name: 'Ajouter au décompte' }).click()
  await page.getByRole('button', { name: 'Planifier Kyoto' }).click()
  await expect(page).toHaveURL(/#plan\//)
  await page.getByLabel('Nouvelle envie').fill('Voir les jardins')
  await page.getByRole('button', { name: 'Ajouter une envie' }).click()
  await page.getByLabel('Nouvelle étape').fill('Arashiyama')
  await page.getByLabel('Date de l’étape').fill(nextDate(31))
  await page.getByRole('button', { name: 'Ajouter une étape' }).click()
  await page.getByLabel('Notes de préparation').fill('Réserver le train.')
  await page.getByLabel('Notes de préparation').blur()
  await page.reload()
  await expect(page.getByText('Voir les jardins')).toBeVisible()
  await expect(page.locator('.planner-panel').getByText('Arashiyama', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Notes de préparation')).toHaveValue('Réserver le train.')
  const trips = await page.evaluate(() => JSON.parse(localStorage.getItem('un-soir-la-bas-upcoming-v1') || '[]'))
  expect(trips).toHaveLength(1)
  expect(trips[0].plan.ideas).toHaveLength(1)
  await page.getByRole('button', { name: 'Retirer l’envie Voir les jardins' }).click()
  await page.reload()
  await expect(page.getByText('Voir les jardins')).toHaveCount(0)
})

test('lien inconnu et stockage corrompu préservent les données et montrent une sortie', async ({ page }) => {
  await page.goto('/#plan/inconnu')
  await expect(page.getByText('Ce voyage est introuvable')).toBeVisible()
  await page.evaluate(() => localStorage.setItem('un-soir-la-bas-upcoming-v1', '{broken'))
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('décomptes')
  expect(await page.evaluate(() => localStorage.getItem('un-soir-la-bas-upcoming-v1'))).toBe('{broken')
})

test('préparation lisible sur téléphone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Préparer un voyage' }).click()
  await page.getByLabel('Destination').fill('Kyoto')
  await page.getByLabel('Date de départ').fill(nextDate(30))
  await page.getByRole('button', { name: 'Ajouter au décompte' }).click()
  await page.getByRole('button', { name: 'Planifier Kyoto' }).click()
  await page.screenshot({ path: test.info().outputPath('planner-mobile.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
})

test('la sauvegarde ZIP transporte le plan et la date de fin sans mélanger les voyages', async ({ page, browser }, testInfo) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }) })
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('un-soir-la-bas-upcoming-v1', JSON.stringify([
    { id: 'kyoto', destination: 'Kyoto', departure: '2027-04-12', endDate: '2027-04-24', plan: { ideas: [], notes: '', stops: [{ id: 'tokyo', place: 'Tokyo', point: { lat: 35.68, lon: 139.69 } }, { id: 'kyoto-stop', place: 'Kyoto', point: { lat: 35.01, lon: 135.76 }, transport: 'train', chapterId: 'future-chapter', date: '2027-04-13', time: '14:30', kind: 'stay', address: 'Kyoto station', booking: 'REF-42', notes: 'Déposer les bagages'  }] } },
    { id: 'lisbonne', destination: 'Lisbonne', departure: '2027-06-01' },
  ])))
  await page.goto('/#plan/kyoto')
  await page.getByLabel('Nouvelle envie').fill('Les jardins')
  await page.getByRole('button', { name: 'Ajouter une envie' }).click()
  await page.getByLabel('Notes de préparation').fill('Train réservé')
  await page.getByRole('button', { name: '← Tous les voyages' }).click()
  await page.getByRole('button', { name: 'Outils et sauvegarde du carnet' }).click()
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Sauvegarder dans Drive' }).click()
  const download = await pending
  const path = testInfo.outputPath('deux-voyages-planifies.zip')
  await download.saveAs(path)
  const context = await browser.newContext()
  const restored = await context.newPage()
  await restored.goto('/')
  await restored.getByRole('button', { name: 'Outils et sauvegarde du carnet' }).click()
  await restored.getByLabel('Choisir une sauvegarde ZIP').setInputFiles(path)
  const safety = restored.waitForEvent('download')
  await restored.getByRole('button', { name: /télécharger la copie de sécurité/i }).click()
  await (await safety).saveAs(testInfo.outputPath('securite-plan.zip'))
  await restored.getByRole('checkbox', { name: /je confirme que la copie de sécurité est téléchargée et vérifiée/i }).check()
  await restored.getByRole('button', { name: 'Restaurer ce carnet' }).click()
  const trips = await restored.evaluate(() => JSON.parse(localStorage.getItem('un-soir-la-bas-upcoming-v1') || '[]'))
  expect(trips).toHaveLength(2)
  expect(trips.find((trip: { id: string }) => trip.id === 'kyoto')).toMatchObject({ endDate: '2027-04-24', plan: { ideas: [{ text: 'Les jardins' }], stops: [{ id: 'tokyo', place: 'Tokyo', point: { lat: 35.68, lon: 139.69 } }, { id: 'kyoto-stop', place: 'Kyoto', point: { lat: 35.01, lon: 135.76 }, transport: 'train', chapterId: 'future-chapter', date: '2027-04-13', time: '14:30', kind: 'stay', address: 'Kyoto station', booking: 'REF-42', notes: 'Déposer les bagages'  }], notes: 'Train réservé' } })
  expect(trips.find((trip: { id: string }) => trip.id === 'lisbonne')).not.toHaveProperty('plan')
  await context.close()
})
