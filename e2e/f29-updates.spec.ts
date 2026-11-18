import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ElectronApplication, Page } from '@playwright/test'
import { expect, menu, test, type Dialogs } from './fixtures'

test.afterEach(({ errors }) => {
  expect(errors, 'console or page errors').toEqual([])
})

const FOUNTAIN = `INT. COZINHA - DIA

Marina coa o café.

MARINA
Você veio.

EXT. RUA - NOITE

Chove sem parar.
`

async function open(page: Page, dialogs: Dialogs): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'rottera-f29-'))
  const f = join(dir, 'in.fountain')
  writeFileSync(f, FOUNTAIN, 'utf8')
  await dialogs.open(f)
  await page.getByRole('button', { name: 'Importar FDX ou Fountain…' }).click()
  await expect(page.getByRole('textbox', { name: 'Texto do roteiro' })).toBeVisible()
  return dir
}

async function saveAs(app: ElectronApplication, page: Page, dialogs: Dialogs, file: string): Promise<any> {
  await dialogs.save(file)
  await menu(app, 'save-as')
  await expect(page.locator('.status')).toContainText('Salvo')
  return JSON.parse(readFileSync(file, 'utf8')).script
}

/** What the next report PDF would print is kept in the main process instead of opening a save dialog. */
async function catchReports(app: ElectronApplication): Promise<() => Promise<any>> {
  await app.evaluate(({ ipcMain }) => {
    ipcMain.removeHandler('file:exportReportPdf')
    ipcMain.handle('file:exportReportPdf', (_e, req) => {
      ;(globalThis as unknown as { lastReport: unknown }).lastReport = req
      return null
    })
  })
  return async () => app.evaluate(() => (globalThis as unknown as { lastReport?: unknown }).lastReport ?? null)
}

const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

/** Clicks the middle of a word inside the script text (not the line's start). */
async function clickWord(page: Page, kind: string, word: string): Promise<void> {
  const box = await page.evaluate(
    ([k, w]) => {
      const el = [...document.querySelectorAll(`.sheet-content [data-kind="${k}"]`)].find((e) => e.textContent?.includes(w))
      const node = el?.firstChild
      if (!node || !node.textContent) return null
      const at = node.textContent.indexOf(w)
      const r = document.createRange()
      r.setStart(node, at)
      r.setEnd(node, at + w.length)
      const b = r.getBoundingClientRect()
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
    },
    [kind, word]
  )
  if (!box) throw new Error(`no ${word} in a ${kind} line`)
  await page.mouse.click(box.x, box.y)
}

