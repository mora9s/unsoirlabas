import { useEffect, useRef, useState } from 'react'
import { archiveFilename, createArchive, previewArchive } from '../archive'
import { storageKey } from '../journal'
import { upcomingKey } from '../upcoming-trips'
import { journalsKey } from '../trip-journals'
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

export default function Backup({ trip, onRestore }: { trip: Trip; onRestore: (trip: Trip) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const previewTitle = useRef<HTMLHeadingElement>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice>()
  const [staged, setStaged] = useState<Awaited<ReturnType<typeof previewArchive>>>()

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
    setBusy(true); setNotice(undefined); setStaged(undefined)
    try { setStaged(await previewArchive(file)) }
    catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Cette archive ne peut pas être restaurée.' }) }
    finally { setBusy(false); if (input.current) input.current.value = '' }
  }

  function restore() {
    if (!staged) return
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
      <p><strong>{staged.personalJournals === undefined
        ? 'Cette archive ne contient pas les carnets multi-voyage : les carnets locaux actuels seront remplacés par aucun carnet multi-voyage. Le carnet historique restauré pourra ensuite être migré.'
        : 'Cette restauration remplace les carnets multi-voyage locaux par ceux de l’archive, y compris si l’archive en contient zéro.'}</strong> {staged.upcomingTrips === undefined ? 'Le carnet principal sera remplacé ; les décomptes actuels seront conservés.' : 'Le carnet principal et les décomptes seront remplacés.'} Aucune donnée ne sera fusionnée.</p>
      <div className="personal-actions"><button className="button" onClick={restore}>Restaurer ce carnet <Icon name="check" /></button><button className="text-button" onClick={() => { setStaged(undefined); setNotice({ kind: 'info', text: 'Restauration annulée. Le carnet local n’a pas été modifié.' }) }}>Annuler</button></div>
    </section>}
  </section>
}

