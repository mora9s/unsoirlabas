import { useEffect, useRef, useState } from 'react'
import { archiveFilename, createArchive, previewArchive } from '../archive'
import { storageKey, validateTrip } from '../journal'
import { upcomingKey, validateUpcomingTrips } from '../upcoming-trips'
import { journalsKey, validateJournals } from '../trip-journals'
import type { Trip } from '../journal'
import Icon from './Icon'

type Notice = { kind: 'success' | 'error' | 'info'; text: string }

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
function storedValue<T>(key: string, fallback: T, valid: (value: unknown) => value is T): T {
  const raw = localStorage.getItem(key)
  if (raw === null) return fallback
  const value: unknown = JSON.parse(raw)
  if (!valid(value)) throw new Error('Le stockage local est invalide ; la copie de sécurité ne peut pas être préparée sans risque.')
  return value
}

export default function Backup({ trip, onRestore }: { trip: Trip; onRestore: (trip: Trip) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const previewTitle = useRef<HTMLHeadingElement>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice>()
  const [staged, setStaged] = useState<Awaited<ReturnType<typeof previewArchive>>>()
  const [safetyDownloadRequested, setSafetyDownloadRequested] = useState(false)
  const [safetyConfirmed, setSafetyConfirmed] = useState(false)
  const safetySnapshot = useRef<[string | null, string | null, string | null] | null>(null)

  useEffect(() => {
    if (staged) window.requestAnimationFrame(() => previewTitle.current?.focus())
  }, [staged])

  async function backup(preferShare: boolean) {
    setBusy(true); setNotice(undefined)
    try {
      const archive = await createArchive(trip)
      const filename = archiveFilename()
      const shareFile = new File([archive], filename, { type: 'application/zip' })
      const supported = preferShare && typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [shareFile] })
      if (supported) {
        try {
          await navigator.share({ title: 'Sauvegarde du carnet Philippines', text: 'Archive personnelle du carnet Un soir là-bas.', files: [shareFile] })
          setNotice({ kind: 'info', text: 'La feuille de partage a été ouverte. Choisissez Drive pour y déposer cette archive ; le carnet local reste la source de référence.' })
        } catch (error) {
          if ((error as DOMException).name === 'AbortError') setNotice({ kind: 'info', text: 'Partage annulé. Votre carnet local n’a pas été modifié.' })
          else { download(archive, filename); setNotice({ kind: 'info', text: 'Le partage n’a pas abouti : l’archive a été téléchargée. Placez-la dans Drive si vous le souhaitez.' }) }
        }
      } else {
        download(archive, filename)
        setNotice({ kind: 'info', text: 'Archive téléchargée. Ajoutez-la au dossier Voyages / Philippines / Sauvegardes dans Drive si vous le souhaitez.' })
      }
    } catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'La sauvegarde n’a pas pu être préparée.' }) }
    finally { setBusy(false) }
  }

  async function stage(file?: File) {
    if (!file) return
    setBusy(true); setNotice(undefined); setStaged(undefined); setSafetyDownloadRequested(false); setSafetyConfirmed(false); safetySnapshot.current = null
    try { setStaged(await previewArchive(file)) }
    catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Cette archive ne peut pas être restaurée.' }) }
    finally { setBusy(false); if (input.current) input.current.value = '' }
  }

  async function downloadSafetyCopy() {
    if (!staged) return
    setBusy(true); setNotice(undefined); setSafetyDownloadRequested(false); setSafetyConfirmed(false)
    try {
      const currentTrip = storedValue(storageKey, trip, validateTrip)
      const upcomingTrips = storedValue(upcomingKey, [], validateUpcomingTrips)
      const personalJournals = storedValue(journalsKey, { version: 1, journals: [] }, validateJournals)
      const snapshot: [string | null, string | null, string | null] = [localStorage.getItem(storageKey), localStorage.getItem(upcomingKey), localStorage.getItem(journalsKey)]
      const archive = await createArchive(currentTrip, new Date().toISOString(), { upcomingTrips, personalJournals })
      download(archive, `copie-securite-${archiveFilename()}`)
      safetySnapshot.current = snapshot
      setSafetyDownloadRequested(true)
      setNotice({ kind: 'info', text: 'Le navigateur a lancé le téléchargement de la copie de sécurité. Vérifiez le fichier avant de confirmer.' })
    } catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'La copie de sécurité n’a pas pu être préparée.' }) }
    finally { setBusy(false) }
  }

  function restore() {
    if (!staged || !safetyDownloadRequested || !safetyConfirmed) return
    if (!safetySnapshot.current || [storageKey, upcomingKey, journalsKey].some((key, index) => localStorage.getItem(key) !== safetySnapshot.current?.[index])) {
      setSafetyDownloadRequested(false); setSafetyConfirmed(false); safetySnapshot.current = null
      setNotice({ kind: 'error', text: 'Les données locales ont changé depuis la copie de sécurité. Téléchargez une nouvelle copie avant de restaurer.' })
      return
    }
    const previous = new Map<string, string | null>()
    const written: string[] = []
    try {
      previous.set(storageKey, localStorage.getItem(storageKey))
      previous.set(upcomingKey, localStorage.getItem(upcomingKey))
      previous.set(journalsKey, localStorage.getItem(journalsKey))
      const next = JSON.stringify(staged.trip)
      const nextUpcoming = staged.upcomingTrips === undefined ? undefined : JSON.stringify(staged.upcomingTrips)
      const nextJournals = JSON.stringify(staged.personalJournals ?? { version: 1, journals: [] })
      localStorage.setItem(storageKey, next)
      written.push(storageKey)
      if (nextUpcoming !== undefined) {
        localStorage.setItem(upcomingKey, nextUpcoming)
        written.push(upcomingKey)
      }
      localStorage.setItem(journalsKey, nextJournals)
      written.push(journalsKey)
      if (nextUpcoming !== undefined) window.dispatchEvent(new Event('upcoming-trips-updated'))
      window.dispatchEvent(new Event('trip-journals-updated'))
      onRestore(staged.trip)
      setStaged(undefined)
      setNotice({ kind: 'success', text: staged.personalJournals === undefined
        ? 'Le carnet a été restauré. Les carnets multi-voyage absents de cette ancienne archive ont été remplacés ; les chapitres du carnet historique restauré pourront être migrés. '
          + (staged.upcomingTrips === undefined ? 'Vos décomptes actuels ont été conservés.' : 'Les voyages à venir ont aussi été remplacés.')
        : 'Le carnet, les voyages et les carnets personnels inclus ont été restaurés sur cet appareil. Les données locales non incluses ont été remplacées.' })
    } catch {
      for (const key of written.reverse()) {
        try {
          localStorage.removeItem(key)
          const value = previous.get(key)
          if (value != null) localStorage.setItem(key, value)
        } catch { /* Restore each prior key independently if storage is constrained. */ }
      }
      setNotice({ kind: 'error', text: 'La restauration n’a pas abouti : le stockage est plein ou indisponible. Le carnet et les décomptes déjà présents n’ont pas été modifiés.' })
    }
  }

  return <section className="backup page-width" aria-labelledby="backup-title">
    <div className="backup-copy"><p className="eyebrow">Conserver le carnet</p><h2 id="backup-title">Une copie pour la route.</h2><p>Dans Drive, rangez l’archive dans <strong>Voyages / Philippines / Sauvegardes</strong>. Gardez-y vos originaux ; cette copie contient les photos sélectionnées et redimensionnées du carnet, vos récits et vos décomptes à venir.</p></div>
    <div className="backup-actions">
      <button className="button" onClick={() => backup(true)} disabled={busy}>Sauvegarder dans Drive <Icon name="arrow" /></button>
      <button className="text-button" onClick={() => input.current?.click()} disabled={busy}>Importer depuis Drive <Icon name="book" /></button>
      <input ref={input} className="visually-hidden" type="file" accept="application/zip,.zip" aria-label="Choisir une sauvegarde ZIP" onChange={event => stage(event.target.files?.[0])} />
      <p className="local-note">Drive s’ouvre via la feuille de partage quand elle est disponible. Sinon, le téléchargement reste possible, même hors ligne ou sur un réseau local.</p>
    </div>
    {notice && <p role={notice.kind === 'error' ? 'alert' : 'status'} aria-live="polite" className={notice.kind === 'error' ? 'error-message backup-message' : notice.kind === 'success' ? 'success-message backup-message' : 'backup-message'}>{notice.text}</p>}
    {staged && <section className="restore-preview" aria-labelledby="restore-title" aria-live="polite">
      <p className="eyebrow">Archive prête à relire</p><h3 id="restore-title" ref={previewTitle} tabIndex={-1}>Restaurer ce carnet ?</h3>
      <p>Créée le {date(staged.createdAt)} · {staged.records} chapitre{staged.records > 1 ? 's' : ''} · {staged.media} photo{staged.media > 1 ? 's' : ''} du carnet principal · {staged.personalJournals ? `${staged.personalJournals.journals.length} carnet${staged.personalJournals.journals.length > 1 ? 's' : ''}, ${staged.personalJournals.journals.reduce((sum, item) => sum + item.chapters.length, 0)} chapitre${staged.personalJournals.journals.reduce((sum, item) => sum + item.chapters.length, 0) > 1 ? 's' : ''}, ${staged.personalJournals.journals.reduce((sum, item) => sum + item.chapters.reduce((photos, chapter) => photos + chapter.media.length, 0), 0)} photo${staged.personalJournals.journals.reduce((sum, item) => sum + item.chapters.reduce((photos, chapter) => photos + chapter.media.length, 0), 0) > 1 ? 's' : ''} personnelle${staged.personalJournals.journals.reduce((sum, item) => sum + item.chapters.reduce((photos, chapter) => photos + chapter.media.length, 0), 0) > 1 ? 's' : ''}` : 'ancienne archive : aucun carnet multi-voyage inclus'} · {size(staged.bytes)}</p>
      <p><strong>{staged.personalJournals === undefined ? 'Cette archive historique ne contient pas de carnets multi-voyage : les carnets multi-voyage locaux seront remplacés par aucun carnet multi-voyage.' : 'Remplacement uniquement : aucune fusion automatique. Tout identifiant présent dans les deux versions sera remplacé par celui de l’archive.'}</strong> {staged.personalJournals === undefined ? 'Le carnet personnel historique restauré pourra ensuite être migré.' : ''} {staged.upcomingTrips === undefined ? 'Le carnet principal et les carnets personnels seront remplacés ; les décomptes seront conservés car cette ancienne archive n’en contient pas.' : 'Le carnet principal, les décomptes et les carnets personnels seront remplacés.'}</p>
      <div className="restore-differences">
        <h4>Différences avec les données actuelles</h4>
        {(() => {
          try {
            const currentUpcoming = storedValue(upcomingKey, [], validateUpcomingTrips)
            const currentJournals = storedValue(journalsKey, { version: 1, journals: [] }, validateJournals)
            const incomingUpcoming = staged.upcomingTrips ?? currentUpcoming
            const incomingJournals = staged.personalJournals ?? { version: 1 as const, journals: [] }
            const chapterIds = new Set(trip.drafts.map(item => item.id))
            const chapterCollisions = staged.trip.drafts.map(item => item.id).filter(id => chapterIds.has(id))
            const currentTripIds = new Set(currentUpcoming.map(item => item.id))
            const tripCollisions = (staged.upcomingTrips ?? []).map(item => item.id).filter(id => currentTripIds.has(id))
            const journalIds = new Set(currentJournals.journals.map(item => item.tripId))
            const journalCollisions = incomingJournals.journals.map(item => item.tripId).filter(id => journalIds.has(id))
            return <>
              <ul>
                <li>Carnet principal : {trip.drafts.length} chapitre{trip.drafts.length === 1 ? '' : 's'} actuels ({trip.drafts.map(item => item.title || item.id).join(', ') || 'vide'}) → {staged.trip.drafts.length} dans l’archive ({staged.trip.drafts.map(item => item.title || item.id).join(', ') || 'vide'}), {staged.media} photo{staged.media === 1 ? '' : 's'} entrante{staged.media === 1 ? '' : 's'}.</li>
                <li>Décomptes : {currentUpcoming.length} actuels ({currentUpcoming.map(item => item.destination).join(', ') || 'vide'}) → {incomingUpcoming.length} après restauration ({incomingUpcoming.map(item => item.destination).join(', ') || 'vide'}){staged.upcomingTrips === undefined ? ' — conservés par cette ancienne archive' : ''}.</li>
                <li>Carnets personnels : {currentJournals.journals.length} actuels ({currentJournals.journals.map(item => item.destination).join(', ') || 'vide'}) → {incomingJournals.journals.length} dans l’archive ({incomingJournals.journals.map(item => item.destination).join(', ') || 'vide'}).</li>
              </ul>
              {chapterCollisions.length + tripCollisions.length + journalCollisions.length > 0 && <p role="alert"><strong>Identifiants en collision, remplacement uniquement :</strong> {chapterCollisions.length > 0 && <>chapitres {chapterCollisions.join(', ')}. </>}{tripCollisions.length > 0 && <>voyages {tripCollisions.join(', ')}. </>}{journalCollisions.length > 0 && <>carnets {journalCollisions.join(', ')}. </>}Aucun élément ne sera fusionné.</p>}
            </>
          } catch { return <p role="alert">Les données locales ne peuvent pas être comparées. Annulez et vérifiez le stockage avant de continuer.</p> }
        })()}
      </div>
      <div className="safety-copy">
        <p>Avant tout remplacement, téléchargez une copie ZIP de sécurité comprenant le carnet principal, les décomptes et les carnets personnels locaux. L’application ne peut pas vérifier l’enregistrement final du fichier : confirmez uniquement après l’avoir vérifié dans vos téléchargements.</p>
        <button className="text-button" onClick={downloadSafetyCopy} disabled={busy}>Télécharger la copie de sécurité <Icon name="arrow" /></button>
        {safetyDownloadRequested && <label><input type="checkbox" checked={safetyConfirmed} onChange={event => setSafetyConfirmed(event.target.checked)} /> Je confirme que la copie de sécurité est téléchargée et vérifiée.</label>}
      </div>
      <div className="personal-actions"><button className="button" onClick={restore} disabled={!safetyDownloadRequested || !safetyConfirmed || busy}>Restaurer ce carnet <Icon name="check" /></button><button className="text-button" onClick={() => { setStaged(undefined); setSafetyDownloadRequested(false); setSafetyConfirmed(false); safetySnapshot.current = null; setNotice({ kind: 'info', text: 'Restauration annulée. Le carnet local n’a pas été modifié.' }) }}>Annuler</button></div>
    </section>}
  </section>
}

