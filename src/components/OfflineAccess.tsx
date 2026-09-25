import { useEffect, useState } from 'react'

async function status(registration?: ServiceWorkerRegistration) {
  if(!registration?.active)return false
  return new Promise<boolean>(resolve=>{
    const channel=new MessageChannel()
    const timer=setTimeout(()=>{channel.port1.close();resolve(false)},4000)
    channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data?.ready===true)}
    registration.active!.postMessage('STATUS',[channel.port2])
  })
}

export default function OfflineAccess() {
  const [online,setOnline]=useState(navigator.onLine)
  const [ready,setReady]=useState(false)
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const supported='serviceWorker' in navigator && window.isSecureContext
  useEffect(()=>{
    let alive=true
    const connection=()=>setOnline(navigator.onLine)
    if(supported) void navigator.serviceWorker.getRegistration('/').then(status).then(value=>{if(alive)setReady(value)}).catch(()=>{})
    window.addEventListener('online',connection);window.addEventListener('offline',connection)
    return ()=>{alive=false;window.removeEventListener('online',connection);window.removeEventListener('offline',connection)}
  },[supported])
  async function prepare() {
    setBusy(true);setMessage('')
    try {
      const registration=await navigator.serviceWorker.register('/offline-worker.js',{scope:'/',updateViaCache:'none'})
      await registration.update()
      const worker=registration.installing || registration.waiting
      if(worker && worker.state!=='activated')await new Promise<void>((resolve,reject)=>{
        const finish=()=>{clearTimeout(timer);worker.removeEventListener('statechange',check)}
        const check=()=>{if(worker.state==='activated'){finish();resolve()}else if(worker.state==='redundant'){finish();reject(new Error('download'))}}
        const timer=setTimeout(()=>{finish();reject(new Error('timeout'))},60000)
        worker.addEventListener('statechange',check);check()
      })
      const available=await status(registration)
      setReady(available)
      if(!available)throw new Error('incomplete')
      setMessage('Application disponible hors connexion. Vos données déjà enregistrées sur cet appareil seront accessibles.')
    }catch{setMessage('Téléchargement incomplet. Vérifiez votre connexion puis réessayez. Vos carnets sont conservés.')}
    finally{setBusy(false)}
  }
  return <aside className="offline-access" aria-label="Disponibilité hors connexion">
    <strong>{online ? 'Connexion disponible' : 'Vous êtes hors connexion'} · {ready ? 'Application téléchargée' : 'Application non préparée'}</strong>
    <p>Emportez le programme, les adresses, les notes et les photos déjà enregistrées dans vos carnets. Les cartes, la recherche de lieux, Google Photos et les services en ligne nécessitent une connexion.</p>
    {supported ? <button className="text-button" disabled={busy || !online} onClick={prepare}>{busy ? 'Téléchargement en cours…' : ready ? 'Actualiser la copie hors connexion' : 'Télécharger pour le hors connexion'}</button> : <p>Le téléchargement nécessite HTTPS ou localhost dans un navigateur compatible.</p>}
    {message && <p role="status">{message}</p>}
    <small>Le navigateur peut libérer ce stockage. Vérifiez l’accès avant le départ et conservez aussi une sauvegarde ZIP.</small>
  </aside>
}
