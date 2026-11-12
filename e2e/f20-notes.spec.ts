import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ElectronApplication, Page } from '@playwright/test'
import { axeViolations, expect, menu, setTheme, test, type Dialogs } from './fixtures'

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
  const dir = mkdtempSync(join(tmpdir(), 'rotera-f20-'))
  const f = join(dir, 'in.fountain')
  writeFileSync(f, FOUNTAIN, 'utf8')
  await dialogs.open(f)
  await page.getByRole('button', { name: 'Importar FDX ou Fountain…' }).click()
  await expect(page.getByRole('textbox', { name: 'Texto do roteiro' })).toBeVisible()
  return dir
}

const line = (page: Page, text: string) => page.locator('.sheet-content > p', { hasText: new RegExp(`^${text}$`) })

async function caretOn(page: Page, text: string): Promise<void> {
  await line(page, text).click()
  await page.keyboard.press('End')
}

/** Ctrl+Alt+M, then waits until the new note has the focus, as a person would see it before typing. */
async function newNote(app: ElectronApplication, page: Page): Promise<void> {
  const before = await page.locator('.postit').count()
  await menu(app, 'new-note')
  await expect(page.locator('.postit')).toHaveCount(before + 1)
  await expect(page.locator('.postit textarea:focus')).toHaveCount(1)
}

