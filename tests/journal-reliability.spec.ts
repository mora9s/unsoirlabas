import { expect, test } from '@playwright/test'

const legacyKey = 'philippines-trip'
const journalsKey = 'un-soir-la-bas-journals-v1'
const chapter = (id: string, story = 'Un souvenir intact.') => ({ id, title: `Journée ${id}`, story, memories: 'Le matin', tone: 'Aventure', media: [], coverId: '', status: 'draft' })
async function seed(page: import('@playwright/test').Page, legacy: unknown, journals: unknown) {
  await page.goto('/')
  await page.evaluate(({ legacy, journals, legacyKey, journalsKey }) => {
    localStorage.clear()
    if (legacy !== null) localStorage.setItem(legacyKey, JSON.stringify(legacy))
    if (journals !== null) localStorage.setItem(journalsKey, JSON.stringify(journals))
  }, { legacy, journals, legacyKey, journalsKey })
}
async function save(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Prévisualiser', exact: true }).click()
  await page.getByRole('button', { name: 'Ajouter au voyage', exact: true }).click()
}

test('refuses an oversized story without poisoning stored or recoverable chapters', async ({ page }) => {
  await seed(page, { version: 1, drafts: [chapter('a')] }, null)
  await page.goto('/#create'); await page.reload()
  const before = await page.evaluate(() => localStorage.getItem('philippines-trip'))
  await page.getByLabel('Votre récit, à votre façon').fill('Copie récupérable.')
  await expect.poll(() => page.evaluate(() => localStorage.getItem('un-soir-la-bas-unsaved-chapters-v1'))).toContain('Copie récupérable.')
  await expect(page.getByLabel('Votre récit, à votre façon')).toHaveAttribute('maxlength', '20000')
  await page.getByLabel('Votre récit, à votre façon').evaluate(node => node.removeAttribute('maxlength'))
  await page.getByLabel('Votre récit, à votre façon').fill('x'.repeat(20001))
  await save(page)
  await expect(page.getByRole('alert')).toContainText('20 000')
  expect(await page.evaluate(() => localStorage.getItem('philippines-trip'))).toBe(before)
  expect(await page.evaluate(() => localStorage.getItem('un-soir-la-bas-unsaved-chapters-v1'))).toContain('Copie récupérable.')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Reprendre votre chapitre ?' })).toBeVisible()
})

test('refuses a 41st historical chapter and keeps all 40 readable', async ({ page }) => {
  await seed(page, { version: 1, drafts: Array.from({ length: 40 }, (_, i) => chapter(String(i))) }, null)
  await page.goto('/#create'); await page.reload()
  await page.getByLabel('Votre récit, à votre façon').fill('Le nouveau récit.')
  await save(page)
  await expect(page.getByRole('alert')).toContainText('40 journées')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('philippines-trip')!).drafts.length)).toBe(40)
})

test('historical and migrated routes share edits, preserve order and export current words', async ({ page }) => {
  await seed(page, { version: 1, drafts: [chapter('a'), chapter('b')] }, null)
  await page.goto('/#draft/a'); await page.reload()
  await page.getByRole('button', { name: /Modifier/ }).click()
  await page.getByLabel('Votre récit, à votre façon').fill('Texte corrigé une seule fois.')
  await save(page)
  await page.goto('/#journey/legacy-philippines-journal/a'); await page.reload()
  await expect(page.getByTestId('custom-chapter')).toContainText('Texte corrigé une seule fois.')
  await page.goto('/#journal-share/legacy-philippines-journal/a')
  await expect(page.getByLabel('La légende proposée')).toContainText('Texte corrigé une seule fois.')
  await page.getByRole('link', { name: 'Retour à cette journée' }).click()
  await expect(page).toHaveURL(/#journey\/legacy-philippines-journal\/a$/)
  await expect(page).toHaveTitle('Journée a — Philippines · Un soir là-bas')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('un-soir-la-bas-journals-v1')!).journals[0].chapters.map((c: {id: string}) => c.id))).toEqual(['a', 'b'])
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('philippines-trip')!).drafts[0].story)).toBe('Texte corrigé une seule fois.')
})

test('preserves both existing divergent versions without mutating raw history on read', async ({ page }) => {
  await seed(page, { version: 1, drafts: [chapter('a', 'Version historique différente.')] }, { version: 1, journals: [{ tripId: 'legacy-philippines-journal', destination: 'Philippines', departure: '', chapters: [chapter('a', 'Version récente différente.')] }] })
  const before = await page.evaluate(() => localStorage.getItem('philippines-trip'))
  await page.goto('/#trip/legacy-philippines-journal'); await page.reload()
  await expect(page.getByTestId('journal-chapter-card')).toHaveCount(2)
  await expect(page.getByTestId('trip-journal')).toContainText('Version historique différente.')
  await expect(page.getByTestId('trip-journal')).toContainText('Version récente différente.')
  expect(await page.evaluate(() => localStorage.getItem('philippines-trip'))).toBe(before)
})

