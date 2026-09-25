import { useEffect, useRef, useState } from 'react'
import type { Draft } from '../journal'
import { transportModes } from '../upcoming-trips'
import type { PlanStop, TransportMode } from '../upcoming-trips'

type Place = { name: string; context: string; lat: number; lon: number }

export default function StopDetails({ stop, first, chapters, update }: { stop: PlanStop; first: boolean; chapters: Draft[]; update: (stop: PlanStop) => boolean }) {
  const [query, setQuery] = useState(stop.place)
  const [gps, setGps] = useState(stop.point ? `${stop.point.lat}, ${stop.point.lon}` : '')
  const [results, setResults] = useState<Place[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])
  async function search() {
    request.current?.abort()
    const controller = new AbortController(); request.current = controller
    setBusy(true); setError(''); setResults([])
    const timer = window.setTimeout(() => controller.abort(), 12000)
    try {
      const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query.trim())}&limit=5&lang=fr`, { signal: controller.signal })
      if (!response.ok) throw new Error('Recherche indisponible. Vous pouvez saisir les coordonnées GPS.')
      const body = await response.json()
      const found: Place[] = (body.features ?? []).filter((f: { geometry?: { type: string } }) => f.geometry?.type === 'Point').map((f: { geometry: { coordinates: number[] }; properties: Record<string, string> }) => ({ name: f.properties.name || f.properties.city || query, context: [f.properties.city, f.properties.state, f.properties.country].filter(Boolean).join(' · '), lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] })).filter((p: Place) => Number.isFinite(p.lat) && Math.abs(p.lat) <= 90 && Number.isFinite(p.lon) && Math.abs(p.lon) <= 180)
      if (request.current !== controller || controller.signal.aborted) return
      setResults(found)
      if (!found.length) setError('Aucun lieu trouvé. Précisez le pays ou utilisez les coordonnées GPS.')
    } catch { if (request.current === controller) setError('Recherche indisponible. Réessayez ou saisissez les coordonnées GPS.') }
    finally { clearTimeout(timer); if (request.current === controller) setBusy(false) }
  }
  function locate(point: { lat: number; lon: number }) {
    if (update({ ...stop, point })) { setGps(`${point.lat}, ${point.lon}`); setResults([]); setError('') }
  }
  function saveGps() {
    const match = /^\s*([+-]?\d+(?:\.\d+)?)\s*[,;]\s*([+-]?\d+(?:\.\d+)?)\s*$/.exec(gps)
    const lat = Number(match?.[1]), lon = Number(match?.[2])
    if (!match || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) { setError('Utilisez latitude, longitude : par exemple 43.7031, 7.2661.'); return }
    locate({ lat, lon })
  }
  return <details className="stop-details">
    <summary>{stop.point ? 'Lieu repéré' : 'Situer sur la carte'}{!first && ` · ${stop.transport ? transportModes[stop.transport] : 'Transport à choisir'}`}</summary>
    <div className="stop-fields">
      <label>Nom de l’étape<input defaultValue={stop.place} maxLength={160} onBlur={event => { const place = event.target.value.trim(); if (place && place !== stop.place) update({ ...stop, place }) }} /></label>
      <label>Rechercher le lieu de {stop.place}<input value={query} maxLength={160} onChange={event => { request.current?.abort(); request.current = null; setBusy(false); setQuery(event.target.value); setResults([]) }} /></label>
      <button type="button" className="text-button" disabled={busy || !query.trim()} onClick={search}>{busy ? 'Recherche…' : 'Rechercher ce lieu'}</button>
      {results.length > 0 && <ul className="place-results">{results.map((p, i) => <li key={i}><button type="button" onClick={() => locate(p)}>{p.name}<small>{p.context} · {p.lat.toFixed(4)}, {p.lon.toFixed(4)}</small></button></li>)}</ul>}
      <label>Coordonnées GPS de {stop.place}<input value={gps} onChange={event => setGps(event.target.value)} placeholder="43.7031, 7.2661" /></label>
      <button type="button" className="text-button" onClick={saveGps}>Valider les coordonnées</button>
      {stop.point && <small>Position enregistrée : {stop.point.lat.toFixed(4)}, {stop.point.lon.toFixed(4)}</small>}
      {!first && <label>Transport vers {stop.place}<select value={stop.transport ?? ''} onChange={event => { const next = { ...stop }; if (event.target.value) next.transport = event.target.value as TransportMode; else delete next.transport; update(next) }}><option value="">Choisir le transport</option>{Object.entries(transportModes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>}
      <label>Souvenirs à {stop.place}<select value={stop.chapterId ?? ''} onChange={event => { const next = { ...stop }; if (event.target.value) next.chapterId = event.target.value; else delete next.chapterId; update(next) }}><option value="">Sans chapitre associé</option>{stop.chapterId && !chapters.some(c => c.id === stop.chapterId) && <option value={stop.chapterId}>Chapitre indisponible</option>}{chapters.map(c => <option value={c.id} key={c.id}>{c.title}</option>)}</select></label>
      <small>Les photos de ce chapitre apparaîtront à l’arrivée. Recherche de lieux : Photon / OpenStreetMap.</small>
      {error && <p role="alert" className="error-message">{error}</p>}
    </div>
  </details>
}
