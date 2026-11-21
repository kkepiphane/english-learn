import { test, expect, type Page } from '@playwright/test'

async function onboard(page: Page) {
  await page.goto('./')
  await expect(page.getByText('Welcome to English Path')).toBeVisible()
  await page.getByPlaceholder('e.g. Epiphane').fill('Tester')
  await page.getByRole('button', { name: /Start the level test/ }).click()
  await page.getByRole('link', { name: /Skip for now/ }).click()
  await expect(page.getByText('What should I learn today?')).toBeVisible()
}

test('PWA manifest is valid for the GitHub Pages sub-path', async ({ page }) => {
  await page.goto('./')
  const href = await page.locator('link[rel=manifest]').getAttribute('href')
  const m = await (await page.request.get(new URL(href!, page.url()).toString())).json()
  expect(m.start_url).toBe('/english-path/')
  expect(m.display).toBe('standalone')
  expect(m.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true)
})

test('works offline after first load: lesson, quiz, writing feedback, progress saved', async ({ page, context }) => {
  await onboard(page)
  // Wait until the service worker controls the page (precache complete).
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByText('Offline', { exact: true }).last()).toBeVisible()

  // A lesson loads from the precache and its quiz is graded.
  await page.goto('./#/learn/lesson/a2-g-articles')
  await expect(page.getByText('Objective')).toBeVisible()
  await page.getByRole('button', { name: 'Practice →' }).click()
  await page.locator('fieldset button').nth(3).click()
  await page.getByRole('button', { name: 'Check' }).click()
  await expect(page.getByText('✓ Correct!')).toBeVisible()

  // Offline writing feedback explains errors.
  await page.goto('./#/practice/writing/w-a2-routine')
  await page.locator('#writing').fill('i am agree. I have 25 years and I live in Lomé since five years. The life is busy and I take my breakfast at 7 every day before work.')
  await page.getByRole('button', { name: 'Get feedback' }).click()
  await expect(page.getByText('Corrections explained')).toBeVisible()
  await expect(page.getByText('I am 25 years old').first()).toBeVisible()
  await expect(page.getByText('AI is not configured')).toBeVisible()

  // Data survives a reload while still offline.
  await page.reload()
  await page.goto('./#/progress')
  await expect(page.getByText('Estimated CEFR level')).toBeVisible()
  await page.goto('./#/practice/writing/w-a2-routine')
  await expect(page.getByText('Your previous submissions')).toBeVisible()
})

test('backup export produces a valid file', async ({ page }) => {
  await onboard(page)
  await page.goto('./#/profile')
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export backup' }).click()])
  const json = JSON.parse(await (await download.createReadStream()).toArray().then((c) => Buffer.concat(c).toString()))
  expect(json.format).toBe('english-path-backup')
  expect(json.data.profile[0].name).toBe('Tester')
})
