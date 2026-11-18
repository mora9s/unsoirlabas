import { expect, test } from '@playwright/test'

const trip = { id: 'philippines-family', destination: 'Philippines', departure: '2027-03-10', endDate: '2027-03-20' }

const geocode = [{ place_id: 1, osm_type: 'relation', osm_id: 1234, lat: '10.3157', lon: '123.8854', display_name: 'Cebu City, Philippines', name: 'Cebu City' }]
const overpass = {
  version: 0.6,
  generator: 'Overpass API',
  osm3s: { timestamp_osm_base: '2026-10-04T12:09:43Z' },
  elements: [
    ...Array.from({ length: 6 }, (_, index) => ({ type: 'node', id: 300 + index, lat: 10.3157 + index * 0.001, lon: 123.8854, tags: { amenity: 'restaurant', name: `Cebu Restaurant ${index + 1}` } })),
    ...Array.from({ length: 6 }, (_, index) => ({ type: 'way', id: 400 + index, center: { lat: 10.32 + index * 0.001, lon: 123.89 }, tags: { tourism: index % 2 ? 'viewpoint' : 'attraction', name: `Cebu Activity ${index + 1}` } })),
    { type: 'node', id: 300, lat: 10.3157, lon: 123.8854, tags: { amenity: 'restaurant', name: 'Cebu Restaurant 1' } },
  ],
}

async function openPlanner(page: import('@playwright/test').Page, viewport?: { width: number; height: number }) {
  if (viewport) await page.setViewportSize(viewport)
  await page.addInitScript(({ trip }) => localStorage.setItem('un-soir-la-bas-upcoming-v1', JSON.stringify([trip])), { trip })
  await page.goto('/#plan/philippines-family')
  await expect(page.getByRole('heading', { name: 'Des repères pour le voyage en famille.' })).toBeVisible()
}

test('exploration explicite Philippines, filtres de proximité et choix non automatiques', async ({ page }) => {
  let geocodeRequests = 0
  let overpassRequests = 0
  await page.route('https://nominatim.openstreetmap.org/**', async route => {
    geocodeRequests += 1
    await route.fulfill({ json: geocode })
  })
  await page.route('https://overpass-api.de/api/interpreter', async route => {
    overpassRequests += 1
    const form = new URLSearchParams(route.request().postData() ?? '')
    expect(form.get('data')).toContain('around:2500,10.315700,123.885400')
    expect(form.get('data')).toContain('[timeout:12]')
    expect(form.get('data')?.match(/out center tags 60;/g)).toHaveLength(2)
    expect(form.get('data')).toContain('[amenity=restaurant][name]')
    await route.fulfill({ json: overpass })
  })
  await openPlanner(page)
  expect(geocodeRequests).toBe(0)
  expect(overpassRequests).toBe(0)
  await page.getByLabel('Ville ou étape à explorer').fill('Cebu City, Philippines')
  await page.getByRole('button', { name: 'Rechercher une destination' }).click()
  await expect(page.getByText('Cebu City, Philippines', { exact: true })).toBeVisible()
  expect(geocodeRequests).toBe(1)
  expect(overpassRequests).toBe(0)
  await page.getByRole('button', { name: 'Explorer autour' }).click()
  await expect(page.getByRole('heading', { name: /Restaurants/ })).toBeVisible()
  expect(overpassRequests).toBe(1)
  await expect(page.getByText('Cebu Restaurant 1')).toBeVisible()
  await expect(page.getByText('Cebu Activity 1')).toBeVisible()
  await expect(page.getByText(/pas « les meilleurs »/)).toBeVisible()
  await expect(page.getByText(/sécurité ni l’adaptation d’un lieu aux enfants/)).toHaveCount(1)
  await page.getByText('Limites, données et vie privée').click()
  await expect(page.getByText(/sécurité ni l’adaptation d’un lieu aux enfants/)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Source OpenStreetMap ↗' }).first()).toHaveAttribute('href', 'https://www.openstreetmap.org/node/300')
  await expect(page.getByRole('button', { name: 'Garder', exact: true })).toHaveCount(10)
  await page.getByRole('button', { name: 'Voir jusqu’à 6' }).first().click()
  await expect(page.getByText('Cebu Restaurant 6')).toBeVisible()
  await page.getByRole('button', { name: 'Garder', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: /Vos envies gardées/ })).toContainText('1')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('un-soir-la-bas-upcoming-v1')!)[0].plan.stay.places[0].name)).toBe('Cebu Restaurant 1')
})

