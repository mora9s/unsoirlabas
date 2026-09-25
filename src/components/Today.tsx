import { useEffect, useState } from 'react'
import { calendarDate, readUpcoming, transportModes } from '../upcoming-trips'
import { importImage } from '../journal'
import type { Media } from '../journal'
import { saveQuickMemory } from '../quick-memory'
import { readUnsavedChapter, writeUnsavedChapter, discardUnsavedChapter } from '../unsaved-chapters'
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex } from '@noble/hashes/utils.js'
import './daily-plan.css'
import OfflineAccess from './OfflineAccess'

function QuickMemory({tripId,date,stopId,open}: {tripId:string;date:string;stopId:string;open:(id:string)=>void}) {
  const scope = `quick:${bytesToHex(sha256(new TextEncoder().encode(JSON.stringify([tripId,date,stopId]))))}`
  const [recovery] = useState(() => readUnsavedChapter(scope))
  const [text,setText] = useState(recovery.draft?.story ?? '')
  const [media,setMedia] = useState<Media[]>(recovery.draft?.media ?? [])
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const [saved,setSaved] = useState('')
  function change(nextText:string,photos:Media[]) {
    setText(nextText);setMedia(photos);setSaved('')
    const problem=nextText || photos.length
      ? writeUnsavedChapter(scope,{id:'quick',title:date,story:nextText,memories:'',tone:'',media:photos,coverId:photos[0]?.id ?? '',status:'draft'})
      : discardUnsavedChapter(scope)
    setError(problem)
  }
  return <form className="daily-stop quick-memory" onSubmit={event => {
    event.preventDefault(); setError('')
    try { const id=saveQuickMemory(tripId,date,stopId,text,media); discardUnsavedChapter(scope); setText('');setMedia([]);setSaved(id) }
    catch(error) {setError(error instanceof DOMException ? 'Stockage indisponible ou plein. Votre saisie reste ouverte ; libérez de l’espace puis réessayez.' : error instanceof Error ? error.message : 'Enregistrement impossible. Votre saisie est conservée.')}
  }}>
    <h2>Un souvenir, pendant qu’il est frais.</h2>
    <p>Quelques mots ou une photo suffisent. Le souvenir rejoint le chapitre de l’escale, ou une nouvelle page datée.</p>
    {recovery.error && <p role="alert">{recovery.error}</p>}
    <label>Quelques mots<textarea rows={4} maxLength={4000} value={text} disabled={busy} onChange={e=>change(e.target.value,media)} placeholder="Ce qui vous a marqué aujourd’hui…" /></label>
    <label>Ajouter une photo<input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" disabled={busy || media.length>=3} onChange={async event=>{
      const file=event.target.files?.[0];event.target.value='';if(!file)return
      setBusy(true);setError('');setSaved('')
      try {
        const image=await importImage(file)
        change(text,[...media,image])
      } catch(error){setError(error instanceof Error ? error.message : 'Photo illisible.')}
      finally {setBusy(false)}
    }} /></label>
    <p className="local-note">3 photos par ajout · 12 Mo par photo · préparation sur cet appareil.</p>
    <div className="quick-photos">{media.map(image=><div key={image.id}><img src={image.src} alt={image.name}/><button type="button" className="text-button" disabled={busy} onClick={()=>change(text,media.filter(m=>m.id!==image.id))}>Retirer {image.name}</button></div>)}</div>
    {busy && <p role="status">Préparation de la photo…</p>}
    {error && <p role="alert">{error}</p>}
    <button className="button" disabled={busy || (!text.trim() && !media.length)}>Garder ce souvenir</button>
    {saved && <p role="status">Souvenir enregistré. <button type="button" className="text-button" onClick={()=>open(saved)}>Lire le chapitre</button></p>}
  </form>
}

