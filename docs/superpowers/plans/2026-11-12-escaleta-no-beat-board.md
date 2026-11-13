# Escaleta no Beat Board — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uma coluna "Escaleta" ao lado do Beat Board que lista todas as cenas do roteiro agrupadas pelo beat, com cabeçalho e sinopse editáveis que gravam direto no roteiro, e "+ cena neste beat".

**Architecture:** Uma função pura `scenesByBeat` em `src/shared/beats.ts` deriva os grupos da regra que já existe (o primeiro cabeçalho com `bid` de um beat abre o grupo). Um componente novo `Escaleta.tsx` desenha a coluna; `Board.tsx` passa a mostrá-la ao lado das colunas e a contar as cenas no cartão; `App.tsx` liga tudo ao editor (`setSynopsis`, `replaceRange`), que fica montado mesmo com o quadro aberto.

**Tech Stack:** Electron + electron-vite, React 18, TipTap, TypeScript, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-12-escaleta-no-beat-board-design.md`

## Global Constraints

- Interface em português do Brasil; todo botão e campo com rótulo acessível (`aria-label`) no estilo do quadro.
- Nenhum dado novo no arquivo `.rottera`: a ligação cena→beat continua sendo só `bid` no cabeçalho.
- Sinopse sempre por `cleanSynopsis` (uma linha, máx. `SYNOPSIS_MAX` = 400) e `handle.setSynopsis`.
- Cena nova: `{ kind: 'scene_heading', text: DEFAULT_HEADING }` (`'INT. LOCAL - DIA'`), **sem `bid`**.
- Coluna com ~360 px, rolagem própria, fixa (`position: sticky`) enquanto o quadro rola; abaixo de 1100 px vai para baixo do quadro.
- Estado mostrar/ocultar em `localStorage`, chave `rottera:board-outline` (`'0'` = oculta), lido e gravado dentro de `try/catch`.
- Manter o fim de linha de cada arquivo: `Board.tsx`, `App.tsx`, `features.css` são CRLF; `beats.ts` é LF. Não reescrever arquivos inteiros por script.
- Não fazer commit: a branch `main` tem mudanças pendentes do usuário (docx, pdf, revisões…). Commits só quando o usuário pedir.

## Review Focus

- Roteiro longo (`LONG_SCRIPT_BLOCKS`): `blocks` do App chega atrasado; o campo que está com foco não pode ser apagado nem perder o texto digitado — Task 2 usa campos não controlados com `key` que inclui o valor.
- Cabeçalho apagado (campo vazio) ao sair: mantém o cabeçalho antigo, não cria cabeçalho vazio — teste em Task 2.
- Trocar de aba logo depois de digitar a sinopse: o texto tem de estar no roteiro — teste em Task 2 (clicar "Roteiro" com o campo ainda focado).
- Quadro vazio (sem estrutura): a escaleta ainda mostra as cenas em "Sem beat" — teste em Task 3.
- Beat apagado do quadro cuja cena ainda tem `bid`: a cena cai no grupo anterior, não some — teste em Task 1.

---

### Task 1: `scenesByBeat` e `outlineInsertAt`

**Files:**
- Modify: `src/shared/beats.ts` (LF)
- Test: `tests/beats.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface OutlineScene { block: number; scene: number; heading: string; synopsis: string }
  export interface OutlineGroup { beatId: string | null; title: string; scenes: OutlineScene[] }
  /** Cenas na ordem do roteiro, agrupadas pelo beat; antes do primeiro beat, grupo { beatId: null, title: 'Sem beat' }. */
  export function scenesByBeat(blocks: Block[], board: Board): OutlineGroup[]
  /** Índice de bloco logo depois da última cena do grupo (onde entra "+ cena neste beat"); -1 se o grupo não existe. */
  export function outlineInsertAt(blocks: Block[], board: Board, beatId: string | null): number
  ```
  `scene` é 1-based entre os cabeçalhos; `heading` é `text.trim()`; `synopsis` é `syn ?? ''`.

- [ ] **Step 1: Escrever os testes** em `tests/beats.test.ts`, novo `describe('scenes grouped by beat')`, usando o `board`, `h` e `a` que já existem no arquivo:
  - `no beats: one group "Sem beat" with every scene` — `scenesByBeat([h('INT. A - DIA'), a('x'), h('INT. B - DIA')], { lanes: [], beats: [] })` → `[{ beatId: null, title: 'Sem beat', scenes: [ {block:0,scene:1,heading:'INT. A - DIA',synopsis:''}, {block:2,scene:2,heading:'INT. B - DIA',synopsis:''} ] }]`.
  - `scenes before the first beat go to "Sem beat", then each beat takes the scenes after it` — blocks `[h('INT. A - DIA'), h('INT. B - DIA','b1'), h('INT. C - DIA'), h('INT. D - DIA','b3')]` → grupos `[null, 'b1', 'b3']` com títulos `['Sem beat','Chegada','Encontro']` e blocos `[[0],[1,2],[3]]`.
  - `a second heading with the same bid is just another scene of the current group` — `[h('X','b1'), h('Y','b3'), h('Z','b1')]` → grupos `['b1','b3']`, o grupo `b3` com blocos `[1,2]`.
  - `a bid whose beat was deleted does not open a group` — `[h('X','b1'), h('Y','gone')]` → um grupo `b1` com blocos `[0,1]`.
  - `synopsis comes from syn` — `{ ...h('X','b1'), syn: 'Ela chega.' }` → `synopsis === 'Ela chega.'`.
  - `no scene headings: no groups` — `scenesByBeat([a('x')], board)` → `[]`.
  - `outlineInsertAt is right after the last block of the group's last scene` — com `[h('A','b1'), a('1'), h('B'), a('2'), h('C','b3'), a('3')]`: `outlineInsertAt(.., 'b1') === 4`, `outlineInsertAt(.., 'b3') === 6`, `outlineInsertAt(.., 'b2') === -1`, e com `[h('A'), h('B','b1')]`: `outlineInsertAt(.., null) === 1`.

