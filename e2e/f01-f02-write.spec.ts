import { expect, menu, newScript, rows, test } from './fixtures'

test.afterEach(({ errors }) => {
  expect(errors, 'console or page errors').toEqual([])
})

test.describe('F01 drafting a scene', () => {
  test('F01-H1 heading, Tab to location and time, Enter to action', async ({ page, editor }) => {
    await newScript(page)
    await editor.pressSequentially('int')
    await page.keyboard.press('Tab')
    await editor.pressSequentially('cozinha')
    await page.keyboard.press('Tab')
    await editor.pressSequentially('dia')
    await page.keyboard.press('Enter')
    await editor.pressSequentially('Ela entra.')
    const r = await rows(page)
    expect(r.map((x) => x.kind)).toEqual(['scene_heading', 'action'])
    expect(r[0].text).toBe('INT. cozinha - dia')
    expect(r[1].text).toBe('Ela entra.')
  })

  test('F01-E1 accents and emoji are kept', async ({ page, editor }) => {
    await newScript(page)
    await page.keyboard.press('Control+2')
    const text = 'Ação com acentuação, ç ñ ü e emoji 😀 ✔ — “aspas”.'
    await editor.pressSequentially(text)
    const r = await rows(page)
    expect(r[0].text).toBe(text)
  })

  test('F01-E2 a very long word stays inside the page', async ({ page, editor }) => {
    await newScript(page)
    await page.keyboard.press('Control+2')
    await page.keyboard.insertText('x'.repeat(600))
    const overflow = await page.evaluate(() => {
      const p = document.querySelector('.sheet-content > p') as HTMLElement
      return p.scrollWidth - p.clientWidth
    })
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test('F01-E3 pasting several lines keeps every line', async ({ app, page, editor }) => {
    await newScript(page)
    await app.evaluate(({ clipboard }) => clipboard.writeText('Primeira linha.\nSegunda linha.\n\nTerceira linha depois de uma vazia.'))
    await page.keyboard.press('Control+V')
    const joined = (await rows(page)).map((r) => r.text).join('|')
    expect(joined).toContain('Primeira linha.')
    expect(joined).toContain('Segunda linha.')
    expect(joined).toContain('Terceira linha depois de uma vazia.')
  })

  test('F01-E4 select all, delete, type again, undo restores', async ({ page, editor }) => {
    await newScript(page)
    await page.keyboard.press('Control+2')
    await editor.pressSequentially('Texto que vai embora.')
    await page.waitForTimeout(700) // history groups edits made within 500 ms
    await page.keyboard.press('Control+A')
    await page.keyboard.press('Delete')
    let r = await rows(page)
    expect(r).toHaveLength(1)
    expect(r[0].text).toBe('')
    await page.waitForTimeout(700)
    await editor.pressSequentially('Novo.')
    expect((await rows(page))[0].text).toBe('Novo.')
    await page.keyboard.press('Control+Z')
    await page.keyboard.press('Control+Z')
    r = await rows(page)
    expect(r.map((x) => x.text).join('')).toContain('Texto que vai embora.')
  })

  test('F01-E5 Enter on a blank dialogue line returns to action', async ({ page, editor }) => {
    await newScript(page)
    await page.keyboard.press('Control+5')
    await page.keyboard.press('Enter')
    const r = await rows(page)
    expect(r[0].kind).toBe('action')
  })

  test('F01-E6 Tab in the middle of text does not change or lose text', async ({ page, editor }) => {
    await newScript(page)
    await page.keyboard.press('Control+2')
    await editor.pressSequentially('Meio do texto')
    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('Tab')
    const r = await rows(page)
    expect(r).toHaveLength(1)
    expect(r[0].text).toBe('Meio do texto')
  })

  test('F01-E7 an action line that looks like a heading becomes one on Enter', async ({ page, editor }) => {
    await newScript(page)
    await page.keyboard.press('Control+2')
    await editor.pressSequentially('EXT. RUA - NOITE')
    await page.keyboard.press('Enter')
    const r = await rows(page)
    expect(r[0].kind).toBe('scene_heading')
    expect(r[1].kind).toBe('action')
  })
})

test.describe('F02 dialogue and dual dialogue', () => {
  test('F02-H1 character, parenthetical, dialogue, back to action', async ({ page, editor }) => {
    await newScript(page)
    await page.keyboard.press('Control+3')
    await editor.pressSequentially('marina')
    await page.keyboard.press('Tab') // parenthetical
    await editor.pressSequentially('(baixo)')
    await page.keyboard.press('Enter') // dialogue
    await editor.pressSequentially('Você veio.')
    await page.keyboard.press('Enter') // action
    await editor.pressSequentially('Ela sorri.')
    const r = await rows(page)
    expect(r.map((x) => x.kind)).toEqual(['character', 'parenthetical', 'dialogue', 'action'])
  })

  test('F02-E1 dual dialogue needs a speech right before it', async ({ page, editor }) => {
    await newScript(page)
    await page.keyboard.press('Control+3')
    await editor.pressSequentially('ANA')
    await page.keyboard.press('Enter')
    await editor.pressSequentially('Oi.')
    await page.keyboard.press('Control+D')
    expect((await rows(page)).some((r) => r.dual)).toBe(false)
  })

  test('F02-E2 dual dialogue turns on and off', async ({ page, editor }) => {
    await newScript(page)
    await page.keyboard.press('Control+3')
    await editor.pressSequentially('ANA')
    await page.keyboard.press('Enter')
    await editor.pressSequentially('Oi.')
    await page.keyboard.press('Tab') // new character
    await editor.pressSequentially('BIA')
    await page.keyboard.press('Enter')
    await editor.pressSequentially('Olá.')
    await page.keyboard.press('Control+D')
    expect((await rows(page)).filter((r) => r.dual).map((r) => r.kind)).toEqual(['character', 'dialogue'])
    await page.keyboard.press('Control+D')
    expect((await rows(page)).some((r) => r.dual)).toBe(false)
  })

  test('F02-E3 deleting a character cue leaves the dialogue editable', async ({ page, editor }) => {
    await newScript(page)
    await page.keyboard.press('Control+3')
    await editor.pressSequentially('ANA')
    await page.keyboard.press('Enter')
    await editor.pressSequentially('Fala solta.')
    await page.keyboard.press('ArrowUp')
    await page.keyboard.press('Home')
    await page.keyboard.press('Shift+End')
    await page.keyboard.press('Backspace')
    await editor.pressSequentially('Continua.')
    const r = await rows(page)
    expect(r.map((x) => x.text).join('|')).toContain('Fala solta.')
    expect(r[0].text).toBe('Continua.')
  })

  test('F02-E4 SmartType suggests a character already used', async ({ page, editor }) => {
    await newScript(page)
    await page.keyboard.press('Control+3')
    await editor.pressSequentially('MARINA')
    await page.keyboard.press('Enter')
    await editor.pressSequentially('Oi.')
    await page.keyboard.press('Enter') // action
    await page.keyboard.press('Control+3')
    await editor.pressSequentially('mar')
    await expect(page.getByRole('listbox', { name: 'Sugestões' })).toContainText('MARINA')
    await page.keyboard.press('Tab')
    const r = await rows(page)
    expect(r[r.length - 1].text).toBe('MARINA')
  })

  test('F02-E5 SmartType popup closes with Escape and does not swallow Enter afterwards', async ({ page, editor }) => {
    await newScript(page)
    await page.keyboard.press('Control+3')
    await editor.pressSequentially('MARINA')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Control+3')
    await editor.pressSequentially('mar')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('listbox', { name: 'Sugestões' })).toHaveCount(0)
    await page.keyboard.press('Enter')
    const r = await rows(page)
    expect(r[r.length - 1].kind).toBe('dialogue')
    expect(r[r.length - 2].text).toBe('mar')
  })
})

test.describe('menu shortcuts reach the editor', () => {
  test('F01-E8 the element dropdown follows the caret', async ({ app, page, editor }) => {
    await newScript(page)
    await page.keyboard.press('Control+4')
    await expect(page.getByLabel('Elemento')).toHaveValue('parenthetical')
    await menu(app, 'toggle-navigator')
    await expect(page.getByRole('complementary', { name: 'Navegador de cenas' })).toHaveCount(0)
  })
})
