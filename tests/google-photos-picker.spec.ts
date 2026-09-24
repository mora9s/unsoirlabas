import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { unzipSync } from 'fflate'

const albumUrl = 'https://photos.app.goo.gl/y4cpr6M1oJZZHwro7'
const key = 'philippines-trip'
const tinyJpeg = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAEf/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9k=', 'base64')

async function configured(page: import('@playwright/test').Page, mode: 'success' | 'denied' | 'popup-blocked' = 'success') {
  await page.addInitScript(({ mode }) => {
    window.__GOOGLE_PHOTOS_CONFIG__ = { clientId: 'public-test-client.apps.googleusercontent.com' }
    let closed = false
    const opened = {
      get closed() { return closed },
      close() { closed = true },
      location: { replace(url: string) { ;(window as unknown as { pickerUrl: string }).pickerUrl = url; closed = true } },
    }
    window.open = () => opened as unknown as Window
    ;(window as unknown as { oauthPrompts: string[] }).oauthPrompts = []
    window.google = { accounts: { oauth2: { initTokenClient: ({ callback, error_callback }: { callback: (response: { access_token?: string; error?: string }) => void; error_callback?: (error: { type?: string }) => void }) => ({ requestAccessToken: (options?: { prompt?: string }) => { ;(window as unknown as { oauthPrompts: string[] }).oauthPrompts.push(options?.prompt ?? ''); setTimeout(() => mode === 'popup-blocked' ? error_callback?.({ type: 'popup_failed_to_open' }) : callback(mode === 'denied' ? { error: 'access_denied' } : { access_token: 'test-access-token-long-enough-for-gis' }), 0) } }) } } }
  }, { mode })
}

async function openPicker(page: import('@playwright/test').Page) {
  const link = page.getByRole('link', { name: 'Ouvrir Google Photos pour choisir' })
  await expect(link).toBeVisible()
  await expect(link).toHaveAttribute('target', '_blank')
  const href = await link.getAttribute('href')
  await link.dispatchEvent('click')
  return href ?? ''
}

test('album partagé explicite et import Picker configuré, paginé et portable', async ({ page }, testInfo) => {
  await configured(page)
  let poll = 0
  let deleted = false
  let sessionPollUrl = ''
  let mediaListUrl = ''
  let sessionDeleteUrl = ''
  const mediaAuthorizations: string[] = []
  await page.route('https://photospicker.googleapis.com/**', async route => {
    const request = route.request(); const url = request.url()
    if (request.method() === 'POST' && url.endsWith('/v1/sessions')) return route.fulfill({ json: { id: 'opaque/id+value=', pickerUri: 'https://photos.google.com/picker/test', pollingConfig: { pollInterval: '0s', timeoutIn: '30s' } } })
    if (request.method() === 'GET' && url.includes('/v1/sessions/')) { sessionPollUrl = url; return route.fulfill({ json: poll++ ? { id: 'opaque/id+value=', mediaItemsSet: true } : { id: 'opaque/id+value=', pollingConfig: { pollInterval: '0s', timeoutIn: '30s' } } }) }
    if (request.method() === 'GET' && url.includes('/v1/mediaItems?')) { mediaListUrl = url; return route.fulfill({ json: url.includes('pageToken=next') ? { mediaItems: [{ id: 'two', type: 'PHOTO', mediaFile: { baseUrl: 'https://lh3.googleusercontent.com/test-two', mimeType: 'image/jpeg', filename: 'deux.jpg' } }] } : { mediaItems: [{ id: 'one', type: 'PHOTO', mediaFile: { baseUrl: 'https://lh3.googleusercontent.com/test-one', mimeType: 'image/jpeg', filename: 'un.jpg' } }], nextPageToken: 'next' } }) }
    if (request.method() === 'DELETE') { deleted = true; sessionDeleteUrl = url; return route.fulfill({ status: 204 }) }
    await route.fallback()
  })
  await page.route('https://lh3.googleusercontent.com/**', route => {
    mediaAuthorizations.push(route.request().headers().authorization ?? '')
    return route.fulfill({ contentType: 'image/jpeg', body: tinyJpeg })
  })
  await page.goto('/#create')
  await expect(page.getByRole('link', { name: 'Ouvrir l’album' })).toHaveAttribute('href', albumUrl)
  await expect(page.getByRole('link', { name: 'Ouvrir l’album' })).toHaveAttribute('rel', /noopener/)
  await page.getByRole('button', { name: 'Choisir dans Google Photos' }).click()
  const pickerUrl = await openPicker(page)
  await expect(page.getByTestId('media-item')).toHaveCount(2)
  expect(deleted).toBe(true)
  expect(sessionPollUrl).toContain('/v1/sessions/opaque%2Fid%2Bvalue%3D')
  expect(sessionDeleteUrl).toContain('/v1/sessions/opaque%2Fid%2Bvalue%3D')
  expect(new URL(mediaListUrl).searchParams.get('sessionId')).toBe('opaque/id+value=')
  expect(mediaAuthorizations).toEqual(['Bearer test-access-token-long-enough-for-gis', 'Bearer test-access-token-long-enough-for-gis'])
  expect(await page.evaluate(() => (window as unknown as { oauthPrompts: string[] }).oauthPrompts)).toEqual(['consent'])
  await expect(page.getByRole('status')).toContainText('2 photos importées depuis Google Photos')
  expect(pickerUrl).toContain('/autoclose')
  await page.getByLabel('Votre récit, à votre façon').fill('Deux photos choisies, préparées ici.')
  await page.getByRole('button', { name: 'Prévisualiser' }).click(); await page.getByRole('button', { name: 'Ajouter au voyage' }).click()
  const local = await page.evaluate(key => localStorage.getItem(key)!, key)
  expect(local).not.toContain('test-access-token-long-enough-for-gis'); expect(local).not.toContain('googleusercontent.com')
  await page.getByRole('button', { name: 'Retour au carnet' }).click()
  await page.getByRole('button', { name: 'Outils et sauvegarde du carnet' }).click()
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Sauvegarder dans Drive' }).click()
  const backupPath = testInfo.outputPath('picker-portable.zip'); await (await download).saveAs(backupPath)
  const archive = Buffer.concat(Object.values(unzipSync(await readFile(backupPath))).map(value => Buffer.from(value))).toString('utf8')
  expect(archive).not.toContain('test-access-token-long-enough-for-gis'); expect(archive).not.toContain('googleusercontent.com')
})

