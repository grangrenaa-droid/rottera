import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron } from '@playwright/test'
import { APP_DIR, expect, test } from './fixtures'

test.afterEach(({ errors }) => {
  expect(errors, 'console or page errors').toEqual([])
})

const legacyFile = (text: string): string =>
  JSON.stringify({
    format: 'clapboard',
    version: 1,
    savedAt: '2026-09-01T10:00:00.000Z',
    script: {
      titlePage: { title: 'Antigo', author: '', contact: '' },
      blocks: [
        { kind: 'scene_heading', text: 'INT. CASA - DIA' },
        { kind: 'action', text }
      ]
    }
  })

test.describe('F18 the app now has its own name; what was made under the old one keeps working', () => {
  test('F18-H1 the window and the home screen carry the new name', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Rotera', level: 1 })).toBeVisible()
    expect(await page.title()).toBe('Rotera')
  })

  test('F18-H2 a file saved under the old name opens, and saving it writes the new format', async ({ page, dialogs }) => {
    const dir = mkdtempSync(join(tmpdir(), 'rotera-f18-'))
    const f = join(dir, 'antigo.clapboard')
    writeFileSync(f, legacyFile('Texto escrito antes da troca de nome.'), 'utf8')
    await dialogs.open(f)
    await page.getByRole('button', { name: 'Abrir…' }).click()
    await expect(page.getByRole('textbox', { name: 'Texto do roteiro' })).toContainText('Texto escrito antes da troca de nome.')
    await page.getByRole('textbox', { name: 'Texto do roteiro' }).click()
    await page.keyboard.type(' Mais.')
    await expect(page.locator('.status')).toContainText('Salvo', { timeout: 8000 })
    const saved = JSON.parse(readFileSync(f, 'utf8'))
    expect(saved.format).toBe('rotera')
    expect(JSON.stringify(saved)).toContain('Mais.')
  })

  test('F18-E1 a file from some other program is still refused', async ({ page, dialogs }) => {
    const dir = mkdtempSync(join(tmpdir(), 'rotera-f18-'))
    const f = join(dir, 'outro.rotera')
    writeFileSync(f, JSON.stringify({ format: 'outra-coisa', version: 1, script: { blocks: [] } }), 'utf8')
    await dialogs.open(f)
    await page.getByRole('button', { name: 'Abrir…' }).click()
    await expect(page.getByRole('textbox', { name: 'Texto do roteiro' })).toHaveCount(0)
  })

  test('F18-M1 recents, draft and version history from the old data folder are copied once, and nothing is removed', async () => {
    const appData = mkdtempSync(join(tmpdir(), 'rotera-f18-appdata-'))
    const old = join(appData, 'Clapboard')
    mkdirSync(join(old, 'backups', 'abc'), { recursive: true })
    const work = mkdtempSync(join(tmpdir(), 'rotera-f18-work-'))
    const script = join(work, 'meu.clapboard')
    writeFileSync(script, legacyFile('Texto.'), 'utf8')
    writeFileSync(join(old, 'recent.json'), JSON.stringify([{ path: script, name: 'meu', openedAt: '2026-09-01T10:00:00Z' }]), 'utf8')
    writeFileSync(join(old, 'draft.json'), legacyFile('Rascunho antigo.'), 'utf8')
    writeFileSync(join(old, 'backups', 'abc', '1790000000000-auto.json'), legacyFile('Versão antiga.'), 'utf8')
    writeFileSync(join(old, 'bridge.json'), '{"port":1,"token":"x"}', 'utf8')

    const userData = join(appData, 'Rotera')
    const env = { ...process.env, ROTERA_LEGACY_APPDATA: appData } as Record<string, string>
    delete env.ELECTRON_RUN_AS_NODE
    const launch = (): ReturnType<typeof electron.launch> =>
      process.env.ROTERA_EXE
        ? electron.launch({ executablePath: process.env.ROTERA_EXE, args: [`--user-data-dir=${userData}`], env })
        : electron.launch({ args: ['.', `--user-data-dir=${userData}`], cwd: APP_DIR, env })

    const app = await launch()
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('button', { name: 'Recuperar rascunho' })).toBeVisible()
    await expect(page.locator('.recent-item', { hasText: 'meu' })).toBeVisible()
    await app.close()

    expect(existsSync(join(userData, 'migrated.json'))).toBe(true)
    expect(existsSync(join(userData, 'backups', 'abc', '1790000000000-auto.json'))).toBe(true)
    // the old folder is untouched, and the old bridge key is not carried over
    expect(existsSync(join(old, 'recent.json'))).toBe(true)
    // the old connection key is never carried over (the app removes its own bridge file on quit)
    const bridge = join(userData, 'bridge.json')
    if (existsSync(bridge)) expect(readFileSync(bridge, 'utf8')).not.toContain('"token":"x"')
  })
})
