import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { bridgeInfo, expect, menu, test } from './fixtures'

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

test.describe('F30 light and shadow on the light map (Etapa 1)', () => {
  test('F30-H2 a door lets the light through, a window lets it through softened (Etapa 2)', async ({ app, page, dialogs, userData }) => {
    const dir = mkdtempSync(join(tmpdir(), 'rottera-f30-'))
    const f = join(dir, 'in.fountain')
    writeFileSync(f, 'INT. SALA - DIA\n\nLuz.\n', 'utf8')
    await dialogs.open(f)
    await page.getByRole('button', { name: 'Importar FDX ou Fountain…' }).click()
    await expect(page.getByRole('textbox', { name: 'Texto do roteiro' })).toBeVisible()
    expect((await rpc(userData, 'create_lightmap', { name: 'Sala', scene: '1', width: 8, height: 6 })).ok).toBe(true)
    const add = async (p: Record<string, unknown>): Promise<void> => {
      expect((await rpc(userData, 'add_light_item', { map: 'Sala', ...p })).ok).toBe(true)
    }
    await add({ type: 'wall', x: 4, y: 2, rotation: 0, length: 6 })
    await add({ type: 'door', x: 2.2, y: 2, length: 1 })
    await add({ type: 'window', x: 5.5, y: 2, length: 1.4 })
    await add({ type: 'sun', x: 6.5, y: 0.3 })
    await add({ type: 'fresnel', x: 5.5, y: 4.5, rotation: 0, range: 4 })
    await menu(app, 'view-lightmap')
    await page.getByLabel('Luz e sombra').check()
    const surface = page.locator('.lm-surface')
    await expect(surface.locator('[data-sun-window]')).toHaveCount(1)
    await expect(surface.locator('[data-soft]')).toHaveCount(1)
    await surface.screenshot({ path: 'test-results/f30-porta-janela.png' })
  })

  test('F30-H1 with "Luz e sombra" on, walls stop the light and the sun lights the map with shadows', async ({ app, page, dialogs, userData }) => {
    const dir = mkdtempSync(join(tmpdir(), 'rottera-f30-'))
    const f = join(dir, 'in.fountain')
    writeFileSync(f, 'INT. SALA - DIA\n\nLuz.\n', 'utf8')
    await dialogs.open(f)
    await page.getByRole('button', { name: 'Importar FDX ou Fountain…' }).click()
    await expect(page.getByRole('textbox', { name: 'Texto do roteiro' })).toBeVisible()
    expect((await rpc(userData, 'create_lightmap', { name: 'Sala', scene: '1', width: 8, height: 6 })).ok).toBe(true)
    const add = async (p: Record<string, unknown>): Promise<void> => {
      expect((await rpc(userData, 'add_light_item', { map: 'Sala', ...p })).ok).toBe(true)
    }
    await add({ type: 'wall', x: 4, y: 2.2, rotation: 0, length: 3 })
    await add({ type: 'wall', x: 6.5, y: 4, rotation: 90, length: 2 })
    await add({ type: 'fresnel', x: 4, y: 4.6, rotation: 0, range: 4 })
    await add({ type: 'led', x: 1.4, y: 4.6, rotation: 45, range: 4 })
    await add({ type: 'sun', x: 0.6, y: 0.6, rotation: 145 })
    await menu(app, 'view-lightmap')

    const surface = page.locator('.lm-surface')
    await expect(surface.locator('[data-lit]')).toHaveCount(0)
    await page.getByLabel('Luz e sombra').check()
    await expect(surface.locator('[data-lit]')).toHaveCount(2)
    await expect(surface.locator('[data-sun]')).toHaveCount(1)
    await surface.screenshot({ path: 'test-results/f30-luz-e-sombra.png' })

    const file = join(dir, 'sombra.rottera')
    await dialogs.save(file)
    await menu(app, 'save-as')
    await expect(page.locator('.status')).toContainText('Salvo')
    expect(JSON.parse(readFileSync(file, 'utf8')).script.lightMaps[0].shadows).toBe(true)

    await page.getByLabel('Luz e sombra').uncheck()
    await expect(surface.locator('[data-lit]')).toHaveCount(0)
  })
})
