#!/usr/bin/env node
/*
 * Rottera MCP server.
 *
 * Lets Claude read and edit the script that is open in the Rottera desktop app.
 * It speaks MCP over stdio and forwards each tool call to the app's local bridge
 * (127.0.0.1, bearer token). It has no dependencies.
 *
 * The app must be running with "Conexão com o Claude" turned on.
 */
'use strict'

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const VERSION = '0.2.0'

function dataDir(name) {
  const home = os.homedir()
  if (process.platform === 'win32') return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), name)
  if (process.platform === 'darwin') return path.join(home, 'Library', 'Application Support', name)
  return path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), name)
}

/**
 * Where the running app wrote its address and key. The settings of a connection made before the rename still
 * point at the old name; among the places that exist, the one written most recently is the app that is running.
 */
function bridgeFile() {
  const candidates = [
    process.env.ROTERA_BRIDGE_FILE,
    path.join(dataDir('Rottera'), 'bridge.json'),
    process.env.CLAPBOARD_BRIDGE_FILE,
    path.join(dataDir('Clapboard'), 'bridge.json')
  ].filter(Boolean)
  let best = null
  let bestTime = -1
  for (const f of candidates) {
    try {
      const t = fs.statSync(f).mtimeMs
      if (t > bestTime) {
        best = f
        bestTime = t
      }
    } catch {
      /* not there */
    }
  }
  return best || candidates[0]
}

async function callApp(method, params) {
  let info
  try {
    info = JSON.parse(fs.readFileSync(bridgeFile(), 'utf8'))
  } catch {
    throw new Error(
      'O Rottera não está aberto, ou a conexão com o Claude está desligada (menu Arquivo > Conectar ao Claude).'
    )
  }
  let res
  try {
    res = await fetch(`http://127.0.0.1:${info.port}/rpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${info.token}` },
      body: JSON.stringify({ method, params })
    })
  } catch {
    throw new Error('Não consegui falar com o Rottera. Abra o app e tente de novo.')
  }
  const body = await res.json()
  if (!body.ok) throw new Error(body.error || 'Erro no Rottera.')
  return body.result
}

/** Under the app's 4 MB request limit once the picture is turned into base64. */
const MAX_IMAGE_BYTES = 2.5 * 1024 * 1024
const IMAGE_TYPES = [
  { type: 'image/png', is: (b) => b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) },
  { type: 'image/jpeg', is: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: 'image/gif', is: (b) => b.subarray(0, 3).toString('latin1') === 'GIF' },
  { type: 'image/webp', is: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' }
]

/** set_frame_image takes a file on this computer; the app receives the picture itself. */
function frameImageArgs(args) {
  const file = typeof args.path === 'string' ? args.path : ''
  let data
  try {
    data = fs.readFileSync(file)
  } catch {
    throw new Error(`Não encontrei o arquivo ${file || '(sem caminho)'}.`)
  }
  if (data.length > MAX_IMAGE_BYTES) throw new Error('A imagem tem mais de 2,5 MB. Use uma menor.')
  const kind = IMAGE_TYPES.find((t) => t.is(data))
  if (!kind) throw new Error('O arquivo não é uma imagem PNG, JPEG, WebP ou GIF.')
  return { index: args.index, image: `data:${kind.type};base64,${data.toString('base64')}` }
}

const KIND = {
  type: 'string',
  enum: ['scene_heading', 'action', 'character', 'parenthetical', 'dialogue', 'transition', 'shot'],
  description:
    'scene_heading: INT./EXT. LOCAL - HORA. action: o que se vê e ouve. character: nome acima da fala. parenthetical: direção curta entre parênteses. dialogue: a fala. transition: CORTA PARA:. shot: plano.'
}
const BLOCK = {
  type: 'object',
  properties: {
    kind: KIND,
    text: { type: 'string' },
    dual: { type: 'boolean', description: 'Verdadeiro nos blocos do segundo falante de um diálogo duplo.' }
  },
  required: ['kind', 'text']
}

