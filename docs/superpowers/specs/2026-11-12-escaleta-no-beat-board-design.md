# Escaleta no Beat Board — design

Data: 2026-11-12 · Tamanho: mudança média (um componente novo e ligações no App)

## Por quê

O Beat Board serve para seguir uma estrutura de roteiro: cada cartão é uma etapa (um beat). Mas um beat costuma ter
3 ou 4 cenas, e hoje o quadro não mostra essas cenas. A pessoa não consegue montar a escaleta a partir da estrutura.
O cartão vira cena uma vez só ("Virar cena") e depois perde o contato com o roteiro. A sinopse de cada cena só se
edita no navegador de cenas da aba Roteiro.

Caso real: *Batalha de Rima* tem 48 cenas e só 15 ligadas a beats; as outras 33 ficam "dentro" de algum beat, sem
aparecer no quadro.

## Objetivo

Uma coluna **Escaleta** ao lado do quadro: todas as cenas do roteiro, em ordem, agrupadas pelo beat a que pertencem,
com a sinopse editável. O que se escreve ali vai direto para a cena no roteiro.

## Não-objetivos (por enquanto)

- Arrastar cenas, ou mudar a ordem delas, ou passar uma cena de um beat para outro (mudaria a ordem do roteiro; fica
  para depois).
- Editar ação ou diálogo pela escaleta.
- Mudar o relatório "Escaleta" ou o PDF.

## Anti-objetivos (seria fracasso mesmo funcionando)

- O quadro deixar de ser lido de relance (cartões altos, parede de texto).
- Sinopse escrita na escaleta que não aparece no roteiro, ou que some ao trocar de aba, ou que não se desfaz com Ctrl+Z.
- Criar dados novos no arquivo só para isso: a ligação cena→beat tem de continuar sendo a que já existe (`bid`).

## Abordagens consideradas

- **A. Cenas dentro de cada cartão** (expandir o cartão). Tudo num lugar só, mas os cartões ficam altos e o quadro
  perde a leitura de relance.
- **B. Coluna Escaleta ao lado do quadro** — **escolhida pelo usuário.** O quadro fica como está; a coluna lê de cima
  para baixo como uma escaleta, mostra também as cenas sem beat, e o cartão só ganha a contagem de cenas.
- **C. Só o resumo no cartão** ("Cenas 16 a 18", sem editar). Simples, mas não deixa montar a escaleta.

## Como fica

```
 QUADRO (como hoje)                          │ ESCALETA                     [ocultar]
 [Catalisador]  [Debate]  ...                │ ── Sem beat
   Cena 9 · 1 cena                           │ 1  INT. CASA - QUARTO - MANHÃ
                                             │    O quarto conta quem é Léo... 
 [Diversão e brincadeiras]                   │ ── Diversão e brincadeiras
   Cena 16 · 3 cenas  ← clique leva a coluna │ 16 EXT. VIADUTO - NAVALHA - NOITE
                                             │    Léo enfrenta Kaíque...
                                             │ 17 INT. CASA - SALA - MADRUGADA
                                             │    O avô assiste ao vídeo...
                                             │ + cena neste beat
```

### Quais cenas são de qual beat (decisão: regra derivada, sem dado novo)

Percorre as cenas na ordem do roteiro. Uma cena cujo cabeçalho é o **primeiro** com `bid` de um beat que existe no
quadro (a mesma regra de `beatLinks`) abre o grupo daquele beat; as cenas seguintes ficam nesse grupo até o próximo
cabeçalho que abre outro grupo. Cenas antes do primeiro grupo ficam em **"Sem beat"**. A ordem dos grupos é a ordem do
roteiro, não a do quadro (se as duas divergirem, a escaleta mostra o roteiro como ele está).

Função pura nova em `src/shared/beats.ts` (ex.: `scenesByBeat(blocks, board)`), testada com Vitest.

### Cada cena na coluna

- Número da cena e **cabeçalho** editável numa linha (é o que se precisa para montar a escaleta: lugar e hora).
  Grava no bloco do cabeçalho pelo editor (`replaceRange` daquele bloco), mantendo `bid` e `syn`.
- **Sinopse** editável, campo que cresce com o texto (igual aos cartões e à ficha). Grava com
  `handle.setSynopsis(index, cleanSynopsis(texto))` — a mesma função do navegador de cenas: desfaz com Ctrl+Z, fica
  no arquivo, aparece no navegador e no relatório Escaleta.
- Gravar ao sair do campo (blur) e com Enter na linha do cabeçalho; não a cada tecla (evita uma revisão por letra).
- Um botão/link discreto "ir para a cena" leva à aba Roteiro naquele ponto (`goToSceneBlock`, que já existe).

### Criar cena

"+ cena neste beat" no fim de cada grupo (inclusive "Sem beat"): insere um cabeçalho `INT. LOCAL - DIA`
(`DEFAULT_HEADING`) **sem `bid`** logo depois da última cena do grupo — por isso ele cai no mesmo beat pela regra
acima. O foco vai para o cabeçalho novo na coluna. Desfaz com Ctrl+Z.

Beats que ainda não têm cena não aparecem como grupo; o cartão continua com "Virar cena", que já faz isso.
(Decisão minha; dá para acrescentar depois um grupo vazio com "criar a primeira cena".)

### No cartão do beat

Ao lado do botão "Cena N", a contagem: "· 3 cenas". Clicar na contagem rola a coluna até o grupo desse beat.

### Layout

- Botão "Mostrar escaleta / Ocultar escaleta" na barra do quadro; aberta por padrão; o estado fica guardado em
  `localStorage` (preferência de tela, não vai para o arquivo).
- Coluna à direita com largura ~360 px, rolagem própria e fixa na tela enquanto o quadro rola (como a apresentação
  da ficha). Abaixo de 1100 px de janela, a coluna vai para baixo do quadro.
- Segue os tokens de tema (claro/escuro) já usados no quadro.

## Restrições

- O editor fica montado (só escondido) quando o quadro está aberto; todas as gravações passam por ele, nunca direto
  no estado `blocks`.
- `blocks` no App é atualizado com atraso em roteiros longos (`LONG_SCRIPT_BLOCKS`); a coluna lê de `blocks`, então
  pode mostrar o texto um instante atrasado depois de uma gravação — aceitável, mas o campo em edição não pode ser
  sobrescrito enquanto tem foco.
- Arquivos misturam CRLF e LF: manter o fim de linha de cada arquivo.
- Interface em português do Brasil; rótulos acessíveis (aria) como no resto do quadro.

## Testes

- Vitest: `scenesByBeat` — sem beats, cenas antes do primeiro beat, beat com várias cenas, `bid` repetido em outra
  cena (continua sendo cena do grupo atual), `bid` de beat apagado do quadro.
- Playwright (`e2e/f26-escaleta.spec.ts`): importar um roteiro, criar beats e cenas, editar a sinopse na coluna e
  ver no navegador de cenas; Ctrl+Z desfaz; "+ cena neste beat" cria a cena no lugar certo; contagem no cartão;
  tema escuro e axe sem violações.

## Fica para quem constrói

Nomes de classes CSS, o texto exato dos rótulos, a forma de rolar a coluna até o grupo.
