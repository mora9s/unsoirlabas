import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { GeoPoint, StayDay, StayPlace } from '../stay-composer'

type Props = { anchor: GeoPoint & { name: string }; places: StayPlace[]; candidates?: StayPlace[]; days?: StayDay[]; onPick: (point: GeoPoint) => void; onSelectPlace?: (id: string) => void }
const dayColors = ['#476fbd', '#8d5fa8', '#b45e47']
const tooltip = (text: string) => { const node = document.createElement('span'); node.textContent = text; return node }

export default function StayMap({ anchor, places, candidates = [], days = [], onPick, onSelectPlace }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const pick = useRef(onPick)
  const select = useRef(onSelectPlace)
  useEffect(() => { pick.current = onPick; select.current = onSelectPlace }, [onPick, onSelectPlace])

  useEffect(() => {
    if (!host.current) return
    const map = L.map(host.current, { center: [anchor.latitude, anchor.longitude], zoom: 14, scrollWheelZoom: false })
    mapRef.current = map
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">les contributeurs OpenStreetMap</a>',
    }).addTo(map)
    const anchorIcon = L.divIcon({ className: 'stay-anchor-pin', html: '<span aria-hidden="true">●</span>', iconSize: [24, 24], iconAnchor: [12, 12] })
    L.marker([anchor.latitude, anchor.longitude], { icon: anchorIcon }).addTo(map).bindTooltip(tooltip(`Centre : ${anchor.name}`))
    map.on('click', event => pick.current({ latitude: event.latlng.lat, longitude: event.latlng.lng }))
    const resize = () => map.invalidateSize()
    window.setTimeout(resize, 40)
    return () => { map.off(); map.remove(); mapRef.current = null }
  }, [anchor.latitude, anchor.longitude, anchor.name])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const layers = L.layerGroup().addTo(map)
    const assignment = new Map<string, number>()
    days.forEach((day, index) => day.placeIds.forEach(id => assignment.set(id, index)))
    const keptIds = new Set(places.map(place => place.id))
    const allPlaces = [...places, ...candidates.filter(place => !keptIds.has(place.id))]
    for (const place of allPlaces) {
      const day = assignment.get(place.id)
      const color = day === undefined ? (place.category === 'restaurant' ? '#9c5c40' : '#3d7568') : dayColors[day % dayColors.length]
      const marker = L.circleMarker([place.latitude, place.longitude], {
        radius: keptIds.has(place.id) ? 9 : 7, color, fillColor: keptIds.has(place.id) ? color : '#fffaf2', fillOpacity: keptIds.has(place.id) ? 0.92 : 0.75, weight: 3,
      }).addTo(layers).bindTooltip(tooltip(place.name))
      marker.getElement()?.setAttribute('data-stay-place-name', place.name)
      marker.on('click', () => select.current?.(place.id))
    }
    return () => { layers.remove() }
  }, [places, candidates, days])

  return <div ref={host} className="stay-map" role="application" aria-label="Carte interactive OpenStreetMap. Cliquez sur un point pour choisir ses coordonnées." />
}
