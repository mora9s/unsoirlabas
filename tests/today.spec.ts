import {test,expect} from '@playwright/test'

async function seed(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.evaluate(()=>{
    const now=new Date(), date=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
    localStorage.setItem('un-soir-la-bas-upcoming-v1',JSON.stringify([{id:'today',destination:'Riviera',departure:date,plan:{ideas:[],notes:'',stops:[{id:'hotel',place:'Notre hôtel',date,time:'18:00',kind:'stay',address:'Nice',booking:'ABC-42'},{id:'port',place:'Le port',date,time:'09:00',transport:'walk'}]}}]))
  })
  await page.goto('/#today/today')
}

test('journée mobile, photo, association et ajout au même chapitre sans perte',async({page},testInfo)=>{
  await page.setViewportSize({width:390,height:844}); await seed(page)
  await expect(page.getByRole('heading',{level:1})).toContainText('Aujourd’hui · Riviera')
  await expect(page.locator('.daily-columns article').first()).toContainText('Le port')
  await expect(page.getByText('Réservation : ABC-42')).toBeVisible()
  await page.getByRole('combobox',{name:'Associer le souvenir à'}).selectOption('hotel')
  await page.getByLabel('Quelques mots').fill('Le coucher du soleil depuis notre chambre.')
  await page.getByLabel('Ajouter une photo').setInputFiles('public/assets/el-nido-big-lagoon.jpg')
  await expect(page.locator('.quick-photos img')).toHaveCount(1)
  await page.reload()
  await page.getByRole('combobox',{name:'Associer le souvenir à'}).selectOption('hotel')
  await expect(page.getByLabel('Quelques mots')).toHaveValue('Le coucher du soleil depuis notre chambre.')
  await expect(page.locator('.quick-photos img')).toHaveCount(1)
  await page.getByRole('button',{name:'Garder ce souvenir'}).click()
  await expect(page.getByRole('status')).toContainText('Souvenir enregistré')
  await page.getByLabel('Quelques mots').fill('Puis une promenade.')
  await page.getByRole('button',{name:'Garder ce souvenir'}).click()
  const data=await page.evaluate(()=>({journal:JSON.parse(localStorage.getItem('un-soir-la-bas-journals-v1')!),trip:JSON.parse(localStorage.getItem('un-soir-la-bas-upcoming-v1')!)[0]}))
  expect(data.journal.journals[0].chapters).toHaveLength(1)
  const chapter=data.journal.journals[0].chapters[0]
  expect(chapter.story).toContain('Le coucher du soleil');expect(chapter.story).toContain('Puis une promenade.')
  expect(chapter.media).toHaveLength(1)
  expect(data.trip.plan.stops[0].chapterId).toBe(chapter.id)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1)
  await page.screenshot({path:testInfo.outputPath('today-mobile.png'),fullPage:true})
  await page.getByRole('button',{name:'Lire le chapitre'}).click()
  await expect(page).toHaveURL(/#journey\/today\//)
  await expect(page.getByText(/Puis une promenade/).first()).toBeVisible()
  await page.goto('/')
  await page.getByRole('link',{name:'Aujourd’hui',exact:true}).click()
  await expect(page).toHaveURL(/#today\/today/)
})

test('un échec de liaison conserve les données et le brouillon puis permet de réessayer',async({page})=>{
  await seed(page)
  await page.getByLabel('Quelques mots').fill('À ne pas perdre')
  await page.evaluate(()=>{
    const original=Storage.prototype.setItem
    Storage.prototype.setItem=function(key,value){if(key==='un-soir-la-bas-upcoming-v1')throw new DOMException('Quota','QuotaExceededError');return original.call(this,key,value)}
  })
  await page.getByRole('button',{name:'Garder ce souvenir'}).click()
  await expect(page.getByRole('alert')).toBeVisible()
  expect(await page.evaluate(()=>localStorage.getItem('un-soir-la-bas-journals-v1'))).toBeNull()
  await expect(page.getByLabel('Quelques mots')).toHaveValue('À ne pas perdre')
  await page.reload()
  await expect(page.getByLabel('Quelques mots')).toHaveValue('À ne pas perdre')
  await page.getByRole('button',{name:'Garder ce souvenir'}).click()
  await expect(page.getByRole('status')).toContainText('Souvenir enregistré')
})

test('journée sans étape et voyage inconnu restent explicites',async({page})=>{
  await seed(page)
  await page.getByLabel('Journée affichée').fill('2027-01-01')
  await expect(page.getByText('Aucune étape prévue ce jour.',{exact:false})).toBeVisible()
  await page.getByLabel('Quelques mots').fill('Une journée libre')
  await page.getByRole('button',{name:'Garder ce souvenir'}).click()
  await expect(page.getByRole('status')).toContainText('Souvenir enregistré')
  await page.goto('/#today/absent')
  await expect(page.getByText('Ce voyage est introuvable sur cet appareil.')).toBeVisible()
  await expect(page.getByRole('button',{name:'Garder ce souvenir'})).toHaveCount(0)
})
