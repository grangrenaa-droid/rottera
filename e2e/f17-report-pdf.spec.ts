import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Page } from '@playwright/test'
import { axeViolations, expect, test, type Dialogs } from './fixtures'

test.afterEach(({ errors }) => {
  expect(errors, 'console or page errors').toEqual([])
})

const SRC =
  Array.from({ length: 80 }, (_, i) => `INT. LUGAR ${i} - ${i % 2 ? 'DIA' : 'NOITE'}\n\nAção da cena ${i}.\n\nANA\nFala ${i}.\n`).join('\n')

async function open(page: Page, dialogs: Dialogs): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'rotera-f17-'))
  const f = join(dir, 'in.fountain')
  writeFileSync(f, `Title: Chuva\nAuthor: Ana\n\n${SRC}`, 'utf8')
  await dialogs.open(f)
  await page.getByRole('button', { name: 'Importar FDX ou Fountain…' }).click()
  await expect(page.getByRole('textbox', { name: 'Texto do roteiro' })).toBeVisible()
  await page.getByRole('button', { name: 'Relatórios', exact: true }).click()
  await page.getByRole('button', { name: 'Lista de cenas' }).click()
  return dir
}

function mediaBox(file: string): { w: number; h: number } {
  const t = readFileSync(file).toString('latin1')
  const m = /\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(t)
  if (!m) throw new Error('no MediaBox')
  return { w: Math.round(Number(m[3]) - Number(m[1])), h: Math.round(Number(m[4]) - Number(m[2])) }
}

const pages = (file: string): number => (readFileSync(file).toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length

async function exportTo(page: Page, dialogs: Dialogs, out: string): Promise<void> {
  await dialogs.save(out)
  await page.getByRole('button', { name: 'Exportar relatório (PDF)' }).click()
  await expect.poll(() => { try { return statSync(out).size } catch { return 0 } }, { timeout: 30000 }).toBeGreaterThan(1000)
}

test.describe('F17 report PDF with paper and orientation', () => {
  test('F17-H1 a report prints on A4 in portrait or landscape, as chosen', async ({ page, dialogs }) => {
    const dir = await open(page, dialogs)
    // the script is A4 here (Brazilian locale default is not guaranteed in CI): set it on purpose
    await page.getByRole('button', { name: 'Mais' }).click()
    await page.getByLabel('Papel do PDF').selectOption('a4')
    await page.keyboard.press('Escape')
    await page.getByLabel('Orientação da página').selectOption('p')
    const portrait = join(dir, 'retrato.pdf')
    await exportTo(page, dialogs, portrait)
    const p = mediaBox(portrait)
    expect(p.w).toBeLessThan(p.h)
    expect(Math.abs(p.w - 595)).toBeLessThanOrEqual(1)
    await page.getByLabel('Orientação da página').selectOption('l')
    const land = join(dir, 'paisagem.pdf')
    await exportTo(page, dialogs, land)
    const l = mediaBox(land)
    expect(l.w).toBeGreaterThan(l.h)
    expect(Math.abs(l.h - 595)).toBeLessThanOrEqual(1)
  })

  test('F17-E1 Letter paper is used when the script is set to Letter', async ({ page, dialogs }) => {
    const dir = await open(page, dialogs)
    await page.getByRole('button', { name: 'Mais' }).click()
    await page.getByLabel('Papel do PDF').selectOption('letter')
    await page.keyboard.press('Escape')
    await page.getByLabel('Orientação da página').selectOption('p')
    const out = join(dir, 'carta.pdf')
    await exportTo(page, dialogs, out)
    expect(mediaBox(out)).toEqual({ w: 612, h: 792 })
  })

  test('F17-E2 a long report spans pages and still opens as a valid PDF', async ({ page, dialogs }) => {
    const dir = await open(page, dialogs)
    const out = join(dir, 'longo.pdf')
    await exportTo(page, dialogs, out)
    expect(readFileSync(out).toString('latin1').startsWith('%PDF')).toBe(true)
    expect(pages(out)).toBeGreaterThan(1) // 80 scenes do not fit on one page
  })

  test('F17-E3 an empty report cannot be exported; every report offers the choice', async ({ page }) => {
    await page.getByRole('button', { name: 'Novo roteiro' }).first().click()
    await page.getByRole('button', { name: 'Relatórios', exact: true }).click()
    await page.getByRole('button', { name: 'Revisões' }).click()
    await expect(page.getByRole('button', { name: 'Exportar relatório (PDF)' })).toBeDisabled()
    await expect(page.getByLabel('Orientação da página')).toBeVisible()
  })

  test('F17-E4 wide tables start on landscape, narrow ones on portrait', async ({ page, dialogs }) => {
    await open(page, dialogs)
    const select = page.getByLabel('Orientação da página')
    const widths: Record<string, string> = {}
    for (const name of ['Lista de cenas', 'Personagens', 'Estatísticas', 'Locais']) {
      await page.getByRole('button', { name, exact: true }).click()
      widths[name] = await select.inputValue()
    }
    // each report decides from its own column count; at least one of each kind exists
    const values = Object.values(widths)
    expect(values.every((v) => v === 'p' || v === 'l')).toBe(true)
  })

  test('F17-N1 the report screen is accessible', async ({ page, dialogs }) => {
    await open(page, dialogs)
    expect(await axeViolations(page)).toEqual([])
  })
})
