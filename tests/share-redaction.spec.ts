import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { unzipSync } from 'fflate'

const trips = [{ id: 'trip-share', destination: 'Lyon', departure: '2027-06-14' }]
const story = 'Stéphane garde un texte intime que je peux modifier avant le partage. '.repeat(30)

test('le partage multipage exporte seulement les photos et les champs visibles après revue explicite', async ({ page }, testInfo) => {
  const consoleErrors: string[] = []
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()) })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.evaluate(trips => localStorage.setItem('un-soir-la-bas-upcoming-v1', JSON.stringify(trips)), trips)
  await page.reload()
  await page.getByTestId('upcoming-trip').getByRole('button', { name: /^(?:Ouvrir le carnet|Carnet)$/ }).click()
  await page.getByRole('button', { name: /Écrire un chapitre pour Lyon/ }).click()
  await page.getByRole('button', { name: 'Ouvrir l’atelier complet' }).click()
  await page.getByLabel('Le titre de votre journée').fill('Deux photos à Lyon')
  await page.getByLabel('Souvenirs de la journée').fill('La terrasse et le café.')
  await page.getByLabel('Votre récit, à votre façon').fill(story)
  const importer = page.locator('[aria-label="Importer des photos"]:visible').first()
  await importer.setInputFiles(['public/assets/el-nido-bay.jpg', 'public/assets/el-nido-lagoon.jpg'])
  await page.getByRole('button', { name: 'Prévisualiser', exact: true }).click()
  await page.getByRole('button', { name: 'Ajouter au voyage' }).click()
  const selectedCover = await page.getByTestId('custom-chapter').locator('.chapter-cover img').getAttribute('src')
  const excludedAlbumPhoto = await page.getByTestId('custom-chapter').locator('.album img').getAttribute('src')
  await page.getByRole('button', { name: 'Préparer le partage' }).click()
  const studio = page.getByTestId('share-studio')
  await expect(studio.getByRole('heading', { name: /sort du carnet/i })).toBeVisible()
  await expect(studio.getByTestId('story-preview').first()).toBeVisible()

  // Redact individually and opt one real chapter photo out; original chapter is immutable.
  await page.getByRole('checkbox', { name: /date/i }).uncheck()
  await page.getByRole('checkbox', { name: /lieu/i }).uncheck()
  await page.getByLabel('Titre retouchable').fill('Deux photos')
  const redactedStory = story.replaceAll('Stéphane', 'un ami')
  await page.getByLabel('Texte à partager').fill(redactedStory)
  await expect(page.getByTestId('share-review').locator('img').first()).toHaveAttribute('src', /^blob:/)
  await expect(page.getByLabel('Titre retouchable')).toHaveValue('Deux photos')
  await expect(page.getByRole('checkbox', { name: /Inclure la date/ })).not.toBeChecked()
  await expect(page.getByRole('checkbox', { name: /Inclure le lieu/ })).not.toBeChecked()
  await page.getByRole('button', { name: /Publication \/ carrousel/ }).click()
  await page.getByRole('checkbox', { name: /J’ai relu cet aperçu/ }).check()

  const calls = await page.evaluate(() => {
    const found = { texts: [] as string[], images: [] as string[], imageCount: 0, dimensions: [] as number[][] }
    Object.assign(window, { exportAudit: found })
    const fillText = CanvasRenderingContext2D.prototype.fillText
    CanvasRenderingContext2D.prototype.fillText = function (text, ...args) { found.texts.push(String(text)); fillText.call(this, text, ...args) }
    const drawImage = CanvasRenderingContext2D.prototype.drawImage
    CanvasRenderingContext2D.prototype.drawImage = function (image: CanvasImageSource, ...args: number[]) {
      found.imageCount++
      if (image instanceof HTMLImageElement) found.images.push(image.src)
      return Reflect.apply(drawImage, this, [image, ...args])
    }
    return true
  })
  expect(calls).toBe(true)
  await page.evaluate(() => { const audit = (window as unknown as { exportAudit: { texts: string[]; images: string[]; imageCount: number } }).exportAudit; audit.texts.length = 0; audit.images.length = 0; audit.imageCount = 0 })
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Créer le carrousel ZIP' }).click()
  const download = await pending
  const zipPath = testInfo.outputPath('redacted-carousel.zip')
  await download.saveAs(zipPath)
  const entries = unzipSync(await readFile(zipPath))
  const reviewedText = `Deux photos\n\n${redactedStory}`
  expect(Object.keys(entries).length).toBeGreaterThanOrEqual(2)
  for (const key of Object.keys(entries)) {
    const bytes = Buffer.from(entries[key]!)
    expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
    expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([1080, 1350])
    const size = await page.evaluate(dataUrl => new Promise<number[]>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve([image.naturalWidth, image.naturalHeight])
      image.onerror = () => reject(new Error('PNG du carrousel illisible'))
      image.src = dataUrl
    }), `data:image/png;base64,${bytes.toString('base64')}`)
    expect(size).toEqual([1080, 1350])
  }
  const png = Buffer.from(entries['souvenir-01.png']!)
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  expect(png.readUInt32BE(16)).toBe(1080)
  expect(png.readUInt32BE(20)).toBe(1350)
  const decoded = await page.evaluate(dataUrl => new Promise<number[]>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve([image.naturalWidth, image.naturalHeight])
    image.onerror = () => reject(new Error('PNG invalide'))
    image.src = dataUrl
  }), `data:image/png;base64,${Buffer.from(png).toString('base64')}`)
  expect(decoded).toEqual([1080, 1350])
  const audit = await page.evaluate(() => (window as unknown as { exportAudit: { texts: string[]; images: string[]; imageCount: number } }).exportAudit)
  expect(audit.texts.join(' ')).toContain(redactedStory.slice(0, 70))
  expect(audit.texts.join(' ')).not.toContain('Lyon')
  expect(audit.texts.join(' ')).not.toContain('2027-06-14')
  expect(audit.texts.join(' ')).not.toContain('Stéphane')
  expect(audit.imageCount).toBe(Object.keys(entries).length)
  const narrative = audit.texts.filter(line => line !== 'UN SOIR LÀ-BAS' && !/^\d{2} \/ \d{2}$/.test(line)).join(' ').replace(/\s+/g, ' ')
  expect(narrative.replace(/\s/g, '')).toContain(redactedStory.replace(/\s/g, ''))
  await page.getByLabel('Photo 2').uncheck()
  await page.getByRole('button', { name: /Story · 9:16/ }).click()
  await expect(page.getByRole('button', { name: 'Télécharger la Story' })).toBeDisabled()
  await page.getByRole('checkbox', { name: /J’ai relu cet aperçu/ }).check()
  const storyPages = Math.ceil(reviewedText.length / 1050)
  await page.evaluate(() => { const audit = (window as unknown as { exportAudit: { texts: string[]; images: string[]; imageCount: number } }).exportAudit; audit.texts.length = 0; audit.images.length = 0; audit.imageCount = 0 })
  const storyDownloadPending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Télécharger la Story' }).click()
  const storyDownload = await storyDownloadPending
  const storyPath = testInfo.outputPath(storyDownload.suggestedFilename())
  await storyDownload.saveAs(storyPath)
  const storyBytes = await readFile(storyPath)
  const storyPagePng = storyPages === 1 ? Buffer.from(storyBytes) : Buffer.from(unzipSync(storyBytes)['souvenir-01.png']!)
  expect(storyPagePng.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  expect(storyPagePng.readUInt32BE(16)).toBe(1080)
  expect(storyPagePng.readUInt32BE(20)).toBe(1920)
  const storyAudit = await page.evaluate(() => (window as unknown as { exportAudit: { texts: string[]; images: string[]; imageCount: number } }).exportAudit)
  expect(storyAudit.imageCount).toBeGreaterThanOrEqual(storyPages)
  expect(storyAudit.images).toContain(selectedCover)
  expect(storyAudit.images).not.toContain(excludedAlbumPhoto)
  expect(storyAudit.texts.join(' ')).not.toContain('Lyon')
  expect(storyAudit.texts.join(' ')).not.toContain('2027-06-14')
  expect(storyAudit.texts.join(' ')).not.toContain('Stéphane')
  await page.getByLabel('Texte à partager').fill('Carte postale vécue, avec une vraie photo.')
  await page.getByRole('button', { name: /Carte postale · 4:5/ }).click()
  await expect(page.getByTestId('story-preview').first().locator('img')).toHaveAttribute('src', /^blob:/)
  await page.getByRole('checkbox', { name: /J’ai relu cet aperçu/ }).check()
  await page.evaluate(() => { const audit = (window as unknown as { exportAudit: { texts: string[]; images: string[]; imageCount: number } }).exportAudit; audit.texts.length = 0; audit.images.length = 0; audit.imageCount = 0 })
  const postcardPending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Télécharger la carte postale' }).click()
  const postcardDownload = await postcardPending
  const postcardPath = testInfo.outputPath('chapter-postcard.png')
  await postcardDownload.saveAs(postcardPath)
  const postcardPng = Buffer.from(await readFile(postcardPath))
  expect(postcardPng.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  expect([postcardPng.readUInt32BE(16), postcardPng.readUInt32BE(20)]).toEqual([1080, 1350])
  const postcardAudit = await page.evaluate(() => (window as unknown as { exportAudit: { texts: string[]; images: string[]; imageCount: number } }).exportAudit)
  expect(postcardAudit.texts.join(' ')).toContain('Carte postale vécue')
  expect(postcardAudit.imageCount).toBe(1)
  expect(postcardAudit.images).toEqual([selectedCover])
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('un-soir-la-bas-journals-v1')!).journals[0].chapters[0].story)).toBe(story.trim())
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('un-soir-la-bas-journals-v1')!).journals[0].chapters[0].media)).toHaveLength(2)
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
    await page.screenshot({ path: testInfo.outputPath(`share-redaction-${width}.png`), fullPage: true })
  }
  expect(consoleErrors).toEqual([])
})

