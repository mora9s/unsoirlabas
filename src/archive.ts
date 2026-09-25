import { unzipSync, zipSync } from 'fflate'
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex } from '@noble/hashes/utils.js'
import type { Draft, Trip } from './journal'
import { validateTrip } from './journal'
import type { UpcomingTrip } from './upcoming-trips'
import { validateUpcoming } from './upcoming-trips'
import type { Journals, PersonalJournal } from './trip-journals'
import { validateJournals } from './trip-journals'

export const archiveFormat = 'les-jours-au-large-journal'
export const archiveVersion = 1
export const tripId = 'philippines-18-jours'
const encoder = new TextEncoder()
const decoder = new TextDecoder()
const MAX_ARCHIVE_BYTES = 25 * 1024 * 1024
const MAX_EXPANDED_BYTES = 80 * 1024 * 1024
const MAX_FILES = 160
const MAX_RECORDS = 40
const MAX_MEDIA = 120
const MAX_MEDIA_BYTES = 5 * 1024 * 1024

type ArchiveMedia = { id: string; name: string; mime: string; path: string; bytes: number; sha256: string }
type ArchiveDraft = Omit<Draft, 'media'> & { media: ArchiveMedia[] }
type ArchivePersonalJournal = Omit<PersonalJournal, 'chapters'> & { chapters: ArchiveDraft[] }
type ArchiveProduct = 'Un soir là-bas' | 'Les jours au large'
const compatibleProducts: readonly ArchiveProduct[] = ['Un soir là-bas', 'Les jours au large']
type Manifest = {
  product: ArchiveProduct
  format: typeof archiveFormat
  version: typeof archiveVersion
  tripId: typeof tripId
  createdAt: string
  records: number
  media: number
  bytes: number
  journal: { version: 1; drafts: ArchiveDraft[] }
  upcoming?: { path: 'upcoming.json'; bytes: number; sha256: string }
  personalJournals?: { path: 'personal-journals.json'; bytes: number; sha256: string }
}

type Preview = { trip: Trip; upcoming?: UpcomingTrip[]; personalJournals?: Journals; createdAt: string; records: number; media: number; bytes: number }

