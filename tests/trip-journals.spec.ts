import { expect, test } from '@playwright/test'

const journalsKey = 'un-soir-la-bas-journals-v1'
const upcomingKey = 'un-soir-la-bas-upcoming-v1'
const legacyKey = 'philippines-trip'

test('personal journals preserve legacy records, trip isolation, edit order, and corruption', async ({ page }) => {
  await page.goto('/')
  const legacyChapter = { id: 'legacy-chapter', title: 'Legacy day', memories: 'Old memories.', tone: 'Spontané', story: 'The original Philippines chapter.', media: [], coverId: '', status: 'draft' }
  await page.evaluate(({ legacyKey, upcomingKey, legacyChapter }) => {
    localStorage.setItem(legacyKey, JSON.stringify({ version: 1, drafts: [legacyChapter] }))
    localStorage.setItem(upcomingKey, JSON.stringify([
      { id: 'kyoto', destination: 'Kyoto', departure: '2027-04-12' },
      { id: 'lisbon', destination: 'Lisbonne', departure: '2027-05-08' },
    ]))
  }, { legacyKey, upcomingKey, legacyChapter })
  await page.goto('/#journal/kyoto')
  await page.getByRole('button', { name: 'Raconter cette journée' }).click()
  await page.getByLabel('Le titre de votre journée').fill('First Kyoto page')
  await page.getByLabel('Souvenirs de la journée').fill('A walk through Gion.')
  await page.locator('#story').fill('A real Kyoto story.')
  await page.getByRole('button', { name: 'Prévisualiser' }).click()
  await page.getByRole('button', { name: 'Ajouter au voyage' }).click()
  await expect(page).toHaveURL(/#journey\/kyoto\//)
  const firstId = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).journals[0].chapters[0].id, journalsKey)

  await page.goto('/#journal/kyoto')
  await page.getByRole('button', { name: 'Raconter cette journée' }).click()
  await page.getByLabel('Le titre de votre journée').fill('Second Kyoto page')
  await page.getByLabel('Souvenirs de la journée').fill('A second walk.')
  await page.locator('#story').fill('Another Kyoto story.')
  await page.getByRole('button', { name: 'Prévisualiser' }).click()
  await page.getByRole('button', { name: 'Ajouter au voyage' }).click()
  await page.goto('/#journal/kyoto')
  await expect(page.getByTestId('journal-chapter-card')).toHaveCount(2)
  await page.getByRole('button', { name: 'Modifier' }).first().click()
  await page.getByLabel('Le titre de votre journée').fill('Edited first page')
  await page.getByRole('button', { name: 'Prévisualiser' }).click()
  await page.getByRole('button', { name: 'Ajouter au voyage' }).click()
  await page.goto('/#journal/kyoto')
  const kyoto = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), journalsKey)
  expect(kyoto.journals[0].chapters.map((item: { id: string }) => item.id)).toEqual([firstId, expect.any(String)])
  expect(kyoto.journals[0].chapters[0].title).toBe('Edited first page')

  await page.goto('/#journal/lisbon')
  await expect(page.getByText('Vos mots, vos photos, un voyage à la fois.')).toBeVisible()
  await page.getByRole('button', { name: 'Raconter cette journée' }).click()
  await page.getByLabel('Le titre de votre journée').fill('Lisbon first page')
  await page.getByLabel('Souvenirs de la journée').fill('A riverside walk.')
  await page.locator('#story').fill('A Lisbon story.')
  await page.getByRole('button', { name: 'Prévisualiser' }).click()
  await page.getByRole('button', { name: 'Ajouter au voyage' }).click()
  const lisbon = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), journalsKey)
  expect(lisbon.journals).toHaveLength(2)
  expect(lisbon.journals.find((item: { tripId: string }) => item.tripId === 'lisbon').chapters).toHaveLength(1)
  expect(JSON.parse(await page.evaluate(key => localStorage.getItem(key)!, legacyKey)).drafts[0].id).toBe('legacy-chapter')

  await page.evaluate(key => localStorage.setItem(key, '{corrupt'), journalsKey)
  await page.reload()
  await page.goto('/#journal/kyoto')
  await expect(page.getByRole('alert')).toContainText('Les carnets personnels ne peuvent pas être lus')
  await page.getByRole('button', { name: 'Raconter cette journée' }).click()
  await page.getByLabel('Le titre de votre journée').fill('Must not overwrite')
  await page.getByLabel('Souvenirs de la journée').fill('Draft text')
  await page.locator('#story').fill('Draft story')
  await page.getByRole('button', { name: 'Prévisualiser' }).click()
  await page.getByRole('button', { name: 'Ajouter au voyage' }).click()
  await expect(page.getByTestId('creator').getByRole('alert')).toContainText('Les carnets personnels ne peuvent pas être lus')
  expect(await page.evaluate(key => localStorage.getItem(key), journalsKey)).toBe('{corrupt')
})