test('long tokens keep every character and each exported carousel PNG decodes', async ({ page }, testInfo) => {
  test.setTimeout(90_000)
  await page.goto('/')
  await page.evaluate(trips => localStorage.setItem('un-soir-la-bas-upcoming-v1', JSON.stringify(trips)), trips)
  await page.reload()
  await page.getByTestId('upcoming-trip').getByRole('button', { name: /^(?:Ouvrir le carnet|Carnet)$/ }).click()
  await page.getByRole('button', { name: /Écrire un chapitre pour Lyon/ }).click()
  await page.getByRole('button', { name: 'Ouvrir l’atelier complet' }).click()
  await page.getByLabel('Le titre de votre journée').fill('Texte relu')
  await page.getByLabel('Votre récit, à votre façon').fill('Texte initial valide.')
  await page.getByRole('button', { name: 'Prévisualiser', exact: true }).click()
  await page.getByRole('button', { name: 'Ajouter au voyage' }).click()
  await page.getByRole('button', { name: 'Préparer le partage' }).click()

  const urlToken = `https://exemple.fr/${'ab-cd_'.repeat(350)}`
  const singleToken = '🧭é'.repeat(700)
  const cases = [urlToken, singleToken, `Avant, début.\n\n${urlToken}\n\nAprès — fin 😊`]
  await page.evaluate(() => {
    const calls = { texts: [] as string[] }
    Object.assign(window, { longTokenAudit: calls })
    const fillText = CanvasRenderingContext2D.prototype.fillText
    CanvasRenderingContext2D.prototype.fillText = function (text, ...args) { calls.texts.push(String(text)); fillText.call(this, text, ...args) }
  })
  await page.getByRole('button', { name: /Publication \/ carrousel/ }).click()
  for (const [caseIndex, value] of cases.entries()) {
    await page.getByLabel('Texte à partager').fill(value)
    const studio = page.getByTestId('share-studio')
    const previews = studio.getByTestId('story-preview')
    await expect(previews.first().locator('img')).toHaveAttribute('src', /^blob:/, { timeout: 30_000 })
    await expect(previews).toHaveCount(await studio.getByTestId('share-review').locator('article').count())
    await expect(studio.getByRole('alert')).toHaveCount(0)
    await page.getByRole('checkbox', { name: /J’ai relu cet aperçu/ }).check()
    await page.evaluate(() => { (window as unknown as { longTokenAudit: { texts: string[] } }).longTokenAudit.texts.length = 0 })
    const pending = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Créer le carrousel ZIP' }).click()
    const download = await pending
    const zipPath = testInfo.outputPath(`long-token-${caseIndex}.zip`)
    await download.saveAs(zipPath)
    const entries = unzipSync(await readFile(zipPath))
    expect(Object.keys(entries).length).toBeGreaterThan(0)
    for (const bytes of Object.values(entries)) {
      expect(Buffer.from(bytes).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
      const size = await page.evaluate(dataUrl => new Promise<number[]>((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve([image.naturalWidth, image.naturalHeight])
        image.onerror = () => reject(new Error('PNG du carrousel illisible'))
        image.src = dataUrl
      }), `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`)
      expect(size).toEqual([1080, 1350])
    }
    const textCalls = await page.evaluate(() => (window as unknown as { longTokenAudit: { texts: string[] } }).longTokenAudit.texts)
    const pageText: string[][] = []
    for (const line of textCalls) {
      if (/^\d{2} \/ \d{2}$/.test(line)) pageText.push([])
      else if (pageText.length) pageText[pageText.length - 1]!.push(line)
    }
    expect(pageText).toHaveLength(Object.keys(entries).length)
    expect(pageText.every(lines => lines.join('').trim().length > 0)).toBe(true)
    const narrative = textCalls.filter(line => line !== 'UN SOIR LÀ-BAS' && !/^\d{2} \/ \d{2}$/.test(line)).join('')
    const exactText = value.replace(/\s/g, '')
    expect(narrative.replace(/\s/g, '')).toContain(exactText)
    if (caseIndex === 0) expect(narrative).toContain(urlToken)
    if (caseIndex === 1) expect(narrative).toContain(singleToken)
    await page.getByLabel('Texte à partager').fill('')
    await page.getByLabel('J’ai relu cet aperçu et confirme le contenu exact à exporter.').uncheck()
  }
})