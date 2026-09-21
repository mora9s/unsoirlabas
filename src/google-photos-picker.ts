import type { Media } from './journal'

const scope = 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly'
const apiOrigin = 'https://photospicker.googleapis.com'
const apiBase = `${apiOrigin}/v1`
const maxFileBytes = 12 * 1024 * 1024
const maxBatchBytes = 36 * 1024 * 1024
const maxPages = 20
const maxWaitMs = 2 * 60 * 1000

type UnknownRecord = Record<string, unknown>
type TokenResponse = { access_token?: string; error?: string }
type TokenClient = { requestAccessToken: (options?: { prompt?: string }) => void }
type TokenClientConfig = { client_id: string; scope: string; callback: (response: TokenResponse) => void; error_callback?: () => void }
type GoogleIdentity = { accounts: { oauth2: { initTokenClient: (config: TokenClientConfig) => TokenClient } } }

type PollingConfig = { pollInterval?: string; timeoutIn?: string }
type PickerSession = { id: string; pickerUri: string; pollingConfig?: PollingConfig; mediaItemsSet?: boolean }
type PickerMediaItem = { id: string; type: 'PHOTO' | 'VIDEO'; baseUrl: string; mimeType: string; filename?: string }

let consentGranted = false

declare global {
  interface Window {
    __GOOGLE_PHOTOS_CONFIG__?: { clientId?: string }
    google?: GoogleIdentity
  }
}

export type GooglePhotosAvailability = { enabled: boolean; reason: 'missing-client-id' | 'insecure-context' | '' }
export type GooglePhotosImport = { media: Media[]; videosSkipped: number; capacitySkipped: number; sizeSkipped: number }

function record(value: unknown): value is UnknownRecord { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function string(value: unknown, max = 500): value is string { return typeof value === 'string' && value.length > 0 && value.length <= max }
function configuredClientId(): string {
  const runtime = window.__GOOGLE_PHOTOS_CONFIG__?.clientId
  const build = import.meta.env.VITE_GOOGLE_PHOTOS_CLIENT_ID
  return typeof runtime === 'string' && runtime.trim() ? runtime.trim() : typeof build === 'string' ? build.trim() : ''
}

export function googlePhotosAvailability(): GooglePhotosAvailability {
  if (!configuredClientId()) return { enabled: false, reason: 'missing-client-id' }
  if (!window.isSecureContext) return { enabled: false, reason: 'insecure-context' }
  return { enabled: true, reason: '' }
}

function duration(value: unknown, fallback: number): number {
  if (typeof value !== 'string') return fallback
  const match = /^(\d+(?:\.\d+)?)s$/.exec(value)
  if (!match) return fallback
  const parsed = Number(match[1]) * 1000
  return Number.isFinite(parsed) ? Math.min(maxWaitMs, Math.max(250, parsed)) : fallback
}

function abortError(): Error { return new DOMException('Import annulé.', 'AbortError') }
function ensureActive(signal: AbortSignal) {
  if (signal.aborted) throw abortError()
}
function safeHttps(value: unknown, hosts?: readonly string[]): string | undefined {
  if (!string(value, 2000)) return undefined
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || (hosts && !hosts.includes(url.hostname))) return undefined
    return url.href
  } catch { return undefined }
}
function validSession(value: unknown, needsPickerUri = false): PickerSession {
  if (!record(value) || !string(value.id, 300) || [...value.id].some(character => {
    const code = character.charCodeAt(0)
    return code < 32 || code === 127
  })) throw new Error('Réponse Picker invalide.')
  const pickerUri = safeHttps(value.pickerUri, ['photos.google.com'])
  if (needsPickerUri && !pickerUri) throw new Error('Réponse Picker invalide.')
  const pollingConfig = record(value.pollingConfig) ? {
    pollInterval: typeof value.pollingConfig.pollInterval === 'string' ? value.pollingConfig.pollInterval : undefined,
    timeoutIn: typeof value.pollingConfig.timeoutIn === 'string' ? value.pollingConfig.timeoutIn : undefined,
  } : undefined
  return { id: value.id, pickerUri: pickerUri ?? '', pollingConfig, mediaItemsSet: value.mediaItemsSet === true }
}
function validItem(value: unknown): PickerMediaItem | undefined {
  if (!record(value) || !string(value.id, 500) || !record(value.mediaFile) || !string(value.type, 20) || !['PHOTO', 'VIDEO'].includes(value.type) || !string(value.mediaFile.mimeType, 120)) return undefined
  const baseUrl = safeHttps(value.mediaFile.baseUrl)
  if (!baseUrl || !/\.googleusercontent\.com$/.test(new URL(baseUrl).hostname)) return undefined
  const filename = typeof value.mediaFile.filename === 'string' ? value.mediaFile.filename.slice(0, 180) : undefined
  return { id: value.id, type: value.type as 'PHOTO' | 'VIDEO', baseUrl, mimeType: value.mediaFile.mimeType, filename }
}
function publicError(error: unknown): Error {
  if (error instanceof DOMException && error.name === 'AbortError') return new Error('Import Google Photos annulé.')
  const message = error instanceof Error ? error.message : ''
  if (message === 'Réponse Picker invalide.' || message === 'autorisation Google a été refusée' || message === 'La sélection Google Photos a expiré.' || message.startsWith('La fenêtre Google Photos a été bloquée')) return new Error(message)
  return new Error('Google Photos est indisponible ou la sélection a expiré. Réessayez.')
}

