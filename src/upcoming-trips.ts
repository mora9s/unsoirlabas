import { createId } from './id'

export const upcomingKey = 'un-soir-la-bas-upcoming-v1'
export type PlanItem = { id: string; text: string }
export type PlanStop = { id: string; place: string; date?: string }
export type UpcomingTrip = { id: string; destination: string; departure: string; plan?: { ideas: PlanItem[]; stops: PlanStop[]; notes: string } }

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

function exact(value: unknown, required: string[], optional: string[] = []): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    required.every(key => Object.prototype.hasOwnProperty.call(value, key)) &&
    Object.keys(value).every(key => required.includes(key) || optional.includes(key))
}

function uniqueIds(items: { id: string }[]) { return new Set(items.map(item => item.id)).size === items.length }
function validId(value: unknown): value is string { return typeof value === 'string' && value.length > 0 && value.length <= 160 }
function validText(value: unknown, max: number): value is string { return typeof value === 'string' && value.trim().length > 0 && value.length <= max }

export function validateUpcoming(value: unknown): value is UpcomingTrip[] {
  if (!Array.isArray(value) || value.length > 12) return false
  return value.every(item => {
    if (!exact(item, ['id', 'destination', 'departure'], ['plan']) || !validId(item.id) ||
      !validText(item.destination, 80) || typeof item.departure !== 'string' || !dateParts(item.departure)) return false
    if (item.plan === undefined) return !Object.prototype.hasOwnProperty.call(item, 'plan')
    const plan = item.plan
    if (!exact(plan, ['ideas', 'stops', 'notes']) || !Array.isArray(plan.ideas) || !Array.isArray(plan.stops) ||
      plan.ideas.length > 30 || plan.stops.length > 30 || typeof plan.notes !== 'string' || plan.notes.length > 4000) return false
    if (!plan.ideas.every(idea => exact(idea, ['id', 'text']) && validId(idea.id) && validText(idea.text, 160)) || !uniqueIds(plan.ideas)) return false
    if (!plan.stops.every(stop => exact(stop, ['id', 'place'], ['date']) && validId(stop.id) && validText(stop.place, 160) &&
      (!Object.prototype.hasOwnProperty.call(stop, 'date') || (typeof stop.date === 'string' && !!dateParts(stop.date)))) || !uniqueIds(plan.stops)) return false
    return true
  }) && uniqueIds(value)
}

export function readUpcoming(): { trips: UpcomingTrip[]; error: string } {
  try {
    const raw = localStorage.getItem(upcomingKey)
    if (raw === null) return { trips: [], error: '' }
    const parsed: unknown = JSON.parse(raw)
    if (!validateUpcoming(parsed)) throw new Error('Invalid trips')
    return { trips: parsed, error: '' }
  } catch {
    return { trips: [], error: 'Impossible de lire les décomptes enregistrés. Les données n’ont pas été modifiées ; vérifiez le stockage de ce navigateur avant d’enregistrer.' }
  }
}

export function newUpcoming(destination: string, departure: string): UpcomingTrip {
  return { id: createId(), destination: destination.trim(), departure }
}
