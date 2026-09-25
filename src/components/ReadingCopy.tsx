import { useEffect, useRef, useState } from 'react'
import type { PersonalJournal } from '../trip-journals'
import { readUpcoming } from '../upcoming-trips'

export default function ReadingCopy({ journal }: { journal: PersonalJournal }) {
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const url=useRef<string | null>(null)
  useEffect(()=>()=>{if(url.current)URL.revokeObjectURL(url.current)},[])
  async function download() {
    setBusy(true);setMessage('')
    try {
      const {readingCopy}=await import('../reading-copy')
      const stored=readUpcoming()
      if(stored.error) throw new Error('Le parcours ne peut pas être lu. Vérifiez les données avant de créer cette copie.')
      const blob=readingCopy(journal,stored.trips.find(t=>t.id===journal.tripId)?.plan?.stops??[])
      if(url.current)URL.revokeObjectURL(url.current)
      url.current=URL.createObjectURL(blob)
      const anchor=document.createElement('a');anchor.href=url.current;anchor.download=`carnet-${journal.destination.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'-').slice(0,65)}.html`;anchor.click()
      setMessage('Copie de lecture téléchargée. Vous pouvez envoyer ce fichier HTML à vos proches ; il contient les photos et les textes de ce carnet.')
    } catch(error) {setMessage(error instanceof Error?error.message:'La copie ne peut pas être créée.')}
    finally{setBusy(false)}
  }
  return <aside className="reading-copy"><div><p className="eyebrow">Le carnet à emporter</p><h2>Vos souvenirs, même sans connexion.</h2><p>Une copie avec les photos et les récits, à lire sur un navigateur ou à envoyer aux proches de votre choix.</p></div><button className="button button-outline" disabled={busy||!journal.chapters.length} onClick={download}>{busy?'Préparation…':'Télécharger la copie de lecture'}</button>{message&&<p role="status">{message}</p>}</aside>
}
