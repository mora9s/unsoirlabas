import { createId } from './id'

export type Segment = { id: string; start: number; end: number; text: string; rawText: string }
export type DraftParagraph = { text: string; supportingSegmentIds: string[] }
export type VoiceStatus = 'recording' | 'saving' | 'device-only' | 'server-received' | 'queued' | 'processing' | 'review' | 'failed'
export type VoiceRecord = {
  version: 1
  id: string
  name: string
  mime: string
  size: number
  status: VoiceStatus
  complete: boolean
  createdAt: number
  revision: number
  transcriptVersion: number
  segments: Segment[]
  title: string
  paragraphs: DraftParagraph[]
  uncertainty: string[]
  warnings: string[]
  uploadKey: string
  transcriptionKey: string
  draftKey: string
  pending?: 'upload' | 'transcription' | 'draft'
  uploaded?: boolean
  jobId?: string
}

type Chunk = { id: string; sessionId: string; index: number; blob: Blob }
const DB_NAME = 'un-soir-voice-v1'
const SESSION_STORE = 'sessions'
const CHUNK_STORE = 'chunks'

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(SESSION_STORE)) db.createObjectStore(SESSION_STORE, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(CHUNK_STORE)) {
        const store = db.createObjectStore(CHUNK_STORE, { keyPath: 'id' })
        store.createIndex('sessionId', 'sessionId', { unique: false })
      }
    }
    request.onblocked = () => reject(new Error('Le stockage audio est occupé par un autre onglet.'))
    request.onerror = () => reject(request.error ?? new Error('Le stockage audio est indisponible.'))
    request.onsuccess = () => {
      const db = request.result
      db.onversionchange = () => db.close()
      resolve(db)
    }
  })
}

async function transaction<T>(stores: string | string[], mode: IDBTransactionMode, action: (tx: IDBTransaction) => IDBRequest<T>): Promise<T> {
  const db = await database()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(stores, mode)
      const request = action(tx)
      let result: T
      request.onsuccess = () => { result = request.result }
      request.onerror = () => reject(request.error ?? new Error('La transaction audio a échoué.'))
      tx.oncomplete = () => resolve(result!)
      tx.onerror = () => reject(tx.error ?? new Error('La transaction audio a échoué.'))
      tx.onabort = () => reject(tx.error ?? new Error('La transaction audio a été annulée.'))
    })
  } finally { db.close() }
}

export function createVoiceRecord(input: Pick<VoiceRecord, 'id' | 'name' | 'mime'> & Partial<Pick<VoiceRecord, 'size' | 'status' | 'complete'>>): VoiceRecord {
  return { version: 1, id: input.id, name: input.name, mime: input.mime, size: input.size ?? 0, status: input.status ?? 'saving', complete: input.complete ?? false, createdAt: Date.now(), revision: 0, transcriptVersion: 0, segments: [], title: '', paragraphs: [], uncertainty: [], warnings: [], uploadKey: createId(), transcriptionKey: createId(), draftKey: createId() }
}

export async function beginVoice(record: VoiceRecord) { await transaction(SESSION_STORE, 'readwrite', tx => tx.objectStore(SESSION_STORE).put(record)) }
export async function saveVoice(record: VoiceRecord) { await transaction(SESSION_STORE, 'readwrite', tx => tx.objectStore(SESSION_STORE).put(record)) }
export async function loadVoice(id: string) { return transaction<VoiceRecord | undefined>(SESSION_STORE, 'readonly', tx => tx.objectStore(SESSION_STORE).get(id)) }
export async function loadActiveVoice() {
  const all = await transaction<VoiceRecord[]>(SESSION_STORE, 'readonly', tx => tx.objectStore(SESSION_STORE).getAll())
  return all.sort((a, b) => b.createdAt - a.createdAt)[0]
}
export async function appendChunk(sessionId: string, index: number, blob: Blob) {
  const chunk: Chunk = { id: `${sessionId}:${index}`, sessionId, index, blob }
  await transaction(CHUNK_STORE, 'readwrite', tx => tx.objectStore(CHUNK_STORE).put(chunk))
}
export async function assembleVoice(record: VoiceRecord): Promise<Blob> {
  const chunks = await transaction<Chunk[]>(CHUNK_STORE, 'readonly', tx => tx.objectStore(CHUNK_STORE).index('sessionId').getAll(record.id))
  return new Blob(chunks.sort((a, b) => a.index - b.index).map(chunk => chunk.blob), { type: record.mime })
}
export async function replaceWithBlob(record: VoiceRecord, blob: Blob) {
  const db = await database()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([SESSION_STORE, CHUNK_STORE], 'readwrite')
      const chunks = tx.objectStore(CHUNK_STORE)
      const keys = chunks.index('sessionId').getAllKeys(record.id)
      keys.onsuccess = () => {
        for (const key of keys.result) chunks.delete(key)
        chunks.put({ id: `${record.id}:0`, sessionId: record.id, index: 0, blob })
        tx.objectStore(SESSION_STORE).put({ ...record, size: blob.size })
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('La transaction audio a échoué.'))
    })
  } finally { db.close() }
}
export async function deleteVoice(id: string) {
  const db = await database()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([SESSION_STORE, CHUNK_STORE], 'readwrite')
      tx.objectStore(SESSION_STORE).delete(id)
      const request = tx.objectStore(CHUNK_STORE).index('sessionId').getAllKeys(id)
      request.onsuccess = () => { for (const key of request.result) tx.objectStore(CHUNK_STORE).delete(key) }
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('Suppression locale impossible.'))
    })
  } finally { db.close() }
}
export async function storageWarning() {
  try {
    const storage = navigator.storage
    const persisted = storage?.persist ? await storage.persist() : true
    const estimate = storage?.estimate ? await storage.estimate() : undefined
    if (!persisted) return 'Le navigateur peut supprimer cet audio pour libérer de l’espace.'
    if (estimate?.quota && estimate.quota - (estimate.usage ?? 0) < 64 * 1024 * 1024) return 'L’espace disponible semble insuffisant pour un long enregistrement.'
  } catch { return 'Le stockage durable n’a pas pu être confirmé.' }
  return ''
}
export function voiceHeaders(key: string, extra: HeadersInit = {}) { return { 'X-Un-Soir-Request': 'voice-v1', 'X-Idempotency-Key': key, ...extra } }
export function extensionForMime(mime: string) { if (mime.includes('mp4')) return 'm4a'; if (mime.includes('ogg')) return 'ogg'; if (mime.includes('wav')) return 'wav'; return 'webm' }
export function supportedRecorderMime() {
  const types = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg']
  return types.find(type => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type))
}
