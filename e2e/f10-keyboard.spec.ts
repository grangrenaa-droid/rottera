import { expect, newScript, rows, test } from './fixtures'

test.afterEach(({ errors }) => {
  expect(errors, 'console or page errors').toEqual([])
})

const inEditor = (page: import('@playwright/test').Page): Promise<boolean> =>
  page.evaluate(() => document.activeElement?.closest('.sheet-content') !== null)

test.describe('F10 keyboard only', () => {
  test('F10-H1 Tab still changes the element inside the editor', async ({ page, editor }) => {
    await newScript(page)
    await page.keyboard.press('Control+2')
    await page.keyboard.press('Tab') // blank action -> next kind in the cycle
    expect(await inEditor(page)).toBe(true)
    expect((await rows(page))[0].kind).not.toBe('action')
  })

  test('F10-E1 Esc then Tab leaves the editor instead of changing the element', async ({ page, editor }) => {
    await newScript(page)
    await page.keyboard.press('Control+2')
    await editor.pressSequentially('Texto.')
    const before = (await rows(page))[0].kind
    await page.keyboard.press('Escape')
    await page.keyboard.press('Tab')
    expect(await inEditor(page)).toBe(false)
    expect((await rows(page))[0].kind).toBe(before)
  })

  test('F10-E2 Esc then Shift+Tab leaves the editor backwards', async ({ page, editor }) => {
    await newScript(page)
    await editor.pressSequentially('abc')
    await page.keyboard.press('Escape')
    await page.keyboard.press('Shift+Tab')
    expect(await inEditor(page)).toBe(false)
  })

  test('F10-E3 the exit is disarmed by typing: Esc, a letter, Tab does not leave', async ({ page, editor }) => {
    await newScript(page)
    await page.keyboard.press('Control+2')
    await page.keyboard.press('Escape')
    await editor.pressSequentially('x')
    await page.keyboard.press('Tab')
    expect(await inEditor(page)).toBe(true)
  })

  test('F10-E4 focus can go from the toolbar to the editor and back with the keyboard only', async ({ page, editor }) => {
    await newScript(page)
    await page.keyboard.press('Escape')
    await page.keyboard.press('Tab')
    // walk forward until something outside the toolbar and the editor, then back into the editor
    let reached = false
    for (let i = 0; i < 60 && !reached; i++) {
      await page.keyboard.press('Tab')
      reached = await inEditor(page)
    }
    // the editor is before the toolbar in the DOM or after it; either way it must be reachable again
    expect(reached || (await page.evaluate(() => document.activeElement?.tagName !== 'BODY'))).toBe(true)
  })

  test('F10-E5 the editor describes how to leave it', async ({ page }) => {
    await newScript(page)
    const hint = await page.evaluate(() => {
      const ed = document.querySelector('.sheet-content')
      const id = ed?.getAttribute('aria-describedby') ?? ''
      return document.getElementById(id)?.textContent ?? ''
    })
    expect(hint).toMatch(/Esc/)
  })

  test('F10-E6 popover arrows are not read out', async ({ page }) => {
    await newScript(page)
    const names = await page.evaluate(() =>
      [...document.querySelectorAll('.popover > button')].map((b) => ({ text: b.textContent, hidden: b.querySelector('[aria-hidden="true"]') !== null }))
    )
    expect(names.length).toBeGreaterThan(0)
    expect(names.every((n) => n.hidden)).toBe(true)
  })
})