function fail(message: string): never { throw new Error(message) }
function exactObject(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const actual = Object.keys(value)
  return actual.length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(value, key))
}
function safeSegment(value: string) { return value.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 80) || 'item' }
function dataUrlBytes(src: string): { mime: string; bytes: Uint8Array } {
  const match = /^data:(image\/(jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(src)
  if (!match) fail('Une image du carnet ne peut pas être sauvegardée.')
  const binary = atob(match[3])
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return { mime: match[1], bytes }
}
function bytesDataUrl(mime: string, bytes: Uint8Array) {
  let binary = ''
  for (const value of bytes) binary += String.fromCharCode(value)
  return `data:${mime};base64,${btoa(binary)}`
}
function extension(mime: string) { return mime === 'image/jpeg' ? 'jpg' : mime === 'image/png' ? 'png' : 'webp' }
function matchesMime(mime: string, bytes: Uint8Array) {
  if (mime === 'image/jpeg') return bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9
  if (mime === 'image/png') return bytes.length >= 8 && bytes.slice(0, 8).every((value, index) => value === [137, 80, 78, 71, 13, 10, 26, 10][index])
  return bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
}
async function digest(bytes: Uint8Array) {
  // Keep backup and restore available on an insecure phone LAN origin, where
  // Web Crypto subtle may be unavailable.
  return bytesToHex(sha256(bytes))
}
function exactPaths(manifest: Manifest) {
  const paths = new Set(['manifest.json'])
  if (manifest.upcoming) paths.add(manifest.upcoming.path)
  if (manifest.personalJournals) paths.add(manifest.personalJournals.path)
  for (const draft of manifest.journal.drafts) for (const media of draft.media) {
    if (paths.has(media.path)) fail('L’archive contient des chemins dupliqués.')
    paths.add(media.path)
  }
  return paths
}
function validPath(path: string) {
  return /^(?:media\/[a-zA-Z0-9_-]+|personal\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+)\/[a-zA-Z0-9_-]+\.(?:jpg|png|webp)$/.test(path)
}
function parseManifest(value: unknown): Manifest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Le manifeste contient des champs inconnus ou incomplets.')
  const legacyKeys = ['product', 'format', 'version', 'tripId', 'createdAt', 'records', 'media', 'bytes', 'journal']
  const allowed = [...legacyKeys, ...(Object.prototype.hasOwnProperty.call(value, 'upcoming') ? ['upcoming'] : []), ...(Object.prototype.hasOwnProperty.call(value, 'personalJournals') ? ['personalJournals'] : [])]
  if (!exactObject(value, allowed)) fail('Le manifeste contient des champs inconnus ou incomplets.')
  const manifest = value as Manifest
  if (Object.prototype.hasOwnProperty.call(manifest, 'upcoming') && (!manifest.upcoming || !exactObject(manifest.upcoming, ['path', 'bytes', 'sha256']) || manifest.upcoming.path !== 'upcoming.json' || !Number.isSafeInteger(manifest.upcoming.bytes) || manifest.upcoming.bytes < 0 || !/^[a-f0-9]{64}$/.test(manifest.upcoming.sha256))) fail('La collection des prochains voyages est invalide.')
  if (Object.prototype.hasOwnProperty.call(manifest, 'personalJournals') && (!manifest.personalJournals || !exactObject(manifest.personalJournals, ['path', 'bytes', 'sha256']) || manifest.personalJournals.path !== 'personal-journals.json' || !Number.isSafeInteger(manifest.personalJournals.bytes) || manifest.personalJournals.bytes < 0 || !/^[a-f0-9]{64}$/.test(manifest.personalJournals.sha256))) fail('La collection des carnets personnels est invalide.')
  if (!compatibleProducts.includes(manifest.product) || manifest.format !== archiveFormat || manifest.version !== archiveVersion || manifest.tripId !== tripId) fail('Cette sauvegarde n’est pas compatible avec ce carnet.')
  if (typeof manifest.createdAt !== 'string' || Number.isNaN(Date.parse(manifest.createdAt)) || !exactObject(manifest.journal, ['version', 'drafts']) || manifest.journal.version !== 1 || !Array.isArray(manifest.journal.drafts)) fail('Le manifeste de sauvegarde est invalide.')
  if (manifest.journal.drafts.length > MAX_RECORDS) fail('Cette sauvegarde contient trop de chapitres.')
  for (const draft of manifest.journal.drafts) {
    if (!exactObject(draft, ['id', 'title', 'memories', 'tone', 'story', 'coverId', 'status', 'media']) || !Array.isArray(draft.media)) fail('Un chapitre du manifeste contient des champs inconnus ou incomplets.')
    for (const media of draft.media) {
      if (!exactObject(media, ['id', 'name', 'mime', 'path', 'bytes', 'sha256'])) fail('Un média du manifeste contient des champs inconnus ou incomplets.')
    }
  }
  return manifest
}

function preflightZip(bytes: Uint8Array) {
  // Read the ZIP central directory before fflate inflates anything.
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let eocd = -1
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65_557); index -= 1) {
    if (view.getUint32(index, true) === 0x06054b50) { eocd = index; break }
  }
  if (eocd < 0) fail('Cette archive ZIP ne peut pas être ouverte.')
  if (view.getUint16(eocd + 4, true) !== 0 || view.getUint16(eocd + 6, true) !== 0) fail('Les archives ZIP réparties sur plusieurs fichiers ne sont pas prises en charge.')
  const count = view.getUint16(eocd + 10, true)
  if (view.getUint16(eocd + 8, true) !== count) fail('Cette archive ZIP ne peut pas être ouverte.')
  const directorySize = view.getUint32(eocd + 12, true)
  const directoryOffset = view.getUint32(eocd + 16, true)
  if (count === 0 || count > MAX_FILES || directoryOffset + directorySize > bytes.length) fail('Cette archive contient trop de fichiers.')
  let cursor = directoryOffset
  let expanded = 0
  const paths = new Set<string>()
  for (let index = 0; index < count; index += 1) {
    if (cursor + 46 > bytes.length || view.getUint32(cursor, true) !== 0x02014b50) fail('Cette archive ZIP ne peut pas être ouverte.')
    const flags = view.getUint16(cursor + 8, true)
    const method = view.getUint16(cursor + 10, true)
    const fileBytes = view.getUint32(cursor + 24, true)
    if ((flags & 1) !== 0 || ![0, 8].includes(method) || fileBytes === 0xffffffff) fail('Cette archive ZIP utilise une option non prise en charge.')
    expanded += fileBytes
    const nameLength = view.getUint16(cursor + 28, true)
    const extraLength = view.getUint16(cursor + 30, true)
    const commentLength = view.getUint16(cursor + 32, true)
    const nameEnd = cursor + 46 + nameLength
    if (nameEnd > bytes.length) fail('Cette archive ZIP ne peut pas être ouverte.')
    const path = decoder.decode(bytes.subarray(cursor + 46, nameEnd))
    if (!path || paths.has(path)) fail('L’archive contient des chemins dupliqués.')
    paths.add(path)
    cursor += 46 + nameLength + extraLength + commentLength
    if (expanded > MAX_EXPANDED_BYTES || cursor > directoryOffset + directorySize) fail('Cette archive est trop volumineuse après ouverture.')
  }
  if (cursor !== directoryOffset + directorySize) fail('Cette archive ZIP ne peut pas être ouverte.')
}

