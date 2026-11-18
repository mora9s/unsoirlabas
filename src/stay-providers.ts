import { haversineKm, safeSourceUrl } from './stay-composer'
import type { GeoPoint, StayPlace } from './stay-composer'

export const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/search'
export const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter'
export const MAX_SEARCH_RADIUS_METERS = 2500
export const OBSERVED_KEY = 'un-soir-la-bas-osm-cache-v1'
const GEOCODE_CACHE_KEY = 'un-soir-la-bas-geocode-cache-v1'
const NOMINATIM_RATE_KEY = 'un-soir-la-bas-nominatim-last-request-v1'
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000
export type GeocodedPlace = GeoPoint & { name: string; label: string; sourceId: string; sourceUrl?: string }
export type PoiSearchResult = { places: StayPlace[]; observedAt: string; osmTimestamp?: string }
export type ProviderErrorKind = 'unavailable' | 'rate-limited' | 'invalid-response'
export class ProviderError extends Error {
  kind: ProviderErrorKind
  constructor(kind: ProviderErrorKind, message: string) { super(message); this.kind = kind; this.name = 'ProviderError' }
}

const geocodeCache = new Map<string, GeocodedPlace[]>()

function cachedGeocode(query: string): GeocodedPlace[] | undefined {
  const memory = geocodeCache.get(query)
  if (memory) return memory
  try {
    const entries: unknown = JSON.parse(localStorage.getItem(GEOCODE_CACHE_KEY) || '{}')
    if (!entries || typeof entries !== 'object' || Array.isArray(entries)) return undefined
    const item = (entries as Record<string, unknown>)[query]
    if (!item || typeof item !== 'object' || Array.isArray(item)) return undefined
    const record = item as Record<string, unknown>
    if (typeof record.savedAt !== 'number' || Date.now() - record.savedAt > CACHE_TTL || !Array.isArray(record.results)) return undefined
    const results = record.results.filter((result): result is GeocodedPlace => {
      if (!result || typeof result !== 'object') return false
      const place = result as Record<string, unknown>
      return typeof place.latitude === 'number' && place.latitude >= -90 && place.latitude <= 90 && typeof place.longitude === 'number' && place.longitude >= -180 && place.longitude <= 180 && typeof place.name === 'string' && typeof place.label === 'string' && typeof place.sourceId === 'string'
    }).slice(0, 5)
    geocodeCache.set(query, results)
    return results
  } catch { return undefined }
}

function cacheGeocode(query: string, results: GeocodedPlace[]) {
  geocodeCache.set(query, results)
  try {
    const previous: unknown = JSON.parse(localStorage.getItem(GEOCODE_CACHE_KEY) || '{}')
    const cache = previous && typeof previous === 'object' && !Array.isArray(previous) ? previous as Record<string, unknown> : {}
    cache[query] = { savedAt: Date.now(), results }
    for (const [key, value] of Object.entries(cache)) if (!value || typeof value !== 'object' || typeof (value as Record<string, unknown>).savedAt !== 'number' || Date.now() - Number((value as Record<string, unknown>).savedAt) > CACHE_TTL) delete cache[key]
    const bounded = Object.fromEntries(Object.entries(cache).slice(-20))
    localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(bounded))
  } catch { /* The explicit search may proceed when optional caching is full. */ }
}

async function reserveNominatimRequest(signal?: AbortSignal) {
  if (!navigator.locks?.request) throw new ProviderError('unavailable', 'La recherche est désactivée car la limitation de débit entre onglets ne peut pas être garantie.')
  await navigator.locks.request('un-soir-la-bas-nominatim-rate', async () => {
    let previous = 0
    try { previous = Number(localStorage.getItem(NOMINATIM_RATE_KEY)) || 0 } catch { throw new ProviderError('unavailable', 'Le stockage local nécessaire au respect du débit est indisponible.') }
    const wait = 1000 - (Date.now() - previous)
    if (wait > 0) await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(resolve, wait)
      signal?.addEventListener('abort', () => { window.clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')) }, { once: true })
    })
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    try { localStorage.setItem(NOMINATIM_RATE_KEY, String(Date.now())) } catch { throw new ProviderError('unavailable', 'Le stockage local nécessaire au respect du débit est indisponible.') }
  })
}

