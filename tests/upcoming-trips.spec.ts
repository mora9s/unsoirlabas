import { expect, test } from '@playwright/test'

function localDate(offset: number) {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() + offset)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

async function addTrip(page: import('@playwright/test').Page, destination: string, date: string) {
  await page.getByRole('button', { name: 'Préparer un voyage' }).click()
  await page.getByLabel('Destination').fill(destination)
  await page.getByLabel('Date de départ').fill(date)
  await page.getByRole('button', { name: 'Ajouter au décompte' }).click()
}

test('décompte local de plusieurs voyages, tri et rechargement', async ({ page }) => {
  await page.goto('/')
  const section = page.getByTestId('upcoming-trips')
  await expect(section.getByText('Le prochain départ se prépare ici.')).toBeVisible()
  await addTrip(page, 'Kyoto', localDate(15))
  await addTrip(page, 'Lisbonne', localDate(3))
  const cards = section.getByTestId('upcoming-trip')
  await expect(cards).toHaveCount(2)
  await expect(cards.first()).toContainText('Lisbonne')
  await expect(cards.first().locator('.next-count strong')).toHaveText('3')
  await expect(cards.nth(1)).toContainText('J−15')
  await page.reload()
  await expect(cards).toHaveCount(2)
  await expect(cards.first()).toContainText('Lisbonne')
  await section.getByRole('button', { name: 'Modifier Lisbonne' }).click()
  await page.getByLabel('Destination').fill('Porto')
  await page.getByRole('button', { name: 'Enregistrer les modifications' }).click()
  await expect(cards.first()).toContainText('Porto')
  await section.getByRole('button', { name: 'Retirer Kyoto' }).click()
  await expect(cards).toHaveCount(1)
})

test('départ du jour, ancien départ et données corrompues restent honnêtes', async ({ page }) => {
  await page.goto('/')
  await addTrip(page, 'Départ du jour', localDate(0))
  await expect(page.getByTestId('upcoming-trips')).toContainText('C’est le grand départ')
  await page.getByRole('button', { name: 'Préparer un voyage' }).click()
  await page.getByLabel('Destination').fill('Hier')
  await page.getByLabel('Date de départ').fill(localDate(-1))
  await page.getByRole('button', { name: 'Ajouter au décompte' }).click()
  await expect(page.getByTestId('upcoming-trip')).toHaveCount(1)
  await expect(page.getByLabel('Date de départ')).toHaveAttribute('min', localDate(0))
  await page.evaluate(() => localStorage.setItem('un-soir-la-bas-upcoming-v1', '{broken'))
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('décomptes')
  await expect(page.getByTestId('upcoming-trip')).toHaveCount(0)
})

test('décompte sans débordement sur mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await addTrip(page, 'Une destination aux noms très longs et pleins de souvenirs', localDate(45))
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
})
