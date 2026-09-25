import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { validateUpcomingTrips } from '../src/upcoming-trips'

test('les informations pratiques invalides sont refusées avant import ou enregistrement', () => {
  const trips = (extra: object) => [{id:'trip',destination:'Nice',departure:'2027-04-12',plan:{ideas:[],notes:'',stops:[{id:'stop',place:'Nice',...extra}]}}]
  expect(validateUpcomingTrips(trips({}))).toBe(true)
  expect(validateUpcomingTrips(trips({time:'23:59',kind:'stay',address:'Nice',booking:'ABC',notes:'Arrivée tardive'}))).toBe(true)
  for (const extra of [{time:'24:00'},{time:'12:60'},{kind:'unknown'},{address:42},{booking:'x'.repeat(301)},{notes:'x'.repeat(2001)}]) expect(validateUpcomingTrips(trips(extra))).toBe(false)
})

async function seed(page: import('@playwright/test').Page, populated = false) {
  await page.goto('/')
  const photo = readFileSync('public/assets/el-nido-big-lagoon.jpg').toString('base64')
  await page.evaluate(({populated,photo}) => {
    localStorage.setItem('un-soir-la-bas-upcoming-v1',JSON.stringify([{ id:'studio', destination:'Notre grande échappée', departure:'2027-04-12', plan:{ ideas:[], notes:'', stops:populated ? [{id:'nice',place:'Nice',point:{lat:43.7031,lon:7.2661}},{id:'cebu',place:'Cebu',point:{lat:10.3157,lon:123.8854},transport:'plane',chapterId:'lagon'}] : [] } }]))
    localStorage.setItem('un-soir-la-bas-journals-v1',JSON.stringify({version:1,journals:[{tripId:'studio',destination:'Notre grande échappée',departure:'2027-04-12',chapters:[{id:'lagon',title:'Notre arrivée au lagon',story:'Un souvenir.',memories:'',tone:'',status:'draft',coverId:'img',media:[{id:'img',name:'Le lagon',src:`data:image/jpeg;base64,${photo}`}]}]}]}))
  },{populated,photo})
}

for (const width of [1280, 390]) test(`les escales du Pacifique restent dans le cadrage à ${width}px`, async ({page}) => {
  await page.setViewportSize({width,height:844})
  await seed(page)
  await page.evaluate(() => {
    const trips = JSON.parse(localStorage.getItem('un-soir-la-bas-upcoming-v1')!)
    trips[0].plan.stops = [
      {id:'fiji',place:'Fidji',point:{lat:-18.14,lon:178.45}},
      {id:'samoa',place:'Samoa',point:{lat:-13.83,lon:-171.76},transport:'plane'},
    ]
    localStorage.setItem('un-soir-la-bas-upcoming-v1',JSON.stringify(trips))
  })
  const saved = await page.evaluate(() => localStorage.getItem('un-soir-la-bas-upcoming-v1'))
  await page.goto('/#plan/studio')
  await page.getByRole('button',{name:'Tout voir sur la carte'}).click()
  await expect(page.locator('.route-pin')).toHaveCount(2)
  const bounds = await page.locator('.route-map').boundingBox()
  for (const pin of await page.locator('.route-pin').all()) {
    const box = await pin.boundingBox()
    expect(box!.x).toBeGreaterThanOrEqual(bounds!.x)
    expect(box!.x + box!.width).toBeLessThanOrEqual(bounds!.x + bounds!.width)
    expect(box!.y).toBeGreaterThanOrEqual(bounds!.y)
    expect(box!.y + box!.height).toBeLessThanOrEqual(bounds!.y + bounds!.height)
  }
  await page.locator('.route-stop-strip button').nth(1).click()
  await page.locator('.route-map').scrollIntoViewIfNeeded()
  await expect(page.locator('.route-pin.chosen')).toBeInViewport()
  expect(await page.evaluate(() => localStorage.getItem('un-soir-la-bas-upcoming-v1'))).toBe(saved)
})

test('un fond de carte partiellement chargé propose une reprise sans toucher aux étapes', async ({page}) => {
  await seed(page,true)
  const png = await page.evaluate(() => document.createElement('canvas').toDataURL().split(',')[1])
  let retry = false, requests = 0
  await page.route('https://tile.openstreetmap.org/**', route => {
    requests++
    return !retry && requests % 2 ? route.abort() : route.fulfill({contentType:'image/png',body:Buffer.from(png,'base64')})
  })
  const saved = await page.evaluate(() => localStorage.getItem('un-soir-la-bas-upcoming-v1'))
  await page.goto('/#plan/studio')
  const button = page.getByRole('button',{name:'Réessayer le fond de carte'})
  await expect(button).toBeVisible()
  await expect.poll(() => page.locator('img.leaflet-tile').evaluateAll(images => images.every(img => (img as HTMLImageElement).complete))).toBe(true)
  await expect(button).toBeVisible()
  retry = true
  await button.click()
  await expect.poll(() => page.locator('img.leaflet-tile').evaluateAll(images => images.length > 0 && images.every(img => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0))).toBe(true)
  await expect(button).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('un-soir-la-bas-upcoming-v1'))).toBe(saved)
})

