import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, newScript, test } from './fixtures'

test.afterEach(({ errors }) => {
  expect(errors, 'console or page errors').toEqual([])
})

const mediaBoxes = (file: string): number[][] => {
  const t = readFileSync(file).toString('latin1')
  return [...t.matchAll(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/g)].map((m) => [Number(m[3]), Number(m[4])])
}

const readable = (file: string): number => {
  try {
    return readFileSync(file).length
  } catch {
    return 0
  }
}

test.describe('F09 paper size for printing', () => {
  test('F09-H1 the PDF follows the paper chosen in the app (A4 and Carta)', async ({ page, dialogs }) => {
    const dir = mkdtempSync(join(tmpdir(), 'rotera-f09-'))
    const src = join(dir, 'in.fountain')
    writeFileSync(src, 'Title: Papel\n\nINT. SALA - DIA\n\nTexto.\n', 'utf8')
    await dialogs.open(src)
    await page.getByRole('button', { name: 'Importar FDX ou Fountain…' }).click()
    await expect(page.getByRole('textbox', { name: 'Texto do roteiro' })).toBeVisible()

    await page.getByRole('button', { name: 'Mais' }).click()
    await page.getByLabel('Papel do PDF').selectOption('a4')
    await page.keyboard.press('Escape')
    const a4 = join(dir, 'a4.pdf')
    await dialogs.save(a4)
    await page.getByRole('button', { name: 'Exportar PDF' }).click()
    await expect.poll(() => readable(a4), { timeout: 20000 }).toBeGreaterThan(1000)
    const boxesA4 = mediaBoxes(a4)
    expect(boxesA4.length).toBeGreaterThan(0)
    for (const [w, h] of boxesA4) {
      expect(Math.round(w)).toBe(595) // 8.27 in
      expect(Math.round(h)).toBe(842) // 11.69 in
    }

    await page.getByRole('button', { name: 'Mais' }).click()
    await page.getByLabel('Papel do PDF').selectOption('letter')
    await page.keyboard.press('Escape')
    const letter = join(dir, 'letter.pdf')
    await dialogs.save(letter)
    await page.getByRole('button', { name: 'Exportar PDF' }).click()
    await expect.poll(() => readable(letter), { timeout: 20000 }).toBeGreaterThan(1000)
    const boxesLetter = mediaBoxes(letter)
    expect(boxesLetter.length).toBeGreaterThan(0)
    for (const [w, h] of boxesLetter) {
      expect(Math.round(w)).toBe(612)
      expect(Math.round(h)).toBe(792)
    }
  })

  test('F09-E1 a long script has fewer pages on A4 and the status bar follows', async ({ page, dialogs }) => {
    const dir = mkdtempSync(join(tmpdir(), 'rotera-f09-'))
    const src = join(dir, 'long.fountain')
    writeFileSync(src, Array.from({ length: 800 }, (_, i) => `Linha de ação número ${i}.`).join('\n\n'), 'utf8')
    await dialogs.open(src)
    await page.getByRole('button', { name: 'Importar FDX ou Fountain…' }).click()
    const count = async (): Promise<number> => Number(/de (\d+)/.exec(await page.locator('.status').innerText())?.[1])
    await page.getByRole('button', { name: 'Mais' }).click()
    await page.getByLabel('Papel do PDF').selectOption('letter')
    await page.keyboard.press('Escape')
    const letter = await count()
    await page.getByRole('button', { name: 'Mais' }).click()
    await page.getByLabel('Papel do PDF').selectOption('a4')
    await page.keyboard.press('Escape')
    await expect.poll(count).toBeLessThan(letter)
  })

  test('F09-E2 the choice is stored in the file', async ({ page, dialogs }) => {
    const dir = mkdtempSync(join(tmpdir(), 'rotera-f09-'))
    await newScript(page)
    await page.getByRole('button', { name: 'Mais' }).click()
    await page.getByLabel('Papel do PDF').selectOption('a4')
    await page.keyboard.press('Escape')
    const f = join(dir, 'papel.rotera')
    await dialogs.save(f)
    await page.getByRole('button', { name: 'Salvar como…' }).click()
    await expect(page.locator('.status')).toContainText('Salvo')
    expect(JSON.parse(readFileSync(f, 'utf8')).script.paper).toBe('a4')
  })
})
