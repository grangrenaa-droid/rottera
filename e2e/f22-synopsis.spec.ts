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

EXT. RUA - NOITE

Chove sem parar.
`

async function open(page: Page, dialogs: Dialogs): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'rotera-f22-'))
  const f = join(dir, 'in.fountain')
  writeFileSync(f, FOUNTAIN, 'utf8')
  await dialogs.open(f)
  await page.getByRole('button', { name: 'Importar FDX ou Fountain…' }).click()
  await expect(page.getByRole('textbox', { name: 'Texto do roteiro' })).toBeVisible()
  return dir
}

const line = (page: Page, text: string) => page.locator('.sheet-content > p', { hasText: text })
const navRow = (page: Page, heading: string) => page.locator('.nav li', { hasText: heading })

async function writeSynopsis(page: Page, scene: string, text: string): Promise<void> {
  await page.getByRole('button', { name: `Escrever sinopse da cena ${scene}` }).click()
  const box = page.getByRole('textbox', { name: `Sinopse da cena ${scene}` })
  await expect(box).toBeFocused()
  await box.fill(text)
  await box.press('Enter')
  await expect(box).toHaveCount(0)
}

test.describe('F22 scene synopsis', () => {
  test('F22-H1 written in the navigator, shown under the heading, outside the text', async ({ page, dialogs }) => {
    await open(page, dialogs)
    await writeSynopsis(page, '1', 'Marina descobre a mentira e não diz nada.')
    await expect(navRow(page, 'COZINHA').locator('.scene-syn')).toHaveText('Marina descobre a mentira e não diz nada.')
    const heading = line(page, 'INT. COZINHA - DIA')
    await expect(heading.locator('.syn-line')).toHaveText('Marina descobre a mentira e não diz nada.')
    // the heading text itself is unchanged, and typing at its end stays in the heading
    await expect(page.locator('.sheet-content > p').first()).toHaveAttribute('data-kind', 'scene_heading')
    await heading.click({ position: { x: 5, y: 5 } })
    await page.keyboard.press('End')
    await page.keyboard.type(' X')
    const texts = await page.evaluate(() =>
      [...document.querySelectorAll('.sheet-content > p')].map((p) => [...p.childNodes].filter((n) => !(n instanceof HTMLElement && n.classList.contains('syn-line'))).map((n) => n.textContent).join(''))
    )
    expect(texts[0]).toBe('INT. COZINHA - DIA X')
  })

  test('F22-H2 clicking the synopsis in the text, or Ctrl+Alt+S, edits it in the navigator; Esc gives up', async ({ app, page, dialogs }) => {
    await open(page, dialogs)
    await writeSynopsis(page, '1', 'Primeira versão.')
    await menu(app, 'toggle-navigator') // hidden: the click must bring it back
    await expect(page.locator('.nav')).toHaveCount(0)
    await line(page, 'INT. COZINHA - DIA').locator('.syn-line').click()
    const box = page.getByRole('textbox', { name: 'Sinopse da cena 1' })
    await expect(box).toBeFocused()
    await box.fill('Não vale.')
    await box.press('Escape')
    await expect(navRow(page, 'COZINHA').locator('.scene-syn')).toHaveText('Primeira versão.')

    await line(page, 'Chove sem parar.').click()
    await menu(app, 'edit-synopsis') // Ctrl+Alt+S
    const second = page.getByRole('textbox', { name: 'Sinopse da cena 2' })
    await expect(second).toBeFocused()
    await second.fill('A chuva não para.')
    await second.press('Enter')
    await expect(line(page, 'EXT. RUA - NOITE').locator('.syn-line')).toHaveText('A chuva não para.')

    // hidden from the text, still in the navigator
    await menu(app, 'toggle-synopsis')
    await expect(page.locator('.syn-line')).toHaveCount(0)
    await expect(navRow(page, 'RUA').locator('.scene-syn')).toHaveText('A chuva não para.')
    await menu(app, 'toggle-synopsis')
    await expect(page.locator('.syn-line')).toHaveCount(2)
  })

  test('F22-H3 the synopsis moves with its scene, is saved in the file and shows in the step outline', async ({ page, dialogs }) => {
    const dir = await open(page, dialogs)
    await writeSynopsis(page, '2', 'A chuva não para.')
    await page.locator('.nav button[aria-label="Subir cena 2"]').click()
    await expect(navRow(page, 'RUA').locator('.scene-syn')).toHaveText('A chuva não para.')
    await expect(page.locator('.sheet-content > p').first().locator('.syn-line')).toHaveText('A chuva não para.')

    const f = join(dir, 'sinopse.rottera')
    await dialogs.save(f)
    await page.locator('.toolbar button[aria-label="Salvar como…"]').click()
    await expect(page.locator('.status')).toContainText('Salvo')
    const saved = JSON.parse(readFileSync(f, 'utf8'))
    expect(saved.script.blocks[0]).toEqual(expect.objectContaining({ text: 'EXT. RUA - NOITE', syn: 'A chuva não para.' }))

    await page.locator('.toolbar button', { hasText: /^Início$/ }).click()
    await dialogs.open(f)
    await page.getByRole('button', { name: 'Abrir…' }).click()
    await expect(navRow(page, 'RUA').locator('.scene-syn')).toHaveText('A chuva não para.')
    await page.locator('.seg button', { hasText: /^Relatórios$/ }).click()
    await page.locator('.reports nav button', { hasText: 'Escaleta' }).click()
    await expect(page.locator('.report-body tbody tr').first()).toContainText('A chuva não para.')
  })

  test('F22-E1 Enter at the start of a heading pushes it down and the synopsis goes with it', async ({ page, dialogs }) => {
    await open(page, dialogs)
    await writeSynopsis(page, '1', 'Fica com o cabeçalho.')
    await line(page, 'INT. COZINHA - DIA').click({ position: { x: 5, y: 5 } })
    await page.keyboard.press('Home')
    await page.keyboard.press('Enter')
    await expect(page.locator('.syn-line')).toHaveCount(1)
    await expect(line(page, 'INT. COZINHA - DIA').locator('.syn-line')).toHaveText('Fica com o cabeçalho.')
    // the heading stays a heading; the new blank line above is an action
    await expect(line(page, 'INT. COZINHA - DIA')).toHaveAttribute('data-kind', 'scene_heading')
    await expect(page.locator('.sheet-content > p').first()).toHaveAttribute('data-kind', 'action')
    await expect(page.locator('#kind')).toHaveValue('scene_heading')
  })

  test('F22-A1 synopses have no serious accessibility violations, light and dark', async ({ app, page, dialogs }) => {
    await open(page, dialogs)
    await writeSynopsis(page, '1', 'Marina descobre a mentira.')
    const found: string[] = []
    for (const theme of ['light', 'night', 'midnight'] as const) {
      await setTheme(app, page, theme)
      await page.waitForTimeout(150)
      for (const v of await axeViolations(page)) found.push(`${theme}: ${v}`)
    }
    expect(found).toEqual([])
  })
})
