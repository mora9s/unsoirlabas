import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function offlineShell(): Plugin {
  return {
    name: 'offline-shell',
    generateBundle: { order: 'post', handler(_, bundle) {
      const bundled = Object.keys(bundle).filter(name => /\.(js|css)$/.test(name)).sort()
      const media = ['bacuit-island.jpg','chocolate-hills.jpg','el-nido-bay.jpg','el-nido-big-lagoon.jpg','el-nido-lagoon.jpg','limestone-island.jpg','manila-jeepney.jpg','manila-sunset.jpg','nakabuang-beach.webm','port-barton.jpg'].map(name => `/assets/${name}`)
      const visayas = ['apo','moalboal','siquijor','turtle','bohol','cebu'].map(photo => `/assets/visayas/${photo}.jpg`)
      const files = ['/','/favicon.svg','/icons.svg', ...media, ...visayas, ...bundled.map(name => `/${name}`)]
      const hash = createHash('sha256')
      // Include worker logic as well as shell bytes so code-only updates invalidate it.
      hash.update(offlineShell.toString())
      for (const file of files) {
        hash.update(file)
        const output = bundle[file === '/' ? 'index.html' : file.slice(1)]
        if (output) hash.update(output.type === 'asset' ? output.source : output.code)
        else if (file !== '/') hash.update(readFileSync(resolve('public', file.slice(1))))
        else this.error('Missing built index.html for offline shell')
      }
      const revision = hash.digest('hex').slice(0,16)
      this.emitFile({type:'asset',fileName:'offline-worker.js',source:`
const NAME='unsoirlabas-offline-${revision}';
const FILES=${JSON.stringify(files)};
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(NAME);
  try {await cache.addAll(FILES.map(url=>new Request(url,{cache:'reload'})));await self.skipWaiting()}
  catch(error){await caches.delete(NAME);throw error}
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const old=(await caches.keys()).filter(key=>key.startsWith('unsoirlabas-offline-')&&key!==NAME);
  await Promise.all(old.slice(0,Math.max(0,old.length-1)).map(key=>caches.delete(key)));
  await self.clients.claim();
})()));
self.addEventListener('message',event=>{
  if(event.data==='STATUS')event.waitUntil((async()=>{
    const cache=await caches.open(NAME);
    const ready=(await Promise.all(FILES.map(url=>cache.match(url)))).every(Boolean);
    event.ports[0]?.postMessage({ready,version:NAME});
  })());
});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
  if(event.request.mode==='navigate' && (url.pathname==='/' || url.pathname==='/index.html')) {
    event.respondWith((async()=>{try{return await fetch(event.request)}catch{return (await caches.open(NAME)).match('/')}})());return;
  }
  if(FILES.includes(url.pathname)&&url.pathname!=='/')event.respondWith((async()=>{
    const cached=await (await caches.open(NAME)).match(url.pathname);
    if(!cached)return fetch(event.request);
    if(event.request.headers.has('range') && url.pathname.endsWith('.webm')) {
      const bytes=await cached.arrayBuffer();
      const match=/^bytes=(\\d*)-(\\d*)$/.exec(event.request.headers.get('range')||'');
      if(!match||(!match[1]&&!match[2]))return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+bytes.byteLength,'Accept-Ranges':'bytes'}});
      const start=match[1]?Number(match[1]):Math.max(0,bytes.byteLength-Number(match[2]));
      const end=match[1]&&match[2]?Math.min(Number(match[2]),bytes.byteLength-1):bytes.byteLength-1;
      if(start>=bytes.byteLength||start>end||(!match[1]&&Number(match[2])===0))return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+bytes.byteLength,'Accept-Ranges':'bytes'}});
      const headers=new Headers(cached.headers);
      headers.set('Accept-Ranges','bytes');headers.set('Content-Range','bytes '+start+'-'+end+'/'+bytes.byteLength);headers.set('Content-Length',String(end-start+1));
      return new Response(bytes.slice(start,end+1),{status:206,headers});
    }
    return cached;
  })());
});`})
    }},
  }
}

function deploymentMetadata(): Plugin {
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? 'unknown'
  return {
    name: 'deployment-metadata',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'deployment.json',
        source: `${JSON.stringify({ commitSha })}\n`,
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), deploymentMetadata(), offlineShell()],
  // Vercel serves only the static frontend; the private FastAPI host keeps voice.
  define: {
    __VOICE_PRIVATE_BUILD__: JSON.stringify(process.env.VERCEL !== '1'),
    __GOOGLE_PHOTOS_PUBLIC_BUILD__: JSON.stringify(process.env.VERCEL === '1'),
  },
  preview: {
    allowedHosts: ['smora-precision-3550.taildf8f08.ts.net'],
  },
})
