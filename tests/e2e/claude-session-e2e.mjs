// Runs a real Claude Code session (claude -p) against the running Rottera app through the MCP server,
// then reads the screen to confirm Claude's edits arrived. Nothing is registered permanently: the MCP
// config is passed for this one run with --mcp-config --strict-mcp-config.
// usage: node tests/e2e/claude-session-e2e.mjs <app dir> <path to claude executable> [packaged Rottera.exe]
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const appDir = resolve(process.argv[2])
const claude = process.argv[3]
const exe = process.argv[4]
const require = createRequire(appDir + '/package.json')
const electron = exe || require('electron')
const port = 9447
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// a throwaway data folder, so the run never touches the writer's recent files or versions
const userData = mkdtempSync(join(tmpdir(), 'rottera-e2e-'))
const env = { ...process.env, ROTERA_LEGACY_APPDATA: join(userData, 'none') }
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
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data)
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg)
    pending.delete(msg.id)
  }
}
const js = (expr) =>
  new Promise((res, rej) => {
    const i = ++id
    pending.set(i, (m) => (m.result.exceptionDetails ? rej(new Error('js error')) : res(m.result.result.value)))
    ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true, awaitPromise: true } }))
  })

await sleep(1500)
const info = await js('window.api.connectInfo()')
await js(`[...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith('Novo roteiro')).click()`)
await sleep(800)

const dir = join(tmpdir(), 'rottera-claude-session')
mkdirSync(dir, { recursive: true })
const cfg = join(dir, 'mcp.json')
writeFileSync(
  cfg,
  JSON.stringify({
    mcpServers: {
      rottera: { command: 'node', args: [info.mcpScript], env: { ROTERA_BRIDGE_FILE: info.bridgeFile } }
    }
  })
)

const defaultPrompt = [
  'Use somente as ferramentas do Rottera (servidor MCP "rottera").',
  '1. Chame status e me diga quantos blocos o roteiro tem.',
  '2. Com insert_fountain, escreva no fim do roteiro uma cena curta em Fountain:',
  '   cabeçalho "INT. BIBLIOTECA - NOITE", uma linha de ação, e um diálogo curto entre LIA e TOM (dois falas cada).',
  '3. Chame get_outline e me diga quantas cenas existem agora e em que página a nova cena começa.',
  'Responda em uma frase curta no final.'
].join('\n')

const prompt = process.env.ROTERA_PROMPT || defaultPrompt
const defaultTools = [
  'mcp__rottera__status',
  'mcp__rottera__insert_fountain',
  'mcp__rottera__get_outline',
  'mcp__rottera__get_script'
]
const tools = process.env.ROTERA_TOOLS ? process.env.ROTERA_TOOLS.split(',') : defaultTools
const t0 = Date.now()
const child = spawn(
  claude,
  [
    '-p',
    prompt,
    '--mcp-config',
    cfg,
    '--strict-mcp-config',
    '--allowedTools',
    ...tools,
    '--max-turns',
    process.env.ROTERA_MAX_TURNS || '8',
    '--output-format',
    'json'
  ],
  { cwd: dir, env: { ...process.env }, stdio: ['ignore', 'pipe', 'pipe'] }
)
let out = ''
let err = ''
child.stdout.on('data', (d) => (out += d))
child.stderr.on('data', (d) => (err += d))
const code = await new Promise((r) => child.on('close', r))

const blocks = await js(
  `[...document.querySelectorAll('.sheet-content > p')].map(p => p.dataset.kind + ': ' + p.textContent)`
)
// ask the app itself what the session left behind (through the same local bridge Claude used)
let state = null
try {
  const { port: bport, token } = JSON.parse((await import('node:fs')).readFileSync(info.bridgeFile, 'utf8'))
  const call = async (method, params = {}) => {
    const r = await fetch(`http://127.0.0.1:${bport}/rpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ method, params })
    })
    return (await r.json()).result
  }
  state = {
    outline: (await call('get_outline'))?.map((o) => `${o.number}. ${o.heading} (p.${o.page})`),
    beats: await call('get_beats').then((b) => b && { lanes: b.lanes.map((l) => l.name), beats: b.beats.length }),
    storyboard: await call('get_storyboard').then((b) => b && b.frames.map((f) => f.caption)),
    lightmaps: await call('get_lightmaps').then((m) => m && m.map((x) => ({ name: x.name, scene: x.scene, pieces: x.items.map((i) => `${i.type}${i.label ? ':' + i.label : ''}`) })))
  }
} catch (e) {
  state = { error: String(e) }
}
let parsed = null
try {
  parsed = JSON.parse(out)
} catch {}

console.log(
  JSON.stringify(
    {
      exitCode: code,
      seconds: Math.round((Date.now() - t0) / 1000),
      isError: parsed?.is_error ?? null,
      turns: parsed?.num_turns ?? null,
      result: parsed?.result ?? out.slice(0, 600),
      stderr: err.slice(0, 400),
      screenBlocks: blocks,
      state
    },
    null,
    2
  )
)
ws.close()
app.kill()
await sleep(500)
process.exit(0)
