// Storyboard tab, end to end: adds pictures through the real file input, edits captions, reorders,
// saves and reloads, and prints PDFs (script + storyboard, storyboard only, storyboard off).
// Electron dialogs are stubbed in the main process through the Node inspector.
// usage: node tests/e2e/storyboard-e2e.mjs <app dir> [packaged Rottera.exe]
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, mkdtempSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { deflateSync } from 'node:zlib'

const appDir = resolve(process.argv[2])
const exe = process.argv[3]
const require = createRequire(appDir + '/package.json')
const electron = exe || require('electron')
const cdpPort = 9448
const inspectPort = 9558
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const work = join(tmpdir(), 'rottera-storyboard-e2e')
rmSync(work, { recursive: true, force: true })
mkdirSync(work, { recursive: true })
const p = (n) => join(work, n)
const results = []
const check = (name, ok, extra = '') => results.push({ name, ok: Boolean(ok), extra: ok ? '' : String(extra).slice(0, 400) })

// ---- build real PNG files (solid colours with a diagonal stripe)
function crc32(buf) {
  let c
  const table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
function png(w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0
    for (let x = 0; x < w; x++) {
      const stripe = Math.abs(x * h - y * w) < w * 6
      const o = y * (w * 3 + 1) + 1 + x * 3
      raw[o] = stripe ? 255 : rgb[0]
      raw[o + 1] = stripe ? 255 : rgb[1]
      raw[o + 2] = stripe ? 255 : rgb[2]
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ])
}
writeFileSync(p('a.png'), png(640, 360, [200, 60, 60]))
writeFileSync(p('b.png'), png(2400, 1350, [60, 160, 90]))
writeFileSync(p('c.png'), png(360, 640, [60, 90, 200]))
writeFileSync(p('nao-imagem.txt'), 'oi')
let fountain = 'Title: Chuva\nAuthor: Ana Souza\n\nINT. COZINHA - MANHÃ\n\nMarina coa o café.\n\nMARINA\nVocê veio.\n'
for (let i = 0; i < 12; i++) fountain += `\nINT. LUGAR ${i} - DIA\n\n${'Descrição longa para ocupar linhas. '.repeat(5)}\n`
writeFileSync(p('roteiro.fountain'), fountain, 'utf8')

// ---- launch
// a throwaway data folder, so the run never touches the writer's recent files or versions
const userData = mkdtempSync(join(tmpdir(), 'rottera-e2e-'))
const env = { ...process.env, ROTERA_LEGACY_APPDATA: join(userData, 'none') }
delete env.ELECTRON_RUN_AS_NODE
// a window covered by another one stops painting, and screenshots then never return
const args = [`--remote-debugging-port=${cdpPort}`, `--inspect=${inspectPort}`, `--user-data-dir=${userData}`, '--disable-features=CalculateNativeWinOcclusion']
const app = spawn(electron, exe ? args : ['.', ...args], { cwd: appDir, env, stdio: 'ignore' })

