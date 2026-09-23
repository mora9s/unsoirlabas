import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { calendarDate, daysUntil, newUpcoming, readUpcoming, upcomingKey } from '../upcoming-trips'
import type { UpcomingTrip } from '../upcoming-trips'

function departureLabel(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(year, month - 1, day))
}

export default function UpcomingTrips({ openJournal }: { openJournal: (trip: UpcomingTrip) => void }) {
  const [stored, setStored] = useState(readUpcoming)
  const [now, setNow] = useState(() => new Date())
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [destination, setDestination] = useState('')
  const [departure, setDeparture] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const refresh = () => setNow(new Date())
    const sync = (event: StorageEvent) => {
      if (event.key === upcomingKey || event.key === null) setStored(readUpcoming())
    }
    const restored = () => setStored(readUpcoming())
    const timer = window.setInterval(refresh, 60_000)
    window.addEventListener('focus', refresh)
    window.addEventListener('storage', sync)
    window.addEventListener('upcoming-trips-updated', restored)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('storage', sync)
      window.removeEventListener('upcoming-trips-updated', restored)
    }
  }, [])

  const today = calendarDate(now)
  const trips = [...stored.trips].sort((a, b) => a.departure.localeCompare(b.departure) || a.destination.localeCompare(b.destination))
  const next = trips.find(trip => (daysUntil(trip.departure, now) ?? -1) >= 0)

  function startEdit(trip?: UpcomingTrip) {
    setEditing(trip?.id ?? null)
    setDestination(trip?.destination ?? '')
    setDeparture(trip?.departure ?? '')
    setMessage('')
    setOpen(true)
  }

  function save(tripsToSave: UpcomingTrip[]): boolean {
    try {
      localStorage.setItem(upcomingKey, JSON.stringify(tripsToSave))
      setStored({ trips: tripsToSave, error: '' })
      setMessage('')
      return true
    } catch {
      setMessage('Impossible d’enregistrer les décomptes sur cet appareil. Libérez de l’espace ou autorisez le stockage local.')
      return false
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (stored.error) return
    const name = destination.trim()
    if (!name || name.length > 80 || !departure || departure < today || daysUntil(departure, now) === null) {
      setMessage('Indiquez une destination et une date de départ valide, aujourd’hui ou plus tard.')
      return
    }
    if (!editing && trips.length >= 12) {
      setMessage('Douze voyages sont déjà enregistrés. Retirez-en un pour en ajouter un autre.')
      return
    }
    const updated = editing
      ? stored.trips.map(trip => trip.id === editing ? { ...trip, destination: name, departure } : trip)
      : [...stored.trips, newUpcoming(name, departure)]
    if (save(updated)) {
      setOpen(false)
      setEditing(null)
    }
  }

  return <section className="upcoming-trips page-width" data-testid="upcoming-trips" aria-labelledby="upcoming-title">
    <div className="upcoming-heading">
      <div><p className="eyebrow">L’appel du large</p><h2 id="upcoming-title">Le prochain départ <em>se rapproche.</em></h2></div>
      <button className="button button-outline" onClick={() => startEdit()} disabled={!!stored.error || trips.length >= 12}>Préparer un voyage <span aria-hidden="true">＋</span></button>
    </div>
    {stored.error && <p role="alert" className="error-message">{stored.error}</p>}
    {message && <p role="alert" className="error-message">{message}</p>}
    {next ? <div className="upcoming-feature" aria-label={`Prochain départ : ${next.destination}`}>
      <div className="upcoming-feature-copy"><span className="eyebrow">Bientôt, ailleurs</span><p>On y est presque.</p><strong>{next.destination}</strong><span className="upcoming-date">Départ le {departureLabel(next.departure)}</span><button className="text-button journal-open" onClick={() => openJournal(next)}>Créer le carnet de {next.destination}<span aria-hidden="true"> →</span></button></div>
      <div className="upcoming-big-number"><span>{daysUntil(next.departure, now) === 0 ? 'Aujourd’hui' : 'Encore'}</span><strong>{daysUntil(next.departure, now) === 0 ? 'J' : daysUntil(next.departure, now)}</strong><span>{daysUntil(next.departure, now) === 0 ? 'C’est le grand départ' : 'jours avant de partir'}</span></div>
    </div> : <div className="upcoming-empty"><span className="eyebrow">L’horizon vous attend</span><p>Le prochain départ se prépare ici.</p><span>Une destination, une date — et le plaisir de voir les jours nous en rapprocher.</span></div>}
    {trips.length > 0 && <div className="upcoming-list" aria-label="Voyages enregistrés">{trips.map(trip => {
      const remaining = daysUntil(trip.departure, now) ?? -1
      return <article key={trip.id} data-testid="upcoming-trip" className={remaining < 0 ? 'is-past' : ''}>
        <div className="upcoming-count">{remaining > 0 ? `J−${remaining}` : remaining === 0 ? 'JOUR J' : 'PASSÉ'}</div>
        <div className="upcoming-trip-copy"><h3>{trip.destination}</h3><p>{departureLabel(trip.departure)}{remaining < 0 ? ' · souvenir à raconter' : ''}</p></div>
        <div className="upcoming-actions"><button className="text-button" onClick={() => openJournal(trip)}>Carnet</button><button className="text-button" onClick={() => startEdit(trip)} disabled={!!stored.error} aria-label={`Modifier ${trip.destination}`}>Modifier</button><button className="text-button" onClick={() => save(stored.trips.filter(item => item.id !== trip.id))} disabled={!!stored.error} aria-label={`Retirer ${trip.destination}`}>Retirer</button></div>
      </article>
    })}</div>}
    {open && <form className="upcoming-form" onSubmit={submit}>
      <div><p className="eyebrow">Votre prochaine escale</p><h3>{editing ? 'Changer le cap' : 'Faire place à l’attente'}</h3></div>
      <label>Destination<input name="destination" value={destination} onChange={event => setDestination(event.target.value)} maxLength={80} required autoFocus /></label>
      <label>Date de départ<input name="departure" type="date" value={departure} min={editing && departure < today ? departure : today} onChange={event => setDeparture(event.target.value)} required /></label>
      <div className="upcoming-form-actions"><button className="button" type="submit">{editing ? 'Enregistrer les modifications' : 'Ajouter au décompte'}</button><button className="text-button" type="button" onClick={() => { setOpen(false); setMessage('') }}>Annuler</button></div>
    </form>}
    <p className="local-note">Ces dates restent sur cet appareil. La sauvegarde ZIP les inclut avec le carnet ; le récit vocal et ses fichiers audio ne sont pas inclus.</p>
  </section>
}
