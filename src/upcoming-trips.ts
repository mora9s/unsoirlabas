import { createId } from './id'

export const upcomingKey = 'un-soir-la-bas-upcoming-v1'
export type UpcomingTrip = { id: string; destination: string; departure: string }

export function calendarDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function dateParts(value: string): [number, number, number] | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3])
  const check = new Date(year, month - 1, day)
  return check.getFullYear() === year && check.getMonth() === month - 1 && check.getDate() === day ? [year, month, day] : null
}

export function daysUntil(departure: string, now: Date): number | null {
  const parts = dateParts(departure)
  if (!parts) return null
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((Date.UTC(parts[0], parts[1] - 1, parts[2]) - today) / 86400000)
}

export function readUpcoming(): { trips: UpcomingTrip[]; error: string } {
  try {
    const raw = localStorage.getItem(upcomingKey)
    if (!raw) return { trips: [], error: '' }
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length > 12 || !parsed.every(item =>
      item && typeof item === 'object' && typeof item.id === 'string' && item.id.length > 0 && item.id.length <= 160 &&
      typeof item.destination === 'string' && item.destination.trim().length > 0 && item.destination.length <= 80 &&
      typeof item.departure === 'string' && dateParts(item.departure)
    )) throw new Error('Invalid trips')
    const trips = parsed as UpcomingTrip[]
    if (new Set(trips.map(trip => trip.id)).size !== trips.length) throw new Error('Duplicate trips')
    return { trips, error: '' }
  } catch {
    return { trips: [], error: 'Impossible de lire les décomptes enregistrés. Les données n’ont pas été modifiées ; vérifiez le stockage de ce navigateur avant d’enregistrer.' }
  }
}

export function newUpcoming(destination: string, departure: string): UpcomingTrip {
  return { id: createId(), destination: destination.trim(), departure }
}
