# Janela Luz Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** "Mapa de Luz" vira a janela Luz com Planta · Ficha por cena · Sol e horários · Equipamento.

**Architecture:** dados puros em `src/shared/lighting.ts`, `src/shared/sun.ts`, `src/shared/cities.ts`; telas em
`src/renderer/Light*.tsx` reaproveitando `EquipmentView`, `NumberField` e o padrão das fichas do Som.

**Tech Stack:** Electron + React + TypeScript, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-13-janela-luz-design.md`

## Global Constraints

- Nada na janela Luz muda a Planta (mapas de luz) a não ser a própria aba Planta.
- Fichas presas ao id da cena. Textos curtos até 200, longos até 2000 caracteres.
- Horas como "HH:MM"; datas como "AAAA-MM-DD".
- Os testes que clicam em "Mapa de Luz" passam a clicar em "Luz".

## Review Focus

1. Dia sem data ou sem lugar: a aba mostra "sem data"/"sem lugar", sem avisos e sem erro.
2. Lugar perto dos polos (dia ou noite inteiros): horários vazios, sem erro.
3. Arquivo antigo sem `lighting` nem datas: abre igual.
4. Cena mudada de lugar: ficha continua na cena.
5. Fuso: os horários saem na hora local do lugar.

---

### Task 1: Dados, sol e cidades

**Files:** Modify `src/shared/types.ts`, `src/shared/production.ts` (dia: `date`, `place`; `updateDay` aceita os dois), `src/shared/scriptfile.ts`. Create `src/shared/lighting.ts`, `src/shared/sun.ts`, `src/shared/cities.ts`. Test `tests/lighting.test.ts`, `tests/sun.test.ts`.

**Interfaces — Produces:**
- `Place {name, lat, lon, tz}`, `LightSheet`, `Lighting {sheets, place?, equipment, equipState}`, `Script.lighting?`, `ShootDay.date?`, `ShootDay.place?`.
- `emptyLighting()`, `emptyLightSheet()`, `cleanLighting(raw)`, `cleanPlace(raw)`, `LIGHT_SOURCES`, `LIGHT_EFFECTS`.
- `sunTimes(date, place): SunTimes | null` com `blueMorning, goldenMorning, goldenEvening, blueEvening: [string, string]`, `sunrise, noon, sunset: string` ('' quando não acontece).
- `sceneLight(time: string): 'day'|'night'|'dawn'|'dusk'|null`; `sunWarning(scene, at, sun, daylight): string | ''`.
- `BR_CITIES: Place[]`, `findCity(name)`, `parseCoords(text): {lat, lon} | null` (aceita "-23.55, -46.63" e links do Google Maps com "@lat,lon" ou "q=lat,lon").

- [ ] Testes: Londres 2026-06-21 (51.5074, −0.1278, fuso +1) nasce 04:43 e se põe 21:21 (±2 min); São Paulo 2026-06-21 nasce ~06:47, se põe ~17:28 (±3 min); a golden hour da tarde termina depois do pôr e a blue hour da tarde começa onde ela termina; Tromsø 2026-06-21 → nascer e pôr ''. `sunWarning` para EXT NOITE às 14:00 avisa; EXT DIA às 10:00 não; AMANHECER às 14:00 avisa. `cleanLighting` mantém uma ficha válida e descarta lixo; `cleanProduction` mantém `date` e `place` válidos. `parseCoords` lê os três formatos.
- [ ] FAIL → implementar → PASS. Commit "Luz: dados, cálculo do sol e lista de cidades".

### Task 2: Relatórios e equipamento da luz

**Files:** `src/shared/lighting.ts`, `src/shared/equipment.ts` (`lightAutoLines(maps)`), `src/shared/production.ts` (`dayReport(..., sound?, sun?: string)`; `CallSheet.sun?` e `CallSheet.date?`), `src/shared/reportHtml.ts`. Test `tests/lighting.test.ts`, `tests/reporthtml.test.ts`, `tests/equipment.test.ts`.

**Produces:** `lightSheetRows(sheet, cast)`, `lightSheetsReport(scenes, lighting): Report` (título "Fichas de luz"), `sunReport(days, scenes, lighting, production): Report` (tabelas "Sol por dia" e "Avisos"), `daySunLine(sun): string` ("Sol: nasce 06:12 · golden hour 17:05–17:43 · se põe 17:43"), `lightAutoLines(maps): AutoLine[]` (chave `tipo|W`, qtd = a maior num mapa), `heaviestLoad(maps)`.

- [ ] Testes dos quatro, e a folha do dia imprimindo "Sol:" só quando há.
- [ ] FAIL → implementar → PASS. Commit "Luz: fichas, sol por dia e equipamento como relatórios".

### Task 3: A janela Luz e a Ficha por cena

**Files:** Create `src/renderer/Light.tsx` (abas), `src/renderer/LightSheet.tsx`, `src/renderer/light.css`; Modify `App.tsx` (estado `lighting`, botão "Luz", painel), `main/index.ts` (menu "Luz"), testes e2e e scripts que clicam "Mapa de Luz", `src/shared/manual.ts`.
- [ ] e2e `F28-H1`: a janela Luz tem as quatro abas e a Planta é o mapa de sempre; `F28-H2`: a ficha de luz fica na cena quando ela muda de lugar.
- [ ] FAIL → implementar → PASS; f06, f08, f11, f13, f21, f25 continuam PASS. Commit "Luz: janela com abas e ficha de luz por cena".

### Task 4: Sol e horários

**Files:** Create `src/renderer/LightSun.tsx`, `src/renderer/PlacePicker.tsx`.
- [ ] e2e `F28-H3`: escolher São Paulo, dar data a um dia com uma cena EXT NOITE às 14:00 → horários aparecem e há um aviso; exportar PDF manda as duas tabelas.
- [ ] FAIL → implementar → PASS. Commit "Luz: sol e horários por dia de filmagem".

### Task 5: Equipamento, ordem do dia, IA e verificação

**Files:** `src/renderer/Light.tsx`, `src/renderer/Equipment.tsx` (`note?`), `src/renderer/Production.tsx` + `App.tsx` (linha do sol), `src/renderer/bridgeHandler.ts`, `mcp/rottera-mcp.cjs`, `tests/e2e/mcp-e2e.mjs`.
- [ ] e2e `F28-H4` (equipamento da planta), `F28-A1` (axe nas quatro abas, claro e escuro); MCP: `get_lighting`, `set_light_sheet`.
- [ ] Verificação completa: vitest, mcp-e2e, Playwright inteiro; olhar os PDFs. Commit "Luz: equipamento, ordem do dia, IA e testes".
