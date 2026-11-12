import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Page } from '@playwright/test'
import { axeViolations, expect, menu, test, type Dialogs } from './fixtures'

test.afterEach(({ errors }) => {
  expect(errors, 'console or page errors').toEqual([])
})

const FOUNTAIN = `Title: Chuva
Author: Ana Souza

INT. COZINHA - DIA

Marina coa o café.

MARINA
Você veio.
`

async function open(page: Page, dialogs: Dialogs): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'rotera-f24-'))
  const f = join(dir, 'in.fountain')
  writeFileSync(f, FOUNTAIN, 'utf8')
  await dialogs.open(f)
  await page.getByRole('button', { name: 'Importar FDX ou Fountain…' }).click()
  await expect(page.getByRole('textbox', { name: 'Texto do roteiro' })).toBeVisible()
  return dir
}

const size = (f: string): number => {
  try {
    return readFileSync(f).length
  } catch {
    return 0
  }
}

test.describe('F24 Word, web page and the copy folder', () => {
  test('F24-H1 the script exports to Word and to a web page', async ({ app, page, dialogs }) => {
    const dir = await open(page, dialogs)
    const docx = join(dir, 'chuva.docx')
    await dialogs.save(docx)
    await menu(app, 'export-docx')
    await expect.poll(() => size(docx), { timeout: 20000 }).toBeGreaterThan(1000)
    expect(readFileSync(docx).subarray(0, 2).toString()).toBe('PK') // a zip, as every .docx

    const html = join(dir, 'chuva.html')
    await dialogs.save(html)
    // every format is in one place: Mais → Exportar…
    await page.getByRole('button', { name: 'Mais' }).click()
    await page.getByRole('button', { name: 'Exportar…', exact: true }).click()
    const dlg = page.getByRole('dialog', { name: 'Exportar' })
    await expect(dlg.getByRole('button', { name: /^Storyboard/ })).toBeDisabled() // no frames yet
    await dlg.getByRole('button', { name: /^Página da web \(HTML\)/ }).click()
    await expect(dlg).toHaveCount(0)
    await expect.poll(() => size(html), { timeout: 20000 }).toBeGreaterThan(1000)
    const text = readFileSync(html, 'utf8')
    expect(text).toContain('CHUVA')
    expect(text).toContain('Você veio.')
    expect(text).toContain('@media screen')
  })

  test('F24-H2 every save also goes to the copy folder, which is kept as a setting', async ({ page, dialogs, userData }) => {
    const dir = await open(page, dialogs)
    const copies = join(dir, 'OneDrive', 'Roteiros')
    mkdirSync(copies, { recursive: true })
    const file = join(dir, 'chuva.rottera')
    await dialogs.save(file)
    await page.locator('.toolbar button[aria-label="Salvar como…"]').click()
    await expect(page.locator('.status')).toContainText('Salvo')

    await page.getByRole('button', { name: 'Mais' }).click()
    await page.getByRole('button', { name: 'Cópia em outra pasta…' }).click()
    const dlg = page.getByRole('dialog', { name: 'Cópia em outra pasta' })
    await expect(dlg.locator('.copy-dir')).toHaveText('nenhuma')
    await dialogs.open(copies)
    await dlg.getByRole('button', { name: 'Escolher pasta…' }).click()
    await expect(dlg.locator('.copy-dir')).toHaveText(copies)
    // choosing the folder copies the open script at once
    const copy = join(copies, 'chuva.rottera')
    await expect.poll(() => existsSync(copy)).toBe(true)
    await dlg.getByRole('button', { name: 'Fechar' }).click()

    // the next edit reaches the copy too
    await page.locator('.sheet-content > p', { hasText: 'Você veio.' }).click()
    await page.keyboard.press('End')
    await page.keyboard.type(' Entra.')
    await expect.poll(() => readFileSync(copy, 'utf8'), { timeout: 10000 }).toContain('Você veio. Entra.')
    expect(readFileSync(copy, 'utf8')).toBe(readFileSync(file, 'utf8'))

    // the choice is a setting of the computer, next to the AI connection, not part of the script
    const settings = JSON.parse(readFileSync(join(userData, 'settings.json'), 'utf8'))
    expect(settings.copyDir).toBe(copies)
    expect(JSON.parse(readFileSync(file, 'utf8')).script.copyDir).toBeUndefined()
  })

  test('F24-E1 a folder that is gone (pen drive out) does not stop saving, and says so once', async ({ page, dialogs }) => {
    const dir = await open(page, dialogs)
    const usb = join(dir, 'pendrive')
    mkdirSync(usb)
    const file = join(dir, 'chuva.rottera')
    await dialogs.save(file)
    await page.locator('.toolbar button[aria-label="Salvar como…"]').click()
    await expect(page.locator('.status')).toContainText('Salvo')
    await page.getByRole('button', { name: 'Mais' }).click()
    await page.getByRole('button', { name: 'Cópia em outra pasta…' }).click()
    await dialogs.open(usb)
    await page.getByRole('dialog').getByRole('button', { name: 'Escolher pasta…' }).click()
    await expect.poll(() => existsSync(join(usb, 'chuva.rottera'))).toBe(true)
    await page.getByRole('dialog').getByRole('button', { name: 'Fechar' }).click()

    rmSync(usb, { recursive: true, force: true })
    await page.locator('.sheet-content > p', { hasText: 'Você veio.' }).click()
    await page.keyboard.press('End')
    await page.keyboard.type(' Fica.')
    await expect(page.locator('.toast')).toContainText('a cópia em', { timeout: 10000 })
    await expect(page.locator('.status')).toContainText('Cópia em outra pasta falhou')
    // the script itself was saved
    await expect.poll(() => readFileSync(file, 'utf8'), { timeout: 10000 }).toContain('Você veio. Fica.')

    // the folder comes back: the warning goes away on the next save
    mkdirSync(usb)
    await page.keyboard.type(' Sempre.')
    await expect(page.locator('.status')).not.toContainText('Cópia em outra pasta falhou', { timeout: 10000 })
    await expect.poll(() => size(join(usb, 'chuva.rottera'))).toBeGreaterThan(0)

    // stop copying
    await page.locator('.status').getByText('Salvo').waitFor()
    await page.getByRole('button', { name: 'Mais' }).click()
    await page.getByRole('button', { name: 'Cópia em outra pasta…' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Parar de copiar' }).click()
    await expect(page.getByRole('dialog').locator('.copy-dir')).toHaveText('nenhuma')
    expect(await axeViolations(page)).toEqual([])
  })
})
