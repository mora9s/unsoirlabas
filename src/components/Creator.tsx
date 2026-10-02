import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { importGooglePhotos, googlePhotosAvailability } from '../google-photos-picker'
import { generateStory, importImage, readTrip, storageKey } from '../journal'
import type { Draft, Media, PlannedStepLink, Trip } from '../journal'
import { createId } from '../id'
import { discardUnsavedChapter, readUnsavedChapter, writeUnsavedChapter } from '../unsaved-chapters'
import { tripAlbum } from '../trip-media'
import { cleanupOrphanedMediaUnlocked, persistDraftMediaUnlocked, storedDraft, withMediaDurabilityLock } from '../media-store'
import Icon from './Icon'
import VoiceNarration from './VoiceNarration'

declare const __VOICE_PRIVATE_BUILD__: boolean
declare const __GOOGLE_PHOTOS_PUBLIC_BUILD__: boolean

type PickerLaunch = { url: string; open: () => void }

export default function Creator({ initialDraft, onSave, localStore = true, recoveryScope = 'personal:new', personalDestination, firstChapter = false, plannedStep }: { initialDraft?: Draft; onSave: (trip: Trip, draft: Draft) => void | Promise<void>; localStore?: boolean; recoveryScope?: string; personalDestination?: string; firstChapter?: boolean; plannedStep?: PlannedStepLink }) {
  const [id, setId] = useState(() => initialDraft?.id ?? createId())
  const [recovery] = useState(() => readUnsavedChapter(recoveryScope))
  const [recoveryPending, setRecoveryPending] = useState(Boolean(recovery.draft))
  const [changedSinceOpen, setChangedSinceOpen] = useState(false)
  const [title, setTitle] = useState(initialDraft?.title ?? (plannedStep ? plannedStep.place.slice(0, 120) : personalDestination ? `Une nouvelle journée à ${personalDestination}` : 'Une nouvelle journée aux Philippines'))
  const plannedLink = initialDraft?.plannedStep ?? plannedStep
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
  const [showVoice, setShowVoice] = useState(false)
  const [ritualMode, setRitualMode] = useState(firstChapter && Boolean(personalDestination))
  const [ritualStep, setRitualStep] = useState<'choose' | 'voice' | 'text' | 'review'>('choose')
  const photoLimit = ritualMode && firstChapter ? 3 : 12
  const [online, setOnline] = useState(() => navigator.onLine)
  const [error, setError] = useState(recovery.error)
  const storyRef = useRef<HTMLTextAreaElement>(null)
  const previewRef = useRef<HTMLElement>(null)
  const pickerAbort = useRef<AbortController | undefined>(undefined)
  const cover = media.find(item => item.id === coverId) ?? media[0]
  const picker = googlePhotosAvailability()

  useEffect(() => () => pickerAbort.current?.abort(), [])

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine)
    window.addEventListener('online', updateOnline)
    window.addEventListener('offline', updateOnline)
    return () => { window.removeEventListener('online', updateOnline); window.removeEventListener('offline', updateOnline) }
  }, [])

  useEffect(() => {
    if (!changedSinceOpen || recoveryPending) return
    const draft: Draft = { id, title: title.trim(), memories, tone, story, media, coverId: cover?.id ?? '', status: 'draft', ...(plannedLink ? { plannedStep: plannedLink } : {}) }
    let active = true
    // Persist the latest editor snapshot after React applies each field update.
    // oxlint-disable-next-line react/set-state-in-effect -- status reflects localStorage quota/corruption result
    void writeUnsavedChapter(recoveryScope, draft).then(failure => { if (active) setError(failure || recovery.error) })
    return () => { active = false }
  }, [changedSinceOpen, recoveryPending, id, title, memories, tone, story, media, cover, coverId, plannedLink, recoveryScope, recovery.error])

  function changed() {
    setChangedSinceOpen(true)
    setNotice('')
    setError('')
  }

  function resumeRecovery() {
    const draft = recovery.draft
    if (!draft) return
    setId(draft.id)
    setTitle(draft.title)
    setMemories(draft.memories)
    setTone(draft.tone)
    setStory(draft.story)
    setMedia(draft.media)
    setCoverId(draft.coverId)
    setRecoveryPending(false)
    setRitualMode(false)
    setNotice('Votre brouillon a été repris. Les modifications enregistrées précédemment restent distinctes jusqu’à votre validation.')
  }

  async function discardRecovery() {
    const failure = await discardUnsavedChapter(recoveryScope)
    if (failure) { setError(failure); return }
    setRecoveryPending(false)
    setChangedSinceOpen(false)
    setError(recovery.error)
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!files.length || busy || pickerBusy) return
    setNotice('')
    setError('')
    const capacity = Math.max(0, photoLimit - media.length)
    if (!capacity) { setError(`Ce chapitre peut contenir jusqu’à ${photoLimit} photos.`); return }
    const acceptedFiles = files.slice(0, capacity)
    setBusy(true)
    try {
      const results = await Promise.allSettled(acceptedFiles.map(importImage))
      const imported = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : [])
      const errors = results.flatMap(result => result.status === 'rejected' ? [String(result.reason instanceof Error ? result.reason.message : result.reason)] : [])
      setMedia(previous => [...previous, ...imported])
      if (imported.length) setChangedSinceOpen(true)
      setCoverId(previous => previous || imported[0]?.id || '')
      if (errors.length) setError(errors.join(' '))
      if (files.length > acceptedFiles.length) setNotice(`${imported.length} photo${imported.length === 1 ? '' : 's'} ajoutée${imported.length === 1 ? '' : 's'} ; la limite de ${photoLimit} est atteinte.`)
      else if (imported.length) setNotice(`${imported.length} photo${imported.length > 1 ? 's' : ''} prête${imported.length > 1 ? 's' : ''} à raconter votre journée.`)
    } finally { setBusy(false) }
  }

  async function importFromGoogle() {
    if (!picker.enabled || pickerBusy || busy) return
    setNotice('')
    setError('')
    const controller = new AbortController()
    pickerAbort.current = controller
    setPickerBusy(true)
    try {
      const result = await importGooglePhotos({ remaining: Math.max(0, photoLimit - media.length), signal: controller.signal, normalize: importImage, openPicker: waitForPickerOpen })
      if (controller.signal.aborted) return
      setMedia(previous => [...previous, ...result.media])
      if (result.media.length) setChangedSinceOpen(true)
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
    setStory(generateStory(memories, tone, Boolean(personalDestination)))
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

  async function save() {
    if (busy || pickerBusy) return
    changed()
    if (!story.trim() || !title.trim()) {
      setError('Le titre et le récit sont nécessaires pour enregistrer la journée.')
      return
    }
    const draft: Draft = { id, title: title.trim(), memories, tone, story: story.trim(), media, coverId: cover?.id ?? '', status: 'draft', ...(plannedLink ? { plannedStep: plannedLink } : {}) }
    let durableDraft: Draft = draft
    let trip: Trip = { version: 1, drafts: [] }
    setBusy(true)
    if (localStore) {
      try {
        trip = await withMediaDurabilityLock(async () => {
          const before = readTrip()
          if (before.error) throw new Error(before.error)
          durableDraft = await persistDraftMediaUnlocked(draft)
          // Re-read after IndexedDB work so an older tab cannot overwrite a concurrent save.
          const current = readTrip()
          if (current.error) throw new Error(current.error)
          const next: Trip = { version: 1, drafts: [...current.trip.drafts.filter(item => item.id !== id), durableDraft] }
          localStorage.setItem(storageKey, JSON.stringify({ ...next, drafts: next.drafts.map(storedDraft) }))
          await cleanupOrphanedMediaUnlocked()
          return next
        })
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Les photos ne peuvent pas être enregistrées dans le stockage durable.')
        setBusy(false)
        return
      }
    }
    try {
      await onSave(trip, durableDraft)
      const cleanupError = await discardUnsavedChapter(recoveryScope)
      if (cleanupError) setError(cleanupError)
    }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Impossible d’enregistrer ce chapitre. Vos données restent ouvertes ici.') }
    finally { setBusy(false) }
  }

  if (ritualMode && !(recoveryPending && recovery.draft)) return <section className="creator page-width evening-ritual" data-testid="creator" aria-labelledby="evening-ritual-title">
    <header className="workspace-heading"><p className="eyebrow">Carnet personnel · {personalDestination}</p><h1 id="evening-ritual-title">Le rituel du soir</h1><p>Un souvenir suffit. Racontez-le ou écrivez quelques lignes, puis choisissez vos photos.</p>{plannedLink && <p className="local-note" data-testid="planned-step-context">Étape prévue · {plannedLink.place}. Ce lien situe le chapitre ; il ne raconte pas la journée.</p>}<p className="local-note">Aucune date ni aucun détail ne seront ajoutés à votre récit. Vous relisez et acceptez avant l’enregistrement.</p></header>
    <div className="ritual-photos"><p className="eyebrow">Vos images · jusqu’à {photoLimit}</p><label className="upload-zone"><Icon name="upload" /><strong>{busy ? 'Préparation des photos…' : 'Choisir quelques photos'}</strong><span>Depuis cet appareil</span><small>{media.length} / {photoLimit} photo{photoLimit > 1 ? 's' : ''} · conservées dans ce carnet privé</small><input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,image/avif" aria-label={`Ajouter jusqu’à ${photoLimit} photos`} onChange={upload} disabled={busy || media.length >= photoLimit} /></label>
      <div className="media-grid">{media.map(item => <article className="media-item ritual-photo" data-testid="ritual-photo" key={item.id}><div className="media-photo"><img src={item.src} alt={`Photo choisie : ${item.name}`} /><button className="remove-media" onClick={() => remove(item)} aria-label={`Supprimer ${item.name}`}><Icon name="close" /></button></div></article>)}</div>
      {picker.enabled && <button className="button button-outline" onClick={() => void importFromGoogle()} disabled={busy || pickerBusy || media.length >= photoLimit}>Choisir depuis Google Photos</button>}
    </div>
    {ritualStep === 'choose' && <div className="ritual-choices">{__VOICE_PRIVATE_BUILD__ && <button className="button" onClick={() => setRitualStep('voice')}>Raconter à voix haute</button>}<button className="button button-outline" onClick={() => setRitualStep('text')}>Écrire quelques lignes</button>{__VOICE_PRIVATE_BUILD__ && <p className="field-hint">La voix utilise le service privé existant si disponible. Sinon, continuez simplement par écrit, même hors ligne.</p>}</div>}
    {__VOICE_PRIVATE_BUILD__ && ritualStep === 'voice' && <div className="ritual-editor"><VoiceNarration scopeId={personalDestination ? recoveryScope : undefined} onAccept={(nextTitle, nextMemories, nextStory) => { setTitle(nextTitle.trim() || 'Une journée'); setMemories(nextMemories); setStory(nextStory); setRitualStep('review'); setNotice('Votre proposition est prête à relire. Rien n’est enregistré avant votre acceptation.'); setError('') }} /><div className="editor-actions"><button className="button button-outline" onClick={() => setRitualStep('text')}>Écrire quelques lignes</button><button className="text-button" onClick={() => setRitualStep('choose')}>Retour</button></div></div>}
    {ritualStep === 'text' && <div className="ritual-editor"><label className="field-label" htmlFor="ritual-text">Quelques mots sur votre journée</label><textarea id="ritual-text" aria-label="Votre texte du soir" rows={5} maxLength={4000} value={memories} onChange={event => { setMemories(event.target.value); setStory(event.target.value); changed() }} placeholder="Écrivez seulement ce dont vous vous souvenez." /><p className="field-hint">Ce texte reste local. Aucun lieu, aucune date et aucun souvenir ne seront devinés.</p><div className="editor-actions"><button className="button" onClick={() => { if (!memories.trim()) { setError('Écrivez quelques mots avant de continuer.'); return }; if (!title.trim()) setTitle('Une journée'); setStory(memories.trim()); setError(''); setRitualStep('review') }}>Relire la proposition</button><button className="text-button" onClick={() => setRitualStep('choose')}>Retour</button></div></div>}
    {ritualStep === 'review' && <section className="ritual-review" data-testid="ritual-review" aria-labelledby="ritual-review-title"><p className="eyebrow">À relire avant d’accepter</p><h2 id="ritual-review-title">Votre proposition</h2><label className="field-label" htmlFor="ritual-title">Titre</label><input id="ritual-title" value={title} maxLength={120} onChange={event => { setTitle(event.target.value); changed() }} /><label className="field-label" htmlFor="ritual-story">Votre récit</label><textarea id="ritual-story" aria-label="Votre récit relu" rows={7} value={story} onChange={event => { setStory(event.target.value); setMemories(event.target.value); changed() }} /><div className="editor-actions"><button className="button" onClick={() => void save()} disabled={busy || pickerBusy}>Accepter et enregistrer dans {personalDestination}</button><button className="button button-outline" onClick={() => setRitualStep('text')}>Modifier</button></div><p className="field-hint">La proposition reste modifiable. L’enregistrement est explicite et ne publie rien.</p></section>}
    <div className="feedback" role="status" aria-live="polite">{!online && <p>Hors ligne : le texte et les photos restent disponibles sur cet appareil. La voix distante peut attendre le retour du service.</p>}{busy && <p>Enregistrement en cours…</p>}{notice && <p className="success-message"><Icon name="check" />{notice}</p>}</div>{error && <p role="alert" className="error-message">{error}</p>}
    <button className="text-button ritual-workshop-link" onClick={() => setRitualMode(false)}>Ouvrir l’atelier complet</button>
  </section>

  if (recoveryPending && recovery.draft) return <section className="workspace-heading page-width recovery-page" data-testid="chapter-recovery" aria-labelledby="chapter-recovery-title">
    <p className="eyebrow">Brouillon local · non enregistré</p><h1 id="chapter-recovery-title">Reprendre votre chapitre ?</h1>
    <p><strong>{recovery.draft.title || 'Chapitre sans titre'}</strong> — ce travail n’a pas remplacé une page déjà enregistrée. Reprenez-le pour continuer, ou abandonnez-le explicitement.</p>
    <div className="recovery-actions"><button className="button" onClick={resumeRecovery}>Reprendre le chapitre</button><button className="button button-outline" onClick={discardRecovery}>Abandonner ce brouillon</button></div>
    {recovery.error && <p role="alert" className="error-message">{recovery.error}</p>}
  </section>

  return <section className="creator page-width" data-testid="creator">
    <header className="workspace-heading"><p className="eyebrow">L’atelier du soir <span className="divider">/</span> Créer une journée</p><h1>Les instants passent.<br /><em>Écrivons la suite.</em></h1><p>Vos photos, vos mots. Dix minutes pour ne rien oublier.</p><span className="privacy-note"><Icon name="check" /> Vos choix sont copiés dans le carnet, jamais publiés.</span>{personalDestination && <p className="local-note">Carnet de {personalDestination} sélectionné. Rien n’est enregistré avant votre validation.</p>}</header>
    <div className="creator-layout"><div className="media-workspace"><div className="step-heading"><span>01</span><div><h2>Les images du jour</h2><p>Choisissez celles qui racontent vraiment.</p></div></div>
      {!personalDestination && <aside className="trip-source" aria-labelledby="trip-source-title"><p className="eyebrow">L’album commun</p><h3 id="trip-source-title">{tripAlbum.title}</h3><p>Les deux téléphones, le drone et les appareils photo s’y retrouvent. Ouvrez-le pour vérifier que les souvenirs du jour sont bien réunis.</p><a href={tripAlbum.url} target="_blank" rel="noopener noreferrer">Ouvrir l’album <span aria-hidden="true">↗</span></a></aside>}
      {__GOOGLE_PHOTOS_PUBLIC_BUILD__ && !picker.enabled && picker.reason === 'missing-client-id' ? <div className="google-import" role="note"><div><p className="eyebrow">Souvenirs du jour</p><h3>Ajoutez vos photos au carnet</h3><p>Le sélecteur Google Photos n’est pas configuré sur cette version publique. {personalDestination ? 'Importez vos images depuis cet appareil.' : 'Ouvrez l’album commun ci-dessus pour retrouver vos images, ou importez-les directement depuis cet appareil.'}</p></div></div> : <div className="google-import" aria-labelledby="google-import-title"><div><p className="eyebrow">Photos choisies, seulement</p><h3 id="google-import-title">Votre sélection Google Photos</h3><p>Choisissez les images de cette journée. Elles seront préparées localement pour le carnet, sans publication.</p></div><div className="google-import-actions"><button className="button button-outline" onClick={pickerBusy ? cancelGoogleImport : importFromGoogle} disabled={busy || (!picker.enabled && !pickerBusy)}>{pickerBusy ? 'Annuler l’import Google Photos' : 'Choisir dans Google Photos'}</button>{pickerLaunch && <a className="button" href={pickerLaunch.url} target="_blank" rel="noopener noreferrer" onClick={pickerLaunch.open}>Ouvrir Google Photos pour choisir</a>}{!picker.enabled && <p className="local-note">{picker.reason === 'insecure-context' ? 'La connexion Google nécessite l’adresse sécurisée. Importez les images depuis cet appareil.' : personalDestination ? 'La connexion sécurisée Google Photos reste à activer. En attendant, importez depuis cet appareil.' : 'La connexion sécurisée Google Photos reste à activer. En attendant, ouvrez l’album puis importez depuis cet appareil.'}</p>}</div></div>}
      <label className={`upload-zone ${busy ? 'is-busy' : ''}`}><Icon name="upload" /><strong>{busy ? 'Préparation des photos…' : 'Déposez vos souvenirs ici'}</strong><span>Choisir des photos sur cet appareil</span><small>JPEG, PNG, WebP, GIF, AVIF · {photoLimit} photo{photoLimit > 1 ? 's' : ''} maximum<br />12 Mo par photo · optimisées pour le carnet</small><input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,image/avif" aria-label="Importer des photos" onChange={upload} disabled={busy || pickerBusy} /></label>
      <div className="media-grid">{media.map((item, index) => <article className={`media-item ${cover?.id === item.id ? 'is-cover' : ''}`} data-testid="media-item" key={item.id}><div className="media-photo"><img src={item.src} alt={`Photo importée : ${item.name}`} /><span className="media-number">{String(index + 1).padStart(2, '0')}</span><button className="remove-media" onClick={() => remove(item)} aria-label={`Supprimer ${item.name}`}><Icon name="close" /></button></div><div className="media-controls"><button className="cover-button" aria-pressed={cover?.id === item.id} onClick={() => { setCoverId(item.id); changed() }}>{cover?.id === item.id ? <><Icon name="check" /> Couverture</> : 'Choisir en couverture'}</button><div><button aria-label={`Déplacer ${item.name} vers le précédent`} disabled={index === 0} onClick={() => move(index, -1)}><Icon name="left" /></button><button aria-label={`Déplacer ${item.name} vers le suivant`} disabled={index === media.length - 1} onClick={() => move(index, 1)}><Icon name="arrow" /></button></div></div></article>)}</div>
      {media.length > 0 && <p className="local-note">La couverture ouvre votre chapitre. Les flèches composent l’ordre de votre album.</p>}
      <div className="editor-note"><span className="eyebrow">Un petit conseil</span><p>La meilleure photo n’est pas toujours la plus belle.<br /><em>C’est celle qui vous ramène là-bas.</em></p></div>
    </div><div className="writing-workspace"><div className="step-heading"><span>02</span><div><h2>Les mots pour le dire</h2><p>On commence par ce qui vous revient.</p></div></div>
      <label className="field-label" htmlFor="day-title">Le titre de votre journée</label><input id="day-title" value={title} maxLength={120} onChange={event => { setTitle(event.target.value); changed() }} />
      {plannedLink && <p className="local-note" data-testid="planned-step-context">Étape prévue · {plannedLink.place}. Ce lien situe le chapitre ; il ne raconte pas la journée.</p>}
      {!__VOICE_PRIVATE_BUILD__ ? <div className="voice-entry-card voice-unavailable" role="note"><span className="eyebrow">Voix · Accès privé</span><strong>Votre histoire, à votre façon</strong><small>Le récit vocal est réservé à l’accès privé pour le moment. Écrivez vos souvenirs ci-dessous pour créer votre page ici.</small></div> : showVoice ? <VoiceNarration scopeId={personalDestination ? recoveryScope : undefined} onAccept={(nextTitle, nextMemories, nextStory) => { setTitle(nextTitle); setMemories(nextMemories); setStory(nextStory); setPreview(false); setNotice('Le récit a rempli l’éditeur. Relisez-le : rien n’est enregistré ni publié.'); setChangedSinceOpen(true); setError('') }} /> : <button className="voice-entry-card" type="button" onClick={() => setShowVoice(true)}><span className="eyebrow">Voix · Premium local</span><strong>Commencer le récit du soir</strong><small>Enregistrez ou importez un audio, puis relisez chaque preuve avant d’utiliser le récit.</small></button>}
      <label className="field-label" htmlFor="memories">Souvenirs de la journée</label><input id="memories" value={memories} maxLength={4000} onChange={event => { setMemories(event.target.value); changed() }} aria-describedby="memories-hint" /><p className="field-hint" id="memories-hint">Un lieu, un goût, une anecdote… Quelques mots suffisent.</p>
      <fieldset className="tone-field"><legend>Quelle couleur donner aux mots ?</legend><div>{['Contemplatif', 'Aventure', 'Spontané'].map(option => <label key={option} className={tone === option ? 'selected' : ''}><input type="radio" name="tone" value={option} checked={tone === option} onChange={() => { setTone(option); changed() }} />{option}</label>)}</div></fieldset>
      <button className="button generate-button" onClick={generate}>Générer le récit <Icon name="arrow" /></button><p className="field-hint">Une proposition locale à partir de vos souvenirs, sans IA distante. Vous gardez le dernier mot.</p>
      <label className="field-label story-label" htmlFor="story">Votre récit, à votre façon</label><textarea ref={storyRef} id="story" rows={10} value={story} onChange={event => { setStory(event.target.value); changed() }} aria-describedby="story-hint" /><p className="field-hint" id="story-hint">Chaque phrase est modifiable. Vous pouvez aussi tout écrire vous-même.</p>
      <div className="editor-actions"><button className="button button-outline" onClick={showPreview}>Prévisualiser <Icon name="book" /></button><span className="local-note">Rien n’est enregistré avant votre validation.</span></div>
    </div></div>
    <div className="feedback" role="status" aria-live="polite">{!online && <p>Hors ligne : la transcription et le récit vocal ne sont pas garantis. La saisie manuelle et la proposition locale restent disponibles.</p>}{busy && <p>Préparation en cours…</p>}{pickerBusy && <p>Connexion à Google Photos en cours…</p>}{notice && <p className="success-message"><Icon name="check" />{notice}</p>}</div>{error && <p role="alert" className="error-message">{error}</p>}
    {preview && <section className="day-preview" data-testid="day-preview" tabIndex={-1} ref={previewRef}><div className="preview-ribbon"><span className="eyebrow">03 / Votre nouvelle page</span><span className="status draft"><i />Brouillon</span></div>{cover && <img className="preview-cover" src={cover.src} alt={`Couverture : ${cover.name}`} />}<div className="preview-prose"><p className="eyebrow">{personalDestination ? `${personalDestination} · Carnet personnel` : 'Philippines · Carnet personnel'}</p><h2>{title}</h2>{story.split('\n').filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>{media.length > 1 && <div className="preview-album">{media.filter(item => item.id !== cover?.id).map(item => <img key={item.id} src={item.src} alt={`Souvenir : ${item.name}`} />)}</div>}<div className="save-bar"><span>Une page de plus.<br /><small>Enregistrée après validation, jamais publiée.</small></span><button className="button" onClick={save} disabled={busy || pickerBusy}>Ajouter au voyage <Icon name="plus" /></button></div></section>}
  </section>
}
