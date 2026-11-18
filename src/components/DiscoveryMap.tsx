import {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {categories,symbols,discoveries,nearby,distance,categoryFor,isCategory} from '../discovery'
import type {Place,Category} from '../discovery'
import {readUpcoming,calendarDate} from '../upcoming-trips'
import {saveUpcomingMetadataUnlocked} from '../trip-journals'
import {withDurabilityLock} from '../durability-lock'
import {useHydratedJournals} from '../use-hydrated-journals'
import {createId} from '../id'
import {coverOf} from '../journal'
import {nearLongitude,routeLongitudeOrigin} from '../route-geography'
import './discovery-map.css'

const dayNumber = (departure:string,date:string) => Math.round((Date.parse(`${date}T12:00:00Z`)-Date.parse(`${departure}T12:00:00Z`))/86400000)+1

function framePlaces(map:L.Map|null,points:Place[]) {
 if(!map||!points.length)return
 const origin=routeLongitudeOrigin(points.map(p=>p.lon))
 map.fitBounds(points.map(p=>[p.lat,nearLongitude(p.lon,origin)] as L.LatLngTuple),{padding:[36,36],maxZoom:14})
}

export default function DiscoveryMap({id}:{id?:string}) {
 const [stored,setStored]=useState(readUpcoming)
 const journals=useHydratedJournals()
 const [tripId,setTripId]=useState(id??'')
 const trip=stored.trips.find(t=>t.id===tripId)
 const [mode,setMode]=useState<'explore'|'trip'|'memories'>(id?'trip':'explore')
 const [category,setCategory]=useState<Category|'all'>('all')
 const [day,setDay]=useState(()=>{const active=readUpcoming().trips.find(item=>item.id===id),today=calendarDate(new Date());return active?.endDate&&active.departure<=today&&active.endDate>=today?today:'*'})
 const [wishesOnly,setWishesOnly]=useState(false)
 const [lines,setLines]=useState(false)
 const [selected,setSelected]=useState<Place|null>(null)
 const [selectedStopId,setSelectedStopId]=useState('')
 const [query,setQuery]=useState('')
 const [results,setResults]=useState<Place[]>([])
 const [busy,setBusy]=useState(false)
 const [message,setMessage]=useState('')
 const [date,setDate]=useState('')
 const [listOnly,setListOnly]=useState(false)
 const [tileError,setTileError]=useState(false)
 const [revision,setRevision]=useState(0)
 const [area,setArea]=useState<{lat:number;lon:number}|null>(null)
 const [location,setLocation]=useState<{lat:number;lon:number;accuracy:number}|null>(null)
 const [locationBusy,setLocationBusy]=useState(false)
 const locateGeneration=useRef(0)
 const target=useRef<HTMLDivElement>(null), map=useRef<L.Map|null>(null), layer=useRef<L.LayerGroup|null>(null)
 const request=useRef<AbortController|null>(null)
 const selectRef=useRef<(p:Place)=>void>(()=>{})
 const initial=useRef(stored.trips.find(t=>t.id===id)?.plan?.stops.flatMap(s=>s.point?[s.point]:[])??[])
 const live=useRef(true)
 const tripStops=useMemo(()=>trip?.plan?.stops??[],[trip])
 const visibleTripStops=useMemo(()=>tripStops.filter(stop=>day==='*'||(day==='undated'?!stop.date:stop.date===day)),[tripStops,day])
 const tripStay=trip?.plan?.stayContexts?.find(context=>context.key===trip.plan?.selectedStayContextKey)?.stay??trip?.plan?.stay
 const relativeDay=day.startsWith('stay:')?tripStay?.days.find(item=>item.id===day.slice(5)):undefined
 const tripDates=useMemo(()=>{
   if(!trip?.endDate)return [...new Set(tripStops.flatMap(stop=>stop.date?[stop.date]:[]))].sort()
   const start=new Date(`${trip.departure}T12:00:00Z`),end=new Date(`${trip.endDate}T12:00:00Z`),dates:string[]=[]
   for(let offset=0;start<=end&&offset<90;offset++,start.setUTCDate(start.getUTCDate()+1))dates.push(start.toISOString().slice(0,10))
   return dates
 },[trip,tripStops])
 useEffect(()=>{
   const strip=document.querySelector<HTMLElement>('.map-day-strip')
   const active=strip?.querySelector<HTMLElement>('button[aria-pressed=true]')
   if(strip&&active){
     const box=strip.getBoundingClientRect(),button=active.getBoundingClientRect()
     strip.scrollLeft+=button.left-box.left-box.width/2+button.width/2
   }
 },[day,mode])
 const tripPlaces=useMemo<Place[]>(()=>stored.trips.filter(t=>!tripId||t.id===tripId).flatMap(t=>{
   const journal=journals.data.journals.find(j=>j.tripId===t.id)
   return [
    ...(t.plan?.stops??[]).flatMap(s=>{const chapter=journal?.chapters.find(c=>c.id===s.chapterId)??journal?.chapters.find(c=>c.plannedStep?.tripId===t.id&&c.plannedStep.stepId===s.id),photo=chapter&&coverOf(chapter);return s.point?[{id:`stop-${t.id}-${s.id}`,name:s.place,...s.point,category:isCategory(s.category)?s.category:categoryFor(s.kind),description:[s.address,s.booking&&`Réservation : ${s.booking}`,s.notes].filter(Boolean).join('\n'),tripId:t.id,chapterId:chapter?.id,date:s.date,kind:'stop' as const,photo:photo?.src,credit:photo?.name.includes(' | Crédit :')?photo.name.split(' | Crédit :')[1]:undefined}]:[]}),
    ...(t.plan?.ideas??[]).flatMap(i=>i.point?[{id:`wish-${t.id}-${i.id}`,name:i.text,...i.point,category:isCategory(i.category)?i.category:'culture',source:i.source,kind:'wish' as const,tripId:t.id}]:[]),
   ]
 }),[stored,journals,tripId])
 const stayPlaces=useMemo<Place[]>(()=>relativeDay&&tripStay?relativeDay.placeIds.flatMap(id=>{const p=tripStay.places.find(item=>item.id===id);return p?[{id:`stay-${id}`,name:p.name,lat:p.latitude,lon:p.longitude,category:p.category==='restaurant'?'food' as const:'culture' as const,source:p.sourceUrl,tripId}]:[]}):[],[relativeDay,tripStay,tripId])
 const places=useMemo(()=>{
   let items=mode==='explore'?(area?results:[...discoveries,...results]):mode==='trip'&&relativeDay&&!wishesOnly?stayPlaces:tripPlaces
   if(mode==='memories')items=items.filter(p=>p.chapterId)
   if(mode!=='explore'&&day!=='*'&&!relativeDay&&!wishesOnly)items=items.filter(p=>day==='undated'?!p.date:p.date===day)
   if(category!=='all')items=items.filter(p=>p.category===category)
   const origin=location??area
   if(mode==='trip'&&wishesOnly)items=items.filter(p=>p.kind==='wish')
   if(mode==='trip'&&!wishesOnly)return items
   return origin?[...items].sort((a,b)=>distance(a,origin)-distance(b,origin)):items
 },[mode,area,results,tripPlaces,day,category,location,wishesOnly,relativeDay,stayPlaces])
 function linkedChapterId(tripId:string,stepId:string,explicit?:string){const chapters=journals.data.journals.find(j=>j.tripId===tripId)?.chapters??[];return (chapters.find(c=>c.id===explicit)??chapters.find(c=>c.plannedStep?.tripId===tripId&&c.plannedStep.stepId===stepId))?.id}
 function closeDetail(){const opener=document.querySelector<HTMLButtonElement>('.discovery-place[aria-pressed=true]');setSelected(null);setSelectedStopId('');requestAnimationFrame(()=>opener?.focus({preventScroll:true}))}
 useEffect(()=>{const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'&&selected)closeDetail()};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape)},[selected])
 function select(p:Place){setSelected(p);setSelectedStopId('');setDate(day==='*'||day==='undated'||relativeDay?'':day);setMessage('')}
 useEffect(()=>{selectRef.current=select})
 useEffect(()=>{
   live.current=true
   const refresh=()=>{setStored(readUpcoming())}
   window.addEventListener('storage',refresh);window.addEventListener('upcoming-trips-updated',refresh);window.addEventListener('trip-journals-updated',refresh)
   return()=>{live.current=false;request.current?.abort();window.removeEventListener('storage',refresh);window.removeEventListener('upcoming-trips-updated',refresh);window.removeEventListener('trip-journals-updated',refresh)}
 },[])
 useEffect(()=>{
   if(!target.current)return
   const instance=L.map(target.current,{scrollWheelZoom:false,worldCopyJump:true,zoomAnimation:false,fadeAnimation:false}).setView([9.8,123.7],8)
   map.current=instance;layer.current=L.layerGroup().addTo(instance)
   const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(instance)
   tiles.on('tileerror',()=>setTileError(true))
   const points=initial.current
   if(points.length){const origin=routeLongitudeOrigin(points.map(p=>p.lon));instance.fitBounds(points.map(p=>[p.lat,nearLongitude(p.lon,origin)] as L.LatLngTuple),{maxZoom:12,padding:[30,30]})}
   instance.on('moveend zoomend',()=>setRevision(v=>v+1))
   const observer=new ResizeObserver(()=>instance.invalidateSize());observer.observe(target.current)
   return()=>{observer.disconnect();instance.remove();map.current=null}
 },[])
 useEffect(()=>{
   const group=layer.current,instance=map.current;if(!group||!instance)return
   group.clearLayers()
   const origin=instance.getCenter().lng
   const clusters=new Map<string,Place[]>()
   places.forEach(p=>{const pixel=instance.project([p.lat,nearLongitude(p.lon,origin)]);const key=`${Math.floor(pixel.x/44)},${Math.floor(pixel.y/44)}`;clusters.set(key,[...(clusters.get(key)??[]),p])})
   clusters.forEach(items=>{
    const p=items.find(item=>item.id===selected?.id)??items[0],many=items.length>1
    const stopIndex=p.id.startsWith(`stop-${tripId}-`)?visibleTripStops.findIndex(stop=>p.id===`stop-${tripId}-${stop.id}`):-1
    const markerLabel=many?String(items.length):stopIndex>=0?String(stopIndex+1):symbols[p.category]
    const marker=L.marker([p.lat,nearLongitude(p.lon,origin)],{title:many?`${items.length} lieux proches`:p.name,alt:many?`${items.length} lieux proches`:p.name,icon:L.divIcon({className:`discovery-pin ${p.category} ${selected?.id===p.id?'selected':''}`,html:`<span>${markerLabel}</span>`,iconSize:[36,36],iconAnchor:[18,18]})}).addTo(group)
    const text=document.createElement('span');text.textContent=many?`${items.length} lieux · zoomez ou utilisez la liste`:p.name;marker.bindTooltip(text)
    marker.on('click',()=>many?instance.setView(marker.getLatLng(),Math.min(instance.getZoom()+2,19)):selectRef.current(p))
   })
   if(lines&&mode==='trip')stored.trips.filter(t=>!tripId||t.id===tripId).forEach(t=>{
    const stops=t.plan?.stops??[];stops.forEach((s,i)=>{const prev=stops[i-1];if(s.point&&prev?.point&&(day==='*'||s.date===day&&prev.date===day)){const lon=nearLongitude(prev.point.lon,origin);L.polyline([[prev.point.lat,lon],[s.point.lat,nearLongitude(s.point.lon,lon)]],{color:'#47786c',dashArray:'4 8',weight:2,interactive:false}).addTo(group)}})
   })
   if(location){L.circle([location.lat,nearLongitude(location.lon,origin)],{radius:location.accuracy,color:'#2767bb',weight:1,fillOpacity:.12}).addTo(group);L.circleMarker([location.lat,nearLongitude(location.lon,origin)],{radius:8,color:'#2767bb',fillOpacity:1}).addTo(group)}
 },[places,selected,revision,lines,mode,stored,tripId,day,location,visibleTripStops])
 const fit=useCallback(()=>framePlaces(map.current,places),[places])
 useEffect(()=>{
   if(mode==='explore')return
   let points=mode==='trip'&&relativeDay&&!wishesOnly?stayPlaces:tripPlaces.filter(p=>mode!=='memories'||Boolean(p.chapterId))
   if(mode==='trip'&&wishesOnly)points=points.filter(p=>p.kind==='wish')
   else if(day!=='*'&&!relativeDay)points=points.filter(p=>day==='undated'?!p.date:p.date===day)
   if(category!=='all')points=points.filter(p=>p.category===category)
   framePlaces(map.current,points)
 },[mode,tripId,tripPlaces,day,wishesOnly,category,relativeDay,stayPlaces])
 useEffect(()=>{if(selected){const detail=document.querySelector<HTMLElement>('.discovery-detail');if(window.innerWidth>760&&mode!=='trip')detail?.scrollIntoView({behavior:'instant',block:'nearest'});if(window.innerWidth<=760&&mode==='trip'&&!listOnly)target.current?.scrollIntoView({behavior:'instant',block:'center'});detail?.focus({preventScroll:true})}},[selected,mode,listOnly])
 async function search(zone:boolean){
   request.current?.abort();const controller=new AbortController();request.current=controller
   const timeout=setTimeout(()=>controller.abort(),25000);setBusy(true);setMessage('')
   try{
    if(zone){
     if(category==='all')throw new Error('Choisissez une catégorie avant de rechercher autour de la carte.')
     const center=map.current?.getCenter().wrap();if(!center)throw new Error('Carte indisponible.')
     if(map.current!.getZoom()<11)throw new Error('Zoomez sur une ville ou une île pour rechercher les lieux autour.')
     const point={lat:center.lat,lon:center.lng},found=await nearby(point,category,controller.signal)
     if(request.current!==controller||controller.signal.aborted)return
     setResults(found);setArea(point);setSelected(null);setMessage(`${found.length} lieux trouvés dans un rayon de 5 km. Résultats limités à 30, couverture OpenStreetMap variable.`)
    }else{
     const response=await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query.trim())}&limit=8&lang=fr`,{signal:controller.signal})
     if(!response.ok)throw new Error('Recherche indisponible. Réessayez plus tard.')
     const data=await response.json()
     const found:Place[]=(data.features??[]).flatMap((f:{geometry?:{type:string;coordinates:number[]};properties?:Record<string,string>},i:number)=>{
      const lon=f.geometry?.coordinates[0],lat=f.geometry?.coordinates[1];if(f.geometry?.type!=='Point'||typeof lat!=='number'||typeof lon!=='number'||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return []
      return [{id:`search-${i}`,name:(f.properties?.name||query).slice(0,160),lat,lon,category:'practical' as const,description:[f.properties?.city,f.properties?.country].filter(Boolean).join(' · '),source:'https://www.openstreetmap.org/'}]
     })
     if(request.current!==controller||controller.signal.aborted)return
     setCategory('all');setResults(found);setArea(found[0]??{lat:0,lon:0});setSelected(null)
     if(found[0])map.current?.setView([found[0].lat,found[0].lon],12)
     setMessage(found.length?'Choisissez un lieu dans la liste, ou une catégorie pour explorer les alentours.':'Aucun lieu trouvé. Précisez le pays ou la ville.')
    }
   }catch(error){if(request.current===controller)setMessage(controller.signal.aborted?'La recherche a expiré. Réessayez ; vos données sont conservées.':error instanceof TypeError?'Connexion au service impossible. Recherchez plus tard ; vos lieux enregistrés restent accessibles.':error instanceof Error?error.message:'Recherche indisponible.')}
   finally{clearTimeout(timeout);if(request.current===controller)setBusy(false)}
 }
 async function save(asStop:boolean){
   if(!selected)return
   try{
    await withDurabilityLock(async () => {
    const latest=readUpcoming();if(latest.error)throw new Error(latest.error)
    const current=latest.trips.find(t=>t.id===tripId);if(!current)throw new Error('Choisissez un voyage pour y garder ce lieu.')
    const plan=current.plan??{ideas:[],stops:[],notes:''},point={lat:selected.lat,lon:selected.lon}
    if(asStop){
     if(date&&(date<current.departure||(current.endDate&&date>current.endDate)))throw new Error('Choisissez une journée comprise dans les dates du voyage.')
     if(plan.stops.some(s=>s.point&&distance(s.point,point)<.08&&s.place===selected.name&&s.date===(date||undefined)))throw new Error('Cette étape figure déjà dans cette journée.')
     const stop={id:createId(),place:selected.name,point,...(date?{date}:{}),category:selected.category,kind:categoryForReverse(selected.category),notes:[selected.description,selected.phone&&`Téléphone : ${selected.phone}`,selected.source&&`Source : ${selected.source}`].filter(Boolean).join('\n').slice(0,2000)}
     const stops=[...plan.stops],index=date?stops.findIndex(s=>s.date&&s.date>date):-1
     stops.splice(index<0?stops.length:index,0,stop);current.plan={...plan,stops}
    }else{
     if(plan.ideas.some(i=>i.point&&distance(i.point,point)<.08&&i.text===selected.name))throw new Error('Ce lieu est déjà dans vos envies.')
     current.plan={...plan,ideas:[...plan.ideas,{id:createId(),text:selected.name,point,category:selected.category,...(selected.source?{source:selected.source}:{})}]}
    }
    // Validate the full store, including capacity, before the single atomic write.
    if(!validate(latest.trips))throw new Error('Limite atteinte : 30 envies et 30 étapes par voyage. Retirez un élément dans le programme.')
    saveUpcomingMetadataUnlocked(latest.trips);setStored(latest);window.dispatchEvent(new Event('upcoming-trips-updated'));setMessage(asStop?'Étape ajoutée au programme. Choisissez ensuite son transport si nécessaire.':'Envie enregistrée dans votre voyage et incluse dans les sauvegardes ZIP.')
    })
   }catch(error){setMessage(error instanceof DOMException?'Stockage indisponible ou plein. Rien n’a été ajouté.':error instanceof Error?error.message:'Enregistrement impossible.')}
 }
 function locate(){
   const generation=++locateGeneration.current
   if(!navigator.geolocation){setMessage('La localisation n’est pas disponible. Recherchez une ville.');setLocationBusy(false);return}
   setLocationBusy(true);setMessage('Localisation en cours…')
   navigator.geolocation.getCurrentPosition(position=>{if(!live.current||generation!==locateGeneration.current)return;const p={lat:position.coords.latitude,lon:position.coords.longitude,accuracy:position.coords.accuracy};setLocation(p);setLocationBusy(false);map.current?.setView([p.lat,p.lon],13,{animate:false});setMessage(`Position utilisée pour cette visite uniquement · précision ±${Math.round(p.accuracy)} m. Elle n’est pas enregistrée.`)},()=>{if(live.current&&generation===locateGeneration.current){setLocationBusy(false);setMessage('Position indisponible ou autorisation refusée. Vous pouvez chercher une ville.')}},{timeout:10000,maximumAge:0})
 }
 return <section className={`discovery page-width ${mode==='trip'&&trip?'discovery-trip':''}`}>
  <header><p className="eyebrow">{trip&&mode==='trip'?'Votre voyage · lieux et étapes':'Laisser une place à la découverte'}</p><h1>{trip&&mode==='trip'?'La carte de votre voyage':'Qu’y a-t-il à découvrir ici ?'}</h1><p>{trip&&mode==='trip'?'Choisissez une journée, retrouvez vos étapes et ouvrez votre carnet depuis chaque lieu.':'Des lieux à explorer, des envies à garder et les souvenirs de vos voyages.'}</p></header>
  {(stored.error||journals.error)&&<p role="alert">{stored.error||journals.error}</p>}
  {trip&&mode==='trip'&&<section className="map-trip-overview" aria-label="Aperçu du voyage"><div><p className="eyebrow">Votre voyage</p><h2>{trip.destination}</h2><p>{trip.departure}{trip.endDate?` — ${trip.endDate}`:''} · {tripStops.length} étape{tripStops.length===1?'':'s'}</p></div><a href={`#plan/${encodeURIComponent(trip.id)}`}>Ouvrir le programme et modifier →</a></section>}
  <div className="discovery-toolbar"><div className="discovery-modes" aria-label="Vue de la carte">{([['explore','Explorer'],['trip','Mon voyage'],['memories','Mes souvenirs']] as const).map(([value,label])=><button key={value} aria-pressed={mode===value} onClick={()=>{request.current?.abort();request.current=null;setBusy(false);setMode(value);if(value!=='trip')setDay('*');setWishesOnly(false);setCategory('all');setSelected(null);setMessage('')}}>{label}</button>)}</div>
   {!id&&<label>Voyage<select value={tripId} onChange={e=>{setTripId(e.target.value);setDay('*');setDate('');if(mode!=='explore')setSelected(null)}}><option value="">Tous mes voyages</option>{stored.trips.map(t=><option key={t.id} value={t.id}>{t.destination}</option>)}</select></label>}{id&&<a href="#explore">Tous mes voyages</a>}
  </div>
  {mode==='explore'&&<form className="discovery-search" onSubmit={e=>{e.preventDefault();void search(false)}}><label>Une destination ou un lieu<input value={query} onChange={e=>setQuery(e.target.value)} maxLength={160} placeholder="Siquijor, un musée, un café…"/></label><button className="button" disabled={busy||!query.trim()}>Rechercher</button></form>}
  {mode!=='trip'&&<div className="discovery-filters" aria-label="Catégories"><button aria-pressed={category==='all'} onClick={()=>setCategory('all')}>Tout</button>{Object.entries(categories).map(([value,label])=><button key={value} aria-pressed={category===value} onClick={()=>{request.current?.abort();request.current=null;setBusy(false);setCategory(value as Category);setSelected(null)}}>{symbols[value as Category]} {label}</button>)}</div>}
  {mode==='trip'&&trip?<nav className="map-day-strip" aria-label="Journées du voyage"><button aria-pressed={day==='*'} onClick={()=>{setDay('*');setSelected(null)}}>Voyage entier</button>{tripDates.map(date=><button key={date} aria-pressed={day===date} onClick={()=>{setDay(date);setSelected(null)}}><strong>J{dayNumber(trip.departure,date)}</strong><small>{new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(`${date}T12:00:00Z`))}{!tripStops.some(stop=>stop.date===date)?' · libre':''}</small></button>)}{tripStops.some(stop=>!stop.date)&&<button aria-pressed={day==='undated'} onClick={()=>{setDay('undated');setSelected(null)}}>À programmer</button>}</nav>:mode!=='explore'&&<div className="discovery-toolbar"><label>Journée<select value={day} onChange={e=>{setDay(e.target.value);setSelected(null)}}><option value="*">Toutes les journées</option>{[...new Set(tripPlaces.flatMap(p=>p.date?[p.date]:[]))].sort().map(d=><option key={d}>{d}</option>)}</select></label></div>}
  {mode==='trip'&&tripStay&&tripStay.days.length>0&&<nav className="discovery-toolbar" aria-label="Jours du séjour sans date"><strong>Jours du séjour sans date</strong>{tripStay.days.map((item,index)=><button key={item.id} aria-pressed={day===`stay:${item.id}`} onClick={()=>{setDay(`stay:${item.id}`);setSelected(null);setSelectedStopId('')}}>Jour du séjour {index+1} · {item.title}</button>)}</nav>}
  {trip&&mode==='trip'&&trip.endDate&&tripDates.length>0&&tripDates[tripDates.length-1]<trip.endDate&&<p className="discovery-note">Affichage limité aux 90 premiers jours pour garder la carte fluide. Le programme complet reste disponible dans le planificateur.</p>}
  <div className={`discovery-toolbar ${mode==='trip'?'map-trip-controls':''}`}><button className="text-button" onClick={fit}>Cadrer les lieux affichés</button><button className="text-button" onClick={locate}>{locationBusy?'Relancer la localisation':'Me situer'}</button>{mode==='trip'&&<><label><input type="checkbox" checked={wishesOnly} onChange={e=>setWishesOnly(e.target.checked)}/> Mes envies uniquement</label><label><input type="checkbox" checked={lines} onChange={e=>setLines(e.target.checked)}/> Liaisons indicatives</label></>}<button className="text-button" aria-pressed={listOnly} onClick={()=>setListOnly(v=>!v)}>{listOnly?'Afficher la carte':'Utiliser la liste'}</button>{mode==='explore'&&<button className="button" disabled={busy} onClick={()=>void search(true)}>Rechercher dans cette zone</button>}</div>
  {location&&<p className="discovery-note" role="status">Ma position · précision ±{Math.round(location.accuracy)} m · utilisée ici seulement, non enregistrée. Elle ne modifie pas l’ordre du programme.</p>}
  {locationBusy&&<p className="discovery-note" role="status">Localisation en cours…</p>}
  {mode==='explore'&&<p className="discovery-note">{area?'Dernière recherche affichée : déplacez la carte puis relancez pour changer de zone.':'Sélection de cinq lieux dans les Visayas · sources consultées le 25 septembre 2026.'} Recherche autour du centre : 5 km. <button className="text-button" onClick={()=>{request.current?.abort();request.current=null;setBusy(false);setResults([]);setArea(null);setCategory('all');setSelected(null);setMessage('');map.current?.setView([9.8,123.7],8)}}>Revoir la sélection Visayas</button></p>}
  {lines&&mode==='trip'&&<p className="discovery-note">Pointillés : liaisons indicatives, sans itinéraire routier ni durée calculée.</p>}
  <p role="status" aria-live="polite">{busy?'Recherche en cours…':selected?'':message}</p>
  <div className={`discovery-layout ${mode==='trip'&&trip?'map-first-layout':''}`}><div className="discovery-map-wrap" hidden={listOnly}><div className="discovery-canvas" ref={target} aria-label="Carte des découvertes"/>{tileError&&<p>Fond de carte indisponible. Les fiches restent accessibles dans la liste. <button onClick={()=>{setTileError(false);map.current?.eachLayer(l=>{if(l instanceof L.TileLayer)l.redraw()})}}>Réessayer</button></p>}</div>
   {mode==='trip'&&trip?<aside className="discovery-list trip-stop-list" aria-label={wishesOnly?'Envies conservées':'Étapes prévues'}>{wishesOnly?<><h2>Envies du voyage</h2>{tripPlaces.filter(place=>place.kind==='wish').map(place=><button key={place.id} className="discovery-place" aria-pressed={selected?.id===place.id} onClick={()=>{setSelected(place);map.current?.panTo([place.lat,nearLongitude(place.lon,map.current.getCenter().lng)],{animate:false})}}><span aria-hidden="true">{symbols[place.category]}</span><span><strong>{place.name}</strong><small>Envie géolocalisée</small></span></button>)}{!tripPlaces.some(place=>place.kind==='wish')&&<p>Aucune envie conservée pour ce voyage.</p>}</>:<><h2>{day==='*'?'Votre programme':day==='undated'?'À programmer':relativeDay?`${relativeDay.title} · sans date`:`Étapes · ${day}`}</h2>{tripStay&&<div className="stay-summary"><span aria-hidden="true">⌂</span><div><strong>Centre du séjour · {tripStay.anchor.name}</strong><small>Centre choisi pour explorer · pas un hébergement déclaré</small></div></div>}{relativeDay?<>{stayPlaces.length?stayPlaces.map(place=><button key={place.id} className="discovery-place" aria-pressed={selected?.id===place.id} onClick={()=>{select(place);map.current?.panTo([place.lat,nearLongitude(place.lon,map.current.getCenter().lng)],{animate:false})}}><span aria-hidden="true">{symbols[place.category]}</span><span><strong>{place.name}</strong><small>Jour du séjour sans date</small></span></button>):<p>Aucun lieu prévu pour ce jour du séjour : journée libre.</p>}</>:(()=>{const visibleStops=visibleTripStops.map((stop,index)=>({stop,index}));return visibleStops.length?visibleStops.map(({stop,index})=>{const place=tripPlaces.find(item=>item.id===`stop-${tripId}-${stop.id}`);return <div className={`trip-stop-row ${stop.kind==='stay'?'is-stay':''}`} key={stop.id}><span className="trip-stop-number" aria-label={`Étape ${index+1}`}>{index+1}</span><button className="discovery-place" aria-pressed={Boolean(place?selected?.id===place.id:selectedStopId===stop.id&&!selected)} onClick={()=>{setSelectedStopId(stop.id);if(place){setSelected(place);setMessage('');map.current?.panTo([place.lat,nearLongitude(place.lon,map.current.getCenter().lng)],{animate:false})}else{setSelected(null);setMessage('Cette étape n’a pas encore de position. Situez-la dans Modifier le parcours.')}}}><span aria-hidden="true">{stop.kind==='stay'?'⌂':symbols[isCategory(stop.category)?stop.category:categoryFor(stop.kind)]}</span><span><strong>{stop.place}</strong><small>{stop.date??'À programmer'}{stop.kind==='stay'?' · Hébergement':''}{!stop.point?' · À situer':''}</small></span></button>{stop.point&&<a className="text-button" href={`https://www.google.com/maps/dir/?api=1&destination=${stop.point.lat},${stop.point.lon}`} target="_blank" rel="noreferrer">Y aller ↗</a>}{(place?.chapterId??linkedChapterId(trip.id,stop.id,stop.chapterId))?<a className="text-button" href={`#journey/${encodeURIComponent(trip.id)}/${encodeURIComponent((place?.chapterId??linkedChapterId(trip.id,stop.id,stop.chapterId))!)}`}>Lire le souvenir ↗</a>:<a className="text-button" href={`#trip-create/${encodeURIComponent(trip.id)}/planned/${encodeURIComponent(stop.id)}/${encodeURIComponent(stop.place)}`}>Raconter ↗</a>}</div>}) : <p>{day==='*'?'Aucune étape planifiée. Vos journées restent libres.':'Aucune étape prévue ce jour : journée libre.'}</p>})()}{day==='*'&&tripStops.some(stop=>!stop.date)&&<p className="discovery-note">Les étapes « À programmer » sont incluses dans cette vue d’ensemble.</p>}{!wishesOnly&&tripPlaces.filter(place=>place.kind==='wish').length>0&&<div className="trip-wish-list"><h3>Envies situées</h3>{tripPlaces.filter(place=>place.kind==='wish').map(place=><button key={place.id} className="discovery-place" aria-pressed={selected?.id===place.id} onClick={()=>{setSelected(place);map.current?.panTo([place.lat,nearLongitude(place.lon,map.current.getCenter().lng)],{animate:false})}}><span aria-hidden="true">{symbols[place.category]}</span><span><strong>{place.name}</strong><small>Envie conservée</small></span></button>)}</div>}<details className="trip-wishes"><summary>{trip?.plan?.ideas.length??0} envies conservées</summary>{(trip?.plan?.ideas??[]).map(idea=><p key={idea.id}>{idea.text}{idea.point?'':' · sans position'}</p>)}</details></>}</aside>:<aside className="discovery-list" aria-label="Lieux affichés"><h2>{places.length} lieu{places.length===1?'':'x'}</h2>{!places.length&&<p>{mode==='memories'?'Reliez vos chapitres à des étapes situées sur la carte pour les retrouver ici.':'Aucun lieu pour ces filtres. Changez de catégorie, de journée ou lancez une recherche.'}</p>}{places.map(p=><button key={p.id} className="discovery-place" aria-pressed={selected?.id===p.id} onClick={()=>{select(p);map.current?.panTo([p.lat,nearLongitude(p.lon,map.current.getCenter().lng)],{animate:false})}}><span aria-hidden="true">{symbols[p.category]}</span><span><strong>{p.name}</strong><small>{categories[p.category]}{p.kind==='wish'?' · Envie':''}{p.date?` · ${p.date}`:''}{location?` · ${distance(location,p).toFixed(1)} km à vol d’oiseau`:''}</small></span></button>)}</aside>}
  </div>
  {selected&&<section className="discovery-detail" tabIndex={-1} aria-label="Fiche du lieu"><button className="text-button" onClick={closeDetail}>Fermer la fiche ×</button><div>{selected.photo&&<figure><img src={selected.photo} alt={selected.name}/>{selected.credit&&<figcaption>{selected.credit}{selected.id&&discoveries.some(p=>p.id===selected.id)&&<> · <a href="/assets/visayas/credits.json" target="_blank" rel="noreferrer">Source et licence de la photo</a></>}</figcaption>}</figure>}<div><p className="eyebrow">{categories[selected.category]}</p><h2>{selected.name}</h2>{selected.description&&<p style={{whiteSpace:'pre-wrap'}}>{selected.description}</p>}{selected.phone&&/^[+\d ().;-]+$/.test(selected.phone)&&<a href={`tel:${selected.phone.replace(/[^+\d]/g,'')}`}>{selected.phone}</a>}{selected.source&&<p><a href={selected.source} target="_blank" rel="noreferrer">Consulter la source ↗</a></p>}<a className="text-button" href={`https://www.google.com/maps/dir/?api=1&destination=${selected.lat},${selected.lon}`} target="_blank" rel="noreferrer">Y aller avec Google Maps ↗</a>{selected.chapterId&&<a className="button" href={`#journey/${encodeURIComponent(selected.tripId!)}/${encodeURIComponent(selected.chapterId)}`}>Lire le souvenir</a>}</div></div>
   {message&&<p role="status">{message}</p>}{trip?<div className="discovery-save"><p>Garder ce lieu dans <strong>{trip.destination}</strong></p><button className="button button-outline" onClick={()=>save(false)}>Garder cette envie</button><label>Ajouter à une journée<input type="date" value={date} min={trip.departure} max={trip.endDate} onChange={e=>setDate(e.target.value)}/></label><button className="button" onClick={()=>save(true)}>{date?'Ajouter à cette journée':'Ajouter sans date'}</button><a href={`#plan/${encodeURIComponent(trip.id)}`}>Voir le programme</a></div>:<p>Choisissez un voyage en haut de la carte pour enregistrer ce lieu. <a href="#carnet">Créer un voyage</a></p>}
  </section>}
  {mode!=='explore'&&<p className="discovery-note">Les étapes et envies sans coordonnées restent dans le programme. Un souvenir apparaît ici lorsqu’un chapitre est relié à une étape géolocalisée.</p>}
  {trip&&<p><a href={`#plan/${encodeURIComponent(trip.id)}/map`}>Modifier le parcours, les positions et les transports →</a></p>}
  <p className="discovery-note">Les recherches utilisent Photon / OpenStreetMap. Couverture variable, horaires et disponibilités à vérifier auprès des lieux. Carte et recherches nécessitent une connexion ; vos étapes et envies enregistrées restent sur cet appareil. La localisation n’est demandée qu’au toucher de « Me situer ». Google Maps reçoit la destination lorsque vous ouvrez « Y aller ».</p>
 </section>
}
import {validateUpcomingTrips as validate} from '../upcoming-trips'
function categoryForReverse(category:Category):'visit'|'stay'|'meal' {return category==='stay'?'stay':category==='food'?'meal':'visit'}
