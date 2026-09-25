import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { PlanStop } from '../upcoming-trips'
import type { Draft } from '../journal'
import { exportJourneyFilm, filmDuration, filmMime } from '../journey-film'
import type { FilmBridge } from '../journey-film'

export default function FilmExport({ title, stops, chapters, frame, ready, onBusy }: { title: string; stops: PlanStop[]; chapters: Draft[]; frame: RefObject<HTMLIFrameElement | null>; ready: boolean; onBusy: (busy: boolean) => void }) {
  const [open, setOpen] = useState(false)
  const [filmTitle, setFilmTitle] = useState(title)
  const [format, setFormat] = useState<'landscape' | 'portrait'>('landscape')
  const [seconds, setSeconds] = useState(6)
  const [illustrated, setIllustrated] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<{ url: string; name: string; file: File } | null>(null)
  const request = useRef<AbortController | null>(null)
  const objectUrl = useRef<string | null>(null)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false; request.current?.abort(); if (objectUrl.current) URL.revokeObjectURL(objectUrl.current) } }, [])
  const total = filmDuration(stops.length,seconds)
  const available = filmMime() !== null
  async function start() {
    if (busy) return
    const bridge = (frame.current?.contentWindow as (Window & { journalFilm?: FilmBridge }) | null)?.journalFilm
    if (!bridge) { setMessage('Le globe n’est pas encore prêt. Patientez puis réessayez.'); return }
    if (document.hidden) { setMessage('Gardez cet onglet visible pour créer le film.'); return }
    const controller = new AbortController(); request.current = controller
    setBusy(true); onBusy(true); setProgress(0); setMessage('Préparation du film…')
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
    objectUrl.current = null; setResult(null)
    try {
      const film = await exportJourneyFilm(bridge,stops,chapters,{title:filmTitle.trim() || title,format,seconds,illustrated},controller.signal,(value, text) => { if (alive.current) { setProgress(value); setMessage(text) } })
      if (!alive.current || controller.signal.aborted) return
      const url = URL.createObjectURL(film.blob); objectUrl.current = url
      const name = `${(filmTitle.trim() || title).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'-').slice(0,70) || 'mon-voyage'}.${film.extension}`
      setResult({ url, name, file: new File([film.blob],name,{type:film.blob.type.split(';')[0]}) }); setMessage('Votre film est prêt. Regardez-le puis enregistrez-le sur votre appareil.')
    } catch (error) { if (alive.current) setMessage(controller.signal.aborted ? 'Création annulée. Votre carnet reste intact.' : error instanceof Error ? error.message : 'Le film n’a pas pu être créé.') }
    finally { if (alive.current) { setBusy(false); onBusy(false) }; request.current = null }
  }
  async function share() {
    if (!result) return
    try { await navigator.share({ title: filmTitle, files: [result.file] }) }
    catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) setMessage('Le partage n’est pas disponible ici. Téléchargez le film pour l’envoyer.') }
  }
  return <section className="film-export" aria-label="Créer le film du voyage">
    <div className="film-export-heading"><div><p className="eyebrow">À garder, à partager</p><h2>Le film de votre voyage.</h2><p>Les trajets, les escales et vos photos dans une seule vidéo.</p></div><button className="button button-outline" aria-expanded={open} onClick={() => setOpen(v => !v)} disabled={busy}>{open ? 'Fermer les réglages' : 'Créer mon film'}</button></div>
    {open && <>
      {!available && <p role="status">Votre navigateur ne propose pas l’export vidéo. Essayez Chrome ou Edge sur ordinateur ; le carnet reste disponible ici.</p>}
      <fieldset disabled={busy} className="film-options"><legend className="visually-hidden">Réglages du film</legend>
        <label>Titre du film<input value={filmTitle} onChange={event => setFilmTitle(event.target.value)} maxLength={90} /></label>
        <label>Format du film<select value={format} onChange={event => setFormat(event.target.value as 'landscape' | 'portrait')}><option value="landscape">Horizontal · 1280 × 720</option><option value="portrait">Vertical · 720 × 1280</option></select></label>
        <label>Rythme du film<select value={seconds} onChange={event => setSeconds(Number(event.target.value))}><option value={6}>Dynamique · 6 s par trajet</option><option value={12}>Contemplatif · 12 s par trajet</option><option value={18}>Prenez le temps · 18 s par trajet</option></select></label>
        <label className="film-checkbox"><input type="checkbox" checked={illustrated} onChange={event => setIllustrated(event.target.checked)} /><span>Illustrer toutes les liaisons sans calcul routier</span></label>
      </fieldset>
      <p className="film-note">Environ {Math.floor(total / 60)} min {String(total % 60).padStart(2,'0')} s · jusqu’à trois photos par escale · sans musique. La création prend la durée du film : gardez cet onglet visible. Aucun fichier n’est envoyé à un serveur.</p>
      {total > 300 && <p role="alert">Le film dépasse 5 minutes. Choisissez un rythme plus court.</p>}
      {busy ? <div className="film-progress"><progress max={100} value={progress} aria-label="Création du film" /><span>{progress} %</span><button className="text-button" onClick={() => request.current?.abort()}>Annuler la création</button></div> : <button className="button" disabled={!available || !ready || total > 300} onClick={start}>{result ? 'Créer une nouvelle version' : 'Créer la vidéo'}</button>}
      {message && <p role="status" className="film-message">{message}</p>}
      {result && <div className="film-result"><video src={result.url} controls playsInline preload="metadata" aria-label="Aperçu du film exporté" /><div><a className="button" href={result.url} download={result.name}>Télécharger le film</a>{navigator.canShare?.({files:[result.file]}) && <button className="button button-outline" onClick={share}>Partager le film</button>}<small>{result.file.type.includes('mp4') ? 'MP4' : 'WebM'} · {(result.file.size / 1024 / 1024).toFixed(1)} Mo</small></div></div>}
    </>}
  </section>
}
