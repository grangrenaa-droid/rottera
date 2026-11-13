# Janela Som Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uma janela **Som** depois de Mapa de Luz, com as abas Planta · Ficha por cena · Ambientes e músicas · Equipamento, que leva o planejamento do técnico de som aos PDFs e à ordem do dia.

**Architecture:** Dados novos em `script.sound` (tipos em `types.ts`, limpeza e regras puras em `src/shared/sound.ts`, desenho dos microfones em `src/shared/soundsvg.ts`). A tela fica em `src/renderer/Sound.tsx` (casca com as abas) e um arquivo por aba. A planta do som desenha o SVG do mapa de luz (`lightMapSvg`) claro e sem interação, com a camada de microfones por cima; o mapa de luz nunca é alterado. A aba Equipamento é um componente genérico (`Equipment.tsx` + `src/shared/equipment.ts`) que a janela Luz reusará.

**Tech Stack:** Electron 33, React 18, TypeScript, vitest, Playwright (Electron), axe.

**Spec:** `docs/superpowers/specs/2026-11-13-janela-som-design.md`

## Global Constraints

- Toda a interface em português do Brasil; os textos citados no spec são usados como estão.
- Nenhuma dependência nova.
- **Nada na janela Som altera `script.lightMaps`** (nem itens, nem tamanho, nem notas).
- Arquivos sem `sound` abrem como antes; `sound` com lixo abre sem quebrar (limpeza como `cleanLightMap`/`cleanProduction`: textos com limite, números presos em faixas, tipos desconhecidos descartados).
- Fichas e listas acompanham a **id da cena** (`nid` do cabeçalho), não o número.
- Atalho **Ctrl+Alt+7**; menu Exibir → "Som"; botão "Som" na barra logo depois de "Mapa de Luz".
- Acessibilidade: sem violações sérias no axe nas quatro abas, tema claro e escuro (como `F21-A1`).
- Os arquivos com fim de linha CRLF (`src/main/pdf.ts`) mantêm CRLF.

## Review Focus

1. **Mapa de luz apagado ou redimensionado** depois de a planta de som existir: a planta continua (vira só de som, com o tamanho que o mapa tinha) e nenhum microfone fica fora da planta. — teste na Task 1 (`reconcileSound`).
2. **Lapela presa a um ator que foi apagado** no Mapa de Luz: o microfone aparece na posição dele, sem erro, e a ficha não cita o ator. — teste na Task 2 (`soundLayerSvg`) e na Task 1 (`micsOfScene`).
3. **Arquivo antigo ou com `sound` estragado**: abre, e o que for válido fica. — teste na Task 1 (`cleanSound`).
4. **Cena movida ou renumerada**: ficha, músicas e plantas continuam na mesma cena. — teste na Task 1 (via ids) e na Task 9 (Playwright).
5. **O técnico mexe na janela Som e o Mapa de Luz não muda**: depois de pôr microfones, os mapas de luz salvos são iguais aos de antes. — teste na Task 9.

---

### Task 1: Dados do som e regras puras

**Files:**
- Modify: `src/shared/types.ts` (tipos novos; `Script.sound?: Sound`)
- Create: `src/shared/sound.ts`
- Modify: `src/shared/scriptfile.ts` (ler `sound` com `cleanSound`)
- Test: `tests/sound.test.ts`

