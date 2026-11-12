import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Page } from '@playwright/test'
import { axeViolations, bridgeInfo, expect, menu, setTheme, test, type Dialogs } from './fixtures'

test.afterEach(({ errors }) => {
  expect(errors, 'console or page errors').toEqual([])
})

const FOUNTAIN = `INT. COZINHA - DIA

Marina coa o café.

MARINA
Você veio.

DAVI
Eu disse que vinha.

EXT. RUA - NOITE

Chove sem parar.

INT. CARRO - NOITE

DAVI
Liga logo.
`

async function open(page: Page, dialogs: Dialogs): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'rotera-f21-'))
  const f = join(dir, 'in.fountain')
  writeFileSync(f, FOUNTAIN, 'utf8')
  await dialogs.open(f)
  await page.getByRole('button', { name: 'Importar FDX ou Fountain…' }).click()
  await expect(page.getByRole('textbox', { name: 'Texto do roteiro' })).toBeVisible()
  return dir
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

const scene = (page: Page, heading: string) => page.locator('.prod-scenes button', { hasText: heading })
async function addTo(page: Page, category: string, name: string): Promise<void> {
  const input = page.getByLabel(`Acrescentar em ${category}`)
  await input.fill(name)
  await input.press('Enter')
}
const strip = (page: Page, n: string) => page.locator('.strip', { has: page.locator('.strip-n', { hasText: new RegExp(`^${n}$`) }) })

