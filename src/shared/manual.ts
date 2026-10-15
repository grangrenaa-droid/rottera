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
  group: 'Escrever' | 'Planejar' | 'Produção' | 'Arquivos' | 'Claude' | 'Ajuda'
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
      { t: 'note', text: 'Ctrl+Z desfaz, inclusive o que o Claude escreveu. “Versões anteriores” guarda cópias do roteiro fora do arquivo.' }
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
      { t: 'note', text: 'Em roteiros grandes, deixar a busca aberta com muitos resultados deixa a digitação um pouco mais lenta. Feche a barra quando terminar.' }
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
      { t: 'p', text: '“Limpar marcas de revisão” tira as marcas sem mexer no texto. O relatório “Revisões” lista o que foi marcado em cada cor.' }
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
      { t: 'p', text: 'Quando um diálogo continua na página seguinte, o PDF coloca (MORE) no fim da página e repete o nome do personagem com (CONT’D) no início da próxima. Essas marcas aparecem no PDF, não no editor.' }
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
      { t: 'ul', items: ['Cada quadro tem legenda e cena; a ordem muda com os botões de mover.', 'Escolha a proporção do quadro e quantos quadros por página (2, 4, 6 ou 9).', 'As imagens grandes são reduzidas para no máximo 1600 pixels ao importar.', '“Incluir no PDF do roteiro” coloca o storyboard no fim do PDF; “Exportar só o storyboard” gera um PDF só dele.'] }
    ]
  },
  {
    id: 'mapaluz',
    title: 'Mapa de Luz',
    group: 'Planejar',
    keywords: ['iluminacao', 'luz', 'camera', 'refletor', 'set', 'esquema', 'diagrama', 'difusor'],
    body: [
      { t: 'p', text: 'Um desenho visto de cima do set, com câmeras, atores, luzes, modificadores (bandeiras, difusores, rebatedores), acessórios e peças de cenário. Cada mapa tem nome, tamanho em metros, cena e notas; um roteiro pode ter vários.' },
      { t: 'ul', items: ['Clique numa peça da lista para colocá-la no desenho e arraste para posicionar.', 'Com a peça selecionada: setas movem 0,1 m (com Shift, 0,5 m); R gira 15° (Shift+R, no sentido contrário); Ctrl+D duplica; Delete apaga; Esc solta a seleção.', 'Luzes e câmeras têm abertura (ângulo) e alcance, desenhados no mapa.', 'O mapa é impresso depois do roteiro e do storyboard, ou sozinho em “Exportar só os mapas de luz”.'] }
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
    id: 'relatorios',
    title: 'Relatórios',
    group: 'Produção',
    keywords: ['lista', 'cenas', 'locais', 'estatisticas', 'csv', 'planilha', 'decupagem', 'paisagem', 'retrato', 'imprimir'],
    body: [
      { t: 'p', text: 'Em Relatórios há oito tabelas: Lista de cenas, Personagens, Locais, Horários e interior/exterior, Elementos do roteiro, Revisões, Resumo por página e Estatísticas.' },
      { t: 'p', text: '“Exportar relatório (PDF)” imprime a tabela aberta, com o título do roteiro e a numeração de páginas no rodapé. Escolha Retrato ou Paisagem na caixa ao lado: tabelas largas já começam em paisagem. O papel (A4 ou Carta) é o do roteiro, escolhido em Mais → “Papel do PDF”. O cabeçalho da tabela se repete em cada página.' },
      { t: 'p', text: '“Exportar CSV” grava a tabela aberta num arquivo que abre no Excel ou em qualquer planilha.' }
    ]
  },
  {
    id: 'exportar',
    title: 'Exportar e importar',
    group: 'Arquivos',
    keywords: ['pdf', 'fdx', 'fountain', 'imprimir', 'abrir', 'converter'],
    body: [
      { t: 'p', text: 'Arquivo → Exportar (ou o botão “Exportar PDF”, Ctrl+P):' },
      { t: 'ul', items: ['PDF: página de título, roteiro, fichas de personagem, storyboard e mapas de luz, nessa ordem.', 'Somente o storyboard, somente os mapas de luz, somente as fichas: um PDF só com essa parte.', 'FDX: formato de roteiro que vários programas leem e gravam.', 'Fountain: texto simples, abre em qualquer editor e em muitos programas de roteiro.'] },
      { t: 'p', text: '“Visualizar”, ao lado de “Exportar PDF” (Ctrl+Shift+P), abre numa janela à parte o mesmo PDF que seria exportado, sem salvar nada. Deixe a janela aberta enquanto escreve e clique de novo em “Visualizar” para atualizar.' },
      { t: 'p', text: 'Arquivo → “Importar FDX ou Fountain…” abre arquivos .fdx, .fountain e .txt. O roteiro importado aparece como rascunho; use Salvar para criar o arquivo .rottera.' },
      { t: 'note', text: 'FDX e Fountain levam texto e formato, mas não levam storyboard, mapas de luz, fichas nem a ligação dos beats. Esses ficam no arquivo .rottera.' }
    ]
  },
  {
    id: 'salvar',
    title: 'Salvar, rascunhos e versões anteriores',
    group: 'Arquivos',
    keywords: ['autosave', 'backup', 'restaurar', 'perdi', 'recuperar', 'desfazer', 'cópia'],
    body: [
      { t: 'p', text: 'O roteiro é salvo sozinho cerca de um segundo e meio depois da última alteração. Enquanto o roteiro não tem arquivo, ele fica como rascunho, e a tela inicial oferece “Recuperar rascunho”. Para dar nome e lugar, use Salvar (Ctrl+S) ou Salvar como (Ctrl+Shift+S). Os arquivos têm a extensão .rottera; arquivos .rotera e .clapboard, de quando o programa tinha outro nome, abrem normalmente e continuam com a extensão antiga até você usar Salvar como.' },
      { t: 'p', text: 'Versões anteriores (Mais → “Versões anteriores…” ou Arquivo): o Rottera guarda até 40 cópias de cada roteiro numa pasta própria — a cada 5 minutos de escrita, ao abrir o arquivo e antes de um salvamento que apague boa parte do roteiro. “Restaurar” volta a uma delas, e o texto de agora fica na lista como “Antes de uma restauração”.' },
      { t: 'p', text: 'Se o programa for fechado de forma inesperada, a tela inicial avisa na próxima vez e oferece abrir o último roteiro.' },
      { t: 'note', text: 'As versões ficam no mesmo computador. Para uma cópia de segurança de verdade, guarde o arquivo .rottera em outro lugar também.' }
    ]
  },
  {
    id: 'claude',
    title: 'Conectar ao Claude',
    group: 'Claude',
    keywords: ['ia', 'inteligencia artificial', 'mcp', 'assistente', 'escrever com', 'claude code', 'desktop'],
    body: [
      { t: 'p', text: 'Arquivo → “Conectar ao Claude…” mostra o que copiar para o Claude Code ou o Claude Desktop. Depois disso o Claude lê e edita o roteiro aberto: insere cenas, reescreve trechos, move cenas, procura e troca texto, consulta relatórios, preenche o Beat Board e cria as cenas dos beats, planeja o storyboard e monta mapas de luz.' },
      { t: 'ul', items: ['Cada mudança aparece na hora e pode ser desfeita com Ctrl+Z.', 'A conexão só vale neste computador e usa uma chave que muda a cada abertura.', 'O Claude pode pôr no storyboard uma imagem que está no seu computador, mas não recebe as imagens que já estão lá.', 'Mantenha o Rottera aberto enquanto conversa com o Claude. Você pode desligar a conexão na mesma janela.'] },
      { t: 'p', text: 'Nenhuma conta nem e-mail é pedido pelo Rottera. Para usar o Claude você precisa do seu próprio acesso a ele.' }
    ]
  },
  {
    id: 'teclado',
    title: 'Teclado e leitor de tela',
    group: 'Ajuda',
    keywords: ['acessibilidade', 'foco', 'atalhos', 'narrador', 'nvda', 'esc', 'tab'],
    body: [
      { t: 'p', text: 'Dentro do texto, Tab e Shift+Tab trocam o tipo da linha. Para sair do editor com o teclado, tecle Esc e em seguida Tab (ou Shift+Tab): o foco passa para o próximo controle.' },
      { t: 'ul', items: ['Ctrl+N novo roteiro, Ctrl+O abrir, Ctrl+S salvar, Ctrl+Shift+S salvar como, Ctrl+P exportar PDF, Ctrl+Shift+P visualizar impressão', 'Ctrl+F localizar e substituir', 'Ctrl+Alt+1 Roteiro, 2 Beat Board, 3 Relatórios, 4 Storyboard, 5 Mapa de Luz', 'Ctrl+\\ mostra ou esconde o navegador', 'Ctrl+D diálogo duplo; Ctrl+1 a Ctrl+7 tipo da linha', 'F1 abre este manual'] },
      { t: 'p', text: 'A barra de status só anuncia o estado de salvamento e a conexão com o Claude, para não falar a cada tecla.' }
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
      { t: 'ol', items: ['Seu texto: abra Mais → “Versões anteriores…”. Se o programa fechou sozinho, a tela inicial avisa e oferece o último roteiro; rascunhos sem arquivo aparecem como “Recuperar rascunho”.', 'Roteiro grande demais lento: feche a barra de busca e o navegador de cenas (Ctrl+\\) enquanto escreve; a lentidão aparece a partir de algumas centenas de páginas.', 'Arquivo não abre: o Rottera mostra a mensagem do erro; um .fdx ou .fountain deve ser aberto por “Importar”, não por “Abrir”.'] },
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