export async function createArchive(trip: Trip, upcoming: UpcomingTrip[], createdAt = new Date().toISOString(), personalJournals?: Journals): Promise<Blob> {
  if (!validateTrip(trip)) fail('Le carnet local ne peut pas être sauvegardé.')
  if (!validateUpcoming(upcoming)) fail('Les prochains voyages locaux ne peuvent pas être sauvegardés.')
  if (personalJournals !== undefined && !validateJournals(personalJournals)) fail('Les carnets personnels locaux ne peuvent pas être sauvegardés.')
  const upcomingBytes = encoder.encode(JSON.stringify(upcoming))
  const files: Record<string, Uint8Array> = { 'upcoming.json': upcomingBytes }
  let mediaCount = 0
  let payloadBytes = 0
  const drafts: ArchiveDraft[] = []
  for (let chapterIndex = 0; chapterIndex < trip.drafts.length; chapterIndex += 1) {
    const draft = trip.drafts[chapterIndex]
    const media: ArchiveMedia[] = []
    for (let mediaIndex = 0; mediaIndex < draft.media.length; mediaIndex += 1) {
      const item = draft.media[mediaIndex]
      const decoded = dataUrlBytes(item.src)
      if (decoded.bytes.byteLength > MAX_MEDIA_BYTES) fail(`« ${item.name} » est trop volumineuse pour cette sauvegarde.`)
      const path = `media/${String(chapterIndex + 1).padStart(3, '0')}-${safeSegment(draft.id)}/${String(mediaIndex + 1).padStart(3, '0')}-${safeSegment(item.id)}.${extension(decoded.mime)}`
      if (files[path]) fail('Deux médias produisent le même chemin de sauvegarde.')
      files[path] = decoded.bytes
      payloadBytes += decoded.bytes.byteLength
      mediaCount += 1
      if (mediaCount > MAX_MEDIA || payloadBytes > MAX_EXPANDED_BYTES) fail('Le carnet est trop volumineux pour une sauvegarde portable.')
      media.push({ id: item.id, name: item.name, mime: decoded.mime, path, bytes: decoded.bytes.byteLength, sha256: await digest(decoded.bytes) })
    }
    const { media: _media, ...record } = draft
    drafts.push({ ...record, media })
  }
  let personalDescriptor: Manifest['personalJournals']
  if (personalJournals !== undefined) {
    const archived: ArchivePersonalJournal[] = []
    for (let journalIndex = 0; journalIndex < personalJournals.journals.length; journalIndex += 1) {
      const journal = personalJournals.journals[journalIndex]
      const chapters: ArchiveDraft[] = []
      for (let chapterIndex = 0; chapterIndex < journal.chapters.length; chapterIndex += 1) {
        const chapter = journal.chapters[chapterIndex]
        const media: ArchiveMedia[] = []
        for (let mediaIndex = 0; mediaIndex < chapter.media.length; mediaIndex += 1) {
          const item = chapter.media[mediaIndex]
          const decoded = dataUrlBytes(item.src)
          if (decoded.bytes.byteLength > MAX_MEDIA_BYTES) fail(`« ${item.name} » est trop volumineuse pour cette sauvegarde.`)
          const path = `personal/${String(journalIndex + 1).padStart(3, '0')}-${safeSegment(journal.tripId)}/${String(chapterIndex + 1).padStart(3, '0')}-${safeSegment(chapter.id)}/${String(mediaIndex + 1).padStart(3, '0')}-${safeSegment(item.id)}.${extension(decoded.mime)}`
          if (files[path]) fail('Deux médias produisent le même chemin de sauvegarde.')
          files[path] = decoded.bytes
          payloadBytes += decoded.bytes.byteLength
          mediaCount += 1
          if (mediaCount > MAX_MEDIA || payloadBytes > MAX_EXPANDED_BYTES) fail('Les carnets sont trop volumineux pour une sauvegarde portable.')
          media.push({ id: item.id, name: item.name, mime: decoded.mime, path, bytes: decoded.bytes.byteLength, sha256: await digest(decoded.bytes) })
        }
        const { media: _media, ...record } = chapter
        chapters.push({ ...record, media })
      }
      archived.push({ tripId: journal.tripId, destination: journal.destination, departure: journal.departure, chapters })
    }
    const payload = { version: 1 as const, journals: archived }
    const bytes = encoder.encode(JSON.stringify(payload))
    files['personal-journals.json'] = bytes
    personalDescriptor = { path: 'personal-journals.json', bytes: bytes.byteLength, sha256: await digest(bytes) }
  }
  const manifest: Manifest = { product: 'Un soir là-bas', format: archiveFormat, version: archiveVersion, tripId, createdAt, records: drafts.length, media: mediaCount, bytes: payloadBytes, journal: { version: 1, drafts }, upcoming: { path: 'upcoming.json', bytes: upcomingBytes.byteLength, sha256: await digest(upcomingBytes) }, ...(personalDescriptor ? { personalJournals: personalDescriptor } : {}) }
  files['manifest.json'] = encoder.encode(JSON.stringify(manifest, null, 2))
  const archive = new Blob([zipSync(files, { level: 0 })], { type: 'application/zip' })
  if (archive.size > MAX_ARCHIVE_BYTES) fail('Le carnet dépasse 25 Mo et ne peut pas être restauré sur un autre appareil dans ce format.')
  return archive
}

