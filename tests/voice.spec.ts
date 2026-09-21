import { expect, test } from '@playwright/test'

test('le récit du soir reste replié puis importe, révise et exige une acceptation', async ({ page }) => {
  let job = ''
  let draftTranscriptVersion = 0
  let draftSegmentText = ''
  await page.route('**/api/voice/**', async route => {
    const request = route.request()
    const url = request.url()
    if (request.method() === 'PUT') return route.fulfill({ json: { status: 'server-received' } })
    if (url.endsWith('/transcriptions')) { job = 'transcription'; return route.fulfill({ status: 202, json: { jobId: job } }) }
    if (url.endsWith('/drafts')) { job = 'draft'; const body = request.postDataJSON(); draftTranscriptVersion = body.transcriptVersion; draftSegmentText = body.segments[0].text; return route.fulfill({ status: 202, json: { jobId: job } }) }
    if (url.includes('/jobs/')) return route.fulfill({ json: job === 'transcription' ? { status: 'completed', result: { segments: [{ id: 'segment-1', start: 0, end: 4, text: 'le marché était calme' }], language: 'fr' } } : { status: 'completed', result: { title: 'Le marché calme', paragraphs: [{ text: 'Le marché était calme puis nous avons mangé des mangues.', supportingSegmentIds: ['segment-1'] }], uncertainty: ['Le lieu exact reste à confirmer.'] } } })
    return route.fulfill({ json: {} })
  })
  await page.goto('/#create')
  await expect(page.getByTestId('voice-narration')).toHaveCount(0)
  await page.getByRole('button', { name: 'Commencer le récit du soir' }).click()
  const voice = page.getByTestId('voice-narration')
  await voice.getByLabel('Importer un enregistrement audio').setInputFiles({ name: 'soir.webm', mimeType: 'audio/webm', buffer: Buffer.from('voice') })
  await expect(voice.getByText('Audio conservé sur cet appareil', { exact: true })).toBeVisible()
  await voice.getByRole('button', { name: 'Transcrire en français' }).click()
  await expect(voice.getByLabel('Texte corrigé')).toBeVisible()
  await voice.getByLabel('Texte corrigé').fill('Le marché était calme puis nous avons mangé des mangues.')
  await voice.getByRole('button', { name: 'Écrire une proposition avec l’IA' }).click()
  await expect(voice.getByLabel('Titre proposé')).toBeVisible()
  expect(draftTranscriptVersion).toBeGreaterThanOrEqual(1)
  expect(draftSegmentText).toBe('Le marché était calme puis nous avons mangé des mangues.')
  await expect(voice.getByText('Preuves :')).toBeVisible()
  await voice.getByLabel('Paragraphe proposé 1').fill('Version relue et corrigée du récit.')
  await voice.getByRole('button', { name: 'Utiliser ce récit' }).click()
  await expect(page.getByLabel('Souvenirs de la journée')).toHaveValue(/marché était calme/)
  await expect(page.getByLabel('Votre récit, à votre façon')).toHaveValue('Version relue et corrigée du récit.')
  await expect(page.evaluate(() => localStorage.getItem('philippines-trip'))).resolves.toBeNull()
})

test('le récit du soir indique une erreur de micro sans empêcher l’import', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: () => Promise.reject(new DOMException('denied', 'NotAllowedError')) } }) })
  await page.goto('/#create')
  await page.getByRole('button', { name: 'Commencer le récit du soir' }).click()
  const voice = page.getByTestId('voice-narration')
  await voice.getByRole('button', { name: 'Enregistrer ma voix' }).click()
  await expect(voice.getByText(/autorisation du microphone/i)).toBeVisible()
  await expect(voice.getByLabel('Importer un enregistrement audio')).toBeEnabled()
})

test('la surface repliée ne crée pas de second statut ni champ fichier', async ({ page }) => {
  await page.goto('/#create')
  await expect(page.getByRole('status')).toHaveCount(1)
  await expect(page.getByLabel('Importer un enregistrement audio')).toHaveCount(0)
})