**Interfaces:**
- Produces (em `types.ts`):
  - `type MicType = 'cardioid' | 'supercardioid' | 'shotgun' | 'omni' | 'figure8' | 'lavalier' | 'recorder'`
  - `interface Mic { id; type: MicType; x; y; rotation; label; model?; channel?: number /*1–16*/; wireless?: boolean; height?: number; range?: number; operator?: string; actorId?: string }`
  - `interface SoundPlan { id; mapId?: string; sid?: string; scene: string; width: number; height: number; mics: Mic[]; notes: string }`
  - `type Capture = 'direct' | 'adr' | 'playback' | 'mos'`
  - `interface SoundSheet { capture?: Capture; voices: Record<string, 'lapela' | 'vara' | 'ambos'>; risks: string[]; otherRisk: string; requests: string; roomTone: boolean; roomToneSeconds: number; effects: string; playback: string; notes: string }`
  - `interface Ambience { id; location: string; what: string; duration: string; notes: string; recorded: boolean }`
  - `interface Song { id; title; author; scenes: string[]; kind: 'diegetic' | 'score'; duration: string; rights: 'licensed' | 'pending' | 'original' | 'public'; notes }`
  - `interface EquipItem { id; name; qty: number; rental: string; out: boolean; back: boolean; notes }` e `interface EquipState { rental: string; out: boolean; back: boolean; notes: string }`
  - `interface Sound { plans: SoundPlan[]; sheets: Record<string, SoundSheet>; ambiences: Ambience[]; music: Song[]; equipment: EquipItem[]; equipState: Record<string, EquipState> }`
- Produces (em `sound.ts`):
  - `MIC_DEFS: Record<MicType, { label: string; group: 'Unidirecionais' | 'Outros'; range: number }>` — rótulos: Cardioide, Supercardioide, Shotgun, Omnidirecional, Figura 8, Lapela, Gravador; grupo Unidirecionais = cardioide, supercardioide, shotgun.
  - `RISKS = ['Trânsito', 'Avião', 'Obra', 'Vento', 'Chuva', 'Eco', 'Gerador', 'Ar-condicionado', 'Geladeira']`
  - `CAPTURES: { id: Capture; label: string }[]` — Som direto, Dublagem (ADR), Playback, Sem som (MOS).
  - `emptySound(): Sound`, `emptySheet(): SoundSheet` (roomToneSeconds 30)
  - `cleanSound(raw: unknown): Sound | undefined` (undefined quando não sobra nada)
  - `newMic(type: MicType, x: number, y: number): Mic`
  - `reconcileSound(sound: Sound, maps: LightMap[]): Sound` — planta com `mapId` existente copia `width/height/sid/scene` do mapa; com `mapId` sumido perde o `mapId` e guarda o último tamanho; prende `x,y` de cada microfone em `[0,width]×[0,height]`.
  - `plansOfScene(sound: Sound, maps: LightMap[], sceneId: string): SoundPlan[]`
  - `micsOfScene(sound: Sound, maps: LightMap[], sceneId: string): { mic: Mic; actor: string }[]` — `actor` é o rótulo do ator preso (lapela), ou '' quando não há ou o ator sumiu.

- [ ] **Step 1: Write the failing tests** em `tests/sound.test.ts`:
  - `cleanSound` de `undefined`, `42`, `{ plans: 'x' }` → `undefined`; de um `Sound` válido devolve igual (`toEqual`); microfone com `type: 'laser'` some; `channel: 99` vira 16; textos com 5000 caracteres cortados.
  - `reconcileSound` com mapa de 6×4: planta com `mapId` dele fica 6×4 e com `sid` do mapa; apagando o mapa, a planta fica sem `mapId`, 6×4; mapa reduzido para 3×2 prende um microfone em (5,3) para (3,2).
  - `micsOfScene` devolve a lapela com `actor: 'Luísa'` quando o ator existe e `actor: ''` quando o item do ator foi apagado.
  - `parseScriptFile(serialize(script com sound))` devolve o mesmo `sound`.
- [ ] **Step 2:** `npx vitest run tests/sound.test.ts` — FAIL (módulo inexistente).
- [ ] **Step 3:** Implementar os tipos, `sound.ts` e a leitura em `scriptfile.ts` (`if (src.sound) { const s = cleanSound(src.sound); if (s) script.sound = s }`).
- [ ] **Step 4:** `npx vitest run tests/sound.test.ts` — PASS; `npm run typecheck` sem erro.
- [ ] **Step 5: Commit** `git commit -m "Som: dados, limpeza e regras das plantas de som"`

### Task 2: Desenho dos microfones