async function loadGis(signal: AbortSignal): Promise<GoogleIdentity> {
  if (window.google?.accounts.oauth2) return window.google
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-google-identity]')
    const script = existing ?? document.createElement('script')
    const cleanup = () => { signal.removeEventListener('abort', cancelled); script.removeEventListener('load', loaded); script.removeEventListener('error', failed) }
    const loaded = () => { cleanup(); resolve() }
    const failed = () => { cleanup(); reject(new Error('Google Identity indisponible.')) }
    const cancelled = () => { cleanup(); reject(abortError()) }
    script.addEventListener('load', loaded, { once: true })
    script.addEventListener('error', failed, { once: true })
    signal.addEventListener('abort', cancelled, { once: true })
    if (!existing) { script.src = 'https://accounts.google.com/gsi/client'; script.async = true; script.dataset.googleIdentity = 'true'; document.head.append(script) }
  })
  if (!window.google?.accounts.oauth2) throw new Error('Google Identity indisponible.')
  return window.google
}

async function accessToken(clientId: string, signal: AbortSignal): Promise<string> {
  const google = await loadGis(signal)
  return new Promise<string>((resolve, reject) => {
    const cancel = () => reject(abortError())
    signal.addEventListener('abort', cancel, { once: true })
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId, scope,
      callback: response => {
        signal.removeEventListener('abort', cancel)
        if (typeof response.access_token === 'string' && response.access_token.length > 20) { consentGranted = true; resolve(response.access_token) }
        else reject(new Error(response.error === 'access_denied' ? 'autorisation Google a été refusée' : 'Google Identity indisponible.'))
      },
      error_callback: () => { signal.removeEventListener('abort', cancel); reject(new Error('Google Identity indisponible.')) },
    })
    client.requestAccessToken({ prompt: consentGranted ? '' : 'consent' })
  })
}

async function pickerFetch(path: string, token: string, init: RequestInit, signal: AbortSignal): Promise<Response> {
  const url = new URL(path, `${apiBase}/`).href
  if (!url.startsWith(`${apiBase}/`)) throw new Error('Réponse Picker invalide.')
  const response = await fetch(url, { ...init, signal, redirect: 'error', headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) } })
  if (!response.ok) throw new Error('API Picker indisponible.')
  return response
}

async function poll(session: PickerSession, token: string, signal: AbortSignal): Promise<void> {
  const deadline = Date.now() + Math.min(maxWaitMs, duration(session.pollingConfig?.timeoutIn, maxWaitMs))
  let current = session
  while (!current.mediaItemsSet) {
    ensureActive(signal)
    if (Date.now() >= deadline) throw new Error('La sélection Google Photos a expiré.')
    await new Promise<void>((resolve, reject) => {
      let timer = 0
      const cancelled = () => { window.clearTimeout(timer); reject(abortError()) }
      timer = window.setTimeout(() => { signal.removeEventListener('abort', cancelled); resolve() }, duration(current.pollingConfig?.pollInterval, 1000))
      signal.addEventListener('abort', cancelled, { once: true })
    })
    ensureActive(signal)
    current = validSession(await (await pickerFetch(`sessions/${encodeURIComponent(session.id)}`, token, { method: 'GET' }, signal)).json())
  }
}

async function selectedItems(sessionId: string, token: string, signal: AbortSignal): Promise<PickerMediaItem[]> {
  const items: PickerMediaItem[] = []
  let pageToken = ''
  for (let page = 0; page < maxPages; page += 1) {
    const params = new URLSearchParams({ sessionId, pageSize: '100' })
    if (pageToken) params.set('pageToken', pageToken)
    const json: unknown = await (await pickerFetch(`mediaItems?${params}`, token, { method: 'GET' }, signal)).json()
    if (!record(json) || (json.mediaItems !== undefined && !Array.isArray(json.mediaItems))) throw new Error('Réponse Picker invalide.')
    for (const item of json.mediaItems ?? []) { const validated = validItem(item); if (validated) items.push(validated) }
    pageToken = typeof json.nextPageToken === 'string' ? json.nextPageToken : ''
    if (!pageToken) return items
  }
  throw new Error('La sélection est trop volumineuse pour être importée ici.')
}

