import { useState } from 'react'
import { asset } from '../journal'
import Icon from './Icon'

const initialCaption = 'Jour 3 — El Nido, Philippines.\n\nUne pagaie dans l’eau turquoise, des falaises immenses et cette sensation rare : n’avoir besoin d’être nulle part ailleurs. Entre les îles de Bacuit et le Big Lagoon, on apprend à ralentir.\n\nUn petit morceau de notre voyage, à garder longtemps.\n\n#Philippines #ElNido #CarnetDeVoyage'

export default function ShareStudio() {
  const [caption, setCaption] = useState(initialCaption)
  const [format, setFormat] = useState<'story' | 'post'>('story')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState(false)

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
      const image = new Image()
      image.src = asset('el-nido-big-lagoon.jpg')
      await image.decode()
      const scale = Math.max(canvas.width / image.width, canvas.height / image.height)
      context.drawImage(image, (canvas.width - image.width * scale) / 2, (canvas.height - image.height * scale) / 2, image.width * scale, image.height * scale)
      context.fillStyle = 'rgba(8, 32, 29, 0.30)'
      context.fillRect(0, 0, canvas.width, canvas.height)
      const shade = context.createLinearGradient(0, canvas.height * 0.4, 0, canvas.height)
      shade.addColorStop(0, 'rgba(8, 32, 29, 0)')
      shade.addColorStop(1, 'rgba(8, 32, 29, 0.86)')
      context.fillStyle = shade
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.fillStyle = '#f9f4e9'
      context.font = '26px Arial'
      context.fillText('PHILIPPINES  /  JOUR 03', 80, 100)
      context.font = 'italic 88px Georgia'
      context.fillText('Le bonheur', 80, canvas.height - 410)
      context.fillText('à fleur d’eau.', 80, canvas.height - 305)
      context.font = '26px Arial'
      context.fillText('EL NIDO · ENTRE LAGONS ET FALAISES', 80, canvas.height - 205)
      context.strokeStyle = 'rgba(249, 244, 233, 0.55)'
      context.beginPath()
      context.moveTo(80, canvas.height - 140)
      context.lineTo(1000, canvas.height - 140)
      context.stroke()
      context.font = '24px Georgia'
      context.fillText('les jours au large', 80, canvas.height - 80)
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Export indisponible')), 'image/png'))
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `philippines-jour-03-${format}.png`
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
      setNotice('Votre carte est prête : téléchargement lancé. Aucune publication n’a été effectuée.')
    } catch {
      setError('La carte n’a pas pu être exportée. Réessayez dans un navigateur prenant en charge les images PNG.')
    } finally {
      setDownloading(false)
    }
  }

  return <section className="share-studio page-width" data-testid="share-studio"><header className="workspace-heading"><p className="eyebrow">Le studio de partage <span className="divider">/</span> Jour 03</p><h1>Un peu d’ici.<br /><em>À partager là-bas.</em></h1><p>Le chapitre reste dans le carnet. Emportez-en un fragment.</p></header>
    <div className="share-layout"><div className="share-visuals"><div className="format-heading"><span className="eyebrow">Deux façons de raconter</span><span>El Nido · Palawan</span></div><div className="share-previews">{(['story', 'post'] as const).map(type => <div className={`format-option ${format === type ? 'active-format' : ''}`} key={type}><button className="format-select" aria-pressed={format === type} onClick={() => { setFormat(type); setNotice('') }}>{type === 'story' ? 'Story' : 'Publication / carrousel'} <span>{type === 'story' ? '9:16' : '4:5'}</span></button><div className={`social-card ${type}`} data-testid={`${type}-preview`}><img src={asset('el-nido-big-lagoon.jpg')} alt={`Aperçu ${type === 'story' ? 'Story verticale' : 'publication 4:5'} : le Big Lagoon à El Nido`} /><div className="social-shade" /><span className="social-kicker">PHILIPPINES / JOUR 03</span><div className="social-copy"><p>Le bonheur<br /><em>à fleur d’eau.</em></p><span>EL NIDO · PALAWAN</span><div>les jours au large</div></div></div><p className="format-size">{type === 'story' ? '1080 × 1920 px' : '1080 × 1350 px'} · PNG</p></div>)}</div><p className="local-note">Une carte image, prête à utiliser seule ou dans votre propre carrousel.</p></div>
      <div className="caption-workspace"><span className="eyebrow">L’image donne envie. Les mots racontent.</span><h2>Avec vos mots.</h2><label className="field-label" htmlFor="caption">La légende proposée</label><textarea id="caption" rows={11} value={caption} onChange={event => { setCaption(event.target.value); setNotice('') }} /><button className="button button-outline" onClick={copyCaption} disabled={!caption.trim()}>Copier la légende <Icon name="book" /></button><div className="download-section"><span className="eyebrow">Votre format sélectionné</span><p>{format === 'story' ? 'Story verticale · 9:16' : 'Publication / carrousel · 4:5'}</p><button className="button" onClick={download} disabled={downloading}>{downloading ? 'Préparation…' : 'Télécharger'}<Icon name="download" /></button></div><p className="privacy-note">Vous choisissez ensuite où partager. Aucun compte connecté, aucune publication automatique.</p><div aria-live="polite">{notice && <p className="success-message">{notice}</p>}</div>{error && <p role="alert" className="error-message">{error}</p>}</div>
    </div></section>
}
