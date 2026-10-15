import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { axeViolations, expect, menu, test } from './fixtures'

test.afterEach(({ errors }) => {
  expect(errors, 'console or page errors').toEqual([])
})

test.describe('F16 manual and diagnostics', () => {
  test('F16-H1 the manual opens from the home screen and from F1, and is searchable without accents', async ({ page, app }) => {
    await page.getByRole('button', { name: 'Manual', exact: true }).click()
    const dlg = page.getByRole('dialog', { name: 'Manual do Rotera' })
    await expect(dlg).toBeVisible()
    await expect(dlg.getByRole('heading', { name: 'Primeiros passos' })).toBeVisible()
    await dlg.getByLabel('Buscar no manual').fill('dialogo duplo')
    await expect(dlg.getByRole('navigation', { name: 'Assuntos do manual' }).getByRole('button').first()).toHaveText('Diálogo duplo')
    await expect(dlg.getByRole('heading', { name: 'Diálogo duplo' })).toBeVisible()
    await expect(dlg).toContainText('Ctrl+D')
    await page.keyboard.press('Escape')
    await expect(page.locator('dialog')).toHaveCount(0) // unmounted, not only closed
    await menu(app, 'manual')
    await expect(page.getByRole('dialog', { name: 'Manual do Rotera' })).toBeVisible()
  })

  test('F16-E1 nothing found says so and clearing the search brings all topics back', async ({ page }) => {
    await page.getByRole('button', { name: 'Manual', exact: true }).click()
    const dlg = page.getByRole('dialog', { name: 'Manual do Rotera' })
    const search = dlg.getByLabel('Buscar no manual')
    await search.fill('xyzzy qwerty')
    await expect(dlg).toContainText('Nada encontrado.')
    await expect(dlg).toContainText('Nenhum assunto combina')
    await search.fill('')
    expect(await dlg.getByRole('navigation').getByRole('button').count()).toBeGreaterThan(15)
  })

  test('F16-E2 picking a topic shows its text and marks it as current', async ({ page }) => {
    await page.getByRole('button', { name: 'Manual', exact: true }).click()
    const dlg = page.getByRole('dialog', { name: 'Manual do Rotera' })
    await dlg.getByRole('button', { name: 'Storyboard', exact: true }).click()
    await expect(dlg.getByRole('button', { name: 'Storyboard', exact: true })).toHaveAttribute('aria-current', 'true')
    await expect(dlg.locator('.manual-body')).toContainText('1600 pixels')
  })

  test('F16-H2 diagnostics shows the text before copying, with no script text or file names', async ({ page, dialogs, app }) => {
    const dir = mkdtempSync(join(tmpdir(), 'rotera-f16-Maria-'))
    const f = join(dir, 'Segredo-do-Roteiro.fountain')
    writeFileSync(f, 'INT. PORÃO SECRETO - NOITE\n\nFrase confidencial que ninguém deve ver.\n\nANA\nSenha do cofre.\n', 'utf8')
    await dialogs.open(f)
    await page.getByRole('button', { name: 'Importar FDX ou Fountain…' }).click()
    await expect(page.getByRole('textbox', { name: 'Texto do roteiro' })).toBeVisible()
    await page.getByRole('button', { name: 'Mais' }).click()
    await page.getByRole('button', { name: 'Copiar diagnóstico…' }).click()
    const dlg = page.getByRole('dialog', { name: 'Diagnóstico' })
    const box = dlg.getByLabel('Texto do diagnóstico')
    await expect(box).not.toHaveValue('Carregando…')
    const text = await box.inputValue()
    expect(text).toContain('Diagnóstico do Rotera')
    expect(text).toContain('Electron')
    expect(text).toMatch(/\d+ blocos, 1 cenas/)
    for (const secret of ['PORÃO', 'confidencial', 'Senha do cofre', 'Segredo-do-Roteiro', 'Maria', dir]) {
      expect(text, secret).not.toContain(secret)
    }
    await dlg.getByRole('button', { name: 'Copiar', exact: true }).click()
    await expect(page.locator('.toast')).toContainText('Diagnóstico copiado')
    const clip = await app.evaluate(({ clipboard }) => clipboard.readText())
    expect(clip).toBe(text)
  })

  test('F16-E3 an error in the page reaches the log, scrubbed of paths', async ({ page, errors }) => {
    await page.getByRole('button', { name: 'Novo roteiro' }).first().click()
    await expect(page.getByRole('textbox', { name: 'Texto do roteiro' })).toBeVisible()
    await page.evaluate(() => {
      window.setTimeout(() => {
        throw new Error('falha de teste em C:\\Users\\Maria\\Documents\\Roteiro.rotera')
      }, 0)
    })
    await expect.poll(() => errors.length).toBeGreaterThan(0)
    errors.length = 0 // the error was provoked on purpose
    await page.getByRole('button', { name: 'Mais' }).click()
    await page.getByRole('button', { name: 'Copiar diagnóstico…' }).click()
    const box = page.getByRole('dialog', { name: 'Diagnóstico' }).getByLabel('Texto do diagnóstico')
    await expect.poll(async () => (await box.inputValue()).includes('falha de teste')).toBe(true)
    const text = await box.inputValue()
    expect(text).toContain('erro-tela')
    expect(text).not.toContain('Maria')
    expect(text).not.toContain('Roteiro.rotera')
  })

  test('F16-N1 both dialogs are accessible and close with Esc', async ({ page }) => {
    await page.getByRole('button', { name: 'Manual', exact: true }).click()
    expect(await axeViolations(page)).toEqual([])
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Novo roteiro' }).first().click()
    await page.getByRole('button', { name: 'Mais' }).click()
    await page.getByRole('button', { name: 'Copiar diagnóstico…' }).click()
    await expect(page.getByLabel('Texto do diagnóstico')).toBeVisible()
    expect(await axeViolations(page)).toEqual([])
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Diagnóstico' })).toHaveCount(0)
  })
})
