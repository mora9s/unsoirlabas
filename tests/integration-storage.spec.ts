import { test, expect } from '@playwright/test'

test('invalid historical data blocks saving without changing either store', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const { savePersonalChapter, journalsKey } = await import('/src/trip-journals.ts')
    const original = JSON.stringify({ version: 99, drafts: [] })
    localStorage.setItem('philippines-trip', original)
    const before = localStorage.getItem(journalsKey)
    let error = ''
    try {
      await savePersonalChapter({ id: 'new', title: 'Souvenir', story: 'Récit', memories: '', tone: '', media: [], coverId: '', status: 'draft' })
    } catch (caught) { error = String(caught) }
    return { error, historical: localStorage.getItem('philippines-trip'), journals: localStorage.getItem(journalsKey), original, before }
  })
  expect(result.error).toContain('Vos données n’ont pas été modifiées')
  expect(result.historical).toBe(result.original)
  expect(result.journals).toBe(result.before)
})

test('quick memories use one durable lock and preserve concurrent additions', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const { saveQuickMemory } = await import('/src/quick-memory.ts')
    const { readJournals } = await import('/src/trip-journals.ts')
    const { mediaBytes } = await import('/src/media-store.ts')
    localStorage.setItem('un-soir-la-bas-upcoming-v1', JSON.stringify([{ id: 'trip', destination: 'Cebu', departure: '2027-02-01', plan: { ideas: [], notes: '', stops: [{ id: 'stop', place: 'Port', date: '2027-02-01' }] } }]))
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1
    const photo = { id: 'photo', name: 'souvenir.png', src: canvas.toDataURL('image/png') }
    const ids = await Promise.all([saveQuickMemory('trip', '2027-02-01', 'stop', 'Premier souvenir', [photo]), saveQuickMemory('trip', '2027-02-01', 'stop', 'Deuxième souvenir', [])])
    const chapter = readJournals().data.journals[0].chapters[0]
    return { ids, count: readJournals().data.journals[0].chapters.length, story: chapter.story, src: chapter.media[0].src, bytes: (await mediaBytes(chapter.media[0])).bytes.length }
  })
  expect(result.ids[0]).toBe(result.ids[1]); expect(result.count).toBe(1)
  expect(result.story).toContain('Premier souvenir'); expect(result.story).toContain('Deuxième souvenir')
  expect(result.src).toMatch(/^idb:media:/); expect(result.bytes).toBeGreaterThan(0)
})

test('oversized recovery preserves the last valid draft', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const { writeUnsavedChapter, readUnsavedChapter } = await import('/src/unsaved-chapters.ts')
    const draft = { id: 'draft', title: 'Souvenir', story: 'Valide', memories: '', tone: '', media: [], coverId: '', status: 'draft' as const }
    await writeUnsavedChapter('scope', draft)
    return { failure: await writeUnsavedChapter('scope', { ...draft, story: 'x'.repeat(20001) }), story: readUnsavedChapter('scope').draft?.story }
  })
  expect(result.failure).toContain('Brouillon trop long'); expect(result.story).toBe('Valide')
})

test('editing a stop preserves concurrent unrelated fields and refuses conflicts', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const { mergeStopUpdate } = await import('/src/plan-updates.ts')
    const before = { id: 'stop', place: 'Port', notes: 'Initial' }
    const latest = { ...before, notes: 'Note concurrente' }
    const merged = mergeStopUpdate([latest], before, { ...before, point: { lat: 10, lon: 123 } })
    let conflict = '', deleted = ''
    try { mergeStopUpdate([{ ...before, place: 'Autre lieu' }], before, { ...before, place: 'Mon lieu' }) } catch (error) { conflict = String(error) }
    try { mergeStopUpdate([], before, { ...before, place: 'Mon lieu' }) } catch (error) { deleted = String(error) }
    return { merged, conflict, deleted }
  })
  expect(result.merged[0]).toMatchObject({ notes: 'Note concurrente', point: { lat: 10, lon: 123 } })
  expect(result.conflict).toContain('autre onglet'); expect(result.deleted).toContain('retirée')
})