const TOOLS = [
  {
    name: 'status',
    description: 'Estado do roteiro aberto: título, número de blocos, páginas, arquivo e modo de revisão.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'get_script',
    description:
      'Lê o roteiro inteiro. Cada bloco vem com seu índice (0-based), que as outras ferramentas usam. format "fountain" devolve texto Fountain.',
    inputSchema: {
      type: 'object',
      properties: { format: { type: 'string', enum: ['blocks', 'fountain'] } }
    }
  },
  {
    name: 'get_outline',
    description: 'Lista as cenas: número, cabeçalho, índice do bloco, página, personagens que falam.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'read_blocks',
    description: 'Lê um trecho do roteiro: `count` blocos a partir de `start`.',
    inputSchema: {
      type: 'object',
      properties: { start: { type: 'integer', minimum: 0 }, count: { type: 'integer', minimum: 1 } },
      required: ['start', 'count']
    }
  },
  {
    name: 'get_selection',
    description: 'Onde está o cursor do roteirista: índice do bloco, tipo e texto selecionado.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'insert_blocks',
    description:
      'Insere blocos depois do bloco `after` (use -1 para o começo; omita para o fim). As mudanças aparecem na hora e podem ser desfeitas com Ctrl+Z.',
    inputSchema: {
      type: 'object',
      properties: { after: { type: 'integer', minimum: -1 }, blocks: { type: 'array', items: BLOCK } },
      required: ['blocks']
    }
  },
  {
    name: 'insert_fountain',
    description:
      'Converte texto em formato Fountain em blocos e insere depois do bloco `after` (-1 começo; omita para o fim). Bom para escrever cenas inteiras.',
    inputSchema: {
      type: 'object',
      properties: { after: { type: 'integer', minimum: -1 }, text: { type: 'string' } },
      required: ['text']
    }
  },
  {
    name: 'replace_blocks',
    description: 'Troca os blocos de `start` até `end` (exclusivo) por novos blocos. Use para reescrever uma cena.',
    inputSchema: {
      type: 'object',
      properties: {
        start: { type: 'integer', minimum: 0 },
        end: { type: 'integer', minimum: 0 },
        blocks: { type: 'array', items: BLOCK }
      },
      required: ['start', 'end', 'blocks']
    }
  },
  {
    name: 'update_block',
    description: 'Muda o texto e/ou o tipo de um bloco.',
    inputSchema: {
      type: 'object',
      properties: { index: { type: 'integer', minimum: 0 }, kind: KIND, text: { type: 'string' } },
      required: ['index']
    }
  },
  {
    name: 'delete_blocks',
    description: 'Apaga os blocos de `start` até `end` (exclusivo).',
    inputSchema: {
      type: 'object',
      properties: { start: { type: 'integer', minimum: 0 }, end: { type: 'integer', minimum: 0 } },
      required: ['start', 'end']
    }
  },
  {
    name: 'move_scene',
    description: 'Move uma cena (número da cena na ordem atual, começando em 1) para outra posição.',
    inputSchema: {
      type: 'object',
      properties: { scene: { type: 'integer', minimum: 1 }, to: { type: 'integer', minimum: 1 } },
      required: ['scene', 'to']
    }
  },
  {
    name: 'find',
    description: 'Procura um texto no roteiro e devolve onde aparece.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string' }, caseSensitive: { type: 'boolean' } },
      required: ['query']
    }
  },
  {
    name: 'replace_all',
    description: 'Troca todas as ocorrências de um texto por outro, em todo o roteiro.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        replacement: { type: 'string' },
        caseSensitive: { type: 'boolean' }
      },
      required: ['query', 'replacement']
    }
  },
  {
    name: 'set_title_page',
    description: 'Define título, autor e contato da página de título.',
    inputSchema: {
      type: 'object',
      properties: { title: { type: 'string' }, author: { type: 'string' }, contact: { type: 'string' } }
    }
  },
  {
    name: 'get_reports',
    description:
      'Relatórios de produção. Sem id, devolve todos. ids: cenas, personagens, locais, horarios, elementos, revisoes, paginas, estatisticas.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } } }
  },
  {
    name: 'get_beats',
    description:
      'Lê o Beat Board: colunas e cartões. Cada cartão traz scene (número da cena ligada a ele no roteiro, ou null) e sceneHeading.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'send_beats',
    description:
      'Cria cenas no roteiro para os beats que ainda não têm cena, na ordem da história (colunas da esquerda para a direita), cada uma logo depois da cena do beat anterior. Beats que já têm cena não são tocados, então chamar de novo não duplica nada. Sem `beats`, vale para todos.',
    inputSchema: { type: 'object', properties: { beats: { type: 'array', items: { type: 'string' }, description: 'ids de beats (de get_beats).' } } }
  },
  {
    name: 'add_beat',
    description: 'Adiciona um cartão ao Beat Board numa coluna (pelo nome; cria a coluna se não existir).',
    inputSchema: {
      type: 'object',
      properties: {
        lane: { type: 'string' },
        title: { type: 'string' },
        body: { type: 'string' },
        color: { type: 'string' }
      },
      required: ['lane', 'title']
    }
  },
  {
    name: 'apply_structure',
    description:
      'Preenche o Beat Board com uma estrutura pronta. ids: tres-atos, circulo, serie-quatro-atos, jornada-heroi, jornada-anti-heroi, save-the-cat, sequencias, sete-pontos, estrutura-w, curva-fichte, tragedia-classica, romancing-the-beat, golpe, investigacao, final-girl, torneio, comedia-escalada, masmorra, loop, cronologia-reversa, linhas-paralelas, rashomon, tempo-real, moldura, kishotenketsu, coral, ampulheta, anelar, picaresca, epistolar, episodio-garrafa, cena-sequela, mice. Só funciona se o quadro estiver vazio, a não ser que replace seja true.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, replace: { type: 'boolean' } },
      required: ['id']
    }
  },
  {
    name: 'get_storyboard',
    description:
      'Lê o storyboard: proporção, quadros por página e a lista de quadros com legenda, cena e se já têm imagem. As imagens em si não são enviadas.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'add_frame',
    description:
      'Planeja um plano no storyboard: cria um quadro sem imagem com legenda (ação, enquadramento, som) e, opcionalmente, o número da cena. O roteirista coloca a imagem depois. O campo after é o índice do quadro anterior (-1 para o começo; omita para o fim).',
    inputSchema: {
      type: 'object',
      properties: {
        caption: { type: 'string' },
        scene: { type: 'string' },
        after: { type: 'integer', minimum: -1 }
      },
      required: ['caption']
    }
  },
  {
    name: 'set_frame',
    description: 'Muda a legenda e/ou a cena de um quadro do storyboard.',
    inputSchema: {
      type: 'object',
      properties: {
        index: { type: 'integer', minimum: 0 },
        caption: { type: 'string' },
        scene: { type: 'string' }
      },
      required: ['index']
    }
  },
  {
    name: 'set_frame_image',
    description:
      'Coloca uma imagem num quadro do storyboard a partir de um arquivo deste computador (caminho completo; PNG, JPEG, WebP ou GIF, até 2,5 MB). Substitui a imagem que estiver no quadro.',
    inputSchema: {
      type: 'object',
      properties: {
        index: { type: 'integer', minimum: 0 },
        path: { type: 'string' }
      },
      required: ['index', 'path']
    }
  },
  {
    name: 'get_lightmaps',
    description:
      'Lê os mapas de luz (diagramas de iluminação vistos de cima): tamanho do set em metros e cada peça com tipo, posição, rotação e legenda. Rotação 0 aponta para o fundo do set (topo do desenho), em sentido horário.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'create_lightmap',
    description: 'Cria um mapa de luz novo (por exemplo um por cena). Devolve o índice do mapa.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        scene: { type: 'string' },
        width: { type: 'number', minimum: 2, maximum: 60 },
        height: { type: 'number', minimum: 2, maximum: 60 },
        notes: { type: 'string' }
      }
    }
  },
  {
    name: 'add_light_item',
    description:
      'Coloca uma peça no mapa de luz. Posição x,y em metros a partir do canto superior esquerdo. Tipos: camera, actor, fresnel, led, hmi, softbox, practical, sun, flag, diffuser, reflector, bounce, cstand, monitor, dolly, table, chair, door, window, wall. Luzes e câmeras aceitam spread (abertura em graus) e range (alcance em metros); modificadores, trilho, porta, janela e parede aceitam length.',
    inputSchema: {
      type: 'object',
      properties: {
        map: { description: 'Índice, id ou nome do mapa. Padrão: o primeiro.' },
        type: { type: 'string' },
        x: { type: 'number' },
        y: { type: 'number' },
        rotation: { type: 'number' },
        label: { type: 'string' },
        spread: { type: 'number' },
        range: { type: 'number' },
        length: { type: 'number' }
      },
      required: ['type']
    }
  },
  {
    name: 'update_light_item',
    description: 'Muda posição, rotação, legenda ou tamanho de uma peça do mapa de luz (item = índice ou id).',
    inputSchema: {
      type: 'object',
      properties: {
        map: { description: 'Índice, id ou nome do mapa. Padrão: o primeiro.' },
        item: { description: 'Índice ou id da peça.' },
        x: { type: 'number' },
        y: { type: 'number' },
        rotation: { type: 'number' },
        label: { type: 'string' },
        spread: { type: 'number' },
        range: { type: 'number' },
        length: { type: 'number' }
      },
      required: ['item']
    }
  },
  {
    name: 'remove_light_item',
    description: 'Remove uma peça do mapa de luz (item = índice ou id).',
    inputSchema: {
      type: 'object',
      properties: {
        map: { description: 'Índice, id ou nome do mapa. Padrão: o primeiro.' },
        item: { description: 'Índice ou id da peça.' }
      },
      required: ['item']
    }
  },
  {
    name: 'get_characters',
    description:
      'Lê as fichas de personagem. Para cada personagem que fala (ou que tem ficha): os campos escritos pelo roteirista e os números do roteiro (falas, palavras, cenas, primeira página, com quem contracena). Passe name para ver só um.',
    inputSchema: { type: 'object', properties: { name: { type: 'string' } } }
  },
  {
    name: 'set_character',
    description:
      'Cria ou atualiza a ficha de um personagem. Só os campos enviados mudam. A apresentação do personagem na aba Relatórios e no PDF se atualiza sozinha. Campos: alias, age, role, appearance, personality, goal, conflict, arc, relationships, notes (texto, até 4000 caracteres).',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        alias: { type: 'string' },
        age: { type: 'string' },
        role: { type: 'string' },
        appearance: { type: 'string' },
        personality: { type: 'string' },
        goal: { type: 'string' },
        conflict: { type: 'string' },
        arc: { type: 'string' },
        relationships: { type: 'string' },
        notes: { type: 'string' },
        includeInPdf: { type: 'boolean' }
      },
      required: ['name']
    }
  },
  {
    name: 'save_script',
    description: 'Salva o roteiro no arquivo atual (se ainda não tem arquivo, mantém como rascunho).',
    inputSchema: { type: 'object', properties: {} }
  }
]

