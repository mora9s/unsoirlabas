import { unzipSync, zipSync } from 'fflate'
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex } from '@noble/hashes/utils.js'
import type { Draft, Trip } from './journal'
import { validateTrip } from './journal'
import { readJournals, validateJournals } from './trip-journals'
import type { Journals, PersonalJournal } from './trip-journals'
import { readUpcoming, validateUpcomingTrips } from './upcoming-trips'
import type { UpcomingTrip } from './upcoming-trips'

export const archiveFormat = 'les-jours-au-large-journal'
export const archiveVersion = 2
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
type PersonalJournalDescriptor = { path: 'personal-journals.json'; bytes: number; sha256: string }
type ArchiveProduct = 'Un soir là-bas' | 'Les jours au large'
const compatibleProducts: readonly ArchiveProduct[] = ['Un soir là-bas', 'Les jours au large']
type Manifest = {
  product: ArchiveProduct
  format: typeof archiveFormat
  version: 1 | typeof archiveVersion
  tripId: typeof tripId
  createdAt: string
  records: number
  media: number
  bytes: number
  journal: { version: 1; drafts: ArchiveDraft[] }
  upcoming?: { version: 1; trips: UpcomingTrip[] }
  // v2 originally embedded data URLs in this collection. New archives use a
  // checksummed JSON collection whose chapter media live as ZIP entries.
  personalJournals?: Journals | PersonalJournalDescriptor
}

type Preview = { trip: Trip; upcomingTrips?: UpcomingTrip[]; personalJournals?: Journals; createdAt: string; records: number; media: number; bytes: number }

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
  if (manifest.personalJournals && !('journals' in manifest.personalJournals)) paths.add(manifest.personalJournals.path)
  for (const draft of manifest.journal.drafts) for (const media of draft.media) {
    if (paths.has(media.path)) fail('L’archive contient des chemins dupliqués.')
    paths.add(media.path)
  }
  return paths
}
function validPath(path: string) {
  return /^(?:media\/[a-zA-Z0-9_-]+|personal\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+)\/[a-zA-Z0-9_-]+\.(jpg|png|webp)$/.test(path) && !path.includes('..')
}
function parseManifest(value: unknown): Manifest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Le manifeste contient des champs inconnus ou incomplets.')
  const version = (value as { version?: unknown }).version
  const keys = version === 1
    ? ['product', 'format', 'version', 'tripId', 'createdAt', 'records', 'media', 'bytes', 'journal']
    : ['product', 'format', 'version', 'tripId', 'createdAt', 'records', 'media', 'bytes', 'journal', 'upcoming']
  if (!exactObject(value, keys) && !(version === 2 && exactObject(value, [...keys, 'personalJournals']))) fail('Le manifeste contient des champs inconnus ou incomplets.')
  const manifest = value as Manifest
  if (!compatibleProducts.includes(manifest.product) || manifest.format !== archiveFormat || ![1, archiveVersion].includes(manifest.version) || manifest.tripId !== tripId) fail('Cette sauvegarde n’est pas compatible avec ce carnet.')
  if (typeof manifest.createdAt !== 'string' || Number.isNaN(Date.parse(manifest.createdAt)) || !exactObject(manifest.journal, ['version', 'drafts']) || manifest.journal.version !== 1 || !Array.isArray(manifest.journal.drafts)) fail('Le manifeste de sauvegarde est invalide.')
  if (manifest.version === 2 && (!exactObject(manifest.upcoming, ['version', 'trips']) || manifest.upcoming.version !== 1 || !validateUpcomingTrips(manifest.upcoming.trips))) fail('Les décomptes de cette archive sont invalides.')
  if (typeof manifest.records !== 'number' || !Number.isSafeInteger(manifest.records) || manifest.records < 0 || typeof manifest.media !== 'number' || !Number.isSafeInteger(manifest.media) || manifest.media < 0 || typeof manifest.bytes !== 'number' || !Number.isSafeInteger(manifest.bytes) || manifest.bytes < 0) fail('Les décomptes de cette archive sont invalides.')
  if (manifest.personalJournals !== undefined) {
    const value = manifest.personalJournals
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Les carnets personnels de cette archive sont invalides.')
    if ('journals' in value) {
      if (!validateJournals(value)) fail('Les carnets personnels de cette archive sont invalides.')
    } else if (!exactObject(value, ['path', 'bytes', 'sha256']) || value.path !== 'personal-journals.json' || !Number.isSafeInteger(value.bytes) || value.bytes < 0 || !/^[a-f0-9]{64}$/.test(value.sha256)) fail('Les carnets personnels de cette archive sont invalides.')
  }
  if (manifest.journal.drafts.length > MAX_RECORDS) fail('Cette sauvegarde contient trop de chapitres.')
  for (const draft of manifest.journal.drafts) {
    if (!exactObject(draft, ['id', 'title', 'memories', 'tone', 'story', 'coverId', 'status', 'media']) || !Array.isArray(draft.media)) fail('Un chapitre du manifeste contient des champs inconnus ou incomplets.')
    for (const media of draft.media) {
      if (!exactObject(media, ['id', 'name', 'mime', 'path', 'bytes', 'sha256'])) fail('Un média du manifeste contient des champs inconnus ou incomplets.')
    }
  }
  return manifest
}

