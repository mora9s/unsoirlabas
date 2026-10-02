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
  const both = await Promise.all([runSave(page, 'trip-a'), runSave(second, 'trip-b')])
  expect(both[1]).toEqual(['trip-a', 'trip-b'])
  const state = await page.evaluate(async journalsKey => {
    const saved = JSON.parse(localStorage.getItem(journalsKey)!)
    const refs = saved.journals.flatMap((journal: { chapters: { media: { storageRef: string }[] }[] }) => journal.chapters.flatMap(chapter => chapter.media.map(item => item.storageRef)))
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('un-soir-la-bas-media-v1', 1); request.onupgradeneeded = () => request.result.createObjectStore('blobs', { keyPath: 'id' }); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    const stored = await Promise.all(refs.map(ref => new Promise<boolean>((resolve, reject) => { const request = db.transaction('blobs').objectStore('blobs').get(ref); request.onsuccess = () => resolve(Boolean(request.result)); request.onerror = () => reject(request.error) })))
    db.close()
    return { refs: refs.length, stored }
  }, journalsKey)
  expect(state).toEqual({ refs: 2, stored: [true, true] })
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
