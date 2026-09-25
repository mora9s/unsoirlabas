import type { Draft } from './journal'
import { validateTrip } from './journal'
import { upcomingKey } from './upcoming-trips'
import type { UpcomingTrip } from './upcoming-trips'

export const journalsKey = 'un-soir-la-bas-journals-v1'
export type PersonalJournal = { tripId: string; destination: string; departure: string; chapters: Draft[] }
export type Journals = { version: 1; journals: PersonalJournal[] }
const legacyId = 'legacy-philippines-journal'

export function validateJournals(value: unknown): value is Journals {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const envelope = value as Record<string, unknown>
  if (envelope.version !== 1 || !Array.isArray(envelope.journals) || envelope.journals.length > 12) return false
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
    // One-way copy: keep the original legacy key byte-for-byte for old links and recovery.
    if (!data.journals.some(item => item.tripId === legacyId)) {
      const old = localStorage.getItem('philippines-trip')
      if (old !== null) {
        const parsed: unknown = JSON.parse(old)
        if (validateTrip(parsed) && parsed.drafts.length) {
          const next = { version: 1 as const, journals: [...data.journals, { tripId: legacyId, destination: 'Philippines', departure: '', chapters: parsed.drafts }] }
          // Keep the original journal readable even when the personal-journal cap is reached.
          if (!validateJournals(next)) return { data, error: '' }
          localStorage.setItem(journalsKey, JSON.stringify(next))
          return { data: next, error: '' }
        }
      }
    }
    return { data, error: '' }
  } catch {
    return { data: { version: 1, journals: [] }, error: 'Les carnets personnels ne peuvent pas être lus. Les données originales sont conservées ; vérifiez le stockage avant tout enregistrement.' }
  }
}

export function journalForTrip(data: Journals, trip: UpcomingTrip): PersonalJournal {
  return data.journals.find(item => item.tripId === trip.id) ?? { tripId: trip.id, destination: trip.destination, departure: trip.departure, chapters: [] }
}

export function saveChapter(tripId: string, destination: string, departure: string, chapter: Draft): Journals {
  const current = readJournals()
  if (current.error) throw new Error(current.error)
  const index = current.data.journals.findIndex(item => item.tripId === tripId)
  const existing = index < 0 ? undefined : current.data.journals[index]
  const chapters = [...(existing?.chapters ?? []).filter(item => item.id !== chapter.id), chapter]
  const entry: PersonalJournal = { tripId, destination: existing?.destination ?? destination, departure: existing?.departure ?? departure, chapters }
  const journals = [...current.data.journals.filter(item => item.tripId !== tripId), entry]
  if (!validateJournals({ version: 1, journals })) throw new Error('Ce carnet a atteint sa limite de pages ou son format est invalide.')
  const next = { version: 1 as const, journals }
  try { localStorage.setItem(journalsKey, JSON.stringify(next)) }
  catch { throw new Error('L’enregistrement n’a pas abouti : le stockage est plein ou indisponible. Vos données restent ouvertes ici.') }
  window.dispatchEvent(new Event('trip-journals-updated'))
  return next
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
