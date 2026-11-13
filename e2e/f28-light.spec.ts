import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ElectronApplication, Page } from '@playwright/test'
import { axeViolations, bridgeInfo, expect, menu, setTheme, test, type Dialogs } from './fixtures'

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
  const dir = mkdtempSync(join(tmpdir(), 'rottera-f28-'))
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

async function saveAs(app: ElectronApplication, page: Page, dialogs: Dialogs, file: string): Promise<any> {
  await dialogs.save(file)
  await menu(app, 'save-as')
  await expect(page.locator('.status')).toContainText('Salvo')
  return JSON.parse(readFileSync(file, 'utf8')).script
}

const tab = (page: Page, name: string) => page.getByRole('group', { name: 'Luz' }).getByRole('button', { name, exact: true })

test.describe('F28 the Luz window', () => {
  test('F28-H1 Mapa de Luz is now Luz, with four tabs, and the plan is the light map as before', async ({ app, page, dialogs }) => {
    await open(page, dialogs)
    await page.locator('.toolbar').getByRole('button', { name: 'Luz', exact: true }).click()
    for (const t of ['Planta', 'Ficha por cena', 'Sol e horários', 'Equipamento']) await expect(tab(page, t)).toBeVisible()
    await expect(tab(page, 'Planta')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: 'Criar o primeiro mapa' })).toBeVisible()
    await menu(app, 'view-script')
    await menu(app, 'view-lightmap') // Ctrl+Alt+5
    await expect(page.getByRole('group', { name: 'Luz' })).toBeVisible()
  })

  test('F28-H2 the light sheet belongs to the scene and follows it when the scene moves', async ({ app, page, dialogs }) => {
    const dir = await open(page, dialogs)
    const sheets = async (): Promise<void> => {
      await menu(app, 'view-lightmap')
      await tab(page, 'Ficha por cena').click()
    }
    const list = page.getByRole('navigation', { name: 'Cenas da ficha de luz' })
    await sheets()
    await list.getByRole('button', { name: /COZINHA/ }).click()
    await page.getByRole('radio', { name: 'Suave' }).check()
    await page.getByRole('checkbox', { name: 'Janela' }).check()
    await page.getByLabel('Montagem (min)').fill('40')
    await page.getByLabel('Montagem (min)').press('Tab')
    await expect(list.getByRole('button', { name: /COZINHA/ })).toContainText('ficha')

    await menu(app, 'view-script')
    const nav = page.getByRole('complementary', { name: 'Navegador de cenas' })
    await nav.getByRole('button', { name: 'Descer cena 1' }).click()
    await expect(nav.locator('.scene-text').first()).toHaveText('EXT. RUA - NOITE')

    await sheets()
    await list.getByRole('button', { name: /COZINHA/ }).click()
    await expect(page.getByRole('radio', { name: 'Suave' })).toBeChecked()
    await expect(page.getByRole('checkbox', { name: 'Janela' })).toBeChecked()
    await list.getByRole('button', { name: /RUA/ }).click()
    await expect(page.getByRole('radio', { name: 'Suave' })).not.toBeChecked()

    const saved = await saveAs(app, page, dialogs, join(dir, 'luz.rottera'))
    const sheet = Object.values(saved.lighting.sheets)[0] as { quality: string; sources: string[]; setupMinutes: number }
    expect(sheet).toMatchObject({ quality: 'soft', sources: ['Janela'], setupMinutes: 40 })
  })
  test('F28-H3 the sun of a shooting day, and a warning for a night exterior shot in daylight', async ({ app, page, dialogs }) => {
    await open(page, dialogs)
    await menu(app, 'view-shooting')
    await page.getByRole('button', { name: 'Plano de filmagem' }).click()
    await page.getByRole('button', { name: 'Novo dia' }).click()
    await page.getByLabel('Dia da cena 2', { exact: true }).selectOption({ label: 'Dia 1' })
    await page.getByLabel('Horário da cena 2').fill('14:00')
    await page.getByLabel('Horário da cena 2').press('Tab')

    await menu(app, 'view-lightmap')
    await tab(page, 'Sol e horários').click()
    await expect(page.getByText('Dê uma data ao dia.')).toBeVisible()
    await page.getByLabel('Data do Dia 1').fill('2026-06-21')
    await expect(page.getByText('Escolha o lugar do filme ou do dia.')).toBeVisible()
    await page.getByRole('group', { name: 'Lugar do filme' }).getByLabel('Cidade').fill('São Paulo - SP')
    const row = page.locator('.light-days tbody tr').first()
    await expect(row.locator('td').nth(3)).toHaveText(/^06:4\d$/)
    await expect(page.locator('.light-warnings li')).toHaveCount(1)
    await expect(page.locator('.light-warnings li')).toContainText('Cena de noite marcada às 14:00')

    // the PDF gets the days and the warnings
    await app.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('file:exportReportPdf')
      ipcMain.handle('file:exportReportPdf', (_e, req) => {
        ;(globalThis as unknown as { lastReport: unknown }).lastReport = req
        return null
      })
    })
    await page.getByRole('button', { name: 'Exportar PDF', exact: true }).last().click()
    const sent = async (): Promise<any> => app.evaluate(() => (globalThis as unknown as { lastReport?: unknown }).lastReport ?? null)
    await expect.poll(sent).not.toBeNull()
    const req = await sent()
    expect(req.landscape).toBe(true)
    expect(req.tables.map((t: { title: string }) => t.title)).toEqual(['Sol por dia', 'Avisos'])
    expect(req.tables[1].rows).toHaveLength(1)
  })

  test('F28-E1 coordinates pasted from a map link work, and a bad one is said so', async ({ app, page, dialogs }) => {
    await open(page, dialogs)
    await menu(app, 'view-lightmap')
    await tab(page, 'Sol e horários').click()
    const place = page.getByRole('group', { name: 'Lugar do filme' })
    const coords = place.getByLabel('Ou coordenadas / link do mapa')
    await coords.fill('Copacabana')
    await coords.press('Enter')
    await expect(place.getByRole('alert')).toBeVisible()
    await coords.fill('https://www.google.com/maps/place/x/@-22.9711,-43.1822,15z')
    await coords.press('Enter')
    await expect(place.getByRole('alert')).toHaveCount(0)
    await expect(place).toContainText('-22.971, -43.182')
  })
  test('F28-H4 the light equipment lists the lights of the maps and the load of the heaviest map', async ({ app, page, dialogs, userData }) => {
    await open(page, dialogs)
    expect((await rpc(userData, 'create_lightmap', { name: 'Cozinha', scene: '1', width: 6, height: 4 })).ok).toBe(true)
    for (const x of [1, 3]) expect((await rpc(userData, 'add_light_item', { map: 'Cozinha', type: 'fresnel', x, y: 1, watts: 2000 })).ok).toBe(true)
    await menu(app, 'view-lightmap')
    await tab(page, 'Equipamento').click()
    const row = page.locator('tr', { hasText: 'Fresnel 2.000 W' })
    await expect(row).toContainText('da planta')
    await expect(row.locator('.eq-qty')).toHaveText('2')
    await expect(page.locator('.equipment-head')).toContainText('Carga do mapa mais pesado: 4.000 W')
    await page.getByLabel('Fresnel 2.000 W retirado').check()
  })

  test('F28-H5 the day sheet has the date and the sun of the day', async ({ app, page, dialogs }) => {
    await open(page, dialogs)
    await menu(app, 'view-shooting')
    await page.getByRole('button', { name: 'Plano de filmagem' }).click()
    await page.getByRole('button', { name: 'Novo dia' }).click()
    await page.getByLabel('Dia da cena 1', { exact: true }).selectOption({ label: 'Dia 1' })
    await menu(app, 'view-lightmap')
    await tab(page, 'Sol e horários').click()
    await page.getByLabel('Data do Dia 1').fill('2026-06-21')
    await page.getByRole('group', { name: 'Lugar do filme' }).getByLabel('Cidade').fill('São Paulo - SP')
    await expect(page.locator('.light-days tbody tr').first().locator('td').nth(3)).toHaveText(/^06:4\d$/)

    await app.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('file:exportReportPdf')
      ipcMain.handle('file:exportReportPdf', (_e, req) => {
        ;(globalThis as unknown as { lastReport: unknown }).lastReport = req
        return null
      })
    })
    await menu(app, 'view-shooting')
    await page.getByRole('button', { name: 'Plano de filmagem' }).click()
    await page.getByRole('button', { name: 'Ordem do dia (PDF)' }).click()
    const sent = async (): Promise<any> => app.evaluate(() => (globalThis as unknown as { lastReport?: unknown }).lastReport ?? null)
    await expect.poll(sent).not.toBeNull()
    const c = (await sent()).callsheet
    expect(c.date).toBe('Domingo, 21/06/2026')
    expect(c.sun).toMatch(/^nasce 06:4\d · golden hour \d\d:\d\d–\d\d:\d\d · se põe 17:\d\d$/)
  })

  test('F28-H6 a light gets its model above the caption, and the model goes into the equipment list', async ({ app, page, dialogs }) => {
    const dir = await open(page, dialogs)
    await menu(app, 'view-lightmap')
    await page.getByRole('button', { name: 'Criar o primeiro mapa' }).click()
    await page.locator('.lm-piece', { hasText: 'Fresnel' }).first().click()
    const model = page.getByLabel('Modelo', { exact: true })
    const caption = page.getByLabel('Legenda', { exact: true })
    const [m, c] = [await model.boundingBox(), await caption.boundingBox()]
    expect(m && c && m.y < c.y, 'Modelo above Legenda').toBe(true)
    await model.fill('Arri 1K')
    // an actor is not equipment: no model
    await page.locator('.lm-piece', { hasText: 'Ator ou atriz' }).click()
    await expect(page.getByLabel('Modelo', { exact: true })).toHaveCount(0)

    await tab(page, 'Equipamento').click()
    await expect(page.locator('tr', { hasText: 'Fresnel 1.000 W · Arri 1K' })).toContainText('da planta')
    const saved = await saveAs(app, page, dialogs, join(dir, 'modelo.rottera'))
    expect(saved.lightMaps[0].items.find((i: { type: string }) => i.type === 'fresnel').model).toBe('Arri 1K')
  })

  test('F28-L1 the short Som and Luz buttons on the toolbar are wide enough to hit', async ({ page, dialogs }) => {
    await open(page, dialogs)
    for (const name of ['Som', 'Luz']) {
      const box = await page.locator('.toolbar').getByRole('button', { name, exact: true }).boundingBox()
      expect(box?.width ?? 0, name).toBeGreaterThanOrEqual(64)
    }
  })

  test('F28-A1 the four tabs of the Luz window have no serious accessibility violations, light and dark', async ({ app, page, dialogs, userData }) => {
    await open(page, dialogs)
    expect((await rpc(userData, 'create_lightmap', { name: 'Cozinha', scene: '1', width: 6, height: 4 })).ok).toBe(true)
    expect((await rpc(userData, 'add_light_item', { map: 'Cozinha', type: 'fresnel', x: 1, y: 1 })).ok).toBe(true)
    await menu(app, 'view-shooting')
    await page.getByRole('button', { name: 'Plano de filmagem' }).click()
    await page.getByRole('button', { name: 'Novo dia' }).click()
    await menu(app, 'view-lightmap')
    await tab(page, 'Equipamento').click()
    await page.getByRole('button', { name: '+ Item' }).click()
    const found: string[] = []
    for (const theme of ['light', 'night'] as const) {
      await setTheme(app, page, theme)
      for (const t of ['Planta', 'Ficha por cena', 'Sol e horários', 'Equipamento']) {
        await tab(page, t).click()
        for (const v of await axeViolations(page)) found.push(`${theme}/${t}: ${v}`)
      }
    }
    expect(found).toEqual([])
  })
})
