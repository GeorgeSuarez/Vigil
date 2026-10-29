import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/** `<arcgis-map>` builds its view asynchronously and loads layers into it. */
interface MapElement extends Element {
  view?: { ready?: boolean }
}

/** Auditing before the view is ready would measure an empty shell. */
async function waitForMap(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const map = document.querySelector('arcgis-map') as MapElement | null
      return Boolean(map?.view?.ready)
    },
    undefined,
    { timeout: 120_000 },
  )
}

test('the assembled app has no axe violations', async ({ page }) => {
  await page.goto('/')
  await waitForMap(page)
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
})

// The narrow layout is a different DOM, not a narrower one: the legend collapses
// to a toggle whose open state renders `<calcite-sheet>` (the desktop run only
// ever sees the popover), and the controls restack.
test('the narrow layout has no axe violations', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await waitForMap(page)
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
})
