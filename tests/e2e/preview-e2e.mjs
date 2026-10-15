// Print preview, end to end: Visualizar opens a window with the same PDF Exportar PDF writes,
// reuses it on the next click and the menu shortcut, and removes the temporary file when it closes.
// usage: node tests/e2e/preview-e2e.mjs <app dir> [packaged Rottera.exe]
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

const work = join(tmpdir(), 'rottera-preview-e2e')
rmSync(work, { recursive: true, force: true })
mkdirSync(work, { recursive: true })
const p = (n) => join(work, n)
const results = []
const check = (name, ok, extra = '') => results.push({ name, ok: Boolean(ok), extra: ok ? '' : String(extra).slice(0, 400) })

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
const pdfPages = (file) => {
  const t = readFileSync(file).toString('latin1')
  return { pages: (t.match(/\/Type\s*\/Page[^s]/g) || []).length, images: (t.match(/\/Subtype\s*\/Image/g) || []).length }
}

// ---- open a script with a title and several pages
await setNext(p('roteiro.fountain'), null)
await clickText('Importar FDX ou Fountain')
await sleep(900)
const scriptPages = Number(/de (\d+)/.exec(await page.js(`document.querySelector('.status').innerText`))?.[1])
check('script imported', scriptPages >= 2, scriptPages)

// ---- the preview window
const previewFile = await main.js(`require('path').join(require('electron').app.getPath('userData'), 'preview.pdf')`)
const windows = () =>
  main.js(`require('electron').BrowserWindow.getAllWindows().map(w => ({ title: w.getTitle(), url: w.webContents.getURL(), visible: w.isVisible() }))`)
check('Visualizar button sits in the toolbar', await page.js(`(() => { const b = [...document.querySelectorAll('.toolbar button, button')].map(b => b.textContent.trim()); return b.indexOf('Visualizar') >= 0 && b.indexOf('Visualizar') === b.indexOf('Exportar PDF') - 1 })()`))
await clickText('Visualizar')
await sleep(3500)
let ws = await windows()
const pv = ws.find((w) => w.title.startsWith('Visualizar impressão'))
check('a preview window opens, named after the script', ws.length === 2 && pv?.title === 'Visualizar impressão — Chuva' && pv.visible, JSON.stringify(ws))
check('it shows the generated PDF', /preview\.pdf\?\d+$/.test(pv?.url ?? ''), pv?.url)
const shown = existsSync(previewFile) ? pdfPages(previewFile) : null
check('the preview is the full print: title page + script', shown?.pages === scriptPages + 1, `${JSON.stringify(shown)} script=${scriptPages}`)
await setNext(null, p('exportado.pdf'))
await clickText('Exportar PDF')
await sleep(3500)
check('Exportar PDF writes the same pages', existsSync(p('exportado.pdf')) && pdfPages(p('exportado.pdf')).pages === shown?.pages)
{
  const png = await main.js(`(async () => { const w = require('electron').BrowserWindow.getAllWindows().find(w => w.getTitle().startsWith('Visualizar')); await new Promise(r => setTimeout(r, 1500)); return (await w.webContents.capturePage()).toPNG().toString('base64') })()`)
  writeFileSync(p('preview-window.png'), Buffer.from(png, 'base64'))
}

// ---- clicking again and the menu shortcut reuse the same window
await clickText('Visualizar')
await sleep(3000)
check('clicking again refreshes the same window', (await windows()).length === 2)
await main.js(`(() => {
  const find = (items) => { for (const i of items) { if (i.label === 'Visualizar impressão') return i; if (i.submenu) { const f = find(i.submenu.items); if (f) return f } } }
  const item = find(require('electron').Menu.getApplicationMenu().items)
  globalThis.__accel = item?.accelerator
  item.click(undefined, require('electron').BrowserWindow.getAllWindows().find(w => !w.getTitle().startsWith('Visualizar')))
})()`)
await sleep(3000)
check('menu item has Ctrl+Shift+P', (await main.js('globalThis.__accel')) === 'CmdOrCtrl+Shift+P')
check('menu item reuses the window too', (await windows()).length === 2)

// ---- closing it removes the temporary file
await main.js(`require('electron').BrowserWindow.getAllWindows().find(w => w.getTitle().startsWith('Visualizar')).close()`)
await sleep(800)
check('closing the preview leaves only the main window', (await windows()).length === 1)
check('closing the preview deletes its temporary PDF', !existsSync(previewFile), previewFile)

check('no renderer errors', page.errors.length === 0, page.errors.join(' | '))
console.log(JSON.stringify({ passed: results.filter((r) => r.ok).length, total: results.length, failed: results.filter((r) => !r.ok), files: work }, null, 2))
page.close()
main.close()
app.kill()
await sleep(500)
process.exit(0)