test.describe('F21 breakdown, shooting plan and scene links', () => {
  test('F21-H1 the breakdown lists each scene with its cast, and elements are shared by name', async ({ app, page, dialogs }) => {
    await open(page, dialogs)
    await menu(app, 'view-shooting') // Ctrl+Alt+6
    await scene(page, 'COZINHA').click()
    const sheet = page.locator('.prod-sheet')
    await expect(sheet.getByRole('heading', { level: 2 })).toHaveText('Cena 1 · INT. COZINHA - DIA')
    await expect(sheet.locator('.prod-cast .chips li')).toHaveText(['MARINA', 'DAVI'])
    await addTo(page, 'Objetos de cena', 'Bule')
    await addTo(page, 'Figurino', 'Roupão azul')
    await expect(sheet.locator('.prod-cat', { hasText: 'Objetos de cena' }).locator('.chips li')).toHaveText(['Bule×'])
    await expect(scene(page, 'COZINHA')).toContainText('2 elementos')

    // the same name in another scene is the same element
    await scene(page, 'CARRO').click()
    await addTo(page, 'Objetos de cena', 'bule')
    await expect(scene(page, 'CARRO')).toContainText('1 elemento')
    // it keeps the name it was first written with
    await page.getByRole('button', { name: 'Tirar Bule desta cena' }).click()
    await expect(scene(page, 'CARRO')).toContainText('0 elementos')
    await expect(scene(page, 'COZINHA')).toContainText('2 elementos')

    // the reports show it
    await page.locator('.seg button', { hasText: /^Relatórios$/ }).click()
    await page.locator('.reports nav button', { hasText: 'Decupagem por cena' }).click()
    await expect(page.locator('.report-body table')).toContainText('Roupão azul')
    await page.locator('.reports nav button', { hasText: 'Elementos de produção' }).click()
    await expect(page.locator('.report-body table tbody tr')).toHaveCount(2)
  })

  test('F21-H2 scenes go on shooting days, in order, with totals; a day prints its call sheet', async ({ app, page, dialogs }) => {
    const dir = await open(page, dialogs)
    await menu(app, 'view-shooting')
    await page.getByRole('button', { name: 'Plano de filmagem' }).click()
    await expect(page.locator('.plan-pool h3')).toHaveText('Sem dia (3)')
    await page.getByRole('button', { name: 'Novo dia' }).click()
    await page.getByRole('button', { name: 'Novo dia' }).click()
    await page.getByLabel('Nome do dia 1').fill('Sábado')
    await page.getByLabel('Dia da cena 3', { exact: true }).selectOption({ label: 'Sábado' })
    await page.getByLabel('Dia da cena 1', { exact: true }).selectOption({ label: 'Sábado' })
    const sat = page.getByRole('region', { name: 'Sábado' })
    await expect(sat.locator('.strip-n')).toHaveText(['3', '1'])
    await expect(sat).toContainText('2 cenas')
    await page.getByRole('button', { name: 'Subir cena 1 no dia' }).click()
    await expect(sat.locator('.strip-n')).toHaveText(['1', '3'])
    await expect(page.locator('.plan-pool h3')).toHaveText('Sem dia (1)')
    // strips are coloured by INT/EXT and day/night
    await expect(strip(page, '2')).toHaveAttribute('data-strip', 'ext-night')
    await expect(strip(page, '1')).toHaveAttribute('data-strip', 'int-day')

    // drag the last unscheduled scene onto day 2
    await strip(page, '2').dragTo(page.getByRole('region', { name: 'Dia 2' }))
    await expect(page.getByRole('region', { name: 'Dia 2' }).locator('.strip-n')).toHaveText(['2'])
    await expect(page.locator('.plan-pool')).toContainText('Todas as cenas têm dia')

    const pdf = join(dir, 'ordem.pdf')
    await dialogs.save(pdf)
    await sat.getByRole('button', { name: 'Ordem do dia (PDF)' }).click()
    await expect.poll(() => { try { return statSync(pdf).size } catch { return 0 } }, { timeout: 20000 }).toBeGreaterThan(1000)

    // deleting a day sends its scenes back
    await sat.getByRole('button', { name: 'Apagar dia' }).click()
    await expect(page.locator('.plan-pool h3')).toHaveText('Sem dia (2)')
  })

  test('F21-H3 breakdown and plan are saved in the file and come back', async ({ app, page, dialogs }) => {
    const dir = await open(page, dialogs)
    await menu(app, 'view-shooting')
    await scene(page, 'RUA').click()
    await addTo(page, 'Efeitos especiais', 'Chuva')
    await page.getByRole('button', { name: 'Plano de filmagem' }).click()
    await page.getByRole('button', { name: 'Novo dia' }).click()
    await page.getByLabel('Dia da cena 2', { exact: true }).selectOption({ label: 'Dia 1' })
    await page.getByLabel('Notas de Dia 1').fill('Chuva artificial às 18h')
    const f = join(dir, 'producao.rottera')
    await dialogs.save(f)
    await page.locator('.toolbar button[aria-label="Salvar como…"]').click()
    await expect(page.locator('.status')).toContainText('Salvo')
    const saved = JSON.parse(readFileSync(f, 'utf8'))
    const rua = saved.script.blocks.find((b: { text: string }) => b.text === 'EXT. RUA - NOITE')
    expect(saved.script.production.items).toEqual([expect.objectContaining({ category: 'sfx', name: 'Chuva', scenes: [rua.nid] })])
    expect(saved.script.production.days[0].scenes).toEqual([rua.nid])

    await page.locator('.toolbar button', { hasText: /^Início$/ }).click()
    await dialogs.open(f)
    await page.getByRole('button', { name: 'Abrir…' }).click()
    await menu(app, 'view-shooting')
    await expect(scene(page, 'RUA')).toContainText('1 elemento')
    await page.getByRole('button', { name: 'Plano de filmagem' }).click()
    await expect(page.getByRole('region', { name: 'Dia 1' }).locator('.strip-n')).toHaveText(['2'])
    await expect(page.getByLabel('Notas de Dia 1')).toHaveValue('Chuva artificial às 18h')
  })

  test('F21-H4 frames and light maps follow their scene when scenes move, and the navigator leads to them', async ({ app, page, dialogs, userData }) => {
    await open(page, dialogs)
    expect((await rpc(userData, 'add_frame', { caption: 'Plano geral da rua', scene: '2' })).ok).toBe(true)
    expect((await rpc(userData, 'create_lightmap', { name: 'Rua molhada', scene: '2', width: 10, height: 8 })).ok).toBe(true)
    const nav = page.locator('.nav')
    const rua = nav.locator('li', { hasText: 'EXT. RUA - NOITE' })
    await expect(rua.locator('.scene-links')).toHaveText(/1 quadro\s*1 mapa de luz/)

    // scene 2 becomes scene 1: the frame and the map go with it
    await nav.locator('button[aria-label="Subir cena 2"]').click()
    await expect(nav.locator('.scene-text').first()).toHaveText('EXT. RUA - NOITE')
    const frames = await rpc(userData, 'get_storyboard')
    expect(JSON.stringify(frames.result)).toContain('"scene":"1"')

    await rua.getByRole('button', { name: /^Storyboard da cena 1/ }).click()
    await expect(page.locator('.seg button[aria-pressed="true"]')).toHaveText('Storyboard')
    await expect(page.getByLabel('Cena do quadro 1')).toHaveValue('1')

    // the breakdown shows them too
    await menu(app, 'view-shooting')
    await scene(page, 'RUA').click()
    await page.getByRole('button', { name: 'Mapa de luz: Rua molhada' }).click()
    await expect(page.locator('.seg button[aria-pressed="true"]')).toHaveText('Mapa de Luz')

    // picking another scene by hand moves the link
    await page.locator('.seg button', { hasText: /^Storyboard$/ }).click()
    await page.getByLabel('Cena do quadro 1').selectOption('3')
    await page.locator('.seg button', { hasText: /^Roteiro$/ }).click()
    await expect(nav.locator('li', { hasText: 'INT. CARRO - NOITE' }).locator('.scene-links')).toHaveText('1 quadro')
    await expect(rua.locator('.scene-links')).toHaveText('1 mapa de luz')
  })

  test('F21-H5 the plan is built one day per location, a day can be split in two, and scenes dragged between days', async ({ app, page, dialogs }) => {
    const dir = mkdtempSync(join(tmpdir(), 'rotera-f21-'))
    const f = join(dir, 'locais.fountain')
    const heads = ['INT. COZINHA - NOITE', 'EXT. RUA - DIA', 'INT. COZINHA - DIA', 'INT. CARRO - NOITE', 'EXT. RUA - NOITE', 'INT. COZINHA - DIA']
    writeFileSync(f, heads.map((h, i) => `${h}\n\nAção ${i + 1}.\n`).join('\n'), 'utf8')
    await dialogs.open(f)
    await page.getByRole('button', { name: 'Importar FDX ou Fountain…' }).click()
    await menu(app, 'view-shooting')
    await page.getByRole('button', { name: 'Plano de filmagem' }).click()
    await page.getByRole('button', { name: 'Montar por locação' }).click()
    await expect(page.locator('.plan-said')).toHaveText('6 cenas colocadas em 3 dias novos, um por locação.')
    await expect(page.getByRole('button', { name: 'Montar por locação' })).toBeDisabled()
    const day = (name: string) => page.getByRole('region', { name, exact: true })
    // day scenes before night scenes, then script order
    await expect(day('COZINHA').locator('.strip-n')).toHaveText(['3', '6', '1'])
    await expect(day('RUA').locator('.strip-n')).toHaveText(['2', '5'])
    await expect(day('CARRO').locator('.strip-n')).toHaveText(['4'])

    // the kitchen night scene gets its own day
    await page.getByRole('button', { name: 'Partir o dia antes da cena 1' }).click()
    await expect(day('COZINHA').locator('.strip-n')).toHaveText(['3', '6'])
    await expect(day('COZINHA · parte 2').locator('.strip-n')).toHaveText(['1'])
    await expect(page.getByRole('button', { name: 'Partir o dia antes da cena 3' })).toBeDisabled()

    // drag the car scene onto the kitchen night day: dropped on the day it goes last, dropped on a scene it goes before it
    await strip(page, '4').dragTo(day('COZINHA · parte 2'), { targetPosition: { x: 8, y: 8 } })
    await expect(day('COZINHA · parte 2').locator('.strip-n')).toHaveText(['1', '4'])
    await strip(page, '6').dragTo(strip(page, '1'))
    await expect(day('COZINHA · parte 2').locator('.strip-n')).toHaveText(['6', '1', '4'])
    await expect(day('CARRO')).toContainText('Nenhuma cena neste dia')
  })

  test('F21-H6 each scene on a day gets its shooting time, saved with the plan; INT. day strips have their own colour', async ({ app, page, dialogs }) => {
    const dir = await open(page, dialogs)
    await menu(app, 'view-shooting')
    await page.getByRole('button', { name: 'Plano de filmagem' }).click()
    await page.getByRole('button', { name: 'Novo dia' }).click()
    await page.getByLabel('Dia da cena 1', { exact: true }).selectOption({ label: 'Dia 1' })
    await page.getByLabel('Dia da cena 2', { exact: true }).selectOption({ label: 'Dia 1' })
    // no time field for scenes with no day
    await expect(page.getByLabel('Horário da cena 3')).toHaveCount(0)
    await page.getByLabel('Horário da cena 1').fill('08:30')
    await page.getByLabel('Horário da cena 2').fill('19:00')
    await expect(page.getByLabel('Horário da cena 1')).toHaveValue('08:30')

    // INT. day is no longer the colour of the page
    const colours = await page.evaluate(() => {
      const bg = (el: Element | null): string => (el ? getComputedStyle(el).backgroundColor : '')
      return { intDay: bg(document.querySelector('.strip[data-strip="int-day"]')), page: bg(document.querySelector('.plan-day')), extNight: bg(document.querySelector('.strip[data-strip="ext-night"]')) }
    })
    expect(colours.intDay).not.toBe(colours.page)
    expect(colours.intDay).not.toBe(colours.extNight)

    // the time stays when the scene moves inside the day, and goes when it leaves the day
    await page.getByRole('button', { name: 'Subir cena 2 no dia' }).click()
    await expect(page.getByLabel('Horário da cena 2')).toHaveValue('19:00')
    await page.getByLabel('Dia da cena 2', { exact: true }).selectOption({ label: 'Sem dia' })
    await page.getByLabel('Dia da cena 2', { exact: true }).selectOption({ label: 'Dia 1' })
    await expect(page.getByLabel('Horário da cena 2')).toHaveValue('')

    const f = join(dir, 'horarios.rottera')
    await dialogs.save(f)
    await page.locator('.toolbar button[aria-label="Salvar como…"]').click()
    await expect(page.locator('.status')).toContainText('Salvo')
    const saved = JSON.parse(readFileSync(f, 'utf8'))
    const cozinha = saved.script.blocks.find((b: { text: string }) => b.text === 'INT. COZINHA - DIA')
    expect(saved.script.production.days[0].times).toEqual({ [cozinha.nid]: '08:30' })

    // the call sheet has the time
    await page.locator('.seg button', { hasText: /^Relatórios$/ }).click()
    await page.locator('.reports nav button', { hasText: 'Plano de filmagem' }).click()
    await expect(page.locator('.report-body thead')).toContainText('Horário')
    await expect(page.locator('.report-body tbody tr').first()).toContainText('08:30')
  })

  test('F21-E1 a pasted copy of a scene heading is a new scene for the breakdown', async ({ app, page, dialogs }) => {
    await open(page, dialogs)
    await menu(app, 'view-shooting')
    await scene(page, 'COZINHA').click()
    await addTo(page, 'Objetos de cena', 'Bule')
    await page.locator('.seg button', { hasText: /^Roteiro$/ }).click()
    const heading = page.locator('.sheet-content > p', { hasText: 'INT. COZINHA - DIA' })
    await heading.click()
    await page.keyboard.press('Home')
    await page.keyboard.press('Shift+End')
    await page.keyboard.press('Control+c')
    await page.locator('.sheet-content > p').last().click()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Control+v')
    await expect(page.locator('.sheet-content > p', { hasText: 'INT. COZINHA - DIA' })).toHaveCount(2)
    await menu(app, 'view-shooting')
    await expect(page.locator('.prod-scenes button', { hasText: '1 elemento' })).toHaveCount(1)
  })

  test('F21-A1 the Filmagem screens have no serious accessibility violations, light and dark', async ({ app, page, dialogs }) => {
    await open(page, dialogs)
    await menu(app, 'view-shooting')
    await addTo(page, 'Objetos de cena', 'Bule')
    const found: string[] = []
    for (const theme of ['light', 'night', 'midnight'] as const) {
      await setTheme(app, page, theme)
      await page.getByRole('button', { name: 'Decupagem', exact: true }).click()
      for (const v of await axeViolations(page)) found.push(`${theme}/decupagem: ${v}`)
      await page.getByRole('button', { name: 'Plano de filmagem' }).click()
      if ((await page.locator('.plan-day').count()) === 0) {
        await page.getByRole('button', { name: 'Novo dia' }).click()
        await page.getByLabel('Dia da cena 2', { exact: true }).selectOption({ label: 'Dia 1' })
      }
      for (const v of await axeViolations(page)) found.push(`${theme}/plano: ${v}`)
    }
    expect(found).toEqual([])
  })
})
