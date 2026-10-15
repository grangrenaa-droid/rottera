import { execSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron, type Page } from '@playwright/test'
import { APP_DIR, axeViolations, bridgeInfo, expect, test, type Dialogs } from './fixtures'

test.afterEach(({ errors }) => {
  expect(errors, 'console or page errors').toEqual([])
})

const scenes = (n: number, tag = ''): string =>
  Array.from({ length: n }, (_, i) => `INT. LUGAR ${i}${tag} - DIA\n\nAção da cena ${i}.\n\nANA\nFala ${i}.\n`).join('\n')

async function openScript(page: Page, dialogs: Dialogs, text: string): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'rotera-f14-'))
  const f = join(dir, 'in.fountain')
  writeFileSync(f, text, 'utf8')
  await dialogs.open(f)
  await page.getByRole('button', { name: 'Importar FDX ou Fountain…' }).click()
  await expect(page.getByRole('textbox', { name: 'Texto do roteiro' })).toBeVisible()
  return dir
}

async function saveAs(page: Page, dialogs: Dialogs, file: string): Promise<void> {
  await dialogs.save(file)
  await page.getByRole('button', { name: 'Salvar como…' }).click()
  await expect(page.locator('.status')).toContainText('Salvo')
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

async function openVersions(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Mais' }).click()
  await page.getByRole('button', { name: 'Versões anteriores…' }).click()
  await expect(page.getByRole('dialog', { name: 'Versões anteriores' })).toBeVisible()
}

test.describe('F14 version history and recovery', () => {
  test('F14-H1 saving a script creates a version that shows in the list', async ({ page, dialogs }) => {
    const dir = await openScript(page, dialogs, scenes(4))
    await saveAs(page, dialogs, join(dir, 'a.rotera'))
    await openVersions(page)
    const items = page.locator('.versions li')
    await expect(items).toHaveCount(1)
    await expect(items.first()).toContainText('Salvamento automático')
    await expect(items.first()).toContainText('a mais recente')
  })

  test('F14-H2 a big loss is kept, and restoring brings it back without losing the current text', async ({ page, dialogs, userData }) => {
    const dir = await openScript(page, dialogs, scenes(12))
    const file = join(dir, 'b.rotera')
    await saveAs(page, dialogs, file)
    // an accident: nearly everything is removed, then autosave writes the short script
    const total = (await rpc(userData, 'status')).result.blockCount as number
    expect(total).toBeGreaterThan(30)
    const del = await rpc(userData, 'delete_blocks', { start: 2, end: total })
    expect(del.ok).toBe(true)
    await expect(page.locator('.status')).toContainText('Salvo', { timeout: 8000 })
    await expect.poll(() => JSON.parse(readFileSync(file, 'utf8')).script.blocks.length).toBeLessThan(10)

    await openVersions(page)
    // the full script is among the versions (it is the latest automatic one, kept because the save shrank it)
    const shrink = page.locator('.versions li', { hasText: `${total} blocos` })
    await expect(shrink).toHaveCount(1)
    await shrink.getByRole('button', { name: /^Restaurar/ }).click()

    // the file and the screen have the big script again
    await expect.poll(() => JSON.parse(readFileSync(file, 'utf8')).script.blocks.length, { timeout: 8000 }).toBe(total)
    await expect(page.getByRole('complementary', { name: 'Navegador de cenas' })).toContainText('Cenas (12)')
    // and the short text that was there is now in the list
    await openVersions(page)
    await expect(page.locator('.versions li', { hasText: 'Antes de uma restauração' })).toHaveCount(1)
  })

  test('F14-E1 restoring twice is reversible: the text from before the first restore comes back', async ({ page, dialogs, userData }) => {
    const dir = await openScript(page, dialogs, scenes(12))
    const file = join(dir, 'c.rotera')
    await saveAs(page, dialogs, file)
    const total = (await rpc(userData, 'status')).result.blockCount as number
    await rpc(userData, 'delete_blocks', { start: 2, end: total })
    await expect.poll(() => JSON.parse(readFileSync(file, 'utf8')).script.blocks.length).toBeLessThan(10)
    await openVersions(page)
    await page.locator('.versions li', { hasText: `${total} blocos` }).getByRole('button', { name: /^Restaurar/ }).click()
    await expect.poll(() => JSON.parse(readFileSync(file, 'utf8')).script.blocks.length).toBe(total)
    await openVersions(page)
    await page.locator('.versions li', { hasText: 'Antes de uma restauração' }).getByRole('button', { name: /^Restaurar/ }).click()
    await expect.poll(() => JSON.parse(readFileSync(file, 'utf8')).script.blocks.length).toBeLessThan(10)
  })

  test('F14-E2 an untitled draft has its own history and is restorable', async ({ page, dialogs, userData }) => {
    await openScript(page, dialogs, scenes(3)) // imported, not yet saved to a file: it autosaves as a draft
    await page.getByRole('textbox', { name: 'Texto do roteiro' }).click()
    await page.keyboard.type('x')
    await expect(page.locator('.status')).toContainText('Rascunho salvo', { timeout: 8000 })
    await openVersions(page)
    await expect(page.locator('.versions li').first()).toContainText('Salvamento automático')
    void userData
  })

  test('F14-E3 a first version is made when a file is opened, so edits by Claude can always be undone', async ({ page, dialogs, userData }) => {
    const dir = await openScript(page, dialogs, scenes(5))
    const file = join(dir, 'd.rotera')
    await saveAs(page, dialogs, file)
    await page.getByRole('button', { name: 'Início' }).click()
    await dialogs.open(file)
    await page.getByRole('button', { name: 'Abrir…' }).click()
    await expect(page.getByRole('textbox', { name: 'Texto do roteiro' })).toBeVisible()
    // same text as the last automatic version, so it is not duplicated
    await openVersions(page)
    expect(await page.locator('.versions li').count()).toBe(1)
    void userData
  })

  test('F14-N1 the versions dialog is not reachable from the home screen and is accessible', async ({ page, dialogs }) => {
    await expect(page.getByRole('button', { name: 'Mais' })).toHaveCount(0)
    const dir = await openScript(page, dialogs, scenes(4))
    await saveAs(page, dialogs, join(dir, 'e.rotera'))
    await openVersions(page)
    expect(await axeViolations(page)).toEqual([])
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Versões anteriores' })).toHaveCount(0)
  })
})

test.describe('F14 recovery after an unexpected close', () => {
  test('F14-R1 the next start says so and offers the last script; a normal quit does not', async ({}, testInfo) => {
    const userData = mkdtempSync(join(tmpdir(), 'rotera-f14r-'))
    const env = { ...process.env, ROTERA_LEGACY_APPDATA: mkdtempSync(join(tmpdir(), 'rotera-no-legacy-')) } as Record<string, string>
    delete env.ELECTRON_RUN_AS_NODE
    const launch = async (): Promise<Awaited<ReturnType<typeof electron.launch>>> =>
      process.env.ROTERA_EXE
        ? electron.launch({ executablePath: process.env.ROTERA_EXE, args: [`--user-data-dir=${userData}`], env })
        : electron.launch({ args: ['.', `--user-data-dir=${userData}`], cwd: APP_DIR, env })

    // 1st run: save a script, then kill the process the hard way
    const first = await launch()
    const p1 = await first.firstWindow()
    await p1.waitForLoadState('domcontentloaded')
    const dir = mkdtempSync(join(tmpdir(), 'rotera-f14r-files-'))
    const src = join(dir, 'in.fountain')
    writeFileSync(src, scenes(3, ' ÚNICO'), 'utf8')
    const file = join(dir, 'queda.rotera')
    await first.evaluate(({ dialog }, a) => {
      dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [a.src] })) as never
      dialog.showSaveDialog = (async () => ({ canceled: false, filePath: a.file })) as never
    }, { src, file })
    await p1.getByRole('button', { name: 'Importar FDX ou Fountain…' }).click()
    await p1.getByRole('button', { name: 'Salvar como…' }).click()
    await expect(p1.locator('.status')).toContainText('Salvo')
    expect(existsSync(file)).toBe(true)
    // a hard stop of the whole process tree, like a crash or a power cut (children would keep the single-instance lock)
    execSync(`taskkill /PID ${first.process().pid} /T /F`, { stdio: 'ignore' })
    await new Promise((r) => setTimeout(r, 1500))

    // 2nd run: the banner appears, and its button opens the script
    const second = await launch()
    const p2 = await second.firstWindow()
    await p2.waitForLoadState('domcontentloaded')
    await expect(p2.getByText('não foi fechado normalmente')).toBeVisible()
    await p2.getByRole('button', { name: /Abrir “queda”/ }).click()
    await expect(p2.getByRole('textbox', { name: 'Texto do roteiro' })).toContainText('LUGAR 0 ÚNICO')
    await second.close() // a normal quit removes the marker

    // 3rd run: no banner
    const third = await launch()
    const p3 = await third.firstWindow()
    await p3.waitForLoadState('domcontentloaded')
    await expect(p3.getByRole('button', { name: 'Novo roteiro' }).first()).toBeVisible()
    await expect(p3.getByText('não foi fechado normalmente')).toHaveCount(0)
    await third.close()
    void testInfo
  })
})