export default function Today({id,plan,open}: {id:string;plan:()=>void;open:(id:string)=>void}) {
  const [stored,setStored] = useState(readUpcoming)
  const [now,setNow] = useState(()=>new Date())
  const [chosenDate,setChosenDate] = useState('')
  const [stopId,setStopId] = useState('')
  const date=chosenDate || calendarDate(now)
  const trip=stored.trips.find(t=>t.id===id)
  const stops=(trip?.plan?.stops ?? []).filter(s=>s.date===date).sort((a,b)=>(a.time || '99:99').localeCompare(b.time || '99:99'))
  const selected=stops.find(s=>s.id===stopId)?.id ?? stops[0]?.id ?? ''
  const clock=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
  const next=stops.find(s=>s.time && (date!==calendarDate(now) || s.time>=clock))
  useEffect(()=>{
    const refresh=()=>setStored(readUpcoming())
    window.addEventListener('storage',refresh);window.addEventListener('upcoming-trips-updated',refresh)
    const timer=setInterval(()=>setNow(new Date()),30000)
    return ()=>{clearInterval(timer);window.removeEventListener('storage',refresh);window.removeEventListener('upcoming-trips-updated',refresh)}
  },[])
  return <section className="today-page page-width daily-plan">
    <button className="text-button" onClick={plan}>← Préparer le voyage</button>
    <p className="eyebrow">Votre compagnon de route</p><h1>{date===calendarDate(now) ? 'Aujourd’hui' : 'Votre journée'}{trip ? ` · ${trip.destination}` : ''}</h1>
    {stored.error && <p role="alert">{stored.error}</p>}
    {!trip ? <p>Ce voyage est introuvable sur cet appareil.</p> : <>
      <OfflineAccess /><a className="button today-capture" href="#quick-memory" onClick={e=>{e.preventDefault();document.getElementById('quick-memory')?.scrollIntoView({behavior:'instant'});document.querySelector<HTMLTextAreaElement>('.quick-memory textarea')?.focus({preventScroll:true})}}>＋ Ajouter un souvenir</a>
      <label className="today-date">Journée affichée<input type="date" value={date} onChange={event=>{setChosenDate(event.target.value);setStopId('')}} /></label>
      {chosenDate && <button className="text-button" onClick={()=>{setChosenDate('');setStopId('')}}>Revenir à aujourd’hui</button>}
      <p className="local-note">Dates et heures selon l’horloge de votre appareil. Les horaires sont ceux que vous avez saisis.</p>
      {next && <p className="today-next">{date===calendarDate(now) ? 'À venir' : 'Premier rendez-vous'} : <strong>{next.time} · {next.place}</strong></p>}
      {!stops.length && <p>Aucune étape prévue ce jour. Vous pouvez garder un souvenir ou compléter le programme.</p>}
      <div className="daily-columns">{stops.map(stop=><article className="daily-stop" key={stop.id}>
        <p className="eyebrow">{stop.time || 'Horaire libre'}{stop.kind==='stay' ? ' · Hébergement' : ''}</p><h2>{stop.place}</h2>
        {stop.transport && <p>Arrivée : {transportModes[stop.transport]}</p>}
        {stop.address && <p>{stop.address}</p>}{stop.booking && <p>Réservation : {stop.booking}</p>}{stop.notes && <p style={{whiteSpace:'pre-wrap'}}>{stop.notes}</p>}
        {(stop.point || stop.address?.trim()) && <a className="text-button" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stop.address?.trim() || `${stop.point!.lat},${stop.point!.lon}`)}`}>Ouvrir l’itinéraire ↗</a>}
      </article>)}</div>
      <div id="quick-memory" /><label className="today-date">Associer le souvenir à<select value={selected} onChange={e=>setStopId(e.target.value)}>{stops.length ? stops.map(s=><option key={s.id} value={s.id}>{s.place}</option>) : <option value="">La journée du {date}</option>}</select></label>
      <QuickMemory key={`${date}:${selected}`} tripId={id} date={date} stopId={selected} open={open}/>
      <p className="local-note">Vos souvenirs restent sur cet appareil. Pensez à télécharger une sauvegarde depuis les outils du carnet. Les liens d’itinéraire nécessitent une connexion et transmettent la destination à Google Maps.</p>
    </>}
  </section>
}