test('sans configuration ou en HTTP non sécurisé, album et import appareil restent disponibles', async ({ page }) => {
  await page.goto('/#create')
  await expect(page.getByRole('link', { name: 'Ouvrir l’album' })).toHaveAttribute('href', albumUrl)
  await expect(page.getByRole('button', { name: 'Choisir dans Google Photos' })).toBeDisabled()
  await expect(page.getByText('La connexion sécurisée Google Photos reste à activer')).toBeVisible()
  await page.addInitScript(() => { window.__GOOGLE_PHOTOS_CONFIG__ = { clientId: 'public-test-client.apps.googleusercontent.com' }; Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true }) })
  await page.reload()
  await expect(page.getByRole('button', { name: 'Choisir dans Google Photos' })).toBeDisabled()
  await expect(page.getByText('La connexion Google nécessite l’adresse sécurisée')).toBeVisible()
  await expect(page.getByLabel('Importer des photos')).toBeEnabled()
})

test('refus OAuth laisse le carnet intact', async ({ page }) => {
  await configured(page, 'denied'); await page.goto('/#create')
  await page.getByRole('button', { name: 'Choisir dans Google Photos' }).click()
  await expect(page.getByRole('alert')).toContainText('autorisation Google a été refusée')
  await expect(page.getByTestId('media-item')).toHaveCount(0)
})

test('popup OAuth bloquée donne une consigne précise', async ({ page }) => {
  await configured(page, 'popup-blocked'); await page.goto('/#create')
  await page.getByRole('button', { name: 'Choisir dans Google Photos' }).click()
  await expect(page.getByRole('alert')).toContainText('connexion Google a été bloquée')
  await expect(page.getByRole('alert')).toContainText('fenêtres surgissantes')
})

test('vidéos et photos au-delà de la capacité sont signalées sans les importer', async ({ page }) => {
  await configured(page)
  await page.route('https://photospicker.googleapis.com/**', async route => {
    const url = route.request().url()
    if (route.request().method() === 'POST') return route.fulfill({ json: { id: 'limited', pickerUri: 'https://photos.google.com/picker/limited', pollingConfig: { pollInterval: '0s', timeoutIn: '10s' } } })
    if (route.request().method() === 'GET' && url.includes('/sessions/')) return route.fulfill({ json: { id: 'limited', mediaItemsSet: true } })
    if (route.request().method() === 'GET') return route.fulfill({ json: { mediaItems: [{ id: 'image-1', type: 'PHOTO', mediaFile: { baseUrl: 'https://lh3.googleusercontent.com/limited-one', mimeType: 'image/jpeg' } }, { id: 'image-2', type: 'PHOTO', mediaFile: { baseUrl: 'https://lh3.googleusercontent.com/limited-two', mimeType: 'image/jpeg' } }, { id: 'video-1', type: 'VIDEO', mediaFile: { baseUrl: 'https://lh3.googleusercontent.com/limited-video', mimeType: 'video/mp4' } }] } })
    return route.fulfill({ status: 204 })
  })
  await page.route('https://lh3.googleusercontent.com/**', route => route.fulfill({ contentType: 'image/jpeg', body: tinyJpeg }))
  await page.goto('/#create')
  await page.getByLabel('Importer des photos').setInputFiles(Array.from({ length: 11 }, () => 'public/assets/el-nido-bay.jpg'))
  await expect(page.getByTestId('media-item')).toHaveCount(11)
  await page.getByRole('button', { name: 'Choisir dans Google Photos' }).click()
  await openPicker(page)
  await expect(page.getByTestId('media-item')).toHaveCount(12)
  await expect(page.getByRole('status')).toContainText('1 vidéo non importée')
  await expect(page.getByRole('status')).toContainText('1 photo au-delà de la limite de 12')
})

