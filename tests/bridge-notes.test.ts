import { describe, expect, it } from 'vitest'
import { createBridgeHandler } from '../src/renderer/bridgeHandler'
import type { Block, Note, Script } from '../src/shared/types'
import type { EditorHandle } from '../src/renderer/Editor'

/** A bridge over plain blocks, with anchors given the way the editor gives them. */
function fake(initial: Block[], initialNotes: Note[] = []) {
  let blocks = initial.slice()
  let notes = initialNotes.slice()
  let n = 0
  const handle = {
    getBlocks: () => blocks,
    anchorBlocks: (ids: number[]) =>
      ids.map((i) => {
        if (!blocks[i]) return null
        if (!blocks[i].nid) blocks = blocks.map((b, k) => (k === i ? { ...b, nid: `n${++n}` } : b))
        return blocks[i].nid as string
      })
  } as unknown as EditorHandle
  const script: Script = { titlePage: { title: '', author: '', contact: '' }, blocks }
  const handler = createBridgeHandler({
    handle: () => handle,
    script: () => ({ ...script, blocks, notes }),
    path: () => null,
    setTitlePage: () => undefined,
    setBoard: () => undefined,
    setStoryboard: () => undefined,
    setLightMaps: () => undefined,
    setSound: () => undefined,
    setCharacters: () => undefined,
    setNotes: (next) => {
      notes = next
    },
    save: async () => undefined,
    touched: () => undefined
  })
  return { call: (m: string, p: unknown = {}) => handler(m, p) as Promise<any>, notes: () => notes, blocks: () => blocks }
}

const script: Block[] = [
  { kind: 'scene_heading', text: 'INT. COZINHA - DIA' },
  { kind: 'character', text: 'MARINA' },
  { kind: 'dialogue', text: 'Você veio. Eu não esperava mais.', nid: 'd1' },
  { kind: 'scene_heading', text: 'EXT. RUA - NOITE' },
  { kind: 'action', text: 'Chove.', nid: 'r1' }
]

describe('the AI reads the writer’s notes and works through them', () => {
  it('lists each note with its line, scene and meaning, in script order; loose ones last', async () => {
    const f = fake(script, [
      { id: 'b', anchor: 'r1', text: 'Som de chuva antes do corte', color: 'yellow' },
      { id: 'a', anchor: 'd1', text: 'Mais seca. Tirar a segunda frase.', color: 'pink' },
      { id: 'c', anchor: 'sumiu', text: 'Velha', color: 'blue' },
      { id: 'd', anchor: 'r1', text: 'Feito', color: 'green' }
    ])
    const all = await f.call('get_notes')
    expect(all.map((x: any) => [x.id, x.block, x.scene, x.meaning, x.loose])).toEqual([
      ['a', 2, '1', 'Reescrever', false],
      ['b', 4, '2', 'Nota', false],
      ['d', 4, '2', 'Resolvido', false],
      ['c', null, null, 'Pergunta', true]
    ])
    expect(all[0].line).toEqual({ kind: 'dialogue', text: 'Você veio. Eu não esperava mais.' })
    // open_only leaves out what is already resolved
    expect((await f.call('get_notes', { open_only: true })).map((x: any) => x.id)).toEqual(['a', 'b', 'c'])
  })

  it('marks a note resolved with a reply, and can pin a new note to a line', async () => {
    const f = fake(script, [{ id: 'a', anchor: 'd1', text: 'Mais seca.', color: 'pink' }])
    await f.call('update_note', { id: 'a', color: 'green', text: 'Mais seca.\n— IA: tirei a segunda frase.' })
    expect(f.notes()[0]).toEqual({ id: 'a', anchor: 'd1', color: 'green', text: 'Mais seca.\n— IA: tirei a segunda frase.' })
    const r = await f.call('add_note', { block: 0, text: 'Cena longa: cortar pela metade?', color: 'blue' })
    expect(f.blocks()[0].nid).toBe(f.notes()[1].anchor)
    expect(r).toEqual({ id: f.notes()[1].id, block: 0, color: 'blue' })
    await f.call('delete_note', { id: r.id })
    expect(f.notes()).toHaveLength(1)
  })

  it('refuses what it cannot do', async () => {
    const f = fake(script, [{ id: 'a', anchor: 'd1', text: 'x', color: 'yellow' }])
    await expect(f.call('add_note', { block: 99, text: 'x' })).rejects.toThrow(/fora do intervalo/)
    await expect(f.call('add_note', { block: 1, text: 'x', color: 'roxo' })).rejects.toThrow(/color deve ser/)
    await expect(f.call('update_note', { id: 'nao-existe', color: 'green' })).rejects.toThrow(/não encontrada/)
    await expect(f.call('update_note', { id: 'a', text: 'x'.repeat(5000) })).rejects.toThrow(/longa demais/)
    expect(f.notes()[0].text).toBe('x')
  })
})
