import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ElectronApplication, Page } from '@playwright/test'
import { expect, menu, test, type Dialogs } from './fixtures'

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
  const dir = mkdtempSync(join(tmpdir(), 'rottera-f29-'))
  const f = join(dir, 'in.fountain')
  writeFileSync(f, FOUNTAIN, 'utf8')
  await dialogs.open(f)
  await page.getByRole('button', { name: 'Importar FDX ou Fountain…' }).click()
  await expect(page.getByRole('textbox', { name: 'Texto do roteiro' })).toBeVisible()
  return dir
}

async function saveAs(app: ElectronApplication, page: Page, dialogs: Dialogs, file: string): Promise<any> {
  await dialogs.save(file)
  await menu(app, 'save-as')
  await expect(page.locator('.status')).toContainText('Salvo')
  return JSON.parse(readFileSync(file, 'utf8')).script
}

/** What the next report PDF would print is kept in the main process instead of opening a save dialog. */
async function catchReports(app: ElectronApplication): Promise<() => Promise<any>> {
  await app.evaluate(({ ipcMain }) => {
    ipcMain.removeHandler('file:exportReportPdf')
    ipcMain.handle('file:exportReportPdf', (_e, req) => {
      ;(globalThis as unknown as { lastReport: unknown }).lastReport = req
      return null
    })
  })
  return async () => app.evaluate(() => (globalThis as unknown as { lastReport?: unknown }).lastReport ?? null)
}

test.describe('F29 updates of 17/11', () => {
  test('F29-H2 the light map has more furniture, each with its size', async ({ app, page, dialogs }) => {
    await open(page, dialogs)
    await menu(app, 'view-lightmap')
    await page.getByRole('button', { name: 'Criar o primeiro mapa' }).click()
    for (const name of ['Mesa redonda', 'Sofá', 'Poltrona', 'Cama', 'Armário', 'Bancada', 'Estante']) {
      await page.locator('.lm-piece', { hasText: name }).first().click()
      await expect(page.getByLabel('Comprimento (m)'), name).toBeVisible()
    }
    await expect(page.locator('#it-depth')).toBeVisible() // the shelf has a width
    await page.locator('.lm-piece', { hasText: 'Mesa redonda' }).first().click()
    await expect(page.locator('#it-depth')).toHaveCount(0) // a round table only has its diameter
    await expect(page.locator('.lm-surface [data-item]')).toHaveCount(8)
    await page.locator('.lm-surface').screenshot({ path: 'test-results/f29-moveis.png' })
  })

  test('F29-H1 a lunch break goes into the day sheet between the scenes, by its time', async ({ app, page, dialogs }) => {
    const dir = await open(page, dialogs)
    await menu(app, 'view-shooting')
    await page.getByRole('button', { name: 'Plano de filmagem' }).click()
    await page.getByRole('button', { name: 'Novo dia' }).click()
    for (const [n, t] of [['1', '09:00'], ['2', '14:00']]) {
      await page.getByLabel(`Dia da cena ${n}`, { exact: true }).selectOption({ label: 'Dia 1' })
      await page.getByLabel(`Horário da cena ${n}`).fill(t)
      await page.getByLabel(`Horário da cena ${n}`).press('Tab')
    }
    await page.getByRole('button', { name: '+ Pausa' }).click()
    await expect(page.getByLabel('Tipo da pausa 1 de Dia 1')).toHaveValue('lunch')
    await page.getByLabel('Horário da pausa 1 de Dia 1').fill('12:00')
    await page.getByLabel('Horário da pausa 1 de Dia 1').press('Tab')
    await page.getByLabel('Minutos da pausa 1 de Dia 1').fill('45')
    await page.getByLabel('Minutos da pausa 1 de Dia 1').press('Tab')

    const sent = await catchReports(app)
    await page.getByRole('button', { name: 'Ordem do dia (PDF)' }).click()
    await expect.poll(sent).not.toBeNull()
    expect((await sent()).callsheet.breaks).toEqual([{ time: '12:00', label: 'Almoço', length: '45 min' }])

    const saved = await saveAs(app, page, dialogs, join(dir, 'pausa.rottera'))
    expect(saved.production.days[0].breaks).toEqual([expect.objectContaining({ kind: 'lunch', time: '12:00', minutes: 45 })])
    await page.getByRole('button', { name: 'Tirar a pausa 1 de Dia 1' }).click()
    await expect(page.getByLabel('Tipo da pausa 1 de Dia 1')).toHaveCount(0)
  })
})
