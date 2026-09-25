import { VoyageRenderer } from './renderer.js';
import { RouteService, isGround } from './routing.js';
import { MODES, validateJourney } from './core.js';

const send = data => parent.postMessage({ source: 'atlas-player', ...data }, location.origin);
let renderer, controller, revision = 0, currentId, overview = false;
const service = new RouteService();
function report(error) { send({ type: 'error', id: currentId, message: error.message || String(error) }); }
try {
  renderer = new VoyageRenderer(document.querySelector('#globe'), document.querySelector('#hud'), { onError: message => report(new Error(message)) });
  const icons = {};
  for (const [mode, meta] of Object.entries(MODES)) {
    const name = meta.icon.split('-').map(s => s[0].toUpperCase() + s.slice(1)).join('');
    const node = lucide.icons[name];
    if (!node) continue;
    const svg = lucide.createElement(node, { stroke: '#c2f6e0', width: 32, height: 32 });
    const image = new Image(); image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg)); icons[mode] = image;
  }
  renderer.setIcons(icons);
  const resize = () => { renderer.resize(innerWidth, innerHeight); if (overview) drawOverview(); };
  new ResizeObserver(resize).observe(document.body); resize();
  addEventListener('message', async event => {
    if (event.origin !== location.origin || event.source !== parent || event.data?.source !== 'travel-journal') return;
    const data = event.data;
    if (data.type === 'seek') { if (data.id === currentId && Number.isFinite(data.progress) && !overview) renderer.draw(Math.max(0, Math.min(1, data.progress))); return; }
    if (data.type !== 'configure' && data.type !== 'overview') return;
    controller?.abort(); controller = new AbortController(); const active = controller, version = ++revision; currentId = data.id;
    try {
      overview = data.type === 'overview';
      if (overview) { configureOverview(data.stops); send({ type: 'ready', id: currentId, description: 'Vue d’ensemble · liaisons illustrées entre les étapes.' }); return; }
      const journey = validateJourney({ ...data.journey, duration: 12, format: 'landscape' });
      if (isGround(journey.mode) && !journey.illustrated) journey.route = await service.get(journey, { signal: active.signal });
      if (version !== revision || active.signal.aborted) return;
      renderer.configure(journey); renderer.draw(0);
      const description = journey.route ? `Itinéraire ${journey.mode === 'walk' ? 'piéton' : 'routier'} calculé · ${(journey.route.distance / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km · OpenStreetMap` : journey.mode === 'train' ? 'Liaison illustrée · ne suit pas les voies ferrées.' : journey.mode === 'boat' ? 'Liaison illustrée · ne suit pas les voies maritimes.' : journey.illustrated ? 'Liaison illustrée · aucun itinéraire routier calculé.' : 'Trajectoire aérienne illustrée · à vol d’oiseau.';
      send({ type: 'ready', id: currentId, description });
    } catch (error) { if (version === revision && !active.signal.aborted) report(error); }
  });
  if (await renderer.ready) send({ type: 'boot' });
} catch (error) { report(error); }

let overviewPoints = [];
function configureOverview(stops) {
  if (!Array.isArray(stops) || stops.length < 2 || stops.length > 30) throw new Error('Au moins deux étapes sont nécessaires.');
  overviewPoints = stops.map(s => { if (!Number.isFinite(s.point?.lat) || !Number.isFinite(s.point?.lon) || Math.abs(s.point.lat) > 90 || Math.abs(s.point.lon) > 180) throw new Error('Position invalide.'); return [s.point.lon, s.point.lat]; });
  renderer.configure({ from: { name: stops[0].place, ...stops[0].point }, to: { name: stops.at(-1).place, ...stops.at(-1).point }, title: 'Les étapes de votre voyage.', mode: 'train' });
  renderer.pathGroup.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); }); renderer.pathGroup.clear(); renderer.trail = null;
  const T = renderer.T;
  for (let i = 1; i < overviewPoints.length; i++) {
    const interpolate = d3.geoInterpolate(overviewPoints[i - 1], overviewPoints[i]);
    const points = Array.from({ length: 81 }, (_, j) => vector(interpolate(j / 80), 2.006));
    renderer.pathGroup.add(new T.Line(new T.BufferGeometry().setFromPoints(points), new T.LineBasicMaterial({ color: 0xa2f2d5 })));
  }
  drawOverview();
}
function vector(p, r) { const rad = Math.PI / 180; return new renderer.T.Vector3(r * Math.cos(p[1]*rad)*Math.cos(p[0]*rad), r*Math.sin(p[1]*rad), -r*Math.cos(p[1]*rad)*Math.sin(p[0]*rad)); }
function drawOverview() {
  if (!overviewPoints.length) return;
  const center = d3.geoCentroid({ type: 'MultiPoint', coordinates: overviewPoints });
  const extent = Math.max(...overviewPoints.map(p => d3.geoDistance(center, p)));
  const altitude = Math.max(.003, Math.min(10, extent * 6)) * (renderer.camera.aspect < 1 ? 1.5 : 1);
  const rad = Math.PI / 180;
  renderer.camera.position.copy(vector(center, 2 + altitude));
  renderer.camera.up.set(-Math.sin(center[1]*rad)*Math.cos(center[0]*rad),Math.cos(center[1]*rad),Math.sin(center[1]*rad)*Math.sin(center[0]*rad));
  renderer.camera.near = altitude / 100; renderer.camera.lookAt(vector(center, 2)); renderer.camera.updateProjectionMatrix(); renderer.camera.updateMatrixWorld();
  renderer.plane.visible = false; renderer.altitude = altitude; renderer.atmosphere.visible = altitude > .08;
  renderer.sun.position.copy(renderer.camera.position).multiplyScalar(3);
  renderer.renderer.render(renderer.scene, renderer.camera);
  const c = renderer.ctx; c.setTransform(renderer.dpr,0,0,renderer.dpr,0,0); c.clearRect(0,0,renderer.w,renderer.h);
  overviewPoints.forEach((point, i) => { const v = vector(point, 2.007); if (v.clone().normalize().dot(renderer.camera.position.clone().normalize()) < .05) return; const p = renderer.project(v); if(p.z > 1) return; c.beginPath(); c.arc(p.x,p.y,14,0,Math.PI*2); c.fillStyle='#a2f2d5'; c.fill(); c.fillStyle='#04121e'; c.font='bold 13px Arial'; c.textAlign='center'; c.fillText(String(i+1),p.x,p.y+4); });
  c.textAlign='left'; c.fillStyle='#c6dbdc'; c.font='11px Arial'; c.fillText('Globe · Three Globe | Liaisons illustrées',14,renderer.h-12);
  if (altitude < .20) renderer.ensureTiles(center, altitude);
}
