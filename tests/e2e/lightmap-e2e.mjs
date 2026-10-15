// "Mapa de Luz" tab, end to end: palette, dragging with the real mouse, properties, undo, several maps,
// the Claude tools through the MCP server, save and reopen, and the PDFs.
// usage: node tests/e2e/lightmap-e2e.mjs <app dir> [packaged Rottera.exe]
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, mkdtempSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const appDir = resolve(process.argv[2])
const exe = process.argv[3]
const require = createRequire(appDir + '/package.json')
const electron = exe || require('electron')
const cdpPort = 9449
const inspectPort = 9559
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const work = join(tmpdir(), 'rottera-lightmap-e2e')
rmSync(work, { recursive: true, force: true })
mkdirSync(work, { recursive: true })
const p = (n) => join(work, n)
const results = []
const check = (name, ok, extra = '') => results.push({ name, ok: Boolean(ok), extra: ok ? '' : String(extra).slice(0, 400) })

let fountain = 'Title: Chuva\nAuthor: Ana Souza\n\nINT. COZINHA - MANHÃ\n\nMarina coa o café.\n\nMARINA\nVocê veio.\n'
for (let i = 0; i < 6; i++) fountain += `\nEXT. RUA ${i} - NOITE\n\n${'Descrição longa para ocupar linhas. '.repeat(4)}\n`
writeFileSync(p('roteiro.fountain'), fountain, 'utf8')

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
const setValue = (selector, value) =>
  page.js(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })) })()`)
const itemCount = () => page.js(`document.querySelectorAll('.lm-surface [data-item]').length`)
const pdfPages = (file) => {
  const t = readFileSync(file).toString('latin1')
  return (t.match(/\/Type\s*\/Page[^s]/g) || []).length
}
const mouse = (type, x, y) =>
  page.call('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 })

// ---- script with title and a few pages
await setNext(p('roteiro.fountain'), null)
await clickText('Importar FDX ou Fountain')
await sleep(900)
const scriptPages = Number(/de (\d+)/.exec(await page.js(`document.querySelector('.status').innerText`))?.[1])

check('Mapa de Luz tab exists', await clickText('Mapa de Luz'))
await sleep(300)
check('empty state offers to create a map', (await page.js(`document.body.innerText`)).includes('Criar o primeiro mapa'))
await clickText('Criar o primeiro mapa')
await sleep(300)
check('first map created', (await page.js(`document.querySelectorAll('.lm-maps li').length`)) === 1)

// ---- palette
for (const name of ['Câmera', 'Ator ou atriz', 'Fresnel', 'Bandeira (negativo)', 'Softbox']) {
  const ok = await page.js(`(() => { const b = [...document.querySelectorAll('.lm-piece')].find(b => b.textContent.trim() === ${JSON.stringify(name)}); if (!b) return false; b.click(); return true })()`)
  check(`palette adds ${name}`, ok)
  await sleep(120)
}
check('five items on the drawing', (await itemCount()) === 5, await itemCount())
check('item list mirrors the drawing', (await page.js(`document.querySelectorAll('.lm-items li').length`)) === 5)

// ---- real mouse drag of the second item (actor)
await page.js(`document.querySelectorAll('.lm-items button')[1].click()`)
await sleep(150)
const before = await page.js(`({ x: Number(document.querySelector('#it-x').value), y: Number(document.querySelector('#it-y').value) })`)
const geo = await page.js(`(() => { const r = document.querySelector('.lm-surface svg').getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height, mw: Number(document.querySelector('#lm-w').value) } })()`)
const k = geo.w / geo.mw
const sx = geo.l + before.x * k
const sy = geo.t + before.y * k
await mouse('mouseMoved', sx, sy)
await mouse('mousePressed', sx, sy)
await mouse('mouseMoved', sx + k * 1.0, sy + k * 0.5)
await mouse('mouseMoved', sx + k * 2.0, sy + k * 1.0)
await mouse('mouseReleased', sx + k * 2.0, sy + k * 1.0)
await sleep(250)
const after = await page.js(`({ x: Number(document.querySelector('#it-x').value), y: Number(document.querySelector('#it-y').value) })`)
check('dragging with the mouse moves the item by about 2 m and 1 m', Math.abs(after.x - before.x - 2) < 0.25 && Math.abs(after.y - before.y - 1) < 0.25, JSON.stringify({ before, after }))

// ---- properties
await setValue('#it-label', 'Marina')
await setValue('#it-rot', '180')
await sleep(200)
const svgText = await page.js(`document.querySelector('.lm-surface svg').textContent`)
check('label shows on the drawing', svgText.includes('Marina'))
const rot = await page.js(`document.querySelector('.lm-surface [data-item] > g[transform^="rotate"]') !== null`)
check('item groups carry a rotation', rot)

// keyboard: nudge and rotate on the focused drawing
await page.js(`document.querySelector('.lm-surface').focus()`)
const x0 = Number(await page.js(`document.querySelector('#it-x').value`))
await page.call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 })
await page.call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 })
await sleep(150)
const x1 = Number(await page.js(`document.querySelector('#it-x').value`))
check('arrow key nudges by 0.1 m', Math.abs(x1 - x0 - 0.1) < 0.03, `${x0} -> ${x1}`)

// undo
await clickText('Desfazer')
await sleep(150)
const x2 = Number(await page.js(`document.querySelector('#it-x').value`))
check('undo brings the position back', Math.abs(x2 - x0) < 0.03, `${x0} / ${x2}`)

// map settings
await setValue('#lm-name', 'Cozinha - manhã')
const sceneOpts = await page.js(`[...document.querySelectorAll('#lm-scene option')].map(o => o.value)`)
check('scene list comes from the script', sceneOpts.length >= 3, JSON.stringify(sceneOpts))
await setValue('#lm-scene', sceneOpts[1])
await setValue('#lm-notes', 'Janela à esquerda. Luz fria, 5600K.')
await sleep(200)

// second map, duplicate, delete
await clickText('Novo mapa')
await sleep(200)
check('second map created', (await page.js(`document.querySelectorAll('.lm-maps li').length`)) === 2)
await clickText('Duplicar')
await sleep(200)
check('duplicate makes a third', (await page.js(`document.querySelectorAll('.lm-maps li').length`)) === 3)
await main.js(`true`)
await page.js(`window.confirm = () => true`)
await clickText('Apagar')
await sleep(200)
check('delete removes it', (await page.js(`document.querySelectorAll('.lm-maps li').length`)) === 2)
await page.js(`document.querySelectorAll('.lm-maps button')[0].click()`)
await sleep(150)
check('first map still has its five items', (await itemCount()) === 5)

// ---- Claude tools through MCP
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
const lm = await tool('get_lightmaps')
check('get_lightmaps lists the maps and items', lm.length === 2 && lm[0].items.length === 5 && lm[0].name === 'Cozinha - manhã', JSON.stringify(lm).slice(0, 200))
const cr = await tool('create_lightmap', { name: 'Rua - noite', scene: '2', width: 10, height: 7 })
check('create_lightmap', cr.index === 2 && cr.width === 10, JSON.stringify(cr))
const ad = await tool('add_light_item', { map: 'Rua - noite', type: 'hmi', x: 2, y: 1.5, rotation: 135, label: 'Lua 4K', spread: 25, range: 5 })
check('add_light_item', ad.name === 'HMI', JSON.stringify(ad))
await tool('add_light_item', { map: 2, type: 'camera', x: 7, y: 5, rotation: 300, label: 'CAM A' })
const upd = await tool('update_light_item', { map: 2, item: 0, x: 2.5, label: 'Lua 4K (alta)' })
check('update_light_item', upd.x === 2.5 && /alta/.test(upd.label), JSON.stringify(upd))
const badType = await tool('add_light_item', { map: 0, type: 'laser' })
check('unknown type refused', typeof badType.error === 'string', JSON.stringify(badType))
const badMap = await tool('add_light_item', { map: 'nao existe', type: 'camera' })
check('unknown map refused', typeof badMap.error === 'string', JSON.stringify(badMap))
const rm = await tool('remove_light_item', { map: 0, item: 4 })
check('remove_light_item', rm.remaining === 4, JSON.stringify(rm))
await sleep(300)
await page.js(`document.querySelectorAll('.lm-maps button')[2].click()`)
await sleep(200)
check('the map made by Claude shows on screen with its pieces', (await itemCount()) === 2, await itemCount())
mcp.kill()

// screenshot for a look
{
  const shot = await page.call('Page.captureScreenshot', { format: 'png' })
  writeFileSync(p('lightmap-tab.png'), Buffer.from(shot.result.data, 'base64'))
}

// ---- save, reopen
await setNext(null, p('com-mapas.rottera'))
await clickText('Salvar como')
await sleep(1000)
const saved = JSON.parse(readFileSync(p('com-mapas.rottera'), 'utf8'))
check('file stores three maps', saved.script.lightMaps?.length === 3, saved.script.lightMaps?.length)
check('file keeps scene, notes and rotation', saved.script.lightMaps[0].notes.includes('5600K') && saved.script.lightMaps[0].items[1].rotation === 180 && saved.script.lightMaps[0].scene === sceneOpts[1], JSON.stringify(saved.script.lightMaps[0]).slice(0, 200))

// ---- PDFs
await setNext(null, p('completo.pdf'))
await clickText('Exportar PDF')
await sleep(3500)
check('PDF written', existsSync(p('completo.pdf')))
// title + script pages + 3 map pages (all included by default)
check('script PDF ends with the three map pages', pdfPages(p('completo.pdf')) === scriptPages + 1 + 3, `${pdfPages(p('completo.pdf'))} vs ${scriptPages}+1+3`)

await page.js(`document.querySelectorAll('.lm-maps button')[1].click()`)
await sleep(200)
await page.js(`[...document.querySelectorAll('.board-bar input[type=checkbox]')].find(c => c.parentElement.textContent.includes('Incluir no PDF')).click()`)
await sleep(200)
await setNext(null, p('menos.pdf'))
await clickText('Exportar PDF')
await sleep(3500)
check('leaving one map out removes its page', pdfPages(p('menos.pdf')) === scriptPages + 1 + 2, String(pdfPages(p('menos.pdf'))))

await setNext(null, p('so-mapas.pdf'))
await clickText('Exportar mapas')
await sleep(3500)
check('maps-only PDF has all three maps', pdfPages(p('so-mapas.pdf')) === 3, String(pdfPages(p('so-mapas.pdf'))))

await clickText('Início')
await sleep(900)
await setNext(p('com-mapas.rottera'), null)
await clickText('Abrir')
await sleep(1000)
await clickText('Mapa de Luz')
await sleep(300)
check('reopened file shows the maps', (await page.js(`document.querySelectorAll('.lm-maps li').length`)) === 3)

check('no renderer errors', page.errors.length === 0, page.errors.join(' | '))
console.log(JSON.stringify({ passed: results.filter((r) => r.ok).length, total: results.length, failed: results.filter((r) => !r.ok), files: work }, null, 2))
page.close()
main.close()
app.kill()
await sleep(500)
process.exit(0)
