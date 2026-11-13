import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Page } from '@playwright/test'
import { axeViolations, bridgeInfo, expect, menu, newScript, rows, setTheme, test, type Dialogs } from './fixtures'

test.afterEach(({ errors }) => {
  expect(errors, 'console or page errors').toEqual([])
})

async function rpc(userData: string, method: string, params: unknown = {}): Promise<{ ok: boolean; result?: any; error?: string }> {
  const { port, token } = bridgeInfo(userData)
  const r = await fetch(`http://127.0.0.1:${port}/rpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ method, params })
  })
  return (await r.json()) as { ok: boolean; result?: any; error?: string }
}

const headings = async (page: Page): Promise<string[]> => (await rows(page)).filter((r) => r.kind === 'scene_heading').map((r) => r.text)

/** Heading text alone (the row text on the page also carries the synopsis shown under it). */
const headingTexts = async (userData: string): Promise<string[]> =>
  ((await rpc(userData, 'get_outline')).result as { heading: string }[]).map((s) => s.heading)

const synopses = async (userData: string): Promise<(string | null)[]> =>
  ((await rpc(userData, 'get_outline')).result as { synopsis: string | null }[]).map((s) => s.synopsis)

/** New script, Beat Board, default structure, one scene per beat. */
async function boardWithScenes(page: Page): Promise<void> {
  await newScript(page)
  await page.getByRole('button', { name: 'Beat Board' }).click()
  await page.getByRole('button', { name: 'Aplicar estrutura' }).click()
  await page.getByRole('button', { name: /^Criar cenas para/ }).click()
}

const outline = (page: Page) => page.getByRole('complementary', { name: 'Escaleta' })

/**
 * Opens a long script (more than LONG_SCRIPT_BLOCKS = 400 blocks, so the app's scene list follows the editor late):
 * beat "Começo" = INT. A + INT. B, beat "Fim" = INT. C, and 450 action lines inside INT. A.
 */
async function openLongScript(page: Page, dialogs: Dialogs): Promise<void> {
  const blocks = [
    { kind: 'scene_heading', text: 'INT. A - DIA', bid: 'b1' },
    ...Array.from({ length: 450 }, (_, i) => ({ kind: 'action', text: `Linha ${i + 1}.` })),
    { kind: 'scene_heading', text: 'INT. B - DIA' },
    { kind: 'action', text: 'Meio.' },
    { kind: 'scene_heading', text: 'INT. C - DIA', bid: 'b2' },
    { kind: 'action', text: 'Fim.' }
  ]
  const board = {
    lanes: [{ id: 'l1', name: 'Ato 1' }],
    beats: [
      { id: 'b1', lane: 'l1', title: 'Começo', body: '', color: '' },
      { id: 'b2', lane: 'l1', title: 'Fim', body: '', color: '' }
    ]
  }
  const f = join(mkdtempSync(join(tmpdir(), 'rotera-f26-')), 'longo.rottera')
  writeFileSync(f, JSON.stringify({ format: 'rotera', version: 1, script: { titlePage: { title: 'Longo', author: '', contact: '' }, blocks, board } }), 'utf8')
  await dialogs.open(f)
  await page.getByRole('button', { name: 'Abrir…' }).first().click()
  await expect(page.getByRole('textbox', { name: 'Texto do roteiro' })).toBeVisible()
}

test.describe('F26 escaleta no Beat Board', () => {
  test('F26-H1 a escaleta lista as cenas agrupadas pelo beat', async ({ page }) => {
    await boardWithScenes(page)
    await expect(outline(page)).toBeVisible()
    const cards = await page.locator('.beat').count()
    await expect(outline(page).locator('.outline-group')).toHaveCount(cards)
    const firstTitle = await page.locator('.beat').first().getByRole('textbox', { name: 'Título do beat' }).inputValue()
    await expect(outline(page).locator('.outline-group').first().locator('h3')).toHaveText(firstTitle)
    await outline(page).getByRole('button', { name: 'Ir para a cena 1 no roteiro' }).click()
    await expect(page.getByRole('textbox', { name: 'Texto do roteiro' })).toBeVisible()
  })

  test('F26-H2 a sinopse escrita na escaleta vai para o roteiro e desfaz com Ctrl+Z', async ({ page, userData }) => {
    await boardWithScenes(page)
    await outline(page).getByRole('textbox', { name: 'Sinopse da cena 1', exact: true }).fill('Léo cai da bicicleta.')
    // switch tabs with the field still focused: the text must not be lost
    await page.getByRole('button', { name: 'Roteiro', exact: true }).click()
    await expect.poll(async () => (await synopses(userData))[0]).toBe('Léo cai da bicicleta.')
    await page.getByRole('textbox', { name: 'Texto do roteiro' }).click()
    await page.keyboard.press('Control+z')
    await expect.poll(async () => (await synopses(userData))[0] ?? '').toBe('')
  })

  test('F26-H3 o cabeçalho editado na escaleta muda no roteiro, e vazio não apaga', async ({ page, userData }) => {
    await boardWithScenes(page)
    const field = outline(page).getByRole('textbox', { name: 'Cabeçalho da cena 1', exact: true })
    await field.fill('EXT. PRAÇA - NOITE')
    await field.press('Enter')
    await expect.poll(async () => (await headingTexts(userData))[0]).toBe('EXT. PRAÇA - NOITE')
    const again = outline(page).getByRole('textbox', { name: 'Cabeçalho da cena 1', exact: true })
    await again.fill('')
    await again.press('Tab')
    await expect(outline(page).getByRole('textbox', { name: 'Cabeçalho da cena 1', exact: true })).toHaveValue('EXT. PRAÇA - NOITE')
    expect((await headingTexts(userData))[0]).toBe('EXT. PRAÇA - NOITE')
  })

  test('F26-E1 sinopse longa vira uma linha de até 400 caracteres', async ({ page, userData }) => {
    await boardWithScenes(page)
    const field = outline(page).getByRole('textbox', { name: 'Sinopse da cena 1', exact: true })
    await field.fill('a'.repeat(250) + '\n' + 'b'.repeat(250))
    await field.press('Tab')
    await expect.poll(async () => ((await synopses(userData))[0] ?? '').length).toBe(400)
    expect((await synopses(userData))[0]).not.toContain('\n')
  })

  test('F26-H4 "+ cena neste beat" cria a cena logo depois das cenas do beat', async ({ page, userData }) => {
    await boardWithScenes(page)
    const before = (await headingTexts(userData)).length
    const firstGroup = outline(page).locator('.outline-group').first()
    await firstGroup.getByRole('button', { name: /^Nova cena em / }).click()
    await expect.poll(async () => (await headingTexts(userData)).length).toBe(before + 1)
    expect((await headingTexts(userData))[1]).toBe('INT. LOCAL - DIA')
    await expect(firstGroup.locator('.outline-scene')).toHaveCount(2)
    await expect(outline(page).getByRole('textbox', { name: 'Cabeçalho da cena 2', exact: true })).toBeFocused()
  })

  test('F26-H5 o cartão conta as cenas e leva a escaleta até elas', async ({ page }) => {
    await boardWithScenes(page)
    await outline(page).locator('.outline-group').first().getByRole('button', { name: /^Nova cena em / }).click()
    await expect(page.locator('.beat').first().getByRole('button', { name: 'Ver as 2 cenas na escaleta' })).toBeVisible()
    await page.locator('.beat').last().getByRole('button', { name: 'Ver a cena na escaleta' }).click()
    await expect(outline(page).locator('.outline-group').last()).toBeInViewport()
  })

  test('F26-H6 ocultar a escaleta fica guardado', async ({ page }) => {
    await boardWithScenes(page)
    await page.getByRole('button', { name: 'Ocultar escaleta' }).click()
    await expect(outline(page)).toHaveCount(0)
    await page.getByRole('button', { name: 'Roteiro', exact: true }).click()
    await page.getByRole('button', { name: 'Beat Board' }).click()
    await expect(outline(page)).toHaveCount(0)
    await page.getByRole('button', { name: 'Mostrar escaleta' }).click()
    await expect(outline(page)).toBeVisible()
  })

  test('F26-E2 quadro vazio: as cenas aparecem em "Sem beat"', async ({ page }) => {
    await newScript(page)
    await page.getByRole('button', { name: 'Beat Board' }).click()
    const groups = outline(page).locator('.outline-group')
    await expect(groups).toHaveCount(1)
    await expect(groups.first().locator('h3')).toHaveText('Sem beat')
    await expect(groups.first().locator('.outline-scene')).toHaveCount(1)
  })

  test('F26-E4 com a escaleta aberta, as colunas de três atos cabem sem esconder a última', async ({ page }) => {
    await newScript(page)
    await page.getByRole('button', { name: 'Beat Board' }).click()
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Nova coluna' }).click()
    const lanes = page.locator('.lane')
    await expect(lanes).toHaveCount(3)
    const n = 3
    for (let i = 0; i < n; i++) await lanes.nth(i).getByRole('button', { name: '+ Beat' }).click()
    const boardBox = (await page.locator('.board').boundingBox())!
    const lastBox = (await lanes.nth(n - 1).boundingBox())!
    expect(lastBox.x + lastBox.width).toBeLessThanOrEqual(boardBox.x + boardBox.width + 1)
    // what is inside each column stays inside it: the cards and the arrows of the column header
    const spill = await page.evaluate(() =>
      [...document.querySelectorAll('.lane')].flatMap((lane) => {
        const right = lane.getBoundingClientRect().right
        return [...lane.querySelectorAll('.beat, .lane-head button')]
          .filter((el) => el.getBoundingClientRect().right > right + 1)
          .map((el) => el.className || el.getAttribute('aria-label'))
      })
    )
    expect(spill).toEqual([])
  })

  test('F26-E5 cabeçalho longo aparece inteiro na escaleta', async ({ page }) => {
    await boardWithScenes(page)
    const field = outline(page).getByRole('textbox', { name: 'Cabeçalho da cena 1', exact: true })
    await field.fill('EXT.- QUADRA DE BAIRRO ABANDONADA - BATALHA DA QUADRA - NOITE')
    await field.press('Enter')
    const f = outline(page).getByRole('textbox', { name: 'Cabeçalho da cena 1', exact: true })
    await expect(f).toHaveValue('EXT.- QUADRA DE BAIRRO ABANDONADA - BATALHA DA QUADRA - NOITE')
    const m = await f.evaluate((e: HTMLElement) => ({ sw: e.scrollWidth, cw: e.clientWidth, sh: e.scrollHeight, ch: e.clientHeight }))
    expect(m.sw).toBeLessThanOrEqual(m.cw + 1)
    expect(m.sh).toBeLessThanOrEqual(m.ch + 1)
  })

  test('F26-E6 cabeçalho colado com quebra de linha vira uma linha só', async ({ page, userData }) => {
    await boardWithScenes(page)
    const field = outline(page).getByRole('textbox', { name: 'Cabeçalho da cena 1', exact: true })
    await field.fill('EXT. PRAÇA\n - NOITE')
    await field.press('Tab')
    await expect.poll(async () => (await headingTexts(userData))[0]).toBe('EXT. PRAÇA - NOITE')
  })

  test('F26-L1 roteiro longo: "+ cena neste beat" foca a cena nova e o foco fica nela', async ({ page, dialogs, userData }) => {
    await openLongScript(page, dialogs)
    await page.getByRole('button', { name: 'Beat Board' }).click()
    await outline(page).getByRole('button', { name: 'Nova cena em Começo' }).click()
    const field = outline(page).getByRole('textbox', { name: 'Cabeçalho da cena 3', exact: true })
    await expect(field).toBeFocused()
    await expect(field).toHaveValue('INT. LOCAL - DIA')
    // the app's late scene list catches up 150 ms later: the focus and the field must survive it
    await page.waitForTimeout(400)
    await expect(field).toBeFocused()
    await page.keyboard.type('EXT. RUA - NOITE')
    await page.keyboard.press('Tab')
    await expect.poll(async () => headingTexts(userData)).toEqual(['INT. A - DIA', 'INT. B - DIA', 'EXT. RUA - NOITE', 'INT. C - DIA'])
  })

  test('F26-L2 roteiro longo: editar o roteiro e ir logo à escaleta grava na cena certa', async ({ page, dialogs, userData }) => {
    await openLongScript(page, dialogs)
    // a new line at the top of the script shifts every block by one
    await page.getByRole('textbox', { name: 'Texto do roteiro' }).locator('p').nth(1).click()
    await page.keyboard.press('Home')
    await page.keyboard.press('Enter')
    await page.getByRole('button', { name: 'Beat Board' }).click()
    const field = outline(page).getByRole('textbox', { name: 'Sinopse da cena 2', exact: true })
    await field.fill('O meio da história.')
    await field.press('Tab')
    await expect.poll(async () => (await synopses(userData))[1]).toBe('O meio da história.')
  })

  test('F26-M1 trocar de aba pelo menu com a sinopse ainda no campo não perde o texto', async ({ app, page, userData }) => {
    await boardWithScenes(page)
    await outline(page).getByRole('textbox', { name: 'Sinopse da cena 1', exact: true }).fill('Léo cai da bicicleta.')
    await menu(app, 'view-script')
    await expect(page.getByRole('textbox', { name: 'Texto do roteiro' })).toBeVisible()
    await expect.poll(async () => (await synopses(userData))[0]).toBe('Léo cai da bicicleta.')
  })

  test('F26-R1 ocultar e mostrar a escaleta não devolve o foco à cena criada antes', async ({ page }) => {
    await boardWithScenes(page)
    await outline(page).locator('.outline-group').first().getByRole('button', { name: /^Nova cena em / }).click()
    await expect(outline(page).getByRole('textbox', { name: 'Cabeçalho da cena 2', exact: true })).toBeFocused()
    await page.getByRole('button', { name: 'Ocultar escaleta' }).click()
    await page.getByRole('button', { name: 'Mostrar escaleta' }).click()
    await expect(outline(page)).toBeVisible()
    await expect(outline(page).getByRole('textbox', { name: 'Cabeçalho da cena 2', exact: true })).not.toBeFocused()
  })

  test('F26-E3 tema claro e escuro sem violações de acessibilidade', async ({ app, page }) => {
    await boardWithScenes(page)
    await outline(page).getByRole('textbox', { name: 'Sinopse da cena 1', exact: true }).fill('Léo cai.')
    const found: string[] = []
    for (const theme of ['light', 'night'] as const) {
      await setTheme(app, page, theme)
      await page.waitForTimeout(250)
      for (const v of await axeViolations(page)) found.push(`${theme}: ${v}`)
    }
    expect(found).toEqual([])
  })
})
