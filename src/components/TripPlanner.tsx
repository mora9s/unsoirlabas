import StopDetails from './StopDetails'
import DailyPlan from './DailyPlan'
import OfflineAccess from './OfflineAccess'
import { lazy, Suspense, useState } from 'react'
import { useHydratedJournals } from '../use-hydrated-journals'
import type { FormEvent } from 'react'
import { createId } from '../id'
import { mergeStopUpdate } from '../plan-updates'
import { withDurabilityLock } from '../durability-lock'
import { daysUntil, readUpcoming, validateUpcomingTrips } from '../upcoming-trips'
import type { PlanStop, SourcedOption, UpcomingTrip } from '../upcoming-trips'
import { saveUpcomingMetadataUnlocked } from '../trip-journals'

import { stayContextKey } from '../stay-composer'
import type { StayPlan } from '../stay-composer'
import StayComposer from './StayComposer'

const RouteBuilder = lazy(() => import('./RouteBuilder'))

const emptyPlan = () => ({ ideas: [], stops: [], notes: '', options: [] }) as NonNullable<UpcomingTrip['plan']>

export default function TripPlanner({ id, panel = 'programme', back, openJournal, openMotion, openPlannedStep }: { id: string; panel?: 'programme' | 'map'; back: () => void; openJournal: () => void; openMotion: () => void; openPlannedStep: (stop: PlanStop) => void }) {
  const hydratedJournals = useHydratedJournals()
  const [stored, setStored] = useState(readUpcoming)
  const [idea, setIdea] = useState('')
  const [place, setPlace] = useState('')
  const [date, setDate] = useState('')
  const [message, setMessage] = useState('')
  const [optionTitle, setOptionTitle] = useState('')
  const [optionPlace, setOptionPlace] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [verifiedAt, setVerifiedAt] = useState('')
  const [status, setStatus] = useState<SourcedOption['status']>('to-check')
  const [conflict, setConflict] = useState(false)
  const [optionDate, setOptionDate] = useState('')
  const [transferMinutes, setTransferMinutes] = useState('')
  const trip = stored.trips.find(item => item.id === id)
  const plan = trip?.plan ?? emptyPlan()
  const chapters = hydratedJournals.data.journals.find(j => j.tripId === id)?.chapters ?? []

  async function save(update: (current: NonNullable<UpcomingTrip['plan']>) => NonNullable<UpcomingTrip['plan']>, expectedStay?: StayPlan, compareStay = false): Promise<boolean> {
    if (!trip || stored.error) return false
    try {
      return await withDurabilityLock(async () => {
        // Read only after acquiring the cross-tab lock; apply an updater to the latest plan.
        const latest = readUpcoming()
        if (latest.error || !latest.trips.some(item => item.id === id)) {
          setStored(latest)
          setMessage('Le voyage a changé dans un autre onglet. Rechargez la page avant de continuer.')
          return false
        }
        const latestTrip = latest.trips.find(item => item.id === id)!
        if (compareStay && JSON.stringify(latestTrip.plan?.stay) !== JSON.stringify(expectedStay)) {
          setStored(latest)
          setMessage('Cette préparation a changé dans un autre onglet. L’état le plus récent est rechargé ; réessayez votre action.')
          return false
        }
        const updated = latest.trips.map(item => item.id === id ? { ...item, plan: update(item.plan ?? emptyPlan()) } : item)
        if (!validateUpcomingTrips(updated)) {
          setMessage('La limite de préparation est atteinte ou une donnée est invalide.')
          return false
        }
        try {
          saveUpcomingMetadataUnlocked(updated)
          setStored({ trips: updated, error: '' })
          window.dispatchEvent(new Event('upcoming-trips-updated'))
          setMessage('')
          return true
        } catch {
          setMessage('Impossible d’enregistrer sur cet appareil. Libérez de l’espace avant de continuer.')
          return false
        }
      })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Enregistrement multi-onglets indisponible ; aucune modification n’a été écrite.')
      return false
    }
  }
  async function saveStay(next: StayPlan, expected: StayPlan | undefined, contextKey?: string) {
    const key = contextKey ?? stayContextKey(next.anchor)
    return save(current => {
      const previous = [...(current.stayContexts ?? [])]
      if (current.stay && !previous.some(item => item.key === stayContextKey(current.stay!.anchor))) {
        previous.push({ key: stayContextKey(current.stay.anchor), stay: current.stay })
      }
      const context = { key, stay: next }
      const contexts = [...previous.filter(item => item.key !== key), context]
      return { ...current, stay: next, stayContexts: contexts, selectedStayContextKey: key }
    }, expected, true)
  }

  async function addIdea(event: FormEvent) {
    event.preventDefault()
    const text = idea.trim()
    if (text && await save(current => ({ ...current, ideas: [...current.ideas, { id: createId(), text }] }))) setIdea('')
  }
  async function addStop(event: FormEvent) {
    event.preventDefault()
    const name = place.trim()
    if (name && await save(current => ({ ...current, stops: [...current.stops, { id: createId(), place: name, ...(date ? { date } : {}) }] }))) { setPlace(''); setDate('') }
  }
  async function addOption(event: FormEvent) {
    event.preventDefault()
    const title = optionTitle.trim(), stopPlace = optionPlace.trim()
    let parsed: URL
    try { parsed = new URL(sourceUrl.trim()) } catch { setMessage('Ajoutez une URL de source valide en http ou https.'); return }
    if (!['http:', 'https:'].includes(parsed.protocol)) { setMessage('Seules les sources http et https sont autorisées.'); return }
    if (parsed.username || parsed.password) { setMessage('Retirez le nom d’utilisateur et le mot de passe de cette URL : ces informations privées ne sont pas enregistrées.'); return }
    if (!verifiedAt || !/^\d{4}-\d{2}-\d{2}$/.test(verifiedAt) || new Date(`${verifiedAt}T12:00:00Z`).toISOString().slice(0, 10) !== verifiedAt) { setMessage('Indiquez une vraie date de vérification.'); return }
    if (optionDate && (optionDate < trip!.departure || (trip!.endDate && optionDate > trip!.endDate))) { setMessage('La date de la proposition doit être comprise entre le départ et la fin du voyage.'); return }
    const minutes = transferMinutes ? Number(transferMinutes) : undefined
    if (minutes !== undefined && (!Number.isSafeInteger(minutes) || minutes < 0 || minutes > 1440)) { setMessage('Le transfert estimé doit être compris entre 0 et 1 440 minutes.'); return }
    const option: SourcedOption = { id: createId(), title, place: stopPlace, sourceUrl: parsed.href, verifiedAt, status, conflict, ...(optionDate ? { date: optionDate } : {}), ...(minutes !== undefined ? { transferMinutes: minutes } : {}) }
    if (await save(current => ({ ...current, options: [...(current.options ?? []), option] }))) {
      setOptionTitle(''); setOptionPlace(''); setSourceUrl(''); setVerifiedAt(''); setStatus('to-check'); setConflict(false); setOptionDate(''); setTransferMinutes('')
    }
  }
  function importOption(option: SourcedOption) {
    save(current => ({ ...current, stops: [...current.stops, { id: createId(), place: option.place, ...(option.date ? { date: option.date } : {}), sourceUrl: option.sourceUrl, verifiedAt: option.verifiedAt, status: option.status, conflict: option.conflict, ...(option.transferMinutes !== undefined ? { transferMinutes: option.transferMinutes } : {}) }], options: (current.options ?? []).filter(item => item.id !== option.id) }))
  }
  function moveOption(optionId: string, direction: number) {
    save(current => {
      const options = [...(current.options ?? [])], index = options.findIndex(item => item.id === optionId), next = index + direction
      if (index < 0 || next < 0 || next >= options.length) return current
      ;[options[index], options[next]] = [options[next], options[index]]
      return { ...current, options }
    })
  }
  function move(stopId: string, direction: number) {
    save(current => {
      const stops = [...current.stops], index = stops.findIndex(item => item.id === stopId), next = index + direction
      if (index < 0 || next < 0 || next >= stops.length) return current
      ;[stops[index], stops[next]] = [stops[next], stops[index]]
      return { ...current, stops }
    })
  }

  return <section className="planner page-width" aria-labelledby="planner-title">
    <button className="text-button" onClick={back}>← Tous les voyages</button>
    {stored.error && <p role="alert" className="error-message">{stored.error}</p>}
    {message && <p role="alert" className="error-message">{message}</p>}
    {!trip ? <div className="planner-empty"><p className="eyebrow">Le voyage</p><h1 id="planner-title">Ce voyage est introuvable</h1><p>Il n’est plus enregistré dans ce navigateur. Vos autres voyages restent accessibles depuis l’accueil.</p><button className="button" onClick={back}>Retour au carnet</button></div> : <>
      <header className="planner-intro"><p className="eyebrow">{panel === 'map' ? 'Situer les envies, relier les escales' : 'Un jour, une nouvelle découverte'}</p><h1 id="planner-title">{panel === 'map' ? 'Votre voyage sur la carte' : 'Le programme de votre voyage'}</h1><p>Départ le {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date(`${trip.departure}T12:00:00`))}{(daysUntil(trip.departure,new Date()) ?? 0) > 0 ? ` · J−${daysUntil(trip.departure,new Date())}` : ''}</p><button className="button button-outline" onClick={openJournal}>Ouvrir le carnet</button><button className="button button-outline" onClick={openMotion}>Voir le voyage animé</button></header>
      <div><Suspense fallback={<p role="status">Ouverture de la carte…</p>}><RouteBuilder tripId={id} stops={plan.stops} chapters={chapters} save={update => save(current => ({ ...current, stops: update(current.stops) }))} /></Suspense></div>
      <div hidden={panel !== 'programme'}><DailyPlan chapters={chapters} trip={trip} update={updated => save(current => ({ ...current, stops: mergeStopUpdate(current.stops, plan.stops.find(item => item.id === updated.id)!, updated) }))} />
      </div><OfflineAccess />
      <StayComposer stay={plan.stay} stayContexts={plan.stayContexts} selectedStayContextKey={plan.selectedStayContextKey} destination={trip.destination} onSave={saveStay} />
      <details className="planner-organize" open><summary>Organiser mes étapes, envies et notes</summary><div className="planner-grid">
        <section className="planner-panel" aria-labelledby="ideas-title"><p className="eyebrow">01 · L’inspiration</p><h2 id="ideas-title">Ce qui vous attire.</h2><p>Gardez des envies sans décider encore du programme.</p>
          <ul>{plan.ideas.map(item => <li key={item.id}><span>{item.text}</span><button className="text-button" aria-label={`Retirer l’envie ${item.text}`} onClick={() => void save(current => ({ ...current, ideas: current.ideas.filter(idea => idea.id !== item.id) }))}>Retirer</button></li>)}</ul>
          <form onSubmit={addIdea}><label>Nouvelle envie<input value={idea} onChange={event => setIdea(event.target.value)} maxLength={160} required placeholder="Un lieu, une expérience…" /></label><button className="button" disabled={plan.ideas.length >= 30}>Ajouter une envie</button></form>
        </section>
        <section className="planner-panel" aria-labelledby="stops-title"><p className="eyebrow">02 · Le parcours</p><h2 id="stops-title">Les étapes prennent forme.</h2><p>Une date est facultative ; l’ordre reste modifiable. Les parcours cartographiques ne garantissent pas la faisabilité des trajets.</p>
          <ol>{plan.stops.map((stop, index) => <li key={stop.id}><span><strong>{stop.place}</strong>{stop.date && <small>{stop.date}</small>}{stop.sourceUrl && <small> · {stop.status === 'confirmed' ? 'confirmé (déclaré)' : stop.status === 'estimated' ? 'estimé' : 'à vérifier'} · source vérifiée le {stop.verifiedAt} · transfert {stop.transferMinutes !== undefined ? `${stop.transferMinutes} min estimé` : 'non renseigné'}{stop.conflict ? ' · sources contradictoires, à vérifier' : ''} · <a href={stop.sourceUrl} target="_blank" rel="noreferrer">source</a></small>}</span><span className="planner-controls"><button className="text-button" aria-label={`Monter ${stop.place}`} disabled={index === 0} onClick={() => move(stop.id, -1)}>↑</button><button className="text-button" aria-label={`Descendre ${stop.place}`} disabled={index === plan.stops.length - 1} onClick={() => move(stop.id, 1)}>↓</button><button className="text-button" aria-label={`Retirer l’étape ${stop.place}`} onClick={() => void save(current => ({ ...current, stops: current.stops.filter(item => item.id !== stop.id) }))}>Retirer</button><button className="text-button" onClick={() => openPlannedStep(stop)} aria-label={`Raconter ${stop.place}`}>Raconter →</button></span><StopDetails stop={stop} first={index === 0} chapters={chapters} update={updated => save(current => ({ ...current, stops: mergeStopUpdate(current.stops, plan.stops.find(item => item.id === updated.id)!, updated) }))} /></li>)}</ol>
          <form onSubmit={addStop}><label>Nouvelle étape<input value={place} onChange={event => setPlace(event.target.value)} maxLength={160} required placeholder="Une ville, une escale…" /></label><label>Date de l’étape<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label><button className="button" disabled={plan.stops.length >= 30}>Ajouter une étape</button></form>
        </section>
      </div>
      <section className="planner-panel planner-sourced-options" aria-labelledby="sourced-options-title"><p className="eyebrow">04 · Vos repères sourcés</p><h2 id="sourced-options-title">Des pistes, à vérifier.</h2><p>Ajoutez vous-même une source et sa date de vérification. Nous ne consultons pas le web : horaires, prix et disponibilités restent à vérifier auprès de la source. Les plages libres ne sont jamais remplies automatiquement.</p>
        <form onSubmit={addOption}>
          <label>Nom de la proposition<input value={optionTitle} onChange={event => setOptionTitle(event.target.value)} maxLength={160} required /></label><label>Lieu de la proposition<input value={optionPlace} onChange={event => setOptionPlace(event.target.value)} maxLength={160} required /></label><label>URL de la source<input type="text" inputMode="url" value={sourceUrl} onChange={event => setSourceUrl(event.target.value)} maxLength={2000} required placeholder="https://…" /></label><label>Vérifiée le<input type="date" value={verifiedAt} onChange={event => setVerifiedAt(event.target.value)} required /></label><label>État factuel<select value={status} onChange={event => setStatus(event.target.value as SourcedOption['status'])}><option value="confirmed">Confirmé par moi dans cette source</option><option value="estimated">Estimé</option><option value="to-check">À vérifier</option></select></label><label>Date prévue (facultative)<input type="date" value={optionDate} onChange={event => setOptionDate(event.target.value)} /></label><label>Temps de transfert estimé (minutes)<input type="number" min="0" max="1440" step="1" value={transferMinutes} onChange={event => setTransferMinutes(event.target.value)} placeholder="Facultatif" /></label><label className="planner-conflict"><input type="checkbox" checked={conflict} onChange={event => setConflict(event.target.checked)} /> Sources contradictoires ou état incertain</label><button className="button" disabled={(plan.options ?? []).length >= 30}>Ajouter à mes propositions</button>
        </form>
        {(plan.options ?? []).length === 0 ? <p>Aucune proposition enregistrée. Les journées et plages libres restent vides.</p> : <ol>{(plan.options ?? []).map((option, index) => <li key={option.id}><article><h3>{option.title}</h3><p>{option.place}{option.date ? ` · ${option.date}` : ''}</p><p>État : {option.status === 'confirmed' ? 'Confirmé (déclaré par vous)' : option.status === 'estimated' ? 'Estimé' : 'À vérifier'}{option.transferMinutes !== undefined ? ` · Transfert : ${option.transferMinutes} min, estimé` : ''}</p><p><a href={option.sourceUrl} target="_blank" rel="noreferrer">Consulter la source (ouvre un nouvel onglet)</a> · vérification déclarée le {option.verifiedAt}</p>{(option.status !== 'confirmed' || option.conflict) && <p role="alert" className="error-message">{option.conflict ? 'Sources indisponibles ou contradictoires : impossible de comparer ; vérifiez manuellement.' : 'Cette information est estimée ou à vérifier ; la date de vérification est déclarative, non confirmée par une consultation automatique.'}</p>}<button className="button" onClick={() => void importOption(option)} aria-label={`Ajouter au parcours : ${option.title}`} disabled={plan.stops.length >= 30}>Ajouter au parcours</button><button className="text-button" aria-label={`Monter la proposition ${option.title}`} disabled={index === 0} onClick={() => moveOption(option.id, -1)}>↑</button><button className="text-button" aria-label={`Descendre la proposition ${option.title}`} disabled={index === (plan.options ?? []).length - 1} onClick={() => moveOption(option.id, 1)}>↓</button><button className="text-button" aria-label={`Retirer la proposition ${option.title}`} onClick={() => void save(current => ({ ...current, options: (current.options ?? []).filter(item => item.id !== option.id) }))}>Retirer</button></article></li>)}</ol>}
      </section>
      <section className="planner-panel planner-notes"><p className="eyebrow">03 · À garder en tête</p><h2>Quelques repères.</h2><label>Notes de préparation<textarea value={plan.notes} onChange={event => { const notes = event.currentTarget.value; void save(current => ({ ...current, notes })) }} maxLength={4000} rows={5} placeholder="Réservations, idées pratiques, petits détails…" /></label></section>
      </details><p className="local-note">Envies, étapes et notes sont enregistrées dans ce navigateur et incluses dans les nouvelles archives ZIP du carnet. Aucun voyage n’est réservé ni publié ici.</p>
    </>}
  </section>
}
