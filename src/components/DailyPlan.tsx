import type { PlanStop, UpcomingTrip } from '../upcoming-trips'
import './daily-plan.css'

const kinds = { visit: 'Visite', stay: 'Hébergement', meal: 'Repas', transit: 'Transport' }
export default function DailyPlan({ trip, update }: { trip: UpcomingTrip; update: (stop: PlanStop) => boolean }) {
  const stops = trip.plan?.stops ?? []
  const dates = [...new Set(stops.map(stop => stop.date ?? ''))].sort((a,b) => a ? b ? a.localeCompare(b) : -1 : 1)
  return <section className="daily-plan" aria-labelledby="daily-title">
    <p className="eyebrow">Au fil des journées</p><h2 id="daily-title">Votre programme, jour après jour.</h2>
    <p>Répartissez les escales, visites et hébergements. Changer une date conserve l’ordre du parcours sur la carte.</p>
    {!stops.length && <p>Ajoutez votre première escale sur la carte ou dans la liste : elle apparaîtra ici.</p>}
    <div className="daily-columns">{dates.map(date => {
      const day = stops.filter(stop => (stop.date ?? '') === date)
      const outside = date && (date < trip.departure || (trip.endDate && date > trip.endDate))
      return <section className="daily-day" key={date || 'undated'} aria-label={date || 'À programmer'}>
        <h3>{date ? new Intl.DateTimeFormat('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(`${date}T12:00:00`)) : 'À programmer'}</h3>
        <p>{day.length} rendez-vous{outside ? ' · Hors des dates du voyage' : ''}</p>
        {day.length >= 5 && <p className="daily-hint">Journée bien remplie : pensez à garder du temps pour les trajets et les pauses.</p>}
        {day.map(stop => <article className="daily-stop" key={stop.id}>
          <h4>{stop.place}</h4>
          <label>Jour de {stop.place}<input type="date" value={stop.date ?? ''} onChange={event => { const next={...stop}; if(event.target.value) next.date=event.target.value; else delete next.date; update(next) }} /></label>
          <label>Type de {stop.place}<select value={stop.kind ?? 'visit'} onChange={event => update({...stop,kind:event.target.value as PlanStop['kind']})}>{Object.entries(kinds).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Heure prévue à {stop.place}<input type="time" value={stop.time ?? ''} onChange={event => {const next={...stop}; if(event.target.value) next.time=event.target.value; else delete next.time; update(next)}} /></label>
          <details><summary>Informations pratiques</summary>
            <label>Adresse de {stop.place}<input maxLength={300} value={stop.address ?? ''} onChange={event => update({...stop,address:event.target.value})} /></label>
            <label>Réservation à {stop.place}<input maxLength={300} value={stop.booking ?? ''} placeholder="Référence, confirmation, contact…" onChange={event => update({...stop,booking:event.target.value})} /></label>
            <label>Notes pour {stop.place}<textarea maxLength={2000} rows={3} value={stop.notes ?? ''} onChange={event => update({...stop,notes:event.target.value})} /></label>
          </details>
          {(stop.address?.trim() || stop.point) && <a className="text-button" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stop.address?.trim() || `${stop.point!.lat},${stop.point!.lon}`)}`}>Ouvrir l’itinéraire ↗</a>}
        </article>)}
      </section>
    })}</div>
    <p className="local-note">Les heures et réservations sont vos notes personnelles. L’itinéraire ouvre Google Maps et lui transmet la destination choisie.</p>
  </section>
}