async function restorePersonalJournals(value: Journals | PersonalJournalDescriptor | undefined, contents: Record<string, Uint8Array>) {
  if (!value) return { journals: undefined, media: 0, bytes: 0, paths: new Set<string>() }
  // Compatibility with the original v2 format, which stored data URLs inline.
  if ('journals' in value) return { journals: value, media: 0, bytes: 0, paths: new Set<string>() }
  const payload = contents[value.path]
  if (!payload || payload.byteLength !== value.bytes || await digest(payload) !== value.sha256) fail('Les carnets personnels de l’archive ont été modifiés ou sont incomplets.')
  let parsed: unknown
  try { parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(payload)) } catch { fail('Les carnets personnels de l’archive sont invalides.') }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !exactObject(parsed, ['version', 'journals']) || parsed.version !== 1 || !Array.isArray(parsed.journals) || parsed.journals.length > 12) fail('Les carnets personnels de l’archive sont invalides.')
  const journals: PersonalJournal[] = []
  const journalIds = new Set<string>()
  const paths = new Set<string>()
  let mediaCount = 0
  let mediaBytes = 0
  for (const journal of parsed.journals) {
    if (!journal || typeof journal !== 'object' || Array.isArray(journal) || !exactObject(journal, ['tripId', 'destination', 'departure', 'chapters']) || !Array.isArray(journal.chapters) || typeof journal.tripId !== 'string' || !journal.tripId || typeof journal.destination !== 'string' || typeof journal.departure !== 'string' || journal.chapters.length > MAX_RECORDS || journalIds.has(journal.tripId)) fail('Un carnet personnel de l’archive est invalide.')
    journalIds.add(journal.tripId)
    const chapters: Draft[] = []
    const chapterIds = new Set<string>()
    for (const chapter of journal.chapters) {
      if (!chapter || typeof chapter !== 'object' || Array.isArray(chapter) || !exactObject(chapter, ['id', 'title', 'memories', 'tone', 'story', 'coverId', 'status', 'media']) || typeof chapter.id !== 'string' || chapterIds.has(chapter.id) || !Array.isArray(chapter.media)) fail('Un chapitre personnel de l’archive est invalide.')
      chapterIds.add(chapter.id)
      const media: Draft['media'] = []
      const ids = new Set<string>()
      for (const asset of chapter.media) {
        if (!asset || typeof asset !== 'object' || Array.isArray(asset) || !exactObject(asset, ['id', 'name', 'mime', 'path', 'bytes', 'sha256']) || typeof asset.id !== 'string' || ids.has(asset.id) || typeof asset.name !== 'string' || typeof asset.path !== 'string' || !validPath(asset.path) || !asset.path.startsWith('personal/') || !['image/jpeg', 'image/png', 'image/webp'].includes(String(asset.mime)) || typeof asset.bytes !== 'number' || !Number.isSafeInteger(asset.bytes) || asset.bytes < 0 || typeof asset.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(asset.sha256)) fail('Un média personnel de l’archive est invalide.')
        ids.add(asset.id)
        if (paths.has(asset.path)) fail('L’archive contient des chemins dupliqués.')
        paths.add(asset.path)
        const data = contents[asset.path]
        if (!data || data.byteLength > MAX_MEDIA_BYTES || data.byteLength !== asset.bytes || !matchesMime(String(asset.mime), data) || await digest(data) !== asset.sha256 || !asset.path.endsWith(`.${extension(String(asset.mime))}`)) fail('Un média personnel de l’archive a été modifié ou est incomplet.')
        mediaBytes += data.byteLength
        mediaCount += 1
        if (mediaCount > MAX_MEDIA) fail('Cette archive contient trop de médias.')
        media.push({ id: asset.id, name: asset.name, src: bytesDataUrl(String(asset.mime), data) })
      }
      const { media: _archiveMedia, ...draft } = chapter
      chapters.push({ ...draft, media } as Draft)
    }
    journals.push({ tripId: journal.tripId, destination: journal.destination, departure: journal.departure, chapters })
  }
  const result: unknown = { version: 1, journals }
  if (!validateJournals(result)) fail('Les carnets personnels de l’archive sont invalides.')
  return { journals: result, media: mediaCount, bytes: mediaBytes, paths }
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

