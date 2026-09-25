import {distanceKm,clamp,mix,ease} from './core.js';
export const isGround=mode=>mode==='car'||mode==='walk';
export function routeKey(j){return [j.mode,j.from.lon,j.from.lat,j.to.lon,j.to.lat].join('|');}
export function parseRouteResponse(body,mode){
 if(body?.code==='NoRoute'||body?.code==='NoSegment')throw new Error(mode==='walk'?'Aucun parcours à pied trouvé près de ces points. Rapproche-les d’un chemin ou d’une rue.':'Aucun itinéraire routier trouvé. Rapproche les points d’une route accessible.');
 const route=body?.routes?.[0],coords=route?.geometry?.coordinates;
 if(body?.code!=='Ok'||!Array.isArray(coords)||coords.length<2||!Number.isFinite(route.distance)||route.distance<=0)throw new Error('Le service n’a pas renvoyé d’itinéraire utilisable. Réessaie.');
 if(coords.some(p=>!Array.isArray(p)||!Number.isFinite(p[0])||!Number.isFinite(p[1])||Math.abs(p[0])>180||Math.abs(p[1])>90))throw new Error('Les coordonnées du parcours sont invalides.');
 const snapped=(body.waypoints||[]).map(p=>Number.isFinite(p.distance)?p.distance:0);
 return {coordinates:coords.map(p=>p.slice(0,2)),distance:route.distance,duration:route.duration,snapped,source:'OSRM / OpenStreetMap'};
}
export function createRouteSampler(coordinates){
 const points=[coordinates[0]],cumulative=[0];let length=0;
 for(let i=1;i<coordinates.length;i++){const a=points.at(-1),b=coordinates[i],d=distanceKm({lon:a[0],lat:a[1]},{lon:b[0],lat:b[1]})*1000;if(d<.0001)continue;length+=d;points.push(b);cumulative.push(length);}
 if(points.length<2||!length)throw new Error('Le parcours ne contient pas de déplacement.');
 function indexAt(t){const target=clamp(t)*length;let lo=0,hi=cumulative.length-1;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(cumulative[mid]<=target)lo=mid;else hi=mid-1;}return lo;}
 function at(t){t=clamp(t);const i=indexAt(t);if(i===points.length-1)return [...points[i]];const fraction=(t*length-cumulative[i])/(cumulative[i+1]-cumulative[i]),a=points[i],b=points[i+1],delta=((b[0]-a[0]+540)%360)-180;return [((a[0]+delta*fraction+540)%360)-180,mix(a[1],b[1],fraction)];}
 return {points,cumulative,length,indexAt,at};
}
export function groundAltitude(mode,km,t){const meters=mode==='walk'?clamp(160+km*14,170,900):clamp(750+km*38,850,12000);const departure=ease(t/.16),arrival=ease((t-.84)/.16);return meters*mix(.78,1,departure)*mix(1,.72,arrival)/3185500;}
const aborted=()=>new DOMException('Aborted','AbortError');
function wait(ms,signal){return new Promise((resolve,reject)=>{if(signal?.aborted){reject(aborted());return;}let timer;const cancel=()=>{clearTimeout(timer);reject(aborted());};timer=setTimeout(()=>{signal?.removeEventListener('abort',cancel);resolve();},ms);signal?.addEventListener('abort',cancel,{once:true});});}
export class RouteService{
 constructor({fetcher=(...args)=>globalThis.fetch(...args),interval=1100}={}){this.fetcher=fetcher;this.interval=interval;this.nextRequest=0;this.cache=new Map();}
 async get(j,{signal}={}){
  if(!isGround(j.mode))throw new Error('Le calcul routier est réservé à la voiture et à la marche.');const key=routeKey(j);if(signal?.aborted)throw aborted();if(this.cache.has(key))return this.cache.get(key);
  const start=Math.max(Date.now(),this.nextRequest);this.nextRequest=start+this.interval;await wait(Math.max(0,start-Date.now()),signal);if(signal?.aborted)throw aborted();
  const controller=new AbortController(),cancel=()=>controller.abort();signal?.addEventListener('abort',cancel,{once:true});const timer=setTimeout(cancel,22000),profile=j.mode==='walk'?'foot':'car',radius=j.mode==='walk'?150:350;
  const coordinates=`${j.from.lon},${j.from.lat};${j.to.lon},${j.to.lat}`,url=`https://routing.openstreetmap.de/routed-${profile}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false&radiuses=${radius};${radius}`;
  try{const response=await this.fetcher(url,{signal:controller.signal});const body=await response.json();if(!response.ok&&body?.code!=='NoRoute'&&body?.code!=='NoSegment')throw new Error('Le calcul d’itinéraire est indisponible pour le moment. Réessaie.');const route=parseRouteResponse(body,j.mode);if(signal?.aborted)throw aborted();this.cache.set(key,route);if(this.cache.size>30)this.cache.delete(this.cache.keys().next().value);return route;}
  catch(e){if(signal?.aborted)throw aborted();if(e.name==='AbortError')throw new Error('Le calcul prend trop de temps. Réessaie ou choisis des points plus proches.');throw e;}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
 }
}
