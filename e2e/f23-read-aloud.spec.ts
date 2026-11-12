import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Page } from '@playwright/test'
import { axeViolations, expect, menu, setTheme, test, type Dialogs } from './fixtures'

test.afterEach(({ errors }) => {
  expect(errors, 'console or page errors').toEqual([])
})

const FOUNTAIN = `INT. COZINHA - DIA

Marina coa o café.

MARINA
(baixo)
Você veio.

DAVI
Eu disse que vinha.
`

async function open(page: Page, dialogs: Dialogs): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'rotera-f23-'))
  const f = join(dir, 'in.fountain')
  writeFileSync(f, FOUNTAIN, 'utf8')
  await dialogs.open(f)
  await page.getByRole('button', { name: 'Importar FDX ou Fountain…' }).click()
  await expect(page.getByRole('textbox', { name: 'Texto do roteiro' })).toBeVisible()
  return dir
}

/**
 * A speech engine that records what it is asked to say instead of saying it. Each line "lasts" `ms`.
 * The voices are the two that Windows 11 has in Portuguese.
 */
async function fakeSpeech(page: Page, ms = 250, voices = ['Microsoft Daniel - Portuguese (Brazil)', 'Microsoft Maria - Portuguese (Brazil)']): Promise<void> {
  await page.evaluate(
    ({ ms, voices }) => {
      const w = window as unknown as Record<string, unknown>
      w.__spoken = []
      class U {
        text: string
        voice: { name: string } | null = null
        pitch = 1
        rate = 1
        lang = ''
        volume = 1
        onend: (() => void) | null = null
        onerror: (() => void) | null = null
        constructor(t: string) {
          this.text = t
        }
      }
      w.SpeechSynthesisUtterance = U
      const list = voices.map((name) => ({ name, lang: 'pt-BR' }))
      let paused = false
      let queue: U[] = []
      let timer: number | null = null
      const tick = (): void => {
        if (timer !== null || paused || queue.length === 0) return
        timer = window.setTimeout(() => {
          timer = null
          if (paused) return
          const u = queue.shift()
          u?.onend?.()
          tick()
        }, ms)
      }
      const synth = {
        getVoices: () => list,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        speak: (u: U) => {
          if (u.volume === 0) return
          ;(w.__spoken as unknown[]).push({ text: u.text, voice: u.voice?.name ?? null, pitch: u.pitch, rate: u.rate })
          queue.push(u)
          tick()
        },
        cancel: () => {
          queue = []
          if (timer !== null) window.clearTimeout(timer)
          timer = null
        },
        pause: () => {
          paused = true
          if (timer !== null) window.clearTimeout(timer)
          timer = null
        },
        resume: () => {
          paused = false
          tick()
        }
      }
      Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true })
    },
    { ms, voices }
  )
}

const spoken = (page: Page): Promise<{ text: string; voice: string; pitch: number; rate: number }[]> =>
  page.evaluate(() => (window as unknown as { __spoken: { text: string; voice: string; pitch: number; rate: number }[] }).__spoken)

async function caretAtTop(page: Page): Promise<void> {
  await page.locator('.sheet-content > p').first().click()
  await page.keyboard.press('Control+Home')
}

