import { deflateSync } from 'node:zlib'
import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { Page } from '@playwright/test'
import { APP_DIR, bridgeInfo, expect, menu, test } from './fixtures'

test.afterEach(({ errors }) => {
  expect(errors, 'console or page errors').toEqual([])
})

const NAMES = ['MARINA', 'DAVI', 'BIA', 'ZECA', 'LÚCIA', 'OTÁVIO', 'NINA', 'CAIO', 'RAQUEL', 'TOMÁS', 'IRENE', 'JOÃO']
const SCENES = 1800

function bigScript(): string {
  const parts: string[] = ['Title: Roteiro de estresse', 'Author: Teste', '']
  for (let i = 0; i < SCENES; i++) {
    const a = NAMES[i % NAMES.length]
    const b = NAMES[(i * 7 + 3) % NAMES.length]
    parts.push(`INT. LUGAR ${i} - ${i % 2 ? 'DIA' : 'NOITE'}`, '')
    parts.push('Descrição longa para ocupar linhas na página. '.repeat(5), '')
    parts.push(a, `Fala número ${i} de ${a.toLowerCase()}.`, '')
    if (i % 3 === 0) parts.push(b, `Resposta ${i}.`, '')
  }
  return parts.join('\n')
}

function png(w: number, h: number): Buffer {
  const crcTable: number[] = []
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crcTable[n] = c >>> 0
  }
  const crc = (b: Buffer): number => {
    let c = 0xffffffff
    for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (t: string, d: Buffer): Buffer => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(d.length)
    const td = Buffer.concat([Buffer.from(t), d])
    const c = Buffer.alloc(4)
    c.writeUInt32BE(crc(td))
    return Buffer.concat([len, td, c])
  }
  const row = w * 3 + 1
  const raw = Buffer.alloc(row * h)
  for (let y = 0; y < h; y++) {
    raw[y * row] = 0
    for (let x = 0; x < w; x++) {
      const o = y * row + 1 + x * 3
      raw[o] = (x * 255) / w
      raw[o + 1] = (y * 255) / h
      raw[o + 2] = 120
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

async function heapMb(page: Page): Promise<number> {
  return page.evaluate(() => {
    const m = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
    return m ? Math.round(m.usedJSHeapSize / 1048576) : -1
  })
}

test('F13 a 300 page script with storyboard, light maps and sheets stays usable', async ({ app, page, dialogs, userData }) => {
  test.setTimeout(900_000)
  const dir = mkdtempSync(join(tmpdir(), 'rotera-f13-'))
  const t: Record<string, number> = {}
  const clock = async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
    const t0 = Date.now()
    const r = await fn()
    t[name] = Date.now() - t0
    return r
  }
  const rpc = async (method: string, params: unknown = {}): Promise<{ ok: boolean; result?: any; error?: string }> => {
    const { port, token } = bridgeInfo(userData)
    const r = await fetch(`http://127.0.0.1:${port}/rpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ method, params })
    })
    return (await r.json()) as { ok: boolean; result?: any; error?: string }
  }

  // Plain CSS locators from here on: with 1800 scenes on screen, Playwright's role and label lookups walk the whole
  // accessibility tree inside the page and can keep it busy for more than 30 s, which is the tool's time, not the app's.
  const tab = (name: string) => page.locator('.seg button', { hasText: new RegExp(`^${name}$`) })

  const src = join(dir, 'grande.fountain')
  writeFileSync(src, bigScript(), 'utf8')
  const heap0 = await heapMb(page)

  await dialogs.open(src)
  await clock('import', async () => {
    await page.getByRole('button', { name: 'Importar FDX ou Fountain…' }).click()
    await expect(page.locator('.ProseMirror')).toBeVisible({ timeout: 60_000 })
    await expect(page.locator('.nav')).toContainText(`Cenas (${SCENES})`, { timeout: 60_000 })
  })
  const pages = Number(/de (\d+)/.exec(await page.locator('.status').innerText())?.[1])
  t.pages = pages
  expect(pages).toBeGreaterThan(250)

  // navigator open on a long script: move a scene and jump to another
  const nav = page.locator('.nav')
  await clock('navigator-move-scene', async () => {
    await nav.locator('button[aria-label="Descer cena 1"]').click()
    await expect(nav.locator('.scene-text').first()).toHaveText('INT. LUGAR 1 - DIA')
  })

  // find, then replace all across the whole script
  await menu(app, 'find') // Ctrl+F; the toolbar button may sit in Mais
  await clock('find', async () => {
    await page.locator('.findbar input[placeholder="Localizar"]').fill('Fala número')
    await expect(page.locator('.findbar')).toContainText(`de ${SCENES}`, { timeout: 30_000 })
  })
  await clock('replace-all', async () => {
    await page.locator('.findbar input[placeholder="Substituir por"]').fill('Réplica')
    await page.locator('.findbar button', { hasText: 'Substituir tudo' }).click()
    await page.locator('.findbar input[placeholder="Localizar"]').fill('Réplica')
    await expect(page.locator('.findbar')).toContainText(`de ${SCENES}`, { timeout: 60_000 })
  })

  // typing with 1800 highlighted matches, then with the find bar closed
  const editor = page.locator('.ProseMirror')
  await editor.click()
  await clock('type-30-chars-1800-highlights', async () => {
    await page.keyboard.type('abcdefghijklmnopqrstuvwxyz1234', { delay: 0 })
    await expect(editor).toContainText('abcdefghijklmnopqrstuvwxyz1234')
  })
  await page.keyboard.press('Escape')
  // Escape may already have closed the find bar
  const closeFind = page.locator('.findbar button[aria-label="Fechar busca"]')
  if ((await closeFind.count()) > 0) await closeFind.click()
  await expect(page.locator('.findbar')).toHaveCount(0)
  await editor.click()
  await clock('type-30-chars', async () => {
    await page.keyboard.type('ABCDEFGHIJKLMNOPQRSTUVWXYZ5678', { delay: 0 })
    await expect(editor).toContainText('ABCDEFGHIJKLMNOPQRSTUVWXYZ5678')
  })
  // on a long script the page breaks and the page count follow the text a moment after typing stops: they must catch up
  await expect
    .poll(async () => (await page.locator('.page-break').count()) + 1 === Number(/de (\d+)/.exec(await page.locator('.status').innerText())?.[1]), { timeout: 5000 })
    .toBe(true)

  // storyboard: 60 planned frames and 12 real pictures
  await clock('storyboard-60-frames', async () => {
    for (let i = 0; i < 60; i++) {
      const r = await rpc('add_frame', { caption: `Plano ${i}: câmera baixa seguindo a personagem.`, scene: String(i + 1) })
      expect(r.ok).toBe(true)
    }
  })
  await tab('Storyboard').click()
  const pics: string[] = []
  for (let i = 0; i < 12; i++) {
    const f = join(dir, `quadro-${i}.png`)
    writeFileSync(f, png(1920, 1080))
    pics.push(f)
  }
  await clock('storyboard-12-pictures', async () => {
    await page.locator('input[aria-label="Escolher imagens"]').setInputFiles(pics)
    await expect(page.locator('img').nth(11)).toBeVisible({ timeout: 90_000 })
  })

  // light maps: 20 maps with 15 pieces each
  await clock('lightmaps-20x15', async () => {
    for (let m = 0; m < 20; m++) {
      const c = await rpc('create_lightmap', { name: `Set ${m + 1}`, scene: String(m + 1), width: 10, height: 8 })
      expect(c.ok).toBe(true)
      for (let k = 0; k < 15; k++) {
        const r = await rpc('add_light_item', {
          map: m,
          type: ['camera', 'actor', 'fresnel', 'led', 'softbox', 'flag'][k % 6],
          x: 1 + (k % 5) * 1.6,
          y: 1 + Math.floor(k / 5) * 2,
          rotation: k * 24,
          label: `Peça ${k + 1}`
        })
        expect(r.ok).toBe(true)
      }
    }
  })
  // plain CSS locators here: Playwright's role/name lookup alone takes seconds on a DOM this big and would be measured as the app's time
  await clock('open-lightmap-tab', async () => {
    await page.locator('button', { hasText: /^Mapa de Luz$/ }).click()
    await expect(page.locator('svg').first()).toBeVisible({ timeout: 30_000 })
  })
  await tab('Roteiro').click()
  await clock('open-lightmap-tab-again', async () => {
    await page.locator('button', { hasText: /^Mapa de Luz$/ }).click()
    await expect(page.locator('svg').first()).toBeVisible({ timeout: 30_000 })
  })

  // character sheets and reports on the big script
  await clock('reports-characters', async () => {
    await tab('Relatórios').click()
    await page.locator('.reports nav button', { hasText: 'Fichas de personagem' }).click()
    await expect(page.locator('.chars-list li').nth(NAMES.length - 1)).toBeVisible({ timeout: 30_000 })
    // the typed test text may sit in one cue and make a 13th name; nobody may be missing
    expect(await page.locator('.chars-list li').count()).toBeGreaterThanOrEqual(NAMES.length)
  })
  await clock('reports-stats', async () => {
    await page.locator('.reports nav button', { hasText: 'Estatísticas' }).click()
    await expect(page.locator('table')).toContainText('Páginas', { timeout: 30_000 })
  })

  // everything at once into one PDF
  await tab('Roteiro').click()
  const out = join(dir, 'tudo.pdf')
  await dialogs.save(out)
  await clock('pdf-everything', async () => {
    await page.locator('.toolbar button', { hasText: /^Exportar PDF$/ }).click()
    await expect
      .poll(
        () => {
          try {
            return statSync(out).size
          } catch {
            return 0
          }
        },
        { timeout: 300_000, intervals: [500] }
      )
      .toBeGreaterThan(100_000)
  })
  const pdf = readFileSync(out).toString('latin1')
  t.pdfPages = (pdf.match(/\/Type\s*\/Page[^s]/g) || []).length
  t.pdfMb = Math.round((statSync(out).size / 1048576) * 10) / 10

  // save as .rottera and open it again
  const file = join(dir, 'grande.rottera')
  await dialogs.save(file)
  await clock('save-as', async () => {
    await page.locator('.toolbar button[aria-label="Salvar como…"]').click()
    await expect(page.locator('.status')).toContainText('Salvo', { timeout: 60_000 })
  })
  t.fileMb = Math.round((statSync(file).size / 1048576) * 10) / 10
  await page.locator('.toolbar button', { hasText: /^Início$/ }).click()
  await dialogs.open(file)
  await clock('reopen', async () => {
    await page.locator('.home-actions button', { hasText: 'Abrir…' }).click()
    await expect(page.locator('.nav')).toContainText(`Cenas (${SCENES})`, { timeout: 90_000 })
  })

  t.heapStartMb = heap0
  t.heapEndMb = await heapMb(page)

  writeFileSync(resolve(APP_DIR, '..', 'replica', 'stress-results.json'), JSON.stringify({ when: new Date().toISOString(), scenes: SCENES, ms: t }, null, 2))
  console.log('STRESS', JSON.stringify(t))

  // budgets: generous, they exist to catch a collapse, not to grade the machine
  expect(t.import).toBeLessThan(30_000)
  expect(t['navigator-move-scene']).toBeLessThan(5_000)
  expect(t.find).toBeLessThan(5_000)
  expect(t['replace-all']).toBeLessThan(20_000)
  // about 2.5 s on the reference machine since long scripts paginate when typing stops (it was 5.4 s)
  expect(t['type-30-chars']).toBeLessThan(4_500)
  expect(t['type-30-chars-1800-highlights']).toBeLessThan(6_000)
  expect(t['open-lightmap-tab']).toBeLessThan(5_000)
  expect(t['reports-characters']).toBeLessThan(5_000)
  expect(t['pdf-everything']).toBeLessThan(180_000)
  expect(t.reopen).toBeLessThan(30_000)
  expect(t.pdfPages).toBeGreaterThan(pages)
})
