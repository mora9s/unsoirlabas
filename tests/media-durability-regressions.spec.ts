import { expect, test } from '@playwright/test'

const journalsKey = 'un-soir-la-bas-journals-v1'

async function modules(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.evaluate(async () => {
    while (true) {
      const state = await navigator.locks.query()
      if (!state.held?.length && !state.pending?.length) break
      await new Promise(resolve => setTimeout(resolve, 10))
    }
  })
  return page.evaluate(async () => {
    // Vite serves these browser modules; TypeScript cannot resolve URL-root imports in the test project.
    // @ts-expect-error browser-only Vite module URL
    const [media, journals] = await Promise.all([import('/src/media-store.ts'), import('/src/trip-journals.ts')])
    return { ready: Boolean(media.cleanupOrphanedMedia && journals.saveChapter) }
  })
}

test('cleanup preserves blobs when a trip envelope is invalid even if its drafts resemble wrappers', async ({ page }) => {
  await modules(page)
  const result = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('un-soir-la-bas-media-v1', 1); request.onupgradeneeded = () => request.result.createObjectStore('blobs', { keyPath: 'id' }); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    await new Promise<void>((resolve, reject) => { const tx = db.transaction('blobs', 'readwrite'); tx.objectStore('blobs').put({ id: 'live-reference-12345678', mime: 'image/jpeg', bytes: new Uint8Array([1, 2]).buffer }); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
    db.close()
    const recoverable = { id: 'bad-trip', title: 'bad-trip', memories: '', tone: '', story: '', media: [{ id: 'm', name: 'm.jpg', src: 'idb:media:live-reference-12345678', storageRef: 'live-reference-12345678' }], coverId: 'm', status: 'draft' }
    localStorage.setItem('philippines-trip', JSON.stringify({ version: 1, drafts: Array.from({ length: 41 }, (_, index) => ({ ...recoverable, id: `bad-${index}` })) }))
    // @ts-expect-error browser-only Vite module URL
    const media = await import('/src/media-store.ts')
    await media.cleanupOrphanedMedia()
    const check = await new Promise<boolean>((resolve, reject) => { const request = indexedDB.open('un-soir-la-bas-media-v1', 1); request.onupgradeneeded = () => request.result.createObjectStore('blobs', { keyPath: 'id' }); request.onsuccess = () => { const db = request.result; const get = db.transaction('blobs').objectStore('blobs').get('live-reference-12345678'); get.onsuccess = () => { resolve(Boolean(get.result)); db.close() }; get.onerror = () => reject(get.error) } })
    return { check, source: localStorage.getItem('philippines-trip') }
  })
  expect(result.check).toBe(true)
  expect(result.source).toContain('live-reference-12345678')
})

test('two tabs concurrently save distinct trips and cleanup cannot delete a just-published photo', async ({ page, context }) => {
  await modules(page)
  const second = await context.newPage()
  await modules(second)
  const runSave = (target: import('@playwright/test').Page, tripId: string) => target.evaluate(async ({ tripId, journalsKey }) => {
    // @ts-expect-error browser-only Vite module URL
    const journals = await import('/src/trip-journals.ts')
    // @ts-expect-error browser-only Vite module URL
    const media = await import('/src/media-store.ts')
    const chapter = { id: `chapter-${tripId}`, title: tripId, memories: 'souvenir', tone: 'Contemplatif', story: 'récit', media: [{ id: `photo-${tripId}`, name: `${tripId}.jpg`, src: 'data:image/jpeg;base64,/9j/2Q==' }], coverId: `photo-${tripId}`, status: 'draft' as const }
    await Promise.all([journals.saveChapter(tripId, tripId, '', chapter), media.cleanupOrphanedMedia()])
    const saved = JSON.parse(localStorage.getItem(journalsKey)!)
    return saved.journals.map((item: { tripId: string }) => item.tripId).sort()
  }, { tripId, journalsKey })
  await Promise.all([runSave(page, 'trip-a'), runSave(second, 'trip-b')])
  const state = await page.evaluate(async journalsKey => {
    const saved = JSON.parse(localStorage.getItem(journalsKey)!)
    const refs = saved.journals.flatMap((journal: { chapters: { media: { storageRef: string }[] }[] }) => journal.chapters.flatMap(chapter => chapter.media.map(item => item.storageRef)))
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('un-soir-la-bas-media-v1', 1); request.onupgradeneeded = () => request.result.createObjectStore('blobs', { keyPath: 'id' }); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    const stored = await Promise.all(refs.map(ref => new Promise<boolean>((resolve, reject) => { const request = db.transaction('blobs').objectStore('blobs').get(ref); request.onsuccess = () => resolve(Boolean(request.result)); request.onerror = () => reject(request.error) })))
    db.close()
    return { trips: saved.journals.map((item: { tripId: string }) => item.tripId).sort(), refs: refs.length, stored }
  }, journalsKey)
  expect(state).toEqual({ trips: ['trip-a', 'trip-b'], refs: 2, stored: [true, true] })
  await second.close()
})

