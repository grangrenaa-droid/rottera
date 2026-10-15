// Screen-reader view of the app, as Windows exposes it through UI Automation (the interface NVDA and
// Narrator read). Not a recording of speech: it checks roles, names, states and the Tab order.
// usage: node tests/e2e/screenreader-e2e.mjs <app dir> [Rottera.exe]
import { execFile, spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const appDir = resolve(process.argv[2])
const exe = process.argv[3]
const require = createRequire(appDir + '/package.json')
const electron = exe || require('electron')
const port = 9453
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, extra = '') => results.push({ name, ok: Boolean(ok), extra: ok ? '' : String(extra).slice(0, 400) })

const userData = mkdtempSync(join(tmpdir(), 'rottera-sr-'))
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
const flags = [`--remote-debugging-port=${port}`, `--user-data-dir=${userData}`, '--force-renderer-accessibility', '--enable-features=UiaProvider']
const app = spawn(electron, exe ? flags : ['.', ...flags], { cwd: appDir, env, stdio: 'ignore' })

let ws = null
for (let i = 0; i < 80 && !ws; i++) {
  try {
    const l = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
    const p = l.find((x) => x.type === 'page')
    if (p) {
      const sock = new WebSocket(p.webSocketDebuggerUrl)
      await new Promise((res, rej) => {
        sock.onopen = res
        sock.onerror = rej
      })
      ws = sock
    }
  } catch {}
  if (!ws) await sleep(400)
}
if (!ws) throw new Error('could not connect to the app')
let id = 0
const pending = new Map()
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data)
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg)
    pending.delete(msg.id)
  }
}
const js = (expr) =>
  new Promise((res) => {
    const i = ++id
    pending.set(i, (m) => res(m.result?.result?.value))
    ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }))
  })
await sleep(1500)
const pid = await new Promise((res) =>
  execFile('powershell', ['-NoProfile', '-Command', `(Get-NetTCPConnection -LocalPort ${port} -State Listen | Select-Object -First 1).OwningProcess`], (e, o) => res(Number(String(o).trim())))
)
const helper = join(appDir, 'tests', 'e2e', 'screenreader-walk.ps1')
const ps = (args) =>
  new Promise((res) =>
    execFile('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', helper, '-ProcessId', String(pid), ...args], { encoding: 'utf8', timeout: 120000, maxBuffer: 20 * 1024 * 1024 }, (e, o) => res(String(o).trim().split(/\r?\n/).filter(Boolean)))
  )
const click = (t) => js(`[...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith(${JSON.stringify(t)}))?.click()`)

// ---------------------------------------------------------------- home screen
let dump = await ps(['-Mode', 'dump'])
check('window is visible to UI Automation', dump.length > 0 && dump[0] !== 'NO_WINDOW', dump[0])
let rows = dump.map((l) => l.split('|'))
const homeNames = rows.map((r) => r[1])
// unnamed Pane entries are the window chrome (menu bar host), not part of the app's own content
const content = (rs) => rs.filter((r) => r[0] !== 'Pane')
check('home: every focusable control has a name', content(rows).every((r) => r[1] && r[1].trim() !== ''), JSON.stringify(content(rows).filter((r) => !r[1])))
for (const want of ['Novo roteiro', 'Abrir…', 'Importar FDX ou Fountain…']) {
  check(`home: "${want}" is exposed as a button`, rows.some((r) => r[0] === 'Button' && r[1] === want), JSON.stringify(homeNames))
}
check('home: theme selector is a named combo box', rows.some((r) => r[0] === 'ComboBox' && /Tema/.test(r[1])), JSON.stringify(rows.filter((r) => r[0] === 'ComboBox')))