export async function previewArchive(file: File): Promise<Preview> {
  if (!file.name.toLowerCase().endsWith('.zip') || file.size <= 0 || file.size > MAX_ARCHIVE_BYTES) fail('Choisissez une sauvegarde ZIP compatible, de moins de 25 Mo.')
  const input = new Uint8Array(await file.arrayBuffer())
  let contents: Record<string, Uint8Array>
  try { preflightZip(input); contents = unzipSync(input) } catch (error) { fail(error instanceof Error ? error.message : 'Cette archive ZIP ne peut pas être ouverte.') }
  const entries = Object.entries(contents)
  if (entries.length === 0 || entries.length > MAX_FILES) fail('Cette archive contient trop de fichiers.')
  let expanded = 0
  for (const [path, bytes] of entries) {
    if (!path || path.startsWith('/') || path.includes('\\') || path.split('/').some(part => part === '..' || part === '.')) fail('Cette archive contient un chemin interdit.')
    expanded += bytes.byteLength
  }
  if (expanded > MAX_EXPANDED_BYTES) fail('Cette archive est trop volumineuse après ouverture.')
  const manifestBytes = contents['manifest.json']
  if (!manifestBytes) fail('Le manifeste de sauvegarde est introuvable.')
  let manifest: Manifest
  try { manifest = parseManifest(JSON.parse(decoder.decode(manifestBytes))) } catch (error) { fail(error instanceof Error ? error.message : 'Le manifeste de sauvegarde est invalide.') }
  const expected = exactPaths(manifest)
  const personalPaths = new Set<string>()
  let upcoming: UpcomingTrip[] | undefined
  if (manifest.upcoming) {
    const bytes = contents[manifest.upcoming.path]
    if (!bytes || bytes.byteLength !== manifest.upcoming.bytes || await digest(bytes) !== manifest.upcoming.sha256) fail('La collection des prochains voyages a été modifiée ou est incomplète.')
    try {
      const parsed: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
      if (!validateUpcoming(parsed)) fail('La collection des prochains voyages est invalide.')
      upcoming = parsed
    } catch (error) { fail(error instanceof Error ? error.message : 'La collection des prochains voyages est invalide.') }
  }
  let personalJournals: Journals | undefined
  let mediaCount = 0
  let payloadBytes = 0
  if (manifest.personalJournals) {
    const bytes = contents[manifest.personalJournals.path]
    if (!bytes || bytes.byteLength !== manifest.personalJournals.bytes || await digest(bytes) !== manifest.personalJournals.sha256) fail('Les carnets personnels de l’archive ont été modifiés ou sont incomplets.')
    let parsed: unknown
    try { parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) } catch { fail('Les carnets personnels de l’archive sont invalides.') }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !exactObject(parsed, ['version', 'journals']) || parsed.version !== 1 || !Array.isArray(parsed.journals) || parsed.journals.length > 12) fail('Les carnets personnels de l’archive sont invalides.')
    const restored = []
    const journalIds = new Set<string>()
    for (const journal of parsed.journals) {
      if (!journal || typeof journal !== 'object' || Array.isArray(journal) || !exactObject(journal, ['tripId', 'destination', 'departure', 'chapters']) || !Array.isArray(journal.chapters) || typeof journal.tripId !== 'string' || journalIds.has(journal.tripId)) fail('Un carnet personnel de l’archive est invalide.')
      journalIds.add(journal.tripId)
      const chapters: Draft[] = []
      const chapterIds = new Set<string>()
      for (const chapter of journal.chapters) {
        if (!chapter || typeof chapter !== 'object' || Array.isArray(chapter) || !exactObject(chapter, ['id', 'title', 'memories', 'tone', 'story', 'coverId', 'status', 'media']) || typeof chapter.id !== 'string' || chapterIds.has(chapter.id) || !Array.isArray(chapter.media)) fail('Un chapitre personnel de l’archive est invalide.')
        chapterIds.add(chapter.id)
        const media = []
        const mediaIds = new Set<string>()
        for (const asset of chapter.media) {
          if (!asset || typeof asset !== 'object' || Array.isArray(asset) || !exactObject(asset, ['id', 'name', 'mime', 'path', 'bytes', 'sha256']) || typeof asset.id !== 'string' || mediaIds.has(asset.id) || typeof asset.name !== 'string' || typeof asset.path !== 'string' || !validPath(asset.path) || !['image/jpeg', 'image/png', 'image/webp'].includes(String(asset.mime)) || typeof asset.bytes !== 'number' || !Number.isSafeInteger(asset.bytes) || asset.bytes < 0 || !/^[a-f0-9]{64}$/.test(String(asset.sha256))) fail('Un média personnel de l’archive est invalide.')
          mediaIds.add(asset.id)
          if (personalPaths.has(asset.path)) fail('L’archive contient des chemins dupliqués.')
          personalPaths.add(asset.path)
          const data = contents[asset.path]
          if (!data || data.byteLength > MAX_MEDIA_BYTES || data.byteLength !== asset.bytes || !matchesMime(String(asset.mime), data) || await digest(data) !== asset.sha256 || !asset.path.endsWith(`.${extension(String(asset.mime))}`)) fail('Un média personnel de l’archive a été modifié ou est incomplet.')
          payloadBytes += data.byteLength
          mediaCount += 1
          if (mediaCount > MAX_MEDIA) fail('Cette archive contient trop de médias.')
          media.push({ id: asset.id, name: asset.name, src: bytesDataUrl(String(asset.mime), data) })
        }
        const { media: _archiveMedia, ...draft } = chapter
        chapters.push({ ...draft, media } as Draft)
      }
      restored.push({ tripId: journal.tripId, destination: journal.destination, departure: journal.departure, chapters })
    }
    const result: unknown = { version: 1, journals: restored }
    if (!validateJournals(result)) fail('Les carnets personnels de l’archive sont invalides.')
    personalJournals = result
  }
  const drafts: Draft[] = []
  const ids = new Set<string>()
  for (const archiveDraft of manifest.journal.drafts) {
    if (typeof archiveDraft.id !== 'string' || ids.has(archiveDraft.id)) fail('Cette archive contient des identifiants dupliqués.')
    ids.add(archiveDraft.id)
    const media = []
    const mediaIds = new Set<string>()
    for (const asset of archiveDraft.media ?? []) {
      if (!asset || typeof asset.id !== 'string' || mediaIds.has(asset.id) || typeof asset.name !== 'string' || typeof asset.path !== 'string' || !validPath(asset.path) || !['image/jpeg', 'image/png', 'image/webp'].includes(asset.mime) || typeof asset.bytes !== 'number' || !/^[a-f0-9]{64}$/.test(asset.sha256)) fail('Un média de cette archive est invalide.')
      mediaIds.add(asset.id)
      const bytes = contents[asset.path]
      if (!bytes || bytes.byteLength > MAX_MEDIA_BYTES || bytes.byteLength !== asset.bytes || !matchesMime(asset.mime, bytes) || await digest(bytes) !== asset.sha256) fail('Un média de cette archive a été modifié, n’est pas du type annoncé ou est incomplet.')
      const suffix = extension(asset.mime)
      if (!asset.path.endsWith(`.${suffix}`)) fail('Le type d’un média ne correspond pas à son fichier.')
      payloadBytes += bytes.byteLength
      mediaCount += 1
      if (mediaCount > MAX_MEDIA) fail('Cette archive contient trop de médias.')
      media.push({ id: asset.id, name: asset.name, src: bytesDataUrl(asset.mime, bytes) })
    }
    const { media: _assets, ...record } = archiveDraft
    drafts.push({ ...record, media } as Draft)
  }
  const trip: Trip = { version: 1, drafts }
  for (const path of personalPaths) {
    if (expected.has(path)) fail('L’archive contient des chemins dupliqués.')
    expected.add(path)
  }
  if (expected.size !== entries.length || entries.some(([path]) => !expected.has(path))) fail('Cette archive contient des fichiers inattendus ou manquants.')
  if (!validateTrip(trip) || manifest.records !== drafts.length || manifest.media !== mediaCount || manifest.bytes !== payloadBytes) fail('Les données du carnet sont invalides ou incomplètes.')
  return { trip, upcoming, personalJournals, createdAt: manifest.createdAt, records: manifest.records, media: manifest.media, bytes: manifest.bytes }
}

export function archiveFilename(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `un-soir-la-bas-voyages-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}.zip`
}