test('proposition familiale flexible, journées verrouillées, révision et persistance hors ligne', async ({ page }) => {
  await page.addInitScript(({ trip }) => {
    if (!localStorage.getItem('un-soir-la-bas-upcoming-v1')) localStorage.setItem('un-soir-la-bas-upcoming-v1', JSON.stringify([{ ...trip, plan: { ideas: [], stops: [], notes: '', stay: {
      anchor: { name: 'Cebu City', latitude: 10.3157, longitude: 123.8854 },
      places: [
        { id: 'a', name: 'Cebu Museum', category: 'activity', source: 'manual', latitude: 10.315, longitude: 123.886 },
        { id: 'b', name: 'Family Lunch', category: 'restaurant', source: 'manual', latitude: 10.316, longitude: 123.887 },
        { id: 'c', name: 'Waterfront', category: 'activity', source: 'manual', latitude: 10.317, longitude: 123.888 },
      ],
      days: [],
      daysCount: 2,
    } } }]))
  }, { trip })
  await page.goto('/#plan/philippines-family')
  await page.getByLabel('Nombre de journées à préparer').selectOption('2')
  await page.getByRole('button', { name: 'Recomposer une proposition' }).click()
  await expect(page.getByRole('button', { name: 'Valider cette organisation' })).toBeVisible()
  await page.getByRole('button', { name: 'Valider cette organisation' }).click()
  await expect(page.getByText('Votre organisation est enregistrée sur cet appareil.')).toBeVisible()
  await expect(page.locator('.stay-day')).toHaveCount(2)
  const firstDay = page.locator('.stay-day').first()
  await firstDay.getByRole('button', { name: 'Verrouiller cette journée' }).click()
  await expect(firstDay.getByRole('button', { name: '🔒 Journée verrouillée' })).toBeVisible()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('un-soir-la-bas-upcoming-v1')!)[0].plan.stay.days)).toHaveLength(2)
  await page.route('https://nominatim.openstreetmap.org/**', route => route.abort())
  await page.route('https://overpass-api.de/**', route => route.abort())
  await page.reload()
  await expect(page.getByRole('heading', { name: /Vos envies gardées/ })).toContainText('3')
  await expect(page.locator('.stay-wishes').getByText('Cebu Museum', { exact: true })).toBeVisible()
  await expect(page.locator('.stay-day').first().getByRole('button', { name: '🔒 Journée verrouillée' })).toBeVisible()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('un-soir-la-bas-upcoming-v1')!)[0].plan.stay.daysCount)).toBe(2)
  await expect(page.getByText(/Les lieux et distances ne valident ni un trajet/)).toBeVisible()
  await page.getByText('Limites, données et vie privée').click()
  await expect(page.getByText(/routes, marche, ferry et liaisons entre îles ne sont pas vérifiés/)).toBeVisible()
  await expect(page.getByText(/Aucun temps de trajet n’est calculé/)).toBeVisible()
  await page.route('https://tile.openstreetmap.org/**', route => route.abort())
  await page.getByRole('button', { name: 'Afficher la carte' }).click()
  await expect(page.getByText(/tuiles chargées en direct, sans téléchargement hors ligne/)).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
})

