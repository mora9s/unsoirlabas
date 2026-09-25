import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

const trip = { id: 'motion-test', destination: 'De la Riviera aux Philippines', departure: '2027-04-12', plan: { ideas: [], notes: '', stops: [
  { id: 'nice', place: 'Nice', point: { lat: 43.7031, lon: 7.2661 } },
  { id: 'cebu', place: 'Cebu', point: { lat: 10.3157, lon: 123.8854 }, transport: 'plane', chapterId: 'lagon' },
  { id: 'bohol', place: 'Bohol', point: { lat: 9.6496, lon: 123.8556 }, transport: 'boat' },
] } }
async function seed(page: import('@playwright/test').Page, value: unknown = trip) {
  await page.goto('/')
  const photo = readFileSync('public/assets/el-nido-big-lagoon.jpg').toString('base64')
  await page.evaluate(({ value, photo }) => {
    localStorage.setItem('un-soir-la-bas-upcoming-v1', JSON.stringify([value]))
    localStorage.setItem('un-soir-la-bas-journals-v1', JSON.stringify({ version: 1, journals: [{ tripId: 'motion-test', destination: 'De la Riviera aux Philippines', departure: '2027-04-12', chapters: [{ id: 'lagon', title: 'Nos premiers lagons', story: 'Un beau souvenir.', memories: '', tone: 'Aventure', status: 'draft', coverId: 'photo', media: [{ id: 'photo', name: 'Le lagon', src: `data:image/jpeg;base64,${photo}` }] }] }] }))
  }, { value, photo })
}

test('globe original, progression, photos à l’arrivée, carte et retour au bon chapitre', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
  await seed(page); await page.goto('/#motion/motion-test')
  await expect(page.getByRole('button', { name: 'Lancer le voyage' })).toBeEnabled({ timeout: 20000 })
  await page.getByRole('slider').fill('480')
  await page.screenshot({ path: test.info().outputPath('voyage-desktop.png'), fullPage: true })
  await page.getByRole('button', { name: 'Voir l’arrivée' }).click()
  await expect(page.getByTestId('journey-arrival').getByRole('img', { name: 'Le lagon' })).toBeVisible()
  await page.getByRole('button', { name: 'Carte des étapes' }).click()
  await expect(page.getByRole('status')).toContainText('Vue d’ensemble')
  await page.getByRole('button', { name: /Bateau · Voir le trajet/ }).click()
  await expect(page.getByRole('status')).toContainText('voies maritimes')
  await page.getByRole('button', { name: /Avion · Voir le trajet/ }).click()
  await expect(page.getByRole('button', { name: 'Voir l’arrivée' })).toBeEnabled()
  await page.getByRole('button', { name: 'Voir l’arrivée' }).click()
  await page.getByRole('link', { name: /Nos premiers lagons/ }).click()
  await expect(page).toHaveURL(/#journey\/motion-test\/lagon/)
  expect(errors).toEqual([])
})

test('lecture complète enchaîne les trajets et s’arrête à la dernière arrivée', async ({ page }) => {
  test.setTimeout(65000)
  await seed(page); await page.goto('/#motion/motion-test')
  await expect(page.getByRole('button', { name: 'Lancer le voyage' })).toBeEnabled({ timeout: 20000 })
  await page.getByRole('button', { name: 'Lancer le voyage' }).click()
  await expect(page.getByRole('status')).toContainText('voies maritimes', { timeout: 24000 })
  await expect(page.getByRole('button', { name: 'Revoir mon voyage' })).toBeVisible({ timeout: 24000 })
  await expect(page.getByTestId('journey-arrival').getByRole('heading')).toHaveText('Bohol')
})

test('localisation GPS, transport train et chapitre persistent après rechargement', async ({ page }) => {
  await seed(page, { ...trip, plan: { ...trip.plan, stops: trip.plan.stops.map(s => ({ id: s.id, place: s.place })) } })
  await page.goto('/#plan/motion-test')
  const details = page.locator('details').nth(1)
  await details.locator('summary').click()
  await details.getByLabel('Coordonnées GPS de Cebu').fill('10.3157, 123.8854')
  await details.getByRole('button', { name: 'Valider les coordonnées' }).click()
  await details.getByLabel('Transport vers Cebu').selectOption('train')
  await details.getByLabel('Souvenirs à Cebu').selectOption('lagon')
  await page.reload()
  await expect(page.locator('details').nth(1).locator('summary')).toContainText('Lieu repéré · Train')
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('un-soir-la-bas-upcoming-v1')!)[0].plan.stops[1])
  expect(saved).toMatchObject({ point: { lat: 10.3157, lon: 123.8854 }, transport: 'train', chapterId: 'lagon' })
})

test('échec routier explicite et repli illustré volontaire', async ({ page }) => {
  await page.route('https://routing.openstreetmap.de/**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 'NoRoute' }) }))
  await seed(page, { ...trip, plan: { ...trip.plan, stops: [trip.plan.stops[0], { ...trip.plan.stops[1], transport: 'car' }] } })
  await page.goto('/#motion/motion-test')
  await expect(page.getByRole('alert')).toContainText('Aucun itinéraire', { timeout: 20000 })
  await expect(page.getByRole('button', { name: 'Lancer le voyage' })).toBeDisabled()
  await page.getByRole('button', { name: 'Utiliser une liaison illustrée' }).click()
  await expect(page.getByRole('status')).toContainText('aucun itinéraire routier calculé')
  await expect(page.getByRole('button', { name: 'Lancer le voyage' })).toBeEnabled()
})

test('mobile, train illustré et mouvements réduits', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ reducedMotion: 'reduce' })
  await seed(page, { ...trip, plan: { ...trip.plan, stops: [trip.plan.stops[0], { ...trip.plan.stops[1], transport: 'train' }] } })
  await page.goto('/#motion/motion-test')
  await expect(page.locator('.journey-description')).toContainText('voies ferrées', { timeout: 20000 })
  await expect(page.getByRole('button', { name: 'Lancer le voyage' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Voir l’arrivée' }).click()
  await page.screenshot({ path: test.info().outputPath('voyage-mobile.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
})

test('une étape sans position bloque le film sans inventer de liaison', async ({ page }) => {
  await seed(page, { ...trip, plan: { ...trip.plan, stops: [trip.plan.stops[0], { id: 'unknown', place: 'Mon hôtel', transport: 'walk' }, trip.plan.stops[2]] } })
  await page.goto('/#motion/motion-test')
  await expect(page.getByText('1 lieu(x) à situer.')).toBeVisible()
  await expect(page.locator('iframe')).toHaveCount(0)
})
