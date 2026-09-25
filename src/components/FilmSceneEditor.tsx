import { useEffect, useRef, useState } from 'react'
import type { Draft } from '../journal'
import type { FilmScene } from '../journey-film'
import { arrival } from '../journey-film'

export default function FilmSceneEditor({place,chapter,scene,format,change}:{place:string;chapter?:Draft;scene:FilmScene;format:'landscape'|'portrait';change:(scene:FilmScene)=>void}) {
  const canvas=useRef<HTMLCanvasElement>(null)
  const [index,setIndex]=useState(0)
  const [error,setError]=useState('')
  useEffect(()=>{
    let cancelled=false
    const sources=scene.photoIds.map(id=>chapter?.media.find(m=>m.id===id)).filter(m=>m!==undefined)
    Promise.all(sources.map(media=>new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.alt=media.name.split('| Crédit : ')[1] ?? '';image.onload=()=>resolve(image);image.onerror=reject;image.src=media.src}))).then(images=>{
      if(cancelled || !canvas.current)return
      const target=canvas.current;target.width=format==='portrait'?720:1280;target.height=format==='portrait'?1280:720
      arrival(target.getContext('2d')!,target.width,target.height,place,scene.caption,images,images.length?Math.min(index,images.length-1)/images.length:0,scene.crop)
      setError('')
    }).catch(()=>{if(!cancelled)setError('Une photo ne peut pas être prévisualisée.')})
    return ()=>{cancelled=true}
  },[chapter,scene,format,place,index])
  return <details className="film-scene"><summary>Montage à {place} · {scene.photoIds.length} photo(s)</summary>
    <p>Choisissez jusqu’à trois photos, puis réglez leur ordre. Les originaux du carnet sont conservés.</p>
    <div className="film-photo-picker">{chapter?.media.map(photo=><label key={photo.id}><img src={photo.src} alt=""/><span><input type="checkbox" aria-label={`Inclure ${photo.name}`} checked={scene.photoIds.includes(photo.id)} disabled={!scene.photoIds.includes(photo.id)&&scene.photoIds.length>=3} onChange={event=>change({...scene,photoIds:event.target.checked?[...scene.photoIds,photo.id]:scene.photoIds.filter(id=>id!==photo.id)})}/>{photo.name}</span></label>)}</div>
    {!chapter?.media.length && <p>Associez un chapitre avec des photos à cette escale pour les inclure.</p>}
    <ol className="film-photo-order">{scene.photoIds.map((id,i)=><li key={id}><span>{chapter?.media.find(m=>m.id===id)?.name}</span><button type="button" className="text-button" disabled={i===0} aria-label={`Avancer la photo ${i+1} à ${place}`} onClick={()=>{const ids=[...scene.photoIds];[ids[i-1],ids[i]]=[ids[i],ids[i-1]];change({...scene,photoIds:ids})}}>↑</button><button type="button" className="text-button" disabled={i===scene.photoIds.length-1} aria-label={`Reculer la photo ${i+1} à ${place}`} onClick={()=>{const ids=[...scene.photoIds];[ids[i+1],ids[i]]=[ids[i],ids[i+1]];change({...scene,photoIds:ids})}}>↓</button></li>)}</ol>
    <label>Légende à {place}<input value={scene.caption} maxLength={120} onChange={event=>change({...scene,caption:event.target.value})}/></label>
    <label>Cadrage à {place}<select value={scene.crop} onChange={event=>change({...scene,crop:event.target.value as FilmScene['crop']})}><option value="contain">Photo entière</option><option value="cover">Remplir le cadre · centré</option></select></label>
    <canvas ref={canvas} className="film-scene-preview" aria-label={`Aperçu de l’arrivée à ${place}`}/>
    {scene.photoIds.length>1 && <label>Photo à prévisualiser à {place}<select value={Math.min(index,scene.photoIds.length-1)} onChange={event=>setIndex(Number(event.target.value))}>{scene.photoIds.map((id,i)=><option key={id} value={i}>Photo {i+1}</option>)}</select></label>}
    {error && <p role="alert">{error}</p>}
  </details>
}