test('captures source mockée, flux de choix et lecture hors ligne sur mobile et bureau', async ({ page }) => {
  const { mkdir } = await import('node:fs/promises')
  const { join } = await import('node:path')
  const output = join(process.cwd(), 'evidence/map-stay')
  await mkdir(output, { recursive: true })
  const consoleErrors: string[] = []
  page.on('pageerror', error => consoleErrors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()) })
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
    await page.route('https://nominatim.openstreetmap.org/**', route => route.fulfill({ json: geocode }))
    await page.route('https://overpass-api.de/api/interpreter', route => route.fulfill({ json: overpass }))
    await page.setViewportSize(viewport)
    await page.goto('/')
    await page.evaluate(({ trip }) => localStorage.setItem('un-soir-la-bas-upcoming-v1', JSON.stringify([trip])), { trip })
    await page.goto('/#plan/philippines-family')
    await expect(page.getByRole('heading', { name: 'Des repères pour le voyage en famille.' })).toBeVisible()
    await page.getByLabel('Ville ou étape à explorer').fill('Cebu City, Philippines')
    await page.getByRole('button', { name: 'Rechercher une destination' }).click()
    await page.getByRole('button', { name: 'Explorer autour' }).click()
    await expect(page.getByRole('heading', { name: /Restaurants/ })).toBeVisible()
    await page.getByRole('button', { name: 'Garder', exact: true }).first().click()
    await page.getByLabel('Nombre de journées à préparer').selectOption('1')
    await page.getByRole('button', { name: 'Recomposer une proposition' }).click()
    await page.getByRole('button', { name: 'Valider cette organisation' }).click()
    await expect(page.getByText('Votre organisation est enregistrée sur cet appareil.')).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { name: /Vos envies gardées/ })).toContainText('1')
    await expect(page.locator('.stay-day')).toHaveCount(1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
    await page.screenshot({ path: join(output, viewport.width === 390 ? 'mock-mobile.png' : 'mock-desktop.png'), fullPage: true })
    await page.unrouteAll()
  }
  expect(consoleErrors).toEqual([])
})

test('change de contexte Cebu–Panglao–Cebu sans mélanger les envies et ouvre la carte après exploration', async ({ page }) => {
  const { mkdir } = await import('node:fs/promises')
  const { join } = await import('node:path')
  const output = join(process.cwd(), 'evidence/map-stay')
  await mkdir(output, { recursive: true })
  let tilesRequested = 0
  await page.route('https://tile.openstreetmap.org/**', async route => { tilesRequested += 1; await route.abort() })
  await page.route('https://nominatim.openstreetmap.org/**', route => {
    const query = new URL(route.request().url()).searchParams.get('q') ?? ''
    const panglao = query.toLowerCase().includes('panglao')
    return route.fulfill({ json: [{ place_id: panglao ? 2 : 1, osm_type: 'relation', osm_id: panglao ? 5678 : 1234, lat: panglao ? '9.6' : '10.3157', lon: panglao ? '123.85' : '123.8854', display_name: panglao ? 'Panglao, Bohol, Philippines' : 'Cebu City, Philippines', name: panglao ? 'Panglao' : 'Cebu City' }] })
  })
  await page.route('https://overpass-api.de/api/interpreter', route => route.fulfill({ json: { ...overpass, elements: [{ type: 'node', id: 991, lat: 10.316, lon: 123.886, tags: { amenity: 'restaurant', name: '<img src=x onerror=alert(1)>' } }, ...overpass.elements.slice(0, 2)] } }))
  await openPlanner(page, { width: 390, height: 844 })
  expect(tilesRequested).toBe(0)
  await page.getByLabel('Ville ou étape à explorer').fill('Cebu City')
  await page.getByRole('button', { name: 'Rechercher une destination' }).click()
  await page.getByRole('button', { name: 'Explorer autour' }).click()
  await expect(page.locator('.stay-map')).toBeVisible()
  await expect(page.getByText('<img src=x onerror=alert(1)>', { exact: true }).first()).toBeVisible()
  await page.locator('[data-stay-place="osm:node/991"]').getByRole('button', { name: 'Garder', exact: true }).click()
  expect(tilesRequested).toBeGreaterThan(0)
  await page.locator('.stay-map').scrollIntoViewIfNeeded()
  await expect(page.locator('.stay-map .leaflet-tile-pane')).toBeAttached()
  await page.screenshot({ path: join(output, 'mock-mobile-map.png'), fullPage: false })
  await expect(page.locator('.leaflet-overlay-pane path[data-stay-place-name]')).toHaveCount(3)
  await expect(page.locator('.leaflet-overlay-pane path[data-stay-place-name="<img src=x onerror=alert(1)>"]')).toHaveCount(1)
  await page.locator('.leaflet-overlay-pane path').evaluateAll(elements => {
    const marker = elements.find(element => element.getAttribute('data-stay-place-name') === '<img src=x onerror=alert(1)>')
    marker?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
  })
  await expect(page.locator('.leaflet-tooltip')).toHaveText('<img src=x onerror=alert(1)>')
  await expect(page.locator('.leaflet-tooltip img')).toHaveCount(0)
  await page.getByLabel('Ville ou étape à explorer').fill('Panglao, Bohol, Philippines')
  await page.getByRole('button', { name: 'Rechercher une destination' }).click()
  await page.getByRole('button', { name: 'Explorer autour' }).click()
  await expect(page.getByRole('heading', { name: /Panglao.*centre choisi/ })).toBeVisible()
  await expect(page.locator('.stay-wishes')).toHaveCount(0)
  const serialized = await page.evaluate(() => JSON.parse(localStorage.getItem('un-soir-la-bas-upcoming-v1')!)[0].plan)
  expect(serialized.stayContexts).toHaveLength(2)
  expect(serialized.stayContexts.find((item: { stay: { anchor: { name: string } } }) => item.stay.anchor.name === 'Cebu City').stay.places).toHaveLength(1)
  await page.getByLabel('Ville ou étape à explorer').fill('Cebu City')
  await page.getByRole('button', { name: 'Rechercher une destination' }).click()
  await page.getByRole('button', { name: 'Explorer autour' }).click()
  await expect(page.getByRole('heading', { name: /Cebu City.*centre choisi/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Vos envies gardées/ })).toContainText('1')
  await expect(page.locator('.stay-wishes').getByText('<img src=x onerror=alert(1)>', { exact: true })).toBeVisible()
})

