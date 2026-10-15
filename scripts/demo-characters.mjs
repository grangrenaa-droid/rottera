// Opens Rottera with a small demo script and walks through the character sheet, taking a screenshot at each
// step. The app is left running for the user. usage: node scripts/demo-characters.mjs <Rottera.exe> <out dir>
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const exe = process.argv[2]
const outDir = resolve(process.argv[3] ?? '.e2e-shots')
mkdirSync(outDir, { recursive: true })
const port = 9461
const userData = mkdtempSync(join(tmpdir(), 'rottera-demo-'))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
const child = spawn(exe, [`--remote-debugging-port=${port}`, `--user-data-dir=${userData}`], {
  env,
  detached: true,
  stdio: 'ignore'
})
child.unref()

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
if (!ws) throw new Error('app did not start')
let id = 0
const pending = new Map()
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data)
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg)
    pending.delete(msg.id)
  }
}
const send = (method, params = {}) =>
  new Promise((res) => {
    const i = ++id
    pending.set(i, res)
    ws.send(JSON.stringify({ id: i, method, params }))
  })
const js = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value
const click = (t) => js(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith(${JSON.stringify(t)})); if (!b) return false; b.click(); return true })()`)
const setValue = (sel, v) =>
  js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(v)}); el.dispatchEvent(new Event('input', { bubbles: true })) })()`)
const shot = async (name) => {
  await sleep(500)
  const r = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(outDir, name), Buffer.from(r.result.data, 'base64'))
}
const bridge = async (method, params = {}) => {
  const { port: bp, token } = JSON.parse(readFileSync(join(userData, 'bridge.json'), 'utf8'))
  const r = await fetch(`http://127.0.0.1:${bp}/rpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ method, params })
  })
  return r.json()
}

await send('Runtime.enable')
await sleep(1500)
await click('Novo roteiro')
await sleep(1200)
await bridge('insert_fountain', {
  text: `INT. COZINHA - MANHÃ

Marina coa o café enquanto a chuva bate na janela.

MARINA
Você veio. Eu não esperava mais.

DAVI
Eu disse que vinha.

EXT. RUA - NOITE

Davi atravessa a rua sem guarda-chuva.

MARINA (V.O.)
Ele chegou tarde, como sempre.

INT. SALA - DIA

BIA
Finalmente alguém chegou.

DAVI
Cheguei.
`
})
await bridge('set_title_page', { title: 'Chuva', author: 'Ana Souza' })
await sleep(500)
await click('Relatórios')
await sleep(400)
await click('Fichas de personagem')
await sleep(500)

// step 1: nothing written yet, only the numbers that come from the script
await shot('demo-1-ficha-vazia.png')

// step 2: write a few fields; the presentation follows
await setValue('#cf-alias', 'Mari')
await setValue('#cf-age', '34')
await setValue('#cf-role', 'Protagonista')
await setValue('#cf-goal', 'Recomeçar a vida na cidade onde cresceu.')
await shot('demo-2-escrevendo.png')

// step 3: the rest of the sheet
await setValue('#cf-appearance', 'Cabelo preso às pressas, casaco largo demais, mãos sempre ocupadas.')
await setValue('#cf-conflict', 'Teme ser deixada outra vez; não sabe pedir ajuda.')
await setValue('#cf-arc', 'Da culpa ao perdão.')
await shot('demo-3-ficha-completa.png')

// step 4: the script changes (a new line for Marina) and the numbers in the presentation follow
await bridge('insert_fountain', { text: 'MARINA\nSe você ficar, eu aguento.\n' })
await sleep(500)
await shot('demo-4-roteiro-mudou.png')

// step 5: Claude fills in another character, the presentation of that one appears without a reload
await bridge('set_character', {
  name: 'Davi',
  age: 'por volta de 50',
  role: 'Antagonista',
  personality: 'Orgulhoso, fala pouco, nunca explica o que sente.',
  goal: 'Provar que ainda pertence àquela casa.'
})
await js(`[...document.querySelectorAll('.chars-list li button')].find(b => b.textContent.includes('DAVI'))?.click()`)
await shot('demo-5-outro-personagem.png')

// leave Marina on screen
await js(`[...document.querySelectorAll('.chars-list li button')].find(b => b.textContent.includes('MARINA'))?.click()`)
ws.close()
console.log('ok: app left running (pid ' + child.pid + '), screenshots in ' + outDir)
process.exit(0)
