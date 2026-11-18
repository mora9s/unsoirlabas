import {test,expect} from '@playwright/test'
import {mkdir} from 'node:fs/promises'

const key='un-soir-la-bas-upcoming-v1'
const trip={
 id:'map-first-fixture',destination:'Visayas · fixture',departure:'2027-02-01',endDate:'2027-02-04',
 plan:{ideas:[{id:'wish-1',text:'Un café à découvrir'}],notes:'',stops:[
  {id:'stop-1',place:'Port Barton',date:'2027-02-01',point:{lat:10.4,lon:119.25},kind:'visit'},
  {id:'stop-2',place:'Étape à situer',date:'2027-02-01',kind:'visit'},
  {id:'stop-3',place:'Lazi',date:'2027-02-03',point:{lat:9.13,lon:123.63},kind:'meal'},
  {id:'stop-4',place:'Sans date',kind:'visit'},
 ],stay:{anchor:{name:'Hébergement de fixture',latitude:10.4,longitude:119.25},places:[],days:[],daysCount:1}}
}
async function openFixture(page:import('@playwright/test').Page){
 await page.goto('/')
 await page.evaluate(([storageKey,value])=>localStorage.setItem(storageKey,JSON.stringify([value])),[key,trip] as [string,typeof trip])
 await page.goto('/#explore/map-first-fixture')
 await expect(page.getByRole('region',{name:'Aperçu du voyage'})).toContainText('Visayas · fixture')
}
test('programme carte-first : ordre, étape sans position, séjour, journée libre et pont Raconter',async({page})=>{
 await page.setViewportSize({width:390,height:844})
 await page.route('**/tile.openstreetmap.org/**',route=>route.abort())
 await openFixture(page)
 const rows=page.locator('.trip-stop-row')
 await expect(rows).toHaveCount(4)
 await expect(page.getByRole('button',{name:'Voyage entier'})).toHaveAttribute('aria-pressed','true')
 await expect(page.locator('.leaflet-marker-icon')).toHaveCount(2)
 await expect(page.getByRole('complementary',{name:'Étapes prévues'})).toContainText('Centre du séjour · Hébergement de fixture')
 await expect(rows.nth(0)).toContainText('Port Barton')
 await expect(rows.nth(1)).toContainText('Étape à situer')
 await expect(rows.nth(1)).toContainText('À situer')
 await expect(rows.nth(1).getByRole('link',{name:/Y aller/})).toHaveCount(0)
 await expect(rows.nth(0).getByRole('link',{name:/Raconter/})).toHaveAttribute('href',/#trip-create\/map-first-fixture\/planned\/stop-1\/Port%20Barton/)
 const before=await page.evaluate(storageKey=>localStorage.getItem(storageKey),key)
 await rows.nth(0).getByRole('button',{name:/Port Barton/}).click()
 await expect(page.getByRole('region',{name:'Fiche du lieu'})).toContainText('Port Barton')
 await expect(page.getByRole('region',{name:'Fiche du lieu'}).getByRole('link',{name:/Y aller/})).toBeVisible()
 await page.getByRole('button',{name:/J2/}).click()
 await expect(page.getByText(/Aucune étape prévue ce jour/)).toBeVisible()
 await page.getByRole('button',{name:/À programmer/}).click()
 await expect(rows).toHaveCount(1)
 await expect(rows.first()).toContainText('Sans date')
 await rows.first().getByRole('link',{name:/Raconter/}).click()
 await expect(page.getByTestId('planned-step-context')).toContainText('Étape prévue · Sans date')
 expect(await page.evaluate(storageKey=>localStorage.getItem(storageKey),key)).toBe(before)
})
test('day selection and location are ephemeral and never reorder stops',async({page})=>{
 await page.addInitScript(()=>{
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition:(ok:PositionCallback)=>{(window as any).__geoOk=ok}}})
 })
 await openFixture(page)
 const before=await page.evaluate(storageKey=>localStorage.getItem(storageKey),key)
 await page.getByRole('button',{name:'Me situer'}).click()
 await page.evaluate(()=>{const callback=(window as any).__geoOk as PositionCallback;callback({coords:{latitude:9.14,longitude:123.62,accuracy:37,altitude:null,altitudeAccuracy:null,heading:null,speed:null},timestamp:Date.now()})})
 await expect(page.locator('.discovery-note[role=status]')).toContainText('précision ±37 m')
 await expect(page.locator('.trip-stop-row').nth(0)).toContainText('Port Barton')
 await expect(page.locator('.trip-stop-row').nth(1)).toContainText('Étape à situer')
 expect(await page.evaluate(storageKey=>localStorage.getItem(storageKey),key)).toBe(before)
})
test('mobile and desktop map-first layout stays within viewport; captures synthetic fixture',async({page})=>{
 await page.route('**/tile.openstreetmap.org/**',route=>route.abort())
 await openFixture(page)
 await mkdir('evidence/map-first',{recursive:true})
 for(const width of [320,390,1440]){
  await page.setViewportSize({width,height:width===1440?1000:844})
  await page.waitForTimeout(250)
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)
  expect(overflow,`horizontal overflow at ${width}px`).toBeLessThanOrEqual(1)
  await expect(page.locator('.discovery-canvas')).toBeVisible()
  const targets=page.locator('.map-day-strip button,.trip-stop-row a,.discovery-toolbar .text-button')
  const heights=await targets.evaluateAll(items=>items.map(item=>item.getBoundingClientRect().height))
  expect(heights.length).toBeGreaterThan(5)
  expect(Math.min(...heights),`smallest critical target at ${width}px`).toBeGreaterThanOrEqual(44)
  await page.screenshot({path:`evidence/map-first/fixture-${width}.png`,fullPage:true})
 }
})
test('active trips default to today; future trips remain on the overview',async({page})=>{
 await page.goto('/')
 const today=await page.evaluate(([storageKey,value])=>{const now=new Date(),date=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;const active=structuredClone(value);active.departure=date;active.endDate=date;active.plan.stops[0].date=date;localStorage.setItem(storageKey,JSON.stringify([active]));return date},[key,trip] as [string,typeof trip])
 await page.goto('/#explore/map-first-fixture')
 await expect(page.locator('.map-day-strip button[aria-pressed=true]')).toContainText('J1')
 await expect(page.locator('.trip-stop-row')).toHaveCount(1)
 await expect(page.locator('.trip-stop-row').first()).toContainText(today)
})
test('geolocation ignores stale callbacks and reports unavailable without saving',async({page})=>{
 await page.addInitScript(()=>{
  (window as any).__geoCallbacks=[]
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition:(ok:PositionCallback,error:PositionErrorCallback)=>{(window as any).__geoCallbacks.push({ok,error})}}})
 })
 await openFixture(page)
 const before=await page.evaluate(storageKey=>localStorage.getItem(storageKey),key)
 await page.getByRole('button',{name:'Me situer'}).click()
 await page.getByRole('button',{name:'Relancer la localisation'}).click()
 await page.evaluate(()=>{const cb=(window as any).__geoCallbacks[0].ok as PositionCallback;cb({coords:{latitude:1,longitude:1,accuracy:999,altitude:null,altitudeAccuracy:null,heading:null,speed:null},timestamp:Date.now()} as unknown as GeolocationPosition)})
 await expect(page.locator('.discovery-note[role=status]')).not.toContainText('±999 m')
 await page.evaluate(()=>{const cb=(window as any).__geoCallbacks[1].ok as PositionCallback;cb({coords:{latitude:9.14,longitude:123.62,accuracy:42,altitude:null,altitudeAccuracy:null,heading:null,speed:null},timestamp:Date.now()} as unknown as GeolocationPosition)})
 await expect(page.locator('.discovery-note[role=status]')).toContainText('précision ±42 m')
 expect(await page.evaluate(storageKey=>localStorage.getItem(storageKey),key)).toBe(before)
 await page.addInitScript(()=>Object.defineProperty(navigator,'geolocation',{configurable:true,value:undefined}))
 await page.reload()
 await page.getByRole('button',{name:'Me situer'}).click()
 await expect(page.getByRole('status')).toContainText('La localisation n’est pas disponible')
 expect(await page.evaluate(storageKey=>localStorage.getItem(storageKey),key)).toBe(before)
})
test('real OSM map tile smoke (separate from synthetic fixtures)',async({page})=>{
 test.skip(process.env.RUN_LIVE_MAP_SMOKE!=='1','Optional live OSM provider check; deterministic regressions run without network')
 await page.setViewportSize({width:390,height:844})
 await openFixture(page)
 await page.waitForTimeout(9000)
 const tileState=await page.locator('.leaflet-tile').evaluateAll(images=>images.map(image=>({loaded:(image as HTMLImageElement).complete&&Boolean((image as HTMLImageElement).naturalWidth),src:(image as HTMLImageElement).src})))
 const loaded=tileState.filter(tile=>tile.loaded).length
 console.log(`Real-map smoke: ${loaded}/${tileState.length} OSM tiles decoded; map visible=${await page.locator('.discovery-canvas').isVisible()}`)
 expect(loaded,'Actual decoded OSM tiles, not just a mounted map container').toBeGreaterThan(0)
 await page.screenshot({path:'evidence/map-first/real-map-390.png',fullPage:true})
 await page.setViewportSize({width:1440,height:1000})
 await page.waitForTimeout(800)
 await page.screenshot({path:'evidence/map-first/real-map-1440.png',fullPage:true})
 const desktopTiles=await page.locator('.leaflet-tile').evaluateAll(images=>images.filter(image=>(image as HTMLImageElement).complete&&Boolean((image as HTMLImageElement).naturalWidth)).length)
 console.log(`Real-map desktop smoke: ${desktopTiles} decoded OSM tiles after resize`)
})
test('trip library primary action opens its map; editor remains in navigation',async({page})=>{
 await page.goto('/')
 await page.evaluate(([storageKey,value])=>localStorage.setItem(storageKey,JSON.stringify([value])),[key,trip])
 await page.reload()
 await page.getByRole('button',{name:'Ouvrir la carte de Visayas · fixture'}).click()
 await expect(page).toHaveURL(/#explore\/map-first-fixture$/)
 await expect(page.getByRole('navigation',{name:'Navigation du voyage'}).getByRole('link',{name:'Programme'})).toBeVisible()
 await page.getByRole('navigation',{name:'Navigation du voyage'}).getByRole('link',{name:'Programme'}).click()
 await expect(page).toHaveURL(/#plan\/map-first-fixture$/)
})

for (const width of [390,1440]) {
 test(`selected marker and detail stay usable together at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:width===1440?1000:844})
  await page.route('**/tile.openstreetmap.org/**',route=>route.abort())
  await openFixture(page)
  await page.getByRole('button',{name:/^J3/}).click()
  const dayFits=await page.locator('.map-day-strip').evaluate(strip=>{const row=strip.getBoundingClientRect(),active=strip.querySelector('[aria-pressed=true]')!.getBoundingClientRect();return active.left>=row.left-1&&active.right<=row.right+1})
  expect(dayFits,'Selected day remains fully readable in its horizontal strip').toBe(true)
  await expect(page.locator('.trip-stop-number')).toHaveText('1')
  await expect(page.locator('.discovery-pin span')).toHaveText('1')
  await page.locator('.discovery-pin').click()
  const detail=page.getByRole('region',{name:'Fiche du lieu'})
  await expect(detail).toBeInViewport()
  await expect(detail.getByRole('heading',{name:'Lazi'})).toBeInViewport()
  await expect(page.locator('.trip-stop-row .discovery-place[aria-pressed=true]')).toContainText('Lazi')
  const marker=await page.locator('.discovery-pin.selected').boundingBox(),sheet=await detail.boundingBox()
  expect(marker).not.toBeNull();expect(sheet).not.toBeNull()
  expect(marker!.x+marker!.width/2<sheet!.x || marker!.x+marker!.width/2>sheet!.x+sheet!.width || marker!.y+marker!.height/2<sheet!.y || marker!.y+marker!.height/2>sheet!.y+sheet!.height).toBe(true)
  await mkdir('evidence/map-first',{recursive:true})
  await page.screenshot({path:`evidence/map-first/selected-${width}.png`})
  await detail.getByRole('button',{name:'Fermer la fiche ×'}).click()
  await page.locator('.trip-stop-row .discovery-place').click()
  await expect(detail.getByRole('heading',{name:'Lazi'})).toBeInViewport()
  await expect(page.locator('.trip-stop-row .discovery-place[aria-pressed=true]')).toHaveCount(1)
 })
}

test('dates without end date retain their real day offset in Paris and Manila',async({browser})=>{
 for(const timezoneId of ['Europe/Paris','Asia/Manila']){
  const context=await browser.newContext({timezoneId}),page=await context.newPage()
  await page.goto('/')
  await page.evaluate(([storageKey,value])=>{const legacy=structuredClone(value) as Partial<typeof value>;delete legacy.endDate;localStorage.setItem(storageKey,JSON.stringify([legacy]))},[key,trip] as [string,typeof trip])
  const before=await page.evaluate(storageKey=>localStorage.getItem(storageKey),key)
  await page.goto('/#explore/map-first-fixture')
  await expect(page.getByRole('button',{name:/^J3/})).toContainText('3 févr.')
  await page.getByRole('button',{name:/^J3/}).click()
  await expect(page.locator('.trip-stop-row')).toContainText('Lazi')
  expect(await page.evaluate(storageKey=>localStorage.getItem(storageKey),key)).toBe(before)
  await context.close()
 }
})

test('GPS remains centered after effects, including wish-only mode',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition:(ok:PositionCallback)=>ok({coords:{latitude:48.8566,longitude:2.3522,accuracy:20},timestamp:Date.now()} as GeolocationPosition)}}))
 await openFixture(page)
 await page.getByLabel('Mes envies uniquement').check()
 await page.getByRole('button',{name:'Me situer'}).click()
 await expect(page.locator('.discovery-note[role=status]')).toContainText('±20 m')
 await page.waitForTimeout(300)
 const offset=await page.locator('.discovery-canvas').evaluate(canvas=>{const map=canvas.getBoundingClientRect(),dot=canvas.querySelector('.leaflet-overlay-pane path:last-child')?.getBoundingClientRect();return dot?{x:Math.abs(dot.x+dot.width/2-map.x-map.width/2),y:Math.abs(dot.y+dot.height/2-map.y-map.height/2)}:null})
 expect(offset).not.toBeNull();expect(offset!.x).toBeLessThan(3);expect(offset!.y).toBeLessThan(3)
})

test('saved trip map reopens offline with day list and no invented coordinates',async({page,context})=>{
 await openFixture(page)
 const before=await page.evaluate(storageKey=>localStorage.getItem(storageKey),key)
 await page.goto('/#tools')
 const access=page.getByRole('complementary',{name:'Disponibilité hors connexion'})
 if (!await access.locator('details').evaluate(node => (node as HTMLDetailsElement).open)) await access.locator('summary').click()
 await access.getByRole('button',{name:/^(Télécharger pour le hors connexion|Actualiser la copie hors connexion)$/}).click()
 await expect(access.getByRole('status')).toContainText('Application disponible hors connexion',{timeout:20000})
 await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true)
 await page.close()
 await context.setOffline(true)
 const offline=await context.newPage()
 await offline.goto('/#explore/map-first-fixture')
 await expect(offline.locator('.trip-stop-row')).toHaveCount(4)
 await expect(offline.locator('.trip-stop-row').nth(1)).toContainText('À situer')
 await offline.getByRole('button',{name:/^J2/}).click()
 await expect(offline.getByText(/Aucune étape prévue ce jour/)).toBeVisible()
 expect(await offline.evaluate(storageKey=>localStorage.getItem(storageKey),key)).toBe(before)
 await context.setOffline(false)
})


test('jours de séjour acceptés restent relatifs et distincts des étapes datées',async({page})=>{
 await page.goto('/')
 await page.evaluate(([storageKey,value])=>{
  const v=structuredClone(value)
  v.plan.stay={anchor:{name:'Centre de Bohol',latitude:9.6,longitude:123.8},daysCount:3,places:[
   {id:'a',name:'Lagon',latitude:9.61,longitude:123.81,category:'activity',source:'manual'},
   {id:'b',name:'Marché',latitude:9.62,longitude:123.82,category:'restaurant',source:'manual'}],days:[
   {id:'d1',title:'Détente',placeIds:['a'],locked:false},{id:'d2',title:'Découverte',placeIds:['b'],locked:false},{id:'d3',title:'Repos',placeIds:[],locked:false}]} as any
  const selected=structuredClone(v.plan.stay)
  ;(v.plan as any).stayContexts=[{key:'9.60000,123.80000',stay:selected}]
  ;(v.plan as any).selectedStayContextKey='9.60000,123.80000'
  v.plan.stay={anchor:{name:'Ancien centre',latitude:10.4,longitude:119.25},places:[],days:[],daysCount:1}
  localStorage.setItem(storageKey,JSON.stringify([v]))
 },[key,trip] as [string,typeof trip])
 const before=await page.evaluate(k=>localStorage.getItem(k),key)
 await page.goto('/#explore/map-first-fixture')
 const picker=page.getByRole('navigation',{name:'Jours du séjour sans date'})
 await picker.getByRole('button',{name:/Jour du séjour 1/}).click()
 const list=page.getByRole('complementary',{name:'Étapes prévues'})
 await expect(list).toContainText('Centre du séjour · Centre de Bohol')
 await expect(list).toContainText('Lagon');await expect(list).not.toContainText('Marché')
 await list.getByRole('button',{name:/Lagon/}).click()
 await expect(page.getByRole('region',{name:'Fiche du lieu'})).toContainText('Lagon')
 await expect(list.getByRole('button',{name:/Lagon/})).toHaveAttribute('aria-pressed','true')
 await picker.getByRole('button',{name:/Jour du séjour 2/}).click()
 await expect(list).toContainText('Marché');await expect(list).not.toContainText('Lagon')
 await picker.getByRole('button',{name:/Jour du séjour 3/}).click()
 await expect(list).toContainText('journée libre')
 await page.getByRole('navigation',{name:'Journées du voyage'}).getByRole('button',{name:/^J1/}).click()
 await expect(list).toContainText('Port Barton');await expect(list).not.toContainText('Lagon')
 expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBe(before)
})
