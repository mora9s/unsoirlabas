export const categories = { nature: 'Nature', culture: 'Culture', food: 'Manger', stay: 'Dormir', practical: 'Pratique' } as const
export type Category = keyof typeof categories
export const symbols: Record<Category,string> = { nature:'♧', culture:'⌂', food:'♨', stay:'☾', practical:'ⓘ' }
export type Place = { id:string; name:string; lat:number; lon:number; category:Category; description?:string; source?:string; photo?:string; credit?:string; chapterId?:string; tripId?:string; date?:string; kind?:'stop'|'wish'|'memory'; phone?:string }
export const discoveries: Place[] = [
 {id:'magellan',name:'Croix de Magellan',lat:10.2934,lon:123.9019,category:'culture',description:'Un repère du centre historique de Cebu. Position indicative ; vérifiez les conditions de visite.',source:'https://itsmorefuninthephilippines.co.uk/wp-content/uploads/PDOTL_CebuBohol_Web.pdf',photo:'/assets/visayas/cebu.jpg',credit:'Kingphoto23 · CC BY-SA 3.0'},
 {id:'chocolate',name:'Chocolate Hills, Carmen',lat:9.7973,lon:124.1675,category:'nature',description:'Les collines de Bohol, à découvrir depuis les points de vue de Carmen. Position indicative.',source:'https://philippines.travel/destinations',photo:'/assets/visayas/bohol.jpg',credit:'Wolfgang Hägele · CC BY-SA 4.0'},
 {id:'cambugahay',name:'Chutes de Cambugahay',lat:9.139,lon:123.627,category:'nature',description:'Des cascades à découvrir près de Lazi, à Siquijor. Vérifiez localement l’accès et les conditions de baignade.',source:'https://www.tourism.gov.ph/destination/nir/siquijor/',photo:'/assets/visayas/siquijor.jpg',credit:'Lawrence Ruiz · CC BY-SA 4.0'},
 {id:'lazi',name:'Église et couvent de Lazi',lat:9.128,lon:123.635,category:'culture',description:'Une étape patrimoniale au sud de Siquijor. Position indicative ; accès à vérifier sur place.',source:'https://www.tpb.gov.ph/wp-content/uploads/2025/02/Bid-Bulletin-2025-006-TO-for-Taiwan.pdf'},
 {id:'apo',name:'Apo Island',lat:9.078,lon:123.271,category:'nature',description:'Une île au large de Negros oriental. Organisez la traversée et les activités selon les conditions locales.',source:'https://philippines.travel/destinations',photo:'/assets/visayas/apo.jpg',credit:'CariolaMinze · CC BY-SA 4.0'},
]
export function distance(a:{lat:number;lon:number},b:{lat:number;lon:number}) {
 const rad=Math.PI/180, dlat=(b.lat-a.lat)*rad,dlon=(b.lon-a.lon)*rad
 return 6371*2*Math.asin(Math.min(1,Math.sqrt(Math.sin(dlat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dlon/2)**2)))
}
export function categoryFor(kind?:string):Category { return kind==='stay'?'stay':kind==='meal'?'food':kind==='transit'?'practical':'culture' }
export function isCategory(value?:string):value is Category { return !!value && Object.hasOwn(categories,value) }
const cache = new Map<string,Place[]>()
let lastRequest=0
export async function nearby(center:{lat:number;lon:number},category:Category,signal:AbortSignal):Promise<Place[]> {
 const key=`${center.lat.toFixed(3)},${center.lon.toFixed(3)},${category}`
 if(cache.has(key))return cache.get(key)!
 if(Date.now()-lastRequest<30000)throw new Error('Patientez 30 secondes entre deux recherches de zone.')
 lastRequest=Date.now()
 const tags:Record<Category,string[]>={nature:['natural:beach','natural:peak','waterway:waterfall','tourism:viewpoint'],culture:['tourism:museum','tourism:attraction','historic'],food:['amenity:restaurant','amenity:cafe'],stay:['tourism:hotel','tourism:hostel','tourism:guest_house','tourism:camp_site'],practical:['amenity:pharmacy','amenity:drinking_water','amenity:toilets','amenity:atm']}
 const params=new URLSearchParams({lat:String(center.lat),lon:String(center.lon),radius:'5',limit:'30',lang:'fr'})
 tags[category].forEach(tag=>params.append('osm_tag',tag))
 const response=await fetch(`https://photon.komoot.io/reverse?${params}`,{signal})
 if(!response.ok)throw new Error('Les lieux proches sont indisponibles. Recherchez un établissement par son nom ou consultez vos envies enregistrées.')
 const data=await response.json()
 if(!Array.isArray(data.features))throw new Error('Réponse de recherche illisible. Réessayez plus tard.')
 const places:Place[]=data.features.flatMap((item:{geometry?:{type:string;coordinates:number[]};properties?:{osm_type?:string;osm_id?:number;name?:string;street?:string;city?:string;extra?:Record<string,string>}})=>{
   const p=item.properties,lat=item.geometry?.coordinates[1],lon=item.geometry?.coordinates[0]
   const type=p?.osm_type==='N'?'node':p?.osm_type==='W'?'way':p?.osm_type==='R'?'relation':null
   if(item.geometry?.type!=='Point'||typeof lat!=='number'||typeof lon!=='number'||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180||!type||!Number.isSafeInteger(p?.osm_id)||distance(center,{lat,lon})>5.1)return []
   return [{id:`osm-${type}-${p!.osm_id}`,name:(p?.name||categories[category]).slice(0,160),lat,lon,category,source:`https://www.openstreetmap.org/${type}/${p!.osm_id}`,description:[p?.street,p?.city].filter(Boolean).join(', '),phone:p?.extra?.phone||p?.extra?.['contact:phone']}]
 })
 cache.set(key,places);if(cache.size>20)cache.delete(cache.keys().next().value!)
 return places
}
