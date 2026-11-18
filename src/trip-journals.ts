import type { Draft } from './journal'
import { validateTrip } from './journal'
import { cleanupOrphanedMediaUnlocked, persistDraftMediaUnlocked, storedDraft, withMediaDurabilityLock } from './media-store'
import { readUpcoming, upcomingKey, validateUpcomingTrips } from './upcoming-trips'
import type { UpcomingTrip } from './upcoming-trips'

export const journalsKey = 'un-soir-la-bas-journals-v1'
export type PersonalJournal = { tripId: string; destination: string; departure: string; chapters: Draft[] }
export type Journals = { version: 1; journals: PersonalJournal[] }
function chapterContent(chapter: Draft): string {
  return JSON.stringify([chapter.title, chapter.story, chapter.memories, chapter.tone, chapter.coverId, chapter.status,
    chapter.plannedStep && [chapter.plannedStep.tripId, chapter.plannedStep.stepId, chapter.plannedStep.place],
    chapter.media.map(item => [item.id, item.name, item.storageRef ? `idb:media:${item.storageRef}` : item.src, item.width, item.height])])
}

export const legacyId = 'legacy-philippines-journal'

export function validateJournals(value: unknown): value is Journals {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const envelope = value as Record<string, unknown>
  if (Object.keys(envelope).some(key => !['version', 'journals'].includes(key)) || envelope.version !== 1 || !Array.isArray(envelope.journals) || envelope.journals.length > 12) return false
  const ids = new Set<string>()
  return envelope.journals.every(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false
    const journal = item as Record<string, unknown>
    if (Object.keys(journal).length !== 4 || typeof journal.tripId !== 'string' || !journal.tripId || journal.tripId.length > 160 || ids.has(journal.tripId) ||
      typeof journal.destination !== 'string' || !journal.destination.trim() || journal.destination.length > 80 ||
      typeof journal.departure !== 'string' || (journal.departure !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(journal.departure)) || !Array.isArray(journal.chapters) || journal.chapters.length > 40) return false
    ids.add(journal.tripId)
    return validateTrip({ version: 1, drafts: journal.chapters })
  })
}

export function readJournals(): { data: Journals; error: string } {
  try {
    const raw = localStorage.getItem(journalsKey)
    const data: unknown = raw === null ? { version: 1, journals: [] } : JSON.parse(raw)
    if (!validateJournals(data)) throw new Error('format')
    // Initial migration preserves the historical bytes. Explicit edits later mirror both stores.
    if (!data.journals.some(item => item.tripId === legacyId)) {
      const old = localStorage.getItem('philippines-trip')
      if (old !== null) {
        const parsed: unknown = JSON.parse(old)
        if (!validateTrip(parsed)) throw new Error('historical format')
        if (parsed.drafts.length) {
          const next = { version: 1 as const, journals: [...data.journals, { tripId: legacyId, destination: 'Philippines', departure: '', chapters: parsed.drafts }] }
          // Keep the original journal readable even when the personal-journal cap is reached.
          if (!validateJournals(next)) return { data, error: '' }
          // Read-only projection: the next locked save will persist the legacy journal with new data.
          return { data: next, error: '' }
        }
      }
    }
    const legacy = data.journals.find(item => item.tripId === legacyId)
    const rawLegacy = localStorage.getItem('philippines-trip')
    if (legacy && rawLegacy) {
      const historical: unknown = JSON.parse(rawLegacy)
      if (!validateTrip(historical)) throw new Error('historical format')
      {
        const chapters = [...legacy.chapters]
        for (const chapter of historical.drafts) {
          const current = chapters.find(item => item.id === chapter.id)
          if (!current) chapters.push(chapter)
          else if (chapterContent(current) !== chapterContent(chapter) && !chapters.some(item => item.id.startsWith(`${chapter.id.slice(0, 130)}-historique-`) && item.title === `${chapter.title.slice(0, 95)} · version historique` && chapterContent({ ...item, title: chapter.title }) === chapterContent(chapter))) {
            let suffix = 1
            let id = `${chapter.id.slice(0, 130)}-historique-${suffix}`
            while (chapters.some(item => item.id === id)) id = `${chapter.id.slice(0, 130)}-historique-${++suffix}`
            chapters.push({ ...chapter, id, title: `${chapter.title.slice(0, 95)} · version historique` })
          }
        }
        if (chapters.length > 40) throw new Error('historical conflict capacity')
        legacy.chapters = chapters
      }
    }
    const upcoming = readUpcoming()
    return { data: { ...data, journals: data.journals.map(journal => {
      const trip = upcoming.trips.find(item => item.id === journal.tripId)
      return trip ? { ...journal, destination: trip.destination, departure: trip.departure } : journal
    }) }, error: '' }
  } catch {
    return { data: { version: 1, journals: [] }, error: 'Les carnets personnels ne peuvent pas être lus. Vos données n’ont pas été modifiées ; les données originales sont conservées. Vérifiez le stockage avant tout enregistrement.' }
  }
}

export function journalForTrip(data: Journals, trip: UpcomingTrip): PersonalJournal {
  return data.journals.find(item => item.tripId === trip.id) ?? { tripId: trip.id, destination: trip.destination, departure: trip.departure, chapters: [] }
}

