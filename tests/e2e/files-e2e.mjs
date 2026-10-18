// Verifies the native-dialog features by stubbing Electron's dialog module in the main process
// (through the Node inspector) and then driving the real UI: import, save, open, export PDF / FDX /
// Fountain / CSV, recent list and draft recovery. Reads the files back from disk.
// usage: node tests/e2e/files-e2e.mjs <app dir> [packaged Rottera.exe]
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const appDir = resolve(process.argv[2])
const exe = process.argv[3]
const require = createRequire(appDir + '/package.json')
const electron = exe || require('electron')
const cdpPort = 9446
const inspectPort = 9556

const work = join(tmpdir(), 'rottera-files-e2e')
rmSync(work, { recursive: true, force: true })
mkdirSync(work, { recursive: true })
const p = (n) => join(work, n)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, extra = '') => results.push({ name, ok: Boolean(ok), extra: ok ? '' : String(extra).slice(0, 400) })

const fountain = `Title: Chuva
Author: Ana Souza

INT. COZINHA - MANHÃ

Marina coa o café enquanto a chuva bate na janela.

MARINA
(baixo)
Você veio.

DAVI
Eu disse que vinha.

CORTA PARA:

EXT. RUA - NOITE

Davi atravessa a rua sem guarda-chuva.
`
// make it long enough for several pages
let longer = fountain
for (let i = 0; i < 30; i++) {
  longer += `\nINT. LUGAR ${i} - DIA\n\n${'Uma descrição que ocupa algumas linhas da página. '.repeat(4)}\n\nANA\nUma fala de teste número ${i}.\n`
}
writeFileSync(p('entrada.fountain'), longer, 'utf8')

// data left by the app under its previous name, Rotera: a recent file and a saved version
const legacy = p('appdata')
mkdirSync(join(legacy, 'Rotera', 'backups', 'k1'), { recursive: true })
writeFileSync(
  p('antigo.rotera'),
  JSON.stringify({ format: 'rotera', version: 1, savedAt: '2026-10-01T00:00:00Z', script: { titlePage: { title: 'Antigo', author: '', contact: '' }, blocks: [{ kind: 'action', text: 'Texto antigo.' }] } }),
  'utf8'
)
writeFileSync(join(legacy, 'Rotera', 'recent.json'), JSON.stringify([{ path: p('antigo.rotera'), name: 'antigo', openedAt: '2026-10-01T00:00:00Z' }]), 'utf8')
writeFileSync(join(legacy, 'Rotera', 'backups', 'k1', 'v.json'), '{}', 'utf8')
const userData = p('userdata')

const env = { ...process.env, ROTERA_LEGACY_APPDATA: legacy }
delete env.ELECTRON_RUN_AS_NODE
const args = [`--remote-debugging-port=${cdpPort}`, `--inspect=${inspectPort}`, `--user-data-dir=${userData}`]
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

// stub the native dialogs in the main process
const stub = await main.js(`(() => {
  const { dialog } = require('electron')
  globalThis.__next = { open: null, save: null }
  dialog.showOpenDialog = async (_w, o) => (globalThis.__lastOpen = o) && globalThis.__next.open ? { canceled: false, filePaths: [globalThis.__next.open] } : { canceled: true, filePaths: [] }
  dialog.showSaveDialog = async () => globalThis.__next.save ? { canceled: false, filePath: globalThis.__next.save } : { canceled: true }
  return 'stubbed'
})()`)
check('dialogs stubbed in main process', stub === 'stubbed', stub)
const setNext = (open, save) =>
  main.js(`globalThis.__next = { open: ${JSON.stringify(open)}, save: ${JSON.stringify(save)} }`)

