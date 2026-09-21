import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { importGooglePhotos, googlePhotosAvailability } from '../google-photos-picker'
import { generateStory, importImage, readTrip, storageKey } from '../journal'
import type { Draft, Media, Trip } from '../journal'
import { createId } from '../id'
import { tripAlbum } from '../trip-media'
import Icon from './Icon'

type PickerLaunch = { url: string; open: () => void }

export default function Creator({ initialDraft, onSave }: { initialDraft?: Draft; onSave: (trip: Trip, draft: Draft) => void }) {
  const [id] = useState(() => initialDraft?.id ?? createId())
  const [title, setTitle] = useState(initialDraft?.title ?? 'Une nouvelle journée aux Philippines')
  const [media, setMedia] = useState<Media[]>(initialDraft?.media ?? [])
  const [coverId, setCoverId] = useState(initialDraft?.coverId ?? '')
  const [memories, setMemories] = useState(initialDraft?.memories ?? '')
  const [tone, setTone] = useState(initialDraft?.tone ?? 'Contemplatif')
  const [story, setStory] = useState(initialDraft?.story ?? '')
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pickerBusy, setPickerBusy] = useState(false)
  const [pickerLaunch, setPickerLaunch] = useState<PickerLaunch>()
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const storyRef = useRef<HTMLTextAreaElement>(null)
  const previewRef = useRef<HTMLElement>(null)
  const pickerAbort = useRef<AbortController | undefined>(undefined)
  const cover = media.find(item => item.id === coverId) ?? media[0]
  const picker = googlePhotosAvailability()

  useEffect(() => () => pickerAbort.current?.abort(), [])

  function changed() {
    setNotice('')
    setError('')
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!files.length) return
    changed()
    if (media.length + files.length > 12) {
      setError('Gardez jusqu’à 12 photos par journée. Retirez-en une avant d’en ajouter d’autres.')
      return
    }
    setBusy(true)
    const results = await Promise.allSettled(files.map(importImage))
    const imported = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : [])
    const errors = results.flatMap(result => result.status === 'rejected' ? [String(result.reason instanceof Error ? result.reason.message : result.reason)] : [])
    setMedia(previous => [...previous, ...imported])
    setCoverId(previous => previous || imported[0]?.id || '')
    setBusy(false)
    if (errors.length) setError(errors.join(' '))
    if (imported.length) setNotice(`${imported.length} photo${imported.length > 1 ? 's' : ''} prête${imported.length > 1 ? 's' : ''} à raconter votre journée.`)
  }

  async function importFromGoogle() {
    if (!picker.enabled || pickerBusy || busy) return
    changed()
    const controller = new AbortController()
    pickerAbort.current = controller
    setPickerBusy(true)
    try {
      const result = await importGooglePhotos({ remaining: 12 - media.length, signal: controller.signal, normalize: importImage, openPicker: waitForPickerOpen })
      if (controller.signal.aborted) return
      setMedia(previous => [...previous, ...result.media])
      setCoverId(previous => previous || result.media[0]?.id || '')
      const skipped = [
        result.videosSkipped ? `${result.videosSkipped} vidéo${result.videosSkipped > 1 ? 's' : ''} non importée${result.videosSkipped > 1 ? 's' : ''}` : '',
        result.capacitySkipped ? `${result.capacitySkipped} photo${result.capacitySkipped > 1 ? 's' : ''} au-delà de la limite de 12` : '',
        result.sizeSkipped ? `${result.sizeSkipped} photo${result.sizeSkipped > 1 ? 's' : ''} indisponible${result.sizeSkipped > 1 ? 's' : ''} ou trop lourde${result.sizeSkipped > 1 ? 's' : ''}` : '',
      ].filter(Boolean)
      if (result.media.length) setNotice(`${result.media.length} photo${result.media.length > 1 ? 's' : ''} importée${result.media.length > 1 ? 's' : ''} depuis Google Photos.${skipped.length ? ` ${skipped.join(' ; ')}.` : ''}`)
      else setNotice(`Aucune nouvelle photo n’a été importée.${skipped.length ? ` ${skipped.join(' ; ')}.` : ''}`)
    } catch (caught) {
      if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : 'Google Photos est indisponible. Réessayez.')
    } finally {
      if (pickerAbort.current === controller) { pickerAbort.current = undefined; setPickerBusy(false) }
    }
  }

  function waitForPickerOpen(url: string, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const abort = () => { setPickerLaunch(undefined); reject(new DOMException('Import annulé.', 'AbortError')) }
      signal.addEventListener('abort', abort, { once: true })
      setPickerLaunch({
        url,
        open: () => {
          signal.removeEventListener('abort', abort)
          setPickerLaunch(undefined)
          resolve()
        },
      })
    })
  }

  function cancelGoogleImport() {
    pickerAbort.current?.abort()
    setNotice('Import Google Photos annulé. Aucune photo n’a été ajoutée.')
  }

  function remove(item: Media) {
    const next = media.filter(photo => photo.id !== item.id)
    setMedia(next)
    if (item.id === coverId) setCoverId(next[0]?.id ?? '')
    changed()
  }

  function move(index: number, direction: -1 | 1) {
    const next = [...media]
    const target = index + direction
    if (target < 0 || target >= media.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setMedia(next)
    changed()
  }

  function generate() {
    changed()
    if (!memories.trim()) {
      setError('Ajoutez un souvenir pour écrire un récit qui vous ressemble.')
      document.getElementById('memories')?.focus()
      return
    }
    setStory(generateStory(memories, tone))
    setPreview(false)
    storyRef.current?.focus()
    setNotice('Votre proposition est prête. Relisez-la et faites-en votre histoire.')
  }

  function showPreview() {
    changed()
    if (!story.trim() || !title.trim()) {
      setError('Donnez un titre à votre journée et écrivez ou générez son récit avant de la prévisualiser.')
      return
    }
    setPreview(true)
    requestAnimationFrame(() => previewRef.current?.focus())
  }

  function save() {
    changed()
    if (!story.trim() || !title.trim()) {
      setError('Le titre et le récit sont nécessaires pour enregistrer la journée.')
      return
    }
    const current = readTrip()
    if (current.error) { setError(current.error); return }
    const draft: Draft = { id, title: title.trim(), memories, tone, story: story.trim(), media, coverId: cover?.id ?? '', status: 'draft' }
    const trip: Trip = { version: 1, drafts: [...current.trip.drafts.filter(item => item.id !== id), draft] }
    try {
      localStorage.setItem(storageKey, JSON.stringify(trip))
    } catch {
      setError('L’enregistrement n’a pas abouti : le stockage est plein ou indisponible. Retirez quelques photos puis réessayez. Votre travail reste ouvert ici.')
      return
    }
    onSave(trip, draft)
  }

  return <section className="creator page-width" data-testid="creator">
    <header className="workspace-heading"><p className="eyebrow">L’atelier du soir <span className="divider">/</span> Créer une journée</p><h1>Les instants passent.<br /><em>Écrivons la suite.</em></h1><p>Vos photos, vos mots. Dix minutes pour ne rien oublier.</p><span className="privacy-note"><Icon name="check" /> Vos choix sont copiés dans le carnet, jamais publiés.</span></header>
    <div className="creator-layout"><div className="media-workspace"><div className="step-heading"><span>01</span><div><h2>Les images du jour</h2><p>Choisissez celles qui racontent vraiment.</p></div></div>
      <aside className="trip-source" aria-labelledby="trip-source-title"><p className="eyebrow">L’album commun</p><h3 id="trip-source-title">{tripAlbum.title}</h3><p>Les deux téléphones, le drone et les appareils photo s’y retrouvent. Ouvrez-le pour vérifier que les souvenirs du jour sont bien réunis.</p><a href={tripAlbum.url} target="_blank" rel="noopener noreferrer">Ouvrir l’album <span aria-hidden="true">↗</span></a></aside>
      <div className="google-import" aria-labelledby="google-import-title"><div><p className="eyebrow">Photos choisies, seulement</p><h3 id="google-import-title">Votre sélection Google Photos</h3><p>Choisissez les images de cette journée. Elles seront préparées localement pour le carnet, sans publication.</p></div><div className="google-import-actions"><button className="button button-outline" onClick={pickerBusy ? cancelGoogleImport : importFromGoogle} disabled={busy || (!picker.enabled && !pickerBusy)}>{pickerBusy ? 'Annuler l’import Google Photos' : 'Choisir dans Google Photos'}</button>{pickerLaunch && <a className="button" href={pickerLaunch.url} target="_blank" rel="noopener noreferrer" onClick={pickerLaunch.open}>Ouvrir Google Photos pour choisir</a>}{!picker.enabled && <p className="local-note">{picker.reason === 'insecure-context' ? 'La connexion Google nécessite l’adresse sécurisée. L’album et l’import depuis cet appareil restent disponibles ici.' : 'La connexion sécurisée Google Photos reste à activer. En attendant, ouvrez l’album puis importez depuis cet appareil.'}</p>}</div></div>
      <label className={`upload-zone ${busy ? 'is-busy' : ''}`}><Icon name="upload" /><strong>{busy ? 'Préparation des photos…' : 'Déposez vos souvenirs ici'}</strong><span>Choisir des photos sur cet appareil</span><small>JPEG, PNG, WebP, GIF, AVIF · 12 photos maximum<br />12 Mo par photo · optimisées pour le carnet</small><input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,image/avif" aria-label="Importer des photos" onChange={upload} disabled={busy || pickerBusy} /></label>
      <div className="media-grid">{media.map((item, index) => <article className={`media-item ${cover?.id === item.id ? 'is-cover' : ''}`} data-testid="media-item" key={item.id}><div className="media-photo"><img src={item.src} alt={`Photo importée : ${item.name}`} /><span className="media-number">{String(index + 1).padStart(2, '0')}</span><button className="remove-media" onClick={() => remove(item)} aria-label={`Supprimer ${item.name}`}><Icon name="close" /></button></div><div className="media-controls"><button className="cover-button" aria-pressed={cover?.id === item.id} onClick={() => { setCoverId(item.id); changed() }}>{cover?.id === item.id ? <><Icon name="check" /> Couverture</> : 'Choisir en couverture'}</button><div><button aria-label={`Déplacer ${item.name} vers le précédent`} disabled={index === 0} onClick={() => move(index, -1)}><Icon name="left" /></button><button aria-label={`Déplacer ${item.name} vers le suivant`} disabled={index === media.length - 1} onClick={() => move(index, 1)}><Icon name="arrow" /></button></div></div></article>)}</div>
      {media.length > 0 && <p className="local-note">La couverture ouvre votre chapitre. Les flèches composent l’ordre de votre album.</p>}
      <div className="editor-note"><span className="eyebrow">Un petit conseil</span><p>La meilleure photo n’est pas toujours la plus belle.<br /><em>C’est celle qui vous ramène là-bas.</em></p></div>
    </div><div className="writing-workspace"><div className="step-heading"><span>02</span><div><h2>Les mots pour le dire</h2><p>On commence par ce qui vous revient.</p></div></div>
      <label className="field-label" htmlFor="day-title">Le titre de votre journée</label><input id="day-title" value={title} maxLength={120} onChange={event => { setTitle(event.target.value); changed() }} />
      <label className="field-label" htmlFor="memories">Souvenirs de la journée</label><input id="memories" value={memories} maxLength={4000} onChange={event => { setMemories(event.target.value); changed() }} aria-describedby="memories-hint" /><p className="field-hint" id="memories-hint">Un lieu, un goût, une anecdote… Quelques mots suffisent.</p>
      <fieldset className="tone-field"><legend>Quelle couleur donner aux mots ?</legend><div>{['Contemplatif', 'Aventure', 'Spontané'].map(option => <label key={option} className={tone === option ? 'selected' : ''}><input type="radio" name="tone" value={option} checked={tone === option} onChange={() => { setTone(option); changed() }} />{option}</label>)}</div></fieldset>
      <button className="button generate-button" onClick={generate}>Générer le récit <Icon name="arrow" /></button><p className="field-hint">Une proposition locale à partir de vos souvenirs, sans IA distante. Vous gardez le dernier mot.</p>
      <label className="field-label story-label" htmlFor="story">Votre récit, à votre façon</label><textarea ref={storyRef} id="story" rows={10} value={story} onChange={event => { setStory(event.target.value); changed() }} aria-describedby="story-hint" /><p className="field-hint" id="story-hint">Chaque phrase est modifiable. Vous pouvez aussi tout écrire vous-même.</p>
      <div className="editor-actions"><button className="button button-outline" onClick={showPreview}>Prévisualiser <Icon name="book" /></button><span className="local-note">Rien n’est enregistré avant votre validation.</span></div>
    </div></div>
    <div className="feedback" role="status" aria-live="polite">{busy && <p>Préparation en cours…</p>}{pickerBusy && <p>Connexion à Google Photos en cours…</p>}{notice && <p className="success-message"><Icon name="check" />{notice}</p>}</div>{error && <p role="alert" className="error-message">{error}</p>}
    {preview && <section className="day-preview" data-testid="day-preview" tabIndex={-1} ref={previewRef}><div className="preview-ribbon"><span className="eyebrow">03 / Votre nouvelle page</span><span className="status draft"><i />Brouillon</span></div>{cover && <img className="preview-cover" src={cover.src} alt={`Couverture : ${cover.name}`} />}<div className="preview-prose"><p className="eyebrow">Philippines · Carnet personnel</p><h2>{title}</h2>{story.split('\n').filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>{media.length > 1 && <div className="preview-album">{media.filter(item => item.id !== cover?.id).map(item => <img key={item.id} src={item.src} alt={`Souvenir : ${item.name}`} />)}</div>}<div className="save-bar"><span>Une page de plus.<br /><small>Enregistrée en brouillon, jamais publiée.</small></span><button className="button" onClick={save} disabled={busy || pickerBusy}>Ajouter au voyage <Icon name="plus" /></button></div></section>}
  </section>
}
