import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
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

function productionServiceWorker(): Plugin {
  return {
    name: 'production-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const assetFiles = Object.keys(bundle).filter(file => /^assets\/[^/]+\.(?:js|css)$/.test(file)).sort()
      const mediaFiles = readdirSync(resolve(process.cwd(), 'public/assets'))
        .filter(file => /^[a-z0-9-]+\.(?:jpg|webm)$/.test(file))
        .sort()
      if (!assetFiles.some(file => file.endsWith('.js')) || !assetFiles.some(file => file.endsWith('.css'))) {
        this.error('PWA shell requires the production JavaScript and CSS bundles')
      }
      const shell = [
        '/', '/manifest.webmanifest', '/favicon.svg',
        '/icons/icon-192.png', '/icons/icon-512.png',
        ...assetFiles.map(file => `/${file}`),
        ...mediaFiles.map(file => `/assets/${file}`),
      ]
      const digest = createHash('sha256')
      for (const path of shell) {
        digest.update(path)
        const file = path.slice(1)
        const output = file ? bundle[file] : bundle['index.html']
        if (output) digest.update(output.type === 'asset' ? output.source : output.code)
        else if (file) digest.update(readFileSync(resolve(process.cwd(), 'public', file)))
      }
      const version = digest.digest('hex').slice(0, 16)
      const source = `const CACHE_NAME = 'un-soir-la-bas-shell-${version}'
const SHELL = ${JSON.stringify(shell)}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME)
    try {
      await cache.addAll(SHELL)
    } catch (error) {
      await caches.delete(CACHE_NAME)
      throw error
    }
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const existing = (await caches.keys()).filter(key => key.startsWith('un-soir-la-bas-shell-') && key !== CACHE_NAME)
    await Promise.all(existing.slice(0, Math.max(0, existing.length - 1)).map(key => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener('message', event => {
  if (event.data !== 'STATUS' || !event.ports[0]) return
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME)
    const ready = (await Promise.all(SHELL.map(path => cache.match(path)))).every(Boolean)
    event.ports[0].postMessage({ ready })
  })())
})

self.addEventListener('fetch', event => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return
  if (request.mode === 'navigate') {
    const currentDocument = async () => (await caches.open(CACHE_NAME)).match('/')
    event.respondWith(fetch(request).then(response => response.ok ? response : currentDocument().then(cached => cached || response)).catch(async () => (await currentDocument()) || Response.error()))
    return
  }
  if (SHELL.includes(url.pathname) || /^\\/assets\\/[^/]+\\.(?:js|css)$/.test(url.pathname)) {
    if (request.headers.has('range') && url.pathname.endsWith('.webm')) {
      event.respondWith((async () => {
        const cached = await caches.match(url.pathname)
        if (!cached) return fetch(request)
        const bytes = await cached.arrayBuffer()
        const range = request.headers.get('range')
        const match = range && /^bytes=(\\d*)-(\\d*)$/.exec(range)
        if (!match || (!match[1] && !match[2])) {
          return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + bytes.byteLength, 'Accept-Ranges': 'bytes' } })
        }
        const start = match[1] ? Number(match[1]) : Math.max(0, bytes.byteLength - Number(match[2]))
        const end = match[1] && match[2] ? Math.min(Number(match[2]), bytes.byteLength - 1) : bytes.byteLength - 1
        if (start >= bytes.byteLength || start > end) {
          return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + bytes.byteLength, 'Accept-Ranges': 'bytes' } })
        }
        const headers = new Headers(cached.headers)
        headers.set('Accept-Ranges', 'bytes')
        headers.set('Content-Range', 'bytes ' + start + '-' + end + '/' + bytes.byteLength)
        headers.set('Content-Length', String(end - start + 1))
        return new Response(bytes.slice(start, end + 1), { status: 206, headers })
      })())
    } else {
      event.respondWith(caches.match(url.pathname).then(cached => cached || fetch(request)))
    }
  }
})
`
      this.emitFile({ type: 'asset', fileName: 'service-worker.js', source })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), deploymentMetadata(), productionServiceWorker()],
  // Vercel serves only the static frontend; the private FastAPI host keeps voice.
  define: {
    __VOICE_PRIVATE_BUILD__: JSON.stringify(process.env.VERCEL !== '1'),
    __GOOGLE_PHOTOS_PUBLIC_BUILD__: JSON.stringify(process.env.VERCEL === '1'),
  },
  preview: {
    allowedHosts: ['smora-precision-3550.taildf8f08.ts.net'],
  },
})