const clickText = (t) =>
  page.js(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith(${JSON.stringify(t)})); if (!b) return false; b.click(); return true })()`)
const domBlocks = () =>
  page.js(`[...document.querySelectorAll('.sheet-content > p')].map(p => ({k: p.dataset.kind, t: p.textContent}))`)
const closePop = () => page.js("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))")
const openPop = async (label) => {
  await closePop()
  await sleep(100)
  await clickText(label)
  await sleep(200)
}

// ---- data from Rotera is carried over on the first run
const first = await page.js(`document.body.innerText`)
check('recent list from Rotera carried over', /antigo/i.test(first), first.slice(0, 300))
check('saved versions from Rotera carried over', existsSync(join(userData, 'backups', 'k1', 'v.json')))
check('Rotera data folder left in place', existsSync(join(legacy, 'Rotera', 'recent.json')))

// ---- import Fountain
await setNext(p('entrada.fountain'), null)
check('import button present', await clickText('Importar FDX ou Fountain'))
await sleep(800)
let dom = await domBlocks()
check('imported Fountain shows in editor', dom.length > 60 && dom.some((b) => b.t === 'Você veio.'), JSON.stringify(dom.slice(0, 4)))
const status = await page.js(`document.querySelector('.status').innerText`)
check('imported script has several pages', /Página \d+ de ([2-9]|\d{2})\b/.test(status), status)

// ---- save as (explicit)
await setNext(null, p('roteiro'))
check('save as button', await clickText('Salvar como'))
await sleep(800)
check('new file gets the .rottera extension', existsSync(p('roteiro.rottera')))
let saved = JSON.parse(readFileSync(p('roteiro.rottera'), 'utf8'))
check('saved file has format, title and blocks', saved.format === 'rotera' && saved.script.titlePage.title === 'Chuva' && saved.script.blocks.length === dom.length, JSON.stringify(saved.script.titlePage))
check('no temp files left next to it', !existsSync(p('roteiro.rottera') + `.tmp-${0}`))

// ---- export PDF
await setNext(null, p('saida.pdf'))
await clickText('Exportar PDF')
await sleep(2500)
check('PDF written', existsSync(p('saida.pdf')))
if (existsSync(p('saida.pdf'))) {
  const buf = readFileSync(p('saida.pdf'))
  const txt = buf.toString('latin1')
  const pages = (txt.match(/\/Type\s*\/Page[^s]/g) || []).length
  const scriptPages = Number((/Página \d+ de (\d+)/.exec(status) || [])[1])
  check('PDF starts with %PDF', txt.startsWith('%PDF'))
  check('PDF pages = script pages + title page', pages === scriptPages + 1, `pdf=${pages} editor=${scriptPages}`)
  check('PDF embeds Courier Prime', /CourierPrime/.test(txt))
}

// ---- export FDX and Fountain from the "Mais" menu
await openPop('Mais')
await setNext(null, p('saida.fdx'))
await clickText('Exportar FDX')
await sleep(800)
check('FDX written', existsSync(p('saida.fdx')))
if (existsSync(p('saida.fdx'))) {
  const x = readFileSync(p('saida.fdx'), 'utf8')
  check('FDX has paragraphs of each type', /Type="Scene Heading"/.test(x) && /Type="Character"/.test(x) && /Type="Dialogue"/.test(x) && /Type="Transition"/.test(x) && /Chuva/.test(x))
}
await openPop('Mais')
await setNext(null, p('saida.fountain'))
await clickText('Exportar Fountain')
await sleep(800)
check('Fountain written', existsSync(p('saida.fountain')))
if (existsSync(p('saida.fountain'))) {
  const f = readFileSync(p('saida.fountain'), 'utf8')
  check('Fountain has title and cues', f.startsWith('Title: Chuva') && /\nMARINA\n\(baixo\)\nVocê veio\./.test(f), f.slice(0, 160))
}

// ---- reports CSV
await clickText('Relatórios')
await sleep(300)
await setNext(null, p('cenas.csv'))
await clickText('Exportar CSV')
await sleep(600)
check('CSV written', existsSync(p('cenas.csv')))
if (existsSync(p('cenas.csv'))) {
  const c = readFileSync(p('cenas.csv'), 'utf8')
  check('CSV has BOM, header and rows', c.charCodeAt(0) === 0xfeff && /Cabeçalho/.test(c) && c.split('\r\n').length > 20, c.slice(0, 120))
}
await clickText('Roteiro')

// ---- import the FDX we just wrote (round trip) from the home screen
await clickText('Início')
await sleep(900)
await setNext(p('saida.fdx'), null)
await clickText('Importar FDX ou Fountain')
await sleep(900)
const dom2 = await domBlocks()
check('FDX re-imports with the same number of blocks', dom2.length === dom.length, `${dom2.length} vs ${dom.length}`)

// ---- open the saved .rottera from the home screen and from the recent list
const totalPages = Number(/de (\d+)/.exec(await page.js(`document.querySelector('.status').innerText`))?.[1])
await clickText('Início')
await sleep(900)
const home = await page.js(`document.body.innerText`)
const sheet = await page.js(`document.querySelector('.title-page .mini-page')?.textContent ?? ''`)
check('the home screen shows the first page of the last script', sheet.toLowerCase().startsWith(dom[0].t.toLowerCase()), `${sheet.slice(0, 80)} | ${dom[0].t}`)
const under = await page.js(`document.querySelector('.home-page figcaption').innerText`)
check('its name and page count sit under the page', /roteiro/.test(under) && under.includes(`${totalPages} páginas`), `${under} | ${totalPages}`)
check('draft banner shown for the unsaved import', /rascunho/i.test(home))
const older = await page.js(`[...document.querySelectorAll('.recent-item')].map((b) => b.textContent).join(' | ')`)
check('older scripts listed with their folder', /antigo/.test(older) && /rottera-files-e2e/.test(older), older)
await page.js(`document.querySelector('.recent-forget').click()`)
await sleep(600)
check('a script can be taken off the list', (await page.js(`document.querySelectorAll('.recent-item').length`)) === 0)
check('taking it off the list keeps the file', existsSync(p('antigo.rotera')))
await page.js(`document.querySelector('.title-page').click()`)
await sleep(900)
const dom3 = await domBlocks()
check('opening from recent restores all blocks', dom3.length === dom.length && dom3[0].t === dom[0].t)

await clickText('Início')
await sleep(900)
await setNext(p('roteiro.rottera'), null)
await clickText('Abrir')
await sleep(900)
check('Abrir… loads the file', (await domBlocks()).length === dom.length)

// ---- edit and autosave to the same file
await page.js(`document.querySelector('.sheet-content').focus()`)
await page.call('Input.insertText', { text: ' (editado)' })
await sleep(2500)
saved = JSON.parse(readFileSync(p('roteiro.rottera'), 'utf8'))
check('autosave writes edits to the open file', JSON.stringify(saved.script.blocks).includes('(editado)'))

// ---- a file from Rotera opens, and saving keeps its .rotera name
await clickText('Início')
await sleep(700)
await setNext(p('antigo.rotera'), null)
await clickText('Abrir')
await sleep(900)
const exts = await main.js(`JSON.stringify(globalThis.__lastOpen.filters.flatMap((f) => f.extensions))`)
check('open dialog accepts .rottera, .rotera and .clapboard', ['rottera', 'rotera', 'clapboard'].every((x) => exts.includes(`"${x}"`)), exts)
check('.rotera file opens', (await domBlocks()).some((b) => b.t === 'Texto antigo.'))
await page.js(`document.querySelector('.sheet-content').focus()`)
await page.call('Input.insertText', { text: ' (novo)' })
await sleep(2500)
check('autosave writes to the .rotera file', readFileSync(p('antigo.rotera'), 'utf8').includes('(novo)'))
check('no .rottera copy made behind the writer', !existsSync(p('antigo.rottera')))

// ---- bad files are reported, not crashed
writeFileSync(p('ruim.fdx'), '<!DOCTYPE x [<!ENTITY a "b">]><FinalDraft/>', 'utf8')
await clickText('Início')
await sleep(700)
await setNext(p('ruim.fdx'), null)
await clickText('Importar FDX ou Fountain')
await sleep(900)
const homeText = await page.js(`document.body.innerText`)
check('hostile FDX is refused with a message', /DTD|não é aceito|importar/i.test(homeText), homeText.slice(0, 200))

check('no renderer errors', page.errors.length === 0, page.errors.join(' | '))

console.log(JSON.stringify({ passed: results.filter((r) => r.ok).length, total: results.length, failed: results.filter((r) => !r.ok), files: work }, null, 2))
page.close()
main.close()
app.kill()
await sleep(500)
process.exit(0)