test('refus de l’API Picker ne modifie pas les médias', async ({ page }) => {
  await configured(page)
  await page.route('https://photospicker.googleapis.com/**', route => route.fulfill({ status: 403, json: { error: { status: 'PERMISSION_DENIED' } } }))
  await page.goto('/#create')
  await page.getByRole('button', { name: 'Choisir dans Google Photos' }).click()
  await expect(page.getByRole('alert')).toContainText('API refuse l’accès')
  await expect(page.getByRole('alert')).toContainText('utilisateurs de test')
  await expect(page.getByTestId('media-item')).toHaveCount(0)
})

test('session expirée et annulation restent sans effet sur le carnet', async ({ page }) => {
  await configured(page)
  let deleted = false
  await page.route('https://photospicker.googleapis.com/**', route => {
    const request = route.request(); const url = request.url()
    if (request.method() === 'POST') return route.fulfill({ json: { id: 'expires', pickerUri: 'https://photos.google.com/picker/expires', pollingConfig: { pollInterval: '0s', timeoutIn: '0s' } } })
    if (request.method() === 'DELETE') { deleted = true; return route.fulfill({ status: 204 }) }
    if (url.includes('/sessions/')) return route.fulfill({ json: { id: 'expires', pollingConfig: { pollInterval: '0s', timeoutIn: '0s' }, mediaItemsSet: false } })
    return route.fulfill({ status: 500 })
  })
  await page.goto('/#create')
  await page.getByRole('button', { name: 'Choisir dans Google Photos' }).click()
  await openPicker(page)
  await expect(page.getByRole('alert')).toContainText('sélection Google Photos a expiré')
  expect(deleted).toBe(true)
  await expect(page.getByTestId('media-item')).toHaveCount(0)

  await page.reload()
  await page.getByRole('button', { name: 'Choisir dans Google Photos' }).click()
  await expect(page.getByRole('button', { name: 'Annuler l’import Google Photos' })).toBeVisible()
  await page.getByRole('button', { name: 'Annuler l’import Google Photos' }).click()
  await expect(page.getByRole('status')).toContainText('Import Google Photos annulé')
  await expect(page.getByTestId('media-item')).toHaveCount(0)
})

test('un téléchargement sans Content-Length reste borné avant mise en mémoire complète', async ({ page }) => {
  await configured(page)
  await page.route('https://photospicker.googleapis.com/**', route => {
    const request = route.request(); const url = request.url()
    if (request.method() === 'POST') return route.fulfill({ json: { id: 'streamed', pickerUri: 'https://photos.google.com/picker/streamed', pollingConfig: { pollInterval: '0s', timeoutIn: '10s' } } })
    if (request.method() === 'DELETE') return route.fulfill({ status: 204 })
    if (url.includes('/sessions/')) return route.fulfill({ json: { id: 'streamed', mediaItemsSet: true } })
    return route.fulfill({ json: { mediaItems: [{ id: 'large', type: 'PHOTO', mediaFile: { baseUrl: 'https://lh3.googleusercontent.com/large-stream', mimeType: 'image/jpeg' } }] } })
  })
  await page.goto('/#create')
  await page.evaluate(() => {
    const nativeFetch = window.fetch.bind(window)
    window.fetch = (input, init) => {
      if (!String(input).startsWith('https://lh3.googleusercontent.com/large-stream')) return nativeFetch(input, init)
      let chunks = 0
      return Promise.resolve(new Response(new ReadableStream({
        pull(controller) {
          chunks += 1
          controller.enqueue(new Uint8Array(1024 * 1024))
        },
        cancel() { ;(window as unknown as { chunkedDownloadCancelled: boolean }).chunkedDownloadCancelled = true },
      }), { headers: { 'content-type': 'image/jpeg' } }))
    }
  })
  await page.getByRole('button', { name: 'Choisir dans Google Photos' }).click()
  await openPicker(page)
  await expect(page.getByRole('status')).toContainText('1 photo indisponible ou trop lourde')
  await expect(page.getByTestId('media-item')).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { chunkedDownloadCancelled?: boolean }).chunkedDownloadCancelled)).toBe(true)
})
