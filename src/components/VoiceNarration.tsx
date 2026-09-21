import { useEffect, useRef, useState } from 'react'
import { createId } from '../id'
import { appendChunk, assembleVoice, beginVoice, createVoiceRecord, deleteVoice, extensionForMime, loadActiveVoice, replaceWithBlob, saveVoice, storageWarning, supportedRecorderMime, voiceHeaders } from '../voice'
import type { Segment, VoiceRecord } from '../voice'

type Props = { onAccept: (title: string, memories: string, story: string) => void }
const MAX_BYTES = 64 * 1024 * 1024
const MAX_DURATION = 5 * 60_000
const AUDIO_TYPES = /^audio\/(mp4|webm|ogg|mpeg|wav|x-wav)$/

function timestamp(seconds: number) { const value = Math.max(0, Math.floor(seconds)); return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}` }
function isTerminal(status?: string) { return status === 'completed' || status === 'failed' || status === 'retryable' || status === 'cancelled' }

export default function VoiceNarration({ onAccept }: Props) {
  const [record, setRecord] = useState<VoiceRecord>()
  const [message, setMessage] = useState('')
  const [interrupted, setInterrupted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [recorderState, setRecorderState] = useState<'inactive' | 'recording' | 'paused'>('inactive')
  const recorder = useRef<MediaRecorder | undefined>(undefined)
  const timer = useRef<number | undefined>(undefined)
  const current = useRef<VoiceRecord | undefined>(undefined)
  const generation = useRef(0)
  const controller = useRef<AbortController | undefined>(undefined)
  const retryRef = useRef<() => void>(() => {})
  const writeChain = useRef<Promise<void>>(Promise.resolve())
  const pendingWrites = useRef(0)

  const commit = async (next: VoiceRecord) => {
    current.current = next
    setRecord(next)
    sessionStorage.setItem('un-soir-voice-session', next.id)
    pendingWrites.current += 1
    setSaving(true)
    const write = writeChain.current.then(() => saveVoice(next))
    writeChain.current = write.catch(() => undefined)
    try {
      await write
    } finally {
      pendingWrites.current -= 1
      if (pendingWrites.current === 0) setSaving(false)
    }
  }
  const invalidate = () => { generation.current += 1; controller.current?.abort(); controller.current = undefined }
  const valid = (id: string, revision: number, token: number) => current.current?.id === id && current.current?.revision === revision && generation.current === token

  useEffect(() => {
    let alive = true
    void (async () => {
      const saved = await loadActiveVoice().catch(() => undefined)
      if (!alive || !saved) return
      current.current = saved; setRecord(saved)
      if (saved.status === 'recording' || saved.status === 'saving') { setInterrupted(true); setMessage('Enregistrement interrompu : l’audio disponible n’est pas encore marqué complet.') }
    })()
    const retry = () => retryRef.current()
    window.addEventListener('online', retry)
    return () => { alive = false; invalidate(); window.removeEventListener('online', retry); if (timer.current) clearTimeout(timer.current); recorder.current?.stream.getTracks().forEach(track => track.stop()) }
  }, [])

  async function importAudio(file?: File) {
    if (!file) return
    invalidate()
    if (!AUDIO_TYPES.test(file.type)) { setMessage('Ce fichier audio n’est pas pris en charge. Importez WebM, OGG, MP3, MP4 ou WAV.'); return }
    if (file.size > MAX_BYTES) { setMessage('Le fichier dépasse la limite de 64 MiB.'); return }
    await cancelJob(current.current)
    const next = createVoiceRecord({ id: createId(), name: file.name, mime: file.type, size: file.size, status: 'device-only', complete: true })
    await beginVoice(next); await replaceWithBlob(next, file)
    await commit(next); setInterrupted(false)
    setMessage((await storageWarning()) || 'Audio conservé sur cet appareil. Il ne sera envoyé qu’à votre demande.')
  }

  async function start() {
    invalidate(); setMessage('')
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { setMessage('L’enregistrement audio n’est pas pris en charge ici. Importez un fichier audio.'); return }
    try {
      await cancelJob(current.current)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = supportedRecorderMime()
      if (!mime) { stream.getTracks().forEach(track => track.stop()); setMessage('Aucun format d’enregistrement compatible. Importez un fichier audio.'); return }
      const next = createVoiceRecord({ id: createId(), name: `recit-du-soir.${extensionForMime(mime)}`, mime, status: 'recording', complete: false })
      await beginVoice(next)
      current.current = next; setRecord(next)
      let bytes = 0; let index = 0; let stopping = false; let chunkFailure = false
      const chunkWrites: Promise<void>[] = []
      const value = new MediaRecorder(stream, { mimeType: mime })
      recorder.current = value
      value.ondataavailable = event => {
        if (!event.data.size || stopping) return
        if (bytes + event.data.size > MAX_BYTES) {
          stopping = true
          setMessage('Limite de 64 MiB atteinte : arrêt et sauvegarde des fragments déjà reçus.')
          if (value.state !== 'inactive') value.stop()
          return
        }
        bytes += event.data.size
        const write = appendChunk(next.id, index++, event.data).then(() => {
          if (bytes >= MAX_BYTES && value.state !== 'inactive') { stopping = true; setMessage('Limite de 64 MiB atteinte : arrêt et sauvegarde de l’audio disponible.'); value.stop() }
        }).catch(() => { chunkFailure = true; stopping = true; setMessage('La sauvegarde du fragment a échoué : arrêt de l’enregistrement.'); value.stop() })
        chunkWrites.push(write)
      }
      value.onstop = () => { void (async () => {
        if (timer.current) clearTimeout(timer.current)
        stream.getTracks().forEach(track => track.stop()); setRecorderState('inactive')
        await Promise.all(chunkWrites)
        const final = { ...next, status: 'saving' as const, size: bytes }
        if (current.current?.id !== next.id) return
        await commit(final)
        const complete = { ...final, status: 'device-only' as const, complete: !chunkFailure && bytes > 0 }
        await commit(complete)
        setMessage(chunkFailure ? 'Audio incomplet conservé : un fragment n’a pas pu être sauvegardé.' : bytes ? 'Audio conservé sur cet appareil. Il est complet et prêt à être envoyé.' : 'Aucun fragment audio n’a été enregistré.')
      })() }
      value.start(1000); setRecorderState('recording')
      timer.current = window.setTimeout(() => { if (value.state !== 'inactive') { setMessage('Limite de 5 minutes atteinte : arrêt et sauvegarde de l’audio disponible.'); value.stop() } }, MAX_DURATION)
      const warning = await storageWarning()
      if (warning) setMessage(warning); else setMessage('Enregistrement en cours. Les fragments sont sauvegardés chaque seconde sur cet appareil.')
    } catch (error) { setMessage(error instanceof DOMException && error.name === 'NotAllowedError' ? 'L’autorisation du microphone a été refusée. Vous pouvez importer un fichier audio.' : 'Le microphone est indisponible. Vous pouvez importer un fichier audio.') }
  }
  function pause() { if (recorder.current?.state === 'recording') { recorder.current.pause(); setRecorderState('paused'); setMessage('Enregistrement en pause. Les fragments déjà reçus sont conservés.') } }
  function resume() { if (recorder.current?.state === 'paused') { recorder.current.resume(); setRecorderState('recording'); setMessage('Enregistrement repris.') } }
  function stop() { recorder.current?.stop() }
  async function recover() { if (!record) return; const blob = await assembleVoice(record); const next = { ...record, size: blob.size, status: 'device-only' as const, complete: false, revision: record.revision + 1 }; await commit(next); setInterrupted(false); setMessage('Audio récupéré, mais marqué incomplet. Vous pouvez le remplacer ou le supprimer.') }

  async function cancelJob(value?: VoiceRecord) { if (value?.jobId) { try { await fetch(`/api/voice/jobs/${encodeURIComponent(value.jobId)}/cancel`, { method: 'POST', headers: voiceHeaders(createId()) }) } catch { /* best effort cancellation */ } } }
  async function upload(value: VoiceRecord, token: number) {
    const audio = await assembleVoice(value); if (!valid(value.id, value.revision, token)) return false
    const digest = await crypto.subtle.digest('SHA-256', await audio.arrayBuffer()); if (!valid(value.id, value.revision, token)) return false
    const hash = Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('')
    const response = await fetch(`/api/voice/recordings/${encodeURIComponent(value.id)}/audio`, { method: 'PUT', signal: controller.current?.signal, headers: voiceHeaders(value.uploadKey, { 'Content-Type': value.mime, 'X-Content-Sha256': hash }), body: audio })
    if (!response.ok) throw new Error('upload')
    if (!valid(value.id, value.revision, token)) return false
    await commit({ ...value, status: 'server-received', uploaded: true, pending: undefined }); return true
  }
  async function transcribe() { const value = current.current; if (!value || !value.complete) return; const token = ++generation.current; controller.current = new AbortController(); try { if (!navigator.onLine) throw new Error('offline'); const health = await fetch('/api/voice/health', { signal: controller.current.signal }); if (!health.ok || !valid(value.id, value.revision, token)) throw new Error('health'); let uploaded = value.uploaded; if (!uploaded) uploaded = await upload(value, token); if (!uploaded || !valid(value.id, value.revision, token)) return; const start = await fetch(`/api/voice/recordings/${encodeURIComponent(value.id)}/transcriptions`, { method: 'POST', signal: controller.current.signal, headers: voiceHeaders(value.transcriptionKey, { 'Content-Type': 'application/json' }), body: JSON.stringify({ idempotencyKey: value.transcriptionKey }) }); if (!start.ok) throw new Error('transcription'); const job = await start.json(); const next = { ...current.current!, status: 'processing' as const, pending: 'transcription' as const, jobId: job.jobId }; await commit(next); await poll(next, token, 'transcription') } catch { if (valid(value.id, value.revision, token)) { await commit({ ...current.current!, status: 'queued', pending: 'transcription' }); setMessage('Envoi ou transcription en attente. Réessayez ou reconnectez cette page.') } } }
  async function generate() { const value = current.current; if (!value?.segments.length) { setMessage('Corrigez ou ajoutez une transcription avant de demander une proposition.'); return }; const token = ++generation.current; controller.current = new AbortController(); try { if (!navigator.onLine) throw new Error('offline'); const start = await fetch(`/api/voice/recordings/${encodeURIComponent(value.id)}/drafts`, { method: 'POST', signal: controller.current.signal, headers: voiceHeaders(value.draftKey, { 'Content-Type': 'application/json' }), body: JSON.stringify({ idempotencyKey: value.draftKey, transcriptVersion: value.transcriptVersion, segments: value.segments.map(({ id, start, end, text }) => ({ id, start, end, text })) }) }); if (!start.ok) throw new Error('draft'); const job = await start.json(); const next = { ...value, status: 'processing' as const, pending: 'draft' as const, jobId: job.jobId }; await commit(next); await poll(next, token, 'draft') } catch { if (valid(value.id, value.revision, token)) { await commit({ ...current.current!, status: 'queued', pending: 'draft' }); setMessage('Proposition en attente. Réessayez ou reconnectez cette page.') } } }
  async function poll(value: VoiceRecord, token: number, kind: 'transcription' | 'draft') { for (let attempt = 0; attempt < 180; attempt += 1) { await new Promise(resolve => window.setTimeout(resolve, 1000)); if (!valid(value.id, value.revision, token)) return; const response = await fetch(`/api/voice/jobs/${encodeURIComponent(current.current!.jobId!)}`, { signal: controller.current?.signal }); if (!response.ok) throw new Error('poll'); const job = await response.json(); if (!isTerminal(job.status)) continue; if (job.status !== 'completed') throw new Error('job'); if (!valid(value.id, value.revision, token)) return; if (kind === 'transcription') { const result = job.result ?? job; const segments: Segment[] = (result.segments ?? []).map((segment: { id: string; start: number; end: number; text: string }) => ({ ...segment, rawText: segment.text })); await commit({ ...current.current!, status: 'review', pending: undefined, jobId: undefined, transcriptVersion: Math.max(1, current.current!.transcriptVersion + 1), segments }); setMessage('Transcription reçue. Corrigez-la avant de demander une proposition.') } else { const result = job.result ?? job; if (result.transcriptVersion !== undefined && result.transcriptVersion !== current.current!.transcriptVersion) { setMessage('La transcription a changé pendant la génération : cette proposition est restée obsolète.'); return } await commit({ ...current.current!, status: 'review', pending: undefined, jobId: undefined, title: result.title ?? '', paragraphs: result.paragraphs ?? [], uncertainty: result.uncertainty ?? [], warnings: result.warnings ?? [] }); setMessage('Proposition prête : relisez les preuves avant de l’utiliser.') } return } throw new Error('timeout') }
  async function runPending(value: VoiceRecord) { if (value.pending === 'transcription') await transcribe(); if (value.pending === 'draft') await generate() }
  async function removeLocal() { if (!record) return; if (record.uploaded) { setMessage('Supprimez d’abord la copie serveur, puis la copie de cet appareil.'); return }; invalidate(); await cancelJob(record); await deleteVoice(record.id); sessionStorage.removeItem('un-soir-voice-session'); current.current = undefined; setRecord(undefined); setInterrupted(false); setMessage('Audio supprimé de cet appareil.') }
  async function removeServer() { if (!record?.uploaded) return; try { const response = await fetch(`/api/voice/recordings/${encodeURIComponent(record.id)}`, { method: 'DELETE', headers: voiceHeaders(createId()) }); if (!response.ok) throw new Error(); await commit({ ...record, uploaded: false, status: 'device-only', jobId: undefined, pending: undefined }); setMessage('Copie serveur supprimée. La copie de cet appareil est conservée.') } catch { setMessage('La suppression du serveur a échoué. La copie de cet appareil est conservée.') } }
  function editSegment(id: string, text: string) { if (!record) return; invalidate(); const next = { ...record, revision: record.revision + 1, transcriptVersion: record.transcriptVersion + 1, draftKey: createId(), segments: record.segments.map(segment => segment.id === id ? { ...segment, text } : segment), paragraphs: [], title: '', warnings: ['La proposition précédente doit être régénérée après cette correction.'] }; void commit(next) }
  function acceptDraft() { const value = current.current; if (!value) return; onAccept(value.title, value.segments.map(segment => segment.text).join(' '), value.paragraphs.map(paragraph => paragraph.text).join('\n\n')) }
  useEffect(() => { retryRef.current = () => { if (current.current?.pending === 'transcription') void transcribe(); if (current.current?.pending === 'draft') void generate() } })
  return <section className="voice-narration" data-testid="voice-narration"><p className="eyebrow">Le récit du soir · Premium local</p><h2>Racontez, puis gardez le dernier mot.</h2><p>Un enregistrement dure au plus 5 minutes et 64 MiB. Rien ne quitte cet appareil avant votre demande.</p><div className="voice-actions"><button className="button button-outline" onClick={start} disabled={recorderState !== 'inactive'}>Enregistrer ma voix</button>{recorderState === 'recording' && <><button className="button button-outline" onClick={pause}>Mettre en pause</button><button className="button" onClick={stop}>Arrêter</button></>}{recorderState === 'paused' && <><button className="button button-outline" onClick={resume}>Reprendre</button><button className="button" onClick={stop}>Arrêter</button></>}<label className="button button-outline">Importer un audio<input aria-label="Importer un enregistrement audio" type="file" accept="audio/mp4,audio/webm,audio/ogg,audio/mpeg,audio/wav,audio/x-wav" onChange={event => void importAudio(event.target.files?.[0])} /></label></div><p className="voice-live" aria-live="polite">{message}{saving ? ' Sauvegarde locale en cours…' : ''}</p>{interrupted && <div className="voice-card"><strong>Enregistrement interrompu</strong><button className="text-button" onClick={recover}>Récupérer l’audio disponible</button><button className="text-button" onClick={removeLocal}>Supprimer de cet appareil</button></div>}{record && !interrupted && <div className="voice-card"><strong>{record.complete ? 'Audio conservé sur cet appareil' : 'Audio incomplet conservé sur cet appareil'}</strong><span className="status draft"><i />{record.status}</span><div><button className="text-button" onClick={() => void (record.pending ? runPending(record) : transcribe())} disabled={!record.complete || saving}>{record.pending ? 'Réessayer l’opération' : 'Transcrire en français'}</button>{record.uploaded && <button className="text-button" onClick={removeServer}>Supprimer du serveur</button>}<button className="text-button" onClick={removeLocal}>Supprimer de cet appareil</button></div>{record.segments.length > 0 && <div className="voice-transcript"><h3>Transcription à vérifier</h3>{record.segments.map(segment => <article key={segment.id}><p><strong>{timestamp(segment.start)}–{timestamp(segment.end)}</strong> <span>ASR brut : {segment.rawText}</span></p><label className="field-label" htmlFor={`segment-${segment.id}`}>Texte corrigé</label><textarea id={`segment-${segment.id}`} value={segment.text} onChange={event => editSegment(segment.id, event.target.value)} /></article>)}<button className="button generate-button" onClick={generate} disabled={saving}>Écrire une proposition avec l’IA</button></div>}{record.paragraphs.length > 0 && <div className="voice-draft"><label className="field-label" htmlFor="voice-title">Titre proposé</label><input id="voice-title" value={record.title} onChange={event => void commit({ ...record, revision: record.revision + 1, title: event.target.value })} />{record.paragraphs.map((paragraph, index) => <article key={index}><textarea aria-label={`Paragraphe proposé ${index + 1}`} value={paragraph.text} onChange={event => void commit({ ...record, revision: record.revision + 1, paragraphs: record.paragraphs.map((item, itemIndex) => itemIndex === index ? { ...item, text: event.target.value } : item) })} /><p><strong>Preuves :</strong> {paragraph.supportingSegmentIds.map(id => { const segment = record.segments.find(item => item.id === id); return segment ? `${timestamp(segment.start)} ${segment.text}` : `segment ${id}` }).join(' · ')}</p></article>)}{record.uncertainty.map(item => <p key={item}>Incertitude : {item}</p>)}{record.warnings.map(item => <p key={item}>Attention : {item}</p>)}<button className="button" onClick={acceptDraft} disabled={saving}>Utiliser ce récit</button></div>}</div>}</section>
}
