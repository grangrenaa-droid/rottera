import { deflateSync } from 'node:zlib'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Page } from '@playwright/test'
import { axeViolations, bridgeInfo, expect, test, type Dialogs } from './fixtures'

test.afterEach(({ errors }) => {
  expect(errors, 'console or page errors').toEqual([])
})

const FOUNTAIN = `Title: Chuva
Author: Ana Souza

INT. COZINHA - DIA

Marina coa o café.

MARINA
Você veio. Eu não esperava mais.

DAVI
Eu disse que vinha.

EXT. RUA - NOITE

Chove sem parar.

MARINA (V.O.)
Ele chegou tarde.

INT. SALA - DIA

BIA
Finalmente.

DAVI
Cheguei.
`

async function open(page: Page, dialogs: Dialogs): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'rotera-f12-'))
  const f = join(dir, 'in.fountain')
  writeFileSync(f, FOUNTAIN, 'utf8')
  await dialogs.open(f)
  await page.getByRole('button', { name: 'Importar FDX ou Fountain…' }).click()
  await expect(page.getByRole('textbox', { name: 'Texto do roteiro' })).toBeVisible()
  return dir
}

async function toSheets(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Relatórios', exact: true }).click()
  await page.getByRole('button', { name: 'Fichas de personagem' }).click()
  await expect(page.getByRole('complementary', { name: 'Personagens' })).toBeVisible()
}

