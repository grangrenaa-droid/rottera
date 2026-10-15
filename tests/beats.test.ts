import { describe, expect, it } from 'vitest'
import { beatLinks, sendBeats, storyOrder, unsent } from '../src/shared/beats'
import { parseScriptFile, serialize } from '../src/shared/scriptfile'
import type { Block, Board } from '../src/shared/types'

const board: Board = {
  lanes: [
    { id: 'l1', name: 'Ato 1' },
    { id: 'l2', name: 'Ato 2' }
  ],
  beats: [
    { id: 'b1', lane: 'l1', title: 'Chegada', body: 'Marina volta', color: '' },
    { id: 'b2', lane: 'l2', title: 'Conflito', body: '', color: '' },
    { id: 'b3', lane: 'l1', title: 'Encontro', body: 'com Davi', color: '' }
  ]
}
const h = (text: string, bid?: string): Block => ({ kind: 'scene_heading', text, ...(bid ? { bid } : {}) })
const a = (text: string): Block => ({ kind: 'action', text })

describe('beats become scenes once', () => {
  it('story order is lane order, then board order inside the lane', () => {
    expect(storyOrder(board).map((b) => b.id)).toEqual(['b1', 'b3', 'b2'])
  })

  it('creates a scene for every beat without one, in story order, and links it', () => {
    const r = sendBeats(board, [h('INT. CASA - DIA'), a('Texto.')])
    expect(r.created).toEqual(['b1', 'b3', 'b2'])
    const headings = r.blocks.filter((b) => b.kind === 'scene_heading')
    expect(headings.map((b) => b.bid)).toEqual([undefined, 'b1', 'b3', 'b2'])
    expect(r.blocks[2].text).toBe('INT. LOCAL - DIA')
    expect(r.blocks[3].text).toBe('Chegada: Marina volta')
  })

  it('sending again changes nothing, and the writer text is untouched', () => {
    const first = sendBeats(board, [h('INT. CASA - DIA'), a('Texto.')])
    const edited = first.blocks.map((b) => (b.text === 'Chegada: Marina volta' ? { ...b, text: 'Reescrito pelo autor.' } : b))
    const second = sendBeats(board, edited)
    expect(second.created).toEqual([])
    expect(second.blocks).toEqual(edited)
  })

  it('a new beat goes after the scene of the beat before it, not at the end', () => {
    const script = [h('A', 'b1'), a('a'), h('C', 'b2'), a('c')]
    const r = sendBeats(board, script)
    expect(r.created).toEqual(['b3'])
    expect(r.blocks.map((b) => b.text)).toEqual(['A', 'a', 'INT. LOCAL - DIA', 'Encontro: com Davi', 'C', 'c'])
  })

  it('with no earlier scene it goes before the next one', () => {
    const r = sendBeats(board, [h('C', 'b2'), a('c')])
    expect(r.blocks.map((b) => b.bid)).toEqual(['b1', undefined, 'b3', undefined, 'b2', undefined])
  })

  it('can send one beat only', () => {
    const r = sendBeats(board, [h('X')], ['b2'])
    expect(r.created).toEqual(['b2'])
  })

  it('a fresh script (one empty heading) is replaced, not kept as a stray scene', () => {
    const r = sendBeats(board, [h('')])
    expect(r.blocks[0].bid).toBe('b1')
    expect(r.blocks.filter((b) => b.kind === 'scene_heading')).toHaveLength(3)
  })

  it('deleting the scene frees the beat; a copied heading does not create a second link', () => {
    const copy = [h('A', 'b1'), a('a'), h('A copiado', 'b1')]
    const links = beatLinks(copy, board)
    expect(links.get('b1')?.scene).toBe(1)
    expect(unsent(board, [h('X')]).map((b) => b.id)).toEqual(['b1', 'b3', 'b2'])
    expect(unsent(board, [h('A', 'b1'), h('B', 'b3'), h('C', 'b2')])).toEqual([])
  })

  it('ignores a bid that belongs to no beat on this board', () => {
    expect(beatLinks([h('A', 'zzz')], board).size).toBe(0)
  })
})

describe('the link is saved in the file', () => {
  it('keeps bid on scene headings and drops it elsewhere', () => {
    const s = parseScriptFile(
      serialize({
        titlePage: { title: '', author: '', contact: '' },
        blocks: [h('A', 'b1'), { kind: 'action', text: 'x', bid: 'b1' } as Block],
        board
      })
    )
    expect(s.blocks[0].bid).toBe('b1')
    expect(s.blocks[1].bid).toBeUndefined()
  })
})
