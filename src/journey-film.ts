import type { PlanStop } from './upcoming-trips'
import type { Draft } from './journal'

type Journey = { from: { name: string; lat: number; lon: number }; to: { name: string; lat: number; lon: number }; mode: string; title: string; illustrated: boolean; route?: unknown }
export type FilmBridge = { begin: (width: number, height: number) => void; prepare: (journey: Journey, signal: AbortSignal) => Promise<Journey>; configure: (journey: Journey) => void; draw: (canvas: HTMLCanvasElement, progress: number) => void; end: () => void }
export type FilmScene = { photoIds: string[]; caption: string; crop: 'contain' | 'cover' }
export type FilmOptions = { title: string; format: 'landscape' | 'portrait'; seconds: number; illustrated: boolean; scenes?: Record<string, FilmScene>; music?: File; volume?: number }
export const filmDuration = (count: number, seconds: number) => 5 + (count - 1) * (seconds + 4)
export function filmMime(audio = false): string | null {
  if (!globalThis.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) return null
  return (audio ? ['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus'] : ['video/mp4;codecs=avc1.42E01E', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']).find(type => MediaRecorder.isTypeSupported(type)) ?? null
}
export function defaultScene(chapter?: Draft): FilmScene {
  return {photoIds:chapter ? [...chapter.media].sort((a,b)=>Number(b.id===chapter.coverId)-Number(a.id===chapter.coverId)).slice(0,3).map(m=>m.id) : [],caption:chapter?.title ?? 'Le voyage continue.',crop:'contain'}
}
function aborted() { return new DOMException('Export annulé.', 'AbortError') }
function loadImage(src: string, signal: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', cancel); image.onload = null; image.onerror = null }
    const cancel = () => { cleanup(); image.src = ''; reject(aborted()) }
    const timer = setTimeout(() => { cleanup(); reject(new Error('Une photo ne peut pas être chargée. Vérifiez le chapitre avant l’export.')) }, 12000)
    signal.addEventListener('abort', cancel, { once: true })
    image.onload = () => { cleanup(); resolve(image) }
    image.onerror = () => { cleanup(); reject(new Error('Une photo ne peut pas être chargée. Vérifiez le chapitre avant l’export.')) }
    if (signal.aborted) { cancel(); return }
    image.src = src
  })
}
function textLines(ctx: CanvasRenderingContext2D, text: string, width: number, max = 3): string[] {
  const lines: string[] = []; let line = ''
  for (const word of text.trim().split(/\s+/)) {
    if (ctx.measureText(`${line} ${word}`).width > width && line) { lines.push(line); line = word } else line = line ? `${line} ${word}` : word
  }
  if (line) lines.push(line)
  const result = lines.slice(0,max)
  return result.map((value, i) => {
    let clipped = value
    if (i === max - 1 && lines.length > max) clipped += '…'
    while (clipped.length > 1 && ctx.measureText(clipped).width > width) clipped = clipped.replace(/…$/, '').slice(0,-1) + '…'
    return clipped
  })
}
function titleCard(ctx: CanvasRenderingContext2D, width: number, height: number, title: string, subtitle: string, opacity = 1) {
  ctx.save(); ctx.globalAlpha = opacity; ctx.fillStyle = '#071c25'; ctx.fillRect(0,0,width,height)
  ctx.fillStyle = '#9cdec5'; ctx.textAlign = 'center'; ctx.font = '18px Arial'; ctx.fillText(subtitle, width / 2, height * .34)
  ctx.fillStyle = '#fff9e9'; ctx.font = `${width < height ? 52 : 62}px Georgia`
  const lines = textLines(ctx, title, width - 110)
  lines.forEach((line, i) => ctx.fillText(line, width / 2, height * .46 + i * 70))
  ctx.fillStyle = '#b1ccc6'; ctx.font = '18px Georgia'; ctx.fillText('un soir là-bas', width / 2, height * .82); ctx.restore()
}
export function arrival(ctx: CanvasRenderingContext2D, w: number, h: number, place: string, caption: string, images: HTMLImageElement[], t: number, crop: 'contain' | 'cover' = 'contain') {
  ctx.fillStyle = '#071c25'; ctx.fillRect(0,0,w,h)
  const photo = images[Math.min(images.length - 1, Math.floor(t * images.length))]
  const portrait = h > w, x = 50, y = portrait ? 235 : 140, boxW = w - 100, boxH = h - y - (portrait ? 230 : 140)
  if (photo) {
    const ratio = (crop === 'cover' ? Math.max : Math.min)(boxW / photo.naturalWidth, boxH / photo.naturalHeight)
    const pw = photo.naturalWidth * ratio, ph = photo.naturalHeight * ratio
    ctx.save();ctx.beginPath();ctx.rect(x,y,boxW,boxH);ctx.clip()
    ctx.drawImage(photo, x + (boxW - pw) / 2, y + (boxH - ph) / 2, pw, ph);ctx.restore()
    if(photo.alt){ctx.textAlign='center';ctx.fillStyle='#bed1cb';ctx.font='12px Arial';textLines(ctx,photo.alt,boxW,3).forEach((line,i)=>ctx.fillText(line,w/2,y+boxH+17+i*15))}
  }
  ctx.textAlign = 'center'; ctx.fillStyle = '#a2dfca'; ctx.font = '17px Arial'; ctx.fillText('UNE NOUVELLE ESCALE', w / 2, portrait ? 90 : 42)
  ctx.font = `${portrait ? 42 : 40}px Georgia`; ctx.fillStyle = '#fff9e9'
  textLines(ctx,place,w-90,2).forEach((line,i) => ctx.fillText(line,w/2,(portrait?150:94)+i*48))
  ctx.font = '25px Georgia'; ctx.fillStyle = '#e8f0df'
  textLines(ctx,caption,w-100,2).forEach((line,i) => ctx.fillText(line,w/2,h-(portrait?130:72)+i*34))
}