**Files:**
- Create: `src/shared/soundsvg.ts`
- Test: `tests/soundsvg.test.ts`

**Interfaces:**
- Consumes: `Mic`, `MIC_DEFS`, `LightMap`, `S` (px por metro) e `lightMapSvg` de `lightmap.ts`.
- Produces:
  - `pickupPath(type: MicType, range: number): string` — caminho SVG da área de captação em px, apontando para cima (0°), com o microfone na origem: cardioide (coração), supercardioide (coração estreito + lóbulo traseiro), shotgun (gota estreita e longa), omni e lapela (círculo de raio `range`), figura 8 (dois lóbulos, frente e trás); gravador: ''.
  - `soundLayerSvg(plan: SoundPlan, map: LightMap | null, opts?: { selectedId?: string | null; interactive?: boolean }): string` — só a camada `<g>` dos microfones: cada um com `data-mic="<id>"`, a área, o ícone, o rótulo e (selecionado e interativo) a bolinha de giro com `data-mic-rotate="<id>"`; lapela presa a ator existente é desenhada na posição do ator.
  - `soundPlanSvg(plan: SoundPlan, map: LightMap | null, opts?): string` — o `<svg>` completo: o `lightMapSvg(map)` dentro de `<g opacity="0.35" pointer-events="none">` (ou só a grade, para planta só de som) e a camada por cima.

- [ ] **Step 1: Write the failing tests:** `pickupPath('omni', 2)` contém um arco de raio `2*S`; `pickupPath('shotgun', 3)` alcança `-3*S` em y e é mais estreito que `pickupPath('cardioid', 3)` (largura máxima menor); `pickupPath('recorder', 1) === ''`; `soundPlanSvg` com mapa contém `opacity="0.35"` e `pointer-events="none"` em volta do desenho da luz e contém `data-mic="m1"`; lapela presa ao ator `a1` em (2,3) é desenhada em `translate(${2*S},${3*S})`; com `actorId` de ator inexistente, desenhada na posição do próprio microfone.
- [ ] **Step 2:** rodar — FAIL.
- [ ] **Step 3:** implementar `soundsvg.ts`.
- [ ] **Step 4:** rodar — PASS.
- [ ] **Step 5: Commit** `"Som: desenho dos microfones e da área de captação"`

### Task 3: Linha rápida do microfone

**Files:**
- Modify: `src/shared/quicksheet.ts`
- Test: `tests/quicksheet.test.ts`

**Interfaces:**
- Produces: `parseMicLine(text: string): { patch: Partial<Mic>; understood: string[]; unknown: string[] }` usando o `reader` existente. Entende: nome do tipo (shotgun, supercardioide, cardioide, omni/omnidirecional, figura 8/bidirecional, lapela, gravador), `canal N`, `N m` (altura), `alcance N m`, `N°` (rotação), `sem fio`, `x N y N`.

- [ ] **Step 1:** teste: `parseMicLine('shotgun canal 1 a 2,1 m sem fio')` → `patch` `{ type: 'shotgun', channel: 1, height: 2.1, wireless: true }`, `unknown: []`; `parseMicLine('lapela alcance 0,5 m 90°')` → `{ type: 'lavalier', range: 0.5, rotation: 90 }`; palavra desconhecida vai para `unknown`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** `"Som: escrever o microfone numa linha"`

### Task 4: Equipamento genérico

**Files:**
- Create: `src/shared/equipment.ts`, `src/renderer/Equipment.tsx`
- Test: `tests/equipment.test.ts`

**Interfaces:**
- Produces (`equipment.ts`):
  - `interface AutoLine { key: string; name: string; qty: number }`
  - `soundAutoLines(sound: Sound): AutoLine[]` — por `tipo + modelo` (chave `"shotgun|MKH 416"`), quantidade = o maior número desse par numa mesma planta; nome `"Shotgun · MKH 416"` (sem modelo: só o tipo).
  - `cleanEquipment(raw: unknown): EquipItem[]`
  - `equipmentReport(title: string, auto: AutoLine[], items: EquipItem[], state: Record<string, EquipState>): Report` — colunas `['Item', 'Qtd.', 'Locadora', 'Retirado', 'Devolvido', 'Observações']`, sim/não como "Sim"/"Não", automáticas primeiro.
