import { expect, test } from '@playwright/test'

test('le rechargement hors ligne choisit le document courant et non celui du précédent déploiement', async ({ page, context }) => {
  await page.goto('/')
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker?.controller))).toBe(true)
  await page.evaluate(async () => {
    const names = (await caches.keys()).filter(name => name.startsWith('un-soir-la-bas-shell-'))
    const currentName = names[names.length - 1]
    const current = await caches.open(currentName)
    const entries = await Promise.all((await current.keys()).map(async request => ({ request, response: (await current.match(request))! })))
    await caches.delete(currentName)
    const old = await caches.open('un-soir-la-bas-shell-old-document')
    await old.put('/', new Response('<html><body>Ancienne version uniquement</body></html>', { headers: { 'Content-Type': 'text/html' } }))
    const restoredCurrent = await caches.open(currentName)
    for (const entry of entries) await restoredCurrent.put(entry.request, entry.response)
  })
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Pages personnelles' })).toBeVisible()
  await expect(page.getByText('Ancienne version uniquement')).toHaveCount(0)
})
