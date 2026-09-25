import type { Draft } from './journal'
import { validateTrip } from './journal'

export const journalsKey = 'un-soir-la-bas-journals-v1'
export type PersonalJournal = { tripId: string; destination: string; departure: string; chapters: Draft[] }
export type Journals = { version: 1; journals: PersonalJournal[] }

const empty: Journals = { version: 1, journals: [] }
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const validId = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 160
const validDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export function validateJournals(value: unknown): value is Journals {
  if (!isObject(value) || Object.keys(value).length !== 2 || value.version !== 1 || !Array.isArray(value.journals) || value.journals.length > 12) return false
  const ids = new Set<string>()
  return value.journals.every(item => {
    if (!isObject(item) || Object.keys(item).length !== 4 || !validId(item.tripId) || ids.has(item.tripId) ||
      typeof item.destination !== 'string' || !item.destination.trim() || item.destination.length > 80 ||
      typeof item.departure !== 'string' || (item.departure !== '' && !validDate(item.departure)) ||
      !Array.isArray(item.chapters) || item.chapters.length > 40 || !validateTrip({ version: 1, drafts: item.chapters })) return false
    ids.add(item.tripId)
    if (!item.chapters.every(chapter => isObject(chapter) && Object.keys(chapter).length === 8 && ['id', 'title', 'memories', 'tone', 'story', 'media', 'coverId', 'status'].every(key => Object.prototype.hasOwnProperty.call(chapter, key)) && Array.isArray(chapter.media) && chapter.media.every(media => isObject(media) && Object.keys(media).length === 3 && ['id', 'name', 'src'].every(key => Object.prototype.hasOwnProperty.call(media, key))))) return false
    return true
  })
}

export function readJournals(): { data: Journals; error: string } {
  try {
    const raw = localStorage.getItem(journalsKey)
    if (raw === null) return { data: empty, error: '' }
    const data: unknown = JSON.parse(raw)
    if (!validateJournals(data)) throw new Error('invalid')
    return { data, error: '' }
  } catch {
    return { data: empty, error: 'Les carnets personnels ne peuvent pas être lus. Les données originales sont conservées ; vérifiez le stockage avant tout enregistrement.' }
  }
}

export function journalForTrip(data: Journals, trip: { id: string; destination: string; departure: string }): PersonalJournal {
  return data.journals.find(item => item.tripId === trip.id) ?? { tripId: trip.id, destination: trip.destination, departure: trip.departure, chapters: [] }
}

export function saveChapter(tripId: string, destination: string, departure: string, chapter: Draft): Journals {
  const current = readJournals()
  if (current.error) throw new Error(current.error)
  if (!validId(tripId) || typeof destination !== 'string' || !destination.trim() || destination.length > 80 ||
    typeof departure !== 'string' || (departure !== '' && !validDate(departure)) || !validateTrip({ version: 1, drafts: [chapter] })) {
    throw new Error('Les informations de ce carnet sont invalides.')
  }
  const existing = current.data.journals.find(item => item.tripId === tripId)
  const oldChapters = existing?.chapters ?? []
  const chapterIndex = oldChapters.findIndex(item => item.id === chapter.id)
  const chapters = chapterIndex < 0 ? [...oldChapters, chapter] : oldChapters.map((item, index) => index === chapterIndex ? chapter : item)
  const entry: PersonalJournal = { tripId, destination: destination.trim(), departure, chapters }
  const next: Journals = { version: 1, journals: [...current.data.journals.filter(item => item.tripId !== tripId), entry] }
  if (!validateJournals(next)) throw new Error('Ce carnet a atteint sa limite de pages ou son format est invalide.')
  try { localStorage.setItem(journalsKey, JSON.stringify(next)) }
  catch { throw new Error('L’enregistrement n’a pas abouti : le stockage est plein ou indisponible. Vos données restent ouvertes ici.') }
  window.dispatchEvent(new Event('trip-journals-updated'))
  return next
}
