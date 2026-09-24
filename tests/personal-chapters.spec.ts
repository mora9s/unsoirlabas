/// <reference types="node" />
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const title = 'Le matin des voiles'
const story = 'Un café sur le pont, puis le vent dans les voiles.\n\nNous gardons le souvenir de ces rires.'
const key = 'philippines-trip'
const fixture = { id: 'notre-page', title, story, memories: 'Café, vent et rires.', tone: 'Spontané', media: [], coverId: '', status: 'draft' }
const consoleErrors = new WeakMap<Page, string[]>()

async function fits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
}

async function seed(page: Page, raw: string) {
  await page.goto('/')
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key, raw })
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  consoleErrors.set(page, errors)
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()) })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

test.afterEach(async ({ page }) => {
  expect(consoleErrors.get(page)).toEqual([])
})

test('sans randomUUID : créer, importer, lire, recharger, modifier et partager', async ({ page }, testInfo) => {
  test.setTimeout(60_000)
  await page.addInitScript(() => {
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true })
    const pending = new Set<string>()
    Object.assign(window, { pendingObjectURLs: pending })
    const create = URL.createObjectURL.bind(URL)
    const revoke = URL.revokeObjectURL.bind(URL)
    URL.createObjectURL = value => { const url = create(value); pending.add(url); return url }
    URL.revokeObjectURL = url => { pending.delete(url); revoke(url) }
  })
  await page.goto('/#create')
  await expect(page.getByTestId('creator')).toBeVisible()
  await page.getByLabel('Importer des photos').setInputFiles(['public/assets/el-nido-big-lagoon.jpg', 'public/assets/el-nido-bay.jpg'])
  const items = page.getByTestId('media-item')
  await expect(items).toHaveCount(2)
  expect(await page.evaluate(() => (window as unknown as { pendingObjectURLs: Set<string> }).pendingObjectURLs.size)).toBe(0)
  await items.nth(1).getByRole('button', { name: 'Choisir en couverture' }).click()
  await page.getByLabel('Le titre de votre journée').fill(title)
  await page.getByLabel('Souvenirs de la journée').fill(fixture.memories)
  await page.getByLabel('Spontané', { exact: true }).check()
  await page.getByLabel('Votre récit, à votre façon').fill(story)
  await page.getByRole('button', { name: 'Prévisualiser', exact: true }).click()
  await page.getByRole('button', { name: 'Ajouter au voyage' }).click()
  await expect(page).toHaveURL(/#draft\/[^/]+$/)
  const chapterURL = page.url()
  const chapter = page.getByTestId('custom-chapter')
  await expect(chapter.getByRole('heading', { name: title, exact: true })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('ajoutée au voyage')
  await expect(chapter.getByText('Brouillon personnel', { exact: true })).toBeVisible()
  await expect(chapter.locator('.prose p')).toHaveText(story.split('\n\n'))
  await expect(chapter.getByText('Ton choisi : Spontané')).toBeVisible()
  await expect(chapter.getByText('2 photos', { exact: true })).toBeVisible()
  await expect(chapter.locator('img')).toHaveCount(2)
  const trip = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key)
  expect(new Set([trip.drafts[0].id, ...trip.drafts[0].media.map((item: { id: string }) => item.id)]).size).toBe(3)
  const cover = trip.drafts[0].media[1].src
  await expect(chapter.locator('.chapter-cover img')).toHaveAttribute('src', cover)
  const chapterPhotos = chapter.locator('.chapter-cover img, .photo-mosaic img')
  await expect.poll(() => chapterPhotos.evaluateAll(images => images.every(image => (image as HTMLImageElement).naturalWidth > 0))).toBe(true)
  const ratios = await chapterPhotos.evaluateAll(images => images.map(image => {
    const photo = image as HTMLImageElement
    const box = photo.getBoundingClientRect()
    return { natural: photo.naturalWidth / photo.naturalHeight, rendered: box.width / box.height }
  }))
  for (const ratio of ratios) expect(Math.abs(ratio.natural - ratio.rendered)).toBeLessThan(0.02)
  await fits(page)
  await page.reload()
  await expect(chapter.getByRole('heading', { name: title, exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Retour au carnet', exact: true }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: `Modifier ${title}`, exact: true })).toBeVisible()
  await fits(page)
  await page.getByRole('button', { name: `Lire ${title}`, exact: true }).click()
  await expect(page).toHaveURL(chapterURL)
  await page.getByRole('button', { name: 'Modifier cette journée' }).click()
  await expect(page.getByLabel('Le titre de votre journée')).toHaveValue(title)
  await expect(page.getByLabel('Souvenirs de la journée')).toHaveValue(fixture.memories)
  await expect(page.getByLabel('Votre récit, à votre façon')).toHaveValue(story)
  await expect(page.getByLabel('Spontané', { exact: true })).toBeChecked()
  await fits(page)
  await expect(items).toHaveCount(2)
  await expect(items.nth(1).getByRole('button', { name: 'Couverture', exact: true })).toHaveAttribute('aria-pressed', 'true')
  const revised = `${title}, ensemble`
  await page.getByLabel('Le titre de votre journée').fill(revised)
  await page.getByRole('button', { name: 'Prévisualiser', exact: true }).click()
  await page.getByRole('button', { name: 'Ajouter au voyage' }).click()
  await expect(page).toHaveURL(chapterURL)
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).drafts.length, key)).toBe(1)
  await page.getByRole('button', { name: 'Préparer le partage', exact: true }).click()
  await expect(page).toHaveURL(/#share\/[^/]+$/)
  await page.reload()
  const studio = page.getByTestId('share-studio')
  for (const format of ['story', 'post']) {
    const preview = studio.getByTestId(`${format}-preview`)
    await expect(preview).toContainText(revised)
    await expect(preview).toContainText('Un café sur le pont')
    await expect(preview.locator('img')).toHaveAttribute('src', cover)
  }
  await expect(page.getByLabel('La légende proposée')).toHaveValue(`${revised}\n\n${story.replace(/\s+/g, ' ')}`)
  await fits(page)
  await page.screenshot({ path: testInfo.outputPath('personal-share-390.png'), fullPage: true })
  // Observe actual canvas calls, not just the HTML preview or a PNG signature.
  await page.evaluate(() => {
    const calls = { texts: [] as string[], images: [] as string[] }
    Object.assign(window, { exportCalls: calls })
    const fillText = CanvasRenderingContext2D.prototype.fillText
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxWidth) {
      calls.texts.push(text)
      fillText.call(this, text, x, y, maxWidth)
    }
    const drawImage = CanvasRenderingContext2D.prototype.drawImage
    CanvasRenderingContext2D.prototype.drawImage = function (image: CanvasImageSource, ...coordinates: number[]) {
      if (image instanceof HTMLImageElement) calls.images.push(image.src)
      return Reflect.apply(drawImage, this, [image, ...coordinates])
    }
  })
  for (const format of ['story', 'post'] as const) {
    await page.getByRole('button', { name: format === 'story' ? 'Story 9:16' : 'Publication / carrousel 4:5', exact: true }).click()
    const pending = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Télécharger', exact: true }).click()
    const download = await pending
    expect(download.suggestedFilename()).toMatch(new RegExp(`^[a-z0-9-]+-${format}\\.png$`))
    const path = testInfo.outputPath(`personal-${format}.png`)
    await download.saveAs(path)
    const png = await readFile(path)
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
    expect(png.readUInt32BE(16)).toBe(1080)
    expect(png.readUInt32BE(20)).toBe(format === 'story' ? 1920 : 1350)
    const dimensions = await page.evaluate(src => new Promise<number[]>((resolve, reject) => {
      const image = new Image()
      const timer = window.setTimeout(() => reject(new Error('PNG decode timeout')), 5000)
      image.onload = () => { clearTimeout(timer); resolve([image.naturalWidth, image.naturalHeight]) }
      image.onerror = () => { clearTimeout(timer); reject(new Error('PNG invalide')) }
      image.src = src
    }), `data:image/png;base64,${png.toString('base64')}`)
    expect(dimensions).toEqual([1080, format === 'story' ? 1920 : 1350])
  }
  const calls = await page.evaluate(() => (window as unknown as { exportCalls: { texts: string[]; images: string[] } }).exportCalls)
  expect(calls.texts.join(' ')).toContain(revised)
  expect(calls.texts.join(' ')).toContain('Un café sur le pont')
  expect(calls.images).toEqual([cover, cover])
  await page.getByRole('link', { name: 'Retour à cette journée' }).click()
  await expect(page).toHaveURL(chapterURL)
  expect(await page.evaluate(() => (window as unknown as { pendingObjectURLs: Set<string> }).pendingObjectURLs.size)).toBe(0)
  await page.getByRole('button', { name: 'Créer une journée', exact: true }).click()
  await expect(page.getByLabel('Le titre de votre journée')).toHaveValue('Une nouvelle journée aux Philippines')
  await expect(page.getByLabel('Votre récit, à votre façon')).toHaveValue('')
  await page.getByLabel('Le titre de votre journée').fill('Une autre page')
  await page.getByLabel('Votre récit, à votre façon').fill('Une autre histoire, sans remplacer la première.')
  await page.getByRole('button', { name: 'Prévisualiser', exact: true }).click()
  await page.getByRole('button', { name: 'Ajouter au voyage' }).click()
  await expect(page).toHaveURL(/#draft\//)
  await expect(page).not.toHaveURL(chapterURL)
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).drafts, key)
  expect(saved).toHaveLength(2)
  expect(saved.map((draft: { title: string }) => draft.title)).toEqual([revised, 'Une autre page'])
})

