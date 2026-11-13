# Janela Som — design

Data: 2026-11-13 · Tamanho: projeto (uma janela nova com quatro abas, dados novos no arquivo, PDFs e ordem do dia)

Este é o primeiro de três projetos combinados com o usuário, nesta ordem: **Som**, depois **Luz** (o Mapa de Luz vira
uma janela com abas Planta · Ficha por cena · Sol e horários · Equipamento) e por fim **Referências** (aba de imagens
de referência no Storyboard). O Som cria as peças que os outros dois reaproveitam: as abas internas de uma janela, a
lista de cenas com ficha e a aba Equipamento.

## Por quê

Hoje o Rottera não tem nada de pré-produção de som além da categoria "Som e música" na Decupagem (uma lista solta de
itens por cena). O técnico de som não tem onde planejar os microfones de cada cena, anotar os riscos de cada locação,
listar o que gravar além do diálogo, nem controlar as músicas e o equipamento. O usuário quer uma janela própria para
isso, usada pelo técnico de som, que leve o que ele planejou para o set.

## Quem usa e o que leva para o set

O técnico de som. Ele trabalha na janela Som e leva para o set o que sai impresso: os PDFs de cada aba e a **ordem do
dia**, que passa a ter uma linha de som em cada cena.

## Objetivo

Uma janela **Som**, na barra logo depois de **Mapa de Luz**, com quatro abas internas (como Decupagem / Plano de
filmagem na Filmagem):

1. **Planta** — a planta do set de cada cena, clarinha, com os microfones por cima.
2. **Ficha por cena** — uma ficha de som para cada cena do roteiro.
3. **Ambientes e músicas** — o que gravar por locação, e a lista de músicas do filme.
4. **Equipamento** — a lista de equipamento de som, com o que vem dos microfones e o que se acrescenta à mão.

## Não-objetivos (por enquanto)

- Gravar, tocar, mixar ou sincronizar áudio. O Rottera só planeja.
- Ferramentas da conexão com IA (MCP) para o som. Ficam para depois.
- A janela Luz e as Referências do Storyboard (os próximos projetos).
- Importar a lista de músicas de outro programa.

## Anti-objetivos (seria fracasso mesmo funcionando)

- **O som mexer no Mapa de Luz.** Nada do que se faz na janela Som pode alterar mapas de luz, nem aparecer neles.
- A planta do som ficar desatualizada em relação à de luz (uma cópia que não acompanha as mudanças).
- O técnico ter de preencher a mesma coisa duas vezes (o elenco da cena, os microfones no equipamento).
- A ordem do dia ficar mais difícil de ler por causa do som.

## Abordagens consideradas

- **Microfones como peças do próprio mapa de luz** (um grupo "Som" na paleta). Simples, mas o som mexeria no mapa de
  luz e apareceria nele — contra o pedido do usuário.
- **Planta de som com cópia da planta de luz.** Separa as duas coisas, mas a cópia fica velha quando a luz muda.
- **Microfones guardados à parte, desenhados sobre o desenho do mapa de luz — escolhida (decisão do Claude, aceita pelo
  usuário).** A planta de luz é desenhada clara e sem interação, os microfones ficam numa camada própria. Mudou a luz,
  a planta do som já mostra. O mapa de luz não é tocado.

## Como fica

```
Roteiro · Beat Board · Storyboard · Mapa de Luz · Som · Filmagem · Relatórios
                                                   │
           [ Planta ]  [ Ficha por cena ]  [ Ambientes e músicas ]  [ Equipamento ]
```

Atalho: **Ctrl+Alt+7**; menu Exibir → "Som".

### 1. Planta

```
 CENAS / PLANTAS          │  planta (clara, só consulta)                 │ MICROFONE SELECIONADO
 1 Cabine de projeção ●   │  ░parede░░░░░░░░░░░    ◁ Mic 1 (shotgun)     │ Nome   [Mic 1        ]
 2 Fachada                │      ░João░      (gota de captação)          │ Tipo   [Shotgun    ▾]
 3 Sala de exibição       │  ░Luísa░ ⊙ Lapela 2                          │ Modelo [MKH 416      ]
                          │           ░câmera A░  ░campo░                │ Canal  [1 ▾]  Sem fio [ ]
 MICROFONES               │                                              │ Altura [2,1 m]
 Shotgun · Supercardioide │                                              │ Na vara de [Ana     ]
 Cardioide · Omni         │                                              │ Preso em  [Luísa ▾] (lapela)
 Figura 8 · Lapela        │                                              │ Alcance [2 m]  Rotação [90°]
 Gravador                 │                                              │ [Apagar]
```