test.describe('F23 table read', () => {
  test('F23-H1 the narrator reads headings and action, each character their lines, and the line being read is highlighted', async ({ app, page, dialogs }) => {
    await open(page, dialogs)
    await fakeSpeech(page)
    await caretAtTop(page)
    await menu(app, 'read-aloud') // Ctrl+Shift+L
    const bar = page.getByRole('region', { name: 'Leitura em voz alta' })
    await bar.getByRole('button', { name: 'Ler do cursor' }).click()
    await expect(bar).toContainText('Lendo: narrador')
    await expect(page.locator('.sheet-content > p.reading')).toHaveText('INT. COZINHA - DIA')
    await bar.getByRole('button', { name: 'Pausar' }).click()
    await expect(bar).toContainText('Pausado')
    const heldOn = await page.locator('.sheet-content > p.reading').textContent()
    await page.waitForTimeout(600)
    await expect(page.locator('.sheet-content > p.reading')).toHaveText(heldOn ?? '')
    await bar.getByRole('button', { name: 'Continuar' }).click()
    await expect(bar.getByRole('button', { name: 'Ler do cursor' })).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('.sheet-content > p.reading')).toHaveCount(0)

    const said = await spoken(page)
    expect(said.map((s) => s.text)).toEqual(['Interior. Cozinha, dia.', 'Marina coa o café.', 'Você veio.', 'Eu disse que vinha.'])
    const voiceOf = (i: number): string => `${said[i].voice}@${said[i].pitch}`
    expect(voiceOf(0)).toBe(voiceOf(1)) // the narrator, both times
    expect(new Set([voiceOf(0), voiceOf(2), voiceOf(3)]).size).toBe(3) // narrator, Marina and Davi all sound different
  })

  test('F23-H2 voices, pitch, speed and names are chosen per script and saved with it', async ({ app, page, dialogs }) => {
    const dir = await open(page, dialogs)
    await fakeSpeech(page, 50)
    await menu(app, 'read-aloud')
    const bar = page.getByRole('region', { name: 'Leitura em voz alta' })
    await bar.getByLabel('Velocidade').selectOption({ label: 'Velocidade 1,2×' })
    await bar.getByLabel('Ler os nomes').check()
    await bar.getByText('Vozes', { exact: true }).click()
    await bar.getByLabel('Voz de MARINA', { exact: true }).selectOption({ label: 'Maria' })
    await bar.getByLabel('Tom de MARINA').selectOption({ label: 'Agudo' })
    await bar.getByRole('button', { name: 'Ouvir a voz de MARINA' }).click()
    await expect.poll(async () => (await spoken(page)).at(-1)).toEqual({ text: 'Eu sou Marina.', voice: 'Microsoft Maria - Portuguese (Brazil)', pitch: 1.2, rate: 1.2 })

    // Esc closes the voices panel
    await page.keyboard.press('Escape')
    await expect(bar.getByLabel('Voz de MARINA', { exact: true })).toBeHidden()
    await page.locator('.sheet-content > p', { hasText: 'Você veio.' }).click()
    const before = (await spoken(page)).length
    await bar.getByRole('button', { name: 'Ler do cursor' }).click()
    await expect(bar.getByRole('button', { name: 'Ler do cursor' })).toBeVisible({ timeout: 10_000 })
    const said = (await spoken(page)).slice(before)
    // from the caret, in the middle of Marina's speech, with the names said
    expect(said.map((s) => s.text)).toEqual(['Você veio.', 'Davi.', 'Eu disse que vinha.'])
    expect(said[0]).toEqual(expect.objectContaining({ voice: 'Microsoft Maria - Portuguese (Brazil)', pitch: 1.2, rate: 1.2 }))

    const f = join(dir, 'leitura.rottera')
    await dialogs.save(f)
    await page.locator('.toolbar button[aria-label="Salvar como…"]').click()
    await expect(page.locator('.status')).toContainText('Salvo')
    const saved = JSON.parse(readFileSync(f, 'utf8'))
    expect(saved.script.tableRead).toEqual(expect.objectContaining({ rate: 1.2, names: true }))
    expect(saved.script.tableRead.cast.MARINA).toEqual({ voice: 'Microsoft Maria - Portuguese (Brazil)', pitch: 1.2 })
  })

  test('F23-E1 Parar stops at once and clears the highlight; closing the bar stops too', async ({ app, page, dialogs }) => {
    await open(page, dialogs)
    await fakeSpeech(page, 400)
    await caretAtTop(page)
    await menu(app, 'read-aloud')
    const bar = page.getByRole('region', { name: 'Leitura em voz alta' })
    await bar.getByRole('button', { name: 'Ler do cursor' }).click()
    await expect(page.locator('.sheet-content > p.reading')).toHaveCount(1)
    await bar.getByRole('button', { name: 'Parar' }).click()
    await expect(page.locator('.sheet-content > p.reading')).toHaveCount(0)
    const n = (await spoken(page)).length
    await page.waitForTimeout(1000)
    expect((await spoken(page)).length).toBe(n)

    await bar.getByRole('button', { name: 'Ler do cursor' }).click()
    await bar.getByRole('button', { name: 'Fechar leitura' }).click()
    await expect(bar).toHaveCount(0)
    await expect(page.locator('.sheet-content > p.reading')).toHaveCount(0)
  })

  test('F23-E2 a computer without voices says how to add them', async ({ app, page, dialogs }) => {
    await open(page, dialogs)
    await fakeSpeech(page, 50, [])
    await menu(app, 'read-aloud')
    await expect(page.getByRole('region', { name: 'Leitura em voz alta' })).toContainText('Adicionar vozes', { timeout: 10_000 })
  })

  test('F23-A1 the reading bar and its voices have no serious accessibility violations, light and dark', async ({ app, page, dialogs }) => {
    await open(page, dialogs)
    await fakeSpeech(page)
    await menu(app, 'read-aloud')
    const bar = page.getByRole('region', { name: 'Leitura em voz alta' })
    await bar.getByText('Vozes', { exact: true }).click()
    const found: string[] = []
    for (const theme of ['light', 'night', 'midnight'] as const) {
      await setTheme(app, page, theme)
      await page.waitForTimeout(150)
      for (const v of await axeViolations(page)) found.push(`${theme}: ${v}`)
    }
    expect(found).toEqual([])
  })
})