function textResult(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  return { content: [{ type: 'text', text }] }
}

function errorResult(message) {
  return { content: [{ type: 'text', text: message }], isError: true }
}

async function handle(msg) {
  switch (msg.method) {
    case 'initialize':
      return {
        protocolVersion: (msg.params && msg.params.protocolVersion) || '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'rottera', version: VERSION },
        instructions:
          'Rottera é um editor de roteiros. Leia com get_script ou get_outline, edite com insert_blocks, insert_fountain, replace_blocks ou update_block. ' +
          'As edições aparecem na tela do roteirista na hora. Os índices de bloco mudam depois de inserir ou apagar, então releia antes de uma nova edição. ' +
          'Escreva no idioma do roteiro e respeite o formato: cabeçalho de cena em maiúsculas (INT./EXT. LOCAL - HORA), personagem em maiúsculas, fala logo abaixo.'
      }
    case 'ping':
      return {}
    case 'tools/list':
      return { tools: TOOLS }
    case 'tools/call': {
      const name = msg.params && msg.params.name
      const args = (msg.params && msg.params.arguments) || {}
      if (!TOOLS.some((t) => t.name === name)) return errorResult(`Ferramenta desconhecida: ${name}`)
      try {
        return textResult(await callApp(name, name === 'set_frame_image' ? frameImageArgs(args) : args))
      } catch (e) {
        return errorResult(e instanceof Error ? e.message : String(e))
      }
    }
    default:
      return undefined
  }
}

let buffer = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk) => {
  buffer += chunk
  let nl
  while ((nl = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, nl).trim()
    buffer = buffer.slice(nl + 1)
    if (!line) continue
    let msg
    try {
      msg = JSON.parse(line)
    } catch {
      continue
    }
    void dispatch(msg)
  }
})

async function dispatch(msg) {
  const isRequest = msg.id !== undefined && msg.id !== null
  try {
    const result = await handle(msg)
    if (!isRequest) return
    if (result === undefined) {
      send({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: `Method not found: ${msg.method}` } })
    } else {
      send({ jsonrpc: '2.0', id: msg.id, result })
    }
  } catch (e) {
    if (isRequest) {
      send({ jsonrpc: '2.0', id: msg.id, error: { code: -32603, message: e instanceof Error ? e.message : String(e) } })
    }
  }
}

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n')
}

process.stdin.on('end', () => process.exit(0))