export function persistLegacyJournalUnlocked() {
  const current = readJournals()
  if (current.error) throw new Error(current.error)
  if (!current.data.journals.some(item => item.tripId === legacyId)) return
  const raw = localStorage.getItem(journalsKey)
  if (raw !== null) {
    const stored: unknown = JSON.parse(raw)
    if (!validateJournals(stored)) throw new Error('Les carnets personnels ne peuvent pas être lus. Les données originales sont conservées ; vérifiez le stockage avant tout enregistrement.')
    if (stored.journals.some(item => item.tripId === legacyId)) return
  }
  localStorage.setItem(journalsKey, JSON.stringify(current.data))
}

function comparableChapter(chapter: Draft) {
  return JSON.stringify([chapter.id, chapter.title, chapter.memories, chapter.tone, chapter.story, chapter.coverId, chapter.status, chapter.plannedStep && [chapter.plannedStep.tripId, chapter.plannedStep.stepId, chapter.plannedStep.place], chapter.media.map(item => [item.id, item.name, item.storageRef ? `idb:media:${item.storageRef}` : item.src, item.width, item.height])])
}

export async function saveChapter(tripId: string, destination: string, departure: string, chapter: Draft, expected?: Draft | null): Promise<Journals> {
  return withMediaDurabilityLock(async () => {
    const before = readJournals()
    if (before.error) throw new Error(before.error)
    const durableChapter = storedDraft(await persistDraftMediaUnlocked(chapter))
    // Re-read after IndexedDB awaits, while still holding the cross-tab lock.
    const current = readJournals()
    if (current.error) throw new Error(current.error)
    const index = current.data.journals.findIndex(item => item.tripId === tripId)
    const existing = index < 0 ? undefined : current.data.journals[index]
    if (expected !== undefined) {
      const currentChapter = existing?.chapters.find(item => item.id === chapter.id)
      if (expected === null ? Boolean(currentChapter) : !currentChapter || comparableChapter(currentChapter) !== comparableChapter(expected)) {
        throw new Error('Cette journée a changé ou a été supprimée dans un autre onglet. Votre travail reste ouvert ici ; copiez-le avant de rouvrir la journée. Vérifiez aussi le brouillon de récupération.')
      }
    }
    const chapters = replaceChapter(existing?.chapters ?? [], durableChapter)
    const entry: PersonalJournal = { tripId, destination: existing?.destination ?? destination, departure: existing?.departure ?? departure, chapters }
    const journals = [...current.data.journals.filter(item => item.tripId !== tripId), entry]
    if (!validateJournals({ version: 1, journals })) throw new Error('Ce carnet a atteint sa limite de pages ou son format est invalide.')
    const next = { version: 1 as const, journals }
    try {
      if (tripId === legacyId) writeLegacyAndJournals({ version: 1, drafts: chapters }, next)
      else localStorage.setItem(journalsKey, JSON.stringify(next))
    }
    catch { throw new Error('L’enregistrement n’a pas abouti : le stockage est plein ou indisponible. Vos données restent ouvertes ici.') }
    await cleanupOrphanedMediaUnlocked()
    window.dispatchEvent(new Event('trip-journals-updated'))
    return next
  })
}

export function upcomingForJournal(tripId: string): UpcomingTrip | undefined {
  try {
    const raw = localStorage.getItem(upcomingKey)
    if (!raw) return undefined
    const trips: unknown = JSON.parse(raw)
    if (!Array.isArray(trips)) return undefined
    return trips.find(item => item && typeof item === 'object' && item.id === tripId) as UpcomingTrip | undefined
  } catch { return undefined }
}

export function replaceChapter(chapters: Draft[], chapter: Draft): Draft[] {
  return chapters.some(item => item.id === chapter.id)
    ? chapters.map(item => item.id === chapter.id ? chapter : item)
    : [...chapters, chapter]
}

function writeLegacyAndJournals(trip: { version: 1; drafts: Draft[] }, journals: Journals) {
  const previous = localStorage.getItem('philippines-trip')
  localStorage.setItem('philippines-trip', JSON.stringify(trip))
  try { localStorage.setItem(journalsKey, JSON.stringify(journals)) }
  catch (error) {
    if (previous === null) localStorage.removeItem('philippines-trip')
    else localStorage.setItem('philippines-trip', previous)
    throw error
  }
}

export async function savePersonalChapter(chapter: Draft, expected?: Draft | null) {
  return saveChapter(legacyId, 'Philippines', '', chapter, expected)
}

/** Keep a retained journal's identity current even after its planning card is removed. */
export function saveUpcomingMetadataUnlocked(trips: UpcomingTrip[]) {
  if (!validateUpcomingTrips(trips)) throw new Error('Voyages invalides.')
  const previous = localStorage.getItem(journalsKey)
  if (previous === null) {
    localStorage.setItem(upcomingKey, JSON.stringify(trips))
    return
  }
  const journals: unknown = JSON.parse(previous)
  if (!validateJournals(journals)) throw new Error('Les carnets personnels ne peuvent pas être lus.')
  const next: Journals = { ...journals, journals: journals.journals.map(journal => {
    const trip = trips.find(item => item.id === journal.tripId)
    return trip ? { ...journal, destination: trip.destination, departure: trip.departure } : journal
  }) }
  localStorage.setItem(journalsKey, JSON.stringify(next))
  try { localStorage.setItem(upcomingKey, JSON.stringify(trips)) }
  catch (error) { localStorage.setItem(journalsKey, previous); throw error }
}

export async function saveUpcomingMetadata(trips: UpcomingTrip[]) {
  return withMediaDurabilityLock(async () => saveUpcomingMetadataUnlocked(trips))
}