- A lista da esquerda mostra **os mapas de luz** (com a cena de cada um). Escolher um mostra a planta dele clara
  (opacidade baixa, sem nada clicável) e, por cima, os microfones daquele mapa.
- **Cena sem mapa de luz:** a lista mostra também as cenas que não têm mapa; ao escolher uma, o técnico pode criar uma
  **planta só de som** (só largura e fundo, como "Escrever o mapa" do Mapa de Luz). Ela vive na janela Som e não
  aparece no Mapa de Luz. Se depois for criado um mapa de luz para a cena, o técnico pode passar os microfones para
  cima dele (botão "Usar a planta de luz desta cena") — a posição em metros é mantida.
- **Tipos de microfone e o desenho da área de captação** (em escala, com o alcance em metros):
  cardioide (coração), supercardioide (coração estreito com lóbulo traseiro pequeno), shotgun (gota estreita e
  comprida), omnidirecional (círculo), figura 8 (dois lóbulos), lapela (círculo pequeno). Mais a peça **gravador**
  (sem área). Os tipos unidirecionais formam um grupo "Unidirecionais" na paleta.
- Cada microfone tem: nome, tipo, modelo (texto livre), canal do gravador (1–16), sem fio (sim/não), altura em metros,
  rotação, alcance (com valor inicial por tipo), quem opera a vara (texto livre) e, só para lapela, **o ator em que
  está preso** (um ator do mapa de luz). A lapela presa a um ator é desenhada junto dele e o segue quando a luz move o
  ator.
- Colocar, arrastar e girar funcionam como no Mapa de Luz (mesmo jeito de mexer: arrastar, bolinha de giro, setas do
  teclado), e há a mesma linha rápida para escrever ("shotgun canal 1 a 2,1 m").
- Exportar: **"Exportar plantas de som (PDF)"** — uma página por planta: a planta clara com os microfones e uma
  tabela com nome, tipo, modelo, canal, sem fio, altura, operador/ator.

### 2. Ficha por cena

À esquerda, a lista de cenas (como na Decupagem); à direita, a ficha da cena escolhida:

1. **Captação:** som direto · dublagem depois (ADR) · playback · sem som (MOS).
2. **Quem fala:** os personagens com fala na cena, vindos do roteiro. Para cada um: lapela, vara, os dois, ou nada.
   Os microfones da Planta daquela cena aparecem ao lado ("Lapela 2 presa em LUÍSA").
3. **Riscos do local:** marcar entre trânsito, avião, obra, vento, chuva, eco, gerador, ar-condicionado, geladeira; e
   um campo "outros".
4. **O que pedir no set** (texto): "desligar a geladeira", "parar o elevador".
5. **Sons a gravar na cena:** room tone (sim/não e duração em segundos, 30 s por padrão) e efeitos do próprio set
   (texto).
6. **Playback:** qual música ou arquivo, e de onde parte (texto).
7. **Observações** (texto).

A ficha acompanha a cena, não o número (como a Decupagem). A lista de cenas mostra um sinal nas cenas com ficha.
Exportar: **"Exportar fichas (PDF)"** — uma ficha por cena com conteúdo, em pé.

### 3. Ambientes e músicas

Duas listas na mesma aba:

- **Ambientes e sons-guia, por locação.** As locações vêm dos cabeçalhos (a mesma chave do "Montar por locação").
  Para cada locação, itens com: o que gravar (texto), duração aproximada, observações e "gravado" (sim/não).
- **Músicas.** Cada música: título, artista/autor, cenas em que entra (escolher na lista), tipo (toca na cena /
  trilha), duração (mm:ss), situação dos direitos (licenciada · pendente · original · domínio público), observações.

