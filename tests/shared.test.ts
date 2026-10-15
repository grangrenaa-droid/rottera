import { describe, expect, it } from 'vitest'
import { cycleKind, enterResult, sceneHeadingTab, tabResult } from '../src/shared/elements'
import { PAGE_LINES, paginate, wrap } from '../src/shared/paginate'
import { collectLists, suggest } from '../src/shared/smarttype'
import { parseFountain, toFountain } from '../src/shared/fountain'
import { parseFdx, toFdx } from '../src/shared/fdx'
import { parseScriptFile, serialize } from '../src/shared/scriptfile'
import type { Block, Script } from '../src/shared/types'

describe('element rules', () => {
  it('Enter moves through the usual sequence', () => {
    expect(enterResult('scene_heading', 'INT. CASA - DIA').next).toBe('action')
    expect(enterResult('character', 'ANA').next).toBe('dialogue')
    expect(enterResult('parenthetical', '(baixo)').next).toBe('dialogue')
    expect(enterResult('dialogue', 'Oi.').next).toBe('action')
    expect(enterResult('transition', 'CORTA PARA:').next).toBe('scene_heading')
  })
  it('an action line that looks like a heading becomes one on Enter', () => {
    expect(enterResult('action', 'EXT. RUA - NOITE')).toEqual({ current: 'scene_heading', next: 'action' })
    expect(enterResult('action', 'Ele entra.').current).toBeUndefined()
  })
  it('Tab cycles an empty block and creates the next one otherwise', () => {
    expect(tabResult('action', '')).toEqual({ type: 'cycle', kind: 'character' })
    expect(tabResult('character', 'ANA')).toEqual({ type: 'new', kind: 'parenthetical' })
    expect(tabResult('dialogue', 'Oi.')).toEqual({ type: 'new', kind: 'character' })
    expect(cycleKind('scene_heading', -1)).toBe('shot')
  })
  it('Tab in a scene heading builds intro, location and time', () => {
    expect(sceneHeadingTab('int')).toBe('INT. ')
    expect(sceneHeadingTab('INT. COZINHA')).toBe('INT. COZINHA - ')
    expect(sceneHeadingTab('INT. COZINHA - DIA')).toBeNull()
  })
})

describe('SmartType', () => {
  const blocks: Block[] = [
    { kind: 'scene_heading', text: 'INT. COZINHA - DIA' },
    { kind: 'character', text: 'Marina' },
    { kind: 'dialogue', text: 'Oi.' },
    { kind: 'scene_heading', text: 'EXT. RUA - NOITE' },
    { kind: 'character', text: 'MARCOS (V.O.)' }
  ]
  const lists = collectLists(blocks)
  it('collects characters without extensions, locations and times', () => {
    expect(lists.characters).toEqual(['MARCOS', 'MARINA'])
    expect(lists.locations).toEqual(['COZINHA', 'RUA'])
    expect(lists.times).toContain('NOITE')
  })
  it('suggests by prefix', () => {
    expect(suggest('character', 'mar', lists)?.items).toEqual(['MARCOS', 'MARINA'])
    expect(suggest('character', 'MARINA', lists)).toBeNull()
    expect(suggest('scene_heading', 'IN', lists)?.items).toEqual(['INT. ', 'INT./EXT. '])
    expect(suggest('scene_heading', 'INT. CO', lists)).toEqual({ from: 5, items: ['COZINHA'] })
    expect(suggest('scene_heading', 'INT. RUA - N', lists)?.items).toContain('NOITE')
    expect(suggest('action', 'qualquer', lists)).toBeNull()
  })
})

