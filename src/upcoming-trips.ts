import { createId } from './id'
import { validateStayPlan } from './stay-composer'

export const upcomingKey = 'un-soir-la-bas-upcoming-v1'
export type PlanItem = { id: string; text: string; point?: { lat: number; lon: number }; category?: string; source?: string }
export const transportModes = { plane: 'Avion', train: 'Train', car: 'Voiture', walk: 'À pied', boat: 'Bateau' } as const
export type TransportMode = keyof typeof transportModes
export type FactualStatus = 'confirmed' | 'estimated' | 'to-check'
export type SourcedOption = { id: string; title: string; place: string; sourceUrl: string; verifiedAt: string; status: FactualStatus; conflict: boolean; date?: string; transferMinutes?: number }
export type PlanStop = { id: string; place: string; category?: string; date?: string; point?: { lat: number; lon: number }; transport?: TransportMode; chapterId?: string; address?: string; time?: string; booking?: string; notes?: string; kind?: 'visit' | 'stay' | 'meal' | 'transit'; sourceUrl?: string; verifiedAt?: string; status?: FactualStatus; conflict?: boolean; transferMinutes?: number }
export type UpcomingTrip = { id: string; destination: string; departure: string; endDate?: string; completed?: true; plan?: { ideas: PlanItem[]; stops: PlanStop[]; notes: string; options?: SourcedOption[]; stay?: import('./stay-composer').StayPlan; stayContexts?: import('./stay-composer').NamedStayContext[]; selectedStayContextKey?: string } }

