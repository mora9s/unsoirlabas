import { expect, test } from '@playwright/test'

test('installe le carnet comme PWA et ouvre la bibliothèque après un chargement hors ligne', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Pages personnelles' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker?.controller))).toBe(true)

  const manifest = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(manifest).toBeTruthy()
  const manifestResponse = await page.request.get(manifest!)
  expect(manifestResponse.ok()).toBeTruthy()
  const manifestJson = await manifestResponse.json()
  expect(manifestJson).toMatchObject({ name: 'Un soir là-bas', display: 'standalone', start_url: '/' })
  for (const size of ['192x192', '512x512']) {
    const icon = manifestJson.icons.find((entry: { sizes: string }) => entry.sizes === size)
    expect(icon, `manifest icon ${size}`).toBeTruthy()
    const iconResponse = await page.request.get(icon.src)
    expect(iconResponse.ok()).toBeTruthy()
    expect(iconResponse.headers()['content-type']).toContain('image/png')
    const dimensions = await page.evaluate(async src => {
      const image = new Image()
      image.src = src
      await image.decode()
      return [image.naturalWidth, image.naturalHeight]
    }, icon.src)
    expect(dimensions).toEqual(size.split('x').map(Number))
  }

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Pages personnelles' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Outils et sauvegarde du carnet' })).toBeVisible()
  await expect(page.getByText(/hors ligne|sans réseau/i)).toHaveCount(0)
  await page.getByRole('button', { name: 'Créer une journée', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Hors ligne : la transcription et le récit vocal ne sont pas garantis.')
  await page.getByLabel('Le titre de votre journée').fill('Un café sans réseau')
  await page.getByLabel('Souvenirs de la journée').fill('Le café du matin, noté sans connexion.')
  await page.getByRole('button', { name: 'Générer le récit' }).click()
  await page.getByRole('button', { name: 'Prévisualiser', exact: true }).click()
  await page.getByRole('button', { name: 'Ajouter au voyage' }).click()
  await expect(page.getByText(/ajoutée au voyage/i)).toBeVisible()
  expect(await page.evaluate(() => Boolean(localStorage.getItem('philippines-trip')))).toBe(true)
  await context.setOffline(false)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Un café sans réseau' })).toBeVisible()
})

test('versionne le shell complet et sert hors ligne un bundle conservé du déploiement précédent', async ({ page, context }) => {
  await page.goto('/')
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker?.controller))).toBe(true)
  const result = await page.evaluate(async () => {
    const names = (await caches.keys()).filter(name => name.startsWith('un-soir-la-bas-shell-'))
    const shell = await caches.open(names[names.length - 1])
    return {
      names,
      paths: (await shell.keys()).map(request => new URL(request.url).pathname),
      sw: await (await fetch('/service-worker.js')).text(),
    }
  })
  expect(result.names.length).toBeLessThanOrEqual(2)
  expect(result.paths).toContain('/')
  expect(result.paths).toContain('/manifest.webmanifest')
  expect(result.paths).toContain('/icons/icon-192.png')
  expect(result.paths).toContain('/icons/icon-512.png')
  expect(result.paths.some(path => path.startsWith('/assets/') && path.endsWith('.js'))).toBe(true)
  expect(result.paths.some(path => path.startsWith('/assets/') && path.endsWith('.css'))).toBe(true)
  expect(result.sw).toContain('CACHE_NAME')
  await page.evaluate(async () => {
    const previous = await caches.open('un-soir-la-bas-shell-previous-release')
    await previous.put(new Request(`${location.origin}/assets/index-previous-release.js`), new Response('previous release bundle'))
  })
  await context.setOffline(true)
  expect(await page.evaluate(() => fetch('/assets/index-previous-release.js').then(response => response.text()))).toBe('previous release bundle')
})

test('le shell est préchargé atomiquement et limite la rétention aux versions courante et précédente', async ({ page }) => {
  await page.goto('/')
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker?.controller))).toBe(true)
  const source = await page.evaluate(async () => (await (await fetch('/service-worker.js')).text()))
  expect(source).toContain('await cache.addAll(SHELL)')
  expect(source).toContain('await caches.delete(CACHE_NAME)')
  expect(source).toContain('throw error')
  expect(source).toContain("await self.skipWaiting()")
  expect(source).toContain('existing.slice(0, Math.max(0, existing.length - 1))')
  expect(source).not.toMatch(/cache\\.add\\([^)]*\\)\\.catch/)
})

test('ne met jamais en cache API vocale, pièces audio ni réponses sensibles', async ({ page }) => {
  await page.goto('/')
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker?.controller))).toBe(true)
  const cachedRequests = await page.evaluate(async () => {
    const names = await caches.keys()
    const entries = await Promise.all(names.map(async name => (await caches.open(name)).keys()))
    return entries.flat().map(request => new URL(request.url).pathname)
  })
  expect(cachedRequests.some(path => /^\/assets\/[^/]+\.js$/.test(path))).toBe(true)
  expect(cachedRequests).not.toContain('/api/voice/health')
  expect(cachedRequests.some(path => path.startsWith('/api/'))).toBe(false)
  expect(cachedRequests.some(path => /audio|recordings|drafts/i.test(path))).toBe(false)
})