export async function createArchive(trip: Trip, createdAt = new Date().toISOString(), source?: { upcomingTrips: UpcomingTrip[]; personalJournals: Journals }): Promise<Blob> {
  if (!validateTrip(trip)) fail('Le carnet local ne peut pas être sauvegardé.')
  const upcoming = source ? { trips: source.upcomingTrips, error: '' } : readUpcoming()
  if (upcoming.error || !validateUpcomingTrips(upcoming.trips)) fail('Les décomptes locaux ne peuvent pas être sauvegardés tant que leur stockage est invalide.')
  const personal = source ? { data: source.personalJournals, error: '' } : readJournals()
  if (personal.error || !validateJournals(personal.data)) fail('Les carnets locaux ne peuvent pas être sauvegardés tant que leur stockage est invalide.')
  const files: Record<string, Uint8Array> = {}
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
  const archivedJournals: ArchivePersonalJournal[] = []
  for (let journalIndex = 0; journalIndex < personal.data.journals.length; journalIndex += 1) {
    const journal = personal.data.journals[journalIndex]
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
    archivedJournals.push({ tripId: journal.tripId, destination: journal.destination, departure: journal.departure, chapters })
  }
  const personalBytes = encoder.encode(JSON.stringify({ version: 1, journals: archivedJournals }))
  if (personalBytes.byteLength > MAX_EXPANDED_BYTES) fail('Les carnets dépassent la limite de cette sauvegarde portable.')
  files['personal-journals.json'] = personalBytes
  const manifest: Manifest = { product: 'Un soir là-bas', format: archiveFormat, version: archiveVersion, tripId, createdAt, records: drafts.length, media: mediaCount, bytes: payloadBytes, journal: { version: 1, drafts }, upcoming: { version: 1, trips: upcoming.trips }, personalJournals: { path: 'personal-journals.json', bytes: personalBytes.byteLength, sha256: await digest(personalBytes) } }
  files['manifest.json'] = encoder.encode(JSON.stringify(manifest, null, 2))
  if (files['manifest.json'].byteLength > MAX_EXPANDED_BYTES) fail('Les carnets et images dépassent la limite de cette sauvegarde portable.')
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
  const personal = await restorePersonalJournals(manifest.personalJournals, contents)
  for (const path of personal.paths) {
    if (expected.has(path)) fail('L’archive contient des chemins dupliqués.')
    expected.add(path)
  }
  if (expected.size !== entries.length || entries.some(([path]) => !expected.has(path))) fail('Cette archive contient des fichiers inattendus ou manquants.')
  const drafts: Draft[] = []
  const ids = new Set<string>()
  let mediaCount = personal.media
  let payloadBytes = personal.bytes
  for (const archiveDraft of manifest.journal.drafts) {
    if (typeof archiveDraft.id !== 'string' || ids.has(archiveDraft.id)) fail('Cette archive contient des identifiants dupliqués.')
    ids.add(archiveDraft.id)
    const media = []
    const mediaIds = new Set<string>()
    for (const asset of archiveDraft.media ?? []) {
      if (!asset || typeof asset.id !== 'string' || mediaIds.has(asset.id) || typeof asset.name !== 'string' || typeof asset.path !== 'string' || !validPath(asset.path) || !asset.path.startsWith('media/') || !['image/jpeg', 'image/png', 'image/webp'].includes(asset.mime) || typeof asset.bytes !== 'number' || !Number.isSafeInteger(asset.bytes) || asset.bytes < 0 || typeof asset.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(asset.sha256)) fail('Un média de cette archive est invalide.')
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
  if (!validateTrip(trip) || manifest.records !== drafts.length || manifest.media !== mediaCount || manifest.bytes !== payloadBytes) fail('Les données du carnet sont invalides ou incomplètes.')
  return { trip, upcomingTrips: manifest.upcoming?.trips, personalJournals: personal.journals, createdAt: manifest.createdAt, records: manifest.records, media: manifest.media, bytes: manifest.bytes }
}

export function archiveFilename(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `un-soir-la-bas-carnet-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}.zip`
}