function exact(value: unknown, required: string[], optional: string[] = []): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    required.every(key => Object.prototype.hasOwnProperty.call(value, key)) &&
    Object.keys(value).every(key => required.includes(key) || optional.includes(key))
}
function validPlan(value: unknown): boolean {
  if (!exact(value, ['ideas', 'stops', 'notes'], ['options', 'stay', 'stayContexts', 'selectedStayContextKey']) || !Array.isArray(value.ideas) || !Array.isArray(value.stops) ||
    value.ideas.length > 30 || value.stops.length > 30 || typeof value.notes !== 'string' || value.notes.length > 4000) return false
  if (Object.hasOwn(value, 'stay') && !validateStayPlan(value.stay)) return false
  if (Object.prototype.hasOwnProperty.call(value, 'stayContexts')) {
    if (!Array.isArray(value.stayContexts) || value.stayContexts.length > 10) return false
    const keys = new Set<string>()
    for (const item of value.stayContexts) {
      if (!exact(item, ['key', 'stay']) || typeof item.key !== 'string' || !validateStayPlan(item.stay) ||
        item.key !== `${item.stay.anchor.latitude.toFixed(5)},${item.stay.anchor.longitude.toFixed(5)}` || keys.has(item.key)) return false
      keys.add(item.key)
    }
    if (value.selectedStayContextKey !== undefined && (typeof value.selectedStayContextKey !== 'string' || !keys.has(value.selectedStayContextKey))) return false
    if (value.selectedStayContextKey && value.stay && !keys.has(value.selectedStayContextKey)) return false
  } else if (value.selectedStayContextKey !== undefined) return false
  const id = (item: unknown) => typeof item === 'string' && item.length > 0 && item.length <= 160
  const text = (item: unknown) => typeof item === 'string' && item.trim().length > 0 && item.length <= 160
  const status = (item: unknown) => item === 'confirmed' || item === 'estimated' || item === 'to-check'
  const sourceUrl = (item: unknown) => {
    if (typeof item !== 'string' || item.length > 2000) return false
    try { const url = new URL(item); return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password } catch { return false }
  }
  const validSourceFields = (item: Record<string, unknown>) =>
    (!Object.hasOwn(item, 'sourceUrl') || sourceUrl(item.sourceUrl)) &&
    (!Object.hasOwn(item, 'verifiedAt') || (typeof item.verifiedAt === 'string' && !!dateParts(item.verifiedAt))) &&
    (!Object.hasOwn(item, 'status') || status(item.status)) &&
    (!Object.hasOwn(item, 'conflict') || typeof item.conflict === 'boolean') &&
    (!Object.hasOwn(item, 'transferMinutes') || (Number.isSafeInteger(item.transferMinutes) && Number(item.transferMinutes) >= 0 && Number(item.transferMinutes) <= 1440))
  return value.ideas.every(item => exact(item, ['id', 'text'], ['point', 'category', 'source']) && id(item.id) && text(item.text) &&
      (!('category' in item) || (typeof item.category === 'string' && item.category.length <= 40)) &&
      (!('source' in item) || (typeof item.source === 'string' && item.source.length <= 500 && /^https:\/\//.test(item.source))) &&
      (!('point' in item) || (exact(item.point, ['lat', 'lon']) && typeof item.point.lat === 'number' && Number.isFinite(item.point.lat) && Math.abs(item.point.lat) <= 90 && typeof item.point.lon === 'number' && Number.isFinite(item.point.lon) && Math.abs(item.point.lon) <= 180))) &&
    value.stops.every(item => exact(item, ['id', 'place'], ['date', 'point', 'transport', 'chapterId', 'address', 'time', 'booking', 'notes', 'kind', 'category', 'sourceUrl', 'verifiedAt', 'status', 'conflict', 'transferMinutes']) && id(item.id) && text(item.place) && validSourceFields(item) &&
      ['address', 'booking', 'notes'].every(key => !(key in item) || (typeof item[key] === 'string' && item[key].length <= (key === 'notes' ? 2000 : 300))) &&
      (!('category' in item) || (typeof item.category === 'string' && item.category.length <= 40)) &&
      (!('time' in item) || (typeof item.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(item.time))) &&
      (!('kind' in item) || ['visit', 'stay', 'meal', 'transit'].includes(item.kind as string)) &&
      (!Object.prototype.hasOwnProperty.call(item, 'point') || (exact(item.point, ['lat', 'lon']) && typeof item.point.lat === 'number' && Number.isFinite(item.point.lat) && Math.abs(item.point.lat) <= 90 && typeof item.point.lon === 'number' && Number.isFinite(item.point.lon) && Math.abs(item.point.lon) <= 180)) &&
      (!Object.prototype.hasOwnProperty.call(item, 'transport') || (typeof item.transport === 'string' && Object.prototype.hasOwnProperty.call(transportModes, item.transport))) &&
      (!Object.prototype.hasOwnProperty.call(item, 'chapterId') || id(item.chapterId)) &&
      (!Object.prototype.hasOwnProperty.call(item, 'date') || (typeof item.date === 'string' && !!dateParts(item.date)))) &&
    (!Object.hasOwn(value, 'options') || (Array.isArray(value.options) && value.options.length <= 30 && value.options.every(item =>
      exact(item, ['id', 'title', 'place', 'sourceUrl', 'verifiedAt', 'status', 'conflict'], ['date', 'transferMinutes']) && id(item.id) && text(item.title) && text(item.place) && sourceUrl(item.sourceUrl) && typeof item.verifiedAt === 'string' && !!dateParts(item.verifiedAt) && status(item.status) && typeof item.conflict === 'boolean' &&
      (!Object.hasOwn(item, 'date') || (typeof item.date === 'string' && !!dateParts(item.date))) && validSourceFields(item)))) &&
    new Set(value.ideas.map(item => item.id)).size === value.ideas.length && new Set(value.stops.map(item => item.id)).size === value.stops.length
    && (!Array.isArray(value.options) || new Set(value.options.map(item => item.id)).size === value.options.length)
}

export function validateUpcomingTrips(value: unknown): value is UpcomingTrip[] {
  return Array.isArray(value) && value.length <= 12 && value.every(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false
    const trip = item as Record<string, unknown>
    const keys = Object.keys(trip)
    if (keys.some(key => !['id', 'destination', 'departure', 'endDate', 'completed', 'plan'].includes(key)) ||
      !['id', 'destination', 'departure'].every(key => Object.prototype.hasOwnProperty.call(trip, key)) ||
      keys.length < 3 || keys.length > 6) return false
    if (typeof trip.id !== 'string' || !trip.id || trip.id.length > 160 ||
      typeof trip.destination !== 'string' || !trip.destination.trim() || trip.destination.length > 80 ||
      typeof trip.departure !== 'string' || !dateParts(trip.departure)) return false
    return (!Object.prototype.hasOwnProperty.call(trip, 'endDate') || (typeof trip.endDate === 'string' && Boolean(dateParts(trip.endDate)) && trip.endDate >= trip.departure)) &&
      (!Object.prototype.hasOwnProperty.call(trip, 'completed') || trip.completed === true) &&
      (!Object.prototype.hasOwnProperty.call(trip, 'plan') || validPlan(trip.plan))
  }) && new Set(value.map(item => item.id)).size === value.length
}

export function tripIsPast(trip: UpcomingTrip, now: Date): boolean {
  return Boolean(trip.completed || (trip.endDate && trip.endDate < calendarDate(now)))
}

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
    if (!validateUpcomingTrips(parsed)) throw new Error('Invalid trips')
    const trips = parsed
    return { trips, error: '' }
  } catch {
    return { trips: [], error: 'Impossible de lire les décomptes enregistrés. Les données n’ont pas été modifiées ; vérifiez le stockage de ce navigateur avant d’enregistrer.' }
  }
}

export function newUpcoming(destination: string, departure: string): UpcomingTrip {
  return { id: createId(), destination: destination.trim(), departure }
}
