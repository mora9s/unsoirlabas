import {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {categories,symbols,discoveries,nearby,distance,categoryFor,isCategory} from '../discovery'
import type {Place,Category} from '../discovery'
import {readUpcoming,upcomingKey} from '../upcoming-trips'
import {readJournals} from '../trip-journals'
import {createId} from '../id'
import {coverOf} from '../journal'
import {nearLongitude,routeLongitudeOrigin} from '../route-geography'
import './discovery-map.css'

export default function DiscoveryMap({id}:{id?:string}) {
 const [stored,setStored]=useState(readUpcoming)
 const [journals,setJournals]=useState(readJournals)
 const [tripId,setTripId]=useState(id??'')
 const trip=stored.trips.find(t=>t.id===tripId)
 const [mode,setMode]=useState<'explore'|'trip'|'memories'>(id?'trip':'explore')
 const [category,setCategory]=useState<Category|'all'>('all')
 const [day,setDay]=useState('*')
 const [wishesOnly,setWishesOnly]=useState(false)
 const [lines,setLines]=useState(false)
 const [selected,setSelected]=useState<Place|null>(null)
 const [query,setQuery]=useState('')
 const [results,setResults]=useState<Place[]>([])
 const [busy,setBusy]=useState(false)
 const [message,setMessage]=useState('')
 const [date,setDate]=useState('')
 const [listOnly,setListOnly]=useState(false)
 const [tileError,setTileError]=useState(false)
 const [revision,setRevision]=useState(0)
 const [area,setArea]=useState<{lat:number;lon:number}|null>(null)
 const [location,setLocation]=useState<{lat:number;lon:number}|null>(null)
 const target=useRef<HTMLDivElement>(null), map=useRef<L.Map|null>(null), layer=useRef<L.LayerGroup|null>(null)
 const request=useRef<AbortController|null>(null)
 const selectRef=useRef<(p:Place)=>void>(()=>{})
 const initial=useRef(stored.trips.find(t=>t.id===id)?.plan?.stops.flatMap(s=>s.point?[s.point]:[])??[])
 const live=useRef(true)
 const tripPlaces=useMemo<Place[]>(()=>stored.trips.filter(t=>!tripId||t.id===tripId).flatMap(t=>{
   const journal=journals.data.journals.find(j=>j.tripId===t.id)
   return [
    ...(t.plan?.stops??[]).flatMap(s=>{const chapter=journal?.chapters.find(c=>c.id===s.chapterId),photo=chapter&&coverOf(chapter);return s.point?[{id:`stop-${t.id}-${s.id}`,name:s.place,...s.point,category:isCategory(s.category)?s.category:categoryFor(s.kind),description:[s.address,s.booking&&`Réservation : ${s.booking}`,s.notes].filter(Boolean).join('\n'),tripId:t.id,chapterId:chapter?.id,date:s.date,kind:'stop' as const,photo:photo?.src,credit:photo?.name.includes(' | Crédit :')?photo.name.split(' | Crédit :')[1]:undefined}]:[]}),
    ...(t.plan?.ideas??[]).flatMap(i=>i.point?[{id:`wish-${t.id}-${i.id}`,name:i.text,...i.point,category:isCategory(i.category)?i.category:'culture',source:i.source,kind:'wish' as const,tripId:t.id}]:[]),
   ]
 }),[stored,journals,tripId])
 const places=useMemo(()=>{
   let items=mode==='explore'?(area?results:[...discoveries,...results]):tripPlaces
   if(mode==='memories')items=items.filter(p=>p.chapterId)
   if(mode==='trip'&&wishesOnly)items=items.filter(p=>p.kind==='wish')
   if(mode!=='explore'&&day!=='*')items=items.filter(p=>p.date===day)
   if(category!=='all')items=items.filter(p=>p.category===category)
   const origin=location??area
   return origin?[...items].sort((a,b)=>distance(a,origin)-distance(b,origin)):items
 },[mode,area,results,tripPlaces,wishesOnly,day,category,location])
 function closeDetail(){const opener=document.querySelector<HTMLButtonElement>('.discovery-place[aria-pressed=true]');setSelected(null);requestAnimationFrame(()=>opener?.focus({preventScroll:true}))}
 useEffect(()=>{const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'&&selected)closeDetail()};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape)},[selected])
 function select(p:Place){setSelected(p);setDate(day==='*'?'':day);setMessage('')}
 useEffect(()=>{selectRef.current=select})
 useEffect(()=>{
   live.current=true
   const refresh=()=>{setStored(readUpcoming());setJournals(readJournals())}
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
    const p=items[0],many=items.length>1
    const marker=L.marker([p.lat,nearLongitude(p.lon,origin)],{title:many?`${items.length} lieux proches`:p.name,alt:many?`${items.length} lieux proches`:p.name,icon:L.divIcon({className:`discovery-pin ${p.category} ${selected?.id===p.id?'selected':''}`,html:`<span>${many?items.length:symbols[p.category]}</span>`,iconSize:[36,36],iconAnchor:[18,18]})}).addTo(group)
    const text=document.createElement('span');text.textContent=many?`${items.length} lieux · zoomez ou utilisez la liste`:p.name;marker.bindTooltip(text)
    marker.on('click',()=>many?instance.setView(marker.getLatLng(),Math.min(instance.getZoom()+2,19)):selectRef.current(p))
   })
   if(lines&&mode==='trip')stored.trips.filter(t=>!tripId||t.id===tripId).forEach(t=>{
    const stops=t.plan?.stops??[];stops.forEach((s,i)=>{const prev=stops[i-1];if(s.point&&prev?.point&&(day==='*'||s.date===day&&prev.date===day)){const lon=nearLongitude(prev.point.lon,origin);L.polyline([[prev.point.lat,lon],[s.point.lat,nearLongitude(s.point.lon,lon)]],{color:'#47786c',dashArray:'4 8',weight:2,interactive:false}).addTo(group)}})
   })
   if(location)L.circleMarker([location.lat,nearLongitude(location.lon,origin)],{radius:8,color:'#2767bb',fillOpacity:1}).addTo(group)
 },[places,selected,revision,lines,mode,stored,tripId,day,location])
 const fit=useCallback(()=>{const points=places;if(!points.length)return;const origin=routeLongitudeOrigin(points.map(p=>p.lon));map.current?.fitBounds(points.map(p=>[p.lat,nearLongitude(p.lon,origin)] as L.LatLngTuple),{padding:[36,36],maxZoom:14})},[places])
 useEffect(()=>{if(mode!=='explore')fit()},[mode,tripId,fit])
 useEffect(()=>{if(selected){const detail=document.querySelector<HTMLElement>('.discovery-detail');if(window.innerWidth>760)detail?.scrollIntoView({behavior:'instant',block:'nearest'});detail?.focus({preventScroll:true})}},[selected])
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
 function save(asStop:boolean){
   if(!selected)return
   try{
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
    localStorage.setItem(upcomingKey,JSON.stringify(latest.trips));setStored(latest);window.dispatchEvent(new Event('upcoming-trips-updated'));setMessage(asStop?'Étape ajoutée au programme. Choisissez ensuite son transport si nécessaire.':'Envie enregistrée dans votre voyage et incluse dans les sauvegardes ZIP.')
   }catch(error){setMessage(error instanceof DOMException?'Stockage indisponible ou plein. Rien n’a été ajouté.':error instanceof Error?error.message:'Enregistrement impossible.')}
 }
 function locate(){
   if(!navigator.geolocation){setMessage('La localisation n’est pas disponible. Recherchez une ville.');return}
   setMessage('Localisation en cours…')
   navigator.geolocation.getCurrentPosition(position=>{if(!live.current)return;const p={lat:position.coords.latitude,lon:position.coords.longitude};setLocation(p);map.current?.setView([p.lat,p.lon],13);setMessage('Position utilisée pour cette visite uniquement. Choisissez une catégorie puis recherchez cette zone.')},()=>{if(live.current)setMessage('Position indisponible ou autorisation refusée. Vous pouvez chercher une ville.')},{timeout:10000,maximumAge:60000})
 }
 return <section className="discovery page-width">
  <header><p className="eyebrow">Laisser une place à la découverte</p><h1>Qu’y a-t-il à découvrir ici ?</h1><p>Des lieux à explorer, des envies à garder et les souvenirs de vos voyages.</p></header>
  {(stored.error||journals.error)&&<p role="alert">{stored.error||journals.error}</p>}
  <div className="discovery-toolbar"><div className="discovery-modes" aria-label="Vue de la carte">{([['explore','Explorer'],['trip','Mon voyage'],['memories','Mes souvenirs']] as const).map(([value,label])=><button key={value} aria-pressed={mode===value} onClick={()=>{request.current?.abort();request.current=null;setBusy(false);setMode(value);setCategory('all');setSelected(null);setMessage('')}}>{label}</button>)}</div>
   <label>Voyage<select disabled={Boolean(id)} value={tripId} onChange={e=>{setTripId(e.target.value);setDay('*');setDate('');if(mode!=='explore')setSelected(null)}}><option value="">Tous mes voyages</option>{stored.trips.map(t=><option key={t.id} value={t.id}>{t.destination}</option>)}</select></label>{id&&<a href="#explore">Tous mes voyages</a>}
  </div>
  {mode==='explore'&&<form className="discovery-search" onSubmit={e=>{e.preventDefault();void search(false)}}><label>Une destination ou un lieu<input value={query} onChange={e=>setQuery(e.target.value)} maxLength={160} placeholder="Siquijor, un musée, un café…"/></label><button className="button" disabled={busy||!query.trim()}>Rechercher</button></form>}
  <div className="discovery-filters" aria-label="Catégories"><button aria-pressed={category==='all'} onClick={()=>setCategory('all')}>Tout</button>{Object.entries(categories).map(([value,label])=><button key={value} aria-pressed={category===value} onClick={()=>{request.current?.abort();request.current=null;setBusy(false);setCategory(value as Category);setSelected(null)}}>{symbols[value as Category]} {label}</button>)}</div>
  {mode!=='explore'&&<div className="discovery-toolbar"><label>Journée<select value={day} onChange={e=>{setDay(e.target.value);setSelected(null)}}><option value="*">Toutes les journées</option>{[...new Set(tripPlaces.flatMap(p=>p.date?[p.date]:[]))].sort().map(d=><option key={d}>{d}</option>)}</select></label>{mode==='trip'&&<><label><input type="checkbox" checked={wishesOnly} onChange={e=>setWishesOnly(e.target.checked)}/> Mes envies uniquement</label><label><input type="checkbox" checked={lines} onChange={e=>setLines(e.target.checked)}/> Afficher les liaisons</label></>}</div>}
  <div className="discovery-toolbar"><button className="text-button" onClick={fit}>Cadrer les lieux affichés</button><button className="text-button" onClick={locate}>Autour de moi</button><button className="text-button" aria-pressed={listOnly} onClick={()=>setListOnly(v=>!v)}>{listOnly?'Afficher la carte':'Utiliser la liste'}</button>{mode==='explore'&&<button className="button" disabled={busy} onClick={()=>void search(true)}>Rechercher dans cette zone</button>}</div>
  {mode==='explore'&&<p className="discovery-note">{area?'Dernière recherche affichée : déplacez la carte puis relancez pour changer de zone.':'Sélection de cinq lieux dans les Visayas · sources consultées le 25 septembre 2026.'} Recherche autour du centre : 5 km. <button className="text-button" onClick={()=>{request.current?.abort();request.current=null;setBusy(false);setResults([]);setArea(null);setCategory('all');setSelected(null);setMessage('');map.current?.setView([9.8,123.7],8)}}>Revoir la sélection Visayas</button></p>}
  {lines&&mode==='trip'&&<p className="discovery-note">Pointillés : liaisons indicatives, sans itinéraire routier ni durée calculée.</p>}
  <p role="status" aria-live="polite">{busy?'Recherche en cours…':selected?'':message}</p>
  <div className="discovery-layout"><div className="discovery-map-wrap" hidden={listOnly}><div className="discovery-canvas" ref={target} aria-label="Carte des découvertes"/>{tileError&&<p>Fond de carte indisponible. Les fiches restent accessibles dans la liste. <button onClick={()=>{setTileError(false);map.current?.eachLayer(l=>{if(l instanceof L.TileLayer)l.redraw()})}}>Réessayer</button></p>}</div>
   <aside className="discovery-list" aria-label="Lieux affichés"><h2>{places.length} lieu{places.length===1?'':'x'}</h2>{!places.length&&<p>{mode==='memories'?'Reliez vos chapitres à des étapes situées sur la carte pour les retrouver ici.':'Aucun lieu pour ces filtres. Changez de catégorie, de journée ou lancez une recherche.'}</p>}{places.map(p=><button key={p.id} className="discovery-place" aria-pressed={selected?.id===p.id} onClick={()=>{select(p);map.current?.panTo([p.lat,nearLongitude(p.lon,map.current.getCenter().lng)],{animate:false})}}><span aria-hidden="true">{symbols[p.category]}</span><span><strong>{p.name}</strong><small>{categories[p.category]}{p.kind==='wish'?' · Envie':''}{p.date?` · ${p.date}`:''}{location?` · ${distance(location,p).toFixed(1)} km à vol d’oiseau`:''}</small></span></button>)}</aside>
  </div>
  {selected&&<section className="discovery-detail" tabIndex={-1} aria-label="Fiche du lieu"><button className="text-button" onClick={closeDetail}>Fermer la fiche ×</button><div>{selected.photo&&<figure><img src={selected.photo} alt={selected.name}/>{selected.credit&&<figcaption>{selected.credit}{selected.id&&discoveries.some(p=>p.id===selected.id)&&<> · <a href="/assets/visayas/credits.json" target="_blank" rel="noreferrer">Source et licence de la photo</a></>}</figcaption>}</figure>}<div><p className="eyebrow">{categories[selected.category]}</p><h2>{selected.name}</h2>{selected.description&&<p style={{whiteSpace:'pre-wrap'}}>{selected.description}</p>}{selected.phone&&/^[+\d ().;-]+$/.test(selected.phone)&&<a href={`tel:${selected.phone.replace(/[^+\d]/g,'')}`}>{selected.phone}</a>}{selected.source&&<p><a href={selected.source} target="_blank" rel="noreferrer">Consulter la source ↗</a></p>}<a className="text-button" href={`https://www.google.com/maps/dir/?api=1&destination=${selected.lat},${selected.lon}`} target="_blank" rel="noreferrer">Y aller avec Google Maps ↗</a>{selected.chapterId&&<a className="button" href={`#journey/${encodeURIComponent(selected.tripId!)}/${encodeURIComponent(selected.chapterId)}`}>Lire le souvenir</a>}</div></div>
   {message&&<p role="status">{message}</p>}{trip?<div className="discovery-save"><p>Garder ce lieu dans <strong>{trip.destination}</strong></p><button className="button button-outline" onClick={()=>save(false)}>Garder cette envie</button><label>Ajouter à une journée<input type="date" value={date} min={trip.departure} max={trip.endDate} onChange={e=>setDate(e.target.value)}/></label><button className="button" onClick={()=>save(true)}>{date?'Ajouter à cette journée':'Ajouter sans date'}</button><a href={`#plan/${encodeURIComponent(trip.id)}`}>Voir le programme</a></div>:<p>Choisissez un voyage en haut de la carte pour enregistrer ce lieu. <a href="#carnet">Créer un voyage</a></p>}
  </section>}
  {mode!=='explore'&&<p className="discovery-note">Les étapes et envies sans coordonnées restent dans le programme. Un souvenir apparaît ici lorsqu’un chapitre est relié à une étape géolocalisée.</p>}
  {trip&&<p><a href={`#plan/${encodeURIComponent(trip.id)}/map`}>Modifier le parcours, les positions et les transports →</a></p>}
  <p className="discovery-note">Les recherches utilisent Photon / OpenStreetMap. Couverture variable, horaires et disponibilités à vérifier auprès des lieux. Carte et recherches nécessitent une connexion ; vos étapes et envies enregistrées restent sur cet appareil. La localisation n’est demandée qu’au toucher d’« Autour de moi ». Google Maps reçoit la destination lorsque vous ouvrez « Y aller ».</p>
 </section>
}
import {validateUpcomingTrips as validate} from '../upcoming-trips'
function categoryForReverse(category:Category):'visit'|'stay'|'meal' {return category==='stay'?'stay':category==='food'?'meal':'visit'}