- [ ] **Step 2: Rodar e ver falhar**
  Run: `npx vitest run tests/beats.test.ts`
  Expected: FAIL — `scenesByBeat is not a function` / import não encontrado.

- [ ] **Step 3: Implementar** as duas funções em `src/shared/beats.ts`. Reusar a regra de `beatLinks` (conjunto de beats conhecidos, só o primeiro cabeçalho de cada `bid` abre grupo) e o `sceneEnd` privado que já existe para `outlineInsertAt`.

- [ ] **Step 4: Rodar e ver passar**
  Run: `npx vitest run tests/beats.test.ts tests/synopsis.test.ts`
  Expected: PASS (todos, inclusive os antigos).

---

### Task 2: Coluna Escaleta com cabeçalho e sinopse editáveis

**Files:**
- Create: `src/renderer/Escaleta.tsx` (CRLF, como os outros componentes)
- Modify: `src/renderer/Board.tsx` (props novas, layout com a coluna)
- Modify: `src/renderer/App.tsx` (handlers e props do `BoardView`, perto de `goToSceneBlock` ~l.971 e do `<BoardView>` ~l.1559)
- Modify: `src/renderer/features.css` (bloco do quadro ~l.96-123)
- Test: `e2e/f26-escaleta.spec.ts`

**Interfaces:**
- Consumes: `scenesByBeat`, `OutlineGroup` (Task 1); `EditorHandle.setSynopsis`, `EditorHandle.replaceRange`, `EditorHandle.getBlocks`; `cleanSynopsis` de `src/shared/scriptfile`.
- Produces:
  ```ts
  // Escaleta.tsx
  export interface EscaletaProps {
    groups: OutlineGroup[]
    /** beat cujo grupo deve rolar para a vista (muda a cada clique na contagem do cartão) */
    reveal: { beatId: string | null; n: number } | null
    /** bloco cujo campo de cabeçalho recebe o foco quando aparecer (cena recém-criada) */
    focusBlock: number | null
    onSetHeading(block: number, text: string): void
    onSetSynopsis(block: number, text: string): void
    onAddScene(beatId: string | null): void
    onGoToScene(block: number): void
  }
  export function EscaletaView(p: EscaletaProps): JSX.Element
  ```
  `BoardView` ganha props: `outline: OutlineGroup[]`, `onSetHeading`, `onSetSynopsis`, `onAddScene(beatId: string | null): number` (devolve o bloco da cena criada, ou -1). Os nomes acima valem para a Task 3.

