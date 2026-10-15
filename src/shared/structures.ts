import type { Board } from './types'
import { MAP_FAMILIES, MAP_STRUCTURES } from './structureMap'

export interface Structure {
  id: string
  name: string
  /** Group in the structure picker. */
  family: string
  /** Author or source, shown under the picker. */
  origin?: string
  description?: string
  note?: string
  lanes: { name: string; beats: { title: string; hint: string }[] }[]
}

const BASIC = 'Básicas'

/** Picker groups, in order. */
export const STRUCTURE_FAMILIES: string[] = [BASIC, ...MAP_FAMILIES]

/** Common story structures, described in our own words. */
const BASICS: Structure[] = [
  {
    id: 'tres-atos',
    family: BASIC,
    name: 'Três atos (com meio dividido)',
    lanes: [
      {
        name: 'Ato I',
        beats: [
          { title: 'Mundo comum', hint: 'Quem é a protagonista antes de a história começar.' },
          { title: 'Incidente', hint: 'O evento que quebra a rotina.' },
          { title: 'Decisão', hint: 'Ela escolhe entrar no problema.' }
        ]
      },
      {
        name: 'Ato II-A',
        beats: [
          { title: 'Novo território', hint: 'Regras novas, aliados e inimigos.' },
          { title: 'Ponto médio', hint: 'Vitória ou revelação que muda o jogo.' }
        ]
      },
      {
        name: 'Ato II-B',
        beats: [
          { title: 'Pressão', hint: 'O antagonista aperta e os aliados falham.' },
          { title: 'Pior momento', hint: 'Tudo parece perdido.' }
        ]
      },
      {
        name: 'Ato III',
        beats: [
          { title: 'Virada final', hint: 'A ideia ou o sacrifício que destrava tudo.' },
          { title: 'Clímax', hint: 'O confronto decisivo.' },
          { title: 'Imagem final', hint: 'Como o mundo ficou diferente.' }
        ]
      }
    ]
  },
  {
    id: 'circulo',
    family: BASIC,
    name: 'Círculo em oito passos',
    lanes: [
      {
        name: 'Descida',
        beats: [
          { title: 'Zona de conforto', hint: 'Onde o personagem está.' },
          { title: 'Desejo', hint: 'O que ele quer.' },
          { title: 'Situação nova', hint: 'Entra num território desconhecido.' },
          { title: 'Adaptação', hint: 'Aprende e paga o preço.' }
        ]
      },
      {
        name: 'Retorno',
        beats: [
          { title: 'Conquista', hint: 'Consegue o que queria.' },
          { title: 'Custo', hint: 'O que isso cobra.' },
          { title: 'Volta', hint: 'Retorna ao começo.' },
          { title: 'Mudança', hint: 'O que é diferente agora.' }
        ]
      }
    ]
  },
  {
    id: 'serie-quatro-atos',
    family: BASIC,
    name: 'Episódio: teaser e quatro atos',
    lanes: [
      { name: 'Teaser', beats: [{ title: 'Gancho', hint: 'A pergunta que o episódio responde.' }] },
      { name: 'Ato 1', beats: [{ title: 'Problema da semana', hint: 'O que complica a vida da equipe.' }] },
      { name: 'Ato 2', beats: [{ title: 'Primeira tentativa', hint: 'A solução óbvia falha.' }] },
      { name: 'Ato 3', beats: [{ title: 'Complicação', hint: 'Algo muda o plano.' }] },
      { name: 'Ato 4', beats: [{ title: 'Resolução', hint: 'Fecha o episódio e abre o próximo.' }] }
    ]
  }
]

export const STRUCTURES: Structure[] = [...BASICS, ...MAP_STRUCTURES]

let counter = 0
export function newId(prefix: string): string {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export function boardFromStructure(s: Structure, withBeats = true): Board {
  const board: Board = { lanes: [], beats: [] }
  for (const lane of s.lanes) {
    const id = newId('lane')
    board.lanes.push({ id, name: lane.name })
    if (withBeats) {
      for (const b of lane.beats) {
        board.beats.push({ id: newId('beat'), lane: id, title: b.title, body: b.hint, color: '' })
      }
    }
  }
  return board
}
