/**
 * The built-in manual. Written for the app as it is: every key and menu name here exists.
 * `manual.test.ts` keeps a few of them honest (the shortcut table is checked against the editor's own tables).
 */
export type ManualPart =
  | { t: 'p'; text: string }
  | { t: 'ul'; items: string[] }
  | { t: 'ol'; items: string[] }
  | { t: 'note'; text: string }

export interface ManualTopic {
  id: string
  title: string
  group: 'Escrever' | 'Planejar' | 'Produção' | 'Arquivos' | 'IA' | 'Ajuda'
  /** Words people would type that the text itself does not use. */
  keywords: string[]
  body: ManualPart[]
}

export const MANUAL: ManualTopic[] = [
  {
    id: 'primeiros-passos',
    title: 'Primeiros passos',
    group: 'Escrever',
    keywords: ['comecar', 'novo', 'inicio', 'tutorial', 'modelo'],
    body: [
      { t: 'p', text: 'Na tela inicial, “Novo roteiro” abre uma página em branco. “Novo a partir de modelo” oferece Em branco, Aprenda o formato (um roteiro curto que ensina o formato escrevendo), Longa-metragem e Curta-metragem.' },
      { t: 'p', text: 'Escreva como num editor de texto: o Rottera cuida do formato. Cada linha é de um tipo (cabeçalho de cena, ação, personagem, diálogo…) e a tecla Enter já prepara o tipo seguinte.' },
      { t: 'ol', items: ['Digite INT. COZINHA - DIA e tecle Enter: vira cabeçalho de cena e a linha seguinte é ação.', 'Tecle Tab na linha de ação vazia para trocar para personagem. Escreva o nome, tecle Enter, e escreva a fala.', 'O Rottera salva sozinho, uns segundos depois da última tecla. Não há conta nem e-mail.'] },
      { t: 'note', text: 'Ctrl+Z desfaz, inclusive o que a IA escreveu. “Versões anteriores” guarda cópias do roteiro fora do arquivo.' }
    ]
  },
  {
    id: 'elementos',
    title: 'Elementos: Enter, Tab e atalhos',
    group: 'Escrever',
    keywords: ['tipo', 'formato', 'personagem', 'acao', 'dialogo', 'parentetico', 'transicao', 'plano', 'ctrl', 'tab', 'enter'],
    body: [
      { t: 'p', text: 'Há sete elementos. Você escolhe o tipo da linha na caixa “Elemento” da barra de ferramentas ou com Ctrl+1 a Ctrl+7:' },
      { t: 'ul', items: ['Ctrl+1 Cabeçalho de cena', 'Ctrl+2 Ação', 'Ctrl+3 Personagem', 'Ctrl+4 Parentético', 'Ctrl+5 Diálogo', 'Ctrl+6 Transição', 'Ctrl+7 Plano'] },
      { t: 'p', text: 'Enter cria a próxima linha no tipo mais provável: depois de cabeçalho vem ação; depois de personagem, diálogo; depois de diálogo, ação; depois de transição, cabeçalho.' },
      { t: 'p', text: 'Tab no fim de uma linha com texto passa para o tipo que costuma seguir: ação → personagem, personagem → parentético, parentético → diálogo, diálogo → personagem. Tab numa linha vazia troca o tipo em ciclo; Shift+Tab volta no ciclo.' },
      { t: 'p', text: 'Enter numa linha vazia de diálogo, personagem ou parentético sai dela e vira ação.' },
      { t: 'p', text: 'Se você escrever INT., EXT. ou INT./EXT. no começo de uma linha de ação e teclar Enter, ela vira cabeçalho de cena sozinha.' }
    ]
  },
  {
    id: 'cabecalho',
    title: 'Cabeçalhos de cena',
    group: 'Escrever',
    keywords: ['int', 'ext', 'local', 'hora', 'dia', 'noite', 'cena'],
    body: [
      { t: 'p', text: 'Escreva INT, EXT ou I/E e tecle Tab: o Rottera completa “INT. ” com o ponto e o espaço. Escreva o local e tecle Tab outra vez: ele acrescenta “ - ” para você digitar a hora (DIA, NOITE…).' },
      { t: 'p', text: 'Com o cabeçalho completo, Tab passa para a ação.' }
    ]
  },
  {
    id: 'sinopse',
    title: 'Sinopse da cena',
    group: 'Escrever',
    keywords: ['resumo', 'escaleta', 'outline', 'sumario', 'o que acontece', 'step outline'],
    body: [
      { t: 'p', text: 'Cada cena pode ter uma sinopse: uma ou duas frases sobre o que acontece nela. Ela aparece em cinza logo abaixo do cabeçalho e no navegador de cenas, e não sai no PDF do roteiro.' },
      { t: 'ul', items: ['No navegador, clique em “+ sinopse” (aparece ao passar o mouse e na cena atual) ou na sinopse que já existe. Enter grava, Esc desiste.', 'No texto, clique na sinopse em cinza para editá-la, ou tecle Ctrl+Alt+S (Editar → Sinopse da cena do cursor).', 'Exibir → “Mostrar ou ocultar sinopses no roteiro” tira as sinopses do texto; o navegador continua mostrando.', 'Quando um cartão do Beat Board vira cena, a descrição dele vira a sinopse.'] },
      { t: 'p', text: 'Em Relatórios, a “Escaleta” lista as cenas com a sinopse de cada uma, para imprimir ou exportar em CSV. A ficha da Decupagem e a ordem do dia também mostram a sinopse. No Fountain ela vai como uma linha “= sinopse” depois do cabeçalho, e volta ao importar. A IA conectada lê e escreve sinopses.' }
    ]
  },
  {
    id: 'smarttype',
    title: 'SmartType: nomes e locais',
    group: 'Escrever',
    keywords: ['autocompletar', 'sugestao', 'renomear', 'personagem', 'local', 'extensao'],
    body: [
      { t: 'p', text: 'Ao escrever um nome de personagem ou um local, o Rottera sugere os que já apareceram no roteiro. Use as setas para escolher e Enter ou Tab para aceitar; Esc fecha a sugestão.' },
      { t: 'p', text: 'Em Mais → “Gerenciar SmartType…” (ou Editar → Gerenciar SmartType) você vê as listas, acrescenta nomes e pode “Renomear em tudo”: troca o nome em todas as falas e cabeçalhos. A ficha do personagem acompanha o novo nome.' }
    ]
  },
  {
    id: 'duplo',
    title: 'Diálogo duplo',
    group: 'Escrever',
    keywords: ['lado a lado', 'simultaneo', 'colunas', 'dual'],
    body: [
      { t: 'p', text: 'Duas falas ao mesmo tempo, em colunas. Coloque o cursor numa fala (ou no nome do personagem) e tecle Ctrl+D, ou use o botão “Diálogo duplo”. Tecle de novo para desfazer.' },
      { t: 'p', text: 'A fala marcada vai para a coluna da direita, junto com o personagem e o parentético dela. No PDF as duas colunas ficam lado a lado.' }
    ]
  },
  {
    id: 'navegador',
    title: 'Navegador de cenas',
    group: 'Escrever',
    keywords: ['lista de cenas', 'mover', 'reordenar', 'arrastar', 'pular'],
    body: [
      { t: 'p', text: 'A coluna à esquerda lista as cenas com número e página. Clique numa para ir até ela. Ctrl+\\ mostra ou esconde o navegador (em janelas estreitas ele fica em “Mais”).' },
      { t: 'p', text: 'Para reordenar, arraste a cena ou use as setas ↑ e ↓ que aparecem ao passar o mouse. A cena inteira, com tudo o que há dentro dela, muda de lugar. Ctrl+Z desfaz.' }
    ]
  },
  {
    id: 'localizar',
    title: 'Localizar e substituir',
    group: 'Escrever',
    keywords: ['buscar', 'procurar', 'trocar', 'ctrl f'],
    body: [
      { t: 'p', text: 'Ctrl+F abre a barra de busca. O texto é procurado do jeito que você digitou (sem expressões especiais) e as ocorrências ficam destacadas. “Maiúsculas” diferencia maiúsculas de minúsculas.' },
      { t: 'ul', items: ['Anterior e Próximo percorrem os resultados.', '“Substituir” troca o resultado atual; “Substituir tudo” troca todos.', 'Deixar “Substituir por” vazio apaga o que foi encontrado.'] },
      { t: 'note', text: 'Em roteiros longos (mais de umas 60 páginas), as quebras de página, o navegador e a contagem de páginas se atualizam um instante depois que você para de digitar, para a digitação não pesar.' }
    ]
  },
  {
    id: 'notas',
    title: 'Notas (post-its)',
    group: 'Escrever',
    keywords: ['comentario', 'post-it', 'postit', 'lembrete', 'anotacao', 'observacao', 'revisar'],
    body: [
      { t: 'p', text: 'As notas ficam numa coluna à direita da página, como post-its, na ordem do roteiro e separadas por cena. O botão “Notas” da barra (ou Exibir → Mostrar ou ocultar notas) abre e fecha a coluna.' },
      { t: 'ol', items: ['Coloque o cursor na linha que a nota comenta.', 'Clique em “Nova nota” ou tecle Ctrl+Alt+M (Editar → Nova nota na linha do cursor).', 'Escreva. A nota é salva junto com o roteiro.'] },
      { t: 'ul', items: ['A linha com nota fica destacada na cor da nota.', 'A frase no alto do post-it leva até a linha.', 'Cores: amarelo para nota, azul para pergunta, rosa para reescrever, verde para resolvido.', 'Se você mover a cena, a nota vai junto. Se apagar a linha, a nota fica em “Soltas”, para você prender na linha do cursor ou apagar.'] },
      { t: 'note', text: 'As notas não saem no PDF. No Fountain elas vão como [[nota]], no fim da linha. Com a conexão com uma IA ligada, ela pode ler as notas e fazer os ajustes (veja “Conectar a uma IA”).' }
    ]
  },
  {
    id: 'leitura',
    title: 'Leitura em voz alta',
    group: 'Escrever',
    keywords: ['ouvir', 'voz', 'vozes', 'table read', 'leitura de mesa', 'narrador', 'falar', 'audio', 'som'],
    body: [
      { t: 'p', text: 'O Rottera lê o roteiro em voz alta com as vozes do próprio computador, sem internet: um narrador lê cabeçalhos, ação e transições, e cada personagem lê as próprias falas. Os parentéticos não são lidos. Abra em Exibir → Leitura em voz alta (Ctrl+Shift+L) ou em Mais.' },
      { t: 'ul', items: ['“Ler do cursor” começa na linha do cursor. A linha que está sendo lida fica destacada e a página acompanha.', 'Pausar, Continuar e Parar controlam a leitura; fechar a barra também para.', 'Em “Vozes” você escolhe a voz e o tom (grave, normal, agudo) do narrador e de cada personagem, e pode ouvir antes. O Rottera já distribui as vozes para que ninguém soe igual ao narrador.', 'Velocidade e “Ler os nomes” (dizer o nome do personagem antes da fala) também ficam na barra.', 'As escolhas ficam salvas no arquivo do roteiro.'] },
      { t: 'note', text: 'O Windows costuma trazer duas vozes em português (Maria e Daniel); com poucas vozes, os personagens dividem as vozes em tons diferentes. Para instalar mais: Configurações → Hora e idioma → Fala → Adicionar vozes.' }
    ]
  },
  {
    id: 'numeracao',
    title: 'Números de cena e travamento',
    group: 'Produção',
    keywords: ['numerar', 'travar', 'bloquear', '3a', 'producao'],
    body: [
      { t: 'p', text: 'Em Produção, “Mostrar números de cena” escreve o número nas duas margens da página e no PDF.' },
      { t: 'p', text: '“Travar numeração” congela os números atuais. Cenas novas depois disso recebem letras (3A, 3B…) em vez de renumerar tudo, como se faz quando o roteiro já está em produção. Destravar volta à numeração corrida.' }
    ]
  },
  {
    id: 'revisoes',
    title: 'Revisões',
    group: 'Produção',
    keywords: ['alteracoes', 'cor', 'azul', 'rosa', 'marcas', 'asterisco', 'versao'],
    body: [
      { t: 'p', text: 'Em Produção, ligue “Modo de revisão” e escolha a cor. A partir daí, cada trecho que você mudar é marcado com um asterisco na margem direita, na cor da revisão. Para uma nova rodada, troque a cor.' },
      { t: 'p', text: 'As marcas vão para quem recebe o roteiro: no PDF, cada linha alterada leva um asterisco na margem direita e cada página alterada leva no alto a revisão mais recente dela e a data em que a rodada começou (“REVISÃO ROSA · 12/11/2026”); no Word, o asterisco vai na margem ao lado de cada parágrafo alterado. Assim a equipe troca só as páginas que mudaram.' },
      { t: 'p', text: '“Limpar marcas de revisão” tira as marcas sem mexer no texto e zera as datas das rodadas. O relatório “Revisões” lista o que foi marcado em cada cor.' }
    ]
  },
  {
    id: 'paginas',
    title: 'Páginas e papel',
    group: 'Produção',
    keywords: ['a4', 'carta', 'letter', 'quebra', 'pagina', 'more', 'contd', 'mais'],
    body: [
      { t: 'p', text: 'Em Mais → “Papel do PDF” você escolhe A4 ou Carta. Em computadores configurados em português do Brasil o padrão para roteiros novos é A4. A escolha fica gravada no arquivo.' },
      { t: 'p', text: 'O editor desenha as quebras de página enquanto você escreve, e a barra de status mostra a página atual e o total. Uma página tem cerca de 58 linhas em A4 e 55 em Carta.' },
      { t: 'p', text: 'Quando um diálogo continua na página seguinte, o PDF coloca (CONTINUA) no fim da página e repete o nome do personagem com (CONT.) no início da próxima. Essas marcas aparecem no PDF, não no editor.' }
    ]
  },
  {
    id: 'beatboard',
    title: 'Beat Board e cenas ligadas',
    group: 'Planejar',
    keywords: ['estrutura', 'cartoes', 'beats', 'atos', 'outline', 'sinopse', 'virar cena'],
    body: [
      { t: 'p', text: 'O Beat Board organiza a história em colunas e cartões antes (ou durante) a escrita. “Aplicar estrutura” monta o quadro com Três atos ou Círculo em oito passos; depois você edita título e descrição, muda a cor, arrasta cartões entre colunas e cria colunas.' },
      { t: 'p', text: '“Virar cena” cria a cena no roteiro e liga o cartão a ela. O cartão passa a mostrar “Cena N” e o botão leva até a cena. Não dá para criar duas vezes a mesma cena.' },
      { t: 'p', text: '“Criar cenas para N beats” cria só as que faltam, na ordem da história, cada uma depois da cena do beat anterior. Pode apertar de novo à vontade: nada é duplicado e o que você escreveu nunca é sobrescrito.' },
      { t: 'note', text: 'Mudar o título do beat não reescreve a cena, e o contrário também não. A ligação serve para achar a cena e não duplicar. Se você apagar a cena, o beat volta a poder virar cena. “Aplicar estrutura” troca o quadro inteiro e as ligações antigas se perdem.' }
    ]
  },
  {
    id: 'storyboard',
    title: 'Storyboard',
    group: 'Planejar',
    keywords: ['imagens', 'quadros', 'planos', 'desenho', 'fotos', 'pdf'],
    body: [
      { t: 'p', text: 'A aba Storyboard monta uma sequência de quadros com imagem, legenda e a cena a que pertence. Adicione imagens com o botão “Escolher imagens”, arrastando arquivos para a janela ou colando da área de transferência.' },
      { t: 'ul', items: ['Cada quadro tem legenda e cena; a ordem muda com os botões de mover.', 'Cada quadro também tem o plano: tamanho (plano geral, médio, close…), ângulo (plongée, contra-plongée…), movimento e lente. Eles saem embaixo do quadro no PDF e formam a “Lista de planos” em Relatórios (a decupagem técnica).', 'O quadro fica preso à cena: se a cena mudar de número, o quadro acompanha. No navegador, a cena mostra “2 quadros” e o clique abre o storyboard nela.', 'Escolha a proporção do quadro e quantos quadros por página (2, 4, 6 ou 9).', 'As imagens grandes são reduzidas para no máximo 1600 pixels ao importar.', '“Incluir no PDF do roteiro” coloca o storyboard no fim do PDF; “Exportar só o storyboard” gera um PDF só dele.'] }
    ]
  },
  {
    id: 'mapaluz',
    title: 'Luz: mapa de luz, fichas, sol e equipamento',
    group: 'Planejar',
    keywords: ['marcacao', 'marca', 'blocking', 'pontos', 'iluminacao', 'luz', 'camera', 'refletor', 'set', 'esquema', 'diagrama', 'difusor', 'fotografia', 'direcao de fotografia', 'gelatina', 'kelvin', 'temperatura de cor', 'lente', 'potencia', 'carga', 'gerador', 'amperes'],
    body: [
      { t: 'p', text: 'A janela Luz (botão “Luz” na barra, ou Ctrl+Alt+5) tem quatro abas: Planta (o mapa de luz), Ficha por cena, Sol e horários e Equipamento.' },
      { t: 'ul', items: ['Ficha por cena: o porquê da luz da cena. Luz dura ou suave, contraste, cor, de onde vem a luz da história (sol, janela, abajur, TV, fogo…), horário e continuidade, efeitos, energia e gerador, tempo de montagem e observações. Fica presa à cena, mesmo que ela mude de número; “Exportar fichas (PDF)” imprime as preenchidas.', 'Sol e horários: escolha a cidade do filme numa lista, ou cole coordenadas ou um link do Google Maps, e dê uma data a cada dia de filmagem (um dia pode ter um lugar próprio). Para cada dia aparecem blue hour, nascer do sol, golden hour e pôr do sol, calculados sem internet. Os avisos mostram as cenas com horário marcado no Plano de filmagem cuja luz não bate: cena de dia depois do pôr do sol, de noite com sol, amanhecer à tarde. Valem para as externas e para as internas cuja ficha diz que a luz vem do Sol ou da Janela.', 'Equipamento: as luzes dos mapas entram sozinhas, por tipo e potência, na quantidade mais usada de uma vez num mapa, com a carga do mapa mais pesado; o resto se acrescenta em “+ Item”. Cada linha tem locadora, retirado, devolvido e observações.', 'A ordem do dia de cada dia ganha a data e uma linha “Sol:” quando o dia tem data e lugar. Uma IA conectada lê tudo isso e pode preencher a ficha de luz de uma cena.'] },
      { t: 'p', text: 'Planta: um desenho visto de cima do set, com câmeras, atores, luzes, modificadores (bandeiras, difusores, rebatedores), peças do set (máquina de fumaça, monitor, gerador) e de cenário. Cada mapa tem nome, tamanho em metros, cena e notas; um roteiro pode ter vários.' },
      { t: 'ul', items: ['Clique numa peça da lista para colocá-la no desenho e arraste para posicionar.', 'Marcação dos atores: selecione o ator e use “+ Marca” no painel. Cada marca é o ator clarinho, numerado (Marina 2, Marina 3…), ligado por setas laranja; arraste para mudar o lugar, gire pela bolinha para dizer para onde ele olha e curve o caminho pelo losango.', 'Para girar, arraste a bolinha azul que aparece na peça selecionada, na direção para onde ela aponta: a peça vira para onde você puxar (de 15 em 15 graus com “Ajustar à grade”; com Shift, livre).', 'Com a peça selecionada: setas movem 0,1 m (com Shift, 0,5 m); R gira 15° (Shift+R, no sentido contrário); Ctrl+D duplica; Delete apaga; Esc solta a seleção.', 'Luzes e câmeras têm abertura (ângulo) e alcance, desenhados no mapa.', 'O mapa é impresso depois do roteiro e do storyboard, ou sozinho em “Exportar só os mapas de luz”.', 'O mapa fica preso à sua cena e acompanha o número dela; o navegador e a Decupagem levam até ele.'] },
      { t: 'p', text: 'Para a direção de fotografia, cada luz tem uma ficha técnica no painel da direita: função (principal, preenchimento, contra, recorte, fundo, prática, ambiente, efeito), potência, temperatura de cor, gelatina, difusão, intensidade e altura. Uma luz nova já vem com a potência e a temperatura de costume do aparelho.' },
      { t: 'ul', items: ['Cada luz ganha um número no desenho, na ordem em que foi colocada.', 'O facho é desenhado quente (laranja) ou frio (azul) conforme a temperatura de cor; a gelatina (CTO, CTB…) muda a temperatura e a cor do facho.', 'A câmera tem lente (mm) e sensor (Super 35, Full Frame…): com a lente, o ângulo de visão desenhado é calculado. Também tem altura e plano.', 'O movimento da câmera aparece no próprio desenho: travelling e dolly como um trilho com seta, steadicam/gimbal tracejado, câmera na mão ondulado, grua e drone com o nome, sempre até uma câmera clara na posição final (A → A′). O movimento tem pontos: A → A2 → A3… Cada ponto é uma câmera clara, com o próprio campo de visão: arraste-a para mudar o lugar e gire-a pela bolinha azul dela (ou escreva X, Y e a rotação de cada ponto no painel). “+ Ponto” acrescenta um ponto depois do último; o × tira um ponto. Arraste o losango no meio do caminho para curvá-lo (por exemplo, um steadicam que contorna o ator); no travelling e no dolly o trilho só faz arco de círculo, e o painel mostra o raio; “Caminho reto” desfaz a curva. No dolly, a câmera do fim ajusta lente e alcance para manter o enquadramento da câmera do começo (recuando, lente mais longa; chegando perto, mais curta). Na panorâmica, a câmera clara fica no mesmo lugar: gire-a pela bolinha dela até onde a panorâmica termina. No zoom, puxe o quadradinho na ponta do campo de visão claro: mais longe, lente mais longa. O tilt aparece escrito junto da câmera. Trocar o movimento recomeça os ajustes do movimento.', 'Tudo do mapa pode ser escrito numa linha, como se fala no set, e Enter. No alto do painel de qualquer peça fica "Escrever a ficha": "principal 2K 5600K 1/2 CTB 216 a 2,4 m 80%" numa luz, "35mm full frame close travelling" numa câmera, "4 m 90°" numa parede, "1,6 x 0,9" numa mesa (comprimento por largura). Em todas valem rotação ("90°"), posição ("x 2 y 3,5"), abertura ("abertura 40°") e alcance ("alcance 3 m"). 2K com número pequeno é potência (2.000 W); 3200K ou 5600K é temperatura; um "2,4 m" solto é a altura de uma luz ou câmera e o comprimento de uma parede, porta, janela, bandeira ou mesa. Abaixo da barra do mapa, "Escrever o mapa" recebe a largura e o fundo do set e a cena: "6 x 4 cena 3". O app diz o que entendeu e as palavras que não entendeu; os campos continuam lá para ajustar.', 'O painel mostra a carga do mapa: potência somada e corrente em 127 V e 220 V. No PDF, cada mapa ganha uma página de ficha técnica com as luzes numeradas, as câmeras e a carga.', 'Em Relatórios, “Equipamento de luz” soma os aparelhos de todos os mapas, por tipo e potência, com a corrente total: serve para o pedido à locadora e para dimensionar o gerador.', 'Além de fresnel, LED, HMI e softbox, há PAR, elipsoidal, tubo de LED, Kino Flo, balão chinês, Dedolight, painel LED grande, luz de lua, butterfly/overhead, cucoloris, máquina de fumaça e gerador.'] }
    ]
  },
  {
    id: 'som',
    title: 'Som: microfones, fichas e músicas',
    group: 'Produção',
    keywords: ['som', 'microfone', 'lapela', 'vara', 'boom', 'shotgun', 'ambiente', 'room tone', 'musica', 'direitos', 'tecnico de som', 'captacao', 'playback', 'adr', 'dublagem', 'locadora'],
    body: [
      { t: 'p', text: 'A janela Som (botão “Som” na barra, ou Ctrl+Alt+7) é a pré-produção do técnico de som. Ela tem quatro abas: Planta, Ficha por cena, Ambientes e músicas, Equipamento. Nada do que se faz aqui muda o mapa de luz.' },
      { t: 'ul', items: ['Planta: escolha à esquerda um mapa de luz; a planta dele aparece clarinha e os microfones vão por cima. Uma cena sem mapa de luz pode ganhar uma planta só de som (“Criar planta de som”, com largura e fundo).', 'A paleta tem os unidirecionais (cardioide, supercardioide, shotgun) e os outros (omnidirecional, figura 8, lapela, gravador). O desenho mostra para onde o microfone capta e até onde. Arraste para mover, gire pela bolinha (de 15 em 15 graus; com Shift, livre); setas movem 0,1 m; Delete apaga; Ctrl+Z desfaz.', 'No painel do microfone: nome, tipo, modelo, canal, sem fio, altura, alcance e rotação; “Na vara de” para shotgun e supercardioide; “Preso em” para a lapela, que passa a acompanhar o ator do mapa. “Escrever o microfone” aceita uma linha como “shotgun canal 1 a 2,1 m”.', 'Ficha por cena: captação (som direto, dublagem, playback, sem som), quem fala e como é captado, riscos do local, o que pedir no set, room tone, efeitos, playback e observações. A ficha fica presa à cena, mesmo que ela mude de número. “Exportar fichas (PDF)” imprime uma ficha por cena com conteúdo.', 'Ambientes e músicas: por locação, o que gravar além dos diálogos; e a lista de músicas, com as cenas em que entram, tipo, duração e direitos. Exporta em PDF (as duas tabelas) e as músicas em CSV.', 'Equipamento: os microfones das plantas entram sozinhos (marcados “da planta”, na quantidade mais usada de uma vez numa planta); o resto se acrescenta em “+ Item”. Cada linha tem locadora, retirado, devolvido e observações.', 'Na Filmagem, a ordem do dia de cada dia ganha uma linha “Som:” em cada cena e, no alto, os ambientes que ainda faltam gravar nas locações do dia. Em Relatórios aparecem “Músicas” e “Equipamento de som”.', 'As plantas de som também saem por Mais → Exportar…, em “Plantas de som”. Uma planta que ficou sem mapa de luz e sem cena aparece em “Plantas sem cena”, para ver ou apagar (“Apagar planta de som”).', 'Uma IA conectada pode ler tudo isso, pôr microfones nas plantas e preencher a ficha de uma cena.'] }
    ]
  },
  {
    id: 'fichas',
    title: 'Fichas de personagem',
    group: 'Planejar',
    keywords: ['apresentacao', 'perfil', 'personagem', 'biografia', 'foto'],
    body: [
      { t: 'p', text: 'Em Relatórios → “Fichas de personagem” aparece quem fala no roteiro, do que mais fala ao que menos fala, com números tirados do próprio roteiro (falas, palavras, cenas, primeira página, com quem contracena). Você também pode criar um personagem que ainda não fala.' },
      { t: 'p', text: 'A ficha tem apelido, idade, papel na história, aparência, personalidade, objetivo, conflito, arco, relações e notas, além de uma imagem. O que você escreve aparece na hora na apresentação ao lado, e os números dela acompanham o roteiro.' },
      { t: 'p', text: 'As fichas preenchidas vão para o PDF do roteiro, depois do texto. Desmarque “Incluir no PDF do roteiro” numa ficha para deixá-la de fora, ou use “Exportar fichas (PDF)” para gerar só elas.' }
    ]
  },
  {
    id: 'decupagem',
    title: 'Decupagem',
    group: 'Produção',
    keywords: ['breakdown', 'filmagem', 'objetos', 'objetos de cena', 'adereco', 'figurino', 'figuracao', 'veiculo', 'efeitos', 'maquiagem', 'elenco', 'producao', 'analise tecnica'],
    body: [
      { t: 'p', text: 'A aba Filmagem (Ctrl+Alt+6) tem duas partes: Decupagem e Plano de filmagem. Na Decupagem você escolhe a cena na lista da esquerda e anota o que ela precisa no set, em doze categorias: figuração, dublês, objetos de cena, figurino, maquiagem e cabelo, veículos, animais, efeitos especiais, efeitos visuais, cenografia, som e música, equipamento especial.' },
      { t: 'ul', items: ['Escreva no campo da categoria e tecle Enter. O campo sugere o que você já usou em outras cenas: o mesmo nome é o mesmo elemento.', 'O × tira o elemento só desta cena.', 'O elenco vem do roteiro: quem tem fala na cena.', 'A duração da cena aparece em oitavos de página (1 3/8 pág.), como numa decupagem de produção.'] },
      { t: 'p', text: 'Em Relatórios, “Decupagem por cena” e “Elementos de produção” imprimem tudo em PDF ou CSV.' }
    ]
  },
  {
    id: 'plano',
    title: 'Plano de filmagem e ordem do dia',
    group: 'Produção',
    keywords: ['planos', 'storyboard', 'quadros', 'horario', 'hora', 'montar', 'automatico', 'inteligente', 'locacao', 'partir', 'dividir', 'cronograma', 'ordem do dia', 'call sheet', 'stripboard', 'faixas', 'diaria', 'dias de filmagem', 'oitavos'],
    body: [
      { t: 'p', text: '“Montar por locação” faz o plano sozinho: junta num dia todas as cenas sem dia que acontecem na mesma locação, com as cenas de dia antes das de noite. Os dias que você já montou não mudam; se a locação já tem um dia feito por esse botão, as cenas novas entram nele. Depois é só ajustar: o ✂ numa cena parte o dia em dois ali (a cena e as de baixo vão para um dia novo, logo em seguida), e as faixas podem ser arrastadas de um dia para outro. Solta sobre o dia, a cena vai para o fim; solta sobre outra cena, fica antes dela.' },
      { t: 'p', text: 'Em Filmagem → Plano de filmagem, “Novo dia” cria um dia de filmagem. Dê o nome que quiser (uma data, “Sábado · estúdio”). Leve as cenas para o dia arrastando a faixa ou escolhendo o dia na caixa da própria faixa; as setas mudam a ordem dentro do dia.' },
      { t: 'ul', items: ['As faixas têm a cor do tipo de cena: rosa INT. dia, amarelo EXT. dia, azul INT. noite, verde EXT. noite.', 'Cada cena de um dia tem um campo de horário (ex.: 08:30), que sai no plano e na ordem do dia. O horário vale para aquele dia: levar a cena para outro dia deixa o horário para trás; mudar a ordem dentro do dia mantém.', 'Cada dia mostra quantas cenas e quantas páginas tem. A coluna “Sem dia” pode ser ordenada por local, para juntar cenas do mesmo lugar.', '“Ordem do dia (PDF)” imprime a folha do dia, em pé: no alto o filme, o dia (“Dia 2 de 5”), o horário de início, o total de cenas e páginas, as locações e as notas do dia num quadro; depois um bloco por cena, com horário, INT/EXT, local, dia ou noite e páginas, a sinopse, os planos um por linha na ordem dos horários, o elenco e os elementos. O que a cena não tem não aparece. “Exportar plano (PDF)” imprime todos os dias numa tabela; uma coluna sem nada em nenhuma cena (sem sinopses, sem horários) fica de fora.', 'Apagar um dia devolve as cenas dele para “Sem dia”.'] },
      { t: 'p', text: 'Os quadros do storyboard são os planos da cena. A faixa de uma cena mostra embaixo os planos dela, numerados pela cena (3.1, 3.2…) com o tamanho, o movimento, a lente e a legenda; a cena leva todos para o dia dela, e o plano e a ordem do dia ganham a coluna “Planos”.' },
      { t: 'p', text: 'Para filmar um plano em outro dia, escolha o dia na caixa do próprio plano. A cena passa a aparecer nos dois dias como “parte”, cada um com os seus planos e as páginas em proporção. Um plano posto em “Sem dia” espera na coluna “Sem dia”, para não ser esquecido. Quando todos os planos voltam para o mesmo dia, a cena fica inteira de novo.' },
      { t: 'p', text: 'Cada plano num dia tem também o seu horário. No plano e na ordem do dia os planos saem na ordem dos horários, cada um com a hora na frente (“09:00 3.2 Close…”), e uma cena sem horário próprio começa no horário do primeiro plano dela. Como o da cena, o horário do plano vale para aquele dia: levar o plano para outro dia deixa o horário para trás. Pôr um horário arruma o dia sozinho: a cena que começa mais cedo (pelo horário dela ou pelo do primeiro plano) sobe, as cenas sem horário ficam embaixo, e os planos de cada cena aparecem na ordem dos horários. As setas continuam valendo para ajustes à mão.' },
      { t: 'note', text: 'Decupagem e plano acompanham a cena, não o número: se você mover ou renumerar cenas, nada se perde.' }
    ]
  },
  {
    id: 'relatorios',
    title: 'Relatórios',
    group: 'Produção',
    keywords: ['lista', 'cenas', 'locais', 'estatisticas', 'csv', 'planilha', 'decupagem', 'paisagem', 'retrato', 'imprimir'],
    body: [
      { t: 'p', text: 'Em Relatórios há catorze tabelas: Lista de cenas, Escaleta, Lista de planos, Equipamento de luz, Personagens, Locais, Horários e interior/exterior, Elementos do roteiro, Revisões, Resumo por página, Estatísticas, Decupagem por cena, Elementos de produção e Plano de filmagem.' },
      { t: 'p', text: '“Exportar relatório (PDF)” imprime a tabela aberta, com o título do roteiro e a numeração de páginas no rodapé. Escolha Retrato ou Paisagem na caixa ao lado: tabelas largas já começam em paisagem. O papel (A4 ou Carta) é o do roteiro, escolhido em Mais → “Papel do PDF”. O cabeçalho da tabela se repete em cada página.' },
      { t: 'p', text: '“Exportar CSV” grava a tabela aberta num arquivo que abre no Excel ou em qualquer planilha.' }
    ]
  },
  {
    id: 'exportar',
    title: 'Exportar e importar',
    group: 'Arquivos',
    keywords: ['pdf', 'fdx', 'fountain', 'imprimir', 'abrir', 'converter', 'word', 'docx', 'html', 'site', 'navegador'],
    body: [
      { t: 'p', text: 'Mais → “Exportar…” reúne tudo numa janela só. Também há Arquivo → Exportar e o botão “Exportar PDF” (Ctrl+P):' },
      { t: 'ul', items: ['PDF: página de título, roteiro, fichas de personagem, storyboard e mapas de luz, nessa ordem.', 'Somente o storyboard, somente os mapas de luz, somente as fichas: um PDF só com essa parte.', 'FDX: formato de roteiro que vários programas leem e gravam.', 'Fountain: texto simples, abre em qualquer editor e em muitos programas de roteiro.', 'Word (DOCX): o roteiro em Courier, com um estilo do Word para cada elemento (Cabeçalho de cena, Ação, Personagem, Diálogo…), para quem vai continuar no Word. A página de título fica separada, as cenas numeradas saem com o número na margem e o diálogo duplo vira uma tabela de duas colunas. O Word refaz a paginação do jeito dele.', 'Página da web (HTML): as mesmas páginas do PDF num arquivo que abre em qualquer navegador, com a fonte e as imagens dentro dele.'] },
      { t: 'p', text: '“Visualizar”, ao lado de “Exportar PDF” (Ctrl+Shift+P), abre numa janela à parte o mesmo PDF que seria exportado, sem salvar nada. Deixe a janela aberta enquanto escreve e clique de novo em “Visualizar” para atualizar.' },
      { t: 'p', text: 'Arquivo → “Importar FDX ou Fountain…” abre arquivos .fdx, .fountain e .txt. O roteiro importado aparece como rascunho; use Salvar para criar o arquivo .rottera.' },
      { t: 'note', text: 'FDX e Fountain levam texto e formato, mas não levam storyboard, mapas de luz, fichas nem a ligação dos beats. Esses ficam no arquivo .rottera. As notas vão no Fountain como [[nota]], mas não no FDX.' }
    ]
  },
  {
    id: 'marca-dagua',
    title: 'Marca d’água',
    group: 'Arquivos',
    keywords: ['marca dagua', 'watermark', 'confidencial', 'rascunho', 'copia', 'vazamento', 'proteger', 'pdf'],
    body: [
      { t: 'p', text: 'Mais → “Marca d’água…” (ou Arquivo → Marca d’água) põe um texto claro, na diagonal, em todas as páginas do PDF: página de título, roteiro, fichas, storyboard e mapas de luz. A visualização de impressão mostra igual.' },
      { t: 'ul', items: ['Escreva o texto (até 80 letras), por exemplo CONFIDENCIAL, RASCUNHO ou o seu nome.', 'Intensidade: Leve, Média ou Forte.', 'A marca fica salva no arquivo .rottera. Desmarque “Usar marca d’água no PDF” para tirar; o texto continua guardado para a próxima vez.'] },
      { t: 'note', text: 'A marca aparece só no PDF. A tela de escrita e os arquivos FDX e Fountain ficam sem ela.' }
    ]
  },
  {
    id: 'salvar',
    title: 'Salvar, rascunhos e versões anteriores',
    group: 'Arquivos',
    keywords: ['autosave', 'backup', 'onedrive', 'google drive', 'dropbox', 'pen drive', 'nuvem', 'outra pasta', 'restaurar', 'perdi', 'recuperar', 'desfazer', 'cópia'],
    body: [
      { t: 'p', text: 'O roteiro é salvo sozinho cerca de um segundo e meio depois da última alteração. Enquanto o roteiro não tem arquivo, ele fica como rascunho, e a tela inicial oferece “Recuperar rascunho”. Para dar nome e lugar, use Salvar (Ctrl+S) ou Salvar como (Ctrl+Shift+S). Os arquivos têm a extensão .rottera; arquivos .rotera e .clapboard, de quando o programa tinha outro nome, abrem normalmente e continuam com a extensão antiga até você usar Salvar como.' },
      { t: 'p', text: 'Versões anteriores (Mais → “Versões anteriores…” ou Arquivo): o Rottera guarda até 40 cópias de cada roteiro numa pasta própria — a cada 5 minutos de escrita, ao abrir o arquivo e antes de um salvamento que apague boa parte do roteiro. “Restaurar” volta a uma delas, e o texto de agora fica na lista como “Antes de uma restauração”.' },
      { t: 'p', text: 'Se o programa for fechado de forma inesperada, a tela inicial avisa na próxima vez e oferece abrir o último roteiro.' },
      { t: 'p', text: 'Cópia em outra pasta (Mais ou Arquivo → “Cópia em outra pasta…”): escolha uma pasta do OneDrive, Google Drive, Dropbox ou um pen drive e, a cada salvamento, o Rottera grava ali também uma cópia do roteiro, com o mesmo nome. Vale para todos os roteiros deste computador. Se a pasta sumir (pen drive fora), o roteiro continua salvo normalmente e a barra de status avisa “Cópia em outra pasta falhou” até a pasta voltar.' },
      { t: 'note', text: 'As versões anteriores ficam no mesmo computador. A cópia em outra pasta é o que protege o roteiro se o computador tiver problema.' }
    ]
  },
  {
    id: 'claude',
    title: 'Conectar a uma IA',
    group: 'IA',
    keywords: ['ia', 'inteligencia artificial', 'mcp', 'assistente', 'escrever com', 'claude', 'claude code', 'desktop', 'chatgpt', 'openai', 'codex', 'gemini', 'copilot', 'cursor', 'windsurf', 'lm studio', 'modelo local'],
    body: [
      { t: 'p', text: 'Arquivo → “Conectar a uma IA…” mostra o que copiar para o app de IA que você usa: Claude Code, Claude Desktop, Codex (OpenAI), Gemini CLI, Cursor, VS Code com Copilot, Windsurf, LM Studio ou qualquer outro app que aceite servidores MCP locais. Depois disso a IA lê e edita o roteiro aberto: insere cenas, reescreve trechos, move cenas, procura e troca texto, consulta relatórios, preenche o Beat Board e cria as cenas dos beats, planeja o storyboard, monta mapas de luz e trabalha as suas notas.' },
      { t: 'p', text: 'Para a IA ajustar o roteiro pelas notas, peça algo como “leia as notas abertas e faça os ajustes”. Ela lê cada nota com a linha a que está presa, muda o roteiro e marca a nota como resolvida (verde), acrescentando o que fez. Ela não apaga as suas notas; uma pergunta (azul) ganha resposta no próprio post-it. A IA também pode deixar notas novas, para comentar sem mexer no texto.' },
      { t: 'ul', items: ['Cada mudança aparece na hora e pode ser desfeita com Ctrl+Z.', 'A conexão só vale neste computador e usa uma chave que muda a cada abertura.', 'A IA pode pôr no storyboard uma imagem que está no seu computador, mas não recebe as imagens que já estão lá.', 'Mantenha o Rottera aberto enquanto conversa com a IA. Você pode desligar a conexão na mesma janela.', 'O ChatGPT no navegador e no app de desktop só aceita servidores remotos; para usar modelos da OpenAI, escolha o Codex.', 'Com o LM Studio a IA roda no seu computador, sem internet; use um modelo que aceite ferramentas (tool use).'] },
      { t: 'p', text: 'Nenhuma conta nem e-mail é pedido pelo Rottera. Para usar a IA você precisa do seu próprio acesso a ela.' }
    ]
  },
  {
    id: 'teclado',
    title: 'Teclado e leitor de tela',
    group: 'Ajuda',
    keywords: ['acessibilidade', 'foco', 'atalhos', 'narrador', 'nvda', 'esc', 'tab'],
    body: [
      { t: 'p', text: 'Dentro do texto, Tab e Shift+Tab trocam o tipo da linha. Para sair do editor com o teclado, tecle Esc e em seguida Tab (ou Shift+Tab): o foco passa para o próximo controle.' },
      { t: 'ul', items: ['Ctrl+N novo roteiro, Ctrl+O abrir, Ctrl+S salvar, Ctrl+Shift+S salvar como, Ctrl+P exportar PDF, Ctrl+Shift+P visualizar impressão', 'Ctrl+F localizar e substituir', 'Ctrl+Alt+M nova nota na linha do cursor', 'Ctrl+Alt+S sinopse da cena do cursor', 'Ctrl+Shift+L leitura em voz alta', 'Ctrl+Alt+1 Roteiro, 2 Beat Board, 3 Relatórios, 4 Storyboard, 5 Luz, 6 Filmagem, 7 Som', 'Ctrl+\\ mostra ou esconde o navegador', 'Ctrl+D diálogo duplo; Ctrl+1 a Ctrl+7 tipo da linha', 'F1 abre este manual'] },
      { t: 'p', text: 'A barra de status só anuncia o estado de salvamento e a conexão com a IA, para não falar a cada tecla.' }
    ]
  },
  {
    id: 'aparencia',
    title: 'Temas e tamanho',
    group: 'Ajuda',
    keywords: ['escuro', 'dark', 'noite', 'zoom', 'fonte', 'tela cheia'],
    body: [
      { t: 'p', text: 'O seletor “Tema” (ou o menu Exibir) oferece Automático (segue o Windows), Claro, Noite e Meia-noite. Nos temas Noite e Meia-noite a página do roteiro também escurece; o PDF sempre sai em preto sobre branco.' },
      { t: 'p', text: 'Exibir → Aumentar zoom, Diminuir zoom e Zoom padrão mudam o tamanho de tudo. Em janelas estreitas, alguns controles passam para o botão “Mais”.' }
    ]
  },
  {
    id: 'problemas',
    title: 'Se algo der errado',
    group: 'Ajuda',
    keywords: ['erro', 'travou', 'fechou', 'bug', 'suporte', 'ajuda', 'diagnostico', 'nao abre'],
    body: [
      { t: 'ol', items: ['Seu texto: abra Mais → “Versões anteriores…”. Se o programa fechou sozinho, a tela inicial avisa e oferece o último roteiro; rascunhos sem arquivo aparecem como “Recuperar rascunho”.', 'Roteiro muito grande lento: em roteiros de várias centenas de páginas, fechar o navegador de cenas (Ctrl+\\) alivia um pouco mais.', 'Arquivo não abre: o Rottera mostra a mensagem do erro; um .fdx ou .fountain deve ser aberto por “Importar”, não por “Abrir”.'] },
      { t: 'p', text: 'Para pedir ajuda, use Ajuda → “Copiar diagnóstico”. O texto mostra versão, sistema, quantidades e os últimos erros, e você vê tudo antes de copiar. Ele não leva o texto do roteiro, nome de arquivo nem caminhos de pasta.' }
    ]
  }
]

