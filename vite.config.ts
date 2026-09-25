import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { createHash } from 'node:crypto'

function offlineShell(): Plugin {
  return {
    name: 'offline-shell',
    generateBundle(_, bundle) {
      const files = ['/','/favicon.svg','/icons.svg', ...Object.keys(bundle).filter(name => /\.(js|css)$/.test(name)).map(name=>`/${name}`)]
      const revision=createHash('sha256').update(JSON.stringify(files)).digest('hex').slice(0,16)
      this.emitFile({type:'asset',fileName:'offline-worker.js',source:`
const NAME='unsoirlabas-offline-${revision}';
const FILES=${JSON.stringify(files)};
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(NAME);
  try {await cache.addAll(FILES.map(url=>new Request(url,{cache:'reload'})));await self.skipWaiting()}
  catch(error){await caches.delete(NAME);throw error}
})()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
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
    const cached=await (await caches.open(NAME)).match(url.pathname);return cached || fetch(event.request);
  })());
});`})
    },
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
