import { expect, test } from '@playwright/test'

function futureDate() {
  const date = new Date()
  date.setDate(date.getDate() + 12)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

test('prepare-trip form opens accessibly and returns focus after cancel, save, and Escape', async ({ page }) => {
  await page.goto('/')
  const opener = page.getByRole('button', { name: 'Préparer un voyage' })
  await opener.focus()
  await page.keyboard.press('Enter')
  const form = page.getByRole('dialog', { name: 'Faire place à l’attente' })
  const destination = page.getByLabel('Destination')
  await expect(destination).toBeFocused()
  await expect(page.getByRole('status')).toContainText('Formulaire de préparation ouvert.')
  await page.keyboard.press('Escape')
  await expect(form).toHaveCount(0)
  await expect(opener).toBeFocused()

  await opener.click()
  await destination.fill('Kyoto')
  await page.getByLabel('Date de départ').fill(futureDate())
  await page.getByRole('button', { name: 'Ajouter au décompte' }).click()
  await expect(page.getByRole('status')).toContainText('Kyoto a été ajouté au décompte.')
  await expect(opener).toBeFocused()

  const edit = page.getByRole('button', { name: 'Modifier Kyoto' })
  await edit.click()
  await expect(page.getByLabel('Destination')).toBeFocused()
  await page.getByRole('button', { name: 'Annuler' }).click()
  await expect(edit).toBeFocused()
  await expect(page.getByRole('status')).toContainText('Modifications annulées.')
})

test('countdown labels, controls and logo remain legible and tappable at supported widths', async ({ page }) => {
  await page.addInitScript(departure => {
    localStorage.setItem('un-soir-la-bas-upcoming-v1', JSON.stringify([{ id: 'geometry-trip', destination: 'Kyoto', departure }]))
  }, futureDate())
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    const geometry = await page.evaluate(() => {
      const logo = document.querySelector<HTMLButtonElement>('.wordmark')!
      const smallText = [...document.querySelectorAll<HTMLElement>('.upcoming-trips .upcoming-date, .upcoming-trips .upcoming-big-number > span, .upcoming-trips .upcoming-trip-copy p, .upcoming-trips .upcoming-actions button, .upcoming-trips .next-actions button, .upcoming-trips > .local-note')]
      const targets = [...document.querySelectorAll<HTMLElement>('.upcoming-heading button, .upcoming-actions button, .next-actions button')].map(element => {
        const target = element.getBoundingClientRect()
        return { width: target.width, height: target.height }
      })
      const rect = logo.getBoundingClientRect()
      return {
        logo: { width: rect.width, height: rect.height },
        targets,
        sizes: smallText.map(element => Number.parseFloat(getComputedStyle(element).fontSize)),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }
    })
    expect(geometry.logo.width).toBeGreaterThanOrEqual(44)
    expect(geometry.logo.height).toBeGreaterThanOrEqual(44)
    expect(geometry.targets.every(target => target.width >= 44 && target.height >= 44), JSON.stringify(geometry.targets)).toBe(true)
    expect(geometry.sizes.length).toBeGreaterThanOrEqual(7)
    expect(geometry.sizes.every(size => size >= 14), JSON.stringify(geometry.sizes)).toBe(true)
    expect(geometry.overflow).toBeLessThanOrEqual(1)
    await page.screenshot({ path: `test-results/countdown-${width}.png`, fullPage: true })
  }
})

test('reduced motion preference suppresses countdown motion and preserves keyboard operation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const motion = await page.locator('.upcoming-trips').evaluate(element => {
    const style = getComputedStyle(element)
    return { transition: style.transitionDuration, animation: style.animationDuration }
  })
  expect(motion.transition.split(',').every(value => Number.parseFloat(value) === 0)).toBe(true)
  expect(motion.animation.split(',').every(value => Number.parseFloat(value) === 0)).toBe(true)
  const opener = page.getByRole('button', { name: 'Préparer un voyage' })
  await opener.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByLabel('Destination')).toBeFocused()
})
