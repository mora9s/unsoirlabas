import { useEffect, useMemo, useState } from 'react'
import { zipSync } from 'fflate'
import type { Draft, Media } from '../journal'
import Icon from './Icon'

type Format = 'story' | 'carousel' | 'postcard'
type Props = { draft: Draft; destination: string; departure: string; returnHref: string }

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number) {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    if (!paragraph) { lines.push(''); continue }
    let line = ''
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word
      if (ctx.measureText(candidate).width <= width) { line = candidate; continue }
      if (line) lines.push(line)
      line = ''
      for (const char of word) {
        if (line && ctx.measureText(line + char).width > width) { lines.push(line); line = '' }
        line += char
      }
    }
    if (line) lines.push(line)
  }
  return lines
}

async function renderPage(media: Media | undefined, text: string, format: Exclude<Format, 'carousel'>, page: number, total: number, keepGoing: () => boolean = () => true) {
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = format === 'story' ? 1920 : 1350
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas indisponible')
  ctx.fillStyle = '#f3eee2'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  if (media?.src) {
    const image = new Image()
    image.src = media.src
    await image.decode()
    if (!keepGoing()) throw new Error('Aperçu remplacé')
    const photoHeight = Math.round(canvas.height * (format === 'story' ? 0.60 : 0.52))
    const scale = Math.min(canvas.width / image.width, photoHeight / image.height)
    const width = image.width * scale
    const height = image.height * scale
    ctx.drawImage(image, (canvas.width - width) / 2, 0, width, height)
  }
  const top = Math.round(canvas.height * (format === 'story' ? 0.63 : 0.55))
  ctx.fillStyle = '#f3eee2'
  ctx.fillRect(0, top, canvas.width, canvas.height - top)
  ctx.fillStyle = '#27483e'
  ctx.font = '30px Arial'
  ctx.fillText(total > 1 ? `${String(page + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}` : 'UN SOIR LÀ-BAS', 72, top + 64)
  let size = 56
  let lines: string[] = []
  const usableHeight = canvas.height - top - 120
  while (size >= 24) {
    ctx.font = `${size}px Georgia`
    lines = wrap(ctx, text.trim(), 936)
    if (lines.length * size * 1.28 <= usableHeight) break
    size -= 2
  }
  if (lines.length * size * 1.28 > usableHeight) throw new Error('Le texte relu est trop long pour tenir dans cette carte. Raccourcissez-le avant l’export.')
  ctx.font = `${size}px Georgia`
  ctx.fillStyle = '#24352e'
  lines.forEach((line, index) => ctx.fillText(line, 72, top + 132 + index * size * 1.28))
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('PNG indisponible')), 'image/png'))
  return blob
}

function filename(index: number) { return `souvenir-${String(index + 1).padStart(2, '0')}.png` }
function planPages(photos: Array<Media | undefined>, text: string, format: Format) {
  if (format === 'postcard') return [{ media: photos[0], text }]
  const limit = format === 'story' ? 1050 : 680
  const count = Math.max(photos.length, Math.ceil(text.length / limit), 1)
  const words = text.split(/\s+/)
  const chunks: string[] = Array.from({ length: count }, () => '')
  let page = 0
  for (const word of words) {
    const next = chunks[page] ? `${chunks[page]} ${word}` : word
    if (page < count - 1 && chunks[page] && next.length > Math.ceil(text.length / count)) page++
    chunks[page] = chunks[page] ? `${chunks[page]} ${word}` : word
  }
  return chunks.map((part, index) => ({ media: photos[index % photos.length], text: part }))
}

