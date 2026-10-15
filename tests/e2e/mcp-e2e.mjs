// End-to-end: drives the Rottera app via CDP and edits it through the real MCP server over stdio.
import { spawn } from 'node:child_process'
import { writeFileSync, mkdirSync, mkdtempSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

// usage: node tests/e2e/mcp-e2e.mjs <app dir> <screenshot dir> [packaged Rottera.exe]
const appDir = resolve(process.argv[2])
const shotDir = resolve(process.argv[3])
const exe = process.argv[4] // optional packaged exe
const port = 9444
const require = createRequire(appDir + '/package.json')
const electron = exe || require('electron')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, extra = '') => {
  results.push({ name, ok: Boolean(ok), extra: ok ? '' : String(extra).slice(0, 300) })
}

// a throwaway data folder, so the run never touches the writer's recent files or versions
const userData = mkdtempSync(join(tmpdir(), 'rottera-mcp-'))
const env = { ...process.env, ROTERA_LEGACY_APPDATA: join(userData, 'none') }
delete env.ELECTRON_RUN_AS_NODE
// a window covered by another one stops painting, and screenshots then never return
const args = [`--remote-debugging-port=${port}`, `--user-data-dir=${userData}`, '--disable-features=CalculateNativeWinOcclusion']
const app = spawn(electron, exe ? args : ['.', ...args], {
  cwd: appDir,
  env,
  stdio: 'ignore'
})

async function pageWs() {
  for (let i = 0; i < 80; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
      const p = list.find((x) => x.type === 'page')
      if (p) return p.webSocketDebuggerUrl
    } catch {}
    await sleep(400)
  }
  throw new Error('no page')
}
const ws = new WebSocket(await pageWs())
await new Promise((r) => (ws.onopen = r))
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
const cdp = (method, params = {}) =>
  new Promise((res) => {
    const i = ++id
    pending.set(i, res)
    ws.send(JSON.stringify({ id: i, method, params }))
  })
const js = async (expr) => {
  const r = await cdp('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400))
  return r.result.result.value
}
const shot = async (name) => {
  mkdirSync(shotDir, { recursive: true })
  const r = await cdp('Page.captureScreenshot', { format: 'png' })
  writeFileSync(`${shotDir}/${name}.png`, Buffer.from(r.result.data, 'base64'))
}
const clickText = (t) =>
  js(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith(${JSON.stringify(t)})); if (!b) return false; b.click(); return true })()`)

const closePop = () => js("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))")
const openPop = async (label) => {
  await closePop()
  await sleep(100)
  await clickText(label)
  await sleep(200)
}
await cdp('Runtime.enable')
await sleep(1500)

// ---- MCP client
const info = await js(`window.api.connectInfo()`)
const mcp = spawn(process.execPath, [info.mcpScript], {
  env: { ...process.env, ROTERA_BRIDGE_FILE: info.bridgeFile },
  stdio: ['pipe', 'pipe', 'inherit']
})
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
    if (m.id !== undefined && mpend.has(m.id)) {
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
const domBlocks = () =>
  js(`[...document.querySelectorAll('.sheet-content > p')].map(p => ({k: p.dataset.kind, t: p.textContent, dual: p.dataset.dual, rev: p.dataset.rev, sn: p.dataset.sn}))`)

const init = await rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'e2e', version: '0' } })
check('mcp initialize', init.result?.serverInfo?.name === 'rottera', JSON.stringify(init))
const list = await rpc('tools/list')
check('mcp lists tools', list.result.tools.length >= 15, list.result.tools.length)

// bridge answers even on the home screen with a clear error
const homeStatus = await tool('status')
check('home screen says to open a script', typeof homeStatus.error === 'string', JSON.stringify(homeStatus))

// open a new script
await clickText('Novo roteiro')
await sleep(700)
await js(`document.querySelector('.sheet-content').focus()`)

const st = await tool('status')
check('status after new script', st.blockCount === 1 && st.pages === 1, JSON.stringify(st))

// write scenes as Fountain
const fountain = `INT. COZINHA - MANHÃ

Marina coa o café enquanto a chuva bate na janela.

MARINA
(baixo)
Você veio.

LUIZ
Eu disse que vinha.

EXT. RUA - NOITE

Luiz atravessa a rua sem guarda-chuva.

