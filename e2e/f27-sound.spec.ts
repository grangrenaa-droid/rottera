import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ElectronApplication, Page } from '@playwright/test'
import { bridgeInfo, expect, menu, test, type Dialogs } from './fixtures'

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
})
