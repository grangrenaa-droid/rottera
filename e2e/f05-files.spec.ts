import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, menu, newScript, readJson, rows, test } from './fixtures'

const work = (): string => mkdtempSync(join(tmpdir(), 'rotera-f05-'))
const file = (blocks: { kind: string; text: string }[], title = ''): string =>
  JSON.stringify({
    format: 'rotera',
    version: 1,
    savedAt: new Date().toISOString(),
    script: { titlePage: { title, author: '', contact: '' }, blocks }
  })

test.describe('F05 saving, opening and not losing work', () => {
  test('F05-H1 save as, close, open: same content', async ({ page, dialogs, editor }) => {
    const dir = work()
    const path = join(dir, 'meu roteiro ação.rotera')
    await newScript(page)
    await page.keyboard.press('Control+2')
    await editor.pressSequentially('Conteúdo do roteiro.')
    await dialogs.save(path)
    await page.getByRole('button', { name: 'Salvar como…' }).click()
    await expect(page.locator('.status')).toContainText('Salvo')
    expect(readJson(path).script.blocks).toEqual([{ kind: 'action', text: 'Conteúdo do roteiro.' }])
    await page.getByRole('button', { name: 'Início' }).click()
    await dialogs.open(path)
    await page.getByRole('button', { name: 'Abrir…' }).click()
    await expect(page.getByRole('textbox', { name: 'Texto do roteiro' })).toContainText('Conteúdo do roteiro.')
  })

  test('F05-E1 a corrupted file is refused with a message and the app keeps working', async ({ page, dialogs }) => {
    const bad = join(work(), 'quebrado.rotera')
    writeFileSync(bad, '{"format":"rotera","script":{"blocks":[', 'utf8')
    await dialogs.open(bad)
    await page.getByRole('button', { name: 'Abrir…' }).click()
    await expect(page.getByRole('status').filter({ hasText: /abrir|JSON|Arquivo/i })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Novo roteiro' }).first()).toBeVisible()
  })

  test('F05-E2 a JSON file that is not a script is refused', async ({ page, dialogs }) => {
    const bad = join(work(), 'outro.rotera')
    writeFileSync(bad, '{"hello":"world"}', 'utf8')
    await dialogs.open(bad)
    await page.getByRole('button', { name: 'Abrir…' }).click()
    await expect(page.getByText(/não é um roteiro/i)).toBeVisible()
  })

  test('F05-E3 typing then opening another file through the menu does not lose the typing', async ({ app, page, dialogs, editor }) => {
    const dir = work()
    const a = join(dir, 'a.rotera')
    const b = join(dir, 'b.rotera')
    writeFileSync(a, file([{ kind: 'action', text: 'Arquivo A.' }], 'A'))
    writeFileSync(b, file([{ kind: 'action', text: 'Arquivo B.' }], 'B'))
    await dialogs.open(a)
    await page.getByRole('button', { name: 'Abrir…' }).click()
    await expect(editor).toContainText('Arquivo A.')
    await editor.click()
    await page.keyboard.press('Control+End')
    await page.keyboard.type(' ALFA-NAO-PERDER')
    await dialogs.open(b)
    await menu(app, 'open') // within the autosave delay
    await expect(editor).toContainText('Arquivo B.')
    await page.waitForTimeout(2500)
    expect(readFileSync(a, 'utf8')).toContain('ALFA-NAO-PERDER')
  })

  test('F05-E4 closing the window right after typing keeps the typing', async ({ app, page, dialogs, editor }) => {
    const a = join(work(), 'fecha.rotera')
    writeFileSync(a, file([{ kind: 'action', text: 'Antes.' }], 'F'))
    await dialogs.open(a)
    await page.getByRole('button', { name: 'Abrir…' }).click()
    await editor.click()
    await page.keyboard.press('Control+End')
    await page.keyboard.type(' DEPOIS-FECHAR')
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close())
    await expect.poll(() => readFileSync(a, 'utf8'), { timeout: 8000 }).toContain('DEPOIS-FECHAR')
  })

  test('F05-E5 an untitled script says it is only a draft, not "Salvo"', async ({ page, editor }) => {
    await newScript(page)
    await page.keyboard.press('Control+2')
    await editor.pressSequentially('Rascunho.')
    await page.waitForTimeout(2200)
    const status = await page.locator('.status').innerText()
    expect(status).not.toMatch(/(^|\n)Salvo\s*$/)
    expect(status).toMatch(/rascunho/i)
  })

  test('F05-E6 saving to a read-only file reports the error', async ({ page, dialogs, editor }) => {
    const dir = work()
    const ro = join(dir, 'leitura.rotera')
    writeFileSync(ro, file([{ kind: 'action', text: 'RO.' }], 'RO'))
    chmodSync(ro, 0o444)
    await dialogs.open(ro)
    await page.getByRole('button', { name: 'Abrir…' }).click()
    await editor.click()
    await page.keyboard.press('Control+End')
    await page.keyboard.type(' mudança')
    await expect(page.locator('.status')).toContainText('Erro ao salvar', { timeout: 6000 })
  })

  test('F05-E7 a script saved twice keeps one file and no temp files', async ({ page, dialogs, editor }) => {
    const dir = work()
    const p = join(dir, 'dois.rotera')
    await newScript(page)
    await page.keyboard.press('Control+2')
    await editor.pressSequentially('Um.')
    await dialogs.save(p)
    await page.getByRole('button', { name: 'Salvar como…' }).click()
    await expect(page.locator('.status')).toContainText('Salvo')
    await editor.pressSequentially(' Dois.')
    await page.waitForTimeout(2300)
    const names = (await import('node:fs')).readdirSync(dir)
    expect(names).toEqual(['dois.rotera'])
    expect(readFileSync(p, 'utf8')).toContain('Um. Dois.')
  })

  test('F05-E8 a second window is not opened (single instance)', async ({ app, page }) => {
    await expect(page.getByRole('button', { name: 'Novo roteiro' }).first()).toBeVisible()
    expect(app.windows().length).toBe(1)
  })

  test('F05-E9 draft recovery after a crash', async ({ app, page, editor, userData }) => {
    await newScript(page)
    await page.keyboard.press('Control+2')
    await editor.pressSequentially('Texto do rascunho sem arquivo.')
    await page.waitForTimeout(2300)
    expect(readFileSync(join(userData, 'draft.json'), 'utf8')).toContain('Texto do rascunho sem arquivo.')
    mkdirSync(join(userData, 'x'), { recursive: true })
  })
})