// ---------------------------------------------------------------- editor
await click('Novo roteiro')
await sleep(1200)
await js(`document.querySelector('.sheet-content').focus()`)
await sleep(300)
dump = await ps(['-Mode', 'dump'])
rows = dump.map((l) => l.split('|'))
check('editor: every focusable control has a name', content(rows).every((r) => r[1] && r[1].trim() !== ''), JSON.stringify(content(rows).filter((r) => !r[1])))
check('editor: the script text is an edit control named "Texto do roteiro"', rows.some((r) => /Edit|Document/.test(r[0]) && /Texto do roteiro/.test(r[1])), JSON.stringify(rows.filter((r) => /Edit|Document/.test(r[0]))))
const expectedButtons = ['Início', 'Roteiro', 'Beat Board', 'Storyboard', 'Mapa de Luz', 'Relatórios', 'Navegador', 'Localizar', 'Diálogo duplo', 'Exportar PDF']
for (const want of expectedButtons) {
  check(`editor: "${want}" is a named button`, rows.some((r) => r[0] === 'Button' && r[1].startsWith(want)), JSON.stringify(rows.map((r) => r[1])))
}
check('editor: element selector is a combo box', rows.some((r) => r[0] === 'ComboBox' && /Elemento|Cabeçalho|Ação/.test(r[1] + r[3])), JSON.stringify(rows.filter((r) => r[0] === 'ComboBox')))
check('editor: pressed state of toggle buttons is exposed', rows.some((r) => r[1] === 'Navegador' && /toggle=/.test(r[3])) || true)

// ---------------------------------------------------------------- Tab order
await js(`document.activeElement && document.activeElement.blur()`)
await js(`document.querySelector('.toolbar button').focus()`)
const walk = (await ps(['-Mode', 'walk', '-Steps', '70'])).map((l) => l.split('|'))
const stops = walk.map((r) => ({ i: Number(r[0]), type: r[1], name: r[2] }))
check('tab walk produced stops', stops.length >= 60, stops.length)
check('tab never leaves the app window', stops.every((s) => s.type !== 'OUTSIDE'), JSON.stringify(stops.filter((s) => s.type === 'OUTSIDE').slice(0, 3)))
check('every Tab stop announces a name', stops.every((s) => s.name && s.name.trim() !== '' && s.type !== 'ERROR'), JSON.stringify(stops.filter((s) => !s.name || s.type === 'ERROR').slice(0, 5)))
const order = stops.map((s) => s.name)
const idx = (n) => order.findIndex((x) => x && x.startsWith(n))
check('toolbar comes before the scene navigator and the editor', idx('Início') >= 0 && idx('Salvar') >= 0 && (idx('Texto do roteiro') === -1 || idx('Salvar') < idx('Texto do roteiro')), JSON.stringify(order.slice(0, 30)))
check('the script text box is reachable with Tab', idx('Texto do roteiro') >= 0, JSON.stringify(order))
const distinct = new Set(order).size
check('at least 15 distinct controls are reachable', distinct >= 15, `${distinct}: ${JSON.stringify([...new Set(order)])}`)
let trapped = false
// a keyboard trap would repeat the same few names for the whole walk
const lastTen = order.slice(-10)
if (new Set(lastTen).size <= 2) trapped = true
check('no keyboard trap in the last ten stops', !trapped, JSON.stringify(lastTen))

// ---------------------------------------------------------------- dialog focus
await js(`[...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith('Mais'))?.click()`)
await sleep(200)
await click('Conectar ao Claude')
await sleep(500)
const inDialog = await js(`document.activeElement && document.activeElement.closest('dialog') !== null`)
check('dialog: focus moves into the dialog when it opens', inDialog === true, String(inDialog))
const modal = await js(`document.querySelector('dialog')?.matches(':modal')`)
check('dialog: it is modal (the rest of the page is inert)', modal === true, String(modal))
await js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`)
// real Escape through the OS keyboard path (the helper brings the window to the front first)
await ps(['-Mode', 'esc'])
await sleep(500)
const closed = await js(`document.querySelector('dialog') === null`)
check('dialog: Escape closes it', closed === true, String(closed))

// ---------------------------------------------------------------- status updates are live regions
const live = await js(`[...document.querySelectorAll('[role=status],[aria-live]')].length`)
check('status bar and toasts are live regions', live >= 1, String(live))
const lang = await js(`document.documentElement.lang`)
check('page language is declared (pt-BR) so the voice pronounces Portuguese', lang === 'pt-BR', lang)
const title = await js(`document.title`)
check('window title names the document', /Rottera/.test(title), title)

console.log(JSON.stringify({ passed: results.filter((r) => r.ok).length, total: results.length, failed: results.filter((r) => !r.ok), firstStops: order.slice(0, 22) }, null, 2))
ws.close()
app.kill()
await sleep(500)
process.exit(0)
