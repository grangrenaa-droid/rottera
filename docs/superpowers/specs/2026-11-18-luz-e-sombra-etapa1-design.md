# Luz e sombra no mapa — Etapa 1 (paredes) — desenho

O Victor pediu a simulação de luz e sombra no mapa de luz (lista de 17/11) e autorizou só a Etapa 1, para ver o
resultado antes das próximas: 2) janela e porta, 3) modificadores, 4) acabamento.

## O que faz

- Cada mapa ganha a chave **"Luz e sombra"** (desligada por padrão: os mapas que existem não mudam).
- Com ela ligada:
  - **Luzes** (menos sol e lua): o feixe passa a ser a área que a luz alcança dentro da abertura e do alcance dela,
    parando na primeira parede no caminho.
  - **Sol e lua:** iluminam o mapa inteiro na direção para onde a peça aponta (raios paralelos); cada parede deixa
    atrás de si uma sombra até a borda do mapa. A luz é um tom claro da cor do sol ou da lua; a sombra, um cinza leve.
- Só as **paredes** barram a luz nesta etapa. Móveis não barram (ficam abaixo da altura das luzes); porta, janela e
  modificadores entram nas etapas 2 e 3.
- Vale na tela, no PDF do mapa e no mapa clarinho da janela Som (todos usam o mesmo desenho).

## Como

`src/shared/shadows.ts`, geometria pura em metros: os segmentos das paredes (centro, comprimento, rotação), a área
iluminada de uma luz por raios (um por grau, mais os que passam rente às pontas das paredes) e a sombra de cada parede
para uma luz paralela. `lightMapSvg` desenha essa camada embaixo das peças quando o mapa tem `shadows: true`.

## Não é

Um simulador físico: não calcula intensidade nem quanta luz chega; mostra onde há luz e onde há sombra.
