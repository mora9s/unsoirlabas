import { useEffect, useMemo, useRef, useState } from 'react'
import { readUpcoming, transportModes } from '../upcoming-trips'
import { readJournals } from '../trip-journals'
import { journeyDemo, journeyDemoChapters } from '../journey-demo'
import './journey-player.css'

const icons = { plane: '✈', train: '🚆', car: '🚗', walk: '🚶', boat: '⛴' }
export default function JourneyPlayer({ id, back, plan }: { id: string; back: () => void; plan: () => void }) {
  const [stored, setStored] = useState(readUpcoming)
  const [journals, setJournals] = useState(readJournals)
  const demo = id === 'demo'
  const trip = demo ? journeyDemo : stored.trips.find(t => t.id === id)
  const stops = useMemo(() => trip?.plan?.stops ?? [], [trip])
  const [tab, setTab] = useState<'motion' | 'map'>('motion')
  const [leg, setLeg] = useState(0)
  const [progress, setProgress] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [boot, setBoot] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [description, setDescription] = useState('')
  const [illustrated, setIllustrated] = useState(false)
  const [duration, setDuration] = useState(12)
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const iframe = useRef<HTMLIFrameElement>(null)
  const requestId = useRef(0)
  const position = useRef(0)
  const sequence = useRef(false)
  const container = useRef<HTMLDivElement>(null)
  const missing = stops.filter(s => !s.point).length
  const transportsMissing = stops.slice(1).filter(s => !s.transport).length
  const valid = stops.length >= 2 && !missing && !transportsMissing
  const from = stops[leg], to = stops[leg + 1]
  const chapters = demo ? journeyDemoChapters : journals.data.journals.find(j => j.tripId === id)?.chapters ?? []
  const chapter = chapters.find(c => c.id === to?.chapterId)
  const photos = chapter ? [...chapter.media].sort((a, b) => Number(b.id === chapter.coverId) - Number(a.id === chapter.coverId)).slice(0, 3) : []
  const arriving = tab === 'motion' && progress >= 1
  function send(data: Record<string, unknown>) { iframe.current?.contentWindow?.postMessage({ source: 'travel-journal', ...data }, location.origin) }
  function seek(value: number) { position.current = value; setProgress(value); send({ type: 'seek', id: requestId.current, progress: Math.min(1, value) }) }
  useEffect(() => {
    const refresh = () => { setStored(readUpcoming()); setJournals(readJournals()); setPlaying(false); sequence.current = false; setLeg(0) }
    const visibility = () => { if (document.hidden) { setPlaying(false); sequence.current = false } }
    const preference = matchMedia('(prefers-reduced-motion: reduce)')
    const change = () => { setReduced(preference.matches); setPlaying(false); sequence.current = false }
    window.addEventListener('storage', refresh); window.addEventListener('upcoming-trips-updated', refresh); window.addEventListener('trip-journals-updated', refresh); document.addEventListener('visibilitychange', visibility); preference.addEventListener('change', change)
    return () => { window.removeEventListener('storage', refresh); window.removeEventListener('upcoming-trips-updated', refresh); window.removeEventListener('trip-journals-updated', refresh); document.removeEventListener('visibilitychange', visibility); preference.removeEventListener('change', change) }
  }, [])
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== iframe.current?.contentWindow || event.data?.source !== 'atlas-player') return
      if (event.data.type === 'boot') { setBoot(true); return }
      if (event.data.id !== undefined && event.data.id !== requestId.current) return
      if (event.data.type === 'error') { setError(event.data.message); setReady(false); setPlaying(false); sequence.current = false }
      if (event.data.type === 'ready') { setReady(true); setDescription(event.data.description); setError(''); if (sequence.current) setPlaying(true) }
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [])
  useEffect(() => {
    if (!boot || !valid || !from || !to) return
    // Synchronize controls with the asynchronous iframe request, not derived render data.
    // eslint-disable-next-line react/set-state-in-effect
    setReady(false); setError(''); setPlaying(false); position.current = 0; setProgress(0)
    const key = ++requestId.current
    if (tab === 'map') send({ type: 'overview', id: key, stops })
    else send({ type: 'configure', id: key, journey: { from: { name: from.place, ...from.point }, to: { name: to.place, ...to.point }, mode: to.transport, title: `${from.place} → ${to.place}`, illustrated } })
    const timeout = window.setTimeout(() => { if (requestId.current === key) { setError('Le rendu prend trop de temps. Revenez au carnet puis réessayez.'); setReady(false); setPlaying(false); sequence.current = false } }, 30000)
    const cancel = (event: MessageEvent) => { if (event.origin === location.origin && event.source === iframe.current?.contentWindow && event.data?.source === 'atlas-player' && event.data.id === key && ['ready','error'].includes(event.data.type)) clearTimeout(timeout) }
    window.addEventListener('message', cancel)
    return () => { clearTimeout(timeout); window.removeEventListener('message', cancel) }
  }, [boot, valid, from, to, tab, illustrated, stops])
  useEffect(() => {
    if (boot || !valid) return
    const timer = window.setTimeout(() => setError('Le globe ne peut pas démarrer. Vérifiez que votre navigateur autorise la 3D, puis réessayez.'), 15000)
    return () => clearTimeout(timer)
  }, [boot, valid])
  useEffect(() => {
    if (!playing || !ready || reduced) return
    let frame: number, previous = performance.now()
    const tick = (now: number) => {
      const next = Math.min(1 + 4 / duration, position.current + Math.min((now - previous) / 1000, .1) / duration)
      previous = now; seek(next)
      if (next >= 1 + 4 / duration) {
        if (leg < stops.length - 2) { setLeg(l => l + 1); setIllustrated(false) }
        else { setPlaying(false); sequence.current = false }
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, ready, reduced, duration, leg, stops.length])
  function select(index: number) { sequence.current = false; setPlaying(false); setIllustrated(false); if (index === leg) seek(0); else setLeg(index) }
  function play() {
    if (playing) { sequence.current = false; setPlaying(false); return }
    sequence.current = true
    if (progress >= 1) { if (leg === stops.length - 2) { if (leg === 0) seek(0); else { setLeg(0); return } } else seek(0) }
    setPlaying(true)
  }
  return <section className="journey-page page-width">
    <button className="text-button" onClick={back}>← Retour au carnet</button>
    <header className="journey-heading"><div><p className="eyebrow">Votre voyage en mouvement</p><h1>{trip?.destination ?? 'Voyage introuvable'}</h1></div><button className="button button-outline" onClick={plan}>{demo ? "Préparer mon voyage" : "Modifier les étapes"}</button></header>
    {demo && <p className="local-note">Exemple de démonstration · aucune étape ajoutée à vos voyages personnels.</p>}
    {(stored.error || journals.error) && <p role="alert" className="error-message">{stored.error || journals.error}</p>}
    {!valid ? <div className="journey-empty"><span aria-hidden="true">↗</span><h2>Reliez vos prochaines histoires.</h2><p>Ajoutez au moins deux étapes, situez-les sur la carte et choisissez le transport entre chacune.</p>{stops.length >= 2 && <p>{missing > 0 ? `${missing} lieu(x) à situer. ` : ''}{transportsMissing > 0 ? `${transportsMissing} transport(s) à choisir.` : ''}</p>}<button className="button" onClick={plan}>Préparer le parcours →</button></div> : <>
      <div className="journey-tabs" role="group" aria-label="Vue du voyage"><button aria-pressed={tab === 'motion'} onClick={() => { sequence.current = false; setPlaying(false); setTab('motion') }}>Voyage animé</button><button aria-pressed={tab === 'map'} onClick={() => { sequence.current = false; setPlaying(false); setTab('map') }}>Carte des étapes</button></div>
      <div className="journey-layout"><div className="journey-screen-column">
        <div className="journey-screen" ref={container}>
          <iframe ref={iframe} src={`${import.meta.env.BASE_URL}atlas/player.html`} title="Globe du voyage" tabIndex={-1} />
          {!ready && !error && <p className="journey-overlay" role="status">{boot ? 'Préparation du parcours…' : 'Ouverture du globe…'}</p>}
          {error && <div className="journey-overlay" role="alert"><p>{error}</p>{boot && tab === 'motion' && (to?.transport === 'car' || to?.transport === 'walk') && !illustrated && <button className="button button-light" onClick={() => setIllustrated(true)}>Utiliser une liaison illustrée</button>}</div>}
          {arriving && ready && <div className={`journey-arrival ${photos.length ? 'has-photos' : ''}`} data-testid="journey-arrival"><p className="eyebrow">Vous voilà à</p><h2>{to.place}</h2>{photos.length > 0 && <div className="arrival-photos">{photos.map(p => <img src={p.src} alt={p.name} key={p.id} />)}</div>}{chapter && <a href={demo ? "#day-8" : `#journey/${encodeURIComponent(id)}/${encodeURIComponent(chapter.id)}`}>{chapter.title} · Lire le chapitre →</a>}{!chapter && <p>Une nouvelle étape de votre voyage.</p>}</div>}
        </div>
        <p className="journey-description" role="status">{ready ? description : 'Le carnet et les photos restent disponibles pendant le chargement.'}</p>
        {tab === 'motion' && <div className="journey-playback">
          {!reduced && <button className="button" onClick={play} disabled={!ready}>{playing ? 'Pause' : progress >= 1 && leg === stops.length - 2 ? 'Revoir mon voyage' : 'Lancer le voyage'}</button>}
          <label>Avancement du trajet<input type="range" min="0" max="1000" value={Math.round(Math.min(1, progress) * 1000)} disabled={!ready} onChange={event => { sequence.current = false; setPlaying(false); seek(Number(event.target.value) / 1000) }} /></label>
          <button className="text-button" disabled={!ready} onClick={() => { sequence.current = false; setPlaying(false); seek(1) }}>Voir l’arrivée</button>
          {!reduced && <label>Durée par trajet<select value={duration} onChange={event => { sequence.current = false; setPlaying(false); setDuration(Number(event.target.value)) }}><option value={12}>12 secondes</option><option value={18}>18 secondes</option><option value={24}>24 secondes</option></select></label>}
          {reduced && <p>Animations réduites : explorez le trajet avec le curseur ou passez directement à l’arrivée.</p>}
        </div>}
      </div><aside className="journey-itinerary" aria-label="Les étapes du voyage"><p className="eyebrow">{stops.length} étapes · votre itinéraire</p><ol>{stops.map((stop, index) => <li key={stop.id} className={index === leg + 1 ? 'selected' : ''}><span className="stop-number">{index + 1}</span><div><strong>{stop.place}</strong>{stop.date && <small>{stop.date}</small>}{index > 0 ? <button aria-current={index === leg + 1 ? 'step' : undefined} onClick={() => { setTab('motion'); select(index - 1) }}>{icons[stop.transport!]} {transportModes[stop.transport!]} · Voir le trajet</button> : <small>Le départ</small>}</div></li>)}</ol></aside></div>
      <p className="journey-credits">Globe : Three Globe · Images détaillées : Esri et contributeurs. <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a> · <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer">Corriger la carte</a>. Les recherches et coordonnées nécessaires aux itinéraires sont transmises aux services cartographiques ; vos photos et récits restent sur cet appareil.</p>
    </>}
  </section>
}