describe('pagination', () => {
  const act = (words: number): Block => ({ kind: 'action', text: Array(words).fill('palavra').join(' ') })
  it('wraps by width', () => {
    expect(wrap('aaa bbb ccc', 7)).toEqual(['aaa bbb', 'ccc'])
    expect(wrap('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij'])
  })
  it('never exceeds the page line limit', () => {
    const blocks: Block[] = []
    for (let i = 0; i < 80; i++) {
      blocks.push({ kind: 'scene_heading', text: `INT. LUGAR ${i} - DIA` })
      blocks.push(act(40))
      blocks.push({ kind: 'character', text: 'ANA' })
      blocks.push({ kind: 'dialogue', text: Array(60).fill('fala').join(' ') })
    }
    const { pages, blockPage } = paginate(blocks)
    expect(pages.length).toBeGreaterThan(5)
    for (const p of pages) expect(p.length).toBeLessThanOrEqual(PAGE_LINES)
    expect(blockPage).toHaveLength(blocks.length)
    expect(blockPage.every((n) => n >= 0 && n < pages.length)).toBe(true)
  })
  it('does not leave a scene heading as the last line of a page', () => {
    // 'palavra' is 7 chars: 7 words per 60-wide line, so 7 * 51 words = 51 lines
    const blocks: Block[] = [act(7 * 51), { kind: 'scene_heading', text: 'INT. SALA - DIA' }, act(10)]
    const { pages } = paginate(blocks)
    expect(pages.length).toBe(2)
    expect(pages[0][pages[0].length - 1].kind).not.toBe('scene_heading')
    expect(pages[1].some((l) => l.kind === 'scene_heading')).toBe(true)
  })
  it('splits long dialogue with MORE and CONTD', () => {
    // 40 lines of action, then a long speech (18 lines) that must split
    const blocks: Block[] = [
      act(7 * 40),
      { kind: 'character', text: 'ANA' },
      { kind: 'dialogue', text: Array(120).fill('fala').join(' ') }
    ]
    const { pages } = paginate(blocks)
    expect(pages.length).toBe(2)
    const texts0 = pages[0].map((l) => l.text)
    expect(texts0[texts0.length - 1]).toBe('(MORE)')
    expect(pages[1][0].text).toBe("ANA (CONT'D)")
    for (const p of pages) expect(p.length).toBeLessThanOrEqual(PAGE_LINES)
  })
})

describe('Fountain', () => {
  const src =
    'Title: Chuva\nAuthor: Ana Souza\n\nINT. COZINHA - DIA\n\nMarina mexe o café.\n\nMARINA\n(baixo)\nVocê veio.\n\nCORTA PARA:\n\n.A RUA\n\nEla sai.\n'
  it('parses the main elements', () => {
    const s = parseFountain(src)
    expect(s.titlePage.title).toBe('Chuva')
    expect(s.titlePage.author).toBe('Ana Souza')
    expect(s.blocks.map((b) => b.kind)).toEqual([
      'scene_heading',
      'action',
      'character',
      'parenthetical',
      'dialogue',
      'transition',
      'scene_heading',
      'action'
    ])
    expect(s.blocks[6].text).toBe('A RUA')
  })
  it('round-trips', () => {
    const s = parseFountain(src)
    const again = parseFountain(toFountain(s))
    expect(again.blocks).toEqual(s.blocks)
    expect(again.titlePage.title).toBe('Chuva')
  })
  it('ignores boneyard and notes', () => {
    const s = parseFountain('INT. SALA - DIA\n\n/* escondido */Ação [[nota]] aqui.\n')
    expect(s.blocks[1].text).toBe('Ação  aqui.')
  })
})

describe('FDX', () => {
  const script: Script = {
    titlePage: { title: 'Chuva & Sol', author: 'Ana', contact: '' },
    blocks: [
      { kind: 'scene_heading', text: 'INT. COZINHA - DIA' },
      { kind: 'character', text: 'MARINA' },
      { kind: 'dialogue', text: 'Você <veio>?' }
    ]
  }
  it('round-trips with escaping', () => {
    const back = parseFdx(toFdx(script))
    expect(back.blocks).toEqual(script.blocks)
    expect(back.titlePage.title).toBe('Chuva & Sol')
    expect(back.titlePage.author).toBe('Ana')
  })
  it('rejects DTD / entity declarations, oversized and unrelated input', () => {
    expect(() => parseFdx('<!DOCTYPE x [<!ENTITY a "b">]><FinalDraft/>')).toThrow()
    expect(() => parseFdx('x'.repeat(5 * 1024 * 1024 + 1))).toThrow()
    expect(() => parseFdx('<html></html>')).toThrow()
  })
  it('maps unknown paragraph types to action', () => {
    const s = parseFdx(
      '<FinalDraft><Content><Paragraph Type="General"><Text>oi</Text></Paragraph></Content></FinalDraft>'
    )
    expect(s.blocks).toEqual([{ kind: 'action', text: 'oi' }])
  })
})

describe('script file', () => {
  it('round-trips and rejects foreign JSON', () => {
    const s: Script = { titlePage: { title: 'T', author: '', contact: '' }, blocks: [{ kind: 'action', text: 'a' }] }
    expect(parseScriptFile(serialize(s))).toEqual(s)
    expect(() => parseScriptFile('{"a":1}')).toThrow()
  })
})
