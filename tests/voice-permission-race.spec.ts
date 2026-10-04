import { expect, test } from '@playwright/test'

async function installDelayedMicrophone(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const releases: Array<(stream: MediaStream) => void> = []
    const state = { stopped: 0, constructed: 0, started: 0, requests: 0 }
    ;(window as unknown as Window & { __mic: typeof state; __releaseMic: (index: number) => void }).__mic = state
    ;(window as unknown as Window & { __releaseMic: (index: number) => void }).__releaseMic = index => releases[index]({
      getTracks: () => [{ stop: () => { state.stopped += 1 } }],
    } as unknown as MediaStream)
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
      getUserMedia: () => { state.requests += 1; return new Promise<MediaStream>(resolve => { releases.push(resolve) }) },
    } })
    class FakeRecorder {
      state = 'inactive'
      ondataavailable: ((event: BlobEvent) => void) | null = null
      onstop: (() => void) | null = null
      constructor() { state.constructed += 1 }
      start() { state.started += 1; this.state = 'recording' }
      stop() { this.state = 'inactive'; this.onstop?.() }
      static isTypeSupported() { return true }
    }
    Object.defineProperty(window, 'MediaRecorder', { configurable: true, value: FakeRecorder })
  })
}

async function seedAndOpenTokyo(page: import('@playwright/test').Page) {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('un-soir-la-bas-upcoming-v1', JSON.stringify([
    { id: 'trip-tokyo', destination: 'Tokyo', departure: '2027-04-12' },
    { id: 'trip-lisbon', destination: 'Lisbonne', departure: '2027-05-03' },
  ])))
  await page.reload()
  const tripNavigation = page.getByRole('navigation', { name: 'Navigation du voyage' })
  if (await tripNavigation.isVisible().catch(() => false)) await page.getByRole('button', { name: 'Mes voyages' }).click()
  const tokyo = page.getByTestId('upcoming-trip').filter({ hasText: 'Tokyo' })
  await tokyo.locator('details.trip-actions-menu > summary').click()
  await tokyo.getByRole('button', { name: /Ouvrir le carnet|Carnet/ }).click()
  await page.getByRole('button', { name: 'Écrire un chapitre pour Tokyo' }).click()
  await page.locator('.evening-ritual').getByRole('button', { name: 'Raconter à voix haute' }).click()
}

test('le dénouement tardif après sortie du rituel libère le flux sans démarrer ni publier un enregistrement', async ({ page }) => {
  await installDelayedMicrophone(page)
  await seedAndOpenTokyo(page)
  const voice = page.getByTestId('voice-narration')
  await voice.getByRole('button', { name: 'Enregistrer ma voix' }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as Window & { __mic: { requests: number } }).__mic.requests)).toBe(1)
  await page.getByRole('navigation', { name: 'Navigation du voyage' }).getByRole('link', { name: 'Carnet', exact: true }).click()
  await page.getByRole('button', { name: 'Mes voyages' }).click()
  const lisbon = page.getByTestId('upcoming-trip').filter({ hasText: 'Lisbonne' })
  await lisbon.locator('details.trip-actions-menu > summary').click()
  await lisbon.getByRole('button', { name: /Ouvrir le carnet|Carnet/ }).click()
  await page.getByRole('button', { name: 'Écrire un chapitre pour Lisbonne' }).click()
  await page.locator('.evening-ritual').getByRole('button', { name: 'Raconter à voix haute' }).click()
  const currentVoice = page.getByTestId('voice-narration')
  await page.evaluate(() => (window as unknown as Window & { __releaseMic: (index: number) => void }).__releaseMic(0))
  await expect.poll(() => page.evaluate(() => (window as unknown as Window & { __mic: { stopped: number } }).__mic.stopped)).toBe(1)
  await expect.poll(() => page.evaluate(() => (window as unknown as Window & { __mic: { started: number } }).__mic.started)).toBe(0)
  await expect.poll(() => page.evaluate(() => (window as unknown as Window & { __mic: { constructed: number } }).__mic.constructed)).toBe(0)
  await expect(currentVoice).toBeVisible()
  await expect(currentVoice.getByRole('button', { name: 'Enregistrer ma voix' })).toBeEnabled()
  await expect(currentVoice.locator('.voice-live')).toBeEmpty()
  expect(await page.evaluate(() => sessionStorage.getItem('un-soir-voice-session:trip-lisbon'))).toBeNull()
  const records = await page.evaluate(() => new Promise<unknown[]>(resolve => {
    const request = indexedDB.open('un-soir-voice-v1', 1)
    request.onsuccess = () => { const db = request.result; const get = db.transaction('sessions').objectStore('sessions').getAll(); get.onsuccess = () => { resolve(get.result); db.close() } }
    request.onerror = () => resolve([])
  }))
  expect(records).toEqual([])
})

test('une demande de démarrage plus récente invalide la précédente permission', async ({ page }) => {
  await installDelayedMicrophone(page)
  await seedAndOpenTokyo(page)
  const voice = page.getByTestId('voice-narration')
  const startButton = voice.getByRole('button', { name: 'Enregistrer ma voix' })
  await startButton.click()
  await expect.poll(() => page.evaluate(() => (window as unknown as Window & { __mic: { requests: number } }).__mic.requests)).toBe(1)
  await startButton.click()
  await expect.poll(() => page.evaluate(() => (window as unknown as Window & { __mic: { requests: number } }).__mic.requests)).toBe(2)
  await page.evaluate(() => (window as unknown as Window & { __releaseMic: (index: number) => void }).__releaseMic(0))
  await expect.poll(() => page.evaluate(() => (window as unknown as Window & { __mic: { stopped: number } }).__mic.stopped)).toBe(1)
  await expect.poll(() => page.evaluate(() => (window as unknown as Window & { __mic: { started: number } }).__mic.started)).toBe(0)
  await expect.poll(() => page.evaluate(() => (window as unknown as Window & { __mic: { constructed: number } }).__mic.constructed)).toBe(0)
  await page.evaluate(() => (window as unknown as Window & { __releaseMic: (index: number) => void }).__releaseMic(1))
  await expect.poll(() => page.evaluate(() => (window as unknown as Window & { __mic: { started: number } }).__mic.started)).toBe(1)
  await expect(voice.getByRole('button', { name: 'Mettre en pause' })).toBeVisible()
  await voice.getByRole('button', { name: 'Arrêter' }).click()
  await expect(voice.getByText(/Aucun fragment audio/)).toBeVisible()
})
