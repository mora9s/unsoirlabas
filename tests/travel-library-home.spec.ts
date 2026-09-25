import { expect, test } from '@playwright/test'

const upcomingKey = 'un-soir-la-bas-upcoming-v1'
const journalsKey = 'un-soir-la-bas-journals-v1'

function dateOffset(offset: number) {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() + offset)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

async function seed(page: import('@playwright/test').Page, trips: unknown[], journals: unknown[] = []) {
  await page.goto('/')
  await page.evaluate(({ upcomingKey, journalsKey, trips, journals }) => {
    localStorage.setItem(upcomingKey, JSON.stringify(trips))
    localStorage.setItem(journalsKey, JSON.stringify({ version: 1, journals }))
  }, { upcomingKey, journalsKey, trips, journals })
  await page.reload()
}

test('home réserve le prochain départ au grand format et compacte les autres destinations', async ({ page }) => {
  await seed(page, [
    { id: 'tokyo', destination: 'Tokyo', departure: dateOffset(8) },
    { id: 'lisbon', destination: 'Lisbonne', departure: dateOffset(20) },
    { id: 'kyoto', destination: 'Kyoto', departure: dateOffset(35) },
  ])
  await expect(page.getByRole('heading', { name: 'Tokyo' }).first()).toBeVisible()
  await expect(page.getByLabel('Autres voyages à venir').getByTestId('upcoming-trip')).toHaveCount(2)
  await expect(page.getByLabel('Autres voyages à venir').getByTestId('upcoming-trip').filter({ hasText: 'Tokyo' })).toHaveCount(0)
  await expect(page.getByText('3 voyages', { exact: true })).toBeVisible()
})

test('voyage terminé unique reste une carte mémoire compacte sur desktop', async ({ page }) => {
  await seed(page, [{ id: 'lisbon', destination: 'Lisbonne', departure: dateOffset(-30), endDate: dateOffset(-20) }])
  await page.setViewportSize({ width: 1440, height: 900 })
  const card = page.getByTestId('past-trip')
  await expect(card).toBeVisible()
  const box = await card.boundingBox()
  expect(box?.height).toBeLessThan(320)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
})

test('préparer un voyage ouvre une boite de dialogue accessible et Escape rend le focus', async ({ page }) => {
  await page.goto('/')
  const opener = page.getByRole('button', { name: /préparer un voyage/i })
  await opener.click()
  const dialog = page.getByRole('dialog', { name: /faire place à l’attente/i })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('Destination')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(opener).toBeFocused()
})

test('demo et sauvegarde sont découverts par navigation dédiée, pas dans la bibliothèque', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Philippines/i })).toHaveCount(0)
  await expect(page.getByTestId('day-card')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /sauvegarder dans drive/i })).toHaveCount(0)
  await page.getByRole('button', { name: 'Outils et sauvegarde du carnet' }).click()
  await expect(page).toHaveURL(/#tools$/)
  await expect(page.getByRole('button', { name: /sauvegarder dans drive/i })).toBeVisible()
  await page.getByRole('button', { name: 'Mes voyages', exact: true }).click()
  await page.getByRole('link', { name: 'Explorer cet exemple →' }).click()
  await expect(page).toHaveURL(/#visayas$/)
  await expect(page.getByRole('navigation', { name: 'Les vingt journées' }).getByRole('button')).toHaveCount(20)
})

test('les actions et dates de la bibliothèque restent lisibles sur téléphone', async ({ page }) => {
  await seed(page, [
    { id: 'tokyo', destination: 'Tokyo', departure: dateOffset(8) },
    { id: 'lisbon', destination: 'Lisbonne', departure: dateOffset(20) },
    { id: 'memory', destination: 'Porto', departure: dateOffset(-30), endDate: dateOffset(-20) },
  ])
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 })
    const sizes = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.home-create, .trip-card-actions button, .memory-info > p, .memory-info button')].map(element => ({ text: element.textContent?.trim(), size: parseFloat(getComputedStyle(element).fontSize) })))
    expect(sizes.length).toBeGreaterThan(5)
    expect(sizes.every(item => item.size >= 14), JSON.stringify(sizes)).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
  }
})

test('première visite propose une seule action de création', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: /préparer un voyage/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /créer|raconter ma journée/i })).toHaveCount(1)
  await expect(page.getByRole('button', { name: /préparer un voyage/i })).toHaveCount(1)
})
