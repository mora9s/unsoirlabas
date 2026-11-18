import { useMemo, useState } from 'react'
import type { Draft } from '../journal'
import type { ImagePayload } from '../book-pdf'
import { createBookPdf, imagePayload } from '../book-pdf'

export default function ExportBook({ destination, chapters, close }: { destination: string; chapters: Draft[]; close: () => void }) {
  const authored = useMemo(() => chapters.filter(chapter => chapter.story.trim() || chapter.media.length > 0), [chapters])
  const [order, setOrder] = useState(authored.map(chapter => chapter.id))
  const [title, setTitle] = useState('')
  const [conclusion, setConclusion] = useState('')
  const [coverId, setCoverId] = useState('')
  const [includeCover, setIncludeCover] = useState(false)
  const [includePhotos, setIncludePhotos] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const ordered = order.map(id => authored.find(chapter => chapter.id === id)).filter((chapter): chapter is Draft => Boolean(chapter))
  const covers = authored.flatMap(chapter => chapter.media.map(media => ({ media, title: chapter.title })))
  const emptyCount = chapters.length - authored.length
  async function download() {
    setBusy(true); setError('')
    try {
      const selected = await Promise.all(ordered.map(async chapter => ({
        chapter,
        images: includePhotos ? await Promise.all(chapter.media.map(imagePayload)) : [],
      })))
      const chosen = covers.find(item => item.media.id === coverId)?.media
      if (includeCover && !chosen) throw new Error('Choisissez une photo de couverture ou désactivez cette option.')
      const cover: ImagePayload | undefined = includeCover && chosen ? await imagePayload(chosen) : undefined
      const bytes = createBookPdf({ destination, title, conclusion, cover, chapters: selected })
      const url = URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' }))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${(title.trim() || `carnet-${destination}`).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'carnet'}.pdf`
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Le PDF n’a pas pu être préparé sur cet appareil.') }
    finally { setBusy(false) }
  }
  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= order.length) return
    const next = [...order]; [next[index], next[target]] = [next[target], next[index]]; setOrder(next)
  }
  return <div className="book-export-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) close() }}>
    <section className="book-export" role="dialog" aria-modal="true" aria-labelledby="book-title">
      <button className="text-button book-close" onClick={close} aria-label="Fermer le carnet PDF">Fermer ×</button>
      <p className="eyebrow">Votre carnet, sur papier</p><h2 id="book-title">Composer le livre de {destination}</h2>
      <p className="book-note">Assemblé uniquement à partir des chapitres de ce voyage. Rien n’est téléversé ; vos pages originales ne sont pas modifiées.</p>
      <label>Titre de couverture <input maxLength={120} value={title} onChange={event => setTitle(event.target.value)} placeholder={`Carnet de ${destination}`} /></label>
      <label className="book-check"><input type="checkbox" checked={includeCover} onChange={event => setIncludeCover(event.target.checked)} /> Ajouter une photo de couverture (facultatif)</label>
      {includeCover && <label>Photo de couverture <select value={coverId} onChange={event => setCoverId(event.target.value)}><option value="">Choisir une photo</option>{covers.map(({ media, title: chapterTitle }) => <option key={media.id} value={media.id}>{chapterTitle} · {media.name}</option>)}</select></label>}
      <label className="book-check"><input type="checkbox" checked={includePhotos} onChange={event => setIncludePhotos(event.target.checked)} /> Inclure les photos importées des chapitres</label>
      <fieldset><legend>Chapitres · ordre du livre</legend>{authored.map(chapter => { const index = order.indexOf(chapter.id); const included = index >= 0; return <div className="book-order" key={chapter.id}><label className="book-check"><input type="checkbox" checked={included} onChange={() => setOrder(included ? order.filter(id => id !== chapter.id) : [...order, chapter.id])} /> {chapter.title || 'Chapitre sans titre'}</label><span>{included && <><button type="button" aria-label={`Monter ${chapter.title}`} disabled={index === 0} onClick={() => move(index, -1)}>↑</button><button type="button" aria-label={`Descendre ${chapter.title}`} disabled={index === order.length - 1} onClick={() => move(index, 1)}>↓</button></>}</span></div> })}{!ordered.length && <p>Aucun chapitre écrit sélectionné.</p>}</fieldset>
      <label>Votre conclusion <span className="book-optional">(facultative, écrite par vous)</span><textarea maxLength={12000} rows={4} value={conclusion} onChange={event => setConclusion(event.target.value)} placeholder="Laissez vide si vous ne souhaitez pas en ajouter." /></label>
      {emptyCount > 0 && <p className="book-note">{emptyCount} étape{emptyCount > 1 ? 's' : ''} sans récit ni photo laissée{emptyCount > 1 ? 's' : ''} hors du livre : aucune histoire n’a été inventée.</p>}
      <p className="book-note">Les caractères emoji non pris en charge par l’impression seront remplacés par « [symbole non imprimable] ».</p>
      {error && <p role="alert" className="error-message">{error}</p>}
      <button className="button" disabled={busy || !ordered.length} onClick={() => void download()}>{busy ? 'Préparation locale…' : 'Télécharger le PDF'} <span aria-hidden="true">↓</span></button>
    </section>
  </div>
}