test('crash recovery reruns a writing migration without losing the legacy source or its photo', async ({ page }) => {
  await modules(page)
  const result = await page.evaluate(async () => {
    const raw = JSON.stringify({ version: 1, drafts: [{ id: 'recover-me', title: 'Jour retrouvé', memories: 'souvenir', tone: 'Contemplatif', story: 'récit', media: [{ id: 'legacy-photo', name: 'lagon.jpg', src: 'data:image/jpeg;base64,/9j/2Q==' }], coverId: 'legacy-photo', status: 'draft' }] })
    localStorage.setItem('philippines-trip', raw)
    localStorage.setItem('un-soir-la-bas-media-migration-v1', JSON.stringify({ version: 1, key: 'philippines-trip', state: 'writing', updatedAt: Date.now() }))
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('un-soir-la-bas-media-v1', 1); request.onupgradeneeded = () => request.result.createObjectStore('blobs', { keyPath: 'id' }); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    await new Promise<void>((resolve, reject) => { const tx = db.transaction('blobs', 'readwrite'); tx.objectStore('blobs').put({ id: 'crash-orphan-12345678', mime: 'image/jpeg', bytes: new Uint8Array([9]).buffer }); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
    db.close()
    // @ts-expect-error browser-only Vite module URL
    const media = await import('/src/media-store.ts')
    const error = await media.prepareMediaStorage()
    const migrated = JSON.parse(localStorage.getItem('philippines-trip')!)
    const backup = localStorage.getItem('un-soir-la-bas-media-legacy-v1:philippines-trip')
    const record = await new Promise<any>((resolve, reject) => { const request = indexedDB.open('un-soir-la-bas-media-v1', 1); request.onupgradeneeded = () => request.result.createObjectStore('blobs', { keyPath: 'id' }); request.onsuccess = () => { const db = request.result; const get = db.transaction('blobs').objectStore('blobs').get(migrated.drafts[0].media[0].storageRef); get.onsuccess = () => { resolve(get.result); db.close() }; get.onerror = () => reject(get.error) } })
    return { error, sourcePreserved: backup === raw, src: migrated.drafts[0].media[0].src, recordExists: Boolean(record), status: media.migrationStatus()?.state }
  })
  expect(result).toEqual({ error: '', sourcePreserved: true, src: expect.stringMatching(/^idb:media:/), recordExists: true, status: 'ready' })
})

test('cleanup fails closed for unknown or corrupt envelope data and unsupported Web Locks', async ({ page }) => {
  await modules(page)
  const result = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('un-soir-la-bas-media-v1', 1); request.onupgradeneeded = () => request.result.createObjectStore('blobs', { keyPath: 'id' }); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    await new Promise<void>((resolve, reject) => { const tx = db.transaction('blobs', 'readwrite'); tx.objectStore('blobs').put({ id: 'still-live-12345678', mime: 'image/jpeg', bytes: new Uint8Array([1]).buffer }); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
    db.close()
    localStorage.setItem('un-soir-la-bas-journals-v1', '{corrupt')
    // @ts-expect-error browser-only Vite module URL
    const media = await import('/src/media-store.ts')
    await media.cleanupOrphanedMedia()
    const exists = await new Promise<boolean>((resolve, reject) => { const request = indexedDB.open('un-soir-la-bas-media-v1', 1); request.onupgradeneeded = () => request.result.createObjectStore('blobs', { keyPath: 'id' }); request.onsuccess = () => { const db = request.result; const get = db.transaction('blobs').objectStore('blobs').get('still-live-12345678'); get.onsuccess = () => { resolve(Boolean(get.result)); db.close() }; get.onerror = () => reject(get.error) } })
    const originalLocks = navigator.locks
    Object.defineProperty(navigator, 'locks', { value: undefined, configurable: true })
    let rejected = false
    try { await media.cleanupOrphanedMedia() } catch (error) { rejected = String(error).includes('verrouillage multi-onglets sûr') }
    Object.defineProperty(navigator, 'locks', { value: originalLocks, configurable: true })
    return { exists, rejected }
  })
  expect(result).toEqual({ exists: true, rejected: true })
})

test('cleanup preserves actual bytes for unknown fields and wrong-key envelopes', async ({ page }) => {
  await modules(page)
  const result = await page.evaluate(async () => {
    // @ts-expect-error browser-only Vite module URL
    const media = await import('/src/media-store.ts')
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open('un-soir-la-bas-media-v1', 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
    await new Promise<void>((resolve, reject) => { const tx = db.transaction('blobs', 'readwrite'); tx.objectStore('blobs').put({ id: 'keep-12345678', mime: 'image/jpeg', bytes: new Uint8Array([7, 8, 9]).buffer }); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
    const chapter = { id: 'c', title: 't', memories: '', tone: '', story: '', media: [{ id: 'm', name: 'm', src: 'idb:media:keep-12345678', storageRef: 'keep-12345678' }], coverId: 'm', status: 'draft' }
    const cases: [string, unknown][] = [
      ['philippines-trip', { version: 1, drafts: [chapter], future: 1 }],
      ['philippines-trip', { version: 1, drafts: [{ ...chapter, future: 1 }] }],
      ['philippines-trip', { version: 1, drafts: [{ ...chapter, media: [{ ...chapter.media[0], future: 1 }] }] }],
      ['un-soir-la-bas-journals-v1', { version: 1, journals: [], future: 1 }],
      ['un-soir-la-bas-unsaved-chapters-v1', { version: 1, drafts: [{ scope: 'x', updatedAt: 1, draft: chapter, future: 1 }] }],
      ['philippines-trip', { version: 1, journals: [] }],
    ]
    const results = []
    for (const [key, value] of cases) {
      localStorage.removeItem('philippines-trip'); localStorage.removeItem('un-soir-la-bas-journals-v1'); localStorage.removeItem('un-soir-la-bas-unsaved-chapters-v1')
      const raw = JSON.stringify(value); localStorage.setItem(key, raw)
      await media.cleanupOrphanedMedia()
      const record = await new Promise<any>((resolve, reject) => { const r = db.transaction('blobs').objectStore('blobs').get('keep-12345678'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
      results.push({ raw: localStorage.getItem(key) === raw, bytes: record ? Array.from(new Uint8Array(record.bytes)) : null })
    }
    db.close(); return results
  })
  expect(result).toEqual(Array.from({ length: 6 }, () => ({ raw: true, bytes: [7, 8, 9] })))
})

test('stale chapter snapshots are rejected across tabs, including deletion and hydrated references', async ({ page, context }) => {
  await modules(page)
  const other = await context.newPage(); await modules(other)
  await page.evaluate(async () => {
    // @ts-expect-error browser-only Vite module URL
    const j = await import('/src/trip-journals.ts')
    await j.saveChapter('t', 'Tokyo', '', { id: 'c', title: 'original', memories: '', tone: '', story: 'original', media: [{ id: 'm', name: 'm', src: 'data:image/jpeg;base64,/9j/2Q==' }], coverId: 'm', status: 'draft' }, null)
  })
  const snapshot = await page.evaluate(async () => {
    // @ts-expect-error browser-only Vite module URL
    const m = await import('/src/media-store.ts')
    return m.hydrateDraft(JSON.parse(localStorage.getItem('un-soir-la-bas-journals-v1')!).journals[0].chapters[0])
  })
  await other.evaluate(async () => {
    // @ts-expect-error browser-only Vite module URL
    const j = await import('/src/trip-journals.ts')
    const chapter = JSON.parse(localStorage.getItem('un-soir-la-bas-journals-v1')!).journals[0].chapters[0]
    await j.saveChapter('t', 'Tokyo', '', { ...chapter, story: 'earned in tab two' }, chapter)
  })
  const outcome = await page.evaluate(async snapshot => {
    // @ts-expect-error browser-only Vite module URL
    const j = await import('/src/trip-journals.ts')
    let message = ''; try { await j.saveChapter('t', 'Tokyo', '', { ...snapshot, title: 'my edit' }, snapshot) } catch (e) { message = String(e) }
    const saved = JSON.parse(localStorage.getItem('un-soir-la-bas-journals-v1')!)
    const story = saved.journals[0].chapters[0].story
    saved.journals[0].chapters = []; localStorage.setItem('un-soir-la-bas-journals-v1', JSON.stringify(saved))
    let removed = ''; try { await j.saveChapter('t', 'Tokyo', '', snapshot, snapshot) } catch (e) { removed = String(e) }
    return { message, story, removed }
  }, snapshot)
  expect(outcome.message).toContain('changé ou a été supprimée')
  expect(outcome.removed).toContain('changé ou a été supprimée')
  expect(outcome.story).toBe('earned in tab two')
  await other.close()
})

test('live editor retains its opening snapshot when another tab saves', async ({ page, context }) => {
  await modules(page)
  await page.evaluate(() => {
    localStorage.setItem('un-soir-la-bas-upcoming-v1', JSON.stringify([{ id: 'trip-tokyo', destination: 'Tokyo', departure: '2027-04-12' }]))
    localStorage.setItem('un-soir-la-bas-journals-v1', JSON.stringify({ version: 1, journals: [{ tripId: 'trip-tokyo', destination: 'Tokyo', departure: '2027-04-12', chapters: [{ id: 'chapter', title: 'Original', memories: '', tone: 'Contemplatif', story: 'Original story', media: [], coverId: '', status: 'draft' }] }] }))
  })
  const second = await context.newPage()
  for (const tab of [page, second]) {
    await tab.goto('/#journey/trip-tokyo/chapter')
    await tab.getByRole('button', { name: 'Modifier cette journée' }).click()
    await expect(tab.getByLabel('Le titre de votre journée')).toHaveValue('Original')
  }
  await page.getByLabel('Le titre de votre journée').fill('My unsaved edit')
  await second.getByLabel('Votre récit, à votre façon').fill('Earned in another tab')
  await second.getByRole('button', { name: 'Prévisualiser', exact: true }).click()
  await second.getByRole('button', { name: 'Ajouter au voyage' }).click()
  await expect(second.getByTestId('custom-chapter')).toContainText('Earned in another tab')
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('un-soir-la-bas-journals-v1')!).journals[0].chapters[0].story)).toBe('Earned in another tab')
  await page.getByRole('button', { name: 'Prévisualiser', exact: true }).click()
  await page.getByRole('button', { name: 'Ajouter au voyage' }).click()
  await expect(page.getByRole('alert')).toContainText('changé ou a été supprimée')
  await expect(page.getByLabel('Le titre de votre journée')).toHaveValue('My unsaved edit')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('un-soir-la-bas-journals-v1')!).journals[0].chapters[0].story)).toBe('Earned in another tab')
  await second.close()
})

test('migration shares exact mirror photo bytes while retaining changed historical chapters', async ({ page }) => {
  await modules(page)
  const result = await page.evaluate(async () => {
    // @ts-expect-error browser-only Vite module URL
    const media = await import('/src/media-store.ts')
    // @ts-expect-error browser-only Vite module URL
    const j = await import('/src/trip-journals.ts')
    const chapter = { id: 'c', title: 'Jour', memories: '', tone: '', story: 'same', media: [{ id: 'p', name: 'p.jpg', src: 'data:image/jpeg;base64,/9j/2Q==' }], coverId: 'p', status: 'draft' }
    localStorage.setItem('philippines-trip', JSON.stringify({ version: 1, drafts: [chapter] }))
    localStorage.setItem('un-soir-la-bas-journals-v1', JSON.stringify({ version: 1, journals: [{ tripId: j.legacyId, destination: 'Philippines', departure: '', chapters: [chapter] }] }))
    const error = await media.prepareMediaStorage()
    const historical = JSON.parse(localStorage.getItem('philippines-trip')!)
    const journals = JSON.parse(localStorage.getItem('un-soir-la-bas-journals-v1')!)
    const identical = j.readJournals().data.journals[0].chapters.length
    historical.drafts[0].story = 'changed historical story'
    localStorage.setItem('philippines-trip', JSON.stringify(historical))
    const changed = j.readJournals().data.journals[0].chapters.map((c: { story: string }) => c.story)
    return { error, ref1: historical.drafts[0].media[0].storageRef, ref2: journals.journals[0].chapters[0].media[0].storageRef, identical, changed }
  })
  expect(result.error).toBe('')
  expect(result.ref1).toBe(result.ref2)
  expect(result.identical).toBe(1)
  expect(result.changed).toEqual(['same', 'changed historical story'])
})

test('interrupted mirrored migration retries with verified identical references', async ({ page }) => {
  await modules(page)
  const result = await page.evaluate(async () => {
    // @ts-expect-error browser-only Vite module URL
    const media = await import('/src/media-store.ts')
    // @ts-expect-error browser-only Vite module URL
    const j = await import('/src/trip-journals.ts')
    const c = { id: 'c', title: 'Jour', memories: '', tone: '', story: 'same', media: [{ id: 'p', name: 'p.jpg', src: 'data:image/jpeg;base64,/9j/2Q==' }], coverId: 'p', status: 'draft' }
    const original = JSON.stringify({ version: 1, journals: [{ tripId: j.legacyId, destination: 'Philippines', departure: '', chapters: [c] }] })
    localStorage.setItem('philippines-trip', JSON.stringify({ version: 1, drafts: [c] }))
    localStorage.setItem('un-soir-la-bas-journals-v1', original)
    const set = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) { if (key === 'un-soir-la-bas-journals-v1') throw new DOMException('quota', 'QuotaExceededError'); return set.call(this, key, value) }
    let first: string
    try { first = await media.prepareMediaStorage() } finally { Storage.prototype.setItem = set }
    const unchanged = localStorage.getItem('un-soir-la-bas-journals-v1') === original
    const second = await media.prepareMediaStorage()
    const trip = JSON.parse(localStorage.getItem('philippines-trip')!)
    const journals = JSON.parse(localStorage.getItem('un-soir-la-bas-journals-v1')!)
    return { first, unchanged, second, a: trip.drafts[0].media[0].storageRef, b: journals.journals[0].chapters[0].media[0].storageRef, count: j.readJournals().data.journals[0].chapters.length }
  })
  expect(result.first).not.toBe('')
  expect(result.unchanged).toBe(true)
  expect(result.second).toBe('')
  expect(result.a).toBe(result.b)
  expect(result.count).toBe(1)
})

test('migration refuses publication when an old writer changes its input during IDB staging', async ({ page }) => {
  await modules(page)
  const result = await page.evaluate(async () => {
    // @ts-expect-error browser-only Vite module URL
    const media = await import('/src/media-store.ts')
    const chapter = { id: 'c', title: 'Jour', memories: '', tone: '', story: 'before', media: [{ id: 'p', name: 'p.jpg', src: 'data:image/jpeg;base64,/9j/2Q==' }], coverId: 'p', status: 'draft' }
    const changed = JSON.stringify({ version: 1, drafts: [{ ...chapter, story: 'old writer' }] })
    localStorage.setItem('philippines-trip', JSON.stringify({ version: 1, drafts: [chapter] }))
    const put = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (...args) { localStorage.setItem('philippines-trip', changed); return put.apply(this, args) }
    let error: string
    try { error = await media.prepareMediaStorage() } finally { IDBObjectStore.prototype.put = put }
    return { error, actual: localStorage.getItem('philippines-trip'), changed }
  })
  expect(result.error).toContain('données ont changé')
  expect(result.actual).toBe(result.changed)
})
