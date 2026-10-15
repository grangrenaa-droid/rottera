import type { Structure } from './structures'

/**
 * The thirty structures from the writer's "Mapa das Estruturas", in the map's order.
 * Generated from the map; each group of points is a lane, and a structure without groups is one lane.
 */
export const MAP_FAMILIES: string[] = ["Arco do protagonista","Estruturas de gênero","Tempo e ponto de vista","Forma e padrão","Ferramentas de cena"]

export const MAP_STRUCTURES: Structure[] = [
  {
    "id": "jornada-heroi",
    "name": "Jornada do Herói",
    "family": "Arco do protagonista",
    "origin": "Joseph Campbell (1949) · Christopher Vogler (12 etapas)",
    "description": "O herói deixa o mundo comum, é transformado num mundo especial e volta trazendo algo para os outros.",
    "lanes": [
      {
        "name": "Partida",
        "beats": [
          {
            "title": "Mundo comum",
            "hint": "Mostra o herói na rotina antes da aventura, com uma falta, ferida ou desejo não resolvido. Serve de base para medir a transformação no fim."
          },
          {
            "title": "Chamado à aventura",
            "hint": "Um problema, ameaça ou oportunidade rompe a normalidade e exige resposta. É a pergunta que a história vai responder."
          },
          {
            "title": "Recusa do chamado",
            "hint": "O herói hesita por medo, dever ou insegurança. A recusa mostra o tamanho do risco e torna humana a decisão que virá."
          },
          {
            "title": "Encontro com o mentor",
            "hint": "Alguém mais experiente oferece conselho, treino, um objeto ou coragem. O mentor prepara o herói, mas não faz a jornada por ele."
          },
          {
            "title": "Travessia do primeiro limiar",
            "hint": "O herói se compromete e entra no mundo especial, de onde não é fácil voltar. Marca o fim do primeiro ato."
          }
        ]
      },
      {
        "name": "Iniciação",
        "beats": [
          {
            "title": "Testes, aliados e inimigos",
            "hint": "O herói aprende as regras do novo mundo, faz amigos e cria rivais. É a fase de adaptação e de descobrir em quem confiar."
          },
          {
            "title": "Aproximação da caverna oculta",
            "hint": "Herói e aliados se preparam para o lugar ou confronto mais perigoso. A tensão sobe, com planos, dúvidas e um último respiro."
          },
          {
            "title": "Provação",
            "hint": "O confronto central com a morte, literal ou simbólica. O herói parece perder tudo e renasce diferente."
          },
          {
            "title": "Recompensa",
            "hint": "Depois de sobreviver, o herói conquista a “espada”: um objeto, um saber ou uma reconciliação. Há celebração, mas o perigo não acabou."
          }
        ]
      },
      {
        "name": "Retorno",
        "beats": [
          {
            "title": "Caminho de volta",
            "hint": "As forças do antagonista reagem e perseguem o herói. Ele decide voltar ao mundo comum, com urgência renovada."
          },
          {
            "title": "Ressurreição",
            "hint": "O teste final e mais alto, em que o herói aplica tudo o que aprendeu. Prova que a transformação é real."
          },
          {
            "title": "Retorno com o elixir",
            "hint": "O herói volta para casa trazendo algo que melhora o mundo comum. Fecha o círculo aberto na primeira cena."
          }
        ]
      }
    ]
  },
  {
    "id": "jornada-anti-heroi",
    "name": "Jornada do Anti-herói",
    "family": "Arco do protagonista",
    "origin": "Variação da Jornada do Herói",
    "description": "O protagonista age por interesse próprio; a transformação é parcial, tardia ou recusada.",
    "note": "Não existe um modelo canônico. Esta é uma síntese de uso comum que inverte a Jornada do Herói.",
    "lanes": [
      {
        "name": "Partida",
        "beats": [
          {
            "title": "Mundo comum corroído",
            "hint": "O protagonista vive à margem ou em ressentimento, guiado pelo próprio interesse. O público precisa entender o que o tornou assim para se importar com ele."
          },
          {
            "title": "Chamado egoísta",
            "hint": "A oportunidade aparece como lucro, vingança ou sobrevivência, não como dever. A motivação é pessoal desde o início."
          },
          {
            "title": "Recusa por cinismo",
            "hint": "Ele rejeita o chamado porque não vê vantagem ou não confia em ninguém. A recusa expõe sua visão de mundo."
          },
          {
            "title": "Mentor ambíguo",
            "hint": "Em vez de um sábio, aparece alguém que oferece um atalho moral ou espelha o pior dele. A orientação vem com um preço."
          },
          {
            "title": "Entrada por conveniência",
            "hint": "Cruza o limiar pelos motivos errados: dinheiro, orgulho, fuga. O público já sente que isso vai custar caro."
          }
        ]
      },
      {
        "name": "Descida",
        "beats": [
          {
            "title": "Alianças frágeis",
            "hint": "Ele usa as pessoas e é usado por elas; as traições vêm dos dois lados. Ninguém é totalmente confiável, nem ele."
          },
          {
            "title": "Escolha cinzenta",
            "hint": "Faz algo condenável que funciona. O público fica dividido entre torcer e julgar, e esse desconforto move a história."
          },
          {
            "title": "Consequência",
            "hint": "Os próprios atos atingem alguém que importa. A conta moral começa a chegar."
          },
          {
            "title": "Fundo do poço moral",
            "hint": "Isolado, encara aquilo em que se tornou. É a versão sombria da noite escura da alma."
          }
        ]
      },
      {
        "name": "Acerto de contas",
        "beats": [
          {
            "title": "Escolha decisiva",
            "hint": "Ou age pelo outro pela primeira vez, ou dobra a aposta em si mesmo. Essa escolha define se o final será redenção ou queda."
          },
          {
            "title": "Vitória com custo",
            "hint": "Vence perdendo algo essencial: reputação, um laço, a própria vida. Nunca é uma vitória limpa."
          },
          {
            "title": "Retorno ambíguo",
            "hint": "A mudança é pequena, tardia ou recusada, e o mundo não fica limpo. O público sai com uma pergunta, não com uma lição."
          }
        ]
      }
    ]
  },
  {
    "id": "save-the-cat",
    "name": "Save the Cat",
    "family": "Arco do protagonista",
    "origin": "Blake Snyder (2005) · 15 beats",
    "description": "Folha de beats com posições aproximadas em páginas, pensada para longas comerciais.",
    "lanes": [
      {
        "name": "Ato 1",
        "beats": [
          {
            "title": "Imagem de abertura",
            "hint": "Uma cena que resume o protagonista e o tom do filme “antes” da mudança. Funciona como foto inicial para comparar com o fim."
          },
          {
            "title": "Tema declarado",
            "hint": "Um personagem secundário diz, quase de passagem, a lição que o protagonista vai aprender. Ele ainda não está pronto para ouvir."
          },
          {
            "title": "Preparação",
            "hint": "Apresenta o mundo, as pessoas e as falhas do protagonista, incluindo o que precisa ser consertado. Planta elementos que voltarão depois."
          },
          {
            "title": "Catalisador",
            "hint": "Um evento externo muda a vida do protagonista: uma notícia, um encontro, uma perda. Sem ele, nada aconteceria."
          },
          {
            "title": "Debate",
            "hint": "O protagonista hesita e pesa os riscos. É a última chance de ficar na zona de conforto."
          },
          {
            "title": "Virada para o Ato 2",
            "hint": "O protagonista escolhe ativamente entrar no novo mundo. A decisão precisa ser dele, não imposta."
          }
        ]
      },
      {
        "name": "Ato 2",
        "beats": [
          {
            "title": "História B",
            "hint": "Entra uma subtrama, quase sempre de amor ou amizade, com personagens novos. É nela que o tema costuma ser discutido."
          },
          {
            "title": "Diversão e brincadeiras",
            "hint": "A promessa da premissa sendo cumprida: as cenas que estariam no trailer. O protagonista explora o novo mundo."
          },
          {
            "title": "Ponto médio",
            "hint": "Uma falsa vitória ou falsa derrota que eleva as apostas. Muitas vezes o relógio começa a correr aqui."
          },
          {
            "title": "Os vilões se aproximam",
            "hint": "A pressão externa aumenta e a equipe do protagonista começa a rachar. Os defeitos que ele não corrigiu cobram seu preço."
          },
          {
            "title": "Tudo está perdido",
            "hint": "O pior momento, geralmente com uma morte literal ou simbólica. Parece impossível vencer."
          },
          {
            "title": "Noite escura da alma",
            "hint": "O protagonista sente a perda e chega ao fundo. É aqui que surge a revelação de que ele precisava."
          }
        ]
      },
      {
        "name": "Ato 3",
        "beats": [
          {
            "title": "Virada para o Ato 3",
            "hint": "A solução aparece, unindo o que ele aprendeu na trama A e na história B. Há um novo plano."
          },
          {
            "title": "Final",
            "hint": "O protagonista executa o plano, vence o antagonista e prova que mudou. Os antigos defeitos já não o dominam."
          },
          {
            "title": "Imagem final",
            "hint": "Espelho da imagem de abertura, mostrando o “depois”. A diferença entre as duas é a prova da transformação."
          }
        ]
      }
    ]
  },
  {
    "id": "sequencias",
    "name": "Oito Sequências",
    "family": "Arco do protagonista",
    "origin": "Frank Daniel · Paul Gulino",
    "description": "O longa dividido em oito blocos de 10–15 minutos, cada um com tensão e resolução próprias.",
    "lanes": [
      {
        "name": "Ato 1",
        "beats": [
          {
            "title": "Seq. 1 · Status quo",
            "hint": "Apresenta o mundo, o protagonista e o que ele quer, terminando no incidente incitante. Responde quem é e onde estamos."
          },
          {
            "title": "Seq. 2 · Predicamento",
            "hint": "O problema principal se define e o protagonista se compromete a resolvê-lo. Fecha com a pergunta dramática do filme."
          }
        ]
      },
      {
        "name": "Ato 2",
        "beats": [
          {
            "title": "Seq. 3 · Primeiras tentativas",
            "hint": "O protagonista tenta a solução mais óbvia e fácil. Ela falha ou funciona só em parte."
          },
          {
            "title": "Seq. 4 · Rumo ao ponto médio",
            "hint": "As tentativas escalam até uma grande virada no meio do filme. Muitas vezes há uma revelação ou vitória aparente."
          },
          {
            "title": "Seq. 5 · Consequências",
            "hint": "O ponto médio traz complicações novas e as subtramas ganham força. O protagonista lida com os efeitos das próprias escolhas."
          },
          {
            "title": "Seq. 6 · Fundo",
            "hint": "Tudo desmorona e o protagonista chega ao ponto mais baixo. Fecha o segundo ato com a situação aparentemente perdida."
          }
        ]
      },
      {
        "name": "Ato 3",
        "beats": [
          {
            "title": "Seq. 7 · Nova tensão",
            "hint": "Uma nova estratégia, uma reviravolta ou uma falsa resolução leva ao confronto. As subtramas convergem."
          },
          {
            "title": "Seq. 8 · Resolução",
            "hint": "O clímax responde à pergunta dramática e mostra o novo equilíbrio. As pontas soltas são amarradas."
          }
        ]
      }
    ]
  },
  {
    "id": "sete-pontos",
    "name": "Estrutura em Sete Pontos",
    "family": "Arco do protagonista",
    "origin": "Dan Wells",
    "description": "Sete marcos que levam o protagonista de um estado ao seu oposto.",
    "note": "Wells sugere planejar de trás para a frente: resolução, depois gancho, depois ponto médio.",
    "lanes": [
      {
        "name": "Estrutura em Sete Pontos",
        "beats": [
          {
            "title": "Gancho",
            "hint": "Mostra o protagonista no estado oposto ao que terá no fim. Se ele termina forte, começa fraco."
          },
          {
            "title": "Virada 1",
            "hint": "Algo introduz o conflito e tira o protagonista do equilíbrio. A história entra em movimento."
          },
          {
            "title": "Pinça 1",
            "hint": "O antagonista aplica pressão e força o protagonista a agir. Deixa claro o tamanho da ameaça."
          },
          {
            "title": "Ponto médio",
            "hint": "O protagonista para de apenas reagir e passa a agir com propósito. É a virada interna da história."
          },
          {
            "title": "Pinça 2",
            "hint": "A pressão chega ao máximo: o plano falha, o mentor some, aliados caem. O protagonista fica sozinho."
          },
          {
            "title": "Virada 2",
            "hint": "Ele descobre ou conquista a última peça que faltava para vencer. Muitas vezes é a lição do tema."
          },
          {
            "title": "Resolução",
            "hint": "O clímax, em que tudo se resolve. O estado final é o oposto do gancho."
          }
        ]
      }
    ]
  },
  {
    "id": "estrutura-w",
    "name": "Estrutura em W",
    "family": "Arco do protagonista",
    "origin": "Arco em dois vales, comum em romance e thriller",
    "description": "A trajetória desce, sobe ao ponto médio, despenca ainda mais e sobe ao clímax, desenhando um W.",
    "lanes": [
      {
        "name": "Estrutura em W",
        "beats": [
          {
            "title": "Situação inicial",
            "hint": "O protagonista em relativo equilíbrio, no topo esquerdo do W. Mostra o que ele tem a perder."
          },
          {
            "title": "Ponto de virada 1",
            "hint": "Um incidente derruba o equilíbrio e puxa a trajetória para baixo. É o começo do conflito."
          },
          {
            "title": "Primeiro fundo",
            "hint": "A primeira crise ou derrota importante. O protagonista sente o peso do problema pela primeira vez."
          },
          {
            "title": "Subida",
            "hint": "Ele reage, aprende e ganha terreno. Aliados e recursos aparecem."
          },
          {
            "title": "Ponto médio",
            "hint": "O pico central: falsa vitória ou nova informação que muda o jogo. Parece que vai dar certo."
          },
          {
            "title": "Ponto de virada 2",
            "hint": "Um revés maior que o primeiro derruba tudo. Costuma nascer das falhas que ele ainda não resolveu."
          },
          {
            "title": "Segundo fundo",
            "hint": "O ponto mais baixo da história, mais fundo que o primeiro. Aqui o protagonista precisa mudar de verdade."
          },
          {
            "title": "Clímax",
            "hint": "A subida final, usando tudo o que aprendeu. O confronto decisivo acontece."
          },
          {
            "title": "Resolução",
            "hint": "O novo equilíbrio, acima do inicial. O topo direito do W mostra o que ele ganhou."
          }
        ]
      }
    ]
  },
  {
    "id": "curva-fichte",
    "name": "Curva de Fichte",
    "family": "Arco do protagonista",
    "origin": "John Gardner, The Art of Fiction (1983)",
    "description": "Começa em crise e sobe por uma série de crises cada vez maiores, com o passado embutido na ação.",
    "lanes": [
      {
        "name": "Curva de Fichte",
        "beats": [
          {
            "title": "Abertura em crise",
            "hint": "A história começa no meio de um problema, sem longas apresentações. O leitor é jogado direto na ação."
          },
          {
            "title": "Crise 2",
            "hint": "Um novo problema surge, mais intenso que o primeiro. Cada pico sobe a aposta."
          },
          {
            "title": "Exposição embutida",
            "hint": "Passado, contexto e motivações aparecem dentro das crises, em pequenas doses. A ação nunca para para explicar."
          },
          {
            "title": "Crises seguintes",
            "hint": "Picos cada vez mais altos, separados por respiros curtos. O ritmo é uma escada de tensão."
          },
          {
            "title": "Clímax",
            "hint": "A crise maior, em que tudo converge. É o ponto mais alto da curva."
          },
          {
            "title": "Queda curta",
            "hint": "A resolução vem rápido depois do clímax. A história termina antes de perder tensão."
          }
        ]
      }
    ]
  },
  {
    "id": "tragedia-classica",
    "name": "Tragédia Clássica",
    "family": "Arco do protagonista",
    "origin": "Aristóteles, Poética",
    "description": "Um herói elevado cai por uma falha própria, e a queda provoca piedade e terror.",
    "lanes": [
      {
        "name": "Tragédia Clássica",
        "beats": [
          {
            "title": "Exposição",
            "hint": "Apresenta o herói em posição elevada, admirado e poderoso. Quanto mais alto ele está, maior será a queda."
          },
          {
            "title": "Hamartia",
            "hint": "A falha de julgamento ou o traço que levará à ruína. Não é maldade; é um erro humano."
          },
          {
            "title": "Hýbris",
            "hint": "O orgulho excessivo leva o herói a desafiar limites humanos ou divinos. Ele acredita estar acima das regras."
          },
          {
            "title": "Nó",
            "hint": "As ações se enredam e as consequências começam a se acumular. A tensão cresce."
          },
          {
            "title": "Peripécia",
            "hint": "A reversão da fortuna: a ação produz o efeito oposto ao esperado. A sorte vira do bem para o mal."
          },
          {
            "title": "Anagnórise",
            "hint": "O reconhecimento: o herói descobre a verdade sobre si ou sobre sua situação. Geralmente tarde demais."
          },
          {
            "title": "Catástrofe",
            "hint": "O desenlace: ruína, morte ou exílio. As consequências se cumprem."
          },
          {
            "title": "Catarse",
            "hint": "O público sente piedade e terror e sai purificado dessas emoções. É o efeito final da tragédia."
          }
        ]
      }
    ]
  },
  {
    "id": "romancing-the-beat",
    "name": "Romancing the Beat",
    "family": "Estruturas de gênero",
    "origin": "Gwen Hayes (2016) · romance",
    "description": "Quatro fases que acompanham o casal da resistência ao compromisso.",
    "lanes": [
      {
        "name": "Fase 1 · Preparação",
        "beats": [
          {
            "title": "Apresentação do par 1",
            "hint": "Mostra quem é o primeiro protagonista, o que falta na vida dele e por que resiste ao amor. A ferida emocional fica clara."
          },
          {
            "title": "Apresentação do par 2",
            "hint": "O mesmo para o segundo protagonista. Os dois precisam ser incompletos de formas que se complementam."
          },
          {
            "title": "O encontro",
            "hint": "Os dois se cruzam e algo acende, mesmo que seja atrito. É o incidente incitante do romance."
          },
          {
            "title": "De jeito nenhum (1)",
            "hint": "Surge a primeira razão para não ficarem juntos: rivalidade, circunstância, preconceito. Cria o conflito do casal."
          },
          {
            "title": "Adesão",
            "hint": "Algo força os dois a continuarem próximos: trabalho, viagem, um acordo. Eles não podem simplesmente se afastar."
          }
        ]
      },
      {
        "name": "Fase 2 · Apaixonar-se",
        "beats": [
          {
            "title": "De jeito nenhum (2)",
            "hint": "A resistência continua, agora mais pessoal. As defesas emocionais aparecem."
          },
          {
            "title": "Indício de desejo",
            "hint": "A primeira faísca é admitida, mesmo que só internamente. O leitor percebe antes deles."
          },
          {
            "title": "Desejo crescente",
            "hint": "A intimidade aumenta e eles começam a se conhecer de verdade. A resistência vai cedendo."
          },
          {
            "title": "Talvez dê certo",
            "hint": "Momentos de felicidade e um vislumbre de futuro juntos. Parece que as feridas podem ser superadas."
          },
          {
            "title": "Ponto médio do amor",
            "hint": "Primeiro beijo, declaração ou noite juntos. É o pico do meio da história, mas ainda frágil."
          }
        ]
      },
      {
        "name": "Fase 3 · Recuar",
        "beats": [
          {
            "title": "Indício de dúvida",
            "hint": "A ferida antiga volta a falar. Um deles começa a sentir medo."
          },
          {
            "title": "Dúvida crescente",
            "hint": "Os medos parecem confirmados por fatos ou mal-entendidos. A desconfiança cresce."
          },
          {
            "title": "Recuo",
            "hint": "Um dos dois se afasta para se proteger. A intimidade começa a se desfazer."
          },
          {
            "title": "Escudos erguidos",
            "hint": "Os dois voltam às defesas do início. Parece que nada mudou."
          },
          {
            "title": "Rompimento",
            "hint": "A separação acontece. Parece o fim do relacionamento."
          }
        ]
      },
      {
        "name": "Fase 4 · Lutar pelo amor",
        "beats": [
          {
            "title": "Noite escura da alma",
            "hint": "Sozinhos, encaram o que perderam e por quê. A dor força a reflexão."
          },
          {
            "title": "Despertar",
            "hint": "Entendem a própria ferida e o que precisam mudar. A transformação interna se completa."
          },
          {
            "title": "Grande gesto",
            "hint": "Um ato público ou arriscado prova a mudança. Mostra ao outro que é para valer."
          },
          {
            "title": "Como é ser inteiro",
            "hint": "Um epílogo do casal completo e feliz. O leitor vê o que eles ganharam."
          }
        ]
      }
    ]
  },
  {
    "id": "golpe",
    "name": "Golpe (Heist)",
    "family": "Estruturas de gênero",
    "origin": "Rififi · Onze Homens e um Segredo",
    "description": "Uma equipe planeja e executa um roubo; o prazer está no plano e no que ele escondia.",
    "lanes": [
      {
        "name": "Golpe (Heist)",
        "beats": [
          {
            "title": "Alvo",
            "hint": "Apresenta o que será roubado e por que parece impossível. Quanto maior a segurança, maior a graça."
          },
          {
            "title": "Motivação",
            "hint": "Explica por que o líder precisa deste golpe: dinheiro, vingança, último trabalho. Dá peso emocional ao plano."
          },
          {
            "title": "Recrutamento",
            "hint": "A equipe é montada, cada um com uma habilidade e uma personalidade. Costuma ser uma sequência de apresentações rápidas."
          },
          {
            "title": "O plano",
            "hint": "O plano é explicado ao público, às vezes só em parte. Cria expectativa e um mapa mental da ação."
          },
          {
            "title": "Preparação",
            "hint": "Ensaios, compra de equipamento, infiltração. Pequenas falhas aqui plantam problemas futuros."
          },
          {
            "title": "Execução",
            "hint": "O golpe começa e tudo parece seguir o roteiro. O público acompanha cada etapa."
          },
          {
            "title": "Complicação",
            "hint": "Algo dá errado: traição, imprevisto, segurança extra. A tensão explode."
          },
          {
            "title": "Improviso",
            "hint": "A equipe se adapta sob pressão. Mostra o talento de cada um."
          },
          {
            "title": "Revelação",
            "hint": "O público descobre que havia um plano verdadeiro escondido. Algumas falhas eram parte dele."
          },
          {
            "title": "Fuga e partilha",
            "hint": "Saída, divisão do dinheiro e consequências. Pode terminar em vitória ou numa traição final."
          }
        ]
      }
    ]
  },
  {
    "id": "investigacao",
    "name": "Investigação",
    "family": "Estruturas de gênero",
    "origin": "Poe · Conan Doyle · Agatha Christie · Chinatown",
    "description": "Um mistério rompe a ordem e o investigador junta pistas até a verdade.",
    "lanes": [
      {
        "name": "Investigação",
        "beats": [
          {
            "title": "Crime",
            "hint": "Um assassinato, desaparecimento ou mistério rompe a ordem. É a pergunta central da história."
          },
          {
            "title": "Chamado",
            "hint": "O investigador assume o caso, por profissão ou envolvimento pessoal. Apresenta o seu método."
          },
          {
            "title": "Primeiras pistas",
            "hint": "Cena do crime, testemunhas e fatos iniciais. O leitor recebe as mesmas pistas que o detetive."
          },
          {
            "title": "Suspeitos",
            "hint": "Os interrogatórios revelam vários suspeitos, cada um escondendo algo. O leitor ganha opções para desconfiar."
          },
          {
            "title": "Pista falsa",
            "hint": "Uma teoria convincente leva ao erro. Mantém o leitor enganado."
          },
          {
            "title": "Escalada",
            "hint": "Um novo crime ou uma ameaça ao investigador aumenta a pressão. O culpado reage."
          },
          {
            "title": "Virada",
            "hint": "Um detalhe esquecido muda toda a leitura do caso. O investigador percebe onde errou."
          },
          {
            "title": "Dedução",
            "hint": "As peças se encaixam. A lógica do crime se revela."
          },
          {
            "title": "Confronto",
            "hint": "O culpado é revelado, com o método e o motivo. Muitas vezes diante dos outros suspeitos."
          },
          {
            "title": "Ordem restaurada",
            "hint": "Vêm as consequências e o preço da verdade. A normalidade volta, às vezes diferente."
          }
        ]
      }
    ]
  },
  {
    "id": "final-girl",
    "name": "Horror (Final Girl)",
    "family": "Estruturas de gênero",
    "origin": "Carol Clover (1992) · Halloween, Pânico",
    "description": "Um grupo é eliminado um a um até restar a garota que observa, resiste e enfrenta o assassino.",
    "lanes": [
      {
        "name": "Horror (Final Girl)",
        "beats": [
          {
            "title": "Grupo isolado",
            "hint": "Um grupo de jovens chega a um lugar afastado ou vive numa cidade comum. O isolamento corta a ajuda externa."
          },
          {
            "title": "Final girl",
            "hint": "Apresenta a protagonista: observadora, cautelosa, diferente dos amigos. O público deve se identificar com ela."
          },
          {
            "title": "Aviso ignorado",
            "hint": "Uma lenda, profecia ou alerta é descartado. Cria ironia dramática."
          },
          {
            "title": "Transgressão",
            "hint": "O grupo quebra uma regra: entra onde não devia, desafia um tabu. Isso libera a ameaça."
          },
          {
            "title": "Primeira morte",
            "hint": "A ameaça se revela, geralmente só para o público. Estabelece o perigo."
          },
          {
            "title": "Escalada",
            "hint": "As mortes acontecem uma a uma e o grupo encolhe. Os outros ainda não perceberam."
          },
          {
            "title": "Descoberta",
            "hint": "A final girl encontra os corpos e entende o que está acontecendo. O terror passa a ser consciente."
          },
          {
            "title": "Perseguição",
            "hint": "Sozinha, ela foge e se esconde do assassino. É o ponto máximo de vulnerabilidade."
          },
          {
            "title": "Confronto",
            "hint": "Ela para de fugir e enfrenta o assassino, muitas vezes com a arma dele. A vítima vira heroína."
          },
          {
            "title": "Sobrevivência",
            "hint": "Ela sobrevive, mas sai marcada. O amanhecer simboliza o fim do pesadelo."
          },
          {
            "title": "Ameaça residual",
            "hint": "Um sinal de que o mal pode voltar. Deixa espaço para continuação."
          }
        ]
      }
    ]
  },
  {
    "id": "torneio",
    "name": "Estrutura de Torneio",
    "family": "Estruturas de gênero",
    "origin": "Rocky · Karatê Kid · 8 Mile",
    "description": "Uma competição com rodadas dá o esqueleto; cada confronto testa a mudança do protagonista.",
    "lanes": [
      {
        "name": "Estrutura de Torneio",
        "beats": [
          {
            "title": "Ferida",
            "hint": "Apresenta um protagonista subestimado, com algo a provar. Uma derrota ou humilhação passada pesa sobre ele."
          },
          {
            "title": "Anúncio do torneio",
            "hint": "Data, prêmio, regras e importância da competição. Cria o relógio da história."
          },
          {
            "title": "Motivação",
            "hint": "Explica por que ele precisa competir: dinheiro, honra, vingança. Liga o torneio à ferida."
          },
          {
            "title": "Rival",
            "hint": "Apresenta o adversário que encarna tudo o que o protagonista não é. O conflito ganha rosto."
          },
          {
            "title": "Mentor e treino",
            "hint": "Ele aprende técnica e algo sobre si. A montagem de treino mostra a evolução."
          },
          {
            "title": "Primeiras rodadas",
            "hint": "Vitórias que mostram progresso. O público começa a acreditar."
          },
          {
            "title": "Revés",
            "hint": "Uma derrota, lesão ou humilhação ameaça tudo. As dúvidas voltam."
          },
          {
            "title": "Recuperação",
            "hint": "Ele volta com nova motivação ou nova técnica. Muitas vezes resolve a ferida interior."
          },
          {
            "title": "Semifinal",
            "hint": "Uma prova difícil mostra que ele mudou. Prepara o confronto final."
          },
          {
            "title": "Final",
            "hint": "O confronto com o rival. Ele usa tudo o que aprendeu."
          },
          {
            "title": "Desfecho",
            "hint": "Vitória, ou uma derrota digna que vale como vitória. O que importa é a transformação."
          }
        ]
      }
    ]
  },
  {
    "id": "comedia-escalada",
    "name": "Comédia de Escalada",
    "family": "Estruturas de gênero",
    "origin": "Farsa · Feydeau · Fawlty Towers · Seinfeld",
    "description": "Um pequeno erro, mal encoberto, vira uma bola de neve até o colapso total.",
    "lanes": [
      {
        "name": "Comédia de Escalada",
        "beats": [
          {
            "title": "Normalidade",
            "hint": "Uma situação simples com algo em jogo: um jantar, uma visita, uma entrevista. Quanto mais importante o evento, maior o risco."
          },
          {
            "title": "Pequeno erro",
            "hint": "Uma mentira ou um deslize, aparentemente sem importância. É a fagulha da comédia."
          },
          {
            "title": "Encobrimento",
            "hint": "O protagonista tenta esconder o erro e piora tudo. A mentira precisa de novas mentiras."
          },
          {
            "title": "Efeito dominó",
            "hint": "Cada solução cria um problema maior. O ritmo acelera."
          },
          {
            "title": "Novos jogadores",
            "hint": "Mais personagens entram e multiplicam os mal-entendidos. Ninguém sabe a verdade inteira."
          },
          {
            "title": "Pressão máxima",
            "hint": "Todos estão no mesmo lugar e tudo pode explodir. É o ápice do caos."
          },
          {
            "title": "Colapso",
            "hint": "A verdade vem à tona de uma vez. Todas as mentiras desmoronam juntas."
          },
          {
            "title": "Novo equilíbrio",
            "hint": "Perdão, castigo ou um absurdo final. A ordem volta, um pouco torta."
          }
        ]
      }
    ]
  },
  {
    "id": "masmorra",
    "name": "Masmorra de Cinco Salas",
    "family": "Estruturas de gênero",
    "origin": "Johnn Four · RPG de mesa",
    "description": "Uma aventura compacta em cinco espaços, cada um com uma função dramática.",
    "lanes": [
      {
        "name": "Masmorra de Cinco Salas",
        "beats": [
          {
            "title": "Sala 1 · Entrada e guardião",
            "hint": "Um obstáculo inicial explica por que ninguém entrou antes. Testa os personagens e apresenta o tom."
          },
          {
            "title": "Sala 2 · Quebra-cabeça",
            "hint": "Um desafio que exige raciocínio, diálogo ou interpretação. Dá espaço a personagens que não brilham no combate."
          },
          {
            "title": "Sala 3 · Truque ou revés",
            "hint": "Uma armadilha, traição ou complicação gasta recursos. Aumenta a tensão antes do clímax."
          },
          {
            "title": "Sala 4 · Clímax",
            "hint": "O grande confronto com o chefe ou o desafio maior. É a cena mais intensa."
          },
          {
            "title": "Sala 5 · Recompensa ou reviravolta",
            "hint": "O tesouro, uma revelação ou um novo gancho. Pode abrir a próxima aventura."
          }
        ]
      }
    ]
  },
  {
    "id": "loop",
    "name": "Loop Temporal",
    "family": "Tempo e ponto de vista",
    "origin": "Feitiço do Tempo · No Limite do Amanhã",
    "description": "O mesmo período se repete até o protagonista mudar por dentro.",
    "lanes": [
      {
        "name": "Loop Temporal",
        "beats": [
          {
            "title": "Dia comum",
            "hint": "Mostra a rotina do protagonista e sua falha de caráter. Esse dia será repetido muitas vezes."
          },
          {
            "title": "Gatilho do loop",
            "hint": "Uma morte ou evento faz o tempo reiniciar. A premissa se revela."
          },
          {
            "title": "Primeiro reinício",
            "hint": "Confusão e descrença. O protagonista acha que está enlouquecendo."
          },
          {
            "title": "Teste das regras",
            "hint": "Ele descobre o que reinicia e o que persiste. O público aprende as regras junto com ele."
          },
          {
            "title": "Exploração",
            "hint": "Usa o loop em benefício próprio, sem consequências. É a parte divertida."
          },
          {
            "title": "Desespero",
            "hint": "A repetição vira prisão e as tentativas de fuga falham. O protagonista chega ao fundo."
          },
          {
            "title": "Chave do loop",
            "hint": "Ele entende o que realmente precisa mudar. Geralmente é algo interno."
          },
          {
            "title": "Transformação",
            "hint": "Muda por dentro, não só a estratégia. Passa a agir pelos outros."
          },
          {
            "title": "Loop perfeito",
            "hint": "Vive o dia fazendo tudo certo, pelos motivos certos. Mostra a pessoa nova."
          },
          {
            "title": "Ruptura",
            "hint": "O tempo volta a correr e chega um novo amanhã. A mudança é a chave da saída."
          }
        ]
      }
    ]
  },
  {
    "id": "cronologia-reversa",
    "name": "Cronologia Reversa",
    "family": "Tempo e ponto de vista",
    "origin": "Traição (Pinter) · Amnésia · Irreversível",
    "description": "A história é contada do fim para o começo; a tensão vem do porquê, não do que acontece.",
    "lanes": [
      {
        "name": "Cronologia Reversa",
        "beats": [
          {
            "title": "Desfecho na abertura",
            "hint": "A história começa pelo fim, mostrando a consequência sem a causa. A curiosidade é pelo porquê."
          },
          {
            "title": "Recuo 1",
            "hint": "A cena anterior explica parte do que vimos. Cada cena responde a uma pergunta e cria outra."
          },
          {
            "title": "Recuos sucessivos",
            "hint": "As cenas continuam voltando no tempo. O público monta o quebra-cabeça."
          },
          {
            "title": "Ironia invertida",
            "hint": "O público sabe o futuro dos personagens; eles não. Momentos felizes ganham tristeza."
          },
          {
            "title": "Revelação de motivos",
            "hint": "Intenções escondidas aparecem tarde. O público reavalia tudo o que viu."
          },
          {
            "title": "Origem",
            "hint": "O momento inaugural aparece por último. É o início e o fim ao mesmo tempo."
          },
          {
            "title": "Ressignificação",
            "hint": "Esse começo muda o sentido de tudo. O final emocional é, na verdade, o início."
          }
        ]
      }
    ]
  },
  {
    "id": "linhas-paralelas",
    "name": "Linhas Temporais Paralelas",
    "family": "Tempo e ponto de vista",
    "origin": "O Poderoso Chefão II · A Viagem · Dunkirk",
    "description": "Duas ou mais linhas em tempos diferentes avançam alternadas e se iluminam.",
    "lanes": [
      {
        "name": "Linhas Temporais Paralelas",
        "beats": [
          {
            "title": "Linha A",
            "hint": "Estabelece o tempo, o lugar e o conflito da primeira linha. O público precisa se situar rápido."
          },
          {
            "title": "Linha B",
            "hint": "Estabelece a segunda linha, com ritmo e tom próprios. Diferenças visuais ajudam a distinguir."
          },
          {
            "title": "Rimas",
            "hint": "Ecos visuais e temáticos conectam as linhas. O público sente a relação antes de entendê-la."
          },
          {
            "title": "Alternância nos picos",
            "hint": "O corte de uma linha para outra acontece em pontos de tensão. Mantém o suspense das duas."
          },
          {
            "title": "Pista da conexão",
            "hint": "Um detalhe sugere como as linhas se relacionam. Pode ser um objeto, um nome ou um lugar."
          },
          {
            "title": "Crises simultâneas",
            "hint": "As linhas chegam ao limite ao mesmo tempo. A montagem intensifica a emoção."
          },
          {
            "title": "Convergência",
            "hint": "As linhas se encontram ou se revelam a mesma história. É a grande revelação."
          },
          {
            "title": "Resolução cruzada",
            "hint": "Cada linha ilumina o sentido da outra. O todo fica maior que as partes."
          }
        ]
      }
    ]
  },
  {
    "id": "rashomon",
    "name": "Estrutura Rashomon",
    "family": "Tempo e ponto de vista",
    "origin": "Akira Kurosawa (1950), a partir de Akutagawa",
    "description": "O mesmo evento contado por várias testemunhas, cada uma com sua versão interessada.",
    "lanes": [
      {
        "name": "Estrutura Rashomon",
        "beats": [
          {
            "title": "Evento central",
            "hint": "Um crime ou incidente que ninguém viu por inteiro. É o objeto de todas as versões."
          },
          {
            "title": "Moldura",
            "hint": "Onde e para quem os relatos são contados: tribunal, roda de conversa, entrevista. Organiza as versões."
          },
          {
            "title": "Versão 1",
            "hint": "A primeira testemunha conta sua versão e a verdade parece clara. O público acredita."
          },
          {
            "title": "Versão 2",
            "hint": "Outra testemunha contradiz pontos-chave. A certeza começa a ruir."
          },
          {
            "title": "Versão 3",
            "hint": "Um novo relato reorganiza culpas e motivos. Cada um se coloca sob boa luz."
          },
          {
            "title": "Versão final",
            "hint": "A testemunha que parecia neutra também tem interesse. Ninguém é confiável."
          },
          {
            "title": "Contradições expostas",
            "hint": "O público percebe que cada um se protege. O tema passa a ser a verdade subjetiva."
          },
          {
            "title": "Desfecho aberto",
            "hint": "Não há uma verdade única; resta o juízo moral. O público decide no que acreditar."
          }
        ]
      }
    ]
  },
  {
    "id": "tempo-real",
    "name": "Tempo Real",
    "family": "Tempo e ponto de vista",
    "origin": "Matar ou Morrer · Festim Diabólico · 24 Horas",
    "description": "O tempo da história coincide com o tempo de tela; o relógio é o antagonista.",
    "lanes": [
      {
        "name": "Tempo Real",
        "beats": [
          {
            "title": "Relógio",
            "hint": "Um prazo explícito: uma bomba, um julgamento, a chegada de um trem. O tempo vira o antagonista."
          },
          {
            "title": "Objetivo imediato",
            "hint": "O que precisa acontecer antes do prazo. É claro e mensurável."
          },
          {
            "title": "Sem elipse",
            "hint": "O tempo de tela é igual ao tempo da história. Não há cortes que pulem horas."
          },
          {
            "title": "Marcadores",
            "hint": "Relógios, ligações e contagens lembram o prazo. Mantêm a pressão visível."
          },
          {
            "title": "Obstáculos em série",
            "hint": "Cada atraso consome tempo real. O público sente cada minuto perdido."
          },
          {
            "title": "Compressão",
            "hint": "As opções diminuem conforme o tempo acaba. A tensão aumenta."
          },
          {
            "title": "Clímax no limite",
            "hint": "A decisão acontece no último minuto. É o máximo de tensão."
          },
          {
            "title": "Desfecho imediato",
            "hint": "A consequência aparece sem salto no tempo. A história fecha no mesmo ritmo em que foi vivida."
          }
        ]
      }
    ]
  },
  {
    "id": "moldura",
    "name": "Narrativa em Moldura",
    "family": "Tempo e ponto de vista",
    "origin": "As Mil e Uma Noites · A Princesa Prometida · Titanic",
    "description": "Uma história de fora emoldura e dá sentido a uma história de dentro.",
    "lanes": [
      {
        "name": "Narrativa em Moldura",
        "beats": [
          {
            "title": "Moldura de abertura",
            "hint": "Apresenta o narrador e a situação presente. Dá o contexto de quem conta."
          },
          {
            "title": "Gatilho do relato",
            "hint": "Um motivo para contar a história: uma pergunta, um objeto, uma situação. Liga as duas camadas."
          },
          {
            "title": "Entrada na história",
            "hint": "A transição para o passado ou para outro mundo. Pode ser uma narração ou um corte visual."
          },
          {
            "title": "História interna",
            "hint": "A história principal, com começo, meio e fim próprios. Ocupa a maior parte da narrativa."
          },
          {
            "title": "Interrupções",
            "hint": "Retornos à moldura que comentam a história ou criam tensão. São opcionais."
          },
          {
            "title": "Fim da história interna",
            "hint": "O relato termina. As perguntas do passado são respondidas."
          },
          {
            "title": "Volta à moldura",
            "hint": "O relato muda quem ouve ou quem conta. A história interna tem efeito no presente."
          },
          {
            "title": "Fechamento",
            "hint": "A moldura se resolve. Muitas vezes com uma revelação final."
          }
        ]
      }
    ]
  },
  {
    "id": "kishotenketsu",
    "name": "Kishōtenketsu",
    "family": "Forma e padrão",
    "origin": "Poesia clássica chinesa e japonesa · yonkoma",
    "description": "Quatro tempos sem conflito central obrigatório; o sentido nasce da justaposição.",
    "lanes": [
      {
        "name": "Kishōtenketsu",
        "beats": [
          {
            "title": "Ki 起 · Introdução",
            "hint": "Apresenta personagens, lugar e situação. Não há conflito obrigatório."
          },
          {
            "title": "Shō 承 · Desenvolvimento",
            "hint": "Aprofunda o que foi apresentado, mostrando mais da situação. A história flui sem grandes choques."
          },
          {
            "title": "Ten 転 · Reviravolta",
            "hint": "Um elemento inesperado, aparentemente desconectado, muda a perspectiva. É o coração da estrutura."
          },
          {
            "title": "Ketsu 結 · Conclusão",
            "hint": "Reconcilia as partes e revela a conexão entre elas. O público entende a relação entre tudo."
          }
        ]
      }
    ]
  },
  {
    "id": "coral",
    "name": "Estrutura Coral",
    "family": "Forma e padrão",
    "origin": "Short Cuts · Magnólia · Crash",
    "description": "Vários protagonistas em tramas próprias, unidas por tema, lugar ou evento.",
    "lanes": [
      {
        "name": "Estrutura Coral",
        "beats": [
          {
            "title": "Mosaico de abertura",
            "hint": "Vários núcleos de personagens aparecem em situações cotidianas. O público conhece cada um rapidamente."
          },
          {
            "title": "Desejos paralelos",
            "hint": "Cada núcleo ganha um objetivo e um conflito próprios. As tramas começam independentes."
          },
          {
            "title": "Tema unificador",
            "hint": "Um assunto comum ecoa em todas as tramas. É o que dá unidade ao conjunto."
          },
          {
            "title": "Cruzamentos",
            "hint": "Personagens de núcleos diferentes se esbarram. Pequenas conexões aparecem."
          },
          {
            "title": "Evento comum",
            "hint": "Algo externo atinge todos ao mesmo tempo: chuva, festa, crise. Une as tramas."
          },
          {
            "title": "Crises individuais",
            "hint": "Cada núcleo chega ao seu ponto de ruptura. Muitas vezes em sequência rápida."
          },
          {
            "title": "Convergência",
            "hint": "As tramas se encontram num clímax compartilhado. O mosaico se fecha."
          },
          {
            "title": "Desfecho em mosaico",
            "hint": "As resoluções são desiguais: uns ganham, outros perdem. O retrato coletivo se completa."
          }
        ]
      }
    ]
  },
  {
    "id": "ampulheta",
    "name": "Ampulheta",
    "family": "Forma e padrão",
    "origin": "E. M. Forster, Aspectos do Romance · Thaïs, Os Embaixadores",
    "description": "Dois personagens em posições opostas se cruzam no centro e trocam de lugar.",
    "lanes": [
      {
        "name": "Ampulheta",
        "beats": [
          {
            "title": "Posições opostas",
            "hint": "Dois personagens começam em lados opostos, um no alto e outro embaixo, em moral, posição social ou fé. O contraste é claro."
          },
          {
            "title": "Atração",
            "hint": "As trajetórias começam a se aproximar. Um busca ou influencia o outro."
          },
          {
            "title": "Influência mútua",
            "hint": "Cada um contamina o outro com suas ideias. Os dois começam a mudar."
          },
          {
            "title": "Cruzamento",
            "hint": "O ponto central em que os dois se igualam por um instante. É o gargalo da ampulheta."
          },
          {
            "title": "Troca",
            "hint": "Seguem em sentidos opostos, cada um indo para o lugar do outro. O movimento parece inevitável."
          },
          {
            "title": "Inversão completa",
            "hint": "Quem estava no alto termina embaixo, e vice-versa. A simetria é a mensagem."
          }
        ]
      }
    ]
  },
  {
    "id": "anelar",
    "name": "Estrutura Anelar",
    "family": "Forma e padrão",
    "origin": "Mary Douglas, Thinking in Circles · Homero",
    "description": "A história avança até um centro e volta espelhando cada parte na ordem inversa (A-B-C-X-C'-B'-A').",
    "lanes": [
      {
        "name": "Estrutura Anelar",
        "beats": [
          {
            "title": "A · Abertura",
            "hint": "Apresenta o tema, o lugar e a imagem inicial. Tudo isso será retomado no fim."
          },
          {
            "title": "B · Ida",
            "hint": "Introduz elementos que serão espelhados na volta. Cada um terá um par."
          },
          {
            "title": "C · Aproximação",
            "hint": "A tensão se concentra e a história caminha para o centro. Prepara a virada."
          },
          {
            "title": "X · Centro",
            "hint": "O eixo de sentido, a virada mais importante. Tudo gira em torno dele."
          },
          {
            "title": "C' · Espelho",
            "hint": "Retoma C sob nova luz. O mesmo elemento ganha outro sentido."
          },
          {
            "title": "B' · Volta",
            "hint": "Retoma B, transformado. A simetria vai se completando."
          },
          {
            "title": "A' · Fechamento",
            "hint": "Volta ao lugar ou à imagem do início, agora com outro sentido. A transformação fica evidente."
          }
        ]
      }
    ]
  },
  {
    "id": "picaresca",
    "name": "Episódica / Picaresca",
    "family": "Forma e padrão",
    "origin": "Lazarillo de Tormes · O Auto da Compadecida",
    "description": "Um protagonista esperto atravessa episódios quase independentes que retratam a sociedade.",
    "lanes": [
      {
        "name": "Episódica / Picaresca",
        "beats": [
          {
            "title": "Origem do pícaro",
            "hint": "Apresenta o protagonista de origem humilde que sobrevive pela esperteza. O ponto de vista é o de baixo."
          },
          {
            "title": "Partida",
            "hint": "Ele sai de casa ou é expulso e começa a vagar. Não há destino definido."
          },
          {
            "title": "Episódio",
            "hint": "Um novo lugar, um novo patrão, um novo golpe. Cada episódio é quase uma história completa."
          },
          {
            "title": "Sátira",
            "hint": "Cada parada expõe um tipo social: o padre, o nobre, o comerciante. A crítica é o centro."
          },
          {
            "title": "Repetição",
            "hint": "Novos episódios se sucedem, quase independentes entre si. A ordem poderia até mudar."
          },
          {
            "title": "Pouca mudança",
            "hint": "O protagonista aprende pouco; o mundo é o verdadeiro assunto. Ele funciona como observador."
          },
          {
            "title": "Fecho irônico",
            "hint": "A situação final é ambígua ou aberta. Às vezes ele termina onde começou."
          }
        ]
      }
    ]
  },
  {
    "id": "epistolar",
    "name": "Epistolar / Documental",
    "family": "Forma e padrão",
    "origin": "Drácula · A Bruxa de Blair · As Ligações Perigosas",
    "description": "A história é montada a partir de documentos: cartas, diários, gravações, entrevistas.",
    "lanes": [
      {
        "name": "Epistolar / Documental",
        "beats": [
          {
            "title": "Dispositivo",
            "hint": "Define o formato: cartas, diários, fitas, mensagens ou entrevistas. O formato faz parte da história."
          },
          {
            "title": "Quem registra",
            "hint": "Por que aquilo está sendo documentado, e por quem. Isso define o quanto o registro é confiável."
          },
          {
            "title": "Normalidade registrada",
            "hint": "Os primeiros documentos mostram o mundo antes do conflito. Estabelecem a voz de quem escreve."
          },
          {
            "title": "Lacunas",
            "hint": "O que acontece entre os registros fica para o público imaginar. As elipses criam tensão."
          },
          {
            "title": "Múltiplas vozes",
            "hint": "Narradores diferentes se completam ou se contradizem. O público monta a verdade."
          },
          {
            "title": "Escalada nos registros",
            "hint": "Os documentos ficam mais urgentes, curtos e fragmentados. A forma reflete o caos."
          },
          {
            "title": "Último registro",
            "hint": "Uma interrupção, um silêncio ou uma confissão. O fim muitas vezes é abrupto."
          },
          {
            "title": "O organizador",
            "hint": "Quem juntou o material e com que intenção. Pode ser a revelação final."
          }
        ]
      }
    ]
  },
  {
    "id": "episodio-garrafa",
    "name": "Episódio Garrafa",
    "family": "Forma e padrão",
    "origin": "Breaking Bad, “Fly” · Doze Homens e uma Sentença",
    "description": "Um cenário, poucos personagens; o confinamento faz o conflito vir à tona.",
    "lanes": [
      {
        "name": "Episódio Garrafa",
        "beats": [
          {
            "title": "Restrição",
            "hint": "Um único cenário, poucos personagens e orçamento enxuto. A limitação é o ponto de partida criativo."
          },
          {
            "title": "Confinamento",
            "hint": "Algo prende todos ali: uma tempestade, uma porta trancada, uma tarefa. Ninguém pode sair."
          },
          {
            "title": "Incômodo",
            "hint": "Um detalhe pequeno começa a irritar: um barulho, uma mosca, um objeto perdido. É a fagulha."
          },
          {
            "title": "Tensão latente",
            "hint": "Conflitos antigos vêm à tona. O detalhe era só a desculpa."
          },
          {
            "title": "Revelações",
            "hint": "As conversas expõem segredos e verdades. É o coração do episódio."
          },
          {
            "title": "Ponto de ruptura",
            "hint": "A pressão explode numa briga ou confissão. Ninguém tem para onde fugir."
          },
          {
            "title": "Saída",
            "hint": "A situação que prendia todos se desfaz. A porta se abre."
          },
          {
            "title": "Mudança",
            "hint": "As relações não voltam ao que eram. O episódio pequeno tem efeito duradouro."
          }
        ]
      }
    ]
  },
  {
    "id": "cena-sequela",
    "name": "Cena e Sequela",
    "family": "Ferramentas de cena",
    "origin": "Dwight V. Swain, Techniques of the Selling Writer (1965)",
    "description": "Unidade de ação seguida de unidade de reação; a decisão final de uma vira o objetivo da próxima cena.",
    "lanes": [
      {
        "name": "Cena · ação",
        "beats": [
          {
            "title": "Objetivo",
            "hint": "O personagem quer algo concreto e alcançável nesta cena. Sem objetivo, não há cena."
          },
          {
            "title": "Conflito",
            "hint": "Algo ou alguém se opõe ao objetivo. A cena é a luta entre os dois."
          },
          {
            "title": "Desastre",
            "hint": "O personagem fracassa, ou vence com um custo que cria novo problema. Isso mantém a história avançando."
          }
        ]
      },
      {
        "name": "Sequela · reação",
        "beats": [
          {
            "title": "Reação",
            "hint": "A resposta emocional ao desastre: raiva, medo, choque. O leitor sente junto."
          },
          {
            "title": "Dilema",
            "hint": "O personagem avalia as opções, todas ruins. Mostra o raciocínio dele."
          },
          {
            "title": "Decisão",
            "hint": "Ele escolhe um caminho. A decisão vira o objetivo da próxima cena."
          }
        ]
      }
    ]
  },
  {
    "id": "mice",
    "name": "Quociente MICE",
    "family": "Ferramentas de cena",
    "origin": "Orson Scott Card · aninhamento por Mary Robinette Kowal",
    "description": "Quatro tipos de fio narrativo; cada um abre e fecha de um jeito, e os fios se aninham.",
    "lanes": [
      {
        "name": "Quociente MICE",
        "beats": [
          {
            "title": "M · Meio (Milieu)",
            "hint": "Um fio de lugar: abre quando o personagem entra num lugar e fecha quando sai. A história é sobre explorar um mundo."
          },
          {
            "title": "I · Investigação (Inquiry)",
            "hint": "Um fio de pergunta: abre com um mistério e fecha com a resposta. A história é sobre descobrir."
          },
          {
            "title": "C · Personagem (Character)",
            "hint": "Um fio de identidade: abre com uma insatisfação e fecha com a mudança ou a aceitação. A história é sobre quem o personagem é."
          },
          {
            "title": "E · Evento (Event)",
            "hint": "Um fio de ordem: abre com algo que desequilibra o mundo e fecha com uma nova ordem. A história é sobre restaurar."
          },
          {
            "title": "Regra do aninhamento",
            "hint": "Os fios fecham na ordem inversa da abertura, como parênteses: M-I-C … C-I-M. Isso dá a sensação de completude."
          }
        ]
      }
    ]
  }
]
