import StopDetails from './StopDetails'
import DailyPlan from './DailyPlan'
import { readJournals } from '../trip-journals'
import { lazy, Suspense, useState } from 'react'
import type { FormEvent } from 'react'
import { createId } from '../id'
import { daysUntil, readUpcoming, upcomingKey, validateUpcomingTrips } from '../upcoming-trips'
import type { UpcomingTrip } from '../upcoming-trips'

const RouteBuilder = lazy(() => import('./RouteBuilder'))

const emptyPlan = () => ({ ideas: [], stops: [], notes: '' }) as NonNullable<UpcomingTrip['plan']>

export default function TripPlanner({ id, back, openJournal, openMotion }: { id: string; back: () => void; openJournal: () => void; openMotion: () => void }) {
  const [stored, setStored] = useState(readUpcoming)
  const [idea, setIdea] = useState('')
  const [place, setPlace] = useState('')
  const [date, setDate] = useState('')
  const [message, setMessage] = useState('')
  const trip = stored.trips.find(item => item.id === id)
  const plan = trip?.plan ?? emptyPlan()
  const chapters = readJournals().data.journals.find(j => j.tripId === id)?.chapters ?? []

  function save(update: (current: NonNullable<UpcomingTrip['plan']>) => NonNullable<UpcomingTrip['plan']>): boolean {
    if (!trip || stored.error) return false
    // Re-read before every write: never overwrite a corrupted or concurrently changed store.
    const latest = readUpcoming()
    if (latest.error || JSON.stringify(latest.trips.find(item => item.id === id)) !== JSON.stringify(trip)) {
      setStored(latest)
      setMessage('Le voyage a changé dans un autre onglet. Rechargez la page avant de continuer.')
      return false
    }
    const updated = latest.trips.map(item => item.id === id ? { ...item, plan: update(item.plan ?? emptyPlan()) } : item)
    if (!validateUpcomingTrips(updated)) {
      setMessage('La limite de préparation est atteinte ou une donnée est invalide.')
      return false
    }
    try {
      localStorage.setItem(upcomingKey, JSON.stringify(updated))
      setStored({ trips: updated, error: '' })
      window.dispatchEvent(new Event('upcoming-trips-updated'))
      setMessage('')
      return true
    } catch {
      setMessage('Impossible d’enregistrer sur cet appareil. Libérez de l’espace avant de continuer.')
      return false
    }
  }

  function addIdea(event: FormEvent) {
    event.preventDefault()
    const text = idea.trim()
    if (text && save(current => ({ ...current, ideas: [...current.ideas, { id: createId(), text }] }))) setIdea('')
  }
  function addStop(event: FormEvent) {
    event.preventDefault()
    const name = place.trim()
    if (name && save(current => ({ ...current, stops: [...current.stops, { id: createId(), place: name, ...(date ? { date } : {}) }] }))) { setPlace(''); setDate('') }
  }
  function move(index: number, direction: number) {
    save(current => {
      const stops = [...current.stops]
      ;[stops[index], stops[index + direction]] = [stops[index + direction], stops[index]]
      return { ...current, stops }
    })
  }

  return <section className="planner page-width" aria-labelledby="planner-title">
    <button className="text-button" onClick={back}>← Tous les voyages</button>
    {stored.error && <p role="alert" className="error-message">{stored.error}</p>}
    {message && <p role="alert" className="error-message">{message}</p>}
    {!trip ? <div className="planner-empty"><p className="eyebrow">Le voyage</p><h1 id="planner-title">Ce voyage est introuvable</h1><p>Il n’est plus enregistré dans ce navigateur. Vos autres voyages restent accessibles depuis l’accueil.</p><button className="button" onClick={back}>Retour au carnet</button></div> : <>
      <header className="planner-hero"><p className="eyebrow">Votre prochaine histoire</p><h1 id="planner-title">{trip.destination}</h1><p>Départ le {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date(`${trip.departure}T12:00:00`))} · {Math.max(0, daysUntil(trip.departure, new Date()) ?? 0)} jours avant le départ</p><button className="button button-light" onClick={openJournal}>Ouvrir le carnet de {trip.destination} →</button><button className="button button-light" onClick={openMotion}>Voir le voyage →</button><span>La préparation reste privée, sur cet appareil, jusqu’à sa sauvegarde dans une archive.</span></header>
      <Suspense fallback={<p role="status">Ouverture de la carte…</p>}><RouteBuilder stops={plan.stops} chapters={chapters} save={update => save(current => ({ ...current, stops: update(current.stops) }))} /></Suspense>
      <DailyPlan trip={trip} update={updated => save(current => ({ ...current, stops: current.stops.map(item => item.id === updated.id ? updated : item) }))} />
      <div className="planner-grid">
        <section className="planner-panel" aria-labelledby="ideas-title"><p className="eyebrow">01 · L’inspiration</p><h2 id="ideas-title">Ce qui vous attire.</h2><p>Gardez des envies sans décider encore du programme.</p>
          <ul>{plan.ideas.map(item => <li key={item.id}><span>{item.text}</span><button className="text-button" aria-label={`Retirer l’envie ${item.text}`} onClick={() => save(current => ({ ...current, ideas: current.ideas.filter(idea => idea.id !== item.id) }))}>Retirer</button></li>)}</ul>
          <form onSubmit={addIdea}><label>Nouvelle envie<input value={idea} onChange={event => setIdea(event.target.value)} maxLength={160} required placeholder="Un lieu, une expérience…" /></label><button className="button" disabled={plan.ideas.length >= 30}>Ajouter une envie</button></form>
        </section>
        <section className="planner-panel" aria-labelledby="stops-title"><p className="eyebrow">02 · Le parcours</p><h2 id="stops-title">Les étapes prennent forme.</h2><p>Ajoutez le départ et les escales, situez chaque lieu et choisissez le transport pour y arriver.</p>
          <ol>{plan.stops.map((stop, index) => <li key={stop.id}><span><strong>{stop.place}</strong>{stop.date && <small>{stop.date}</small>}</span><span className="planner-controls"><button className="text-button" aria-label={`Monter ${stop.place}`} disabled={index === 0} onClick={() => move(index, -1)}>↑</button><button className="text-button" aria-label={`Descendre ${stop.place}`} disabled={index === plan.stops.length - 1} onClick={() => move(index, 1)}>↓</button><button className="text-button" aria-label={`Retirer l’étape ${stop.place}`} onClick={() => save(current => ({ ...current, stops: current.stops.filter(item => item.id !== stop.id) }))}>Retirer</button></span><StopDetails stop={stop} first={index === 0} chapters={chapters} update={updated => save(current => ({ ...current, stops: current.stops.map(item => item.id === updated.id ? updated : item) }))} /></li>)}</ol>
          <form onSubmit={addStop}><label>Nouvelle étape<input value={place} onChange={event => setPlace(event.target.value)} maxLength={160} required placeholder="Une ville, une escale…" /></label><label>Date de l’étape<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label><button className="button" disabled={plan.stops.length >= 30}>Ajouter une étape</button></form>
        </section>
      </div>
      <section className="planner-panel planner-notes"><p className="eyebrow">03 · À garder en tête</p><h2>Quelques repères.</h2><label>Notes de préparation<textarea value={plan.notes} onChange={event => save(current => ({ ...current, notes: event.target.value }))} maxLength={4000} rows={5} placeholder="Réservations, idées pratiques, petits détails…" /></label></section>
      <p className="local-note">Envies, étapes et notes sont enregistrées dans ce navigateur et incluses dans les nouvelles archives ZIP du carnet. Aucun voyage n’est réservé ni publié ici.</p>
    </>}
  </section>
}