Exportar: **PDF** com as duas tabelas e **CSV** da lista de músicas.

### 4. Equipamento

Uma lista de trabalho: item, quantidade, locadora, retirado (sim/não), devolvido (sim/não), observações.

- **Os microfones da Planta entram sozinhos**, agrupados por tipo e modelo, com a quantidade (contando cada microfone
  uma vez em todo o filme, pelo maior número usado ao mesmo tempo numa planta). Essas linhas não se editam no nome e
  na quantidade, mas aceitam locadora, retirado, devolvido e observações.
- O resto entra à mão: gravador, varas, transmissores, fones, baterias, cabos.

Exportar: PDF e CSV (checklist).

Esta aba é escrita como um componente que a janela Luz vai reusar, com outra fonte de itens automáticos.

### Ordem do dia

Cada bloco de cena da folha do dia ganha **uma linha "Som"**, só quando há algo a dizer, com: a captação, os
microfones da cena ("Mic 1 shotgun, canal 1 · Lapela 2 em LUÍSA, canal 2"), os riscos e o room tone. No cabeçalho da
folha, se as locações do dia têm ambientes a gravar ainda não gravados, uma linha "Gravar ambientes: …".

### Relatórios

Entram dois relatórios novos na lista: **Músicas** e **Equipamento de som**.

## Dados (no arquivo `.rottera`)

Um campo novo `sound` no roteiro, opcional (arquivos antigos abrem sem ele):

- `plans`: plantas de som. Cada uma: `id`; `mapId` (o mapa de luz por baixo) **ou** `sid`/`scene` com `width`/`height`
  (planta só de som); `mics` (lista de microfones com `id`, `type`, `x`, `y`, `rotation`, `label`, `model`, `channel`,
  `wireless`, `height`, `range`, `operator`, `actorId`); `notes`.
- `sheets`: fichas por cena, pela id da cena (como a Decupagem).
- `ambiences`: itens por chave de locação.
- `music`: músicas (com as ids das cenas).
- `equipment`: itens à mão, e o estado (locadora, retirado, devolvido, observações) das linhas automáticas pela chave
  "tipo + modelo".

Tudo passa por uma função de limpeza ao abrir o arquivo (textos com tamanho máximo, números dentro de limites,
tipos conhecidos), como `cleanLightMap` e `cleanProduction`.

Se um mapa de luz for apagado, a planta de som dele não se perde: vira uma planta só de som da mesma cena, com o
tamanho que o mapa tinha.

## Decisões do Claude (o usuário pode mudar)

- **Cena com mais de um mapa de luz:** a Ficha da cena mostra os microfones de todas as plantas daquela cena.
- **Desfazer:** a Planta de som tem Desfazer/Refazer próprios, como o Mapa de Luz.
- **PDF do roteiro inteiro** ("Exportar PDF" da barra): **não** inclui as plantas nem as fichas de som; o som tem os
  PDFs dele. (O mapa de luz continua indo no PDF do roteiro como hoje.)
- **Lapela presa a um ator** segue a posição inicial do ator no mapa de luz (não a marcação de movimento).
- **Vara** não é um tipo de microfone: o shotgun ou o supercardioide ganham "Na vara de" (o operador). O desenho mostra
  a vara quando há operador.
- **Locação com sublocal** ("CINE ESTRELA - CABINE"): cada sublocal é uma locação própria nos ambientes, igual ao
  plano de filmagem.

## O que ficou com o construtor

- A forma exata de desenhar cada área de captação, desde que se reconheça o tipo e respeite o alcance em metros.
- Os alcances iniciais por tipo.
- Os textos de ajuda e a seção do manual (há de ter uma seção "Som").
- A divisão em etapas do plano de trabalho.

## Como se verifica

- Testes de unidade para a limpeza dos dados, o equipamento automático, a linha de som da ordem do dia e o PDF.
- Testes de interface (Playwright) fazendo o caminho do técnico: escolher a planta, pôr um shotgun e uma lapela presa
  num ator, preencher a ficha, ver a linha "Som" na ordem do dia; e conferir que o mapa de luz ficou igual.
- Acessibilidade (axe) nas quatro abas, claro e escuro.
- Olhar os PDFs gerados.