test('déplace une envie dans les deux sens avec une cible explicitement sélectionnée', async ({ page }) => {
  const seed = [{ ...trip, plan: { ideas: [], stops: [], notes: '', stay: {
    anchor: { name: 'Cebu City', latitude: 10.3157, longitude: 123.8854 },
    places: [
      { id: 'a', name: 'Museum A', category: 'activity', source: 'manual', latitude: 10.315, longitude: 123.886 },
      { id: 'b', name: 'Museum B', category: 'activity', source: 'manual', latitude: 10.316, longitude: 123.887 },
    ],
    days: [
      { id: 'stay-day-1', title: 'Jour 1', placeIds: ['a', 'b'], locked: false },
      { id: 'stay-day-2', title: 'Jour 2', placeIds: [], locked: false },
    ], daysCount: 2,
  } } }]
  await page.addInitScript(state => localStorage.setItem('un-soir-la-bas-upcoming-v1', JSON.stringify(state)), seed)
  await page.goto('/#plan/philippines-family')
  const first = page.locator('.stay-day').first()
  await expect(first.getByText('Museum A')).toBeVisible()
  await first.locator('.stay-move select').first().selectOption('stay-day-2')
  await expect(page.locator('.stay-day').nth(1).getByText('Museum A')).toBeVisible()
  const second = page.locator('.stay-day').nth(1)
  await second.locator('.stay-move select').filter({ has: page.locator('option[value="stay-day-1"]') }).selectOption('stay-day-1')
  await expect(first.getByText('Museum A')).toBeVisible()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('un-soir-la-bas-upcoming-v1')!)[0].plan.stay.days.map((day: { placeIds: string[] }) => day.placeIds.sort()))).toEqual([['a', 'b'], []])
})

