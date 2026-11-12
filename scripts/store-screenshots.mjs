// Store screenshots: opens the built app, fills a short demo script through the AI connection (MCP), and
// captures the main screens at 1920x1080.
// usage: node scripts/store-screenshots.mjs . dist/capturas-loja   (after npm run build)
import { spawn } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const appDir = resolve(process.argv[2])
const outDir = resolve(process.argv[3])
mkdirSync(outDir, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const cdpPort = 9461
const userData = join(tmpdir(), 'rottera-store-shots')
rmSync(userData, { recursive: true, force: true })

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
const electron = join(appDir, 'node_modules', 'electron', 'dist', 'electron.exe')
const app = spawn(electron, ['.', `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${userData}`, '--disable-features=CalculateNativeWinOcclusion'], { cwd: appDir, env, stdio: 'ignore' })

async function pageWs() {
  for (let i = 0; i < 60; i++) {
    try {
      const t = (await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json()).find((x) => x.type === 'page')
      if (t) return t.webSocketDebuggerUrl
    } catch {}
    await sleep(500)
  }
  throw new Error('no page')
}
const ws = new WebSocket(await pageWs())
await new Promise((r) => ws.addEventListener('open', r, { once: true }))
let id = 0
const waiting = new Map()
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.id && waiting.has(m.id)) (waiting.get(m.id)(m), waiting.delete(m.id))
})
const send = (method, params = {}) => new Promise((r) => (waiting.set(++id, r), ws.send(JSON.stringify({ id, method, params }))))
const js = async (expression) => {
  const m = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (m.result?.exceptionDetails) throw new Error(JSON.stringify(m.result.exceptionDetails).slice(0, 300))
  return m.result?.result?.value
}
const clickText = (t) =>
  js(`(() => { const b = [...document.querySelectorAll('button, [role=tab], a')].find(e => e.textContent.trim() === ${JSON.stringify(t)}); if (!b) throw new Error('no ' + ${JSON.stringify(t)}); b.click(); return true })()`)
const shot = async (name) => {
  await sleep(700)
  const m = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(outDir, name), Buffer.from(m.result.data, 'base64'))
  console.log('shot', name)
}

await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
await sleep(2500)
await clickText('Novo roteiro')
await sleep(1200)

// ---- the AI connection, as Claude would use it
const info = await js('window.api.connectInfo()')
const mcp = spawn(process.execPath, [info.mcpScript], { env: { ...process.env, ROTERA_BRIDGE_FILE: info.bridgeFile }, stdio: ['pipe', 'pipe', 'inherit'] })
let buf = ''
const pend = new Map()
mcp.stdout.on('data', (d) => {
  buf += d
  let i
  while ((i = buf.indexOf('\n')) !== -1) {
    const line = buf.slice(0, i)
    buf = buf.slice(i + 1)
    if (!line.trim()) continue
    const m = JSON.parse(line)
    if (pend.has(m.id)) (pend.get(m.id)(m), pend.delete(m.id))
  }
})
let mid = 0
const rpc = (method, params = {}) => new Promise((r) => { const i = ++mid; pend.set(i, r); mcp.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: i, method, params }) + '\n') })
const tool = async (name, args = {}) => {
  const r = await rpc('tools/call', { name, arguments: args })
  if (r.result?.isError) throw new Error(`${name}: ${r.result.content[0].text}`)
  return r.result?.content?.[0]?.text
}
await rpc('initialize', { protocolVersion: '2024-11-05' })

await tool('set_title_page', { title: 'A Última Sessão', author: 'Ana Souza' })
await tool('insert_fountain', {
  after: -1,
  text: `EXT. CINE ESTRELA - FACHADA - NOITE

Chuva fina. O letreiro de neon pisca, metade das letras apagadas. Na marquise, letras de plástico anunciam: ÚLTIMA SESSÃO.

LUÍSA (20), capa de chuva amarela, para diante da bilheteria fechada. Bate no vidro.

INT. CINE ESTRELA - CABINE DE PROJEÇÃO - NOITE

Pó dançando no facho do projetor. Latas de filme empilhadas até o teto.

JOÃO (68), óculos na ponta do nariz, enrola um rolo de 35 mm com as mãos de quem fez isso a vida inteira.

LUÍSA (O.S.)
Seu João? A porta tava aberta.

JOÃO
(sem se virar)
Tá sempre aberta. Ninguém mais entra.

Luísa aparece no batente, encharcada.

LUÍSA
Eu vim pra sessão.

JOÃO
Que sessão? Fecha amanhã. Vendido. Vai virar farmácia.

LUÍSA
Por isso mesmo.

João finalmente olha para ela. Um tempo.

JOÃO
Sabe passar filme?

LUÍSA
Não.

JOÃO
Então segura isso aqui. Com as duas mãos.

Ele entrega o rolo. Ela segura como quem segura um bebê.

INT. CINE ESTRELA - SALA DE EXIBIÇÃO - CONTÍNUO

Quatrocentas poltronas vazias. Luísa sozinha na fila do meio.

A luz se apaga. O facho atravessa a sala por cima dela.

Na tela, em preto e branco, um trem chega à estação.

Luísa ri. Depois chora. Depois ri de novo.

EXT. CINE ESTRELA - FACHADA - AMANHECER

A chuva passou. Dois operários sobem uma escada para tirar o letreiro.

João e Luísa na calçada, dividindo um café de copo de plástico.

JOÃO
Amanhã tem outra.

LUÍSA
Outra o quê?

JOÃO
Sessão. Lá em casa. Ainda tenho o projetor.

FADE OUT.`
})
for (const [scene, text] of [
  ['1', 'Luísa chega ao cinema fechado na noite da última sessão.'],
  ['2', 'O projecionista aceita passar um último filme, para uma espectadora só.'],
  ['3', 'A sessão, com Luísa sozinha na sala.'],
  ['4', 'O letreiro desce; a amizade começa.']
]) await tool('set_synopsis', { scene, text })

