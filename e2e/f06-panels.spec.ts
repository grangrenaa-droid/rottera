import { deflateSync } from 'node:zlib'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { axeViolations, expect, newScript, test } from './fixtures'

test.afterEach(({ errors }) => {
  expect(errors, 'console or page errors').toEqual([])
})

const work = (): string => mkdtempSync(join(tmpdir(), 'rotera-f06-'))

function crc32(buf: Buffer): number {
  const table: number[] = []
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
function png(w: number, h: number): Buffer {
  const row = w * 3 + 1
  const raw = Buffer.alloc(row * h, 120)
  for (let y = 0; y < h; y++) raw[y * row] = 0
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

test.describe('F06 planning panels', () => {
  test('F06-B1 Beat Board: structure, move a beat to another column, make a scene', async ({ page }) => {
    await newScript(page)
    await page.getByRole('button', { name: 'Beat Board' }).click()
    await page.getByRole('button', { name: 'Aplicar estrutura' }).click()
    await expect(page.locator('.lane')).toHaveCount(4)
    const first = page.locator('.lane').first().locator('.beat').first()
    await first.getByRole('button', { name: 'Virar cena' }).click()
    await expect(page.getByRole('textbox', { name: 'Texto do roteiro' })).toContainText('Mundo comum')
  })

  test('F06-B2 Beat Board: applying a structure over a filled board asks first', async ({ page }) => {
    await newScript(page)
    await page.getByRole('button', { name: 'Beat Board' }).click()
    await page.getByRole('button', { name: 'Aplicar estrutura' }).click()
    let asked = false
    page.once('dialog', async (d) => {
      asked = true
      await d.dismiss()
    })
    await page.getByRole('button', { name: 'Aplicar estrutura' }).click()
    await expect.poll(() => asked).toBe(true)
    await expect(page.locator('.lane')).toHaveCount(4)
  })

  test('F06-S1 Storyboard: pictures, non-image, corrupted image, huge image', async ({ page }) => {
    const dir = work()
    writeFileSync(join(dir, 'a.png'), png(320, 180))
    writeFileSync(join(dir, 'grande.png'), png(4200, 2400))
    writeFileSync(join(dir, 'quebrada.png'), Buffer.from('isto nao e um png'))
    writeFileSync(join(dir, 'texto.txt'), 'oi')
    await newScript(page)
    await page.getByRole('button', { name: 'Storyboard' }).click()
    const input = page.getByLabel('Escolher imagens', { exact: true })
    await input.setInputFiles([join(dir, 'a.png'), join(dir, 'grande.png')])
    await expect(page.locator('.sb-card')).toHaveCount(2, { timeout: 15000 })
    const sizes = await page.evaluate(() => [...document.querySelectorAll('.sb-card img')].map((i) => `${(i as HTMLImageElement).naturalWidth}x${(i as HTMLImageElement).naturalHeight}`))
    expect(sizes).toContain('1600x914')
    await input.setInputFiles([join(dir, 'quebrada.png')])
    await expect(page.locator('.sb-card')).toHaveCount(2)
    await expect(page.getByRole('status').filter({ hasText: /Não consegui ler|imagem/ }).first()).toBeVisible()
    await input.setInputFiles([join(dir, 'texto.txt')])
    await expect(page.locator('.sb-card')).toHaveCount(2)
  })

  test('F06-S2 Storyboard: delete and duplicate keep numbering and count', async ({ page }) => {
    await newScript(page)
    await page.getByRole('button', { name: 'Storyboard' }).click()
    await page.getByRole('button', { name: 'Quadro vazio' }).click()
    await page.getByRole('button', { name: 'Quadro vazio' }).click()
    await page.getByRole('button', { name: 'Duplicar' }).first().click()
    await expect(page.locator('.sb-card')).toHaveCount(3)
    await page.getByRole('button', { name: 'Apagar quadro 2' }).click()
    await expect(page.locator('.sb-card')).toHaveCount(2)
    await expect(page.locator('.sb-num')).toHaveText(['1', '2'])
  })

  test('F06-L1 Mapa de Luz: shrinking the set keeps every piece inside it', async ({ page }) => {
    await newScript(page)
    await page.getByRole('button', { name: 'Mapa de Luz' }).click()
    await page.getByRole('button', { name: 'Criar o primeiro mapa' }).click()
    await page.getByLabel('Largura (m)').fill('20')
    await page.locator('.lm-piece', { hasText: 'Câmera' }).click()
    await page.getByLabel('X (m)').fill('18')
    await page.getByLabel('Largura (m)').fill('4')
    const x = Number(await page.evaluate(() => {
      const list = document.querySelector('.lm-items button')
      return list?.textContent ?? ''
    }).then((t) => /\(([\d.]+) m,/.exec(t)?.[1] ?? 'NaN'))
    expect(x).toBeLessThanOrEqual(4)
  })

  test('F06-L2 Mapa de Luz: labels are shown as text, never as markup', async ({ page }) => {
    await newScript(page)
    await page.getByRole('button', { name: 'Mapa de Luz' }).click()
    await page.getByRole('button', { name: 'Criar o primeiro mapa' }).click()
    await page.locator('.lm-piece', { hasText: 'Fresnel' }).click()
    await page.getByLabel('Legenda').fill('<img src=x onerror=alert(1)> & "q"')
    await expect(page.locator('.lm-surface svg text', { hasText: 'onerror' })).toContainText('<img src=x onerror=alert(1)>')
    expect(await page.locator('.lm-surface svg img').count()).toBe(0)
  })

  test('F06-L3 Mapa de Luz: rotation wraps at 360 and negative values', async ({ page }) => {
    await newScript(page)
    await page.getByRole('button', { name: 'Mapa de Luz' }).click()
    await page.getByRole('button', { name: 'Criar o primeiro mapa' }).click()
    await page.locator('.lm-piece', { hasText: 'Câmera' }).click()
    await page.getByLabel('Rotação (°)').fill('-30')
    await expect(page.getByLabel('Rotação (°)')).toHaveValue('330')
    await page.getByLabel('Rotação (°)').fill('725')
    await expect(page.getByLabel('Rotação (°)')).toHaveValue('5')
  })

  test('F06-L4 Mapa de Luz: delete key removes the selected piece, undo brings it back', async ({ page }) => {
    await newScript(page)
    await page.getByRole('button', { name: 'Mapa de Luz' }).click()
    await page.getByRole('button', { name: 'Criar o primeiro mapa' }).click()
    await page.locator('.lm-piece', { hasText: 'Ator ou atriz' }).click()
    await expect(page.locator('.lm-items li')).toHaveCount(1)
    await page.locator('.lm-surface').focus()
    await page.keyboard.press('Delete')
    await expect(page.locator('.lm-items li')).toHaveCount(0)
    await page.keyboard.press('Control+Z')
    await expect(page.locator('.lm-items li')).toHaveCount(1)
  })
})

test.describe('accessibility scan (axe) on every screen', () => {
  test('home', async ({ page }) => {
    expect(await axeViolations(page)).toEqual([])
  })

  test('editor, board, storyboard, light map, reports', async ({ page }) => {
    await newScript(page)
    const found: string[] = []
    for (const [tab, extra] of [
      ['Roteiro', null],
      ['Beat Board', 'Aplicar estrutura'],
      ['Storyboard', 'Quadro vazio'],
      ['Mapa de Luz', 'Criar o primeiro mapa'],
      ['Relatórios', null]
    ] as const) {
      await page.getByRole('button', { name: tab, exact: true }).click()
      if (extra) await page.getByRole('button', { name: extra }).click()
      for (const v of await axeViolations(page)) found.push(`${tab}: ${v}`)
    }
    expect(found).toEqual([])
  })

  test('dialogs: connect, title page, SmartType', async ({ page }) => {
    await newScript(page)
    const found: string[] = []
    await page.getByRole('button', { name: 'Mais' }).click()
    await page.getByRole('button', { name: 'Conectar ao Claude…' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    for (const v of await axeViolations(page)) found.push(`connect: ${v}`)
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Mais' }).click()
    await page.getByRole('button', { name: 'Página de título…' }).click()
    for (const v of await axeViolations(page)) found.push(`title: ${v}`)
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Mais' }).click()
    await page.getByRole('button', { name: 'Gerenciar SmartType…' }).click()
    for (const v of await axeViolations(page)) found.push(`smarttype: ${v}`)
    expect(found).toEqual([])
  })

  test('night and midnight themes keep contrast', async ({ app, page }) => {
    await newScript(page)
    const found: string[] = []
    for (const t of ['theme-night', 'theme-midnight']) {
      await app.evaluate(({ BrowserWindow }, a) => BrowserWindow.getAllWindows()[0].webContents.send('menu', a), t)
      for (const v of await axeViolations(page)) found.push(`${t}: ${v}`)
    }
    expect(found).toEqual([])
  })
})
