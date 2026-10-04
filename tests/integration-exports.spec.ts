import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { unzipSync } from 'fflate'

const journalKey = 'un-soir-la-bas-journals-v1'
const mainKey = 'philippines-trip'
const photoBytes = Buffer.from('/9j/2Q==', 'base64')
const dataUrl = `data:image/jpeg;base64,${photoBytes.toString('base64')}`

async function loadModules(page: import('@playwright/test').Page) {
  await page.goto('/')
  return page.evaluate(async () => {
    // @ts-expect-error browser-only Vite module URLs
    const [journals, media, exports] = await Promise.all([
      import('/src/trip-journals.ts'), import('/src/media-store.ts'), import('/src/reading-copy.ts'),
    ])
    return { ready: Boolean(journals.saveChapter && media.hydrateJournals && exports.readingCopy) }
  })
}

test('copie de lecture embarque les octets d’une photo IDB hydratée et conserve l’échappement/CSP', async ({ page }) => {
  await loadModules(page)
  const result = await page.evaluate(async ({ dataUrl }) => {
    // @ts-expect-error browser-only Vite module URLs
    const [journals, media, exports] = await Promise.all([
      import('/src/trip-journals.ts'), import('/src/media-store.ts'), import('/src/reading-copy.ts'),
    ])
    const saved = await journals.saveChapter('voyage-export', '<Bali & amis>', '', {
      id: 'chapter-export', title: 'Souvenir', memories: 'plage', tone: 'Calme', story: 'histoire',
      media: [{ id: 'photo-export', name: 'photo.jpg', src: dataUrl }], coverId: 'photo-export', status: 'draft',
    })
    const persisted = saved.journals.find((item: { tripId: string }) => item.tripId === 'voyage-export')!
    const hydrated = await media.hydrateJournals({ version: 1, journals: [persisted] })
    const photo = hydrated.journals[0].chapters[0].media[0]
    const blob = await exports.readingCopy({ ...hydrated.journals[0], destination: '<Bali & amis>' }, [])
    const html = await blob.text()
    let unreadable = ''
    try {
      await exports.readingCopy({ ...hydrated.journals[0], chapters: [{
        ...hydrated.journals[0].chapters[0], media: [{ id: 'gone', name: 'gone.jpg', src: 'idb:media:missing-photo-ref', storageRef: 'missing-photo-ref' }],
      }] }, [])
    } catch (error) { unreadable = error instanceof Error ? error.message : String(error) }
    const embedded = html.match(/<img src="([^"]+)"/)
    return { html, embedded: embedded?.[1], ref: photo.storageRef, hydratedUrl: photo.src, unreadable }
  }, { dataUrl })
  expect(result.ref).toBeTruthy()
  expect(result.hydratedUrl).toMatch(/^blob:/)
  expect(result.unreadable).toContain('gone.jpg')
  expect(result.unreadable).toContain('stockage durable')
  expect(result.embedded).toBe(dataUrl)
  expect(Buffer.from(result.embedded!.split(',')[1], 'base64')).toEqual(photoBytes)
  expect(result.html).toContain("img-src data:")
  expect(result.html).toContain('&lt;Bali &amp; amis&gt;')
  expect(result.html).not.toContain('<title><Bali')
})

test('archive de sauvegarde attend le verrou avant de lire le journal et le conserve jusqu’aux octets ZIP', async ({ page, context }, testInfo) => {
  await page.goto('/')
  await page.evaluate(async ({ journalKey, mainKey, dataUrl }) => {
    const main = { version: 1, drafts: [] }
    localStorage.setItem(mainKey, JSON.stringify(main))
    // @ts-expect-error browser-only Vite module URL
    const journals = await import('/src/trip-journals.ts')
    await journals.saveChapter('snapshot-trip', 'Avant', '', {
      id: 'snapshot-chapter', title: 'Avant', memories: 'mémoire', tone: 'Calme', story: 'version avant',
      media: [{ id: 'snapshot-photo', name: 'snapshot.jpg', src: dataUrl }], coverId: 'snapshot-photo', status: 'draft',
    })
    const current = JSON.parse(localStorage.getItem(journalKey)!)
    return { current }
  }, { journalKey, mainKey, dataUrl })

  const second = await context.newPage()
  await loadModules(second)
  const held = page.evaluate(() => navigator.locks.request('un-soir-la-bas-media-durability-v1', async () => {
    await new Promise<void>(resolve => { (window as Window & { releaseDurability?: () => void }).releaseDurability = resolve })
  }))
  await page.waitForFunction(() => Boolean((window as Window & { releaseDurability?: () => void }).releaseDurability))
  const pendingDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Outils et sauvegarde du carnet' }).click()
  await page.getByRole('button', { name: 'Sauvegarder dans Drive' }).click()
  // Queue a competing journal write after the backup has requested the shared lock.
  const queuedWrite = second.evaluate(async ({ dataUrl }) => {
    // @ts-expect-error browser-only Vite module URL
    const journals = await import('/src/trip-journals.ts')
    return journals.saveChapter('snapshot-trip', 'Après', '', {
      id: 'snapshot-chapter', title: 'Après', memories: 'mémoire', tone: 'Calme', story: 'version après',
      media: [{ id: 'snapshot-photo-next', name: 'next.jpg', src: dataUrl }], coverId: 'snapshot-photo-next', status: 'draft',
    })
  }, { dataUrl })
  await page.evaluate(() => (window as Window & { releaseDurability?: () => void }).releaseDurability?.())
  await held
  const download = await pendingDownload
  const path = testInfo.outputPath('snapshot.zip')
  await download.saveAs(path)
  await queuedWrite
  const zip = unzipSync(await readFile(path))
  const snapshot = JSON.parse(new TextDecoder().decode(zip['personal-journals.json']))
  expect(snapshot.journals[0].destination).toBe('Avant')
  expect(snapshot.journals[0].chapters[0].story).toBe('version avant')
  expect(Object.keys(zip)).toContain('personal/001-snapshot-trip/001-snapshot-chapter/001-snapshot-photo.jpg')
  await second.close()
})
