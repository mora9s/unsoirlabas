import { expect, test } from '@playwright/test'

test('la journée d’un voyage personnel ne reprend aucun contexte Philippines', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('un-soir-la-bas-upcoming-v1', JSON.stringify([
    { id: 'kyoto', destination: 'Kyoto', departure: '2027-04-12' },
  ])))
  await page.goto('/#trip-create/kyoto')
  await expect(page.getByLabel('Le titre de votre journée')).toHaveValue('Une nouvelle journée à Kyoto')
  await expect(page.getByText('L’album commun', { exact: true })).toHaveCount(0)
  await page.getByLabel('Souvenirs de la journée').fill('Le temple au matin')
  await page.getByRole('button', { name: 'Générer le récit' }).click()
  await expect(page.locator('#story')).toHaveValue(/Le temple au matin/)
  await expect(page.locator('#story')).not.toHaveValue(/Philippines/)
  await page.getByRole('button', { name: 'Prévisualiser' }).click()
  await expect(page.getByTestId('day-preview')).toContainText('Kyoto · Carnet personnel')
  await expect(page.getByTestId('day-preview')).not.toContainText('Philippines')
})