export async function exportJourneyFilm(bridge: FilmBridge, stops: PlanStop[], chapters: Draft[], options: FilmOptions, signal: AbortSignal, report: (progress: number, message: string) => void): Promise<{ blob: Blob; extension: string }> {
  const mime = filmMime(Boolean(options.music))
  if (!mime) throw new Error('L’export vidéo n’est pas disponible dans ce navigateur. Essayez Chrome ou Edge sur ordinateur.')
  if (stops.length < 2 || stops.length > 30 || stops.some(s => !s.point) || stops.slice(1).some(s => !s.transport)) throw new Error('Complétez les étapes et les transports avant de créer le film.')
  const total = filmDuration(stops.length, options.seconds)
  if (![6,12,18].includes(options.seconds) || total > 300) throw new Error('Le film doit durer au maximum 5 minutes. Choisissez une durée plus courte par trajet.')
  if (signal.aborted) throw aborted()
  const canvas = document.createElement('canvas'); canvas.width = options.format === 'portrait' ? 720 : 1280; canvas.height = options.format === 'portrait' ? 1280 : 720
  const ctx = canvas.getContext('2d')!
  const prepared: { journey: Journey; scene: FilmScene; images: HTMLImageElement[] }[] = []
  let stream: MediaStream | undefined
  let audio: AudioContext | undefined, music: AudioBufferSourceNode | undefined, gain: GainNode | undefined, destination: MediaStreamAudioDestinationNode | undefined
  bridge.begin(canvas.width,canvas.height)
  try {
    if(options.music) {
      if(options.music.size>30*1024*1024)throw new Error('Choisissez une musique de moins de 30 Mo.')
      audio=new AudioContext();await audio.resume()
      if(audio.state!=='running')throw new Error('Le navigateur bloque l’audio. Réessayez après avoir activé le son.')
      let buffer: AudioBuffer
      try {buffer=await audio.decodeAudioData(await options.music.arrayBuffer())}catch{throw new Error('Cette musique est illisible. Essayez un fichier MP3 ou WAV.')}
      if(buffer.duration>600)throw new Error('Choisissez une musique de moins de dix minutes.')
      music=audio.createBufferSource();music.buffer=buffer;music.loop=true
      gain=audio.createGain();destination=audio.createMediaStreamDestination();music.connect(gain);gain.connect(destination)
    }
    for (let i = 1; i < stops.length; i++) {
      report(0, `Préparation du trajet ${i} sur ${stops.length - 1}…`)
      const from = stops[i - 1], to = stops[i]
      const journey = await bridge.prepare({ from: { name: from.place, ...from.point! }, to: { name: to.place, ...to.point! }, title: `${from.place} → ${to.place}`, mode: to.transport!, illustrated: options.illustrated }, signal)
      const chapter = chapters.find(c => c.id === to.chapterId)
      const scene=options.scenes?.[to.id] ?? defaultScene(chapter)
      const media=scene.photoIds.slice(0,3).map(id=>chapter?.media.find(m=>m.id===id)).filter(m=>m!==undefined)
      const images = await Promise.all(media.map(m => loadImage(m.src,signal)))
      images.forEach((image,index)=>{image.alt=media[index].name.split('| Crédit : ')[1] ?? ''})
      prepared.push({ journey, scene, images })
    }
    if (signal.aborted) throw aborted()
    let current = -1
    const draw = (seconds: number) => {
      const bodyTime = Math.max(0,seconds - 3)
      const index = Math.min(prepared.length - 1, Math.floor(bodyTime / (options.seconds + 4)))
      const segment = prepared[index], local = bodyTime - index * (options.seconds + 4)
      if (current !== index) { bridge.configure(segment.journey); current = index }
      bridge.draw(canvas, Math.min(1, local / options.seconds))
      if (local >= options.seconds) arrival(ctx,canvas.width,canvas.height,segment.journey.to.name,segment.scene.caption,segment.images,Math.min(.999,(local-options.seconds)/4),segment.scene.crop)
      if (seconds < 3) titleCard(ctx,canvas.width,canvas.height,options.title,`${stops.length} ÉTAPES · UN MÊME VOYAGE`, Math.min(1,(3-seconds)/.5))
      if (seconds >= total - 2) titleCard(ctx,canvas.width,canvas.height,'À suivre…',options.title)
      ctx.textAlign='left'; ctx.font='12px Arial'; ctx.fillStyle='#a7c5bc'
      ctx.fillText('Globe : Three Globe · Satellite : Esri et contributeurs · © OpenStreetMap',20,canvas.height-22)
      ctx.fillText(options.illustrated || !['car','walk'].includes(segment.journey.mode) ? 'Liaison illustrée' : 'Itinéraire calculé',20,canvas.height-7)
    }
    draw(0)
    stream = canvas.captureStream(30)
    destination?.stream.getAudioTracks().forEach(track=>stream!.addTrack(track))
    const recorder = new MediaRecorder(stream,{ mimeType: mime, videoBitsPerSecond: 4_000_000 })
    const blob = await new Promise<Blob>((resolve,reject) => {
      const chunks: Blob[] = []; let bytes = 0, frame = 0, failure: Error | null = null, settled = false
      const cleanup = () => { cancelAnimationFrame(frame); clearTimeout(watchdog); signal.removeEventListener('abort', cancel); document.removeEventListener('visibilitychange', visibility) }
      const fail = (error: Error) => { if (settled) return; failure = error; if (recorder.state !== 'inactive') recorder.stop(); else { settled = true; cleanup(); reject(error) } }
      const cancel = () => fail(aborted())
      const visibility = () => { if (document.hidden) fail(new Error('Export interrompu : gardez cet onglet visible pendant la création du film.')) }
      const watchdog = setTimeout(() => fail(new Error('L’export a dépassé le temps prévu. Réessayez avec un film plus court.')), (total + 30) * 1000)
      signal.addEventListener('abort',cancel,{ once:true }); document.addEventListener('visibilitychange',visibility)
      recorder.ondataavailable = event => { if (event.data.size) { bytes += event.data.size; chunks.push(event.data); if (bytes > 200 * 1024 * 1024) fail(new Error('Le film est trop volumineux pour cet appareil. Réduisez sa durée.')) } }
      recorder.onerror = () => fail(new Error('Le navigateur n’a pas pu encoder la vidéo. Réessayez dans Chrome ou Edge.'))
      recorder.onstop = () => { if (settled) return; settled = true; cleanup(); if (failure) reject(failure); else { const result = new Blob(chunks,{type:mime}); if (result.size) resolve(result); else reject(new Error('La vidéo est vide. Réessayez dans un autre navigateur.')) } }
      const started = performance.now()
      let lastFrame = started
      const tick = (now: number) => {
        if (failure || settled) return
        if (now - lastFrame > 2500) { fail(new Error('Export interrompu : l’appareil ou le navigateur a suspendu le rendu. Relancez la création en gardant cet onglet actif.')); return }
        lastFrame = now
        const seconds = Math.min(total,(now-started)/1000)
        try { draw(seconds); report(Math.round(seconds/total*100),'Création du film · gardez cet onglet ouvert.') }
        catch (error) { fail(error instanceof Error ? error : new Error('Rendu interrompu.')); return }
        if (seconds >= total) recorder.stop(); else frame=requestAnimationFrame(tick)
      }
      try {
        recorder.start(250)
        if(audio && music && gain){const start=audio.currentTime,volume=Math.min(1,Math.max(0,options.volume ?? .35));gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(volume,start+1);gain.gain.setValueAtTime(volume,start+total-2);gain.gain.linearRampToValueAtTime(0,start+total);music.start(start)}
        if(signal.aborted) cancel(); else frame=requestAnimationFrame(tick)
      } catch (error) { fail(error instanceof Error ? error : new Error('Enregistrement indisponible.')) }
    })
    return { blob, extension: mime.includes('mp4') ? 'mp4' : 'webm' }
  } finally { stream?.getTracks().forEach(track => track.stop()); if(audio)void audio.close(); bridge.end() }
}