async function wsOf(port, type) {
  for (let i = 0; i < 80; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
      const t = list.find((x) => (type ? x.type === type : true))
      if (t) return t.webSocketDebuggerUrl
    } catch {}
    await sleep(400)
  }
  throw new Error(`no target on ${port}`)
}
function client(url) {
  const ws = new WebSocket(url)
  let id = 0
  const pending = new Map()
  const errors = []
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data)
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg)
      pending.delete(msg.id)
    } else if (msg.method === 'Runtime.exceptionThrown') {
      errors.push(String(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text))
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      errors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '))
    }
  }
  const ready = new Promise((r) => (ws.onopen = r))
  const call = (method, params = {}) =>
    new Promise((res) => {
      const i = ++id
      pending.set(i, res)
      ws.send(JSON.stringify({ id: i, method, params }))
    })
  const js = async (expr) => {
    const r = await call('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true, includeCommandLineAPI: true })
    if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400))
    return r.result.result.value
  }
  return { ready, call, js, errors, close: () => ws.close() }
}
const page = client(await wsOf(cdpPort, 'page'))
await page.ready
await page.call('Runtime.enable')
const main = client(await wsOf(inspectPort))
await main.ready
await main.call('Runtime.enable')
await sleep(1500)
await main.js(`(() => {
  const { dialog } = require('electron')
  globalThis.__next = { open: null, save: null }
  dialog.showOpenDialog = async () => globalThis.__next.open ? { canceled: false, filePaths: [globalThis.__next.open] } : { canceled: true, filePaths: [] }
  dialog.showSaveDialog = async () => globalThis.__next.save ? { canceled: false, filePath: globalThis.__next.save } : { canceled: true }
})()`)
const setNext = (open, save) => main.js(`globalThis.__next = { open: ${JSON.stringify(open)}, save: ${JSON.stringify(save)} }`)
const clickText = (t) =>
  page.js(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith(${JSON.stringify(t)})); if (!b) return false; b.click(); return true })()`)
const cards = () => page.js(`document.querySelectorAll('.sb-card').length`)
const caption = (i) => page.js(`document.querySelectorAll('.sb-card textarea')[${i}]?.value`)
const setValue = (selector, value) =>
  page.js(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })) })()`)
