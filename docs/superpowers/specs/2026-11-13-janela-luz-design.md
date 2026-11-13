# Janela Luz — desenho

Projeto 2 de 3 (Som → **Luz** → Referências no Storyboard). Combinado com o Victor nesta sessão; ele pediu para seguir
direto ("Prossiga") com a escolha de lugar "cidade da lista + coordenadas".

## Por quê

O "Mapa de Luz" de hoje é só o desenho. A direção de fotografia e a elétrica precisam também do porquê da luz de cada
cena, de saber se a luz do sol vai estar certa no horário marcado, e de uma lista de trabalho para a locadora. A janela
Som já criou as peças (abas internas, lista de cenas com ficha, Equipamento); a Luz as reaproveita.

## O que muda

- O botão e o menu "Mapa de Luz" passam a se chamar **Luz** (mesmo atalho, Ctrl+Alt+5). A janela tem quatro abas, nesta
  ordem: **Planta · Ficha por cena · Sol e horários · Equipamento**.
- **Planta:** o Mapa de Luz de hoje, sem mudança nenhuma.
- **Ficha por cena** (presa à cena pelo id, como a do Som; sinal na lista nas cenas com ficha; "Exportar fichas (PDF)"):
  qualidade da luz (dura / suave), contraste (alto / baixo), cor geral (texto), de onde vem a luz da história (Sol,
  Janela, Lua, Luz de teto, Abajur, TV ou tela, Fogo ou vela, Poste, Faróis, Letreiro / neon, mais "outra"), horário e
  continuidade (texto), efeitos (Pisca, Fogo, TV, Relâmpago, Giroflex, Faróis passando, Lanterna, mais "outro"),
  energia e gerador (texto), tempo de montagem (minutos), observações. Ao lado, as luzes do mapa da cena.
- **Sol e horários:** o lugar do filme (cidade de uma lista embutida de cidades brasileiras com coordenadas e fuso, ou
  coordenadas digitadas / coladas de um link do Google Maps, com o fuso); cada dia de filmagem ganha uma **data** e pode
  ter um lugar próprio. Para cada dia: blue hour da manhã, nascer do sol, golden hour da manhã, golden hour da tarde,
  pôr do sol, blue hour da tarde. Avisos para as cenas com horário marcado cuja luz não bate: cena de dia antes do
  nascer ou depois do pôr do sol, cena de noite com sol, amanhecer fora da luz do amanhecer, entardecer fora da luz do
  entardecer. Valem para cenas EXT. e para cenas INT. cuja ficha de luz diz que a luz vem do Sol ou da Janela.
  Exportar PDF (a tabela dos dias e os avisos). Sem internet: é cálculo astronômico (NOAA).
- **Equipamento:** a ficha de trabalho do Som (mesmo componente). As luzes das plantas entram sozinhas por tipo e
  potência, na quantidade mais usada de uma vez num mapa; acima da tabela, a carga do mapa mais pesado.
- **Ordem do dia:** a data do dia e uma linha "Sol:" no alto (nasce, golden hour da tarde, se põe) quando o dia tem
  data e lugar.
- **Conexão com IA:** `get_lighting` (fichas, lugar, dias com sol e avisos) e `set_light_sheet`.
- Manual: o tópico do Mapa de Luz vira "Luz" e explica as abas.

## Definições

Golden hour: sol entre 6° acima e 4° abaixo do horizonte. Blue hour: entre 4° e 6° abaixo. Nascer e pôr: −0,833°.
Horas em hora local pelo fuso do lugar (o Brasil não tem horário de verão desde 2019).

## Não faz

Imagens de referência (vão para o Storyboard, projeto 3). Plano de circuitos elétricos. Clima/previsão do tempo.
Mudar o relatório "Equipamento de luz" de Relatórios (continua somando todos os mapas).

## Abordagens consideradas (lugar do sol)

1. Lista embutida de cidades — simples e offline. **Escolhida, junto com a 2.**
2. Coordenadas digitadas ou de um link do Google Maps — exato em qualquer lugar.
3. Busca de endereço na internet — descartada: deixa de funcionar offline e manda o endereço para fora.

## Decisões do construtor

- A lista de cidades tem as capitais e as principais cidades e destinos de filmagem (~110), com coordenadas de memória
  (erro de poucos centésimos de grau, menos de 1 minuto no horário do sol). Fora dela, coordenadas.
- O lugar do filme fica em `script.lighting.place`; data e lugar do dia ficam no dia de filmagem.