test.describe('F20 notes column', () => {
  test('F20-H1 a note is pinned to the caret line, shows it, and its colour marks the line', async ({ app, page, dialogs }) => {
    await open(page, dialogs)
    await caretOn(page, 'Você veio.')
    await newNote(app, page) // Ctrl+Alt+M
    const panel = page.getByRole('complementary', { name: 'Notas' })
    await expect(panel).toBeVisible()
    const box = panel.getByRole('textbox', { name: /^Nota/ })
    await expect(box).toBeFocused()
    await page.keyboard.type('Mais seca, sem pausa.')
    await expect(panel.getByRole('heading', { name: 'Notas (1)' })).toBeVisible()
    await expect(panel.locator('.notes-group h3')).toHaveText('Cena 1 · INT. COZINHA - DIA')
    await expect(panel.locator('.postit-where')).toHaveText('Você veio.')
    await expect(line(page, 'Você veio.')).toHaveAttribute('data-note', 'yellow')
    await expect(line(page, 'Marina coa o café.')).not.toHaveAttribute('data-note', /.*/)

    await panel.getByRole('button', { name: 'Reescrever' }).click()
    await expect(line(page, 'Você veio.')).toHaveAttribute('data-note', 'pink')
    await expect(panel.locator('.postit')).toHaveAttribute('data-color', 'pink')

    // the quote on the post-it takes the caret back to its line
    await caretOn(page, 'Chove sem parar.')
    await expect(page.locator('#kind')).toHaveValue('action')
    await panel.getByRole('button', { name: 'Ir para a linha: Você veio.' }).click()
    await expect(page.locator('#kind')).toHaveValue('dialogue')

    // the toolbar button (or Mais) closes the column; the mark in the text stays
    await menu(app, 'toggle-notes')
    await expect(panel).toHaveCount(0)
    await expect(line(page, 'Você veio.')).toHaveAttribute('data-note', 'pink')
  })

  test('F20-H2 notes are saved in the file and come back on their line', async ({ app, page, dialogs }) => {
    const dir = await open(page, dialogs)
    await caretOn(page, 'Marina coa o café.')
    await newNote(app, page)
    await page.keyboard.type('Trocar por chá?')
    await page.getByRole('complementary', { name: 'Notas' }).getByRole('button', { name: 'Pergunta' }).click()
    const f = join(dir, 'com-notas.rottera')
    await dialogs.save(f)
    await page.locator('.toolbar button[aria-label="Salvar como…"]').click()
    await expect(page.locator('.status')).toContainText('Salvo')
    const saved = JSON.parse(readFileSync(f, 'utf8'))
    expect(saved.script.notes).toEqual([expect.objectContaining({ text: 'Trocar por chá?', color: 'blue' })])
    expect(saved.script.blocks[1].nid).toBe(saved.script.notes[0].anchor)

    await page.locator('.toolbar button', { hasText: /^Início$/ }).click()
    await dialogs.open(f)
    await page.getByRole('button', { name: 'Abrir…' }).click()
    await expect(line(page, 'Marina coa o café.')).toHaveAttribute('data-note', 'blue')
    // the column stays open from one script to the next, like the scene navigator
    await expect(page.getByRole('complementary', { name: 'Notas' }).getByRole('textbox', { name: /^Nota/ })).toHaveValue('Trocar por chá?')
  })

  test('F20-E1 when its line is deleted the note is loose and can be pinned again', async ({ app, page, dialogs }) => {
    await open(page, dialogs)
    await caretOn(page, 'Chove sem parar.')
    await newNote(app, page)
    await page.keyboard.type('Som de chuva forte')
    // delete the whole line: empty it, then join it with the line above
    await caretOn(page, 'Chove sem parar.')
    await page.keyboard.press('Shift+Home')
    await page.keyboard.press('Delete')
    await page.keyboard.press('Backspace')
    const panel = page.getByRole('complementary', { name: 'Notas' })
    await expect(panel.getByRole('heading', { name: 'Soltas' })).toBeVisible()
    await expect(panel.getByRole('textbox', { name: /^Nota/ })).toHaveValue('Som de chuva forte')

    await caretOn(page, 'EXT. RUA - NOITE')
    await panel.getByRole('button', { name: 'Prender na linha do cursor' }).click()
    await expect(panel.getByRole('heading', { name: 'Soltas' })).toHaveCount(0)
    await expect(panel.locator('.notes-group h3')).toHaveText('Cena 2 · EXT. RUA - NOITE')
    await expect(line(page, 'EXT. RUA - NOITE')).toHaveAttribute('data-note', 'yellow')

    await panel.getByRole('button', { name: 'Apagar nota' }).click()
    await expect(panel.getByRole('heading', { name: 'Notas (0)' })).toBeVisible()
    await expect(line(page, 'EXT. RUA - NOITE')).not.toHaveAttribute('data-note', /.*/)
  })

  test('F20-E2 Enter at the start of a line pushes the text down and the note goes with it', async ({ app, page, dialogs }) => {
    await open(page, dialogs)
    await caretOn(page, 'Marina coa o café.')
    await newNote(app, page)
    await page.keyboard.type('x')
    await caretOn(page, 'Marina coa o café.')
    await page.keyboard.press('Home')
    await page.keyboard.press('Enter')
    await expect(page.locator('.sheet-content > p[data-note]')).toHaveCount(1)
    await expect(page.locator('.sheet-content > p[data-note]')).toHaveText('Marina coa o café.')
  })

  test('F20-E3 Ctrl+Z after making a note undoes the writing, not the note', async ({ app, page, dialogs }) => {
    await open(page, dialogs)
    await caretOn(page, 'Você veio.')
    await page.keyboard.type(' Entra.')
    await newNote(app, page)
    await page.keyboard.type('nota')
    await caretOn(page, 'Você veio. Entra.')
    await page.keyboard.press('Control+z')
    const marked = page.locator('.sheet-content > p[data-note]')
    await expect(marked).not.toHaveText('Você veio. Entra.')
    await expect(marked).toHaveText(/^Você veio\./)
    await expect(page.getByRole('complementary', { name: 'Notas' }).getByRole('heading', { name: 'Soltas' })).toHaveCount(0)
  })

  test('F20-A1 the notes column has no serious accessibility violations, light and dark', async ({ app, page, dialogs }) => {
    await open(page, dialogs)
    await caretOn(page, 'Você veio.')
    await newNote(app, page)
    await page.keyboard.type('Mais seca.')
    const found: string[] = []
    for (const theme of ['light', 'night', 'midnight'] as const) {
      await setTheme(app, page, theme)
      for (const color of ['Nota', 'Pergunta', 'Reescrever', 'Resolvido']) {
        await page.getByRole('complementary', { name: 'Notas' }).getByRole('button', { name: color, exact: true }).click()
        await page.waitForTimeout(100)
        for (const v of await axeViolations(page)) found.push(`${theme}/${color}: ${v}`)
      }
    }
    expect(found).toEqual([])
  })
})
