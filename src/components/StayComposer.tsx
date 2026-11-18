import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { createId } from '../id'
import { composeDays, haversineKm, stayContextKey } from '../stay-composer'
import type { GeoPoint, StayDay, StayPlace, StayPlan } from '../stay-composer'
import { geocodeDestination, ProviderError, searchNearby, storeObservedCandidates } from '../stay-providers'
import type { GeocodedPlace, PoiSearchResult } from '../stay-providers'

const StayMap = lazy(() => import('./StayMap'))

type Props = { stay?: StayPlan; stayContexts?: { key: string; stay: StayPlan }[]; selectedStayContextKey?: string; destination: string; onSave: (plan: StayPlan, expected: StayPlan | undefined, contextKey?: string) => Promise<boolean> }
const defaultPoint = (place: GeocodedPlace): StayPlan['anchor'] => ({ name: place.name, latitude: place.latitude, longitude: place.longitude })

export default function StayComposer({ stay, stayContexts = [], selectedStayContextKey, destination, onSave }: Props) {
  const [query, setQuery] = useState(stay?.anchor.name ?? destination)
  const [geocodes, setGeocodes] = useState<GeocodedPlace[]>([])
  const [chosen, setChosen] = useState<GeocodedPlace | null>(null)
  const [results, setResults] = useState<PoiSearchResult | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [showMap, setShowMap] = useState(false)
  const [showMore, setShowMore] = useState({ restaurant: false, activity: false })
  const [manualName, setManualName] = useState('')
  const [manualCategory, setManualCategory] = useState<StayPlace['category']>('activity')
  const [highlightedPlaceId, setHighlightedPlaceId] = useState('')
  const [picked, setPicked] = useState<GeoPoint | null>(null)
  const [daysCount, setDaysCount] = useState(stay?.daysCount ?? 1)
  const [proposal, setProposal] = useState<StayDay[] | null>(null)
  const controller = useRef<AbortController | null>(null)
  const currentRequest = useRef(0)
  const selected = stay?.places ?? []
  const anchor = stay?.anchor
  const selectedIds = new Set(selected.map(place => place.id))
  const persist = (plan: StayPlan, contextKey = selectedStayContextKey) => onSave(plan, stay, contextKey)
  const resultsByCategory = (category: StayPlace['category']) => results?.places.filter(place => place.category === category) ?? []

  useEffect(() => () => { currentRequest.current += 1; controller.current?.abort() }, [])
  useEffect(() => {
    // Synchronize editor state with the selected persisted context (including
    // a conflict reload from another tab); this is not derived search output.
    // eslint-disable-next-line react/set-state-in-effect
    setQuery(stay?.anchor.name ?? destination)
    setDaysCount(stay?.daysCount ?? 1)
    setProposal(null)
    setPicked(null)
  }, [selectedStayContextKey, stay?.anchor.name, stay?.anchor.latitude, stay?.anchor.longitude, stay?.daysCount, destination])

  function beginRequest() {
    controller.current?.abort()
    controller.current = new AbortController()
    currentRequest.current += 1
    return { controller: controller.current, request: currentRequest.current }
  }
  function stillCurrent(request: number, signal: AbortSignal) { return currentRequest.current === request && !signal.aborted }

  async function searchDestination(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = query.trim()
    if (!text) return
    const { controller: active, request } = beginRequest()
    setBusy(true); setMessage(''); setChosen(null); setGeocodes([]); setResults(null)
    try {
      const places = await geocodeDestination(text, active.signal)
      if (!stillCurrent(request, active.signal)) return
      setGeocodes(places)
      setMessage(places.length ? 'Choisissez le centre qui correspond à votre étape.' : 'Aucune destination correspondante dans cette recherche. Vous pouvez reformuler puis relancer.')
    } catch (error) {
      if (stillCurrent(request, active.signal) && !(error instanceof DOMException && error.name === 'AbortError')) setMessage(error instanceof Error ? error.message : 'La recherche de destination est indisponible.')
    } finally { if (stillCurrent(request, active.signal)) setBusy(false) }
  }

  async function explore(place: GeocodedPlace) {
    const { controller: active, request } = beginRequest()
    const anchorPoint = defaultPoint(place)
    const contextKey = stayContextKey(anchorPoint)
    const context = stayContexts.find(item => item.key === contextKey)?.stay ?? (stay && stayContextKey(stay.anchor) === contextKey ? stay : undefined)
    const working = context ?? { anchor: anchorPoint, places: [], days: [], daysCount: 1 }
    setChosen(place); setBusy(true); setMessage(''); setResults(null); setProposal(null); setShowMap(true)
    try {
      const result = await searchNearby(place, active.signal)
      if (!stillCurrent(request, active.signal)) return
      setResults(result)
      storeObservedCandidates(result, place)
      if (!await onSave({ ...working, anchor: anchorPoint }, stay, contextKey)) return
      setMessage(result.places.length ? `${result.places.length} lieux nommés trouvés dans un rayon de 2,5 km. Données observées le ${new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(result.observedAt))}.` : 'Aucun lieu nommé avec ces catégories OSM dans ce rayon. Cela ne signifie pas qu’il n’existe aucun lieu sur place.')
    } catch (error) {
      if (!stillCurrent(request, active.signal)) return
      const kind = error instanceof ProviderError ? error.kind : undefined
      setMessage(kind === 'unavailable' ? `${error instanceof Error ? error.message : 'Service indisponible'} Aucune liste affichée.` : error instanceof Error ? error.message : 'Les données OpenStreetMap sont indisponibles.')
    } finally { if (stillCurrent(request, active.signal)) setBusy(false) }
  }

  async function toggleWish(place: StayPlace) {
    if (!anchor || busy) return
    const removing = selectedIds.has(place.id)
    const days = stay?.days ?? []
    if (removing && days.some(day => day.locked && day.placeIds.includes(place.id))) {
      setMessage('Ce lieu appartient à une journée verrouillée. Déverrouillez-la avant de le retirer de vos envies.')
      return
    }
    const places = removing ? selected.filter(item => item.id !== place.id) : selected.length >= 30 ? selected : [...selected, place]
    if (places.length === selected.length && !removing) { setMessage('La liste locale est limitée à 30 lieux.'); return }
    const nextDays = removing ? days.map(day => ({ ...day, placeIds: day.placeIds.filter(id => id !== place.id) })) : days
    if (await persist({ anchor, places, days: nextDays, daysCount })) setMessage(removing ? 'Lieu retiré de vos envies.' : 'Lieu gardé dans vos envies.')
  }

  async function addManual(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!anchor || !picked) { setMessage('Choisissez d’abord les coordonnées sur la carte.'); return }
    const name = manualName.trim()
    if (!name || selected.length >= 30) return
    const place: StayPlace = { id: createId(), name, category: manualCategory, latitude: picked.latitude, longitude: picked.longitude, source: 'manual' }
    if (await persist({ anchor, places: [...selected, place], days: stay?.days ?? [], daysCount })) { setManualName(''); setMessage('Lieu ajouté à vos envies locales.') }
  }

  function compose() {
    if (!anchor) { setMessage('Choisissez d’abord une destination.'); return }
    const composed = composeDays(selected, daysCount, stay?.days ?? [])
    setProposal(composed.days)
    if (composed.days.length > daysCount) setDaysCount(composed.days.length)
    const lockedCount = (stay?.days ?? []).filter(day => day.locked).length
    const preserved = composed.days.length > daysCount ? `${lockedCount} journées verrouillées ont été conservées ; la durée demandée a été ajustée à ${composed.days.length}. ` : ''
    setMessage(preserved + (composed.warnings.join(' ') || 'Proposition prête à relire. Rien n’est enregistré avant votre validation.'))
  }

  async function acceptProposal() {
    if (!anchor || !proposal) return
    if (await persist({ anchor, places: selected, days: proposal, daysCount: proposal.length })) { setDaysCount(proposal.length); setProposal(null); setMessage('Votre organisation est enregistrée sur cet appareil.') }
  }

  async function updateDay(dayId: string, update: (day: StayDay) => StayDay, allowLocked = false) {
    if (!anchor) return
    const source = proposal ?? stay?.days ?? []
    if (!allowLocked && source.find(day => day.id === dayId)?.locked) { setMessage('Déverrouillez cette journée avant de modifier son contenu.'); return }
    const days = source.map(day => day.id === dayId ? update(day) : day)
    if (proposal) setProposal(days)
    else await persist({ anchor, places: selected, days, daysCount })
  }

  async function removeFromDay(day: StayDay, placeId: string) {
    await updateDay(day.id, item => ({ ...item, placeIds: item.placeIds.filter(id => id !== placeId) }))
  }

  async function removeDay(day: StayDay) {
    if (day.locked) { setMessage('Déverrouillez cette journée avant de la retirer.'); return }
    const remaining = (proposal ?? stay?.days ?? []).filter(item => item.id !== day.id)
    const nextCount = Math.max(1, Math.min(daysCount, remaining.length || 1))
    const days = remaining.slice(0, nextCount)
    if (proposal) { setProposal(days); setDaysCount(nextCount); setMessage('Journée retirée de la proposition. Les lieux gardent leur place dans vos envies.') }
    else if (anchor && await persist({ anchor, places: selected, days, daysCount: nextCount })) { setDaysCount(nextCount); setMessage('Journée retirée. Les lieux gardent leur place dans vos envies.') }
  }

  async function movePlace(placeId: string, toDayId: string) {
    const days = proposal ?? stay?.days ?? []
    const from = days.find(day => day.placeIds.includes(placeId))
    const to = days.find(day => day.id === toDayId)
    if (!from || !to || from.id === to.id || from.locked || to.locked) { setMessage('Déverrouillez les journées concernées pour déplacer ce lieu.'); return }
    const update = days.map(day => day.id === from.id ? { ...day, placeIds: day.placeIds.filter(id => id !== placeId) } : day.id === to.id ? { ...day, placeIds: [...day.placeIds, placeId] } : day)
    if (proposal) setProposal(update)
    else if (anchor) await persist({ anchor, places: selected, days: update, daysCount })
  }

  const displayedDays = proposal ?? stay?.days ?? []
  const visibleCandidates = results?.places.filter(place => resultsByCategory(place.category).slice(0, showMore[place.category] ? 10 : 5).some(item => item.id === place.id)) ?? []
  return <section className="stay-composer" aria-labelledby="stay-title">
    <div className="stay-heading"><p className="eyebrow">03 · Explorer et composer</p><h2 id="stay-title">Des repères pour le voyage en famille.</h2>
      <p>Choisissez une étape puis explorez sa carte et ses lieux. Vos envies et journées restent séparées par centre choisi.</p>
      <p><strong>Les lieux et distances ne valident ni un trajet, ni la sécurité, ni l’adaptation aux enfants.</strong> Vérifiez chaque choix auprès des sources locales.</p>
      <details className="stay-limits"><summary>Limites, données et vie privée</summary><p>Prototype local pensé pour un séjour aux Philippines. Les données OSM communautaires peuvent être incomplètes ou obsolètes ; la proximité n’est pas un classement de qualité. Aucune géolocalisation automatique, date ou note personnelle n’est envoyée. Une distance à vol d’oiseau ne signifie pas qu’un trajet est accessible : routes, marche, ferry et liaisons entre îles ne sont pas vérifiés et restent à confirmer auprès des opérateurs. Les catégories OSM ne certifient jamais la sécurité ni l’adaptation d’un lieu aux enfants.</p></details></div>
    <form className="stay-search" onSubmit={searchDestination}>
      <label>Ville ou étape à explorer<input value={query} onChange={event => setQuery(event.target.value)} maxLength={120} required placeholder="Ex. Cebu City, Philippines" /></label>
      <button className="button" disabled={busy || !query.trim()}>{busy ? 'Recherche…' : 'Rechercher une destination'}</button>
    </form>
    <p className="stay-privacy">Au clic, le nom de destination est transmis à OpenStreetMap Nominatim. Aucune géolocalisation automatique, date ou note personnelle n’est envoyée.</p>
    {geocodes.length > 0 && <fieldset className="stay-geocodes"><legend>Quel lieu voulez-vous comme centre ?</legend>{geocodes.map(place => <div className="stay-geocode" key={place.sourceId}><label><input type="radio" name="stay-geocode" checked={chosen?.sourceId === place.sourceId} onChange={() => setChosen(place)} /><span><strong>{place.name}</strong><small>{place.label}</small></span></label><button className="text-button" disabled={busy} onClick={() => void explore(place)}>{busy && chosen?.sourceId === place.sourceId ? 'Recherche…' : 'Explorer autour'}</button></div>)}</fieldset>}
    {message && <p className="stay-message" role="status" aria-live="polite">{message}</p>}
    {anchor && <>
      <div className="stay-map-actions"><h3>{anchor.name} <small>· centre choisi</small></h3><button className="text-button" onClick={() => setShowMap(value => !value)}>{showMap ? 'Masquer la carte' : 'Afficher la carte'}</button></div>
      {showMap && <><Suspense fallback={<p role="status">Chargement de la carte…</p>}><StayMap anchor={anchor} places={selected} candidates={visibleCandidates} days={displayedDays} onSelectPlace={id => { setHighlightedPlaceId(id); window.setTimeout(() => Array.from(document.querySelectorAll<HTMLElement>('[data-stay-place]')).find(item => item.dataset.stayPlace === id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0) }} onPick={point => { setPicked(point); setMessage(`Point choisi : ${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}. Ajoutez un lieu manuel ci-dessous si vous le souhaitez.`) }} /></Suspense><p className="stay-attribution">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">les contributeurs OpenStreetMap</a> · tuiles chargées en direct, sans téléchargement hors ligne.</p>
        {picked && <form className="stay-manual-form" onSubmit={addManual}><label>Nom du lieu<input value={manualName} onChange={event => setManualName(event.target.value)} maxLength={160} required placeholder="Votre repère" /></label><label>Catégorie<select value={manualCategory} onChange={event => setManualCategory(event.target.value as StayPlace['category'])}><option value="activity">Activité ou repère</option><option value="restaurant">Restaurant</option></select></label><span>{picked.latitude.toFixed(5)}, {picked.longitude.toFixed(5)}</span><button className="button" disabled={!manualName.trim() || selected.length >= 30}>Garder ce lieu</button></form>}
      </>}
      {results && <div className="stay-results"><p className="stay-caveat">Les plus proches parmi cet échantillon OSM borné (60 résultats par catégorie au maximum), pas « les meilleurs ». Horaires, qualité et durée de visite : inconnus.</p>{results.osmTimestamp && <small>Données source OSM : {results.osmTimestamp}</small>}
        {(['restaurant', 'activity'] as const).map(category => {
          const items = resultsByCategory(category)
          const expanded = showMore[category]
          const shown = items.slice(0, expanded ? 10 : 5)
          return <section className="stay-category" key={category}><h4>{category === 'restaurant' ? 'Restaurants' : 'Activités et repères'} <small>({items.length} noms retournés)</small></h4>
            {shown.length ? <ul>{shown.map(place => <li key={place.id} data-stay-place={place.id} className={highlightedPlaceId === place.id ? 'stay-place-highlighted' : undefined}><div><strong>{place.name}</strong><small>{selectedIds.has(place.id) ? 'Dans vos envies' : 'À découvrir'} · {haversineKm(anchor, place).toFixed(1)} km à vol d’oiseau · distance droite, pas un trajet</small><a href={place.sourceUrl} target="_blank" rel="noreferrer">Source OpenStreetMap ↗</a></div><button className={selectedIds.has(place.id) ? 'button button-light' : 'text-button'} aria-pressed={selectedIds.has(place.id)} onClick={() => void toggleWish(place)}>{selectedIds.has(place.id) ? 'Gardé · retirer' : 'Garder'}</button></li>)}</ul> : <p>Aucun nom de cette catégorie dans cette réponse OSM. Ce n’est pas une preuve qu’il n’existe aucun lieu.</p>}
            {items.length > 5 && <button className="text-button" onClick={() => setShowMore(old => ({ ...old, [category]: !old[category] }))}>{expanded ? 'Voir moins' : `Voir jusqu’à ${Math.min(10, items.length)}`}</button>}
          </section>
        })}
      </div>}
      {selected.length > 0 && <section className="stay-wishes"><h3>Vos envies gardées <small>({selected.length})</small></h3><ul>{selected.map(place => <li key={place.id}><div><strong>{place.name}</strong><small>{place.category === 'restaurant' ? 'Restaurant' : 'Activité / repère'} · {place.source === 'osm' ? 'OpenStreetMap' : 'Ajout manuel'}</small>{place.sourceUrl && <a href={place.sourceUrl} target="_blank" rel="noreferrer">Voir la source ↗</a>}</div><button className="text-button" aria-label={`Retirer ${place.name} de mes envies`} onClick={() => void toggleWish(place)}>Retirer</button></li>)}</ul></section>}
      <section className="stay-days"><p className="eyebrow">Vos choix, vos journées</p><h3>Composer sans tout remplir.</h3><p>Répartition indicative des envies gardées. Aucun temps de trajet n’est calculé. Vous pouvez garder des lieux en attente.</p>
        <label>Nombre de journées à préparer<select value={daysCount} onChange={event => { setDaysCount(Number(event.target.value)); setProposal(null) }}><option value={1}>1 journée</option><option value={2}>2 journées</option><option value={3}>3 journées</option></select></label>
        <button className="button" onClick={compose} disabled={!selected.length}>Recomposer une proposition</button>
        {displayedDays.map(day => <article className="stay-day" key={day.id}><div className="stay-day-heading"><h4>{day.title}</h4><span className="stay-day-buttons"><button className="text-button" aria-pressed={day.locked} onClick={() => void updateDay(day.id, item => ({ ...item, locked: !item.locked }), true)}>{day.locked ? '🔒 Journée verrouillée' : 'Verrouiller cette journée'}</button>{displayedDays.length > 1 && <button className="text-button" disabled={day.locked} onClick={() => void removeDay(day)}>Retirer la journée</button>}</span></div>
          {day.placeIds.length ? <ul>{day.placeIds.map(id => { const place = selected.find(item => item.id === id); return place ? <li key={id}><span>{place.name}</span><button className="text-button" onClick={() => void removeFromDay(day, id)}>Retirer du jour</button><label className="stay-move">Déplacer vers<select value="" onChange={event => { if (event.target.value) void movePlace(id, event.target.value) }}><option value="">Choisir une journée…</option>{displayedDays.filter(item => !item.locked && item.id !== day.id).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label></li> : null })}</ul> : <p>Journée encore libre.</p>}
        </article>)}
        {proposal && <div className="stay-accept"><p>Relisez la proposition. Elle ne remplace rien avant votre validation.</p><button className="button" onClick={() => void acceptProposal()}>Valider cette organisation</button><button className="text-button" onClick={() => { setProposal(null); setMessage('Proposition abandonnée ; vos journées enregistrées n’ont pas changé.') }}>Annuler</button></div>}
        {!proposal && stay?.days.length ? <p className="stay-saved-note">Votre organisation enregistrée se garde même lorsque vous changez de voyage.</p> : null}
      </section>
    </>}
    <p className="stay-footer">Fournisseurs : Nominatim pour le centre, Overpass pour les noms OSM, Leaflet et tuiles OpenStreetMap. Les services publics sont sans garantie de disponibilité. Rien n’est envoyé aux fournisseurs sans action explicite.</p>
  </section>
}