test('shows a damaged multi-trip store explicitly and preserves it', async ({ page }) => {
  await seed(page, null, 'broken')
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('Les carnets personnels ne peuvent pas être lus')
  expect(await page.evaluate(() => localStorage.getItem('un-soir-la-bas-journals-v1'))).toBe('"broken"')
})

test('trip metadata follows planning changes and editing retains chapter order', async ({ page }) => {
  await seed(page, null, { version: 1, journals: [{ tripId: 'tokyo', destination: 'Ancien nom', departure: '2027-01-01', chapters: [chapter('a'), chapter('b')] }] })
  await page.evaluate(() => localStorage.setItem('un-soir-la-bas-upcoming-v1', JSON.stringify([{ id: 'tokyo', destination: 'Tokyo', departure: '2027-04-12' }])))
  await page.goto('/#trip/tokyo'); await page.reload()
  await expect(page.getByTestId('trip-journal')).toContainText('2027-04-12')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Tokyo')
  await page.goto('/#trip-create/tokyo/a'); await page.reload()
  await page.getByLabel('Votre récit, à votre façon').fill('Mise à jour.')
  await save(page)
  await expect(page).toHaveTitle('Journée a — Tokyo · Un soir là-bas')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('un-soir-la-bas-journals-v1')!).journals[0].chapters.map((c: {id: string}) => c.id))).toEqual(['a', 'b'])
})

test('failed mirror write rolls back historical data and leaves the edited text open', async ({ page }) => {
  await seed(page, { version: 1, drafts: [chapter('a')] }, null)
  await page.goto('/#draft/a'); await page.reload()
  const before = await page.evaluate(() => [localStorage.getItem('philippines-trip'), localStorage.getItem('un-soir-la-bas-journals-v1')])
  await page.getByRole('button', { name: /Modifier/ }).click()
  await page.getByLabel('Votre récit, à votre façon').fill('Texte à conserver dans l’éditeur.')
  await page.evaluate(() => {
    const set = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'un-soir-la-bas-journals-v1') throw new DOMException('quota', 'QuotaExceededError')
      return set.call(this, key, value)
    }
  })
  await save(page)
  await expect(page.getByRole('alert')).toContainText('stockage est plein ou indisponible')
  await expect(page.getByLabel('Votre récit, à votre façon')).toHaveValue('Texte à conserver dans l’éditeur.')
  expect(await page.evaluate(() => [localStorage.getItem('philippines-trip'), localStorage.getItem('un-soir-la-bas-journals-v1')])).toEqual(before)
})

test('renaming then removing a planning card retains the new journal identity', async ({ page }) => {
  await seed(page, null, { version: 1, journals: [{ tripId: 'tokyo', destination: 'Tokyo', departure: '2027-04-12', chapters: [chapter('a')] }] })
  await page.evaluate(() => localStorage.setItem('un-soir-la-bas-upcoming-v1', JSON.stringify([{ id: 'tokyo', destination: 'Tokyo', departure: '2027-04-12' }])))
  await page.reload()
  await page.getByRole('button', { name: 'Modifier Tokyo', exact: true }).click()
  await page.getByLabel('Destination', { exact: true }).fill('Kyoto')
  await page.getByLabel('Date de départ', { exact: true }).fill('2027-05-13')
  await page.getByRole('button', { name: 'Enregistrer les modifications' }).click()
  await page.getByRole('button', { name: 'Retirer Kyoto', exact: true }).click()
  await page.goto('/#trip/tokyo'); await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Kyoto')
  await expect(page.getByTestId('trip-journal')).toContainText('2027-05-13')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('un-soir-la-bas-journals-v1')!).journals[0].chapters[0].story)).toBe('Un souvenir intact.')
})

test('reconciliation compares content rather than JSON key order and preserves title conflicts', async ({ page }) => {
  const historical = chapter('a')
  const reordered = { status: historical.status, coverId: historical.coverId, media: historical.media, tone: historical.tone, memories: historical.memories, story: historical.story, title: historical.title, id: historical.id }
  await seed(page, { version: 1, drafts: [reordered, chapter('b')] }, { version: 1, journals: [{ tripId: 'legacy-philippines-journal', destination: 'Philippines', departure: '', chapters: [historical, { ...chapter('b'), title: 'Titre corrigé' }] }] })
  await page.goto('/#trip/legacy-philippines-journal'); await page.reload()
  await expect(page.getByTestId('journal-chapter-card')).toHaveCount(3)
  await expect(page.getByTestId('trip-journal')).toContainText('Journée b · version historique')
  await page.reload()
  await expect(page.getByTestId('journal-chapter-card')).toHaveCount(3)
})