export async function geocodeDestination(query: string, signal?: AbortSignal, endpoint = NOMINATIM_ENDPOINT): Promise<GeocodedPlace[]> {
  const normalized = query.trim().toLocaleLowerCase('fr-FR')
  if (!normalized || normalized.length > 120) return []
  const cached = cachedGeocode(normalized)
  if (cached) return cached
  await reserveNominatimRequest(signal)
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  const url = new URL(endpoint)
  url.search = new URLSearchParams({ format: 'jsonv2', limit: '5', q: query.trim() }).toString()
  let response: Response
  try { response = await fetch(url, { signal, headers: { Accept: 'application/json' } }) }
  catch (error) { if (signal?.aborted) throw error; throw new ProviderError('unavailable', 'Le service de recherche de destination ne répond pas.') }
  if (response.status === 429) throw new ProviderError('rate-limited', 'Le service limite temporairement les recherches. Réessayez plus tard.')
  if (!response.ok) throw new ProviderError('unavailable', `La recherche de destination est indisponible (HTTP ${response.status}).`)
  let data: unknown
  try { data = await response.json() } catch { throw new ProviderError('invalid-response', 'La réponse de géocodage est illisible.') }
  if (!Array.isArray(data)) throw new ProviderError('invalid-response', 'La réponse de géocodage est invalide.')
  const results = data.flatMap((item: unknown): GeocodedPlace[] => {
    if (!item || typeof item !== 'object') return []
    const value = item as Record<string, unknown>
    const latitude = Number(value.lat), longitude = Number(value.lon)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || typeof value.display_name !== 'string' || typeof value.osm_type !== 'string' || (typeof value.osm_id !== 'number' && typeof value.osm_id !== 'string')) return []
    const sourceId = `${value.osm_type}/${value.osm_id}`
    return [{ latitude, longitude, name: String(value.name || value.display_name.split(',')[0]).slice(0, 160), label: value.display_name.slice(0, 300), sourceId, sourceUrl: safeSourceUrl(`https://www.openstreetmap.org/${encodeURIComponent(value.osm_type)}/${encodeURIComponent(String(value.osm_id))}`) }]
  })
  cacheGeocode(normalized, results)
  return results
}

export function readObservedCandidates(anchor: GeocodedPlace): PoiSearchResult | undefined {
  try {
    const cache: unknown = JSON.parse(localStorage.getItem(OBSERVED_KEY) || '[]')
    if (!Array.isArray(cache)) return undefined
    for (const raw of [...cache].reverse()) {
      if (!raw || typeof raw !== 'object') continue
      const item = raw as Record<string, unknown>
      const savedAnchor = item.anchor as Record<string, unknown> | undefined
      if (!savedAnchor || savedAnchor.name !== anchor.name || savedAnchor.latitude !== anchor.latitude || savedAnchor.longitude !== anchor.longitude ||
        typeof item.observedAt !== 'string' || Date.now() - Date.parse(item.observedAt) > CACHE_TTL || !Array.isArray(item.places)) continue
      const places = item.places.filter((place): place is StayPlace => {
        if (!place || typeof place !== 'object') return false
        const candidate = place as Record<string, unknown>
        return typeof candidate.id === 'string' && typeof candidate.name === 'string' && Number.isFinite(candidate.latitude) && Number.isFinite(candidate.longitude) && ['restaurant', 'activity'].includes(String(candidate.category)) && candidate.source === 'osm'
      }).slice(0, 120)
      return { places, observedAt: item.observedAt, ...(typeof item.osmTimestamp === 'string' ? { osmTimestamp: item.osmTimestamp } : {}) }
    }
  } catch { return undefined }
  return undefined
}

