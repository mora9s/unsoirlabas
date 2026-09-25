import { useEffect, useRef, useState } from 'react'
import { asset, coverOf, storyExcerpt } from '../journal'
import type { Draft } from '../journal'
import Icon from './Icon'

const initialCaption = 'Jour 3 — El Nido, Philippines.\n\nUne pagaie dans l’eau turquoise, des falaises immenses et cette sensation rare : n’avoir besoin d’être nulle part ailleurs. Entre les îles de Bacuit et le Big Lagoon, on apprend à ralentir.\n\nUn petit morceau de notre voyage, à garder longtemps.\n\n#Philippines #ElNido #CarnetDeVoyage'

function textLines(context: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.trim().split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word
    if (context.measureText(candidate).width <= width) { line = candidate; continue }
    if (line) lines.push(line)
    line = ''
    for (const character of word) {
      if (line && context.measureText(line + character).width > width) { lines.push(line); line = '' }
      line += character
    }
  }
  if (line) lines.push(line)
  return lines
}

function drawText(context: CanvasRenderingContext2D, text: string, y: number, size: number, maxLines: number, serif = false) {
  let lines: string[] = []
  while (size >= 32) {
    context.font = serif ? `italic ${size}px Georgia` : `${size}px Arial`
    lines = textLines(context, text, 920)
    if (lines.length <= maxLines || size <= 32) break
    size -= 2
  }
  const visible = lines.slice(0, maxLines)
  if (lines.length > maxLines) {
    let last = visible[maxLines - 1]
    while (last && context.measureText(`${last}…`).width > 920) last = last.slice(0, -1)
    visible[maxLines - 1] = `${last}…`
  }
  visible.forEach((line, index) => context.fillText(line, 80, y + index * size * 1.2))
}

