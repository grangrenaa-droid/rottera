import { describe, expect, it } from 'vitest'
import { cleanNote, groupNotes, noteMarks } from '../src/shared/notes'
import { parseScriptFile, serialize } from '../src/shared/scriptfile'
import { parseFountain, toFountain } from '../src/shared/fountain'
import { moveSceneTo } from '../src/shared/scenes'
import type { Block, Note, Script } from '../src/shared/types'

const blocks: Block[] = [
  { kind: 'action', text: 'Antes de tudo.', nid: 'a0' },
  { kind: 'scene_heading', text: 'INT. COZINHA - DIA', nid: 'h1' },
  { kind: 'action', text: 'Marina coa o café.' },
  { kind: 'character', text: 'MARINA' },
  { kind: 'dialogue', text: 'Você veio.', nid: 'd1' },
  { kind: 'scene_heading', text: 'EXT. RUA - NOITE' },
  { kind: 'action', text: 'Chove.', nid: 'r1' }
]
const note = (id: string, anchor: string, text = id, color: Note['color'] = 'yellow'): Note => ({ id, anchor, text, color })

describe('notes', () => {
  it('are listed in script order, grouped by scene, whatever order they were made in', () => {
    const { groups, loose } = groupNotes(blocks, [note('x', 'r1'), note('y', 'd1'), note('z', 'h1'), note('w', 'a0'), note('v', 'd1')])
    expect(loose).toEqual([])
    expect(groups.map((g) => [g.scene, g.heading, g.items.map((i) => i.note.id)])).toEqual([
      [-1, -1, ['w']],
      [0, 1, ['z', 'y', 'v']],
      [1, 5, ['x']]
    ])
    expect(groups[1].items[1].block).toBe(4)
  })

  it('whose line is gone are loose', () => {
    const { groups, loose } = groupNotes(blocks, [note('x', 'sumiu'), note('y', 'd1')])
    expect(loose.map((n) => n.id)).toEqual(['x'])
    expect(groups).toHaveLength(1)
  })

  it('follow their line when a scene is moved', () => {
    const moved = moveSceneTo(blocks, 1, 0) as Block[]
    const { groups } = groupNotes(moved, [note('y', 'd1'), note('x', 'r1')])
    expect(groups.map((g) => g.items.map((i) => i.note.id))).toEqual([['x'], ['y']])
  })

  it('mark their line with the colour of its first note', () => {
    expect(noteMarks(blocks, [note('a', 'd1', 'a', 'pink'), note('b', 'd1', 'b', 'green'), note('c', 'sumiu')])).toEqual({ d1: 'pink' })
  })

  it('drop anything malformed when read', () => {
    expect(cleanNote({ id: 'n', anchor: 'a', text: 'oi', color: 'roxo' })).toEqual({ id: 'n', anchor: 'a', text: 'oi', color: 'yellow' })
    expect(cleanNote({ id: 'n', text: 'sem linha' })).toBeNull()
    expect(cleanNote('texto')).toBeNull()
    expect(cleanNote({ id: 'n', anchor: 'a', text: 'x'.repeat(9000) })?.text).toHaveLength(4000)
  })

  it('are saved in the file with their lines and come back', () => {
    const s: Script = { titlePage: { title: '', author: '', contact: '' }, blocks, notes: [note('y', 'd1', 'Mais seca', 'blue')] }
    const back = parseScriptFile(serialize(s))
    expect(back.notes).toEqual(s.notes)
    expect(back.blocks[4].nid).toBe('d1')
    expect(back.blocks[2].nid).toBeUndefined()
  })

  it('go into Fountain as [[notes]] on their line, and the script reads back the same', () => {
    const s: Script = {
      titlePage: { title: '', author: '', contact: '' },
      blocks,
      notes: [note('y', 'd1', 'Mais seca,\naqui ]] não'), note('z', 'd1', 'Outra'), note('x', 'sumiu', 'Perdida'), note('e', 'r1', '  ')]
    }
    const text = toFountain(s)
    expect(text).toContain('Você veio. [[Mais seca, aqui ] ] não]] [[Outra]]')
    expect(text.trimEnd().endsWith('[[Perdida]]')).toBe(true)
    expect(text).not.toContain('[[]]')
    const back = parseFountain(text).blocks.map((b) => [b.kind, b.text])
    expect(back).toEqual(blocks.map((b) => [b.kind, b.text]))
  })
})