- Produces (`Equipment.tsx`): `EquipmentView(props: { auto: AutoLine[]; items: EquipItem[]; state: Record<string, EquipState>; onChange(items: EquipItem[], state: Record<string, EquipState>): void; title: string; onExportPdf(r: Report): void; onExportCsv(name: string, csv: string): void })` — linhas automáticas com nome e quantidade fixos (marcadas "da planta"), demais editáveis; "+ Item"; apagar item à mão.

- [ ] **Step 1:** testes: duas plantas, uma com 2 shotguns MKH 416 e outra com 1 → uma linha `qty: 2`; lapelas sem modelo → `"Lapela"`; `equipmentReport` com estado `{ out: true }` na chave automática escreve "Sim" em Retirado.
- [ ] **Step 2–4:** FAIL → implementar → PASS (a tela é coberta na Task 9).
- [ ] **Step 5: Commit** `"Equipamento: lista de trabalho reaproveitável (som agora, luz depois)"`

### Task 5: Casca da janela Som e a aba Planta

**Files:**
- Create: `src/renderer/Sound.tsx` (abas), `src/renderer/SoundPlan.tsx`, `src/renderer/sound.css`
- Modify: `src/renderer/App.tsx` (estado `sound` com `putSound` como `putLightMaps`; `Panel` ganha `'sound'`; botão "Som" depois de "Mapa de Luz"; `case 'view-sound'`; ao mudar `lightMaps`, aplicar `reconcileSound`), `src/main/index.ts` (item "Som", `'view-sound'`, `CmdOrCtrl+Alt+7`, depois de "Mapa de Luz"), `src/shared/api.ts` (`MenuAction` ganha `'view-sound'`)

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: `SoundView(props: { sound: Sound; maps: LightMap[]; scenes: SceneInfo[]; sceneId(s: SceneInfo): string | null; onChange(s: Sound): void; onExportPlans(): void; onExportPdf(r: Report, landscape: boolean): void; onExportCsv(name: string, csv: string): void })` com as abas "Planta", "Ficha por cena", "Ambientes e músicas", "Equipamento" (`role="group" aria-label="Som"`, como `prod-tabs`).
- `SoundPlanView`: lista à esquerda (mapas de luz com a cena; depois as cenas sem mapa, com "Criar planta de som" que pede largura e fundo); paleta por grupo; desenho `soundPlanSvg`; arrastar (`data-mic`), girar (`data-mic-rotate`, passo de 15° com Shift livre, como o Mapa de Luz), setas do teclado movem 0,1 m; painel do microfone selecionado com os campos do spec (nome, tipo, modelo, canal 1–16, sem fio, altura, alcance, rotação, "Na vara de" só para shotgun/supercardioide, "Preso em" só para lapela com os atores do mapa) e a linha rápida (`parseMicLine`); Desfazer/Refazer (50 passos); "Usar a planta de luz desta cena" numa planta só de som cuja cena ganhou mapa.

- [ ] **Step 1:** escrever o teste de interface `F27-H1` em `e2e/f27-sound.spec.ts`: importar o Fountain do `f21`, criar um mapa de luz para a cena 1 pela conexão (`create_lightmap`, `add_light_item` ator "Luísa"), abrir Som (Ctrl+Alt+7), escolher a planta, clicar "Shotgun" na paleta, escrever "shotgun canal 1 a 2,1 m" na linha rápida, pôr uma "Lapela" presa em "Luísa"; esperar `[data-mic]` com 2 itens e o painel com "Canal" = 1; salvar e conferir que `script.lightMaps` no arquivo é igual ao de antes de abrir o Som.
- [ ] **Step 2:** `npm run build && npx playwright test e2e/f27-sound.spec.ts -g F27-H1` — FAIL.
- [ ] **Step 3:** implementar a casca, a Planta e as ligações no App e no menu.
- [ ] **Step 4:** PASS; `npx playwright test e2e/f25-cinematography.spec.ts` continua PASS (Mapa de Luz intocado).
- [ ] **Step 5: Commit** `"Som: janela com abas e a planta de microfones sobre a planta de luz"`

