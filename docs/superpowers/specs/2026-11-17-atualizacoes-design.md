# Atualizações do Rottera (lista de 17/11) — desenho

Pedido do Victor (arquivo "Atualizações ROTTERA.txt"): fazer as ideias pequenas e médias; a simulação de luz e sombra
no mapa fica para depois. Decisões do construtor ditas a ele antes de começar (ele pode corrigir).

## Itens

1. **Pausa de lanche na ordem do dia.** No Plano de filmagem, cada dia ganha pausas (Café da manhã, Almoço, Lanche,
   Jantar) com horário e duração em minutos. Na ordem do dia a pausa entra entre as cenas pela ordem do horário
   ("12:30 · Almoço · 1 h"); na tela do plano aparece na lista do dia.
2. **Mais móveis no mapa de luz:** mesa redonda, sofá, poltrona, cama, armário, bancada e estante, no grupo Cenário,
   com desenho próprio visto de cima e tamanho editável como a mesa.
3. **Cor da luz:** o facho segue a temperatura de cor de forma contínua (de âmbar a azul, passando pelo branco), já com
   a gelatina; uma luz pode ser marcada como **RGB** e ganhar uma cor escolhida, que vale para o facho, a ficha técnica
   e o PDF. (Antes o Victor tinha pedido para não mexer na cor do facho; este pedido novo substitui aquele.)
4. **Storyboard sem rolagem:** os campos de texto de cada quadro crescem com o texto em vez de mostrar barra de
   rolagem (como nas fichas de personagem).
5. **Ficha de personagem no painel lateral:** o painel das Notas ganha abas **Notas · Personagem · Locação**. A aba
   Personagem edita a ficha (os mesmos campos de Relatórios → Fichas de personagem). Clicar no nome do personagem
   numa linha de personagem (não na ação) abre o painel nessa aba e nessa ficha; o cursor continua no texto.
6. **Gestão de Locações:** aba **Locações** na janela Filmagem. As locações vêm dos cabeçalhos (a mesma chave do
   "Montar por locação"); cada uma tem ficha técnica: endereço, responsável e contato, autorização (pendente,
   autorizada, recusada), custo da diária, horários permitidos, energia, estacionamento, apoio (banheiro, camarim),
   ruídos, observações e **fotos de scouting** (várias, reduzidas como as do storyboard). Clicar na locação de um
   cabeçalho abre o painel lateral na aba Locação com essa ficha.
7. **Casting e Elenco:** aba **Elenco** na janela Filmagem. Pessoas (elenco, figuração, equipe) com foto, função ou
   personagem, contatos (telefone, e-mail), medidas para figurino (altura, manequim, calçado, tórax/busto, cintura,
   quadril), situação do contrato (em negociação, proposta enviada, assinado, recusado), datas em que não pode e
   observações. Quem faz um personagem aparece na ficha do personagem; o Plano de filmagem avisa quando uma cena com o
   personagem cai numa data em que a pessoa não pode.
8. **Referências no Storyboard:** a janela Storyboard ganha as abas **Quadros · Referências**. Referências são
   imagens com legenda, um tipo (Luz, Cor, Figurino, Locação, Enquadramento, Outro) e cenas ligadas (opcional), com
   filtro por cena e por tipo.

## Não faz agora

Simulação de luz e sombra no mapa (paredes, janelas, modificadores) — projeto grande, com protótipo antes.
A conexão com IA não lê dados pessoais do Elenco (contatos, medidas).

## Abordagem

Dados puros em `src/shared` com testes de unidade (limpeza do arquivo, regras), telas em `src/renderer` com testes de
interface (Playwright), um commit por item, no ramo `atualizacoes`. Fotos guardadas no arquivo como as imagens do
storyboard (reduzidas pelo app).
