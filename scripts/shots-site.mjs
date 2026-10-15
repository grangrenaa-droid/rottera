// Takes the screenshots used on the landing page from the real app, with a made-up script.
// usage: node scripts/shots-site.mjs <out dir> [path to Rottera.exe]
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { _electron as electron } from '@playwright/test'

const out = resolve(process.argv[2] ?? 'shots')
const exe = process.argv[3]
mkdirSync(out, { recursive: true })
const root = resolve(import.meta.dirname, '..')
const work = mkdtempSync(join(tmpdir(), 'rottera-shots-'))
const userData = join(work, 'data')
const env = { ...process.env, ROTERA_LEGACY_APPDATA: join(work, 'none') }
delete env.ELECTRON_RUN_AS_NODE

const app = exe
  ? await electron.launch({ executablePath: exe, args: [`--user-data-dir=${userData}`], env })
  : await electron.launch({ args: ['.', `--user-data-dir=${userData}`], cwd: root, env })
const page = await app.firstWindow()
await page.waitForLoadState('domcontentloaded')
await app.evaluate(({ BrowserWindow }) => {
  const w = BrowserWindow.getAllWindows()[0]
  w.setSize(1360, 860)
  w.center()
})
const file = join(work, 'chuva.rottera')
await app.evaluate(({ dialog }, f) => {
  dialog.showSaveDialog = (async () => ({ canceled: false, filePath: f }))
}, file)

const rpc = async (method, params = {}) => {
  const { port, token } = JSON.parse(readFileSync(join(userData, 'bridge.json'), 'utf8'))
  const r = await fetch(`http://127.0.0.1:${port}/rpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ method, params })
  })
  const j = await r.json()
  if (!j.ok) throw new Error(`${method}: ${j.error}`)
  return j.result
}
const shot = async (name) => {
  await page.waitForTimeout(600)
  await page.screenshot({ path: join(out, name) })
  console.log('ok', name)
}
const tab = (name) => page.locator('button', { hasText: new RegExp(`^${name}$`) }).first().click()

await page.getByRole('button', { name: 'Novo roteiro' }).first().click()
await page.getByRole('textbox', { name: 'Texto do roteiro' }).waitFor()
await rpc('set_title_page', { title: 'Chuva de Março', author: 'Ana Souza' })
await rpc('insert_fountain', {
  text: `INT. COZINHA - MANHÃ

Marina coa o café enquanto a chuva bate na janela. Duas xícaras na mesa, uma delas intocada.

MARINA
Você veio. Eu não esperava mais.

DAVI
Eu disse que vinha.

EXT. RUA - NOITE

Davi atravessa a rua sem guarda-chuva. Para diante de uma janela acesa.

MARINA (V.O.)
Ele chegou tarde, como sempre.

INT. SALA - DIA

Bia arruma livros numa estante. Não levanta os olhos quando a porta abre.

BIA
Finalmente alguém chegou.

DAVI
Cheguei.

EXT. PONTE - AMANHECER

A cidade acorda devagar. Marina espera, sozinha.
`
})
await rpc('add_beat', { lane: 'Ato 1', title: 'A volta', body: 'Davi reaparece depois de três anos.' })
await rpc('add_beat', { lane: 'Ato 1', title: 'O café', body: 'Marina decide ouvir.' })
await rpc('add_beat', { lane: 'Ato 2', title: 'A ponte', body: 'Uma escolha ao amanhecer.' })
await rpc('add_beat', { lane: 'Ato 2', title: 'A biblioteca de Bia', body: 'O que ela sabe.' })
await rpc('create_lightmap', { name: 'Cozinha, manhã', scene: '1', width: 8, height: 6 })
for (const [type, x, y, rotation, label] of [
  ['camera', 4, 5, 180, 'Câmera A'],
  ['actor', 3, 2.5, 0, 'Marina'],
  ['actor', 5, 2.5, 0, 'Davi'],
  ['softbox', 1, 2, 90, 'Janela'],
  ['led', 7, 4, 270, 'Preenchimento'],
  ['table', 4, 2.6, 0, 'Mesa']
]) await rpc('add_light_item', { type, x, y, rotation, label })
await rpc('set_character', { name: 'Marina', age: '34', role: 'Protagonista', goal: 'Decidir se perdoa.', conflict: 'Teme ser deixada outra vez.' })

// 1. the editor with the navigator
await tab('Roteiro')
await page.getByRole('textbox', { name: 'Texto do roteiro' }).click()
await shot('editor.png')

// 2. the board: one beat becomes a scene, the card points to it
await tab('Beat Board')
await page.locator('.beat').first().getByRole('button', { name: 'Virar cena' }).click()
await tab('Beat Board')
await shot('beat-board.png')

// 3. version history
await page.getByRole('button', { name: 'Salvar como…' }).click()
await page.waitForTimeout(800)
await tab('Roteiro')
await page.getByRole('button', { name: 'Mais' }).click()
await page.getByRole('button', { name: 'Versões anteriores…' }).click()
await shot('versoes.png')
await page.keyboard.press('Escape')

// 4. light map
await tab('Mapa de Luz')
await shot('mapa-de-luz.png')

// 5. character sheet
await tab('Relatórios')
await page.getByRole('button', { name: 'Fichas de personagem' }).click()
await shot('ficha.png')

await app.close()
console.log('screens in', out)
