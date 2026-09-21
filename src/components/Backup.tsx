import { useEffect, useRef, useState } from 'react'
import { archiveFilename, createArchive, previewArchive } from '../archive'
import { storageKey } from '../journal'
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
          await navigator.share({ title: 'Sauvegarde du carnet Philippines', text: 'Archive personnelle du carnet Les jours au large.', files: [shareFile] })
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
    const previous = localStorage.getItem(storageKey)
    try {
      // Serialise before replacing so quota errors leave the previous exact value intact.
      const next = JSON.stringify(staged.trip)
      localStorage.setItem(storageKey, next)
      onRestore(staged.trip)
      setStaged(undefined)
      setNotice({ kind: 'success', text: 'Le carnet a été restauré sur cet appareil. Vous retrouvez vos pages et vos photos.' })
    } catch {
      try {
        if (previous === null) localStorage.removeItem(storageKey)
        else localStorage.setItem(storageKey, previous)
      } catch { /* The browser refused both the write and its defensive rollback. */ }
      setNotice({ kind: 'error', text: 'La restauration n’a pas abouti : le stockage est plein ou indisponible. Le carnet déjà présent n’a pas été modifié.' })
    }
  }

  return <section className="backup page-width" aria-labelledby="backup-title">
    <div className="backup-copy"><p className="eyebrow">Conserver le carnet</p><h2 id="backup-title">Une copie pour la route.</h2><p>Dans Drive, rangez l’archive dans <strong>Voyages / Philippines / Sauvegardes</strong>. Gardez-y vos originaux ; cette copie contient les photos sélectionnées et redimensionnées du carnet, avec vos récits.</p></div>
    <div className="backup-actions">
      <button className="button" onClick={() => backup(true)} disabled={busy}>Sauvegarder dans Drive <Icon name="arrow" /></button>
      <button className="text-button" onClick={() => input.current?.click()} disabled={busy}>Importer depuis Drive <Icon name="book" /></button>
      <input ref={input} className="visually-hidden" type="file" accept="application/zip,.zip" aria-label="Choisir une sauvegarde ZIP" onChange={event => stage(event.target.files?.[0])} />
      <p className="local-note">Drive s’ouvre via la feuille de partage quand elle est disponible. Sinon, le téléchargement reste possible, même hors ligne ou sur un réseau local.</p>
    </div>
    {notice && <p role={notice.kind === 'error' ? 'alert' : 'status'} aria-live="polite" className={notice.kind === 'error' ? 'error-message backup-message' : notice.kind === 'success' ? 'success-message backup-message' : 'backup-message'}>{notice.text}</p>}
    {staged && <section className="restore-preview" aria-labelledby="restore-title" aria-live="polite">
      <p className="eyebrow">Archive prête à relire</p><h3 id="restore-title" ref={previewTitle} tabIndex={-1}>Restaurer ce carnet ?</h3>
      <p>Créée le {date(staged.createdAt)} · {staged.records} chapitre{staged.records > 1 ? 's' : ''} · {staged.media} photo{staged.media > 1 ? 's' : ''} · {size(staged.bytes)}</p>
      <p><strong>Cette restauration remplace entièrement le carnet enregistré sur cet appareil.</strong> Elle ne fusionne pas les chapitres.</p>
      <div className="personal-actions"><button className="button" onClick={restore}>Restaurer ce carnet <Icon name="check" /></button><button className="text-button" onClick={() => { setStaged(undefined); setNotice({ kind: 'info', text: 'Restauration annulée. Le carnet local n’a pas été modifié.' }) }}>Annuler</button></div>
    </section>}
  </section>
}

