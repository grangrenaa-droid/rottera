import type { Block, Board, Script } from './types'
import { STRUCTURES, boardFromStructure } from './structures'

export interface Template {
  id: string
  name: string
  description: string
  make(): Script
}

const blank = (): Script => ({
  titlePage: { title: '', author: '', contact: '' },
  blocks: [{ kind: 'scene_heading', text: '' }]
})

function withBoard(structureId: string): Board | undefined {
  const s = STRUCTURES.find((x) => x.id === structureId)
  return s ? boardFromStructure(s) : undefined
}

export const TEMPLATES: Template[] = [
  {
    id: 'blank',
    name: 'Em branco',
    description: 'Uma página vazia, pronta para o primeiro cabeçalho de cena.',
    make: blank
  },
  {
    id: 'learn',
    name: 'Aprenda o formato',
    description: 'Um exemplo curto com cada elemento e dicas de teclado. Apague e escreva por cima.',
    make: () => {
      const blocks: Block[] = [
        { kind: 'scene_heading', text: 'INT. CASA DA MARINA - COZINHA - MANHÃ' },
        { kind: 'action', text: 'O cabeçalho de cena diz onde e quando. Aqui a ação descreve só o que a câmera vê e o microfone ouve.' },
        { kind: 'character', text: 'MARINA' },
        { kind: 'parenthetical', text: '(em voz baixa)' },
        { kind: 'dialogue', text: 'Depois do nome do personagem, Enter cria a fala. Tab no nome cria o parentético.' },
        { kind: 'action', text: 'Enter na fala volta para a ação. Tab numa linha vazia troca o tipo de elemento.' },
        { kind: 'transition', text: 'CORTA PARA:' },
        { kind: 'scene_heading', text: 'EXT. RUA - DIA' },
        { kind: 'action', text: 'Digite INT ou EXT e use Tab para completar local e hora. Ctrl+1 a Ctrl+7 escolhem o elemento.' }
      ]
      return { titlePage: { title: 'Meu primeiro roteiro', author: '', contact: '' }, blocks }
    }
  },
  {
    id: 'feature',
    name: 'Longa-metragem',
    description: 'Abertura clássica e quadro de beats em quatro atos.',
    make: () => ({
      titlePage: { title: '', author: '', contact: '' },
      blocks: [
        { kind: 'transition', text: 'FADE IN:' },
        { kind: 'scene_heading', text: 'INT. LOCAL - DIA' },
        { kind: 'action', text: '' }
      ],
      board: withBoard('tres-atos')
    })
  },
  {
    id: 'short',
    name: 'Curta-metragem',
    description: 'Poucas cenas, sem quadro de beats.',
    make: () => ({
      titlePage: { title: '', author: '', contact: '' },
      blocks: [
        { kind: 'scene_heading', text: 'INT. LOCAL - DIA' },
        { kind: 'action', text: '' }
      ]
    })
  },
  {
    id: 'single-cam',
    name: 'Série (uma câmera)',
    description: 'Teaser e quatro atos, com quadro de beats por ato.',
    make: () => ({
      titlePage: { title: '', author: '', contact: '' },
      blocks: [
        { kind: 'action', text: 'TEASER' },
        { kind: 'scene_heading', text: 'INT. LOCAL - DIA' },
        { kind: 'action', text: '' }
      ],
      board: withBoard('serie-quatro-atos')
    })
  },
  {
    id: 'multi-cam',
    name: 'Série (multicâmera)',
    description: 'Cenas curtas num cenário fixo, com fala em primeiro plano.',
    make: () => ({
      titlePage: { title: '', author: '', contact: '' },
      blocks: [
        { kind: 'scene_heading', text: 'INT. SALA DE ESTAR - NOITE' },
        { kind: 'action', text: 'Cenário principal. Personagens entram e saem pela porta da direita.' },
        { kind: 'character', text: '' }
      ]
    })
  },
  {
    id: 'micro',
    name: 'Microdrama (episódios de 1 minuto)',
    description: 'Um gancho por episódio, para séries verticais curtas.',
    make: () => ({
      titlePage: { title: '', author: '', contact: '' },
      blocks: [
        { kind: 'action', text: 'EPISÓDIO 1 - GANCHO: a primeira imagem precisa prender nos três primeiros segundos.' },
        { kind: 'scene_heading', text: 'INT. LOCAL - DIA' },
        { kind: 'action', text: '' }
      ]
    })
  }
]