- [ ] **Step 1: Escrever os testes e2e** em `e2e/f26-escaleta.spec.ts` (copiar o `rpc` e o `headings` de `e2e/f15-beats-scenes.spec.ts`; `afterEach` exige `errors` vazio). Preparação comum: `newScript`, aba Beat Board, "Aplicar estrutura", "Criar cenas para N beats".
  - `F26-H1 a escaleta lista as cenas agrupadas pelo beat` — `page.getByRole('complementary', { name: 'Escaleta' })` visível; o número de grupos (`.outline-group`) é igual ao número de cartões `.beat`; o primeiro grupo tem o título do primeiro cartão; clicar `Ir para a cena 1 no roteiro` mostra o `textbox` "Texto do roteiro".
  - `F26-H2 a sinopse escrita na escaleta vai para o roteiro e desfaz com Ctrl+Z` — preencher `getByRole('textbox', { name: 'Sinopse da cena 1' })` com `'Léo cai da bicicleta.'`, clicar no botão "Roteiro" (o campo ainda com foco); `rpc(userData,'get_outline')` → `result[0].synopsis === 'Léo cai da bicicleta.'`; clicar no texto do roteiro, `Control+z`; `get_outline` → `result[0].synopsis` é `null` ou `''`.
  - `F26-H3 o cabeçalho editado na escaleta muda no roteiro, e vazio não apaga` — preencher `getByRole('textbox', { name: 'Cabeçalho da cena 1' })` com `'EXT. PRAÇA - NOITE'` e `Enter`; `headings(page)[0] === 'EXT. PRAÇA - NOITE'`; depois apagar o campo e sair (Tab): `headings(page)[0]` continua `'EXT. PRAÇA - NOITE'`.
  - `F26-E1 sinopse longa vira uma linha de até 400 caracteres` — preencher 500 caracteres com uma quebra de linha no meio; `get_outline` → `result[0].synopsis.length === 400` e sem `\n`.

- [ ] **Step 2: Rodar e ver falhar**
  Run: `npx electron-vite build && npx playwright test e2e/f26-escaleta.spec.ts`
  Expected: FAIL — não acha o `complementary` "Escaleta".

- [ ] **Step 3: `EscaletaView`** em `src/renderer/Escaleta.tsx`: `<aside aria-label="Escaleta" className="outline">` com `<h2>Escaleta</h2>`; um `<section className="outline-group" data-beat={beatId ?? ''}>` por grupo, com `<h3>` = `title`; por cena, uma linha com o número, um `<input aria-label={`Cabeçalho da cena ${n}`}>` e um `<textarea aria-label={`Sinopse da cena ${n}`}>` (crescendo com o texto: `field-sizing: content; resize: none`), e um botão `aria-label={`Ir para a cena ${n} no roteiro`}`. Campos **não controlados** (`defaultValue`) com `key` = `` `${block}:${heading}` `` / `` `${block}:${synopsis}` `` para refletir mudanças externas sem apagar o que se digita. Gravar em `onBlur` e, no cabeçalho, também em `Enter` (que tira o foco); só chama o handler se o valor mudou. Sem cenas: `<p className="muted">O roteiro ainda não tem cenas.</p>`.

- [ ] **Step 4: Handlers no App** (perto de `goToSceneBlock`):
  - `setOutlineHeading(block, text)`: lê `h.getBlocks()[block]`; se não for `scene_heading`, ou `text.trim()` vazio, ou igual ao atual, não faz nada; senão `h.replaceRange(block, block + 1, [{ ...b, text: text.trim() }])` (mantém `bid`, `syn`, `nid`).
  - `setOutlineSynopsis(block, text)`: `h.setSynopsis(block, cleanSynopsis(text))`.
  - Passar ao `BoardView`: `outline={scenesByBeat(blocks, board)}` e os dois handlers.

- [ ] **Step 5: Layout** em `Board.tsx`: envolver o conteúdo atual (barra, texto da estrutura, colunas) e a `EscaletaView` num grid `.board-with-outline` (`grid-template-columns: minmax(0, 1fr) 360px; gap: 16px; align-items: start`). A escaleta aparece mesmo com o quadro vazio. CSS em `features.css`: `.outline` com fundo `var(--color-surface)`, borda e raio como `.chars-list`, `position: sticky; top: 0; max-height: calc(100vh - 190px); overflow: auto`; `@media (max-width: 1100px) { .board-with-outline { grid-template-columns: 1fr } }`.

- [ ] **Step 6: Rodar e ver passar**
  Run: `npm run typecheck && npx electron-vite build && npx playwright test e2e/f26-escaleta.spec.ts e2e/f15-beats-scenes.spec.ts e2e/f22-synopsis.spec.ts`
  Expected: PASS em todos.

---

### Task 3: "+ cena neste beat", contagem no cartão e mostrar/ocultar