const pdfPages = (file) => {
  const t = readFileSync(file).toString('latin1')
  return { pages: (t.match(/\/Type\s*\/Page[^s]/g) || []).length, images: (t.match(/\/Subtype\s*\/Image/g) || []).length }
}
const chooseFiles = async (selector, files) => {
  const doc = await page.call('DOM.getDocument', { depth: 0 })
  const q = await page.call('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector })
  await page.call('DOM.setFileInputFiles', { nodeId: q.result.nodeId, files })
}

// ---- open a script with a title and several pages
await setNext(p('roteiro.fountain'), null)
await clickText('Importar FDX ou Fountain')
await sleep(900)
const scriptPages = Number(/de (\d+)/.exec(await page.js(`document.querySelector('.status').innerText`))?.[1])
check('script imported', scriptPages >= 2, scriptPages)

// ---- storyboard tab
check('Storyboard tab exists', await clickText('Storyboard'))
await sleep(300)
const empty = await page.js(`document.querySelector('.sb-summary').innerText`)
check('empty state explains how to add images', /Arraste imagens/.test(empty), empty)

await chooseFiles('input[aria-label="Escolher imagens"]', [p('a.png'), p('b.png'), p('c.png')])
await sleep(1500)
check('three pictures became three frames', (await cards()) === 3, await cards())
const dims = await page.js(`[...document.querySelectorAll('.sb-card img')].map(i => i.naturalWidth + 'x' + i.naturalHeight)`)
check('large picture was downscaled to 1600 px', dims.includes('1600x900') && dims.includes('640x360'), JSON.stringify(dims))
const src = await page.js(`document.querySelector('.sb-card img').src.slice(0, 23)`)
check('pictures are stored as JPEG data URLs', src === 'data:image/jpeg;base64,', src)

await chooseFiles('input[aria-label="Escolher imagens"]', [p('nao-imagem.txt')])
await sleep(500)
check('non-image file is refused', (await cards()) === 3)

// captions, scene, empty frame
await setValue('.sb-card:nth-child(1) textarea', 'Plano aberto da cozinha, chuva na janela.')
await sleep(200)
check('caption typed', (await caption(0)) === 'Plano aberto da cozinha, chuva na janela.', await caption(0))
const opts = await page.js(`[...document.querySelectorAll('.sb-card:nth-child(1) select option')].map(o => o.value)`)
check('scene list comes from the script', opts.length >= 3, JSON.stringify(opts))
await setValue('.sb-card:nth-child(1) select', opts[1])
await clickText('Quadro vazio')
await sleep(200)
check('empty frame added', (await cards()) === 4)

// a frame without a scene jumps next to the scene it is given, then goes back to the end
await setValue('.sb-card:nth-child(4) select', opts[1])
await sleep(300)
const jumped = await page.js(`[...document.querySelectorAll('.sb-card select')].map(s => s.value)`)
check('new frame jumps after the last frame of its scene', jumped[0] === opts[1] && jumped[1] === opts[1] && jumped[3] === '', JSON.stringify(jumped))
check('jumped frame keeps the focus', await page.js(`document.activeElement === document.querySelectorAll('.sb-card select')[1]`))
for (const n of [2, 3]) await page.js(`document.querySelector('button[aria-label="Mover quadro ${n} para depois"]').click()`)
await sleep(200)
check('arrows still move it inside the list', (await page.js(`document.querySelectorAll('.sb-card select')[3].value`)) === opts[1])

// reorder
await setValue('.sb-card:nth-child(2) textarea', 'Segundo plano.')
await page.js(`document.querySelector('.sb-card:nth-child(1) button[aria-label^="Mover quadro 1 para depois"]').click()`)
await sleep(200)
check('moving frame 1 after frame 2 swaps them', (await caption(0)) === 'Segundo plano.' && /Plano aberto/.test(await caption(1)), `${await caption(0)} | ${await caption(1)}`)

// screenshot of the tab
{
  const shot = await page.call('Page.captureScreenshot', { format: 'png' })
  writeFileSync(p('storyboard-tab.png'), Buffer.from(shot.result.data, 'base64'))
}

// layout, summary
await setValue('#sb-layout', '2')
await sleep(200)
const summary = await page.js(`document.querySelector('.sb-summary').innerText`)
check('summary counts pages for the layout', /4 quadro\(s\) · 2 página\(s\)/.test(summary), summary)
await setValue('#sb-layout', '4')
await setValue('#sb-aspect', '2.39:1')

// ---- save and reload
await setNext(null, p('com-storyboard.rottera'))
await clickText('Salvar como')
await sleep(1000)
check('file saved', existsSync(p('com-storyboard.rottera')))
const saved = JSON.parse(readFileSync(p('com-storyboard.rottera'), 'utf8'))
const sbSaved = saved.script.storyboard
check('file keeps frames, order, layout and aspect', sbSaved?.frames.length === 4 && sbSaved.layout === 4 && sbSaved.aspect === '2.39:1' && sbSaved.frames[0].caption === 'Segundo plano.', JSON.stringify(sbSaved?.frames.map((f) => f.caption)))

// ---- Claude tools for the storyboard through the real MCP server
const info = await page.js('window.api.connectInfo()')
const mcp = spawn(process.execPath, [info.mcpScript], { env: { ...process.env, ROTERA_BRIDGE_FILE: info.bridgeFile }, stdio: ['pipe', 'pipe', 'inherit'] })
let mbuf = ''
const mpend = new Map()
mcp.stdout.on('data', (d) => {
  mbuf += d
  let i
  while ((i = mbuf.indexOf('\n')) !== -1) {
    const line = mbuf.slice(0, i)
    mbuf = mbuf.slice(i + 1)
    if (!line.trim()) continue
    const m = JSON.parse(line)
    if (mpend.has(m.id)) {
      mpend.get(m.id)(m)
      mpend.delete(m.id)
    }
  }
})
let mid = 0
const rpc = (method, params = {}) =>
  new Promise((res) => {
    const i = ++mid
    mpend.set(i, res)
    mcp.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: i, method, params }) + '\n')
  })
