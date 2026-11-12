import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from './fixtures'

test.afterEach(({ errors }) => {
  expect(errors, 'console or page errors').toEqual([])
})

const readable = (file: string): number => {
  try {
    return readFileSync(file).length
  } catch {
    return 0
  }
}

test.describe('F19 watermark', () => {
  test('F19-H1 set in Mais, stored in the file, kept when turned off, and the PDF still exports', async ({ page, dialogs }) => {
    const dir = mkdtempSync(join(tmpdir(), 'rotera-f19-'))
    const src = join(dir, 'in.fountain')
    writeFileSync(src, 'Title: Marca\nAuthor: Ana\n\nINT. SALA - DIA\n\nDavi atravessa a sala.\n\nDAVI\nNinguém pode ler isto.\n', 'utf8')
    await dialogs.open(src)
    await page.getByRole('button', { name: 'Importar FDX ou Fountain…' }).click()
    await expect(page.getByRole('textbox', { name: 'Texto do roteiro' })).toBeVisible()

    await page.getByRole('button', { name: 'Mais' }).click()
    await page.getByRole('button', { name: 'Marca d’água…' }).click()
    const dlg = page.getByRole('dialog', { name: 'Marca d’água' })
    await expect(dlg.getByLabel('Usar marca d’água no PDF')).toBeChecked()
    await dlg.getByLabel('Texto').fill('  CONFIDENCIAL  ')
    await dlg.getByLabel('Intensidade').selectOption('strong')
    await dlg.getByRole('button', { name: 'Salvar' }).click()
    await expect(dlg).toBeHidden()

    const f = join(dir, 'marca.rottera')
    await dialogs.save(f)
    await page.getByRole('button', { name: 'Salvar como…' }).click()
    await expect(page.locator('.status')).toContainText('Salvo')
    expect(JSON.parse(readFileSync(f, 'utf8')).script.watermark).toEqual({ enabled: true, text: 'CONFIDENCIAL', strength: 'strong' })

    const pdf = join(dir, 'marca.pdf')
    await dialogs.save(pdf)
    await page.getByRole('button', { name: 'Exportar PDF' }).click()
    await expect.poll(() => readable(pdf), { timeout: 20000 }).toBeGreaterThan(1000)
    if (process.env.ROTTERA_KEEP_PDF) copyFileSync(pdf, process.env.ROTTERA_KEEP_PDF)

    // reopening the dialog shows what was saved; turning it off keeps the text
    await page.getByRole('button', { name: 'Mais' }).click()
    await page.getByRole('button', { name: 'Marca d’água…' }).click()
    await expect(dlg.getByLabel('Texto')).toHaveValue('CONFIDENCIAL')
    await expect(dlg.getByLabel('Intensidade')).toHaveValue('strong')
    await dlg.getByLabel('Usar marca d’água no PDF').uncheck()
    await dlg.getByRole('button', { name: 'Salvar' }).click()
    await expect.poll(() => JSON.parse(readFileSync(f, 'utf8')).script.watermark?.enabled, { timeout: 15000 }).toBe(false)
    expect(JSON.parse(readFileSync(f, 'utf8')).script.watermark.text).toBe('CONFIDENCIAL')
  })
})