**Files:**
- Modify: `src/renderer/Escaleta.tsx`, `src/renderer/Board.tsx`, `src/renderer/App.tsx`, `src/renderer/features.css`
- Test: `e2e/f26-escaleta.spec.ts`

**Interfaces:**
- Consumes: `outlineInsertAt` (Task 1); `EscaletaProps.reveal`, `EscaletaProps.focusBlock`, `onAddScene` (Task 2).
- Produces: nada usado por outras tarefas.

- [ ] **Step 1: Escrever os testes e2e** (mesma preparação):
  - `F26-H4 "+ cena neste beat" cria a cena logo depois das cenas do beat` — no primeiro grupo, clicar `getByRole('button', { name: /^Nova cena em / })`; `headings(page)` tem uma cena a mais, e `headings(page)[1] === 'INT. LOCAL - DIA'`; o primeiro grupo mostra 2 cenas; o campo `Cabeçalho da cena 2` está focado.
  - `F26-H5 o cartão conta as cenas e leva a escaleta até elas` — depois do H4, o primeiro cartão mostra o botão `getByRole('button', { name: 'Ver as 2 cenas na escaleta' })`; clicar no do último cartão deixa o último `.outline-group` `toBeInViewport()`.
  - `F26-H6 ocultar a escaleta fica guardado` — clicar "Ocultar escaleta"; o `complementary` "Escaleta" some; ir para "Roteiro" e voltar ao "Beat Board": continua oculta; "Mostrar escaleta" traz de volta.
  - `F26-E2 quadro vazio: as cenas aparecem em "Sem beat"` — `newScript` e Beat Board sem aplicar estrutura: a escaleta mostra um grupo "Sem beat" com 1 cena.
  - `F26-E3 tema escuro e acessibilidade` — `setTheme(app, page, 'night')`; `expect(await axeViolations(page)).toEqual([])` com o quadro e a escaleta abertos.

- [ ] **Step 2: Rodar e ver falhar**
  Run: `npx electron-vite build && npx playwright test e2e/f26-escaleta.spec.ts`
  Expected: H1-H3 e E1 PASS; H4, H5, H6, E2, E3 FAIL.

- [ ] **Step 3: Criar cena.** No App, `addOutlineScene(beatId)`: `at = outlineInsertAt(h.getBlocks(), board, beatId)`; se `-1`, devolve `-1`; senão `h.replaceRange(at, at, [{ kind: 'scene_heading', text: DEFAULT_HEADING }])` e devolve `at`. Na `EscaletaView`, botão no fim de cada grupo, texto "+ cena neste beat", `aria-label={`Nova cena em ${title}`}`. O `BoardView` guarda o retorno em estado e passa como `focusBlock`; a `EscaletaView` foca o input `Cabeçalho` daquele bloco quando ele aparecer (efeito que observa `groups` e `focusBlock`) e limpa o pedido.

- [ ] **Step 4: Contagem no cartão.** No cartão com cena (ao lado do botão "Cena N"), um botão `.link` com o texto `· N cenas` (ou `· 1 cena`) e `aria-label={`Ver as ${n} cenas na escaleta`}` (singular: `'Ver a cena na escaleta'`). Clicar mostra a escaleta se estiver oculta e define `reveal = { beatId, n: reveal.n + 1 }`; a `EscaletaView` faz `scrollIntoView({ block: 'start', behavior: 'smooth' })` no `.outline-group[data-beat=…]`.

- [ ] **Step 5: Mostrar/ocultar.** Botão na `.board-bar`: "Ocultar escaleta" / "Mostrar escaleta" (`aria-pressed`). Estado inicial lido de `localStorage` (`rottera:board-outline`), gravado a cada troca; ambos em `try/catch`. Oculta: o grid volta a uma coluna.

- [ ] **Step 6: Rodar tudo**
  Run: `npm run typecheck && npx vitest run && npx electron-vite build && npx playwright test e2e/f26-escaleta.spec.ts e2e/f15-beats-scenes.spec.ts e2e/f22-synopsis.spec.ts e2e/f12-characters.spec.ts`
  Expected: PASS em todos.

- [ ] **Step 7: Conferir na tela** com um roteiro real: abrir uma cópia de `Batalha de Rima (título provisório) versao 2.rottera` numa pasta temporária pelo teste (nunca o arquivo do usuário), tirar uma captura do Beat Board com a escaleta e conferir que a soma das cenas nos grupos dá 48, que cada grupo tem o título de um cartão do quadro, e que nada estoura a largura em 1266 px.
