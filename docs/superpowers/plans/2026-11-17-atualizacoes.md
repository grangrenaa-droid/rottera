# Atualizações (17/11) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** os oito itens pequenos e médios da lista do Victor.

**Architecture:** regras e limpeza em `src/shared` (testadas com vitest); telas em `src/renderer` (testadas com Playwright).

**Tech Stack:** Electron + React + TypeScript, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-17-atualizacoes-design.md`

## Global Constraints

- Arquivos antigos abrem iguais; campos novos são opcionais e limpos ao ler.
- Textos curtos até 200, longos até 2000 caracteres; imagens só pelos validadores de imagem que já existem.
- Cada item: teste que falha → código → teste passa → commit.

## Review Focus

1. Arquivo antigo sem os campos novos abre igual.
2. Cena ou locação renomeada: a ficha da locação segue a chave nova? (fica na chave antiga, listada como "não está mais no roteiro").
3. Pausa sem horário: entra no fim do dia.
4. Imagem inválida no arquivo: descartada.
5. Clique no nome do personagem numa linha de ação: não abre nada.

---

### Task 1: Pausas na ordem do dia
Dados `ShootDay.breaks?: {id, kind: 'breakfast'|'lunch'|'snack'|'dinner', time, minutes}[]`; limpeza; plano e ordem do dia. Commit "Filmagem: pausas de refeição no plano e na ordem do dia".

### Task 2: Mais móveis no mapa de luz
Tipos `roundtable, sofa, armchair, bed, wardrobe, counter, shelf` no grupo Cenário, com desenho e tamanho. Commit "Luz: mais móveis no mapa".

### Task 3: Cor da luz pela temperatura e luzes RGB
`kelvinColor(k)` contínuo; `LightItem.rgb?: string` ("#rrggbb"); facho, ficha técnica e painel. Commit "Luz: cor do facho pela temperatura e luzes RGB".

### Task 4: Storyboard sem rolagem
Campos de texto do quadro crescem com o texto. Commit "Storyboard: campos crescem com o texto".

### Task 5: Painel lateral com a ficha do personagem
Abas Notas · Personagem · Locação; clique no nome numa linha de personagem. Commit "Roteiro: ficha do personagem no painel lateral".

### Task 6: Locações
`Script.locations?: Record<locationKey, LocationSheet>`; aba Locações na Filmagem; fotos; clique na locação do cabeçalho. Commit "Filmagem: gestão de locações".

### Task 7: Elenco
`Script.people?: Person[]`; aba Elenco na Filmagem; aviso de indisponibilidade no plano. Commit "Filmagem: casting e elenco".

### Task 8: Referências no Storyboard
`Storyboard.references?: Reference[]`; abas Quadros · Referências. Commit "Storyboard: referências".

### Task 9: Manual, verificação completa, app
Manual; vitest, mcp-e2e, Playwright inteiro; gerar e instalar o app.