async function rpc(userData: string, method: string, params: unknown = {}): Promise<{ ok: boolean; result?: any; error?: string }> {
  const { port, token } = bridgeInfo(userData)
  const r = await fetch(`http://127.0.0.1:${port}/rpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ method, params })
  })
  return (await r.json()) as { ok: boolean; result?: any; error?: string }
}

function png(): Buffer {
  const crcTable: number[] = []
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crcTable[n] = c >>> 0
  }
  const crc = (b: Buffer): number => {
    let c = 0xffffffff
    for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (t: string, d: Buffer): Buffer => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(d.length)
    const td = Buffer.concat([Buffer.from(t), d])
    const c = Buffer.alloc(4)
    c.writeUInt32BE(crc(td))
    return Buffer.concat([len, td, c])
  }
  const w = 90
  const h = 120
  const row = w * 3 + 1
  const raw = Buffer.alloc(row * h, 150)
  for (let y = 0; y < h; y++) raw[y * row] = 0
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

test.describe('F12 character sheets and presentation (Relatórios)', () => {
  test('F12-H1 everyone who speaks is listed, busiest first, with numbers from the script', async ({ page, dialogs }) => {
    await open(page, dialogs)
    await toSheets(page)
    const names = await page.locator('.chars-list li button b').allTextContents()
    expect(names).toEqual(['MARINA', 'DAVI', 'BIA'])
    await expect(page.locator('.chars-list li').first()).toContainText('2 falas')
    await expect(page.locator('.chars-list li').first()).toContainText('2 cenas')
  })

  test('F12-H2 what is written in the sheet shows in the presentation at once', async ({ page, dialogs }) => {
    await open(page, dialogs)
    await toSheets(page)
    const card = page.getByLabel('Apresentação do personagem')
    await expect(card).toContainText('A ficha está vazia')
    await page.getByLabel('Objetivo').fill('Recomeçar a vida na cidade')
    await expect(card.getByRole('heading', { name: 'Objetivo' })).toBeVisible()
    await expect(card).toContainText('Recomeçar a vida na cidade')
    await expect(card).not.toContainText('A ficha está vazia')
    await page.getByLabel('Idade', { exact: true }).fill('34')
    await page.getByLabel('Papel na história').fill('Protagonista')
    await expect(card).toContainText('34 anos · Protagonista')
    await page.getByLabel('Objetivo').fill('')
    await expect(card.getByRole('heading', { name: 'Objetivo' })).toHaveCount(0)
  })

  test('F12-H3 the script numbers in the presentation follow edits to the script', async ({ page, dialogs, userData }) => {
    await open(page, dialogs)
    await toSheets(page)
    const card = page.getByLabel('Apresentação do personagem')
    await expect(card).toContainText('2 falas')
    await rpc(userData, 'insert_fountain', { text: 'MARINA\nMais uma fala dela.\n' })
    await expect(card).toContainText('3 falas')
  })

  test('F12-E1 renaming the character in SmartType keeps the sheet attached', async ({ page, dialogs }) => {
    await open(page, dialogs)
    await toSheets(page)
    await page.getByLabel('Objetivo').fill('Perdoar')
    await page.getByRole('button', { name: 'Roteiro', exact: true }).click()
    await page.getByRole('button', { name: 'Mais' }).click()
    await page.getByRole('button', { name: 'Gerenciar SmartType…' }).click()
    await page.locator('.st-list li', { hasText: 'MARINA' }).getByRole('button', { name: 'Renomear em tudo' }).click()
    const input = page.getByLabel(/Novo nome para/)
    await input.fill('Mariana')
    await page.getByRole('button', { name: 'Renomear', exact: true }).click()
    await page.keyboard.press('Escape')
    await toSheets(page)
    await expect(page.locator('.chars-list li button b').first()).toHaveText('Mariana')
    await expect(page.getByLabel('Objetivo')).toHaveValue('Perdoar')
  })

  test('F12-E2 a character who does not speak yet can have a sheet', async ({ page, dialogs }) => {
    await open(page, dialogs)
    await toSheets(page)
    await page.getByLabel('Nome do novo personagem').fill('Zeca')
    await page.getByRole('button', { name: 'Adicionar' }).click()
    await expect(page.getByLabel('Apresentação do personagem')).toContainText('ZECA')
    await expect(page.getByLabel('Apresentação do personagem')).toContainText('Ainda não fala no roteiro')
    await page.getByLabel('Nome do novo personagem').fill('zeca')
    await page.getByRole('button', { name: 'Adicionar' }).click()
    await expect(page.locator('.chars-list li')).toHaveCount(4)
  })

  test('F12-E3 a picture appears in the sheet and in the presentation', async ({ page, dialogs }) => {
    const dir = await open(page, dialogs)
    const img = join(dir, 'foto.png')
    writeFileSync(img, png())
    await toSheets(page)
    await page.getByLabel('Escolher imagem do personagem').setInputFiles(img)
    await expect(page.locator('.chars-card img')).toHaveCount(1)
    await page.getByRole('button', { name: 'Remover imagem' }).click()
    await expect(page.locator('.chars-card img')).toHaveCount(0)
  })

  test('F12-E4 the sheet is saved in the file and comes back', async ({ page, dialogs }) => {
    const dir = await open(page, dialogs)
    await toSheets(page)
    await page.getByLabel('Conflito').fill('Teme ser deixada outra vez')
    const f = join(dir, 'com-fichas.rotera')
    await dialogs.save(f)
    await page.getByRole('button', { name: 'Salvar como…' }).click()
    await expect(page.locator('.status')).toContainText('Salvo')
    const saved = JSON.parse(readFileSync(f, 'utf8'))
    expect(saved.script.characters[0].conflict).toBe('Teme ser deixada outra vez')
    await page.getByRole('button', { name: 'Início' }).click()
    await dialogs.open(f)
    await page.getByRole('button', { name: 'Abrir…' }).click()
    await toSheets(page)
    await expect(page.getByLabel('Conflito')).toHaveValue('Teme ser deixada outra vez')
  })

  test('F12-E5 only written sheets are printed after the script', async ({ page, dialogs }) => {
    const dir = await open(page, dialogs)
    await toSheets(page)
    await page.getByLabel('Objetivo').fill('Recomeçar')
    const pdfPages = (file: string): number => (readFileSync(file).toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length
    const scriptOnly = join(dir, 'a.pdf')
    await dialogs.save(scriptOnly)
    await page.getByRole('button', { name: 'Exportar PDF' }).click()
    await expect.poll(() => { try { return readFileSync(scriptOnly).length } catch { return 0 } }, { timeout: 20000 }).toBeGreaterThan(1000)
    const withOne = pdfPages(scriptOnly)
    await page.getByLabel('Incluir no PDF do roteiro').uncheck()
    const without = join(dir, 'b.pdf')
    await dialogs.save(without)
    await page.getByRole('button', { name: 'Exportar PDF' }).click()
    await expect.poll(() => { try { return readFileSync(without).length } catch { return 0 } }, { timeout: 20000 }).toBeGreaterThan(1000)
    expect(withOne).toBe(pdfPages(without) + 1)
  })

  test('F12-E6 the fichas-only export prints just the sheets', async ({ page, dialogs }) => {
    const dir = await open(page, dialogs)
    await toSheets(page)
    await page.getByLabel('Objetivo').fill('Recomeçar')
    const out = join(dir, 'fichas.pdf')
    await dialogs.save(out)
    await page.getByRole('button', { name: 'Exportar fichas (PDF)' }).click()
    await expect.poll(() => { try { return readFileSync(out).length } catch { return 0 } }, { timeout: 20000 }).toBeGreaterThan(1000)
    const t = readFileSync(out).toString('latin1')
    expect((t.match(/\/Type\s*\/Page[^s]/g) || []).length).toBe(3) // Marina, Davi and Bia are in the script
  })

  test('F12-C1 Claude can read and fill sheets, and the presentation updates without a reload', async ({ page, dialogs, userData }) => {
    await open(page, dialogs)
    await toSheets(page)
    const set = await rpc(userData, 'set_character', {
      name: 'davi',
      role: 'Antagonista',
      personality: 'Orgulhoso, fala pouco',
      age: 'por volta de 50'
    })
    expect(set.ok).toBe(true)
    expect(set.result.filled).toEqual(['age', 'role', 'personality'])
    await page.locator('.chars-list li', { hasText: 'DAVI' }).locator('button').click()
    await expect(page.getByLabel('Apresentação do personagem')).toContainText('por volta de 50 · Antagonista')
    await expect(page.getByLabel('Apresentação do personagem')).toContainText('Orgulhoso, fala pouco')
    const got = await rpc(userData, 'get_characters', { name: 'Davi' })
    expect(got.result[0].sheet.role).toBe('Antagonista')
    expect(got.result[0].stats.lines).toBe(2)
    const bad = await rpc(userData, 'set_character', { name: 'Davi', goal: 123 })
    expect(bad.ok).toBe(false)
    const long = await rpc(userData, 'set_character', { name: 'Davi', goal: 'x'.repeat(5000) })
    expect(long.ok).toBe(false)
  })

  test('F12-A1 the sheet screen has no serious accessibility violations, light and dark', async ({ page, dialogs }) => {
    await open(page, dialogs)
    await toSheets(page)
    await page.getByLabel('Objetivo').fill('Recomeçar')
    const found: string[] = []
    for (const theme of ['light', 'night', 'midnight']) {
      await page.getByLabel('Tema').selectOption(theme)
      await page.waitForTimeout(250)
      for (const v of await axeViolations(page)) found.push(`${theme}: ${v}`)
    }
    expect(found).toEqual([])
  })
})