const tool = async (name, args = {}) => {
  const r = await rpc('tools/call', { name, arguments: args })
  const text = r.result.content[0].text
  if (r.result.isError) return { error: text }
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}
await rpc('initialize', { protocolVersion: '2024-11-05' })
const got = await tool('get_storyboard')
check('get_storyboard lists frames without images', got.frames?.length === 4 && got.frames[0].hasImage === true && got.frames[3].hasImage === false && !JSON.stringify(got).includes('base64'), JSON.stringify(got).slice(0, 200))
const added = await tool('add_frame', { caption: 'Close no rosto de Marina.', scene: '1' })
check('add_frame plans a shot', added.frames === 5, JSON.stringify(added))
await sleep(300)
check('planned shot appears on screen', (await cards()) === 5 && /Close no rosto/.test(await caption(4)))
const setf = await tool('set_frame', { index: 4, caption: 'Close no rosto de Marina, olhar para a porta.' })
check('set_frame edits caption', /olhar para a porta/.test(setf.caption), JSON.stringify(setf))
const badf = await tool('set_frame', { index: 99, caption: 'x' })
check('set_frame rejects bad index', typeof badf.error === 'string')
const img = await tool('set_frame_image', { index: 4, path: p('a.png') })
check('set_frame_image puts a picture in a planned frame', img.hasImage === true, JSON.stringify(img))
const withImg = await tool('get_storyboard')
check('the frame now has an image, still not sent back', withImg.frames?.[4]?.hasImage === true && !JSON.stringify(withImg).includes('base64'), JSON.stringify(withImg).slice(0, 200))
const notImg = await tool('set_frame_image', { index: 4, path: p('nao-imagem.txt') })
check('set_frame_image refuses a file that is not a picture', typeof notImg.error === 'string', JSON.stringify(notImg))
const missing = await tool('set_frame_image', { index: 4, path: p('nao-existe.png') })
check('set_frame_image reports a missing file', typeof missing.error === 'string', JSON.stringify(missing))
const badIdx = await tool('set_frame_image', { index: 99, path: p('a.png') })
check('set_frame_image rejects bad index', typeof badIdx.error === 'string', JSON.stringify(badIdx))
mcp.kill()

// ---- PDFs
await setNext(null, p('completo.pdf'))
await clickText('Exportar PDF')
await sleep(3500)
check('PDF with storyboard written', existsSync(p('completo.pdf')))
const full = pdfPages(p('completo.pdf'))
// 5 frames at 4 per page = 2 storyboard pages
check('PDF = title + script + 2 storyboard pages', full.pages === scriptPages + 1 + 2, `${JSON.stringify(full)} script=${scriptPages}`)
check('PDF embeds the pictures', full.images >= 3, JSON.stringify(full))

await setNext(null, p('so-storyboard.pdf'))
await clickText('Mais')
await sleep(200)
await clickText('Exportar só o storyboard')
await sleep(3500)
check('storyboard-only PDF written', existsSync(p('so-storyboard.pdf')))
const only = pdfPages(p('so-storyboard.pdf'))
check('storyboard-only PDF has just the 2 storyboard pages', only.pages === 2, JSON.stringify(only))

await page.js(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))`)
await page.js(`[...document.querySelectorAll('.sb-bar input[type=checkbox], .board-bar input[type=checkbox]')].find(c => c.parentElement.textContent.includes('Incluir no PDF')).click()`)
await sleep(200)
await setNext(null, p('sem.pdf'))
await clickText('Exportar PDF')
await sleep(3500)
const without = pdfPages(p('sem.pdf'))
check('with the option off the PDF has only title + script', without.pages === scriptPages + 1 && without.images === 0, JSON.stringify(without))

// ---- reload from disk keeps pictures
await clickText('Início')
await sleep(900)
await setNext(p('com-storyboard.rottera'), null)
await clickText('Abrir')
await sleep(1000)
await clickText('Storyboard')
await sleep(300)
// 3 pictures added by hand plus the one Claude put in the 5th frame
check('reopened file shows its frames with pictures (autosave kept the 5th)', (await cards()) === 5 && (await page.js(`document.querySelectorAll('.sb-card img').length`)) === 4)

check('no renderer errors', page.errors.length === 0, page.errors.join(' | '))
console.log(JSON.stringify({ passed: results.filter((r) => r.ok).length, total: results.length, failed: results.filter((r) => !r.ok), files: work }, null, 2))
page.close()
main.close()
app.kill()
await sleep(500)
process.exit(0)
