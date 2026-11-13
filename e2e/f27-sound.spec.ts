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

DAVI
Eu disse que vinha.

EXT. RUA - NOITE

Chove sem parar.
`

async function open(page: Page, dialogs: Dialogs): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'rottera-f27-'))
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

/** Saves the script as a new file and reads it back. */
async function saveAs(app: ElectronApplication, page: Page, dialogs: Dialogs, file: string): Promise<any> {
  await dialogs.save(file)
  await menu(app, 'save-as')
  await expect(page.locator('.status')).toContainText('Salvo')
  return JSON.parse(readFileSync(file, 'utf8')).script
}

test.describe('F27 the Som window', () => {
  test('F27-H1 the sound plan shows the light map faint and takes microphones on top, without changing the light map', async ({ app, page, dialogs, userData }) => {
    const dir = await open(page, dialogs)
    expect((await rpc(userData, 'create_lightmap', { name: 'Cozinha', scene: '1', width: 6, height: 4 })).ok).toBe(true)
    expect((await rpc(userData, 'add_light_item', { map: 'Cozinha', type: 'actor', x: 2, y: 3, label: 'Luísa' })).ok).toBe(true)
    const before = await saveAs(app, page, dialogs, join(dir, 'antes.rottera'))

    await menu(app, 'view-sound') // Ctrl+Alt+7
    await expect(page.getByRole('group', { name: 'Som' })).toBeVisible()
    await page.locator('.snd-plans button', { hasText: 'Cozinha' }).click()
    // the light map below, faint and out of reach
    await expect(page.locator('.snd-surface svg g[opacity="0.35"]')).toHaveCount(1)

    await page.getByRole('button', { name: 'Pôr Shotgun' }).click()
    const line = page.getByLabel('Escrever o microfone')
    await line.fill('shotgun canal 1 a 2,1 m')
    await line.press('Enter')
    await expect(page.getByLabel('Canal', { exact: true })).toHaveValue('1')
    await expect(page.getByLabel('Altura (m)')).toHaveValue('2.1')

    await page.getByRole('button', { name: 'Pôr Lapela' }).click()
    await page.getByLabel('Preso em').selectOption({ label: 'Luísa' })
    await expect(page.locator('.snd-surface [data-mic]')).toHaveCount(2)

    const after = await saveAs(app, page, dialogs, join(dir, 'depois.rottera'))
    expect(after.lightMaps).toEqual(before.lightMaps)
    expect(after.sound.plans).toHaveLength(1)
    expect(after.sound.plans[0].mics.map((m: { type: string }) => m.type)).toEqual(['shotgun', 'lavalier'])
    expect(after.sound.plans[0].mics[0].channel).toBe(1)
  })

  test('F27-H2 the sound sheet belongs to the scene and follows it when the scene moves', async ({ app, page, dialogs }) => {
    await open(page, dialogs)
    const sheets = async (): Promise<void> => {
      await menu(app, 'view-sound')
      await page.getByRole('group', { name: 'Som' }).getByRole('button', { name: 'Ficha por cena' }).click()
    }
    const list = page.getByRole('navigation', { name: 'Cenas da ficha de som' })
    await sheets()
    await list.getByRole('button', { name: /COZINHA/ }).click()
    await page.getByRole('radio', { name: 'Som direto' }).check()
    await page.getByRole('checkbox', { name: 'Trânsito' }).check()
    await page.getByLabel('Microfone de MARINA').selectOption('lapela')
    await expect(list.getByRole('button', { name: /COZINHA/ })).toContainText('ficha')
    await expect(list.getByRole('button', { name: /RUA/ })).not.toContainText('ficha')

    await menu(app, 'view-script')
    const nav = page.getByRole('complementary', { name: 'Navegador de cenas' })
    await nav.getByRole('button', { name: 'Descer cena 1' }).click()
    await expect(nav.locator('.scene-text').first()).toHaveText('EXT. RUA - NOITE')

    await sheets()
    await list.getByRole('button', { name: /COZINHA/ }).click()
    await expect(page.getByRole('heading', { name: /COZINHA/ })).toBeVisible()
    await expect(page.getByRole('radio', { name: 'Som direto' })).toBeChecked()
    await expect(page.getByRole('checkbox', { name: 'Trânsito' })).toBeChecked()
    await expect(page.getByLabel('Microfone de MARINA')).toHaveValue('lapela')
    await list.getByRole('button', { name: /RUA/ }).click()
    await expect(page.getByRole('radio', { name: 'Som direto' })).not.toBeChecked()
  })

  test('F27-H3 the sound equipment lists the microphones of the plans, takes items by hand and exports a CSV', async ({ app, page, dialogs, userData }) => {
    const dir = await open(page, dialogs)
    expect((await rpc(userData, 'create_lightmap', { name: 'Cozinha', scene: '1', width: 6, height: 4 })).ok).toBe(true)
    await menu(app, 'view-sound')
    await page.locator('.snd-plans button', { hasText: 'Cozinha' }).click()
    await page.getByRole('button', { name: 'Pôr Shotgun' }).click()
    await page.getByLabel('Modelo').fill('MKH 416')

    await page.getByRole('group', { name: 'Som' }).getByRole('button', { name: 'Equipamento' }).click()
    const row = page.locator('tr', { hasText: 'Shotgun · MKH 416' })
    await expect(row).toContainText('da planta')
    await expect(row.locator('.eq-qty')).toHaveText('1')
    await page.getByLabel('Shotgun · MKH 416 retirado').check()
    await page.getByRole('button', { name: '+ Item' }).click()
    await page.getByLabel('Nome do item 1').fill('Fone')

    const csv = join(dir, 'equipamento.csv')
    await dialogs.save(csv)
    await page.getByRole('button', { name: 'Exportar CSV' }).click()
    await expect.poll(() => { try { return readFileSync(csv, 'utf8') } catch { return '' } }).toContain('Fone')
    const text = readFileSync(csv, 'utf8')
    expect(text).toContain('Shotgun · MKH 416;1;—;Sim;Não;—')
    expect(text).toContain('Fone;1;—;Não;Não;—')
  })

  test('F27-H4 the day sheet carries the sound line of its scene', async ({ app, page, dialogs, userData }) => {
    await open(page, dialogs)
    expect((await rpc(userData, 'create_lightmap', { name: 'Cozinha', scene: '1', width: 6, height: 4 })).ok).toBe(true)
    await menu(app, 'view-sound')
    await page.locator('.snd-plans button', { hasText: 'Cozinha' }).click()
    await page.getByRole('button', { name: 'Pôr Shotgun' }).click()
    await page.getByLabel('Escrever o microfone').fill('canal 1')
    await page.getByLabel('Escrever o microfone').press('Enter')
    await expect(page.getByLabel('Canal', { exact: true })).toHaveValue('1')
    await page.getByRole('group', { name: 'Som' }).getByRole('button', { name: 'Ficha por cena' }).click()
    await page.getByRole('navigation', { name: 'Cenas da ficha de som' }).getByRole('button', { name: /COZINHA/ }).click()
    await page.getByRole('radio', { name: 'Som direto' }).check()

    // what the day sheet sends to the printer is kept instead of opening a save dialog
    await app.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('file:exportReportPdf')
      ipcMain.handle('file:exportReportPdf', (_e, req) => {
        ;(globalThis as unknown as { lastReport: unknown }).lastReport = req
        return null
      })
    })
    await menu(app, 'view-shooting')
    await page.getByRole('button', { name: 'Plano de filmagem' }).click()
    await page.getByRole('button', { name: 'Novo dia' }).click()
    await page.getByLabel('Dia da cena 1', { exact: true }).selectOption({ label: 'Dia 1' })
    await page.getByRole('button', { name: 'Ordem do dia (PDF)' }).click()
    const sent = async (): Promise<any> => app.evaluate(() => (globalThis as unknown as { lastReport?: unknown }).lastReport ?? null)
    await expect.poll(sent).not.toBeNull()
    const req = await sent()
    expect(req.callsheet.scenes[0].sound).toBe('Som direto · Mic 1 (Shotgun, canal 1)')
  })

  test('F27-E1 deleting the light map keeps the sound plan and its microphones', async ({ app, page, dialogs, userData }) => {
    await open(page, dialogs)
    expect((await rpc(userData, 'create_lightmap', { name: 'Cozinha', scene: '1', width: 6, height: 4 })).ok).toBe(true)
    await menu(app, 'view-sound')
    await page.locator('.snd-plans button', { hasText: 'Cozinha' }).click()
    await page.getByRole('button', { name: 'Pôr Shotgun' }).click()
    await page.getByRole('button', { name: 'Pôr Omnidirecional' }).click()

    await menu(app, 'view-lightmap')
    await page.locator('.lm-side').getByRole('button', { name: 'Apagar', exact: true }).click()
    await menu(app, 'view-sound')
    const loose = page.locator('.snd-plans button', { hasText: 'COZINHA' })
    await expect(loose).toContainText('planta de som')
    await loose.click()
    await expect(page.locator('.snd-surface [data-mic]')).toHaveCount(2)
    // with no light map, nothing faint below
    await expect(page.locator('.snd-surface svg g[opacity="0.35"]')).toHaveCount(0)
  })

  test('F27-E2 a sound plan left with no light map and no scene is still listed and can be deleted', async ({ app, page, dialogs, userData }) => {
    const dir = await open(page, dialogs)
    expect((await rpc(userData, 'create_lightmap', { name: 'Ensaio', width: 6, height: 4 })).ok).toBe(true)
    await menu(app, 'view-sound')
    await page.locator('.snd-plans button', { hasText: 'Ensaio' }).click()
    await page.getByRole('button', { name: 'Pôr Shotgun' }).click()
    await menu(app, 'view-lightmap')
    await page.locator('.lm-side').getByRole('button', { name: 'Apagar', exact: true }).click()

    await menu(app, 'view-sound')
    const orphan = page.locator('.snd-plans button', { hasText: 'Planta sem cena' })
    await expect(orphan).toContainText('1 microfone')
    await orphan.click()
    await expect(page.locator('.snd-surface [data-mic]')).toHaveCount(1)
    page.once('dialog', (d) => void d.accept())
    await page.getByRole('button', { name: 'Apagar planta de som' }).click()
    await expect(orphan).toHaveCount(0)
    const saved = await saveAs(app, page, dialogs, join(dir, 'sem-orfa.rottera'))
    expect(saved.sound.plans).toEqual([])
  })

  test('F27-A1 the four tabs of the Som window have no serious accessibility violations, light and dark', async ({ app, page, dialogs, userData }) => {
    await open(page, dialogs)
    expect((await rpc(userData, 'create_lightmap', { name: 'Cozinha', scene: '1', width: 6, height: 4 })).ok).toBe(true)
    await menu(app, 'view-sound')
    await page.locator('.snd-plans button', { hasText: 'Cozinha' }).click()
    await page.getByRole('button', { name: 'Pôr Lapela' }).click()
    const tabs = page.getByRole('group', { name: 'Som' })
    await tabs.getByRole('button', { name: 'Ambientes e músicas' }).click()
    await page.getByRole('button', { name: '+ Ambiente em COZINHA' }).click()
    await page.getByRole('button', { name: '+ Música' }).click()
    await tabs.getByRole('button', { name: 'Equipamento' }).click()
    await page.getByRole('button', { name: '+ Item' }).click()
    const found: string[] = []
    for (const theme of ['light', 'night'] as const) {
      await setTheme(app, page, theme)
      for (const [tab, label] of [['Planta', 'planta'], ['Ficha por cena', 'ficha'], ['Ambientes e músicas', 'ambientes'], ['Equipamento', 'equipamento']]) {
        await tabs.getByRole('button', { name: tab }).click()
        if (tab === 'Planta') await page.locator('.snd-plans button', { hasText: 'Cozinha' }).click()
        for (const v of await axeViolations(page)) found.push(`${theme}/${label}: ${v}`)
      }
    }
    expect(found).toEqual([])
  })
})
