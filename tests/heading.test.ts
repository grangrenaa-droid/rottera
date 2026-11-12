import { describe, expect, it } from 'vitest'
import { parseHeading, suggest } from '../src/shared/smarttype'
import { renameLocation } from '../src/shared/rename'
import type { Block } from '../src/shared/types'

describe('scene heading', () => {
  it('reads intro, location and time', () => {
    expect(parseHeading('INT. CAFETERIA - DIA')).toEqual({ intro: 'INT', location: 'CAFETERIA', time: 'DIA', hasSep: true })
    expect(parseHeading('EXT. RUA')).toEqual({ intro: 'EXT', location: 'RUA', time: '', hasSep: false })
  })

  it('a dash right after the intro is not part of the location', () => {
    expect(parseHeading('INT.- CAFETERIA - DIA')).toEqual({ intro: 'INT', location: 'CAFETERIA', time: 'DIA', hasSep: true })
    expect(parseHeading('EXT. - CALÇADA DA CAFETERIA - NOITE').location).toBe('CALÇADA DA CAFETERIA')
    expect(parseHeading('INT.-QUARTO').location).toBe('QUARTO')
    // a dash inside the location stays
    expect(parseHeading('INT. CASA-GRANDE - DIA').location).toBe('CASA-GRANDE')
  })

  it('the time is the last part: a place inside a place stays in the location', () => {
    expect(parseHeading('INT. CINE ESTRELA - CABINE DE PROJEÇÃO - NOITE')).toEqual({
      intro: 'INT',
      location: 'CINE ESTRELA - CABINE DE PROJEÇÃO',
      time: 'NOITE',
      hasSep: true
    })
  })

  it('suggests the time after the last dash, and the location while there is no time to match', () => {
    const lists = { characters: [], locations: ['CINE ESTRELA', 'CINE ESTRELA - CABINE'], times: ['NOITE', 'DIA'] }
    const t = suggest('scene_heading', 'INT. CINE ESTRELA - CABINE - NO', lists)
    expect(t).toEqual({ from: 'INT. CINE ESTRELA - CABINE - '.length, items: ['NOITE'] })
    const l = suggest('scene_heading', 'INT. CINE ESTRELA - CA', lists)
    expect(l).toEqual({ from: 'INT. '.length, items: ['CINE ESTRELA - CABINE'] })
  })

  it('renaming a place inside a place keeps the time', () => {
    const blocks: Block[] = [{ kind: 'scene_heading', text: 'INT. CINE ESTRELA - CABINE - NOITE' }]
    const r = renameLocation(blocks, 'cine estrela - cabine', 'CINE ESTRELA - SALA')
    expect(r.blocks[0].text).toBe('INT. CINE ESTRELA - SALA - NOITE')
  })

  it('renaming a location keeps the intro as written, without the dash', () => {
    const blocks: Block[] = [
      { kind: 'scene_heading', text: 'INT.- CAFETERIA - DIA' },
      { kind: 'scene_heading', text: 'I/E CAFETERIA - NOITE' },
      { kind: 'scene_heading', text: 'EXT. RUA - DIA' }
    ]
    const r = renameLocation(blocks, 'cafeteria', 'PADARIA')
    expect(r.count).toBe(2)
    expect(r.blocks.map((b) => b.text)).toEqual(['INT. PADARIA - DIA', 'I/E. PADARIA - NOITE', 'EXT. RUA - DIA'])
  })
})
