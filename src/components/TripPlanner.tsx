import { useState } from 'react'
import type { FormEvent } from 'react'
import { createId } from '../id'
import { daysUntil, readUpcoming, upcomingKey, validateUpcomingTrips } from '../upcoming-trips'
import type { PlanStop, SourcedOption, UpcomingTrip } from '../upcoming-trips'

const emptyPlan = () => ({ ideas: [], stops: [], notes: '', options: [] }) as NonNullable<UpcomingTrip['plan']>

export default function TripPlanner({ id, back, openJournal, openPlannedStep }: { id: string; back: () => void; openJournal: () => void; openPlannedStep: (stop: PlanStop) => void }) {
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

  function save(update: (current: NonNullable<UpcomingTrip['plan']>) => NonNullable<UpcomingTrip['plan']>): boolean {
    if (!trip || stored.error) return false
    // Re-read before every write: never overwrite a corrupted or concurrently changed store.
    const latest = readUpcoming()
    if (latest.error || !latest.trips.some(item => item.id === id)) {
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
  function addOption(event: FormEvent) {
    event.preventDefault()
    const title = optionTitle.trim(), stopPlace = optionPlace.trim()
    let parsed: URL
    try { parsed = new URL(sourceUrl.trim()) } catch { setMessage('Ajoutez une URL de source valide en http ou https.'); return }
    if (!['http:', 'https:'].includes(parsed.protocol)) { setMessage('Seules les sources http et https sont autorisées.'); return }
    if (!verifiedAt || !/^\d{4}-\d{2}-\d{2}$/.test(verifiedAt) || new Date(`${verifiedAt}T12:00:00Z`).toISOString().slice(0, 10) !== verifiedAt) { setMessage('Indiquez une vraie date de vérification.'); return }
    if (optionDate && (optionDate < trip!.departure || (trip!.endDate && optionDate > trip!.endDate))) { setMessage('La date de la proposition doit être comprise entre le départ et la fin du voyage.'); return }
    const minutes = transferMinutes ? Number(transferMinutes) : undefined
    if (minutes !== undefined && (!Number.isSafeInteger(minutes) || minutes < 0 || minutes > 1440)) { setMessage('Le transfert estimé doit être compris entre 0 et 1 440 minutes.'); return }
    const option: SourcedOption = { id: createId(), title, place: stopPlace, sourceUrl: parsed.href, verifiedAt, status, conflict, ...(optionDate ? { date: optionDate } : {}), ...(minutes !== undefined ? { transferMinutes: minutes } : {}) }
    if (save(current => ({ ...current, options: [...(current.options ?? []), option] }))) {
      setOptionTitle(''); setOptionPlace(''); setSourceUrl(''); setVerifiedAt(''); setStatus('to-check'); setConflict(false); setOptionDate(''); setTransferMinutes('')
    }
  }
  function importOption(option: SourcedOption) {
    save(current => ({ ...current, stops: [...current.stops, { id: createId(), place: option.place, ...(option.date ? { date: option.date } : {}), sourceUrl: option.sourceUrl, verifiedAt: option.verifiedAt, status: option.status, conflict: option.conflict, ...(option.transferMinutes !== undefined ? { transferMinutes: option.transferMinutes } : {}) }], options: (current.options ?? []).filter(item => item.id !== option.id) }))
  }
  function moveOption(index: number, direction: number) {
    save(current => { const options = [...(current.options ?? [])]; [options[index], options[index + direction]] = [options[index + direction], options[index]]; return { ...current, options } })
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
      <header className="planner-hero"><p className="eyebrow">Votre prochaine histoire</p><h1 id="planner-title">{trip.destination}</h1><p>Départ le {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date(`${trip.departure}T12:00:00`))} · {Math.max(0, daysUntil(trip.departure, new Date()) ?? 0)} jours avant le départ</p><button className="button button-light" onClick={openJournal}>Ouvrir le carnet de {trip.destination} →</button><span>La préparation reste privée, sur cet appareil, jusqu’à sa sauvegarde dans une archive.</span></header>
      <div className="planner-grid">
        <section className="planner-panel" aria-labelledby="ideas-title"><p className="eyebrow">01 · L’inspiration</p><h2 id="ideas-title">Ce qui vous attire.</h2><p>Gardez des envies sans décider encore du programme.</p>
          <ul>{plan.ideas.map(item => <li key={item.id}><span>{item.text}</span><button className="text-button" aria-label={`Retirer l’envie ${item.text}`} onClick={() => save(current => ({ ...current, ideas: current.ideas.filter(idea => idea.id !== item.id) }))}>Retirer</button></li>)}</ul>
          <form onSubmit={addIdea}><label>Nouvelle envie<input value={idea} onChange={event => setIdea(event.target.value)} maxLength={160} required placeholder="Un lieu, une expérience…" /></label><button className="button" disabled={plan.ideas.length >= 30}>Ajouter une envie</button></form>
        </section>
        <section className="planner-panel" aria-labelledby="stops-title"><p className="eyebrow">02 · Le parcours</p><h2 id="stops-title">Les étapes prennent forme.</h2><p>Une date est facultative ; l’ordre reste modifiable.</p>
          <ol>{plan.stops.map((stop, index) => <li key={stop.id}><span><strong>{stop.place}</strong>{stop.date && <small>{stop.date}</small>}{stop.sourceUrl && <small> · {stop.status === 'confirmed' ? 'confirmé (déclaré)' : stop.status === 'estimated' ? 'estimé' : 'à vérifier'} · source vérifiée le {stop.verifiedAt} · transfert {stop.transferMinutes !== undefined ? `${stop.transferMinutes} min estimé` : 'non renseigné'}{stop.conflict ? ' · sources contradictoires, à vérifier' : ''} · <a href={stop.sourceUrl} target="_blank" rel="noreferrer">source</a></small>}</span><span className="planner-controls"><button className="text-button" aria-label={`Monter ${stop.place}`} disabled={index === 0} onClick={() => move(index, -1)}>↑</button><button className="text-button" aria-label={`Descendre ${stop.place}`} disabled={index === plan.stops.length - 1} onClick={() => move(index, 1)}>↓</button><button className="text-button" aria-label={`Retirer l’étape ${stop.place}`} onClick={() => save(current => ({ ...current, stops: current.stops.filter(item => item.id !== stop.id) }))}>Retirer</button><button className="text-button" onClick={() => openPlannedStep(stop)} aria-label={`Raconter ${stop.place}`}>Raconter →</button></span></li>)}</ol>
          <form onSubmit={addStop}><label>Nouvelle étape<input value={place} onChange={event => setPlace(event.target.value)} maxLength={160} required placeholder="Une ville, une escale…" /></label><label>Date de l’étape<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label><button className="button" disabled={plan.stops.length >= 30}>Ajouter une étape</button></form>
        </section>
      </div>
      <section className="planner-panel planner-sourced-options" aria-labelledby="sourced-options-title"><p className="eyebrow">04 · Vos repères sourcés</p><h2 id="sourced-options-title">Des pistes, à vérifier.</h2><p>Ajoutez vous-même une source et sa date de vérification. Nous ne consultons pas le web : horaires, prix et disponibilités restent à vérifier auprès de la source. Les plages libres ne sont jamais remplies automatiquement.</p>
        <form onSubmit={addOption}>
          <label>Nom de la proposition<input value={optionTitle} onChange={event => setOptionTitle(event.target.value)} maxLength={160} required /></label>
          <label>Lieu de la proposition<input value={optionPlace} onChange={event => setOptionPlace(event.target.value)} maxLength={160} required /></label>
          <label>URL de la source<input type="text" inputMode="url" value={sourceUrl} onChange={event => setSourceUrl(event.target.value)} maxLength={2000} required placeholder="https://…" /></label>
          <label>Vérifiée le<input type="date" value={verifiedAt} onChange={event => setVerifiedAt(event.target.value)} required /></label>
          <label>État factuel<select value={status} onChange={event => setStatus(event.target.value as SourcedOption['status'])}><option value="confirmed">Confirmé par moi dans cette source</option><option value="estimated">Estimé</option><option value="to-check">À vérifier</option></select></label>
          <label>Date prévue (facultative)<input type="date" value={optionDate} onChange={event => setOptionDate(event.target.value)} /></label>
          <label>Temps de transfert estimé (minutes)<input type="number" min="0" max="1440" step="1" value={transferMinutes} onChange={event => setTransferMinutes(event.target.value)} placeholder="Facultatif" /></label>
          <label className="planner-conflict"><input type="checkbox" checked={conflict} onChange={event => setConflict(event.target.checked)} /> Sources contradictoires ou état incertain</label>
          <button className="button" disabled={(plan.options ?? []).length >= 30}>Ajouter à mes propositions</button>
        </form>
        {(plan.options ?? []).length === 0 ? <p>Aucune proposition enregistrée. Les journées et plages libres restent vides.</p> : <ol>{(plan.options ?? []).map((option, index) => <li key={option.id}><article>
          <h3>{option.title}</h3><p>{option.place}{option.date ? ` · ${option.date}` : ''}</p><p>État : {option.status === 'confirmed' ? 'Confirmé (déclaré par vous)' : option.status === 'estimated' ? 'Estimé' : 'À vérifier'}{option.transferMinutes !== undefined ? ` · Transfert : ${option.transferMinutes} min, estimé` : ''}</p>
          <p><a href={option.sourceUrl} target="_blank" rel="noreferrer">Consulter la source (ouvre un nouvel onglet)</a> · vérification déclarée le {option.verifiedAt}</p>
          {(option.status !== 'confirmed' || option.conflict) && <p role="alert" className="error-message">{option.conflict ? 'Sources indisponibles ou contradictoires : impossible de comparer ; vérifiez manuellement.' : 'Cette information est estimée ou à vérifier ; la date de vérification est déclarative, non confirmée par une consultation automatique.'}</p>}
          <button className="button" onClick={() => importOption(option)} aria-label={`Ajouter au parcours : ${option.title}`} disabled={plan.stops.length >= 30}>Ajouter au parcours</button>
          <button className="text-button" aria-label={`Monter la proposition ${option.title}`} disabled={index === 0} onClick={() => moveOption(index, -1)}>↑</button><button className="text-button" aria-label={`Descendre la proposition ${option.title}`} disabled={index === (plan.options ?? []).length - 1} onClick={() => moveOption(index, 1)}>↓</button>
          <button className="text-button" aria-label={`Retirer la proposition ${option.title}`} onClick={() => save(current => ({ ...current, options: (current.options ?? []).filter(item => item.id !== option.id) }))}>Retirer</button>
        </article></li>)}</ol>}
      </section>
      <section className="planner-panel planner-notes"><p className="eyebrow">03 · À garder en tête</p><h2>Quelques repères.</h2><label>Notes de préparation<textarea value={plan.notes} onChange={event => save(current => ({ ...current, notes: event.target.value }))} maxLength={4000} rows={5} placeholder="Réservations, idées pratiques, petits détails…" /></label></section>
      <p className="local-note">Envies, étapes et notes sont enregistrées dans ce navigateur et incluses dans les nouvelles archives ZIP du carnet. Aucun voyage n’est réservé ni publié ici.</p>
    </>}
  </section>
}