### Task 6: Ficha por cena

**Files:**
- Create: `src/renderer/SoundSheet.tsx`
- Modify: `src/shared/sound.ts` (`sheetsReport`)
- Test: `tests/sound.test.ts`, `e2e/f27-sound.spec.ts`

**Interfaces:**
- Produces: `sheetsReport(scenes: SceneInfo[], sound: Sound, maps: LightMap[]): Report` — título "Fichas de som", `printed.sections` uma por cena com ficha não vazia (título "Cena N · CABEÇALHO"), colunas `['Item', 'Anotação']`, linhas na ordem do spec (Captação, Quem fala, Microfones, Riscos, O que pedir no set, Room tone, Efeitos, Playback, Observações), omitindo as vazias.
- `SoundSheetView`: lista de cenas à esquerda (sinal nas cenas com ficha), ficha à direita com os 7 grupos do spec; "Quem fala" lista `scene.cast` com lapela/vara/os dois/nada e mostra ao lado os microfones da cena (`micsOfScene`). "Exportar fichas (PDF)" em retrato.

- [ ] **Step 1:** teste de unidade: `sheetsReport` com uma ficha `{ capture: 'direct', risks: ['Trânsito'], roomTone: true, roomToneSeconds: 30 }` → seção da cena com linhas `['Captação', 'Som direto']`, `['Riscos', 'Trânsito']`, `['Room tone', '30 s']`; cena sem ficha não aparece. Teste de interface `F27-H2`: marcar "Som direto", "Trânsito", lapela para MARINA; mover a cena 1 para depois da 2 no navegador; a ficha continua na cena COZINHA.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5: Commit** `"Som: ficha de som por cena"`

### Task 7: Ambientes e músicas, e as tabelas no PDF

**Files:**
- Create: `src/renderer/Ambiences.tsx`
- Modify: `src/shared/sound.ts` (`ambiencesReport`, `musicReport`), `src/shared/reportHtml.ts` (`ReportPrint.tables?: { title: string; columns: string[]; rows: (string | number)[][] }[]`, impressas uma depois da outra, cada uma com `<h2>` e sua tabela, passando por `cleanReport` e pelo corte de colunas vazias), `src/shared/reports.ts` (`printed.tables` e `printable` repassam), `src/shared/api.ts` (`ReportPdfRequest.tables?`), `src/shared/reports.ts` (`buildReports` ganha **Músicas** e **Equipamento de som** no fim)
- Test: `tests/sound.test.ts`, `tests/reporthtml.test.ts`

**Interfaces:**
- Produces: `ambiencesReport(sound: Sound): Report` (colunas `['Locação', 'O que gravar', 'Duração', 'Gravado', 'Observações']`); `musicReport(scenes: SceneInfo[], sound: Sound): Report` (colunas `['Título', 'Autor', 'Cenas', 'Tipo', 'Duração', 'Direitos', 'Observações']`; tipo "Toca na cena"/"Trilha"; direitos "Licenciada"/"Pendente"/"Original"/"Domínio público"; cenas pelos números atuais).
- `AmbiencesView`: locações vindas de `locationKey` das cenas; itens por locação com o que gravar, duração, observações, "gravado"; lista de músicas com escolha de cenas; botões "Exportar PDF" (as duas tabelas em `tables`) e "Músicas (CSV)".

- [ ] **Step 1:** testes: `musicReport` escreve as cenas pelos números atuais depois de a cena mudar de lugar; `buildReportHtml({ ..., tables: [a, b] })` contém dois `<h2>` e duas `<table>`; `buildReports` inclui ids `'musicas'` e `'equipamento-som'`.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5: Commit** `"Som: ambientes por locação e lista de músicas"`

