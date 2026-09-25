import { saveUpcomingMetadata } from '../trip-journals'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { calendarDate, daysUntil, newUpcoming, readUpcoming, tripIsPast, upcomingKey } from '../upcoming-trips'
import type { UpcomingTrip } from '../upcoming-trips'
import type { PersonalJournal } from '../trip-journals'
import { coverOf } from '../journal'

function dateLabel(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(year, month - 1, day))
}

export default function UpcomingTrips({ openJournal, openPlanner, journals = [] }: { openJournal: (trip: UpcomingTrip) => void; openPlanner: (id: string) => void; journals?: PersonalJournal[] }) {
  const [stored, setStored] = useState(readUpcoming)
  const [now, setNow] = useState(() => new Date())
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [destination, setDestination] = useState('')
  const [departure, setDeparture] = useState('')
  const [endDate, setEndDate] = useState('')
  const [message, setMessage] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const openerRef = useRef<HTMLButtonElement>(null)
  const destinationRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const refresh = () => setNow(new Date())
    const sync = (event: StorageEvent) => { if (event.key === upcomingKey || event.key === null) setStored(readUpcoming()) }
    const restored = () => setStored(readUpcoming())
    const timer = window.setInterval(refresh, 60_000)
    window.addEventListener('focus', refresh)
    window.addEventListener('storage', sync)
    window.addEventListener('upcoming-trips-updated', restored)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('storage', sync); window.removeEventListener('upcoming-trips-updated', restored) }
  }, [])

  const today = calendarDate(now)
  const trips = [...stored.trips].sort((a, b) => a.departure.localeCompare(b.departure) || a.destination.localeCompare(b.destination))
  const futureTrips = trips.filter(trip => !tripIsPast(trip, now))
  const pastTrips = trips.filter(trip => tripIsPast(trip, now))
  const next = futureTrips.find(trip => trip.departure <= today) ?? futureTrips[0]
  const underway = Boolean(next && next.departure <= today)
  const compactTrips = futureTrips.filter(trip => trip.id !== next?.id)
  const nextCover = journals.find(item => item.tripId === next?.id)?.chapters.map(chapter => coverOf(chapter)).find(Boolean)

  function startEdit(trip?: UpcomingTrip, opener?: HTMLButtonElement) {
    if (opener) openerRef.current = opener
    setEditing(trip?.id ?? null)
    setDestination(trip?.destination ?? '')
    setDeparture(trip?.departure ?? '')
    setEndDate(trip?.endDate ?? '')
    setMessage('')
    setAnnouncement('Formulaire de préparation ouvert.')
    setOpen(true)
  }
  useEffect(() => {
    const dialog = dialogRef.current
    if (open && dialog && !dialog.open) dialog.showModal()
    if (!open && dialog?.open) dialog.close()
    if (open) destinationRef.current?.focus()
  }, [open])
  function closeForm(notice: string) {
    setOpen(false); setEditing(null); setMessage(''); setAnnouncement(notice)
    window.requestAnimationFrame(() => openerRef.current?.focus())
  }
  function save(tripsToSave: UpcomingTrip[]): boolean {
    try {
      const latest = readUpcoming()
      if (latest.error || JSON.stringify(latest.trips) !== JSON.stringify(stored.trips)) {
        setStored(latest)
        setMessage('Les voyages ont changé dans un autre onglet. Vérifiez la liste puis recommencez.')
        return false
      }
      saveUpcomingMetadata(tripsToSave)
      setStored({ trips: tripsToSave, error: '' }); setMessage(''); window.dispatchEvent(new Event('upcoming-trips-updated'))
      return true
    } catch { setMessage('Impossible d’enregistrer les voyages sur cet appareil. Libérez de l’espace ou autorisez le stockage local.'); return false }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (stored.error) return
    const name = destination.trim()
    if (!name || name.length > 80 || !departure || daysUntil(departure, now) === null || (!editing && departure < today)) {
      setMessage('Indiquez une destination et une date de départ valide, aujourd’hui ou plus tard pour un nouveau voyage.'); return
    }
    if (endDate && (daysUntil(endDate, now) === null || endDate < departure)) {
      setMessage('La date de fin doit être valide et ne peut pas précéder le départ.'); return
    }
    if (!editing && trips.length >= 12) { setMessage('Douze voyages sont déjà enregistrés. Retirez-en un pour en ajouter un autre.'); return }
    const updated = editing
      ? stored.trips.map(trip => {
        if (trip.id !== editing) return trip
        const updatedTrip = { ...trip, destination: name, departure }
        if (endDate) updatedTrip.endDate = endDate
        else delete updatedTrip.endDate
        return updatedTrip
      })
      : [...stored.trips, { ...newUpcoming(name, departure), ...(endDate ? { endDate } : {}) }]
    const successMessage = editing ? `${name} a été modifié dans le décompte.` : `${name} a été ajouté au décompte.`
    if (save(updated)) closeForm(successMessage)
  }

  function setCompleted(tripId: string, completed: boolean) {
    save(stored.trips.map(trip => {
      if (trip.id !== tripId) return trip
      if (completed) return { ...trip, completed: true }
      const reopened = { ...trip }
      delete reopened.completed
      return reopened
    }))
  }

  const archivedJournalIds = new Set(trips.map(trip => trip.id))
  const orphanJournals = journals.filter(journal => !archivedJournalIds.has(journal.tripId))
  const allPastCount = pastTrips.length + orphanJournals.length

  return <section className="travel-library upcoming-trips page-width" data-testid="upcoming-trips" aria-labelledby="upcoming-title">
    <div className="library-heading upcoming-heading">
      <div><p className="eyebrow">La bibliothèque des voyages</p><h1 id="upcoming-title">Partir, <em>puis se souvenir.</em></h1><p className="library-deck">Vos prochains ailleurs et les histoires que vous en rapportez.</p></div>
      <button ref={openerRef} className="button button-outline" onClick={event => startEdit(undefined, event.currentTarget)} disabled={!!stored.error || trips.length >= 12}>Préparer un voyage <span aria-hidden="true">＋</span></button>
    </div>
    {announcement && <p className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>}
    {stored.error && <p role="alert" className="error-message">{stored.error}</p>}
    {message && <p role="alert" className="error-message">{message}</p>}
    <section className="library-upcoming" aria-labelledby="future-title">
      <div className="library-section-heading"><div><p className="eyebrow">À l’horizon</p><h2 id="future-title">À venir et en cours</h2></div><span>{futureTrips.length} voyage{futureTrips.length === 1 ? '' : 's'}</span></div>
      {next ? <article className="next-departure" data-testid="upcoming-trip" aria-label={`Prochain départ : ${next.destination}`}>
        <div className="next-landscape" aria-hidden="true">{nextCover ? <img src={nextCover.src} alt="" /> : <><span className="landscape-sun"/><span className="landscape-ridge ridge-back"/><span className="landscape-ridge ridge-front"/></>}</div>
        <div className="next-copy"><span className="eyebrow">{underway ? 'Vous y êtes' : 'Votre prochain ailleurs'}</span><h3>{next.destination}</h3><p className="upcoming-date">Départ le {dateLabel(next.departure)}{next.endDate ? ` · retour le ${dateLabel(next.endDate)}` : ''}</p><div className="next-actions">{underway ? <a className="button button-light" href={`#today/${encodeURIComponent(next.id)}`}>Voir ma journée →</a> : <button className="button button-light" onClick={() => openPlanner(next.id)} aria-label={`Planifier ${next.destination}`}>Continuer à préparer →</button>}
          <details className="trip-actions-menu"><summary>Autres actions</summary><button className="text-button" onClick={() => openJournal(next)}>Ouvrir le carnet</button><button className="text-button" onClick={() => openPlanner(next.id)}>Programme et carte</button><button className="text-button" onClick={event => startEdit(next, event.currentTarget)} disabled={!!stored.error} aria-label={`Modifier ${next.destination}`}>Modifier</button>{underway && <button className="text-button" onClick={() => setCompleted(next.id,true)}>Terminer le voyage</button>}<button className="text-button" onClick={() => save(stored.trips.filter(item => item.id !== next.id))} disabled={!!stored.error} aria-label={`Retirer ${next.destination}`}>Retirer de la liste</button></details></div></div>
        <div className="departure-badge">{underway ? 'Votre voyage en cours' : `J−${daysUntil(next.departure, now)}`} · {next.plan?.stops.length ?? 0} étapes</div>
      </article> : <div className="library-empty"><span className="eyebrow">L’horizon vous attend</span><p>Le prochain départ se prépare ici.</p><span>Ajoutez une destination pour commencer votre collection.</span></div>}
      {compactTrips.length > 0 && <div className="trip-card-grid" aria-label="Autres voyages à venir">{compactTrips.map(trip => {
        const remaining = daysUntil(trip.departure, now) ?? -1
        const cover = journals.find(j => j.tripId === trip.id)?.chapters.map(coverOf).find(Boolean)
        return <article key={trip.id} data-testid="upcoming-trip" className="trip-card trip-card-future">
          <div className="trip-card-art" aria-hidden="true">{cover ? <img src={cover.src} alt="" /> : <><span>{trip.destination.slice(0, 1).toLocaleUpperCase('fr-FR')}</span><i/></>}</div>
          <div className="trip-card-body"><span className="eyebrow">{remaining < 0 ? 'Voyage en cours · fin non renseignée' : remaining === 0 ? 'Départ aujourd’hui' : `J−${remaining}`}</span><h3>{trip.destination}</h3><div className="upcoming-trip-copy"><p>{dateLabel(trip.departure)}{trip.endDate ? ` — ${dateLabel(trip.endDate)}` : ''}</p></div>
            <div className="trip-card-actions upcoming-actions"><button className="text-button" onClick={() => openPlanner(trip.id)} aria-label={`Planifier ${trip.destination}`}>Planifier</button><details className="trip-actions-menu"><summary>Autres actions</summary><a className="text-button" href={`#today/${encodeURIComponent(trip.id)}`}>Aujourd’hui</a><button className="text-button" onClick={() => openJournal(trip)}>Carnet</button><button className="text-button" onClick={event => startEdit(trip, event.currentTarget)} disabled={!!stored.error} aria-label={`Modifier ${trip.destination}`}>Modifier</button>{remaining < 0 && <button className="text-button" onClick={() => setCompleted(trip.id, true)} disabled={!!stored.error} aria-label={`Terminer ${trip.destination}`}>Terminer</button>}<button className="text-button" onClick={() => save(stored.trips.filter(item => item.id !== trip.id))} disabled={!!stored.error} aria-label={`Retirer ${trip.destination}`}>Retirer</button></details></div>
          </div>
        </article>
      })}</div>}
    </section>
    <section className="library-memories" aria-labelledby="memories-title">
      <div className="library-section-heading"><div><p className="eyebrow">Les pages déjà vécues</p><h2 id="memories-title">Souvenirs de voyage</h2></div><span>{allPastCount} carnet{allPastCount === 1 ? '' : 's'}</span></div>
      {allPastCount === 0 ? <p className="memories-empty">Vos carnets terminés trouveront leur place ici. Un voyage sans date de fin reste dans vos départs.</p> : <div className="memory-grid">
        {pastTrips.map(trip => {
          const journal = journals.find(item => item.tripId === trip.id)
          const cover = journal?.chapters.map(chapter => coverOf(chapter)).find(Boolean)
          return <article className="memory-card" data-testid="past-trip" key={trip.id}>
            <div className={`memory-cover ${cover ? '' : 'memory-cover-type'}`}>{cover ? <img src={cover.src} alt={`Couverture du carnet ${trip.destination} : ${cover.name}`} /> : <div><span>Carnet de voyage</span><strong>{trip.destination}</strong><small>{trip.endDate ? dateLabel(trip.endDate) : ''}</small></div>}</div>
            <div className="memory-info"><span className="eyebrow">Souvenir · {journal?.chapters.length ?? 0} chapitre{journal?.chapters.length === 1 ? '' : 's'}</span><h3>{trip.destination}</h3><p>{dateLabel(trip.departure)}{trip.endDate ? ` — ${dateLabel(trip.endDate)}` : ''}</p><button className="text-button" onClick={() => openPlanner(trip.id)} aria-label={`Préparation ${trip.destination}`}>Préparation →</button><button className="text-button" onClick={() => openJournal(trip)}>Ouvrir le carnet →</button><button className="text-button" onClick={event => startEdit(trip, event.currentTarget)} disabled={!!stored.error} aria-label={`Modifier ${trip.destination}`}>Modifier</button>{trip.completed && (!trip.endDate || trip.endDate >= today) && <button className="text-button" onClick={() => setCompleted(trip.id, false)} disabled={!!stored.error} aria-label={`Reprendre ${trip.destination}`}>Reprendre</button>}</div>
          </article>
        })}
        {orphanJournals.map(journal => {
          const trip: UpcomingTrip = { id: journal.tripId, destination: journal.destination, departure: journal.departure || '2000-01-01' }
          const cover = journal.chapters.map(chapter => coverOf(chapter)).find(Boolean)
          return <article className="memory-card" data-testid="past-trip" key={journal.tripId}>
            <div className={`memory-cover ${cover ? '' : 'memory-cover-type'}`}>{cover ? <img src={cover.src} alt={`Couverture du carnet ${journal.destination} : ${cover.name}`} /> : <div><span>Carnet de voyage</span><strong>{journal.destination}</strong></div>}</div>
            <div className="memory-info"><span className="eyebrow">Carnet conservé · {journal.chapters.length} chapitre{journal.chapters.length === 1 ? '' : 's'}</span><h3>{journal.destination}</h3><button className="text-button" onClick={() => openJournal(trip)}>Ouvrir le carnet →</button></div>
          </article>
        })}
      </div>}
    </section>
    <p className="local-note library-note">Voyages, dates et carnets restent sur cet appareil. La date de fin est facultative : après le départ, vous pouvez aussi terminer un voyage manuellement.</p>
    {open && <dialog ref={dialogRef} className="trip-dialog" aria-labelledby="upcoming-form-title" onCancel={event => { event.preventDefault(); closeForm('Préparation du voyage annulée.') }}>
      <form className="upcoming-form" aria-labelledby="upcoming-form-title" onSubmit={submit}>
      <div><p className="eyebrow">Votre prochaine escale</p><h3 id="upcoming-form-title">{editing ? 'Changer le cap' : 'Faire place à l’attente'}</h3></div>
      <label>Destination<input ref={destinationRef} name="destination" value={destination} onChange={event => setDestination(event.target.value)} maxLength={80} required /></label>
      <label>Date de départ<input name="departure" type="date" value={departure} min={editing && departure < today ? departure : today} onChange={event => setDeparture(event.target.value)} required /></label>
      <label>Date de fin (facultative)<input name="endDate" type="date" value={endDate} min={departure || today} onChange={event => setEndDate(event.target.value)} aria-describedby="end-date-help" /></label><p id="end-date-help" className="date-help">Sans date de fin, vous pourrez classer ce voyage parmi les souvenirs avec « Terminer » après le départ.</p>
      <div className="upcoming-form-actions"><button className="button" type="submit">{editing ? 'Enregistrer les modifications' : 'Ajouter au décompte'}</button><button className="text-button" type="button" onClick={() => closeForm('Modifications annulées.')}>Annuler</button></div>
    </form></dialog>}
  </section>
}
