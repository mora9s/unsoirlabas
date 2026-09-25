import {test,expect} from '@playwright/test'
import {readFileSync} from 'node:fs'

test('fermeture et réouverture sans réseau : programme, photo et nouveau souvenir',async({page,context})=>{
  await page.goto('/')
  const photo=readFileSync('public/assets/el-nido-big-lagoon.jpg').toString('base64')
  await page.evaluate(photo=>{
    const now=new Date(),date=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
    localStorage.setItem('un-soir-la-bas-upcoming-v1',JSON.stringify([{id:'offline',destination:'Nice',departure:date,plan:{ideas:[],notes:'Train réservé',stops:[{id:'hotel',place:'Hôtel du port',date,address:'Nice',booking:'REF-42',chapterId:'arrival'}]}}]))
    localStorage.setItem('un-soir-la-bas-journals-v1',JSON.stringify({version:1,journals:[{tripId:'offline',destination:'Nice',departure:date,chapters:[{id:'arrival',title:'Notre arrivée',story:'La mer',memories:'',tone:'',status:'draft',coverId:'photo',media:[{id:'photo',name:'Lagon',src:`data:image/jpeg;base64,${photo}`}]}]}]}))
  },photo)
  await page.goto('/#today/offline')
  await page.getByRole('button',{name:'Télécharger pour le hors connexion'}).click()
  await expect(page.getByRole('status')).toContainText('Application disponible hors connexion',{timeout:20000})
  await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true)
  await page.close()
  await context.setOffline(true)
  const offline=await context.newPage()
  await offline.goto('/#today/offline')
  await expect(offline.getByText('Réservation : REF-42')).toBeVisible()
  await expect(offline.getByRole('complementary',{name:'Disponibilité hors connexion'})).toContainText('Vous êtes hors connexion · Application téléchargée')
  await offline.getByLabel('Quelques mots').fill('Écrit sans réseau')
  await offline.getByRole('button',{name:'Garder ce souvenir'}).click()
  await offline.getByRole('button',{name:'Lire le chapitre'}).click()
  await expect(offline.getByText(/Écrit sans réseau/).first()).toBeVisible()
  await expect.poll(()=>offline.locator('main img').first().evaluate((image:HTMLImageElement)=>image.complete && image.naturalWidth>0)).toBe(true)
  await offline.goto('/#plan/offline')
  await expect(offline.getByLabel('Notes de préparation')).toHaveValue('Train réservé')
  await context.setOffline(false)
  await offline.goto('/#today/offline')
  await offline.getByRole('button',{name:'Actualiser la copie hors connexion'}).click()
  await expect(offline.getByRole('status')).toContainText('Application disponible hors connexion')
})

test('un téléchargement refusé reste explicite sans modifier les données',async({page,context})=>{
  await context.route('**/offline-worker.js',route=>route.abort())
  await page.goto('/#tools')
  const before=await page.evaluate(()=>localStorage.getItem('un-soir-la-bas-journals-v1'))
  await page.getByRole('button',{name:'Télécharger pour le hors connexion'}).click()
  await expect(page.getByRole('status')).toContainText('Téléchargement incomplet')
  await expect(page.getByRole('complementary',{name:'Disponibilité hors connexion'})).toContainText('Application non préparée')
  expect(await page.evaluate(()=>localStorage.getItem('un-soir-la-bas-journals-v1'))).toBe(before)
})