CORTA PARA:

INT. CARRO - NOITE

Silêncio.
`
const ins = await tool('insert_fountain', { text: fountain })
check('insert_fountain', ins.inserted >= 10, JSON.stringify(ins))
await sleep(300)
let dom = await domBlocks()
check('editor shows inserted blocks', dom.some((b) => b.t === 'Você veio.') && dom.some((b) => b.k === 'transition'), JSON.stringify(dom).slice(0, 200))

const outline = await tool('get_outline')
check('outline has 3 scenes (the empty starting heading was replaced)', outline.length === 3, JSON.stringify(outline).slice(0, 300))

// replace the empty first heading
const upd = await tool('update_block', { index: 0, text: 'INT. ESCRITÓRIO - DIA' })
check('update_block', upd.text === 'INT. ESCRITÓRIO - DIA', JSON.stringify(upd))

const mv = await tool('move_scene', { scene: 3, to: 1 })
check('move_scene', mv.scene === 3 && mv.to === 1, JSON.stringify(mv))
await sleep(200)
const outline2 = await tool('get_outline')
check('scene moved to the front', /CARRO/.test(outline2[0].heading), JSON.stringify(outline2.map((s) => s.heading)))

const found = await tool('find', { query: 'luiz' })
check('find is case-insensitive', found.count >= 2, JSON.stringify(found).slice(0, 200))
const rep = await tool('replace_all', { query: 'Luiz', replacement: 'Davi', caseSensitive: true })
check('replace_all', rep.replaced >= 1, JSON.stringify(rep))
const rep2 = await tool('replace_all', { query: 'LUIZ', replacement: 'DAVI', caseSensitive: true })
check('replace_all cue', rep2.replaced >= 1, JSON.stringify(rep2))

const tp = await tool('set_title_page', { title: 'Chuva', author: 'Ana Souza' })
check('set_title_page', tp.title === 'Chuva', JSON.stringify(tp))

// validation errors are reported, not thrown
const bad = await tool('insert_blocks', { blocks: [{ kind: 'nope', text: 'x' }] })
check('invalid kind rejected', typeof bad.error === 'string' && /kind/.test(bad.error), JSON.stringify(bad))
const bad2 = await tool('replace_blocks', { start: 5, end: 2, blocks: [] })
check('bad range rejected', typeof bad2.error === 'string', JSON.stringify(bad2))

// long content: page breaks drawn in the editor
const many = []
for (let i = 0; i < 40; i++) {
  many.push({ kind: 'scene_heading', text: `INT. LUGAR ${i} - DIA` })
  many.push({ kind: 'action', text: 'Uma descrição longa para ocupar linhas na página e forçar a quebra. '.repeat(3) })
}
const big = await tool('insert_blocks', { blocks: many })
check('insert 80 blocks', big.inserted === 80, JSON.stringify(big))
await sleep(500)
const breaks = await js(`document.querySelectorAll('.page-break').length`)
const pagesStatus = await js(`document.querySelector('.status').innerText`)
check('page breaks drawn in editor', breaks >= 3, `breaks=${breaks} status=${pagesStatus}`)

// dual dialogue
const dualIns = await tool('insert_blocks', {
  after: 8,
  blocks: [
    { kind: 'character', text: 'ANA' },
    { kind: 'dialogue', text: 'Falo primeiro.' },
    { kind: 'character', text: 'BIA', dual: true },
    { kind: 'dialogue', text: 'E eu falo junto.', dual: true }
  ]
})
await sleep(300)
dom = await domBlocks()
check('dual dialogue flagged in editor', dom.filter((b) => b.dual === 'true').length === 2, JSON.stringify(dom.filter((b) => b.dual)))
await js(`window.__x = 1`)

// beat board
const ap = await tool('apply_structure', { id: 'tres-atos' })
check('apply_structure', ap.applied === 'tres-atos', JSON.stringify(ap))
const ab = await tool('add_beat', { lane: 'Ato I', title: 'Chegada de Davi', body: 'Ele aparece sem avisar.', color: 'azul' })
check('add_beat', typeof ab.added === 'string', JSON.stringify(ab))
const beats = await tool('get_beats')
check('beats list', beats.lanes.length === 4 && beats.beats.length >= 10, JSON.stringify(beats).slice(0, 200))
const again = await tool('apply_structure', { id: 'circulo' })
check('apply_structure refuses to overwrite', typeof again.error === 'string', JSON.stringify(again))
const cat = await tool('apply_structure', { id: 'save-the-cat', replace: true })
const catBeats = await tool('get_beats')
check(
  'structure from the map: Save the Cat, 15 beats in three acts',
  cat.applied === 'save-the-cat' && catBeats.lanes.length === 3 && catBeats.beats.length === 15,
  JSON.stringify(catBeats).slice(0, 200)
)

// reports
const rp = await tool('get_reports', { id: 'personagens' })
check('report personagens', rp.rows.some((r) => r[0] === 'MARINA'), JSON.stringify(rp).slice(0, 200))
const all = await tool('get_reports')
check('eight reports', all.length === 8, all.length)

// revision mode on, then an edit gets a revision mark
await openPop('Produção')
await js(`(() => { const c = [...document.querySelectorAll('.popover-panel input[type=checkbox]')][0]; c.click() })()`)
await sleep(200)
await closePop()
const before = (await domBlocks()).filter((b) => b.rev).length
await tool('update_block', { index: 1, text: 'Marina coa o café. A chuva bate forte na janela.' })
await sleep(300)
dom = await domBlocks()
check('revision mode marks edited block', before === 0 && dom.some((b) => b.rev === 'azul'), JSON.stringify(dom.filter((b) => b.rev)).slice(0, 200))

// scene numbers on + locked
await openPop('Produção')
await js(`(() => { const cs = [...document.querySelectorAll('.popover-panel input[type=checkbox]')]; cs[1].click() })()`)
await sleep(200)
dom = await domBlocks()
check('scene numbers shown', dom.some((b) => b.sn === '1'), JSON.stringify(dom.filter((b) => b.sn).slice(0, 3)))
await js(`(() => { const cs = [...document.querySelectorAll('.popover-panel input[type=checkbox]')]; cs[2].click() })()`)
await sleep(300)
await tool('insert_blocks', { after: 1, blocks: [{ kind: 'scene_heading', text: 'INT. SALA - DIA' }] })
await sleep(300)
dom = await domBlocks()
check('new scene after lock gets a letter', dom.some((b) => /^\d+A$/.test(b.sn || '')), JSON.stringify(dom.filter((b) => b.sn).slice(0, 5)))
await closePop()

// find bar (UI)
await clickText('Localizar')
await sleep(200)
await js(`(() => { const i = document.querySelector('#f-q'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; set.call(i,'chuva'); i.dispatchEvent(new Event('input',{bubbles:true})) })()`)
await sleep(300)
const hits = await js(`document.querySelectorAll('.find-hit').length`)
check('find highlights hits', hits >= 1, hits)

await shot('editor-features')

// panels
await clickText('Beat Board')
await sleep(300)
await shot('board')
check('board shows lanes', (await js(`document.querySelectorAll('.lane').length`)) === 3)
check('structure picker grouped in six families', (await js(`document.querySelectorAll('#structure optgroup').length`)) === 6)
await js(`(() => { const s = document.getElementById('structure'); s.value = 'jornada-heroi'; s.dispatchEvent(new Event('change', { bubbles: true })) })()`)
await sleep(200)
const about = await js(`document.querySelector('.board-about')?.innerText ?? ''`)
check('picked structure shows its source', /Campbell/.test(about), about)
await shot('board-picker')
await clickText('Relatórios')
await sleep(300)
await shot('reports')
check('reports table renders', (await js(`document.querySelectorAll('.reports table tbody tr').length`)) >= 1)
await clickText('Roteiro')
await sleep(200)

// connect dialog
await openPop('Mais')
await clickText('Conectar ao Claude')
await sleep(400)
const dlg = await js(`document.querySelector('dialog')?.innerText ?? ''`)
check('connect dialog shows commands', /claude mcp add rottera/.test(dlg), dlg.slice(0, 200))
await shot('connect')

check('no renderer errors', errors.length === 0, errors.join(' | '))

console.log(JSON.stringify({ passed: results.filter((r) => r.ok).length, total: results.length, failed: results.filter((r) => !r.ok) }, null, 2))
mcp.kill()
ws.close()
app.kill()
await sleep(500)
process.exit(0)
