import { expect, test } from '@playwright/test'

test('le rituel ouvre directement le carnet choisi et conserve le contexte sans inventer le jour', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('un-soir-la-bas-upcoming-v1', JSON.stringify([
    { id: 'kyoto-evening', destination: 'Kyoto', departure: '2027-04-12' },
  ])))
  await page.reload()
  await page.getByTestId('upcoming-trip').filter({ hasText: 'Kyoto' }).getByRole('button', { name: /^(?:Ouvrir le carnet|Carnet)$/ }).click()

  await expect(page.getByTestId('trip-journal')).toContainText('Ce soir à Kyoto, quelques mots et les photos de votre choix suffisent.')
  await page.getByRole('button', { name: 'Écrire un chapitre pour Kyoto' }).click()
  await expect(page.getByLabel('Le titre de votre journée')).toHaveValue('Une nouvelle journée à Kyoto')
  await expect(page.getByRole('button', { name: 'Commencer le récit du soir' })).toBeVisible()
  await expect(page.getByTestId('creator')).toContainText('Carnet de Kyoto')
  await expect(page.getByTestId('creator')).toContainText('Rien n’est enregistré avant votre validation.')
  await page.screenshot({ path: testInfo.outputPath('evening-ritual-mobile.png'), fullPage: true })
})
