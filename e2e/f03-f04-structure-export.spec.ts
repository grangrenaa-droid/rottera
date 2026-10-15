import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, newScript, rows, test } from './fixtures'
import { parseFdx, toFdx } from '../src/shared/fdx'
import { parseFountain, toFountain } from '../src/shared/fountain'
import type { Block, Script } from '../src/shared/types'

test.afterEach(({ errors }) => {
  expect(errors, 'console or page errors').toEqual([])
})

const work = (): string => mkdtempSync(join(tmpdir(), 'rotera-f03-'))

async function importFountain(page: import('@playwright/test').Page, dialogs: import('./fixtures').Dialogs, text: string): Promise<void> {
  const f = join(work(), 'in.fountain')
  writeFileSync(f, text, 'utf8')
  await dialogs.open(f)
  await page.getByRole('button', { name: 'Importar FDX ou Fountain…' }).click()
  await expect(page.getByRole('textbox', { name: 'Texto do roteiro' })).toBeVisible()
}

test.describe('F03 navigator, find and replace', () => {
  const src = 'INT. COZINHA - DIA\n\nMarina coa café.\n\nEXT. RUA - NOITE\n\nChove.\n\nINT. SALA - DIA\n\nSilêncio. Marina espera (1.5) [x].\n'

  test('F03-H1 reorder a scene with the arrow button', async ({ page, dialogs }) => {
    await importFountain(page, dialogs, src)
    const nav = page.getByRole('complementary', { name: 'Navegador de cenas' })
    await expect(nav.locator('.scene-text').first()).toHaveText('INT. COZINHA - DIA')
    await nav.getByRole('button', { name: 'Descer cena 1' }).click()
    await expect(nav.locator('.scene-text').first()).toHaveText('EXT. RUA - NOITE')
    expect((await rows(page)).filter((r) => r.kind === 'scene_heading')[1].text).toBe('INT. COZINHA - DIA')
  })

  test('F03-E1 first scene cannot move up, last cannot move down', async ({ page, dialogs }) => {
    await importFountain(page, dialogs, src)
    const nav = page.getByRole('complementary', { name: 'Navegador de cenas' })
    await expect(nav.getByRole('button', { name: 'Subir cena 1' })).toBeDisabled()
    await expect(nav.getByRole('button', { name: 'Descer cena 3' })).toBeDisabled()
  })

  test('F03-E2 find with special characters is literal', async ({ page, dialogs }) => {
    await importFountain(page, dialogs, src)
    await page.getByRole('button', { name: 'Localizar' }).click()
    await page.getByPlaceholder('Localizar').fill('(1.5) [x]')
    await expect(page.locator('.findbar')).toContainText('1 de 1')
    await page.getByPlaceholder('Localizar').fill('.*')
    await expect(page.locator('.findbar')).toContainText('Nada encontrado')
  })

  test('F03-E3 replace all where the replacement contains the search text', async ({ page, dialogs }) => {
    await importFountain(page, dialogs, src)
    await page.getByRole('button', { name: 'Localizar' }).click()
    await page.getByPlaceholder('Localizar').fill('Marina')
    await page.getByPlaceholder('Substituir por').fill('Marina Souza')
    await page.getByRole('button', { name: 'Substituir tudo' }).click()
    const all = (await rows(page)).map((r) => r.text).join('|')
    expect(all).toContain('Marina Souza coa café.')
    expect(all).not.toContain('Marina Souza Souza')
  })

  test('F03-E4 replace with nothing deletes the match', async ({ page, dialogs }) => {
    await importFountain(page, dialogs, src)
    await page.getByRole('button', { name: 'Localizar' }).click()
    await page.getByPlaceholder('Localizar').fill(' [x]')
    await page.getByRole('button', { name: 'Substituir tudo' }).click()
    expect((await rows(page)).map((r) => r.text).join('|')).toContain('espera (1.5).')
  })

  test('F03-E5 case sensitivity', async ({ page, dialogs }) => {
    await importFountain(page, dialogs, src)
    await page.getByRole('button', { name: 'Localizar' }).click()
    await page.getByPlaceholder('Localizar').fill('marina')
    await expect(page.locator('.findbar')).toContainText('de 2')
    await page.getByLabel('Maiúsculas').check()
    await expect(page.locator('.findbar')).toContainText('Nada encontrado')
  })

  test('F03-E6 empty script: reports, navigator and find do not break', async ({ page }) => {
    await newScript(page)
    await expect(page.getByRole('complementary', { name: 'Navegador de cenas' })).toContainText('Cenas (1)')
    await page.getByRole('button', { name: 'Relatórios' }).first().click()
    await expect(page.getByRole('heading', { name: 'Lista de cenas' })).toBeVisible()
    await page.getByRole('button', { name: 'Estatísticas' }).click()
    await expect(page.locator('table')).toContainText('Páginas')
  })
})

