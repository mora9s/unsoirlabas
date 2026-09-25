import { useEffect, useRef, useState } from 'react'
import { archiveFilename, createArchive, previewArchive } from '../archive'
import { readTrip, storageKey } from '../journal'
import { readUpcoming, upcomingKey } from '../upcoming-trips'
import { journalsKey, readJournals } from '../trip-journals'
import type { Trip } from '../journal'
import Icon from './Icon'

type Notice = { kind: 'success' | 'error' | 'info'; text: string }
type Snapshot = { trip: string | null; upcoming: string | null; journals: string | null }
function snapshot(): Snapshot { return { trip: localStorage.getItem(storageKey), upcoming: localStorage.getItem(upcomingKey), journals: localStorage.getItem(journalsKey) } }
function same(a: Snapshot, b: Snapshot) { return a.trip === b.trip && a.upcoming === b.upcoming && a.journals === b.journals }

function size(bytes: number) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} Ko` : `${(bytes / (1024 * 1024)).toFixed(1)} Mo` }
function date(value: string) { return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value)) }
function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export default function Backup({ trip, onRestore }: { trip: Trip; onRestore: (trip: Trip) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const previewTitle = useRef<HTMLHeadingElement>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice>()
  const [staged, setStaged] = useState<Awaited<ReturnType<typeof previewArchive>>>()
  const [safety, setSafety] = useState<Snapshot>()
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    if (staged) window.requestAnimationFrame(() => previewTitle.current?.focus())
  }, [staged])

  async function backup(preferShare: boolean) {
    setBusy(true); setNotice(undefined)
    try {
      const upcoming = readUpcoming()
      if (upcoming.error) throw new Error(upcoming.error)
      const journals = readJournals()
      if (journals.error) throw new Error(journals.error)
      const resolved = { ...journals.data, journals: journals.data.journals.map(item => { const current = upcoming.trips.find(candidate => candidate.id === item.tripId); return current ? { ...item, destination: current.destination, departure: current.departure } : item }) }
      const archive = await createArchive(trip, upcoming.trips, undefined, resolved)
      const filename = archiveFilename()
      const shareFile = new File([archive], filename, { type: 'application/zip' })
      const supported = preferShare && typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [shareFile] })
      if (supported) {
        try {
          await navigator.share({ title: 'Sauvegarde Un soir là-bas', text: 'Archive personnelle des voyages et carnets Un soir là-bas.', files: [shareFile] })
          setNotice({ kind: 'info', text: 'La feuille de partage a été ouverte. Choisissez Drive pour y déposer cette archive ; le carnet local reste la source de référence.' })
        } catch (error) {
          if ((error as DOMException).name === 'AbortError') setNotice({ kind: 'info', text: 'Partage annulé. Votre carnet local n’a pas été modifié.' })
          else { download(archive, filename); setNotice({ kind: 'info', text: 'Le partage n’a pas abouti : l’archive a été téléchargée. Placez-la dans Drive si vous le souhaitez.' }) }
        }
      } else {
        download(archive, filename)
        setNotice({ kind: 'info', text: 'Archive téléchargée. Déposez-la dans le dossier de sauvegardes de vos voyages sur Drive si vous le souhaitez.' })
      }
    } catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'La sauvegarde n’a pas pu être préparée.' }) }
    finally { setBusy(false) }
  }

  async function stage(file?: File) {
    if (!file) return
    setBusy(true); setNotice(undefined); setStaged(undefined); setSafety(undefined); setConfirmed(false)
    try { setStaged(await previewArchive(file)) }
    catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Cette archive ne peut pas être restaurée.' }) }
    finally { setBusy(false); if (input.current) input.current.value = '' }
  }

  async function safetyCopy() {
    setBusy(true); setNotice(undefined); setSafety(undefined); setConfirmed(false)
    try {
      const before = snapshot()
      const currentTrip = readTrip(), currentUpcoming = readUpcoming(), currentJournals = readJournals()
      if (currentTrip.error || currentUpcoming.error || currentJournals.error) throw new Error('Les données locales sont illisibles : aucune copie de sécurité fiable ne peut être créée.')
      const archive = await createArchive(currentTrip.trip, currentUpcoming.trips, undefined, currentJournals.data)
      if (!same(before, snapshot())) throw new Error('Les données ont changé pendant la préparation. Recommencez la copie de sécurité.')
      download(archive, `securite-avant-restauration-${archiveFilename()}`)
      setSafety(before)
      setNotice({ kind: 'info', text: 'Une copie de sécurité a été téléchargée. Vérifiez qu’elle se trouve bien dans vos fichiers avant de confirmer.' })
    } catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'La copie de sécurité a échoué.' }) }
    finally { setBusy(false) }
  }

  function restore() {
    if (!staged) return
    if (readTrip().error) {
      setNotice({ kind: 'error', text: 'Le carnet déjà enregistré est illisible. Il n’a pas été remplacé ; vérifiez ou exportez le stockage avant de restaurer cette archive.' })
      return
    }
    if (staged.upcoming !== undefined && readUpcoming().error) {
      setNotice({ kind: 'error', text: 'Les préparatifs déjà enregistrés sont illisibles. Ils n’ont pas été remplacés ; vérifiez ou exportez le stockage avant de restaurer cette archive.' })
      return
    }
    if (staged.personalJournals !== undefined && readJournals().error) {
      setNotice({ kind: 'error', text: 'Les carnets personnels déjà enregistrés sont illisibles. Ils n’ont pas été remplacés ; vérifiez ou exportez le stockage avant de restaurer cette archive.' })
      return
    }
    const previousTrip = localStorage.getItem(storageKey)
    const previousUpcoming = localStorage.getItem(upcomingKey)
    const previousJournals = localStorage.getItem(journalsKey)
    const current = { trip: previousTrip, upcoming: previousUpcoming, journals: previousJournals }
    if ((current.trip !== null || (staged.upcoming !== undefined && current.upcoming !== null) || (staged.personalJournals !== undefined && current.journals !== null)) && (!safety || !confirmed || !same(safety, current))) {
      setSafety(undefined); setConfirmed(false)
      setNotice({ kind: 'error', text: 'Téléchargez une copie de sécurité des données actuelles, vérifiez le fichier puis confirmez avant de les remplacer. Si les données ont changé, recommencez la copie.' })
      return
    }
    try {
      // Serialize before any write, then roll both keys back if either write fails.
      const nextTrip = JSON.stringify(staged.trip)
      const nextUpcoming = staged.upcoming === undefined ? undefined : JSON.stringify(staged.upcoming)
      const nextJournals = staged.personalJournals === undefined ? undefined : JSON.stringify(staged.personalJournals)
      if (nextUpcoming !== undefined) localStorage.setItem(upcomingKey, nextUpcoming)
      if (nextJournals !== undefined) localStorage.setItem(journalsKey, nextJournals)
      localStorage.setItem(storageKey, nextTrip)
      onRestore(staged.trip)
      setStaged(undefined)
      setSafety(undefined); setConfirmed(false)
      setNotice({ kind: 'success', text: 'Le carnet a été restauré. Les préparatifs et carnets personnels présents dans l’archive ont été restaurés ; les collections absentes de cette archive ont été conservées.' })
    } catch {
      let rolledBack = true
      try {
        if (previousTrip === null) localStorage.removeItem(storageKey)
        else localStorage.setItem(storageKey, previousTrip)
        if (previousUpcoming === null) localStorage.removeItem(upcomingKey)
        else localStorage.setItem(upcomingKey, previousUpcoming)
        if (previousJournals === null) localStorage.removeItem(journalsKey)
        else localStorage.setItem(journalsKey, previousJournals)
      } catch { rolledBack = false }
      setNotice({ kind: 'error', text: rolledBack
        ? 'La restauration n’a pas abouti : le stockage est plein ou indisponible. Le carnet et les préparatifs déjà présents n’ont pas été modifiés.'
        : 'La restauration a échoué et le navigateur a aussi refusé le retour arrière. Vérifiez le stockage avant toute nouvelle modification.' })
    }
  }

  const personalPages = staged?.personalJournals?.journals.reduce((total, item) => total + item.chapters.length, 0) ?? 0
  return <section className="backup page-width" aria-labelledby="backup-title">
    <div className="backup-copy"><p className="eyebrow">Conserver vos voyages</p><h2 id="backup-title">Une copie pour la route.</h2><p>Cette archive réunit le carnet, vos voyages préparés et les journées que vous avez racontées, avec leurs photos sélectionnées et redimensionnées. Rangez-la dans vos sauvegardes Drive ; les originaux restent sur vos appareils ou dans votre bibliothèque photo.</p></div>
    <div className="backup-actions">
      <button className="button" onClick={() => backup(true)} disabled={busy}>Sauvegarder dans Drive <Icon name="arrow" /></button>
      <button className="text-button" onClick={() => input.current?.click()} disabled={busy}>Importer depuis Drive <Icon name="book" /></button>
      <input ref={input} className="visually-hidden" type="file" accept="application/zip,.zip" aria-label="Choisir une sauvegarde ZIP" onChange={event => stage(event.target.files?.[0])} />
      <p className="local-note">Drive s’ouvre via la feuille de partage quand elle est disponible. Sinon, le téléchargement reste possible, même hors ligne ou sur un réseau local.</p>
    </div>
    {notice && <p role={notice.kind === 'error' ? 'alert' : 'status'} aria-live="polite" className={notice.kind === 'error' ? 'error-message backup-message' : notice.kind === 'success' ? 'success-message backup-message' : 'backup-message'}>{notice.text}</p>}
    {staged && <section className="restore-preview" aria-labelledby="restore-title" aria-live="polite">
      <p className="eyebrow">Archive prête à relire</p><h3 id="restore-title" ref={previewTitle} tabIndex={-1}>Restaurer ce carnet ?</h3>
      <p>Créée le {date(staged.createdAt)} · {staged.records} chapitre{staged.records > 1 ? 's' : ''} du carnet initial · {personalPages} journée{personalPages > 1 ? 's' : ''} des voyages · {staged.media} photo{staged.media > 1 ? 's' : ''} · {size(staged.bytes)}</p>
      <p><strong>Cette restauration remplace le carnet et les collections présentes dans l’archive.</strong> Elle ne fusionne pas les chapitres.</p>
      {staged.upcoming === undefined
        ? <p>L’archive ne contient pas de préparatifs de voyage : vos préparatifs déjà enregistrés sur cet appareil seront conservés.</p>
        : <p>Les préparatifs de voyage de l’archive remplaceront ceux de cet appareil ({staged.upcoming.length} voyage{staged.upcoming.length === 1 ? '' : 's'}{staged.upcoming.some(item => item.plan) ? ', avec leurs idées, étapes et notes incluses' : ''}).</p>}
      {staged.personalJournals === undefined
        ? <p>L’archive ne contient pas de carnets personnels : ceux déjà enregistrés sur cet appareil seront conservés.</p>
        : <p>Les carnets personnels de l’archive remplaceront ceux de cet appareil ({staged.personalJournals.journals.length} carnet{staged.personalJournals.journals.length === 1 ? '' : 's'}).</p>}
      <div className="restore-safety"><button className="button button-outline" disabled={busy} onClick={safetyCopy}>Télécharger une copie de sécurité</button>{safety && <label><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /> J’ai vérifié et conservé le fichier de sécurité.</label>}</div>
      <div className="personal-actions"><button className="button" onClick={restore} disabled={busy}>Restaurer ce carnet <Icon name="check" /></button><button className="text-button" onClick={() => { setStaged(undefined); setSafety(undefined); setConfirmed(false); setNotice({ kind: 'info', text: 'Restauration annulée. Le carnet local n’a pas été modifié.' }) }}>Annuler</button></div>
    </section>}
  </section>
}

