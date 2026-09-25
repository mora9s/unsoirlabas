import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './route-builder.css'
import { createId } from '../id'
import { transportModes } from '../upcoming-trips'
import type { PlanStop, TransportMode } from '../upcoming-trips'
import type { Draft } from '../journal'
import { nearLongitude, routeLongitudeOrigin } from '../route-geography'

type Point = { lat: number; lon: number }
type Found = Point & { name: string; context: string }
const blank = () => ({ name: '', date: '', transport: '' as TransportMode | '', chapterId: '' })

export default function RouteBuilder({ stops, chapters, save }: { stops: PlanStop[]; chapters: Draft[]; save: (update: (stops: PlanStop[]) => PlanStop[]) => boolean }) {
  const target = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const tiles = useRef<L.TileLayer | null>(null)
  const selectRef = useRef<(id: string) => void>(() => {})
  const [selected, setSelected] = useState<string | null>(null)
  const [point, setPoint] = useState<Point | null>(null)
  const [fields, setFields] = useState(blank)
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<Found[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [tileError, setTileError] = useState(false)
  const request = useRef<AbortController | null>(null)
  const [undo, setUndo] = useState<{ before: PlanStop[]; after: PlanStop[] } | null>(null)
  const initialStops = useRef(stops)
  const chosenIndex = stops.findIndex(s => s.id === selected)
  const first = selected ? chosenIndex === 0 : stops.length === 0
  const longitudeOrigin = routeLongitudeOrigin(stops.flatMap(stop => stop.point ? [stop.point.lon] : []))
  function fit(points = stops) {
    const located = points.filter(s => s.point)
    if (!located.length) { map.current?.setView([25, 20], 2, { animate: false }); return }
    const origin = routeLongitudeOrigin(located.map(stop => stop.point!.lon))
    const bounds = L.latLngBounds(located.map(s => [s.point!.lat, nearLongitude(s.point!.lon, origin)] as L.LatLngTuple))
    map.current?.fitBounds(bounds, { padding: [35, 35], maxZoom: 12, animate: false })
  }
  function select(id: string) {
    const stop = stops.find(s => s.id === id)
    if (!stop) return
    setSelected(id); setPoint(stop.point ?? null); setFields({ name: stop.place, date: stop.date ?? '', transport: stop.transport ?? '', chapterId: stop.chapterId ?? '' }); setMessage('')
    if (stop.point) map.current?.setView([stop.point.lat, nearLongitude(stop.point.lon, longitudeOrigin)], Math.max(map.current.getZoom(), 9), { animate: false })
  }
  useEffect(() => { selectRef.current = select })
  useEffect(() => {
    if (!target.current) return
    const instance = L.map(target.current, { scrollWheelZoom: false, worldCopyJump: true, minZoom: 1, maxZoom: 19, zoomAnimation: false, fadeAnimation: false }).setView([25,20], 2)
    map.current = instance; layer.current = L.layerGroup().addTo(instance)
    const tileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' })
    let timeout: ReturnType<typeof setTimeout>
    tileLayer.on('loading', () => { clearTimeout(timeout); timeout = setTimeout(() => setTileError(true),12000) })
    tileLayer.on('tileerror', () => setTileError(true))
    tileLayer.on('load', () => {
      clearTimeout(timeout)
      const images = Array.from(tileLayer.getContainer()?.querySelectorAll<HTMLImageElement>('img.leaflet-tile') ?? [])
      setTileError(!images.length || images.some(image => !image.complete || !image.naturalWidth))
    })
    tiles.current = tileLayer.addTo(instance)
    instance.on('click', (event: L.LeafletMouseEvent) => { const p = event.latlng.wrap(); setPoint({ lat: Number(p.lat.toFixed(6)), lon: Number(p.lng.toFixed(6)) }); setMessage('Position choisie. Nommez le lieu puis enregistrez l’étape.') })
    fit(initialStops.current)
    const observer = new ResizeObserver(() => instance.invalidateSize()); observer.observe(target.current)
    return () => { clearTimeout(timeout); observer.disconnect(); instance.remove(); map.current = null; tiles.current = null; request.current?.abort() }
  }, [])
  useEffect(() => {
    const group = layer.current
    if (!group) return
    group.clearLayers()
    const marker = (p: Point, text: string, name: string, id?: string) => {
      const node = L.marker([p.lat, nearLongitude(p.lon, longitudeOrigin)], { draggable: true, title: name, alt: name, icon: L.divIcon({ className: `route-pin ${id === selected || !id ? 'chosen' : ''}`, html: `<span>${text}</span>`, iconSize: [32,32], iconAnchor: [16,16] }) }).addTo(group)
      const tooltip = document.createElement('span'); tooltip.textContent = name; node.bindTooltip(tooltip)
      node.on('click', () => { if (id) selectRef.current(id) })
      node.on('dragend', () => { if (id) selectRef.current(id); const next = node.getLatLng().wrap(); setPoint({ lat: Number(next.lat.toFixed(6)), lon: Number(next.lng.toFixed(6)) }); setMessage('Position déplacée. Enregistrez pour conserver ce changement.') })
    }
    stops.forEach((stop, index) => {
      const p = stop.id === selected && point ? point : stop.point
      if (p) marker(p, String(index + 1), `Étape ${index + 1} : ${stop.place}`, stop.id)
      const previous = stops[index - 1]?.point
      if (previous && stop.point) {
        const start = nearLongitude(previous.lon, longitudeOrigin)
        const lon = nearLongitude(stop.point.lon, start)
        L.polyline([[previous.lat, start], [stop.point.lat, lon]], { color: '#26666a', weight: 2, dashArray: '5 8', interactive: false }).addTo(group)
      }
    })
    if (!selected && point) marker(point, '+', 'Nouvelle position')
  }, [stops, selected, point, longitudeOrigin])
  async function search() {
    request.current?.abort(); const controller = new AbortController(); request.current = controller
    setBusy(true); setFound([]); setMessage('')
    const timeout = setTimeout(() => controller.abort(), 12000)
    try {
      const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query.trim())}&limit=5&lang=fr`, { signal: controller.signal })
      if (!response.ok) throw new Error('service')
      const body = await response.json()
      const results: Found[] = body.features.filter((f: { geometry?: { type: string } }) => f.geometry?.type === 'Point').map((f: { geometry: { coordinates: number[] }; properties: Record<string,string> }) => ({ lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], name: f.properties.name || f.properties.city || query, context: [f.properties.city, f.properties.state, f.properties.country].filter(Boolean).join(' · ') })).filter((p: Found) => Number.isFinite(p.lat) && Math.abs(p.lat) <= 90 && Number.isFinite(p.lon) && Math.abs(p.lon) <= 180)
      if (request.current !== controller || controller.signal.aborted) return
      setFound(results); if (!results.length) setMessage('Aucun résultat. Précisez le pays, ou choisissez directement sur la carte.')
    } catch { if (request.current === controller) setMessage('Recherche indisponible. Vous pouvez choisir un point sur la carte ou utiliser les coordonnées dans la liste des étapes.') }
    finally { clearTimeout(timeout); if (request.current === controller) setBusy(false) }
  }
  function reset() { setSelected(null); setPoint(null); setFields(blank()); setMessage(''); setFound([]) }
  function persist() {
    if (!point || !fields.name.trim() || (!first && !fields.transport)) { setMessage('Choisissez une position, un nom et le transport pour y arriver.'); return }
    const stop: PlanStop = { id: selected ?? createId(), place: fields.name.trim(), point, ...(fields.date ? { date: fields.date } : {}), ...(fields.transport ? { transport: fields.transport } : {}), ...(fields.chapterId ? { chapterId: fields.chapterId } : {}) }
    if (selected && chosenIndex < 0) { setMessage('Cette étape a été retirée. Choisissez une autre étape.'); return }
    if (save(current => selected ? current.map(s => s.id === selected ? stop : s) : [...current, stop])) { reset(); setMessage(selected ? 'Étape mise à jour.' : 'Étape ajoutée. Choisissez la prochaine escale.'); setUndo(null) }
  }
  function remove() {
    const after = stops.filter(s => s.id !== selected)
    if (save(() => after)) { setUndo({ before: stops, after }); reset(); setMessage('Étape retirée. Vous pouvez annuler ce retrait.') }
  }
  return <section className="route-builder" aria-label="Construire le parcours sur la carte">
    <div className="route-builder-heading"><div><p className="eyebrow">Le parcours</p><h2>Une escale, puis la suivante.</h2></div><button className="text-button" onClick={() => fit()}>Tout voir sur la carte</button></div>
    <div className="route-builder-grid"><div className="route-map-column">
      <form className="route-search" onSubmit={event => { event.preventDefault(); void search() }}><label>Chercher une ville ou un lieu<input value={query} maxLength={160} onChange={event => { request.current?.abort(); request.current = null; setBusy(false); setFound([]); setQuery(event.target.value) }} placeholder="Un aéroport, une ville, un hôtel…" /></label><button className="button" disabled={busy || !query.trim()}>{busy ? 'Recherche…' : 'Rechercher'}</button></form>
      {found.length > 0 && <ul className="route-results">{found.map((p, i) => <li key={i}><button onClick={() => { setPoint({ lat: p.lat, lon: p.lon }); setFields(f => ({ ...f, name: p.name.slice(0,160) })); setFound([]); map.current?.setView([p.lat,nearLongitude(p.lon, longitudeOrigin)], 12, { animate: false }) }}>{p.name}<small>{p.context}</small></button></li>)}</ul>}
      <div ref={target} className="route-map" aria-label="Carte interactive des étapes" />
      <p className="route-map-note">Cliquez sur la carte pour choisir un lieu ; déplacez un repère pour ajuster sa position. Pointillés : liaisons illustrées, sans calcul d’itinéraire.</p>
      {tileError && <div className="route-map-error"><p role="status">Le fond de carte ne se charge pas complètement. Vérifiez la connexion ; vos étapes sont conservées.</p><button className="text-button" onClick={() => { setTileError(false); tiles.current?.redraw() }}>Réessayer le fond de carte</button></div>}
    </div><div className="route-editor">
      <div className="route-editor-heading"><h3>{selected ? 'Modifier cette escale' : stops.length ? 'La prochaine escale' : 'Le point de départ'}</h3>{selected && <button className="text-button" onClick={reset}>Nouvelle escale</button>}</div>
      <form onSubmit={event => { event.preventDefault(); persist() }}>
        <label>Nom du lieu<input maxLength={160} required value={fields.name} onChange={event => setFields(f => ({ ...f, name: event.target.value }))} /></label>
        <p className="route-position">{point ? `${point.lat.toFixed(4)}, ${point.lon.toFixed(4)}` : 'Recherchez un lieu ou cliquez sur la carte.'}</p>
        {!first && <label>Comment y arrivez-vous ?<select required value={fields.transport} onChange={event => setFields(f => ({ ...f, transport: event.target.value as TransportMode }))}><option value="">Choisir le transport</option>{Object.entries(transportModes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>}
        <label>Date de passage (facultative)<input type="date" value={fields.date} onChange={event => setFields(f => ({ ...f, date: event.target.value }))} /></label>
        <label>Chapitre à l’arrivée<select value={fields.chapterId} onChange={event => setFields(f => ({ ...f, chapterId: event.target.value }))}><option value="">Associer plus tard</option>{chapters.map(c => <option value={c.id} key={c.id}>{c.title}</option>)}</select></label>
        <button className="button" disabled={!point || (!selected && stops.length >= 30)}>{selected ? 'Enregistrer cette escale' : 'Ajouter cette escale'}</button>
      </form>
      {selected && <button className="text-button" onClick={remove}>Retirer cette escale</button>}
      {message && <p role="status" className="route-message">{message}</p>}
      {undo && <button className="text-button" onClick={() => { if (JSON.stringify(stops) !== JSON.stringify(undo.after)) { setMessage('Le parcours a changé depuis ce retrait. Annulation indisponible.'); setUndo(null); return }; if (save(() => undo.before)) { setUndo(null); setMessage('Étape rétablie.') } }}>Annuler le retrait</button>}
    </div></div>
    <ol className="route-stop-strip">{stops.map((stop, index) => <li key={stop.id}><button aria-pressed={selected === stop.id} onClick={() => select(stop.id)}><span>{index + 1}</span><strong>{stop.place}</strong><small>{!stop.point ? 'À situer' : index === 0 ? 'Départ' : stop.transport ? transportModes[stop.transport] : 'Transport à choisir'}</small></button></li>)}</ol>
    <p className="route-map-note">La recherche de lieux utilise Photon / OpenStreetMap. Après avoir changé l’ordre des étapes, vérifiez le transport vers chacune.</p>
  </section>
}