### Task 8: Som na ordem do dia e PDF das plantas

**Files:**
- Modify: `src/shared/sound.ts` (`soundLineOf`, `ambiencesToRecord`), `src/shared/reportHtml.ts` (`CallSheetScene.sound`, `CallSheet.ambiences`, impressos e limpos), `src/shared/production.ts` (`dayReport(…, shots, sound?: { line(sceneId: string): string; ambiences(locations: string[]): string })`), `src/renderer/Production.tsx` + `App.tsx` (passar `sound`), `src/main/pdf.ts` (`soundPlansHtml`, opção `soundOnly`), `src/shared/api.ts` (`ExportFormat` ganha `'sound-pdf'`), `src/main/index.ts` (exportar `'sound-pdf'`)
- Test: `tests/sound.test.ts`, `tests/shots-plan.test.ts`, `tests/reporthtml.test.ts`

**Interfaces:**
- Produces:
  - `soundLineOf(sound: Sound, maps: LightMap[], sceneId: string): string` — exemplo exato: `'Som direto · Mic 1 (Shotgun, canal 1), Lapela 2 em Luísa (canal 2) · Riscos: Trânsito, Geladeira · Room tone 30 s'`; partes vazias omitidas; '' quando não há nada.
  - `ambiencesToRecord(sound: Sound, locations: string[]): string` — itens não gravados das locações do dia: `'CINE ESTRELA - CABINE: ruído do projetor; CINE ESTRELA - SALA: plateia vazia'`.
  - Folha do dia: linha `<p class="cs-row"><b>Som:</b> …</p>` no bloco da cena; no cabeçalho `<p class="cs-locs"><b>Gravar ambientes:</b> …</p>`.
  - PDF das plantas: uma página por planta com o `soundPlanSvg` e a tabela Nome, Tipo, Modelo, Canal, Sem fio, Altura, Operador/ator.

- [ ] **Step 1:** testes: `soundLineOf` com o exemplo exato acima; sem ficha nem microfones → ''; `dayReport(..., sound)` põe `sound` na cena e `ambiences` no cabeçalho do `callsheet`; `buildReportHtml` imprime "Som:" só na cena que tem; `buildPdfHtml(script, { soundOnly: true })` tem uma página por planta e o texto "Shotgun".
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5: Commit** `"Som: linha de som na ordem do dia e PDF das plantas"`

### Task 9: Equipamento na tela, manual e verificação de ponta a ponta

**Files:**
- Modify: `src/renderer/Sound.tsx` (aba Equipamento com `EquipmentView` e `soundAutoLines`), `src/shared/manual.ts` (seção "Som", grupo "Produção", palavras-chave som, microfone, lapela, vara, ambiente, room tone, música, direitos), `e2e/f27-sound.spec.ts`
- Test: `tests/manual.test.ts`, `e2e/f27-sound.spec.ts`

- [ ] **Step 1:** testes de interface: `F27-H3` (Equipamento mostra "Shotgun · MKH 416" com quantidade 1 vinda da planta; marcar "Retirado"; acrescentar "Fone" à mão; exportar CSV); `F27-H4` (ordem do dia do dia com a cena tem "Som: Som direto · Mic 1 (Shotgun, canal 1)"); `F27-A1` (axe nas quatro abas, claro e escuro, sem violações sérias); `F27-E1` (apagar o mapa de luz: a planta de som continua, os microfones aparecem). Teste de unidade do manual: tópico `'som'` existe e cita "Ficha por cena" e "Ctrl+Alt+7".
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5:** verificação completa: `npx vitest run`, `npm run build && node tests/e2e/mcp-e2e.mjs . .e2e-shots`, `npx playwright test` — tudo PASS; gerar e olhar os PDFs (plantas, fichas, ambientes e músicas, equipamento, ordem do dia).
- [ ] **Step 6: Commit** `"Som: equipamento, manual e testes de ponta a ponta"`