export default function ChapterShareStudio({ draft, destination, departure, returnHref }: Props) {
  const [title, setTitle] = useState(draft.title)
  const [story, setStory] = useState(draft.story)
  const [date, setDate] = useState(departure)
  const [place, setPlace] = useState(destination)
  const [names, setNames] = useState('')
  const [includeDate, setIncludeDate] = useState(Boolean(departure))
  const [includePlace, setIncludePlace] = useState(Boolean(destination))
  const [includeNames, setIncludeNames] = useState(false)
  const [selected, setSelected] = useState<string[]>(draft.media.map(item => item.id))
  const [format, setFormat] = useState<Format>('story')
  const [reviewed, setReviewed] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [previewError, setPreviewError] = useState('')
  const photos = useMemo(() => draft.media.filter(item => selected.includes(item.id)), [draft.media, selected])
  const text = [title.trim(), includeDate ? date.trim() : '', includePlace ? place.trim() : '', includeNames ? names.trim() : '', story.trim()].filter(Boolean).join('\n\n')
  const previewPhotos = useMemo(() => photos.length ? photos : [undefined], [photos])
  const change = (fn: () => void) => { fn(); setReviewed(false); setNotice(''); setError(''); setPreviewUrls([]); setPreviewError('') }

  useEffect(() => {
    let active = true
    const created: string[] = []
    const outputFormat = format === 'story' ? 'story' : 'postcard'
    const pages = planPages(previewPhotos, text, format)
    void (async () => {
      try {
        for (let index = 0; index < pages.length; index++) {
          const blob = await renderPage(pages[index].media, pages[index].text, outputFormat, index, pages.length, () => active)
          created.push(URL.createObjectURL(blob))
        }
        if (active) setPreviewUrls(created)
      } catch (reason) { if (active) setPreviewError(reason instanceof Error ? reason.message : 'Aperçu indisponible.') }
    })()
    return () => { active = false; created.forEach(URL.revokeObjectURL) }
  }, [format, text, previewPhotos])

  async function exportFiles() {
    setBusy(true); setError(''); setNotice('')
    try {
      const outputFormat = format === 'story' ? 'story' : 'postcard'
      const pages = planPages(previewPhotos, text, format)
      const pngs: Record<string, Uint8Array> = {}
      for (let index = 0; index < pages.length; index++) pngs[filename(index)] = new Uint8Array(await (await renderPage(pages[index].media, pages[index].text, outputFormat, index, pages.length)).arrayBuffer())
      const first = pngs[filename(0)]!
      const payload = pages.length === 1 ? new Blob([first.buffer as ArrayBuffer], { type: 'image/png' }) : new Blob([zipSync(pngs, { level: 0 }).buffer as ArrayBuffer], { type: 'application/zip' })
      const url = URL.createObjectURL(payload)
      const link = document.createElement('a')
      link.href = url
      link.download = pages.length === 1 ? 'souvenir.png' : 'souvenirs.zip'
      document.body.append(link)
      try { link.click() } finally { link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 30_000) }
      setNotice(pages.length === 1 ? 'Votre PNG est prêt. Aucune publication n’a été effectuée.' : 'Le ZIP de vos pages ordonnées est prêt. Aucune publication n’a été effectuée.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'L’export n’a pas abouti.') }
    finally { setBusy(false) }
  }

  return <section className="share-studio page-width personal-studio chapter-share-studio" data-testid="share-studio">
    <header className="workspace-heading"><p className="eyebrow">Studio de partage · chapitre sélectionné</p><h1>Choisissez ce qui<br /><em>sort du carnet.</em></h1><p>Rien n’est publié automatiquement. Le carnet d’origine ne sera pas modifié.</p><a className="text-button" href={returnHref}>Retour à cette journée<Icon name="left" /></a></header>
    <div className="share-layout"><div className="share-visuals">
      <label className="field-label" htmlFor="share-title">Titre retouchable</label><input id="share-title" value={title} onChange={e => change(() => setTitle(e.target.value))} />
      <fieldset><legend>Champs facultatifs — modifiez-les ou décochez-les</legend>
        <label><input type="checkbox" checked={includeDate} disabled={!date} onChange={e => change(() => setIncludeDate(e.target.checked))} /> Inclure la date de départ du voyage</label>{date && includeDate && <input aria-label="Date à partager" value={date} onChange={e => change(() => setDate(e.target.value))} />}
        <label><input type="checkbox" checked={includePlace} disabled={!place} onChange={e => change(() => setIncludePlace(e.target.checked))} /> Inclure le lieu du voyage</label>{place && includePlace && <input aria-label="Lieu à partager" value={place} onChange={e => change(() => setPlace(e.target.value))} />}
        <label><input type="checkbox" checked={includeNames} onChange={e => change(() => setIncludeNames(e.target.checked))} /> Inclure les noms saisis ici</label>{includeNames && <input aria-label="Noms à partager" value={names} onChange={e => change(() => setNames(e.target.value))} placeholder="Saisissez uniquement les noms souhaités" />}
      </fieldset>
      <label className="field-label" htmlFor="share-story">Texte à partager — relisez et retirez vous-même les détails sensibles</label><textarea id="share-story" aria-label="Texte à partager" rows={7} value={story} onChange={e => change(() => setStory(e.target.value))} />
      <fieldset><legend>Photos du chapitre · ordre conservé</legend>{draft.media.length ? draft.media.map((media, index) => <label key={media.id}><input aria-label={`Photo ${index + 1}`} type="checkbox" checked={selected.includes(media.id)} onChange={e => change(() => setSelected(current => e.target.checked ? [...current, media.id] : current.filter(id => id !== media.id)))} /> Photo {index + 1} · {media.name}</label>) : <p>Aucune photo enregistrée dans ce chapitre.</p>}</fieldset>
      <div className="share-format-controls"><button aria-pressed={format === 'story'} onClick={() => change(() => setFormat('story'))}>Story · 9:16</button><button aria-pressed={format === 'carousel'} onClick={() => change(() => setFormat('carousel'))}>Publication / carrousel · 4:5</button><button aria-pressed={format === 'postcard'} onClick={() => change(() => setFormat('postcard'))}>Carte postale · 4:5</button></div>
      <div className="chapter-share-preview" data-testid="share-review"><p className="eyebrow">Aperçu exact avant export · {previewUrls.length || planPages(previewPhotos, text, format).length} page{(previewUrls.length || planPages(previewPhotos, text, format).length) > 1 ? 's' : ''}</p>{previewUrls.map((url, index) => <article className="share-review-card" key={url} data-testid="story-preview"><img src={url} alt={`Aperçu exportable ${index + 1}`} /></article>)}{previewError && <p role="alert">{previewError}</p>}</div>
      <label className="explicit-review"><input type="checkbox" checked={reviewed} disabled={previewUrls.length !== planPages(previewPhotos, text, format).length || Boolean(previewError)} onChange={e => setReviewed(e.target.checked)} /> J’ai relu cet aperçu et confirme le contenu exact à exporter.</label>
      <button className="button" disabled={!reviewed || busy || previewUrls.length !== planPages(previewPhotos, text, format).length} onClick={() => void exportFiles()}>{busy ? 'Préparation…' : format === 'carousel' ? 'Créer le carrousel ZIP' : format === 'postcard' ? 'Télécharger la carte postale' : 'Télécharger la Story'}</button>
      <div aria-live="polite">{notice && <p role="status" className="success-message">{notice}</p>}</div>{error && <p role="alert" className="error-message">{error}</p>}
      <p className="privacy-note">Les fichiers sont produits localement. Aucun partage système ni publication automatique.</p>
    </div></div>
  </section>
}