export async function searchNearby(anchor: GeocodedPlace, signal?: AbortSignal, endpoint = OVERPASS_ENDPOINT): Promise<PoiSearchResult> {
  const lat = anchor.latitude.toFixed(6), lon = anchor.longitude.toFixed(6), radius = MAX_SEARCH_RADIUS_METERS
  // Separate bounded outputs prevent restaurant-heavy cities from starving
  // activities; named objects only, still a sample rather than an inventory.
  const query = `[out:json][timeout:12][maxsize:5242880];nwr(around:${radius},${lat},${lon})[amenity=restaurant][name];out center tags 60;nwr(around:${radius},${lat},${lon})[tourism~"^(attraction|viewpoint)$"][name];out center tags 60;`
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(new DOMException('Délai dépassé', 'TimeoutError')), 15000)
  const abort = () => controller.abort(signal?.reason)
  signal?.addEventListener('abort', abort, { once: true })
  let response: Response
  try {
    response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', Accept: 'application/json' }, body: new URLSearchParams({ data: query }), signal: controller.signal })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new ProviderError('unavailable', 'Les lieux à proximité sont temporairement indisponibles. Réessayez explicitement dans un instant.')
  } finally { window.clearTimeout(timeout); signal?.removeEventListener('abort', abort) }
  if (response.status === 429) throw new ProviderError('rate-limited', 'OpenStreetMap limite temporairement cette recherche. Réessayez plus tard.')
  if (!response.ok) throw new ProviderError('unavailable', `La recherche de lieux est indisponible (HTTP ${response.status}). Réessayez explicitement.`)
  let payload: unknown
  try { payload = await response.json() } catch { throw new ProviderError('invalid-response', 'La réponse OpenStreetMap est illisible.') }
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as Record<string, unknown>).elements)) throw new ProviderError('invalid-response', 'La réponse OpenStreetMap ne contient pas de liste de lieux.')
  const raw = (payload as { elements: unknown[] }).elements
  const seen = new Set<string>()
  const places: StayPlace[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const element = item as Record<string, unknown>
    if (!['node', 'way', 'relation'].includes(String(element.type)) || (typeof element.id !== 'number' && typeof element.id !== 'string')) continue
    const tags = element.tags && typeof element.tags === 'object' ? element.tags as Record<string, unknown> : {}
    const category = tags.amenity === 'restaurant' ? 'restaurant' : ['attraction', 'viewpoint'].includes(String(tags.tourism)) ? 'activity' : undefined
    const coordinates = element.center && typeof element.center === 'object' ? element.center as Record<string, unknown> : element
    const latitude = Number(coordinates.lat), longitude = Number(coordinates.lon)
    if (!category || !Number.isFinite(latitude) || !Number.isFinite(longitude)) continue
    const key = `${element.type}/${element.id}`
    if (seen.has(key)) continue
    seen.add(key)
    const name = typeof tags.name === 'string' && tags.name.trim() ? tags.name.trim().slice(0, 160) : undefined
    if (!name) continue
    const sourceUrl = safeSourceUrl(`https://www.openstreetmap.org/${element.type}/${element.id}`)
    places.push({ id: `osm:${key}`, sourceId: key, name, category, latitude, longitude, source: 'osm', ...(sourceUrl ? { sourceUrl } : {}) })
  }
  places.sort((a, b) => haversineKm(anchor, a) - haversineKm(anchor, b) || a.name.localeCompare(b.name, 'fr'))
  return { places, observedAt: new Date().toISOString(), osmTimestamp: typeof (payload as Record<string, unknown>).osm3s === 'object' && (payload as { osm3s?: { timestamp_osm_base?: unknown } }).osm3s?.timestamp_osm_base ? String((payload as { osm3s: { timestamp_osm_base: unknown } }).osm3s.timestamp_osm_base) : undefined }
}

export function storeObservedCandidates(result: PoiSearchResult, anchor: GeocodedPlace) {
  try {
    const entry = { anchor: { name: anchor.name, latitude: anchor.latitude, longitude: anchor.longitude }, observedAt: result.observedAt, osmTimestamp: result.osmTimestamp, places: result.places }
    const previous: unknown = JSON.parse(localStorage.getItem(OBSERVED_KEY) || '[]')
    const cache = Array.isArray(previous) ? previous.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object').slice(-2) : []
    cache.push(entry)
    localStorage.setItem(OBSERVED_KEY, JSON.stringify(cache))
  } catch { /* Discovery remains usable when optional cache storage is unavailable. */ }
}