test('sans crypto : import et identifiants distincts restent disponibles', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'crypto', { value: undefined, configurable: true }))
  await page.goto('/#create')
  await page.getByLabel('Importer des photos').setInputFiles(['public/assets/el-nido-bay.jpg', 'public/assets/el-nido-bay.jpg'])
  await expect(page.getByTestId('media-item')).toHaveCount(2)
  await page.getByLabel('Votre récit, à votre façon').fill(story)
  await page.getByRole('button', { name: 'Prévisualiser', exact: true }).click()
  await page.getByRole('button', { name: 'Ajouter au voyage' }).click()
  await expect(page).toHaveURL(/#draft\//)
  const ids = await page.evaluate(key => {
    const draft = JSON.parse(localStorage.getItem(key)!).drafts[0]
    return [draft.id, ...draft.media.map((item: { id: string }) => item.id)]
  }, key)
  expect(new Set(ids).size).toBe(3)
})

test('chapitre sans photo, titre long et partage sans lieu inventé', async ({ page }) => {
  const longTitle = 'Unejournée'.repeat(12)
  await seed(page, JSON.stringify({ version: 1, drafts: [{ ...fixture, title: longTitle }] }))
  await page.goto('/#draft/notre-page')
  await expect(page.getByRole('heading', { name: longTitle })).toBeVisible()
  await expect(page.getByTestId('custom-chapter').locator('img')).toHaveCount(0)
  await expect(page.getByText('0 photo', { exact: true })).toBeVisible()
  await fits(page)
  await page.getByRole('button', { name: 'Préparer le partage' }).click()
  await expect(page.getByTestId('share-studio')).not.toContainText('El Nido')
  await expect(page.getByTestId('share-studio').locator('img')).toHaveCount(0)
  await fits(page)
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Télécharger', exact: true }).click()
  expect((await pending).suggestedFilename()).toMatch(/^[a-z0-9-]+-story\.png$/)
})

