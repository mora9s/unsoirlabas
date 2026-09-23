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
  await expect(page).toHaveURL(/#trip\//)
  await page.getByLabel('Nouvelle envie').fill('Voir les jardins')
  await page.getByRole('button', { name: 'Ajouter une envie' }).click()
  await page.getByLabel('Nouvelle étape').fill('Arashiyama')
  await page.getByLabel('Date de l’étape').fill(nextDate(31))
  await page.getByRole('button', { name: 'Ajouter une étape' }).click()
  await page.getByLabel('Notes de préparation').fill('Réserver le train.')
  await page.getByLabel('Notes de préparation').blur()
  await page.reload()
  await expect(page.getByText('Voir les jardins')).toBeVisible()
  await expect(page.getByText('Arashiyama')).toBeVisible()
  await expect(page.getByLabel('Notes de préparation')).toHaveValue('Réserver le train.')
  const trips = await page.evaluate(() => JSON.parse(localStorage.getItem('un-soir-la-bas-upcoming-v1') || '[]'))
  expect(trips).toHaveLength(1)
  expect(trips[0].plan.ideas).toHaveLength(1)
  await page.getByRole('button', { name: 'Retirer l’envie Voir les jardins' }).click()
  await page.reload()
  await expect(page.getByText('Voir les jardins')).toHaveCount(0)
})

test('lien inconnu et stockage corrompu préservent les données et montrent une sortie', async ({ page }) => {
  await page.goto('/#trip/inconnu')
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
