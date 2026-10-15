// What Windows Narrator actually says while tabbing through Rottera. It speaks out loud for about a minute.
// usage: node tests/e2e/narrator-e2e.mjs <app dir> [Rottera.exe]
import { execFile, spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const appDir = resolve(process.argv[2])
const exe = process.argv[3]
const require = createRequire(appDir + '/package.json')
const electron = exe || require('electron')
const port = 9455
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const userData = mkdtempSync(join(tmpdir(), 'rottera-narrator-'))
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
let id = 0
const js = (expr) => ws.send(JSON.stringify({ id: ++id, method: 'Runtime.evaluate', params: { expression: expr } }))
await sleep(1500)
js(`[...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith('Novo roteiro'))?.click()`)
await sleep(1200)
js(`document.querySelector('.toolbar button').focus()`)
await sleep(600)

const pid = await new Promise((res) =>
  execFile('powershell', ['-NoProfile', '-Command', `(Get-NetTCPConnection -LocalPort ${port} -State Listen | Select-Object -First 1).OwningProcess`], (e, o) => res(Number(String(o).trim())))
)
const helper = join(appDir, 'tests', 'e2e', 'narrator-walk.ps1')
const splitLines = (o) =>
  String(o)
    .split('\n')
    .map((x) => x.replace('\r', ''))
    .filter((x) => x.trim() !== '')
const runWalk = (steps) =>
  new Promise((res) =>
    execFile(
      'powershell',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', helper, '-ProcessId', String(pid), '-Steps', String(steps), '-WaitMs', '1800'],
      { encoding: 'utf8', timeout: 300000, maxBuffer: 10 * 1024 * 1024 },
      (e, o) => res(splitLines(o))
    )
  )
const parse = (ls) =>
  ls.map((l) => {
    const [i, focus, said] = l.split('|')
    return { i, focus, said: (said ?? '').trim() }
  })

const walk = parse(await runWalk(Number(process.env.NARRATOR_STEPS || '28')))

// second part: a dialog. Open it through the page, then let Narrator read where focus lands.
js(`[...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith('Mais'))?.click()`)
await sleep(400)
js(`[...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith('Conectar ao Claude'))?.click()`)
await sleep(900)
const dialog = parse(await runWalk(6))

console.log(JSON.stringify({ toolbarAndEditor: walk, dialog }, null, 2))
ws.close()
app.kill()
await sleep(500)
process.exit(0)
