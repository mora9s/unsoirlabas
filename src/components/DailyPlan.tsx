import { useState } from 'react'
import type { Draft } from '../journal'
import { coverOf } from '../journal'
import type { PlanStop, UpcomingTrip } from '../upcoming-trips'
import './daily-plan.css'

const kinds = { visit: 'Visite', stay: 'Hébergement', meal: 'Repas', transit: 'Transport' }
export default function DailyPlan({ trip, chapters = [], update }: { trip: UpcomingTrip; chapters?: Draft[]; update: (stop: PlanStop) => boolean }) {
  const [selectedDay,setSelectedDay] = useState<string | null>(null)
  const stops = trip.plan?.stops ?? []
  const dates = [...new Set(stops.map(stop => stop.date ?? ''))].sort((a,b) => a ? b ? a.localeCompare(b) : -1 : 1)
  const shown = selectedDay !== null && dates.includes(selectedDay) ? selectedDay : dates[0]
  return <section className="daily-plan" aria-labelledby="daily-title">
    <p className="eyebrow">Au fil des journées</p><h2 id="daily-title">Votre programme, jour après jour.</h2>
    <p>Répartissez les escales, visites et hébergements. Changer une date conserve l’ordre du parcours sur la carte.</p>
    {!stops.length && <p>Ajoutez votre première escale sur la carte ou dans la liste : elle apparaîtra ici.</p>}
    <nav className="day-selector" aria-label="Journées du programme">{dates.map(date => <button key={date} className="text-button" aria-pressed={shown === date} onClick={() => setSelectedDay(date)}>{date ? `Jour ${Math.round((Date.parse(date)-Date.parse(trip.departure))/86400000)+1} · ${date.slice(8)}/${date.slice(5,7)}` : 'À programmer'}</button>)}</nav>
    <div className="daily-columns">{dates.filter(date => date === shown).map(date => {
      const day = stops.filter(stop => (stop.date ?? '') === date)
      const outside = date && (date < trip.departure || (trip.endDate && date > trip.endDate))
      return <section className="daily-day" key={date || 'undated'} aria-label={date || 'À programmer'}>
        <h3>{date ? new Intl.DateTimeFormat('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(`${date}T12:00:00`)) : 'À programmer'}</h3>
        <p>{day.length} rendez-vous{outside ? ' · Hors des dates du voyage' : ''}</p>
        {day.length >= 5 && <p className="daily-hint">Journée bien remplie : pensez à garder du temps pour les trajets et les pauses.</p>}
        {day.map(stop => <article className="daily-stop" key={stop.id}>
          {(() => {const chapter = chapters.find(c => c.id === stop.chapterId);const photo = chapter && coverOf(chapter);return photo ? <figure className="day-photo"><img src={photo.src} alt={stop.place} loading="lazy" />{photo.name.includes(' | Crédit :') && <figcaption>{photo.name.split(' | Crédit :')[1]}</figcaption>}</figure> : null})()}
          <p className="eyebrow">{stop.time || 'Horaire libre'} · {kinds[stop.kind ?? 'visit']}</p><h4>{stop.place}</h4>
          {stop.address && <p>{stop.address}</p>}{stop.booking && <p>Réservation : {stop.booking}</p>}
          {stop.notes && <details><summary>Lire les notes</summary><p style={{whiteSpace:'pre-wrap'}}>{stop.notes}</p></details>}
          <details className="day-edit"><summary>Modifier cette étape</summary>
          <label>Jour de {stop.place}<input type="date" value={stop.date ?? ''} onChange={event => { const next={...stop}; if(event.target.value) next.date=event.target.value; else delete next.date; update(next) }} /></label>
          <label>Type de {stop.place}<select value={stop.kind ?? 'visit'} onChange={event => update({...stop,kind:event.target.value as PlanStop['kind']})}>{Object.entries(kinds).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Heure prévue à {stop.place}<input type="time" value={stop.time ?? ''} onChange={event => {const next={...stop}; if(event.target.value) next.time=event.target.value; else delete next.time; update(next)}} /></label>
          <details><summary>Informations pratiques</summary>
            <label>Adresse de {stop.place}<input maxLength={300} value={stop.address ?? ''} onChange={event => update({...stop,address:event.target.value})} /></label>
            <label>Réservation à {stop.place}<input maxLength={300} value={stop.booking ?? ''} placeholder="Référence, confirmation, contact…" onChange={event => update({...stop,booking:event.target.value})} /></label>
            <label>Notes pour {stop.place}<textarea maxLength={2000} rows={3} value={stop.notes ?? ''} onChange={event => update({...stop,notes:event.target.value})} /></label>
          </details>
          </details>
          {(stop.address?.trim() || stop.point) && <a className="text-button" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stop.address?.trim() || `${stop.point!.lat},${stop.point!.lon}`)}`}>Ouvrir l’itinéraire ↗</a>}
        </article>)}
      </section>
    })}</div>
    <p className="local-note">Les heures et réservations sont vos notes personnelles. L’itinéraire ouvre Google Maps et lui transmet la destination choisie.</p>
  </section>
}