test.describe('F04 export', () => {
  test('F04-H1 PDF is written with the right page count', async ({ page, dialogs }) => {
    const long = Array.from({ length: 30 }, (_, i) => `INT. LUGAR ${i} - DIA\n\n${'Descrição que ocupa linhas. '.repeat(6)}\n`).join('\n')
    await importFountain(page, dialogs, `Title: Teste\nAuthor: Ana\n\n${long}`)
    const out = join(work(), 'a.pdf')
    await dialogs.save(out)
    await page.getByRole('button', { name: 'Exportar PDF' }).click()
    await expect.poll(() => { try { return readFileSync(out).length } catch { return 0 } }, { timeout: 20000 }).toBeGreaterThan(1000)
    const t = readFileSync(out).toString('latin1')
    const pages = (t.match(/\/Type\s*\/Page[^s]/g) || []).length
    const status = await page.locator('.status').innerText()
    const scriptPages = Number(/de (\d+)/.exec(status)?.[1])
    expect(pages).toBe(scriptPages + 1)
  })

  test('F04-E1 empty script still exports one page', async ({ page, dialogs }) => {
    await newScript(page)
    const out = join(work(), 'vazio.pdf')
    await dialogs.save(out)
    await page.getByRole('button', { name: 'Exportar PDF' }).click()
    await expect.poll(() => { try { return readFileSync(out).length } catch { return 0 } }, { timeout: 20000 }).toBeGreaterThan(500)
    const pages = (readFileSync(out).toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length
    expect(pages).toBe(1)
  })

  test('F04-E2 FDX never contains characters that are illegal in XML', () => {
    const s: Script = {
      titlePage: { title: 'Título \u0001 com controle', author: 'A\u000bB', contact: '' },
      blocks: [
        { kind: 'action', text: 'Texto com \u0000 nulo, \u0008 backspace e \u001f unit separator.' },
        { kind: 'dialogue', text: 'Normal & <ok> "aspas"' }
      ]
    }
    const xml = toFdx(s)
    // eslint-disable-next-line no-control-regex
    expect(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(xml)).toBe(false)
    expect(() => parseFdx(xml)).not.toThrow()
    expect(parseFdx(xml).blocks[1].text).toBe('Normal & <ok> "aspas"')
  })

  test('F04-E3 Fountain round trip keeps lines that start with markup characters', () => {
    const starts = ['.hoje', '@ana', '!forte', '#nota', '>fim', '=igual', '~canta', 'INT. como ação', 'CORTA PARA:', '[[comentário]] texto', '/* x */ y']
    const blocks: Block[] = starts.map((t) => ({ kind: 'action' as const, text: t }))
    const s: Script = { titlePage: { title: '', author: '', contact: '' }, blocks }
    const back = parseFountain(toFountain(s)).blocks
    const lost = starts.filter((t) => !back.some((b) => b.kind === 'action' && b.text === t))
    expect(lost, 'action lines changed by a Fountain round trip').toEqual([])
  })

  test('F04-E4 title with & < > and quotes prints without breaking the PDF', async ({ page, dialogs }) => {
    await importFountain(page, dialogs, 'Title: A & B <i>"x"</i>\nAuthor: Zé & Cia\n\nINT. SALA - DIA\n\nOk.\n')
    const out = join(work(), 'esc.pdf')
    await dialogs.save(out)
    await page.getByRole('button', { name: 'Exportar PDF' }).click()
    await expect.poll(() => { try { return readFileSync(out).length } catch { return 0 } }, { timeout: 20000 }).toBeGreaterThan(1000)
    expect(readFileSync(out).toString('latin1').startsWith('%PDF')).toBe(true)
  })

  test('F04-E5 a 300 page script paginates and exports in reasonable time', async ({ page, dialogs }) => {
    test.setTimeout(150_000)
    const body = Array.from({ length: 1800 }, (_, i) => `INT. LUGAR ${i} - DIA\n\n${'Descrição longa para ocupar linhas na página. '.repeat(5)}\n\nANA\nFala ${i}.\n`).join('\n')
    const t0 = Date.now()
    await importFountain(page, dialogs, body)
    const imported = Date.now() - t0
    const out = join(work(), 'grande.pdf')
    await dialogs.save(out)
    await page.getByRole('button', { name: 'Exportar PDF' }).click()
    await expect.poll(() => { try { return readFileSync(out).length } catch { return 0 } }, { timeout: 90000 }).toBeGreaterThan(10000)
    expect(imported).toBeLessThan(30000)
    // typing stays responsive on a big script
    const editor = page.getByRole('textbox', { name: 'Texto do roteiro' })
    await editor.click()
    const t1 = Date.now()
    await page.keyboard.type('abc', { delay: 0 })
    expect(Date.now() - t1).toBeLessThan(3000)
  })
})