export default function ShareStudio({ draft, backHref }: { draft?: Draft; backHref?: string }) {
  const cover = draft ? coverOf(draft) : undefined
  const imageSrc = draft ? cover?.src : asset('el-nido-big-lagoon.jpg')
  const excerpt = draft ? storyExcerpt(draft.story) : ''
  const [caption, setCaption] = useState(() => draft ? `${draft.title}\n\n${storyExcerpt(draft.story, 600)}` : initialCaption)
  const [format, setFormat] = useState<'story' | 'post'>('story')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState(false)
  const urls = useRef(new Map<string, number>())
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    const pending = urls.current
    return () => {
      mounted.current = false
      pending.forEach((timer, url) => { window.clearTimeout(timer); URL.revokeObjectURL(url) })
      pending.clear()
    }
  }, [])

  async function copyCaption() {
    setNotice('')
    setError('')
    try {
      await navigator.clipboard.writeText(caption)
      setNotice('Légende copiée. Vous pouvez la coller où vous le souhaitez.')
    } catch {
      setError('Le presse-papiers est indisponible. Sélectionnez la légende ci-dessous et copiez-la avec le raccourci de votre appareil.')
      const field = document.getElementById('caption') as HTMLTextAreaElement | null
      field?.focus()
      field?.select()
    }
  }

  async function download() {
    setNotice('')
    setError('')
    setDownloading(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 1080
      canvas.height = format === 'story' ? 1920 : 1350
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Canvas indisponible')
      context.fillStyle = '#264e43'
      context.fillRect(0, 0, canvas.width, canvas.height)
      if (imageSrc) {
        const image = new Image()
        image.src = imageSrc
        await image.decode()
        const scale = Math.max(canvas.width / image.width, canvas.height / image.height)
        context.drawImage(image, (canvas.width - image.width * scale) / 2, (canvas.height - image.height * scale) / 2, image.width * scale, image.height * scale)
      }
      context.fillStyle = 'rgba(8, 32, 29, 0.30)'
      context.fillRect(0, 0, canvas.width, canvas.height)
      const shade = context.createLinearGradient(0, canvas.height * 0.4, 0, canvas.height)
      shade.addColorStop(0, 'rgba(8, 32, 29, 0)')
      shade.addColorStop(1, 'rgba(8, 32, 29, 0.86)')
      context.fillStyle = shade
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.fillStyle = '#f9f4e9'
      context.font = '26px Arial'
      context.fillText(draft ? 'CARNET PERSONNEL' : 'PHILIPPINES  /  JOUR 03', 80, 100)
      if (draft) {
        drawText(context, draft.title, canvas.height - 650, 76, 4, true)
        drawText(context, excerpt, canvas.height - 290, 32, 3)
      } else {
        context.font = 'italic 88px Georgia'
        context.fillText('Le bonheur', 80, canvas.height - 410)
        context.fillText('à fleur d’eau.', 80, canvas.height - 305)
        context.font = '26px Arial'
        context.fillText('EL NIDO · ENTRE LAGONS ET FALAISES', 80, canvas.height - 205)
      }
      context.strokeStyle = 'rgba(249, 244, 233, 0.55)'
      context.beginPath()
      context.moveTo(80, canvas.height - 140)
      context.lineTo(1000, canvas.height - 140)
      context.stroke()
      context.font = '24px Georgia'
      context.fillText('un soir là-bas', 80, canvas.height - 80)
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Export indisponible')), 'image/png'))
      if (!mounted.current) return
      const url = URL.createObjectURL(blob)
      urls.current.set(url, window.setTimeout(() => { URL.revokeObjectURL(url); urls.current.delete(url) }, 30_000))
      const link = document.createElement('a')
      link.href = url
      const filename = draft ? `carnet-${draft.id.toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 80) || 'personnel'}` : 'philippines-jour-03'
      link.download = `${filename}-${format}.png`
      document.body.append(link)
      try { link.click() } finally { link.remove() }
      setNotice('Votre carte est prête : téléchargement lancé. Aucune publication n’a été effectuée.')
    } catch {
      setError('La carte n’a pas pu être exportée. Réessayez dans un navigateur prenant en charge les images PNG.')
    } finally {
      setDownloading(false)
    }
  }

  return <section className={`share-studio page-width ${draft ? 'personal-studio' : ''}`} data-testid="share-studio"><header className="workspace-heading"><p className="eyebrow">Le studio de partage <span className="divider">/</span> {draft ? 'Carnet personnel' : 'Jour 03'}</p><h1>Un peu d’ici.<br /><em>À partager là-bas.</em></h1><p>Le chapitre reste dans le carnet. Emportez-en un fragment.</p>{draft && <a className="text-button" href={backHref ?? `#draft/${encodeURIComponent(draft.id)}`}>Retour à cette journée<Icon name="left" /></a>}</header>
    <div className="share-layout"><div className="share-visuals"><div className="format-heading"><span className="eyebrow">Deux façons de raconter</span><span>{draft ? 'Votre journée, vos mots' : 'El Nido · Palawan'}</span></div><div className="share-previews">{(['story', 'post'] as const).map(type => <div className={`format-option ${format === type ? 'active-format' : ''}`} key={type}><button className="format-select" aria-pressed={format === type} onClick={() => { setFormat(type); setNotice('') }}>{type === 'story' ? 'Story' : 'Publication / carrousel'} <span>{type === 'story' ? '9:16' : '4:5'}</span></button><div className={`social-card ${type}`} data-testid={`${type}-preview`}>
      {imageSrc && <img src={imageSrc} alt={draft ? `Couverture : ${cover?.name}` : `Aperçu ${type === 'story' ? 'Story verticale' : 'publication 4:5'} : le Big Lagoon à El Nido`} />}
      <div className="social-shade" /><span className="social-kicker">{draft ? 'CARNET PERSONNEL' : 'PHILIPPINES / JOUR 03'}</span><div className="social-copy"><p>{draft ? draft.title : <>Le bonheur<br /><em>à fleur d’eau.</em></>}</p><span>{draft ? excerpt : 'EL NIDO · PALAWAN'}</span><div>un soir là-bas</div></div></div><p className="format-size">{type === 'story' ? '1080 × 1920 px' : '1080 × 1350 px'} · PNG</p></div>)}</div><p className="local-note">Une carte image, prête à utiliser seule ou dans votre propre carrousel.</p></div>
      <div className="caption-workspace"><span className="eyebrow">L’image donne envie. Les mots racontent.</span><h2>Avec vos mots.</h2><label className="field-label" htmlFor="caption">La légende proposée</label><textarea id="caption" rows={11} value={caption} onChange={event => { setCaption(event.target.value); setNotice('') }} /><button className="button button-outline" onClick={copyCaption} disabled={!caption.trim()}>Copier la légende <Icon name="book" /></button><div className="download-section"><span className="eyebrow">Votre format sélectionné</span><p>{format === 'story' ? 'Story verticale · 9:16' : 'Publication / carrousel · 4:5'}</p><button className="button" onClick={download} disabled={downloading}>{downloading ? 'Préparation…' : 'Télécharger'}<Icon name="download" /></button></div><p className="privacy-note">Vous choisissez ensuite où partager. Aucun compte connecté, aucune publication automatique.</p><div aria-live="polite">{notice && <p className="success-message">{notice}</p>}</div>{error && <p role="alert" className="error-message">{error}</p>}</div>
    </div></section>
}