for (const [lane, title, body, color] of [
  ['Ato 1', 'O cinema vai fechar', 'Último dia do Cine Estrela. Ninguém aparece.', 'azul'],
  ['Ato 1', 'Luísa bate no vidro', 'Uma espectadora, numa noite de chuva.', 'azul'],
  ['Ato 2', 'A cabine', 'João resiste, depois ensina.', 'amarela'],
  ['Ato 2', 'Segurar o rolo', 'O gesto que passa de um para outro.', 'amarela'],
  ['Ato 2', 'A sessão', 'Quatrocentas poltronas, uma pessoa.', 'amarela'],
  ['Ato 3', 'O letreiro desce', 'O fim do cinema não é o fim das sessões.', 'verde']
]) await tool('add_beat', { lane, title, body, color })

await tool('set_character', { name: 'JOÃO', age: '68', role: 'Protagonista', personality: 'Calado, teimoso, generoso sem querer.', goal: 'Passar o último filme direito.', arc: 'De guardião de um lugar a guardião de um gesto.' })
await tool('set_character', { name: 'LUÍSA', age: '20', role: 'Protagonista', personality: 'Curiosa, chega sem ser chamada.', goal: 'Ver o cinema funcionar uma última vez.', arc: 'De espectadora a projecionista.' })

// ---- light map of the projection booth
await tool('create_lightmap', { name: 'Cabine de projeção', scene: '2', width: 6, height: 4.5, notes: 'Facho do projetor com haze. Chave dura pela janela de projeção; preenchimento mínimo.' })
const add = (a) => tool('add_light_item', { map: 'Cabine de projeção', ...a })
await add({ type: 'wall', x: 3, y: 0.15, rotation: 0, length: 6, label: '' })
await add({ type: 'window', x: 3, y: 0.15, rotation: 0, length: 0.6, label: 'Janela de projeção' })
await add({ type: 'table', x: 1.1, y: 2.6, rotation: 0, length: 1.6, depth: 0.6, label: 'Bancada de rolos' })
await add({ type: 'practical', x: 3, y: 1.0, rotation: 0, label: 'Projetor 35 mm', watts: 2000, kelvin: 5500, role: 'practical' })
await add({ type: 'fresnel', x: 5.4, y: 0.8, rotation: 235, label: 'Chave', watts: 650, kelvin: 3200, gel: '1/2 CTO', role: 'key', spread: 30, range: 3, height: 2.2 })
await add({ type: 'tube', x: 0.7, y: 0.9, rotation: 120, length: 1.2, label: 'Contra', watts: 75, kelvin: 5600, gel: '1/2 CTB', role: 'back', intensity: 60 })
await add({ type: 'chinaball', x: 2.4, y: 3.1, rotation: 0, label: 'Ambiente', watts: 150, kelvin: 3200, intensity: 30, role: 'ambient' })
await add({ type: 'haze', x: 0.6, y: 3.45, rotation: 0, label: 'Haze' })
await add({ type: 'actor', x: 1.9, y: 1.9, rotation: 90, label: 'João' })
await add({ type: 'actor', x: 5.3, y: 2.6, rotation: 280, label: 'Luísa', movePoints: [{ x: 4.0, y: 2.4, rot: 280 }] })
await add({ type: 'camera', x: 4.9, y: 3.9, rotation: 310, label: 'CAM A', lens: 35, sensor: 'ff', shot: 'Plano médio', move: 'Travelling', moveTo: { x: 3.9, y: 3.9 }, height: 1.5 })
mcp.kill()
await sleep(800)

// ---- screens
await sleep(6000)
await clickText('Roteiro')
await sleep(500)
// the cursor in the second scene, so the navigator marks it
await js(`(() => { const ed = document.querySelector('.ProseMirror'); ed.setAttribute('spellcheck', 'false'); ed.blur(); let e = ed; while (e && e.scrollHeight <= e.clientHeight + 1) e = e.parentElement; if (e) e.scrollTop = 0; return true })()`)
await shot('1-roteiro.png')
await clickText('Beat Board')
await shot('2-beat-board.png')
await clickText('Mapa de Luz')
await js(`(() => { const sel = document.getElementById('lm-zoom'); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(sel, '1.5'); sel.dispatchEvent(new Event('change', { bubbles: true })); return true })()`)
await shot('3-mapa-de-luz.png')
await clickText('Relatórios')
await shot('4-relatorios.png')

app.kill()
process.exit(0)