function filename(item: PickerMediaItem, index: number): string {
  const given = item.filename?.replace(/[^\w. -]/g, '').trim()
  return given && /\.(jpe?g|png|webp|gif|avif)$/i.test(given) ? given : `google-photo-${index + 1}.jpg`
}
async function boundedBlob(response: Response, mime: string, limit: number): Promise<Blob> {
  if (!response.body) throw new Error('Téléchargement photo indisponible.')
  const reader = response.body.getReader()
  const chunks: ArrayBuffer[] = []
  let bytes = 0
  try {
    while (true) {
      const part = await reader.read()
      if (part.done) break
      bytes += part.value.byteLength
      if (bytes > limit) {
        await reader.cancel()
        throw new Error('Téléchargement photo trop volumineux.')
      }
      chunks.push(part.value.slice().buffer)
    }
  } finally {
    reader.releaseLock()
  }
  return new Blob(chunks, { type: mime })
}

async function download(item: PickerMediaItem, index: number, limit: number, signal: AbortSignal): Promise<File> {
  const url = `${item.baseUrl}=w2048-h2048`
  const response = await fetch(url, { signal, redirect: 'error' })
  const contentLength = Number(response.headers.get('content-length'))
  const maximum = Math.min(maxFileBytes, limit)
  if (!response.ok || maximum <= 0 || (Number.isFinite(contentLength) && contentLength > maximum)) throw new Error('Téléchargement photo indisponible.')
  const responseMime = response.headers.get('content-type')?.split(';', 1)[0].trim() || item.mimeType
  if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(responseMime)) throw new Error('Téléchargement photo invalide.')
  const blob = await boundedBlob(response, responseMime, maximum)
  return new File([blob], filename(item, index), { type: responseMime })
}

export async function importGooglePhotos({ remaining, signal, normalize }: { remaining: number; signal: AbortSignal; normalize: (file: File) => Promise<Media> }): Promise<GooglePhotosImport> {
  const availability = googlePhotosAvailability()
  if (!availability.enabled) throw new Error(availability.reason === 'insecure-context' ? 'La connexion Google nécessite HTTPS.' : 'Ajoutez un identifiant client Web public pour connecter Google Photos.')
  const popup = window.open('about:blank', 'google-photos-picker', 'popup,width=480,height=720,resizable=yes,scrollbars=yes')
  if (!popup) throw new Error('La fenêtre Google Photos a été bloquée. Autorisez les fenêtres surgissantes puis réessayez.')
  let token = ''
  let sessionId = ''
  try {
    token = await accessToken(configuredClientId(), signal)
    ensureActive(signal)
    const session = validSession(await (await pickerFetch('sessions', token, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }, signal)).json(), true)
    sessionId = session.id
    popup.location.replace(`${session.pickerUri.replace(/\/$/, '')}/autoclose`)
    await poll(session, token, signal)
    const all = await selectedItems(session.id, token, signal)
    const videosSkipped = all.filter(item => item.type === 'VIDEO').length
    const images = all.filter(item => item.type === 'PHOTO' && /^image\/(jpeg|png|webp|gif|avif)$/.test(item.mimeType))
    const planned = images.slice(0, Math.max(0, remaining))
    const capacitySkipped = Math.max(0, images.length - planned.length)
    const files: File[] = []
    let bytes = 0
    let sizeSkipped = 0
    for (const [index, item] of planned.entries()) {
      ensureActive(signal)
      try {
        const file = await download(item, index, maxBatchBytes - bytes, signal)
        bytes += file.size
        files.push(file)
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error
        sizeSkipped += 1
      }
    }
    const converted = await Promise.all(files.map(normalize))
    return { media: converted, videosSkipped, capacitySkipped, sizeSkipped }
  } catch (error) {
    throw publicError(error)
  } finally {
    if (sessionId && token) {
      try { await pickerFetch(`sessions/${encodeURIComponent(sessionId)}`, token, { method: 'DELETE' }, new AbortController().signal) } catch { /* Cleanup is best effort and never exposes credentials. */ }
    }
    if (!popup.closed) popup.close()
  }
}

export { scope as googlePhotosPickerScope }