test('programme quotidien persistant et informations conservées après édition sur la carte',async({page})=>{
  await page.setViewportSize({width:390,height:844})
  await seed(page,true); await page.goto('/#plan/studio')
  const daily=page.locator('.daily-plan')
  await daily.getByLabel('Jour de Nice',{exact:true}).fill('2027-04-12')
  await daily.getByRole('combobox',{name:'Type de Nice',exact:true}).selectOption('stay')
  await daily.getByLabel('Heure prévue à Nice',{exact:true}).fill('16:30')
  const card=daily.locator('article').filter({has:page.getByRole('heading',{name:'Nice',exact:true})})
  await card.getByText('Informations pratiques').click()
  await card.getByLabel('Adresse de Nice',{exact:true}).fill('12 rue du Port, Nice')
  await card.getByLabel('Réservation à Nice',{exact:true}).fill('ABC-123')
  await card.getByLabel('Notes pour Nice',{exact:true}).fill('Arrivée après 16 h')
  await expect(card.getByRole('link',{name:'Ouvrir l’itinéraire'})).toHaveAttribute('href',/destination=12%20rue/)
  await page.locator('.route-stop-strip button').first().click()
  await page.getByRole('button',{name:'Enregistrer cette escale'}).click()
  await page.reload()
  await expect(daily.getByLabel('Heure prévue à Nice',{exact:true})).toHaveValue('16:30')
  const stops=await page.evaluate(()=>JSON.parse(localStorage.getItem('un-soir-la-bas-upcoming-v1')!)[0].plan.stops)
  expect(stops[0]).toMatchObject({date:'2027-04-12',kind:'stay',time:'16:30',address:'12 rue du Port, Nice',booking:'ABC-123',notes:'Arrivée après 16 h'})
  await daily.getByLabel('Jour de Nice',{exact:true}).fill('2027-04-13')
  await expect(daily.getByRole('region',{name:'2027-04-13'})).toContainText('Nice')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1)
  await daily.screenshot({path:test.info().outputPath('programme-mobile.png')})
})

test('construit sur la carte, cherche, déplace et annule un retrait',async({page})=>{
  await page.route('https://photon.komoot.io/**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({features:[{geometry:{type:'Point',coordinates:[7.2661,43.7031]},properties:{name:'Nice',country:'France'}}]})}))
  await seed(page); await page.goto('/#plan/studio')
  const builder=page.getByRole('region',{name:'Construire le parcours sur la carte'})
  await builder.getByLabel('Chercher une ville ou un lieu').fill('Nice')
  await builder.getByRole('button',{name:'Rechercher',exact:true}).click()
  await builder.getByRole('button',{name:'Nice France'}).click()
  await builder.getByRole('button',{name:'Ajouter cette escale'}).click()
  await builder.locator('.route-map').click({position:{x:260,y:150}})
  await builder.getByLabel('Nom du lieu').fill('Notre hôtel')
  await builder.getByLabel('Comment y arrivez-vous ?').selectOption('car')
  await builder.getByLabel('Chapitre à l’arrivée').selectOption('lagon')
  await builder.getByRole('button',{name:'Ajouter cette escale'}).click()
  await expect(builder.locator('.route-stop-strip li')).toHaveCount(2)
  await builder.locator('.route-stop-strip button').nth(1).click()
  await builder.getByRole('button',{name:'Retirer cette escale'}).click()
  await expect(builder.locator('.route-stop-strip li')).toHaveCount(1)
  await builder.getByRole('button',{name:'Annuler le retrait'}).click()
  await page.reload()
  await expect(builder.locator('.route-stop-strip li')).toHaveCount(2)
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('un-soir-la-bas-upcoming-v1')!)[0].plan.stops)
  expect(saved[1]).toMatchObject({place:'Notre hôtel',transport:'car',chapterId:'lagon'})
  expect(saved[1].point.lat).toBeGreaterThan(40)
})

