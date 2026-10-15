// The real Windows file dialogs: import, save as, export PDF, open, cancel. The dialogs are driven with
// UI Automation (native-dialog.ps1); nothing is stubbed. Works on the dev tree or a packaged exe.
// usage: node tests/e2e/native-dialogs-e2e.mjs <app dir> [Rottera.exe]
import { execFile, spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const appDir = resolve(process.argv[2])
const exe = process.argv[3]
const require = createRequire(appDir + '/package.json')
const electron = exe || require('electron')
const port = 9450
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, extra = '') => results.push({ name, ok: Boolean(ok), extra: ok ? '' : String(extra).slice(0, 300) })

const work = mkdtempSync(join(tmpdir(), 'rottera-native-'))
const dir = join(work, 'Roteiros de ação & teste')
mkdirSync(dir)
const userData = join(work, 'userdata')
const fountain = join(dir, 'entrada.fountain')
writeFileSync(fountain, 'Title: Diálogo Nativo\nAuthor: Ana\n\nINT. COZINHA - DIA\n\nMarina coa café.\n\nMARINA\nVocê veio.\n', 'utf8')

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
const app = spawn(electron, exe ? [`--remote-debugging-port=${port}`, `--user-data-dir=${userData}`] : ['.', `--remote-debugging-port=${port}`, `--user-data-dir=${userData}`], {
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
const js = (expr) =>
  new Promise((res, rej) => {
    const i = ++id
    pending.set(i, (m) => (m.result.exceptionDetails ? rej(new Error('js error: ' + JSON.stringify(m.result.exceptionDetails).slice(0, 200))) : res(m.result.result.value)))
    ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }))
  })
ws.send(JSON.stringify({ id: ++id, method: 'Runtime.enable' }))
await sleep(1500)

// pid of the Electron main process: the one that listens on the debugging port
const pidOf = () =>
  new Promise((res) => {
    execFile('powershell', ['-NoProfile', '-Command', `(Get-NetTCPConnection -LocalPort ${port} -State Listen | Select-Object -First 1).OwningProcess`], (e, out) => res(Number(String(out).trim())))
  })
const mainPid = await pidOf()
check('found the app process', mainPid > 0, mainPid)

const helper = join(appDir, 'tests', 'e2e', 'native-dialog.ps1')
const dialog = (args) =>
  new Promise((res) => {
    execFile('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', helper, '-ProcessId', String(mainPid), ...args], { timeout: 40000 }, (e, out) => res(String(out).trim()))
  })
const click = (t) =>
  js(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith(${JSON.stringify(t)})); if (!b) return false; b.click(); return true })()`)
const blocks = () => js(`[...document.querySelectorAll('.sheet-content > p')].map(p => p.textContent)`)

// ---- import through the real dialog
await click('Importar FDX ou Fountain')
let r = await dialog(['-Path', fountain])
check('import dialog opened and accepted the path', r.startsWith('OK'), r)
await sleep(1200)
let b = await blocks()
check('imported script is in the editor', b.includes('Você veio.'), JSON.stringify(b))

// ---- cancel keeps everything as it was
await click('Exportar PDF')
r = await dialog(['-Cancel'])
check('cancel works on a save dialog', r.startsWith('CANCELLED'), r)
await sleep(600)
check('app still responsive and script unchanged after cancel', (await blocks()).includes('Você veio.'))

// ---- save as through the real dialog
const saved = join(dir, 'meu roteiro.rottera')
await click('Salvar como')
r = await dialog(['-Path', saved])
check('save dialog accepted a path with spaces, accents and &', r.startsWith('OK'), r)
await sleep(1200)
check('.rottera written', existsSync(saved))
if (existsSync(saved)) {
  const j = JSON.parse(readFileSync(saved, 'utf8'))
  check('saved content is right', j.script.titlePage.title === 'Diálogo Nativo' && j.script.blocks.length >= 4, JSON.stringify(j.script.titlePage))
}

// ---- export PDF through the real dialog
const pdf = join(dir, 'saída.pdf')
await click('Exportar PDF')
r = await dialog(['-Path', pdf])
check('PDF dialog accepted the path', r.startsWith('OK'), r)
for (let i = 0; i < 30 && !existsSync(pdf); i++) await sleep(300)
check('PDF written', existsSync(pdf))
if (existsSync(pdf)) {
  const t = readFileSync(pdf).toString('latin1')
  check('PDF is a PDF with 2 pages (title + script)', t.startsWith('%PDF') && (t.match(/\/Type\s*\/Page[^s]/g) || []).length === 2, (t.match(/\/Type\s*\/Page[^s]/g) || []).length)
}

// ---- export FDX and Fountain from the menu items
await click('Mais')
await sleep(200)
await click('Exportar FDX')
const fdx = join(dir, 'saída.fdx')
r = await dialog(['-Path', fdx])
await sleep(800)
check('FDX written through the real dialog', r.startsWith('OK') && existsSync(fdx), r)

// ---- open through the real dialog, from the home screen
await click('Início')
await sleep(900)
await click('Abrir')
r = await dialog(['-Path', saved])
check('open dialog accepted the path', r.startsWith('OK'), r)
await sleep(1200)
b = await blocks()
check('opened script has the same content', b.includes('Você veio.'), JSON.stringify(b))

// ---- opening a file that no longer exists is reported, not fatal
await click('Início')
await sleep(900)
await click('Abrir')
r = await dialog(['-Path', join(dir, 'nao-existe.rottera')])
await sleep(1200)
const stillThere = await js(`document.body.innerText.includes('Novo roteiro')`)
check('missing file: the dialog refuses or the app survives', stillThere, r)

check('no renderer errors', errors.length === 0, errors.join(' | '))
console.log(JSON.stringify({ passed: results.filter((x) => x.ok).length, total: results.length, failed: results.filter((x) => !x.ok), files: work }, null, 2))
ws.close()
app.kill()
await sleep(500)
process.exit(0)