/** Lower case, no accents: so “acao” finds “Ação”. */
export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

function partText(p: ManualPart): string {
  return p.t === 'ul' || p.t === 'ol' ? p.items.join(' ') : p.text
}

export interface ManualHit {
  topic: ManualTopic
  score: number
}

/**
 * Every word must be found somewhere in the topic. Title matches weigh most, then keywords, then the text.
 * An empty query returns all topics in manual order.
 */
export function searchManual(query: string, topics: ManualTopic[] = MANUAL): ManualHit[] {
  const words = fold(query).split(/[^a-z0-9]+/).filter(Boolean)
  if (words.length === 0) return topics.map((topic) => ({ topic, score: 0 }))
  const hits: ManualHit[] = []
  for (const topic of topics) {
    const title = fold(topic.title)
    const keys = fold(topic.keywords.join(' '))
    const body = fold(topic.body.map(partText).join(' '))
    let score = 0
    let all = true
    for (const w of words) {
      const t = title.includes(w) ? 10 : 0
      const k = keys.includes(w) ? 5 : 0
      const b = body.includes(w) ? 1 : 0
      if (t + k + b === 0) {
        all = false
        break
      }
      score += t + k + b
    }
    if (all) hits.push({ topic, score })
  }
  return hits.sort((a, b) => b.score - a.score)
}