for(const format of ['landscape','portrait'] as const) test(`export vidéo ${format} réellement lisible avec photos`,async({page},testInfo)=>{
  test.setTimeout(90000)
  await seed(page,true); await page.goto('/#motion/studio')
  await expect(page.getByRole('button',{name:'Lancer le voyage'})).toBeEnabled({timeout:20000})
  const snapshot=await page.evaluate(()=>localStorage.getItem('un-soir-la-bas-upcoming-v1'))
  await page.getByRole('button',{name:'Créer mon film'}).click()
  await page.getByLabel('Format du film').selectOption(format)
  await page.getByRole('button',{name:'Créer la vidéo',exact:true}).click()
  await expect(page.getByRole('link',{name:'Télécharger le film'})).toBeVisible({timeout:60000})
  const video=page.getByLabel('Aperçu du film exporté')
  await expect.poll(()=>video.evaluate((v:HTMLVideoElement)=>({w:v.videoWidth,h:v.videoHeight,ready:v.readyState}))).toEqual({w:format==='portrait'?720:1280,h:format==='portrait'?1280:720,ready:4})
  await video.evaluate((v:HTMLVideoElement)=>{v.currentTime=11})
  await expect.poll(()=>video.evaluate((v:HTMLVideoElement)=>v.currentTime)).toBeGreaterThan(10)
  const download=page.waitForEvent('download'); await page.getByRole('link',{name:'Télécharger le film'}).click()
  const file=await download; await file.saveAs(testInfo.outputPath(file.suggestedFilename()))
  await page.screenshot({path:testInfo.outputPath(`film-${format}.png`),fullPage:true})
  expect(await page.evaluate(()=>localStorage.getItem('un-soir-la-bas-upcoming-v1'))).toBe(snapshot)
  await expect(page.getByRole('button',{name:'Lancer le voyage'})).toBeEnabled()
})

test('annuler le film ne propose aucune vidéo partielle et réactive le lecteur',async({page})=>{
  await seed(page,true); await page.goto('/#motion/studio')
  await expect(page.getByRole('button',{name:'Lancer le voyage'})).toBeEnabled({timeout:20000})
  await page.getByRole('button',{name:'Créer mon film'}).click(); await page.getByRole('button',{name:'Créer la vidéo',exact:true}).click()
  await page.getByRole('button',{name:'Annuler la création'}).click()
  await expect(page.getByText('Création annulée. Votre carnet reste intact.')).toBeVisible()
  await expect(page.getByRole('link',{name:'Télécharger le film'})).toHaveCount(0)
  await expect(page.getByRole('button',{name:'Lancer le voyage'})).toBeEnabled()
})

test('carte et réglages vidéo lisibles sur téléphone',async({page})=>{
  await page.setViewportSize({width:390,height:844}); await seed(page,true); await page.goto('/#plan/studio')
  await expect(page.locator('.route-map')).toBeVisible()
  await page.screenshot({path:test.info().outputPath('route-mobile.png'),fullPage:true})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1)
  await page.goto('/#motion/studio'); await page.getByRole('button',{name:'Créer mon film'}).click()
  await expect(page.getByLabel('Format du film')).toBeVisible()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1)
})

test('copie de lecture autonome, photos hors ligne et textes jamais exécutés',async({page,browser},testInfo)=>{
  await seed(page,true)
  await page.evaluate(()=>{
    const data=JSON.parse(localStorage.getItem('un-soir-la-bas-journals-v1')!)
    data.journals[0].chapters[0].title='<script>window.pwned=1</script>'
    data.journals[0].chapters[0].story='<img src=x onerror="window.pwned=1"> Un souvenir intact.'
    localStorage.setItem('un-soir-la-bas-journals-v1',JSON.stringify(data))
  })
  await page.goto('/#trip/studio')
  const pending=page.waitForEvent('download')
  await page.getByRole('button',{name:'Télécharger la copie de lecture'}).click()
  const download=await pending, path=testInfo.outputPath('carnet.html');await download.saveAs(path)
  const context=await browser.newContext({offline:true}), copy=await context.newPage()
  const requests:string[]=[];copy.on('request',request=>{if(request.url().startsWith('http'))requests.push(request.url())})
  await copy.goto(pathToFileURL(path).href)
  await expect(copy.getByRole('heading',{name:'<script>window.pwned=1</script>',exact:true})).toBeVisible()
  expect(await copy.locator('article img').first().evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true)
  expect(await copy.locator('script').count()).toBe(0)
  expect(requests).toEqual([])
  await expect(copy.getByText('<img src=x onerror="window.pwned=1"> Un souvenir intact.')).toBeVisible()
  await context.close()
})
