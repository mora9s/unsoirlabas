export type GeoPoint = { latitude: number; longitude: number }
export type StayPlace = GeoPoint & {
  id: string
  name: string
  category: 'restaurant' | 'activity'
  source: 'manual' | 'osm'
  sourceUrl?: string
  sourceId?: string
}
export type StayDay = { id: string; title: string; placeIds: string[]; locked: boolean }
export type StayPlan = {
  anchor: GeoPoint & { name: string }
  places: StayPlace[]
  days: StayDay[]
  daysCount: number
}
export type NamedStayContext = { key: string; stay: StayPlan }
export function stayContextKey(anchor: StayPlan['anchor']): string {
  return `${anchor.latitude.toFixed(5)},${anchor.longitude.toFixed(5)}`
}
export type ComposedStayDays = { days: StayDay[]; warnings: string[] }

export function safeSourceUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 2048) return undefined
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password) return undefined
    return url.toString()
  } catch { return undefined }
}

export function validPoint(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const point = value as Record<string, unknown>
  return typeof point.latitude === 'number' && Number.isFinite(point.latitude) && point.latitude >= -90 && point.latitude <= 90 &&
    typeof point.longitude === 'number' && Number.isFinite(point.longitude) && point.longitude >= -180 && point.longitude <= 180
}

export function validateStayPlan(value: unknown): value is StayPlan {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const plan = value as Record<string, unknown>
  if (Object.keys(plan).some(key => !['anchor', 'places', 'days', 'daysCount'].includes(key)) ||
    !plan.anchor || typeof plan.anchor !== 'object' || Array.isArray(plan.anchor) ||
    Object.keys(plan.anchor).some(key => !['name', 'latitude', 'longitude'].includes(key)) ||
    typeof (plan.anchor as Record<string, unknown>).name !== 'string' || !(plan.anchor as Record<string, unknown>).name ||
    !validPoint(plan.anchor) || !Array.isArray(plan.places) || plan.places.length > 30 ||
    !Array.isArray(plan.days) || plan.days.length > 3 || !Number.isInteger(plan.daysCount) || Number(plan.daysCount) < 1 || Number(plan.daysCount) > 3) return false
  const ids = new Set<string>()
  for (const raw of plan.places) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
    const place = raw as Record<string, unknown>
    if (Object.keys(place).some(key => !['id', 'name', 'category', 'latitude', 'longitude', 'source', 'sourceUrl', 'sourceId'].includes(key)) ||
      typeof place.id !== 'string' || !place.id || place.id.length > 180 || ids.has(place.id) ||
      typeof place.name !== 'string' || !place.name.trim() || place.name.length > 160 || !validPoint(place) ||
      !['restaurant', 'activity'].includes(String(place.category)) || !['manual', 'osm'].includes(String(place.source)) ||
      (place.sourceUrl !== undefined && safeSourceUrl(place.sourceUrl) !== place.sourceUrl) ||
      (place.sourceId !== undefined && (typeof place.sourceId !== 'string' || !place.sourceId || place.sourceId.length > 180))) return false
    ids.add(place.id)
  }
  const dayIds = new Set<string>()
  for (const raw of plan.days) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
    const day = raw as Record<string, unknown>
    if (Object.keys(day).some(key => !['id', 'title', 'placeIds', 'locked'].includes(key)) ||
      typeof day.id !== 'string' || !day.id || day.id.length > 100 || dayIds.has(day.id) ||
      typeof day.title !== 'string' || !day.title || day.title.length > 100 || typeof day.locked !== 'boolean' ||
      !Array.isArray(day.placeIds) || day.placeIds.length > 30 || day.placeIds.some(id => typeof id !== 'string' || !ids.has(id)) ||
      new Set(day.placeIds).size !== day.placeIds.length) return false
    dayIds.add(day.id)
  }
  return true
}

// Deliberately approximate: this is a straight-line distance, never a travel time or route.
export function haversineKm(from: GeoPoint, to: GeoPoint): number {
  if (!validPoint(from) || !validPoint(to)) return Number.NaN
  const radians = (degrees: number) => degrees * Math.PI / 180
  const dLat = radians(to.latitude - from.latitude)
  const dLon = radians(to.longitude - from.longitude)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(dLon / 2) ** 2
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function composeDays(places: StayPlace[], daysCount: number, previous: StayDay[] = []): ComposedStayDays {
  const requested = Math.max(1, Math.min(3, Math.floor(daysCount) || 1))
  const known = new Set(places.map(place => place.id))
  const locked = previous.filter(day => day.locked).map(day => ({ ...day, placeIds: day.placeIds.filter(id => known.has(id)) }))
  const lastLockedIndex = previous.reduce((last, day, index) => day.locked ? Math.max(last, index) : last, -1)
  const count = Math.max(requested, lastLockedIndex + 1)
  const days: StayDay[] = Array.from({ length: count }, (_, index) => {
    const saved = previous[index]
    const pinned = locked.find(day => day.id === saved?.id)
    return pinned ?? { id: saved?.id ?? `stay-day-${index + 1}`, title: saved?.title ?? `Jour ${index + 1}`, placeIds: [], locked: false }
  })
  const assigned = new Set(days.filter(day => day.locked).flatMap(day => day.placeIds))
  const available = places.filter(place => !assigned.has(place.id))
  let cursor = 0
  for (const place of available) {
    let attempts = 0
    while (attempts < days.length && (days[cursor % days.length].locked || days[cursor % days.length].placeIds.length >= 4)) { cursor += 1; attempts += 1 }
    if (attempts === days.length) break
    days[cursor % days.length].placeIds.push(place.id)
    cursor += 1
  }
  const placed = new Set(days.flatMap(day => day.placeIds))
  const unplaced = places.length - placed.size
  return { days, warnings: unplaced ? [`${unplaced} ${unplaced === 1 ? 'envie reste' : 'envies restent'} à placer.`] : [] }
}