test.describe('F29 updates of 17/11', () => {
  test('F29-H6 a location has a sheet with scouting photos, and a click on it in a heading opens it beside the script', async ({ app, page, dialogs }) => {
    const dir = await open(page, dialogs)
    const photo = join(dir, 'scouting.png')
    writeFileSync(photo, PNG_1PX)
    await menu(app, 'view-shooting')
    await page.getByRole('group', { name: 'Filmagem' }).getByRole('button', { name: 'Locações' }).click()
    const list = page.getByRole('navigation', { name: 'Locações do roteiro' })
    await expect(list.getByRole('button')).toHaveCount(2)
    await list.getByRole('button', { name: /COZINHA/ }).click()
    const sheet = page.getByRole('region', { name: 'Ficha da locação COZINHA' })
    await sheet.getByLabel('Endereço').fill('Rua das Flores, 12')
    await sheet.getByRole('radio', { name: 'Autorizada' }).check()
    await sheet.getByLabel('Escolher fotos de COZINHA').setInputFiles(photo)
    await expect(sheet.getByRole('img', { name: 'Foto 1 de COZINHA' })).toBeVisible()
    await expect(list.getByRole('button', { name: /COZINHA/ })).toContainText('Autorizada')

    // in the script: a click on the location of the heading opens its sheet in the side panel
    await menu(app, 'view-script')
    await clickWord(page, 'scene_heading', 'COZINHA')
    const side = page.getByRole('region', { name: 'Ficha da locação COZINHA' })
    await expect(side).toBeVisible()
    await expect(side.getByLabel('Endereço')).toHaveValue('Rua das Flores, 12')
    // a click on the time of day is not the location
    await page.getByRole('group', { name: 'Painel lateral' }).getByRole('button', { name: 'Notas' }).click()
    await clickWord(page, 'scene_heading', 'NOITE')
    await expect(page.getByRole('region', { name: /Ficha da locação/ })).toHaveCount(0)

    const saved = await saveAs(app, page, dialogs, join(dir, 'locacao.rottera'))
    expect(saved.locations.COZINHA).toMatchObject({ address: 'Rua das Flores, 12', permit: 'granted' })
    expect(saved.locations.COZINHA.photos).toHaveLength(1)
  })

  test('F29-H5 clicking a character name opens the sheet in the side panel; a name in the action does not', async ({ app, page, dialogs }) => {
    await open(page, dialogs)
    const panel = page.getByRole('region', { name: 'Ficha do personagem' })
    // the name inside an action line is not a link
    await page.locator('.sheet-content [data-kind="action"]', { hasText: 'Marina coa' }).click()
    await expect(panel).toHaveCount(0)
    await page.locator('.sheet-content [data-kind="character"]', { hasText: 'MARINA' }).click()
    await expect(panel).toBeVisible()
    await expect(panel.getByLabel('Personagem', { exact: true })).toHaveValue('MARINA')
    // the click leaves the caret in the script: typing goes on in the text
    await expect(page.getByRole('textbox', { name: 'Texto do roteiro' })).toBeFocused()
    await panel.getByLabel('Idade', { exact: true }).fill('34')

    // the same sheet in Relatórios
    await menu(app, 'view-reports')
    await page.getByRole('button', { name: 'Fichas de personagem' }).click()
    await expect(page.locator('#cf-age')).toHaveValue('34')

    // the notes are one tab away
    await menu(app, 'view-script')
    await page.getByRole('group', { name: 'Painel lateral' }).getByRole('button', { name: 'Notas' }).click()
    await expect(page.getByRole('complementary', { name: 'Notas' })).toBeVisible()
  })

  test('F29-H4 a long storyboard caption grows instead of scrolling', async ({ app, page, dialogs }) => {
    await open(page, dialogs)
    await menu(app, 'view-storyboard')
    await page.getByRole('button', { name: 'Quadro vazio' }).click()
    const caption = page.locator('.sb-card textarea').first()
    await caption.fill(Array.from({ length: 8 }, (_, i) => `Linha ${i + 1} da legenda, com ação e som.`).join('\n'))
    const { scroll, client } = await caption.evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight }))
    expect(scroll, 'no scroll bar in the caption').toBeLessThanOrEqual(client + 1)
  })

  test('F29-H3 a light becomes RGB and its beam takes the chosen colour', async ({ app, page, dialogs }) => {
    const dir = await open(page, dialogs)
    await menu(app, 'view-lightmap')
    await page.getByRole('button', { name: 'Criar o primeiro mapa' }).click()
    await page.locator('.lm-piece', { hasText: 'Painel LED' }).first().click()
    await page.getByLabel('Luz RGB (cor escolhida)').check()
    await page.getByLabel('Cor da luz').fill('#00c060')
    await expect(page.locator('.lm-surface svg [fill="#00c060"]').first()).toBeAttached()
    const saved = await saveAs(app, page, dialogs, join(dir, 'rgb.rottera'))
    expect(saved.lightMaps[0].items[0].rgb).toBe('#00c060')
    await page.getByLabel('Luz RGB (cor escolhida)').uncheck()
    await expect(page.getByLabel('Cor da luz')).toHaveCount(0)
  })

  test('F29-H2 the light map has more furniture, each with its size', async ({ app, page, dialogs }) => {
    await open(page, dialogs)
    await menu(app, 'view-lightmap')
    await page.getByRole('button', { name: 'Criar o primeiro mapa' }).click()
    for (const name of ['Mesa redonda', 'Sofá', 'Poltrona', 'Cama', 'Armário', 'Bancada', 'Estante']) {
      await page.locator('.lm-piece', { hasText: name }).first().click()
      await expect(page.getByLabel('Comprimento (m)'), name).toBeVisible()
    }
    await expect(page.locator('#it-depth')).toBeVisible() // the shelf has a width
    await page.locator('.lm-piece', { hasText: 'Mesa redonda' }).first().click()
    await expect(page.locator('#it-depth')).toHaveCount(0) // a round table only has its diameter
    await expect(page.locator('.lm-surface [data-item]')).toHaveCount(8)
    await page.locator('.lm-surface').screenshot({ path: 'test-results/f29-moveis.png' })
  })

  test('F29-H1 a lunch break goes into the day sheet between the scenes, by its time', async ({ app, page, dialogs }) => {
    const dir = await open(page, dialogs)
    await menu(app, 'view-shooting')
    await page.getByRole('button', { name: 'Plano de filmagem' }).click()
    await page.getByRole('button', { name: 'Novo dia' }).click()
    for (const [n, t] of [['1', '09:00'], ['2', '14:00']]) {
      await page.getByLabel(`Dia da cena ${n}`, { exact: true }).selectOption({ label: 'Dia 1' })
      await page.getByLabel(`Horário da cena ${n}`).fill(t)
      await page.getByLabel(`Horário da cena ${n}`).press('Tab')
    }
    await page.getByRole('button', { name: '+ Pausa' }).click()
    await expect(page.getByLabel('Tipo da pausa 1 de Dia 1')).toHaveValue('lunch')
    await page.getByLabel('Horário da pausa 1 de Dia 1').fill('12:00')
    await page.getByLabel('Horário da pausa 1 de Dia 1').press('Tab')
    await page.getByLabel('Minutos da pausa 1 de Dia 1').fill('45')
    await page.getByLabel('Minutos da pausa 1 de Dia 1').press('Tab')

    const sent = await catchReports(app)
    await page.getByRole('button', { name: 'Ordem do dia (PDF)' }).click()
    await expect.poll(sent).not.toBeNull()
    expect((await sent()).callsheet.breaks).toEqual([{ time: '12:00', label: 'Almoço', length: '45 min' }])

    const saved = await saveAs(app, page, dialogs, join(dir, 'pausa.rottera'))
    expect(saved.production.days[0].breaks).toEqual([expect.objectContaining({ kind: 'lunch', time: '12:00', minutes: 45 })])
    await page.getByRole('button', { name: 'Tirar a pausa 1 de Dia 1' }).click()
    await expect(page.getByLabel('Tipo da pausa 1 de Dia 1')).toHaveCount(0)
  })
})
