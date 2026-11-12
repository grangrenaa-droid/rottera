import { describe, expect, it } from 'vitest'
import { buildReading, castVoices, cleanTableRead, speakers, spokenHeading } from '../src/shared/reading'
import { parseScriptFile, serialize } from '../src/shared/scriptfile'
import type { Block } from '../src/shared/types'

const blocks: Block[] = [
  { kind: 'scene_heading', text: 'INT. COZINHA - DIA' },
  { kind: 'action', text: 'Marina coa o café.' },
  { kind: 'character', text: 'MARINA' },
  { kind: 'parenthetical', text: '(baixo)' },
  { kind: 'dialogue', text: 'Você veio.' },
  { kind: 'dialogue', text: 'Eu não esperava.' },
  { kind: 'character', text: 'DAVI (O.S.)' },
  { kind: 'dialogue', text: 'Eu disse que vinha.' },
  { kind: 'transition', text: 'CORTA PARA:' },
  { kind: 'scene_heading', text: 'EXT. RUA - NOITE' },
  { kind: 'action', text: '' }
]

describe('table read', () => {
  it('says headings the way a person would', () => {
    expect(spokenHeading('INT. COZINHA - DIA')).toBe('Interior. Cozinha, dia.')
    expect(spokenHeading('INT./EXT. CARRO EM MOVIMENTO - NOITE')).toBe('Interior e exterior. Carro em movimento, noite.')
    expect(spokenHeading('EXT. RUA')).toBe('Exterior. Rua.')
    expect(spokenHeading('MONTAGEM')).toBe('Montagem.')
  })

  it('gives the narration to the narrator and each line to its character, skipping parentheticals and blanks', () => {
    expect(buildReading(blocks).map((r) => [r.block, r.who, r.text])).toEqual([
      [0, null, 'Interior. Cozinha, dia.'],
      [1, null, 'Marina coa o café.'],
      [4, 'MARINA', 'Você veio.'],
      [5, 'MARINA', 'Eu não esperava.'],
      [7, 'DAVI', 'Eu disse que vinha.'],
      [8, null, 'corta para:'],
      [9, null, 'Exterior. Rua, noite.']
    ])
  })

  it('starts in the middle of a speech with the right speaker, and can say the names', () => {
    expect(buildReading(blocks, 5)[0]).toEqual({ block: 5, who: 'MARINA', text: 'Eu não esperava.' })
    expect(buildReading(blocks, 6, true).slice(0, 2)).toEqual([
      { block: 6, who: null, text: 'Davi.' },
      { block: 7, who: 'DAVI', text: 'Eu disse que vinha.' }
    ])
  })

  it('casts every speaker, sharing two voices at different pitches, never like the narrator', () => {
    expect(speakers(blocks)).toEqual(['MARINA', 'DAVI'])
    const names = ['A', 'B', 'C', 'D', 'E', 'F']
    const t = castVoices(names, ['Daniel', 'Maria'], undefined)
    expect(t.narrator).toEqual({ voice: 'Daniel', pitch: 1 })
    const combos = names.map((n) => `${t.cast[n].voice}@${t.cast[n].pitch}`)
    expect(new Set(combos.slice(0, 5)).size).toBe(5)
    expect(combos.slice(0, 5)).not.toContain('Daniel@1')
    // choices already made are kept; a voice that is no longer installed is replaced
    const again = castVoices(['A', 'B'], ['Daniel', 'Maria'], { narrator: { voice: 'Maria', pitch: 1 }, cast: { A: { voice: 'Maria', pitch: 0.8 }, B: { voice: 'Zé', pitch: 1 } } })
    expect(again.cast.A).toEqual({ voice: 'Maria', pitch: 0.8 })
    expect(['Daniel', 'Maria']).toContain(again.cast.B.voice)
    expect(again.narrator).toEqual({ voice: 'Maria', pitch: 1 })
  })

  it('keeps the voices in the file and drops anything malformed', () => {
    const tableRead = { narrator: { voice: 'Maria', pitch: 1 }, cast: { MARINA: { voice: 'Daniel', pitch: 1.2 } }, rate: 1.2, names: true }
    const back = parseScriptFile(serialize({ titlePage: { title: '', author: '', contact: '' }, blocks, tableRead }))
    expect(back.tableRead).toEqual(tableRead)
    expect(cleanTableRead({ cast: { X: { voice: 5 }, Y: { voice: 'Maria', pitch: 9 } }, rate: 7 })).toEqual({ cast: { Y: { voice: 'Maria', pitch: 1 } } })
    expect(cleanTableRead('lixo')).toBeUndefined()
  })
})
