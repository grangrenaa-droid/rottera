import { _electron as electron, expect, test as base, type ElectronApplication, type Locator, type Page } from '@playwright/test'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const axeSource: string = require('axe-core').source
import { mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

export const APP_DIR = resolve(__dirname, '..')

export interface Dialogs {
  /** Next "open" dialog returns this path (null = cancelled). */
  open(path: string | null): Promise<void>
  /** Next "save" dialog returns this path (null = cancelled). */
  save(path: string | null): Promise<void>
}

interface Fixtures {
  userData: string
  app: ElectronApplication
  page: Page
  dialogs: Dialogs
  errors: string[]
  /** Ends the test with the app's own failure list: console errors, page errors, 5xx. */
  editor: Locator
}

export const test = base.extend<Fixtures>({
  userData: async ({}, use) => {
    await use(mkdtempSync(join(tmpdir(), 'rotera-e2e-')))
  },
  app: async ({ userData }, use) => {
    const env = { ...process.env, ROTERA_LEGACY_APPDATA: mkdtempSync(join(tmpdir(), 'rotera-no-legacy-')) } as Record<string, string>
    delete env.ELECTRON_RUN_AS_NODE
    // ROTERA_EXE points the suite at a packaged build (the portable folder) instead of the dev tree.
    const exe = process.env.ROTERA_EXE
    const app = exe
      ? await electron.launch({ executablePath: exe, args: [`--user-data-dir=${userData}`], env })
      : await electron.launch({ args: ['.', `--user-data-dir=${userData}`], cwd: APP_DIR, env })
    await use(app)
    await app.close().catch(() => undefined)
  },
  errors: async ({}, use) => {
    await use([])
  },
  page: async ({ app, errors }, use) => {
    const page = await app.firstWindow()
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`console: ${m.text()}`)
    })
    await page.waitForLoadState('domcontentloaded')
    await use(page)
  },
  dialogs: async ({ app }, use) => {
    await app.evaluate(({ dialog }) => {
      const g = globalThis as unknown as { __next: { open: string | null; save: string | null } }
      g.__next = { open: null, save: null }
      dialog.showOpenDialog = (async () =>
        g.__next.open ? { canceled: false, filePaths: [g.__next.open] } : { canceled: true, filePaths: [] }) as never
      dialog.showSaveDialog = (async () =>
        g.__next.save ? { canceled: false, filePath: g.__next.save } : { canceled: true }) as never
    })
    const set = async (kind: 'open' | 'save', path: string | null): Promise<void> => {
      await app.evaluate((_e, a) => {
        ;(globalThis as unknown as { __next: Record<string, string | null> }).__next[a.kind] = a.path
      }, { kind, path })
    }
    await use({ open: (p) => set('open', p), save: (p) => set('save', p) })
  },
  editor: async ({ page }, use) => {
    await use(page.getByRole('textbox', { name: 'Texto do roteiro' }))
  }
})

export { expect }

export async function newScript(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Novo roteiro' }).first().click()
  await expect(page.getByRole('textbox', { name: 'Texto do roteiro' })).toBeVisible()
  await page.getByRole('textbox', { name: 'Texto do roteiro' }).click()
}

export interface Row {
  kind: string
  text: string
  dual: boolean
}

export async function rows(page: Page): Promise<Row[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('.sheet-content > p')].map((p) => ({
      kind: (p as HTMLElement).dataset.kind ?? '',
      text: p.textContent ?? '',
      dual: (p as HTMLElement).dataset.dual === 'true'
    }))
  )
}

/** Sends a main-menu action to the window, as if the menu item was clicked. */
export async function menu(app: ElectronApplication, action: string): Promise<void> {
  await app.evaluate(({ BrowserWindow }, a) => {
    BrowserWindow.getAllWindows()[0].webContents.send('menu', a)
  }, action)
}

export async function axeViolations(page: Page): Promise<string[]> {
  await page.evaluate(axeSource)
  const violations = await page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (c?: unknown, o?: unknown) => Promise<{ violations: { id: string; impact: string; nodes: { html: string }[] }[] }> } }).axe
    const r = await axe.run(document, { resultTypes: ['violations'] })
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, count: v.nodes.length, html: v.nodes[0]?.html.slice(0, 140) ?? '' }))
  })
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id} (${v.impact}): ${v.count} node(s), e.g. ${v.html}`)
}

export function readJson(path: string): { script: Record<string, unknown> } & Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8'))
}

export function exists(path: string): boolean {
  return existsSync(path)
}

export function bridgeInfo(userData: string): { port: number; token: string } {
  return JSON.parse(readFileSync(join(userData, 'bridge.json'), 'utf8'))
}