for (const route of ['draft/inconnu', 'share/inconnu', 'draft/%E0%A4%A', 'draft/', 'inconnu']) {
  test(`récupération explicite : ${route}`, async ({ page }) => {
    await page.goto(`/#${route}`)
    await expect(page.getByRole('heading', { name: 'Cette page est introuvable' })).toBeVisible()
    await fits(page)
    await page.getByRole('button', { name: 'Retour au carnet', exact: true }).click()
    await expect(page).toHaveURL(/#carnet$/)
  })
}

for (const raw of ['', '{broken', 'null', JSON.stringify({ version: 1, drafts: [null] }), JSON.stringify({ version: 1, drafts: [{ ...fixture, media: [null] }] })]) {
  test(`stockage invalide préservé : ${raw.slice(0, 35)}`, async ({ page }) => {
    await seed(page, raw)
    await page.goto('/#draft/notre-page')
    await expect(page.getByRole('alert')).toContainText('Vos données n’ont pas été modifiées')
    await page.getByRole('button', { name: 'Créer une journée', exact: true }).click()
    await page.getByLabel('Votre récit, à votre façon').fill(story)
    await page.getByRole('button', { name: 'Prévisualiser', exact: true }).click()
    await page.getByRole('button', { name: 'Ajouter au voyage' }).click()
    await expect(page).toHaveURL(/#create$/)
    expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(raw)
  })
}
