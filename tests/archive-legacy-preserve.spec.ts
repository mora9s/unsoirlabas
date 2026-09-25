import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { unzipSync, zipSync } from 'fflate'

test('une archive v1 sans carnets personnels conserve ceux déjà présents', async ({ page }, testInfo) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }) })
  await page.goto('/')
  const local = JSON.stringify({ version: 1, journals: [{ tripId: 'kyoto', destination: 'Kyoto', departure: '2027-04-12', chapters: [] }] })
  await page.evaluate(raw => localStorage.setItem('un-soir-la-bas-journals-v1', raw), local)
  await page.reload()
  await page.getByRole('button', { name: 'Outils et sauvegarde du carnet' }).click()
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Sauvegarder dans Drive' }).click()
  const download = await pending
  const current = testInfo.outputPath('courant.zip')
  await download.saveAs(current)
  const files = unzipSync(await readFile(current))
  const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json']))
  manifest.version = 1
  delete manifest.upcoming
  delete manifest.personalJournals
  delete files['personal-journals.json']
  files['manifest.json'] = new TextEncoder().encode(JSON.stringify(manifest))
  await page.getByLabel('Choisir une sauvegarde ZIP').setInputFiles({ name: 'ancienne.zip', mimeType: 'application/zip', buffer: Buffer.from(zipSync(files)) })
  await expect(page.getByText(/carnets multi-voyage.*conservés/i)).toBeVisible()
  const safety = page.waitForEvent('download')
  await page.getByRole('button', { name: /télécharger la copie de sécurité/i }).click()
  await (await safety).saveAs(testInfo.outputPath('securite-ancienne.zip'))
  await page.getByRole('checkbox', { name: /je confirme que la copie de sécurité est téléchargée et vérifiée/i }).check()
  await page.getByRole('button', { name: 'Restaurer ce carnet' }).click()
  expect(await page.evaluate(() => localStorage.getItem('un-soir-la-bas-journals-v1'))).toBe(local)
})
