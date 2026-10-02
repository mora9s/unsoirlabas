import type { Draft, Media, Trip } from './journal'
import { journalsKey, persistLegacyJournalUnlocked, validateJournals } from './trip-journals'
import { storageKey, validateTrip } from './journal'
import { unsavedChaptersKey, validateUnsavedChapterEnvelope } from './unsaved-chapters'

import { withMediaDurabilityLock } from './durability-lock'
export { withMediaDurabilityLock } from './durability-lock'

const databaseName = 'un-soir-la-bas-media-v1'
const storeName = 'blobs'
const migrationKey = 'un-soir-la-bas-media-migration-v1'
const legacyPrefix = 'un-soir-la-bas-media-legacy-v1:'
const referencePrefix = 'idb:media:'
const hydratedUrls = new Map<string, string>()
type BlobRecord = { id: string; mime: string; bytes: ArrayBuffer }
type MigrationLog = { version: 1; key: string; state: 'writing' | 'ready'; updatedAt: number }

function mediaRef(media: Media) { return media.storageRef ?? (media.src.startsWith(referencePrefix) ? media.src.slice(referencePrefix.length) : '') }
function isDataUrl(value: string) { return /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value) }
function newRef() { return window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}` }
function bytesFromDataUrl(value: string) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value)
  if (!match) throw new Error('Une image du carnet ne peut pas être déplacée vers le stockage durable.')
  const binary = atob(match[2])
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return { mime: match[1], bytes }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB || typeof window.indexedDB.open !== 'function') { reject(new Error('IndexedDB est indisponible dans ce navigateur. Les photos existantes restent dans leur stockage historique ; aucune migration n’a été validée.')); return }
    const request = indexedDB.open(databaseName, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(storeName, { keyPath: 'id' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error('IndexedDB est indisponible dans ce navigateur. Les photos existantes restent dans leur stockage historique ; aucune migration n’a été validée.'))
    request.onblocked = () => reject(new Error('IndexedDB est verrouillé par un autre onglet. Fermez cet autre onglet avant de migrer les photos.'))
  })
}

async function writeBlobs(records: BlobRecord[]) {
  if (!records.length) return
  const database = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readwrite')
      for (const record of records) transaction.objectStore(storeName).put(record)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB n’a pas pu enregistrer les photos.'))
      transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB n’a pas pu enregistrer les photos.'))
    })
  } finally { database.close() }
}

async function readBlob(ref: string): Promise<BlobRecord | undefined> {
  const database = await openDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(storeName, 'readonly').objectStore(storeName).get(ref)
      request.onsuccess = () => resolve(request.result as BlobRecord | undefined)
      request.onerror = () => reject(new Error('La photo durable ne peut pas être lue.'))
    })
  } finally { database.close() }
}

function mapDrafts<T>(value: T, mapper: (media: Media) => Media): T {
  const mapDraft = (draft: Draft): Draft => ({ ...draft, media: draft.media.map(mapper) })
  if (validateTrip(value)) return { ...value, drafts: value.drafts.map(mapDraft) } as T
  if (validateJournals(value)) return { ...value, journals: value.journals.map(journal => ({ ...journal, chapters: journal.chapters.map(mapDraft) })) } as T
  if (validateUnsavedChapterEnvelope(value)) return { ...value, drafts: value.drafts.map(entry => ({ ...entry, draft: mapDraft(entry.draft) })) } as T
  return value
}

function allMedia(value: unknown): Media[] | undefined {
  if (!validateTrip(value) && !validateJournals(value) && !validateUnsavedChapterEnvelope(value)) return undefined
  const found: Media[] = []
  mapDrafts(value, media => { found.push(media); return media })
  return found
}

function readLog(): MigrationLog | undefined {
  try {
    const raw = localStorage.getItem(migrationKey)
    if (!raw) return undefined
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object') return undefined
    const log = value as MigrationLog
    return log.version === 1 && typeof log.key === 'string' && (log.state === 'writing' || log.state === 'ready') ? log : undefined
  } catch { return undefined }
}
function writeLog(log: MigrationLog) { localStorage.setItem(migrationKey, JSON.stringify(log)) }

async function migrateKey(key: string, valid: (value: unknown) => boolean) {
  const raw = localStorage.getItem(key)
  if (raw === null) return
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { return }
  if (!valid(parsed)) return
  const media = allMedia(parsed)
  if (!media) return
  const legacy = media.filter(item => isDataUrl(item.src))
  if (!legacy.length) return
  writeLog({ version: 1, key, state: 'writing', updatedAt: Date.now() })
  const records: BlobRecord[] = legacy.map(item => {
    const decoded = bytesFromDataUrl(item.src)
    const id = item.storageRef || newRef()
    item.storageRef = id
    return { id, mime: decoded.mime, bytes: decoded.bytes.buffer }
  })
  await writeBlobs(records)
  const migrated = mapDrafts(parsed, media => isDataUrl(media.src) ? { ...media, src: `${referencePrefix}${media.storageRef}`, storageRef: media.storageRef } : media)
  try {
    if (localStorage.getItem(legacyPrefix + key) === null) localStorage.setItem(legacyPrefix + key, raw)
    localStorage.setItem(key, JSON.stringify(migrated))
    writeLog({ version: 1, key, state: 'ready', updatedAt: Date.now() })
  } catch {
    throw new Error('Les photos ont été préparées mais le carnet historique ne peut pas être remplacé sans risque : le stockage local est plein. Les données originales restent inchangées ; libérez de l’espace puis réessayez.')
  }
}

export async function prepareMediaStorage(): Promise<string> {
  try {
    await withMediaDurabilityLock(async () => {
      await migrateKey(storageKey, validateTrip)
      await migrateKey(journalsKey, validateJournals)
      await migrateKey(unsavedChaptersKey, validateUnsavedChapterEnvelope)
      persistLegacyJournalUnlocked()
      await cleanupOrphanedMediaUnlocked()
    })
    return ''
  } catch (error) { return error instanceof Error ? error.message : 'La migration des photos n’a pas pu être terminée.' }
}

export async function hydrateDraft(draft: Draft): Promise<Draft> {
  const media = await Promise.all(draft.media.map(async item => {
    const ref = mediaRef(item)
    if (!ref) return item
    const cached = hydratedUrls.get(ref)
    if (cached) return { ...item, storageRef: ref, src: cached }
    const stored = await readBlob(ref)
    if (!stored) throw new Error('Une photo référencée est absente du stockage durable. Le carnet n’a pas été modifié ; restaurez une archive avant d’enregistrer.')
    const src = URL.createObjectURL(new Blob([stored.bytes], { type: stored.mime }))
    hydratedUrls.set(ref, src)
    return { ...item, storageRef: ref, src }
  }))
  return { ...draft, media }
}

export function releaseHydratedMedia() {
  hydratedUrls.forEach(url => URL.revokeObjectURL(url))
  hydratedUrls.clear()
}
export async function hydrateTrip(trip: Trip): Promise<Trip> { return { ...trip, drafts: await Promise.all(trip.drafts.map(hydrateDraft)) } }
export async function hydrateJournals<T extends { version: 1; journals: { chapters: Draft[] }[] }>(journals: T): Promise<T> {
  return { ...journals, journals: await Promise.all(journals.journals.map(async journal => ({ ...journal, chapters: await Promise.all(journal.chapters.map(hydrateDraft)) }))) }
}

export async function persistDraftMediaUnlocked(draft: Draft): Promise<Draft> {
  const writes: BlobRecord[] = []
  const media = draft.media.map(item => {
    if (!isDataUrl(item.src)) return item
    const decoded = bytesFromDataUrl(item.src)
    const ref = item.storageRef || newRef()
    writes.push({ id: ref, mime: decoded.mime, bytes: decoded.bytes.buffer })
    return { ...item, storageRef: ref }
  })
  await writeBlobs(writes)
  return { ...draft, media }
}

export async function persistDraftMedia(draft: Draft): Promise<Draft> {
  return withMediaDurabilityLock(() => persistDraftMediaUnlocked(draft))
}

export function storedDraft(draft: Draft): Draft {
  return { ...draft, media: draft.media.map(item => {
    const ref = mediaRef(item)
    if (!ref) throw new Error('Une photo n’a pas été enregistrée dans le stockage durable.')
    return { ...item, storageRef: ref, src: `${referencePrefix}${ref}` }
  }) }
}

export async function mediaBytes(media: Media): Promise<{ mime: string; bytes: Uint8Array }> {
  if (isDataUrl(media.src)) return bytesFromDataUrl(media.src)
  const ref = mediaRef(media)
  if (!ref) throw new Error(`« ${media.name} » ne peut pas être ajoutée à cette sauvegarde.`)
  const stored = await readBlob(ref)
  if (!stored) throw new Error(`« ${media.name} » est absente du stockage durable. Restaurez une archive avant de créer une sauvegarde.`)
  return { mime: stored.mime, bytes: new Uint8Array(stored.bytes) }
}

export async function importArchiveMedia(media: Media[]): Promise<Media[]> {
  return withMediaDurabilityLock(async () => {
    const writes: BlobRecord[] = []
    const persisted = media.map(item => {
      const decoded = bytesFromDataUrl(item.src)
      const ref = newRef()
      writes.push({ id: ref, mime: decoded.mime, bytes: decoded.bytes.buffer })
      return { ...item, storageRef: ref, src: `${referencePrefix}${ref}` }
    })
    await writeBlobs(writes)
    return persisted
  })
}

export async function cleanupOrphanedMediaUnlocked() {
  const live = new Set<string>()
  for (const key of [storageKey, journalsKey, unsavedChaptersKey]) {
    let raw: string | null
    try { raw = localStorage.getItem(key) } catch { return }
    if (raw === null) continue
    let parsed: unknown
    try { parsed = JSON.parse(raw) } catch { return }
    const media = allMedia(parsed)
    if (!media) return
    for (const item of media) {
      const ref = mediaRef(item)
      if (ref) live.add(ref)
    }
  }
  const database = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readwrite')
      const store = transaction.objectStore(storeName)
      const cursor = store.openCursor()
      cursor.onsuccess = () => {
        const current = cursor.result
        if (!current) return
        if (!live.has(String(current.key))) current.delete()
        current.continue()
      }
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('Impossible de nettoyer les médias orphelins.'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Impossible de nettoyer les médias orphelins.'))
    })
  } finally { database.close() }
}

export async function cleanupOrphanedMedia() {
  return withMediaDurabilityLock(cleanupOrphanedMediaUnlocked)
}

export function migrationStatus() { return readLog() }