test('un onglet périmé refuse une sauvegarde et conserve le changement concurrent', async ({ browser }) => {
  const context = await browser.newContext()
  const first = await context.newPage()
  const second = await context.newPage()
  const stay = { anchor: { name: 'Cebu City', latitude: 10.3157, longitude: 123.8854 }, places: [{ id: 'place-a', name: 'Cebu Museum', category: 'activity', source: 'manual', latitude: 10.315, longitude: 123.886 }], days: [{ id: 'day-a', title: 'Jour 1', placeIds: ['place-a'], locked: false }], daysCount: 1 }
  const tripState = [{ ...trip, plan: { ideas: [], stops: [], notes: '', stay } }]
  await first.addInitScript(state => localStorage.setItem('un-soir-la-bas-upcoming-v1', JSON.stringify(state)), tripState)
  await first.goto('/#plan/philippines-family')
  await expect(first.getByRole('heading', { name: 'Des repères pour le voyage en famille.' })).toBeVisible()
  await second.goto('/#plan/philippines-family')
  await expect(second.getByRole('heading', { name: 'Des repères pour le voyage en famille.' })).toBeVisible()
  await first.getByRole('button', { name: 'Verrouiller cette journée' }).click()
  await second.getByRole('button', { name: 'Retirer du jour' }).click()
  await expect(second.getByText(/Cette préparation a changé dans un autre onglet/)).toBeVisible()
  const saved = await second.evaluate(() => JSON.parse(localStorage.getItem('un-soir-la-bas-upcoming-v1')!)[0].plan.stay)
  expect(saved.days[0].locked).toBe(true)
  expect(saved.days[0].placeIds).toEqual(['place-a'])
  await context.close()
})

test('conserve un séjour historique avec contextes vides après exploration et changement de centre', async ({ page }) => {
  const legacy = { anchor: { name: 'Cebu City', latitude: 10.3157, longitude: 123.8854 }, places: [{ id: 'legacy-a', name: 'Legacy museum', category: 'activity', source: 'manual', latitude: 10.315, longitude: 123.886 }], days: [{ id: 'legacy-day', title: 'Jour 1', placeIds: ['legacy-a'], locked: true }], daysCount: 1 }
  await page.addInitScript(({ trip, legacy }) => localStorage.setItem('un-soir-la-bas-upcoming-v1', JSON.stringify([{ ...trip, plan: { ideas: [], stops: [], notes: '', stay: legacy, stayContexts: [] } }])), { trip, legacy })
  await page.route('https://nominatim.openstreetmap.org/**', route => route.fulfill({ json: new URL(route.request().url()).searchParams.get('q')?.includes('Panglao') ? [{ ...geocode[0], lat: '9.6', lon: '123.85', name: 'Panglao', display_name: 'Panglao, Philippines' }] : geocode }))
  await page.route('https://overpass-api.de/api/interpreter', route => route.fulfill({ json: overpass }))
  await page.route('https://tile.openstreetmap.org/**', route => route.abort())
  await page.goto('/#plan/philippines-family')
  for (const query of ['Cebu City', 'Panglao', 'Cebu City']) {
    await page.getByLabel('Ville ou étape à explorer').fill(query)
    await page.getByRole('button', { name: 'Rechercher une destination' }).click()
    await page.getByRole('button', { name: 'Explorer autour' }).click()
    await expect(page.getByRole('heading', { name: new RegExp(`${query}.*centre choisi`) })).toBeVisible()
    if (query === 'Cebu City') {
      await expect(page.locator('.stay-wishes').getByText('Legacy museum')).toBeVisible()
      await expect(page.locator('.stay-day').getByRole('button', { name: '🔒 Journée verrouillée' })).toBeVisible()
    }
  }
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('un-soir-la-bas-upcoming-v1')!)[0].plan.stay)).toEqual(legacy)
})

test('erreur Overpass n’est jamais présentée comme une absence de lieux', async ({ page }) => {
  await page.route('https://nominatim.openstreetmap.org/**', route => route.fulfill({ json: geocode }))
  await page.route('https://overpass-api.de/api/interpreter', route => route.fulfill({ status: 504, body: 'timeout' }))
  await openPlanner(page, { width: 390, height: 844 })
  await page.getByRole('button', { name: 'Rechercher une destination' }).click()
  await page.getByRole('button', { name: 'Explorer autour' }).click()
  await expect(page.getByText(/HTTP 504/)).toBeVisible()
  await expect(page.getByText(/Aucun nom de cette catégorie/)).toHaveCount(0)
  await expect(page.getByText(/Aucune liste affichée/)).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
})
