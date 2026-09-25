import { visayasDays } from './visayas-days'
import credits from '../public/assets/visayas/credits.json'
import type { UpcomingTrip, PlanStop, TransportMode } from './upcoming-trips'
import { readUpcoming, upcomingKey, validateUpcomingTrips } from './upcoming-trips'
import type { PersonalJournal } from './trip-journals'
import { readJournals, journalsKey, validateJournals } from './trip-journals'

export const visayasId='visayas-20-demo'
export const visayasCredits=credits
export function makeVisayas(departure='2027-02-01', images?: Record<string,string>) {
  const date=(day:number)=>{const d=new Date(`${departure}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+day-1);return d.toISOString().slice(0,10)}
  const chapters=visayasDays.map((day,index)=>{
    const credit=credits[day.photo],id=`visayas-day-${index+1}`
    const attribution=`${credit.author} · ${credit.license} · ${credit.licenseUrl} · ${credit.source}`
    return {id,title:`J${index+1} · ${day.title}`,story:`RÉCIT FICTIF DE DÉMONSTRATION · ${date(index+1)}\n\n${day.story}\n\nProgramme proposé\nMatin : ${day.morning}\nAprès-midi : ${day.afternoon}\nSoir : ${day.evening}\nNuit : ${day.night} (hébergement à choisir, aucune réservation).\n\nPhoto d’illustration de ${credit.title}, pas une photo personnelle prise ce jour.\nCrédit : ${attribution}. Miniature, cadrage possible dans le film.`,memories:'Exemple éditorial à remplacer par vos souvenirs.',tone:'Contemplatif',status:'draft' as const,coverId:`${id}-photo`,media:[{id:`${id}-photo`,name:`${credit.title} | Crédit : ${attribution}`,src:images?.[day.photo] ?? `/assets/visayas/${day.photo}.jpg`}]}
  })
  const stops: PlanStop[]=[]
  const transit=(day:number,id:string,place:string,lat:number,lon:number,transport?:TransportMode)=>stops.push({id,place,date:date(day),point:{lat,lon},...(transport?{transport}:{}),kind:'transit',notes:'Point de passage illustratif. Confirmer le terminal, les billets et les horaires auprès de l’opérateur.'})
  visayasDays.forEach((day,index)=>{
    const n=index+1
    if(n===1)transit(n,'visayas-airport-start','Arrivée à Mactan-Cebu',10.309,123.979)
    if(n===7)transit(n,'visayas-tagbilaran','Retour au port de Tagbilaran',9.6505,123.8536,'car')
    if(n===11)transit(n,'visayas-siquijor-port','Retour au port de Siquijor',9.217,123.514,'car')
    if(n===15)transit(n,'visayas-sibulan','Port de Sibulan',9.36,123.285,'car')
    stops.push({id:`visayas-stop-${n}`,place:day.place,date:date(n),point:{lat:day.lat,lon:day.lon},transport:day.mode,chapterId:chapters[index].id,kind:day.mode==='boat'?'transit':'visit',address:`${day.place}, Philippines`,booking:'EXEMPLE · aucune réservation effectuée',...(day.mode==='boat'?{}:{time:'09:30'}),notes:`Matin : ${day.morning}\nAprès-midi : ${day.afternoon}\nSoir : ${day.evening}\nNuit : ${day.night}.\nHeure indicative de programme, pas un horaire fournisseur. Points GPS indicatifs, à vérifier pour la navigation.`})
    if(n===13)transit(n,'visayas-apo-return','Retour de l’excursion à Dauin',9.19,123.269,'boat')
  })
  const trip:UpcomingTrip={id:visayasId,destination:'Visayas · 20 jours (exemple)',departure,endDate:date(20),plan:{ideas:[{id:'sea',text:'Observer la vie marine avec un opérateur local'},{id:'slow',text:'Garder du temps libre entre les îles'},{id:'film',text:'Créer un film et partager la copie de lecture'}],stops,notes:'VOYAGE FICTIF DE DÉMONSTRATION. Aucun billet, hôtel ou horaire confirmé. Circuit terrestre et maritime dans les Visayas ; vols internationaux hors programme. Vérifier traversées, météo et accès avant réservation. Les récits sont fictifs, les photos documentaires sont créditées. Hébergements à sélectionner. Préparer le hors connexion et conserver une sauvegarde ZIP avant départ. Sources : https://philippines.travel/ ; https://www.oceanjet.net/ ; https://tpb.gov.ph/wp-content/uploads/2023/10/R7-Central-Visayas_map.pdf — consultation 25/09/2026.'}}
  const journal:PersonalJournal={tripId:visayasId,destination:trip.destination,departure,chapters}
  return {trip,journal}
}

async function localPhoto(key:string):Promise<string>{
  const response=await fetch(`/assets/visayas/${key}.jpg`)
  if(!response.ok)throw new Error('Une photo manque. Réessayez avec une connexion avant de copier le voyage.')
  const blob=await response.blob(),url=URL.createObjectURL(blob)
  try{return await new Promise<string>((resolve,reject)=>{
    const image=new Image(),timer=setTimeout(()=>reject(new Error('Chargement des photos trop long. Réessayez.')),15000)
    image.onerror=()=>{clearTimeout(timer);reject(new Error('Une photo est illisible.'))}
    image.onload=()=>{clearTimeout(timer);const scale=Math.min(1,640/image.width,640/image.height),canvas=document.createElement('canvas');canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);canvas.getContext('2d')!.drawImage(image,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/jpeg',.58))};image.src=url
  })}finally{URL.revokeObjectURL(url)}
}
export async function installVisayas(departure:string):Promise<string>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(departure))throw new Error('Choisissez une date de départ valide.')
  const images=Object.fromEntries(await Promise.all(Object.keys(credits).map(async key=>[key,await localPhoto(key)])))
  // Read after asynchronous downloads so another tab's edits are preserved.
  const upcoming=readUpcoming(),stored=readJournals()
  if(upcoming.error||stored.error)throw new Error(upcoming.error||stored.error)
  if(upcoming.trips.some(t=>t.id===visayasId)||stored.data.journals.some(j=>j.tripId===visayasId))throw new Error('Une copie de cet exemple existe déjà. Ouvrez-la depuis vos voyages : elle n’a pas été remplacée.')
  const {trip,journal}=makeVisayas(departure,images),trips=[...upcoming.trips,trip],journals={version:1 as const,journals:[...stored.data.journals,journal]}
  if(!validateUpcomingTrips(trips)||!validateJournals(journals))throw new Error('Date invalide ou limite de voyages atteinte. Aucun voyage ajouté.')
  const previous=localStorage.getItem(journalsKey)
  try{localStorage.setItem(journalsKey,JSON.stringify(journals));try{localStorage.setItem(upcomingKey,JSON.stringify(trips))}catch(error){if(previous===null)localStorage.removeItem(journalsKey);else localStorage.setItem(journalsKey,previous);throw error}}
  catch{throw new Error('Stockage insuffisant ou indisponible. Vos voyages existants sont conservés ; libérez de l’espace puis réessayez.')}
  window.dispatchEvent(new Event('trip-journals-updated'));window.dispatchEvent(new Event('upcoming-trips-updated'))
  return visayasId
}
