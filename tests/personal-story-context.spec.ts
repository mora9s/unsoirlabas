import { expect, test } from '@playwright/test'

test('le rituel du premier chapitre garde le voyage sélectionné sans inventer de souvenir', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('un-soir-la-bas-upcoming-v1', JSON.stringify([
    { id: 'kyoto', destination: 'Kyoto', departure: '2027-04-12' },
  ])))
  await page.goto('/#trip-create/kyoto')
  await expect(page.getByRole('heading', { name: 'Le rituel du soir' })).toBeVisible()
  const ritual = page.locator('.evening-ritual')
  await expect(ritual).toContainText('Carnet personnel · Kyoto')
  await expect(ritual).not.toContainText('Philippines')
  await expect(ritual).toContainText('Aucune date ni aucun détail ne seront ajoutés')
  await ritual.getByRole('button', { name: 'Écrire quelques lignes' }).click()
  await ritual.getByLabel('Votre texte du soir').fill('Le temple au matin')
  await ritual.getByRole('button', { name: 'Relire la proposition' }).click()
  await expect(ritual.getByTestId('ritual-review')).toContainText('Le temple au matin')
  await expect(ritual.getByTestId('ritual-review')).toContainText('Kyoto')
  await expect(ritual.getByTestId('ritual-review')).not.toContainText('Philippines')
})
