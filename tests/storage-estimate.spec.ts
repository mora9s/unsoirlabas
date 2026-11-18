import { expect, test } from '@playwright/test'

test('affiche une estimation du stockage local et rappelle que ce n’est pas une sauvegarde', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { estimate: async () => ({ usage: 1_572_864, quota: 5_368_709_120 }) },
    })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Outils et sauvegarde du carnet' }).click()
  await expect(page.getByTestId('storage-estimate')).toContainText('1,5 Mo utilisés')
  await expect(page.getByTestId('storage-estimate')).toContainText('5 Go estimés')
  await expect(page.getByTestId('storage-estimate')).toContainText('Ce stockage peut être supprimé par le navigateur')
})
