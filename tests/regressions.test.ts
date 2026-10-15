import { describe, expect, it } from 'vitest'
import { parseFdx, toFdx } from '../src/shared/fdx'
import { parseFountain, toFountain } from '../src/shared/fountain'
import type { Block, Script } from '../src/shared/types'

const script = (blocks: Block[], title = ''): Script => ({ titlePage: { title, author: '', contact: '' }, blocks })

describe('BUG-003 FDX control characters', () => {
  it('drops characters XML 1.0 cannot carry', () => {
    const xml = toFdx(script([{ kind: 'action', text: 'a\u0000b\u0008c\u001fd\u000be' }], 'T\u0001itulo'))
    expect(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(xml)).toBe(false)
    expect(parseFdx(xml).blocks[0].text).toBe('abcde')
    expect(parseFdx(xml).titlePage.title).toBe('Titulo')
  })
})

describe('BUG-004 Fountain round trip', () => {
  const roundTrip = (blocks: Block[]): Block[] => parseFountain(toFountain(script(blocks))).blocks

  it('keeps action lines that begin with Fountain markup', () => {
    const starts = ['.hoje', '@ana', '!forte', '#nota', '>fim', '=igual', '~canta', 'INT. como ação', 'CORTA PARA:', '(entre parênteses)']
    const back = roundTrip(starts.map((t) => ({ kind: 'action' as const, text: t })))
    expect(back.map((b) => b.text)).toEqual(starts)
    expect(back.every((b) => b.kind === 'action')).toBe(true)
  })
  it('keeps notes and boneyard markers written by the author', () => {
    const t = ['[[lembrar disto]] texto', 'antes /* depois */ fim']
    expect(roundTrip(t.map((x) => ({ kind: 'action' as const, text: x }))).map((b) => b.text)).toEqual(t)
  })
  it('keeps dialogue that begins with markup characters', () => {
    const blocks: Block[] = [
      { kind: 'character', text: 'ANA' },
      { kind: 'dialogue', text: '#1 fã do time' },
      { kind: 'dialogue', text: '= igual' },
      { kind: 'dialogue', text: '.quase' },
      { kind: 'dialogue', text: '>>' }
    ]
    expect(roundTrip(blocks)).toEqual(blocks)
  })
  it('an action that looks like a title page entry is not swallowed', () => {
    const back = roundTrip([{ kind: 'action', text: 'Nota: sem título aqui' }])
    expect(back).toEqual([{ kind: 'action', text: 'Nota: sem título aqui' }])
  })
  it('a multi-line title does not break the title page', () => {
    const s = script([{ kind: 'action', text: 'x' }], 'Primeira linha\nsegunda linha')
    const back = parseFountain(toFountain(s))
    expect(back.titlePage.title).toBe('Primeira linha segunda linha')
    expect(back.blocks).toEqual([{ kind: 'action', text: 'x' }])
  })
})
