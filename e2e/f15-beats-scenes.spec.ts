import { writeFileSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { axeViolations, bridgeInfo, expect, newScript, rows, test } from './fixtures'

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

const headings = async (page: import('@playwright/test').Page): Promise<string[]> =>
  (await rows(page)).filter((r) => r.kind === 'scene_heading').map((r) => r.text)

test.describe('F15 board beats and script scenes stay linked', () => {
  test('F15-H1 making a scene twice is not possible: the card shows its scene and jumps to it', async ({ page }) => {
    await newScript(page)
    await page.getByRole('button', { name: 'Beat Board' }).click()
    await page.getByRole('button', { name: 'Aplicar estrutura' }).click()
    const first = page.locator('.lane').first().locator('.beat').first()
    await first.getByRole('button', { name: 'Virar cena' }).click()
    await page.getByRole('button', { name: 'Beat Board' }).click()
    // the card now points to the scene instead of offering to make another one
    await expect(first.getByRole('button', { name: 'Virar cena' })).toHaveCount(0)
    const goTo = first.getByRole('button', { name: /^Ir para a cena 1/ })
    await expect(goTo).toBeVisible()
    await goTo.click()
    await expect(page.getByRole('textbox', { name: 'Texto do roteiro' })).toBeVisible()
    expect((await headings(page)).length).toBe(1)
  })

  test('F15-H2 create scenes for all beats, once: pressing it again adds nothing', async ({ page }) => {
    await newScript(page)
    await page.getByRole('button', { name: 'Beat Board' }).click()
    await page.getByRole('button', { name: 'Aplicar estrutura' }).click()
    const total = await page.locator('.beat').count()
    expect(total).toBeGreaterThan(3)
    const all = page.getByRole('button', { name: new RegExp(`^Criar cenas para ${total} beats`) })
    await all.click()
    await page.getByRole('button', { name: 'Roteiro', exact: true }).click()
    expect((await headings(page)).length).toBe(total)
    await page.getByRole('button', { name: 'Beat Board' }).click()
    await expect(page.getByRole('button', { name: 'Todos os beats já têm cena' })).toBeDisabled()
  })

  test('F15-E1 a beat added later gets its scene next to the scene of the beat before it, and edits are kept', async ({ page, userData }) => {
    await newScript(page)
    await page.getByRole('button', { name: 'Beat Board' }).click()
    await page.getByRole('button', { name: 'Aplicar estrutura' }).click()
    await page.getByRole('button', { name: /^Criar cenas para/ }).click()
    await page.getByRole('button', { name: 'Roteiro', exact: true }).click()
    const before = await headings(page)
    // the writer rewrites the first scene
    const editor = page.getByRole('textbox', { name: 'Texto do roteiro' })
    await editor.click()
    await page.keyboard.press('Control+Home')
    await page.keyboard.press('End')
    await page.keyboard.type(' (REESCRITA)')
    // a new beat appears in the first column
    const board = (await rpc(userData, 'get_beats')).result
    const lane = board.lanes[0].name
    await rpc(userData, 'add_beat', { lane, title: 'Beat novo', body: 'cai na primeira coluna' })
    const sent = await rpc(userData, 'send_beats')
    expect(sent.ok).toBe(true)
    expect(sent.result.created).toBe(1)
    const after = await headings(page)
    expect(after.length).toBe(before.length + 1)
    expect(after[0]).toContain('(REESCRITA)')
    // placed inside the first column group, not at the very end
    const texts = (await rows(page)).map((r) => r.text)
    expect(texts.indexOf('Beat novo: cai na primeira coluna')).toBeLessThan(texts.length - 3)
    const again = await rpc(userData, 'send_beats')
    expect(again.result.created).toBe(0)
  })

  test('F15-E2 deleting the scene frees the beat to be made again', async ({ page, userData }) => {
    await newScript(page)
    const add = await rpc(userData, 'add_beat', { lane: 'Ato 1', title: 'Solitário', body: 'único' })
    expect(add.ok).toBe(true)
    expect((await rpc(userData, 'send_beats')).result.created).toBe(1)
    const status = (await rpc(userData, 'status')).result
    await rpc(userData, 'delete_blocks', { start: 0, end: status.blockCount })
    const got = (await rpc(userData, 'get_beats')).result
    expect(got.beats[0].scene).toBeNull()
    expect((await rpc(userData, 'send_beats')).result.created).toBe(1)
  })

  test('F15-E3 the link survives save and reopen, and shows the live scene number', async ({ page, dialogs, userData }) => {
    await newScript(page)
    await rpc(userData, 'add_beat', { lane: 'A', title: 'Um', body: '' })
    await rpc(userData, 'add_beat', { lane: 'A', title: 'Dois', body: '' })
    await rpc(userData, 'send_beats')
    const dir = mkdtempSync(join(tmpdir(), 'rotera-f15-'))
    const file = join(dir, 'ligado.rotera')
    await dialogs.save(file)
    await page.getByRole('button', { name: 'Salvar como…' }).click()
    await expect(page.locator('.status')).toContainText('Salvo')
    const saved = JSON.parse(readFileSync(file, 'utf8'))
    expect(saved.script.blocks.filter((b: any) => b.bid).length).toBe(2)
    await page.getByRole('button', { name: 'Início' }).click()
    await dialogs.open(file)
    await page.getByRole('button', { name: 'Abrir…' }).click()
    await expect(page.getByRole('textbox', { name: 'Texto do roteiro' })).toBeVisible()
    const got = (await rpc(userData, 'get_beats')).result
    expect(got.beats.map((b: any) => b.scene)).toEqual([1, 2])
    // move the second scene up: the card follows
    await rpc(userData, 'move_scene', { scene: 2, to: 1 })
    const moved = (await rpc(userData, 'get_beats')).result
    expect(moved.beats.map((b: any) => b.scene)).toEqual([2, 1])
  })

  test('F15-N1 unknown beat id is refused; the board screen is accessible', async ({ page, userData }) => {
    await newScript(page)
    await rpc(userData, 'add_beat', { lane: 'A', title: 'Um', body: '' })
    const bad = await rpc(userData, 'send_beats', { beats: ['nao-existe'] })
    expect(bad.ok).toBe(false)
    const notList = await rpc(userData, 'send_beats', { beats: 'x' })
    expect(notList.ok).toBe(false)
    await page.getByRole('button', { name: 'Beat Board' }).click()
    expect(await axeViolations(page)).toEqual([])
    void writeFileSync
  })
})
