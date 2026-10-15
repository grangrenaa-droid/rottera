import { describe, expect, it } from 'vitest'
import type { Block, Script } from '../src/shared/types'
import { lockScenes, moveScene, moveSceneTo, sceneNumbers, sceneRanges, unlockScenes } from '../src/shared/scenes'
import { findInBlocks, replaceAllInBlocks } from '../src/shared/search'
import { buildReports, reportToCsv } from '../src/shared/reports'
import { PAGE_LINES, paginate } from '../src/shared/paginate'
import { parseFountain, toFountain } from '../src/shared/fountain'
import { TEMPLATES } from '../src/shared/templates'
import { STRUCTURES, STRUCTURE_FAMILIES, boardFromStructure } from '../src/shared/structures'
import { collectLists } from '../src/shared/smarttype'
import { parseScriptFile, serialize } from '../src/shared/scriptfile'

const script = (): Block[] => [
  { kind: 'action', text: 'Antes de tudo.' },
  { kind: 'scene_heading', text: 'INT. COZINHA - DIA' },
  { kind: 'character', text: 'ANA' },
  { kind: 'dialogue', text: 'Bom dia.' },
  { kind: 'scene_heading', text: 'EXT. RUA - NOITE' },
  { kind: 'action', text: 'Chove.' },
  { kind: 'scene_heading', text: 'INT. COZINHA - NOITE' },
  { kind: 'character', text: 'ANA' },
  { kind: 'dialogue', text: 'Boa noite, Ana.' }
]

describe('scene order', () => {
  it('finds ranges and keeps the preamble in place', () => {
    expect(sceneRanges(script())).toEqual([
      { start: 1, end: 4 },
      { start: 4, end: 6 },
      { start: 6, end: 9 }
    ])
    const moved = moveScene(script(), 0, 1)!
    expect(moved[0].text).toBe('Antes de tudo.')
    expect(moved.filter((b) => b.kind === 'scene_heading').map((b) => b.text)).toEqual([
      'EXT. RUA - NOITE',
      'INT. COZINHA - DIA',
      'INT. COZINHA - NOITE'
    ])
    expect(moved).toHaveLength(9)
  })
  it('refuses moves off the ends', () => {
    expect(moveScene(script(), 0, -1)).toBeNull()
    expect(moveSceneTo(script(), 2, 2)).toBeNull()
    expect(moveSceneTo(script(), 2, 0)![1].text).toBe('INT. COZINHA - NOITE')
  })
})

describe('scene numbers', () => {
  it('numbers in order when unlocked', () => {
    expect(sceneNumbers(script(), false).filter(Boolean)).toEqual(['1', '2', '3'])
  })
  it('keeps locked numbers and gives new scenes letters', () => {
    const locked = lockScenes(script())
    const withNew = [...locked.slice(0, 4), { kind: 'scene_heading' as const, text: 'INT. SALA - DIA' }, ...locked.slice(4)]
    const nums = sceneNumbers(withNew, true).filter(Boolean)
    expect(nums).toEqual(['1', '1A', '2', '3'])
    const moved = moveScene(withNew, 0, 1)!
    expect(sceneNumbers(moved, true).filter(Boolean)).toEqual(['A1', '1', '2', '3'])
  })
  it('unlock clears stored numbers', () => {
    expect(unlockScenes(lockScenes(script())).every((b) => b.sn === undefined)).toBe(true)
  })
  it('letters carry past Z', () => {
    const b: Block[] = [{ kind: 'scene_heading', text: 'A', sn: '4Z' }, { kind: 'scene_heading', text: 'B' }]
    expect(sceneNumbers(b, true)).toEqual(['4Z', '4AA'])
  })
})

describe('find and replace', () => {
  it('finds with and without case', () => {
    expect(findInBlocks(script(), 'ana', false)).toHaveLength(3)
    expect(findInBlocks(script(), 'Ana', true)).toHaveLength(1)
    expect(findInBlocks(script(), 'ana', true)).toHaveLength(0)
    expect(findInBlocks(script(), '', false)).toEqual([])
  })
  it('replaces every hit, several per block', () => {
    const r = replaceAllInBlocks([{ kind: 'action', text: 'um um um' }], 'um', 'dois', true)
    expect(r.count).toBe(3)
    expect(r.blocks[0].text).toBe('dois dois dois')
  })
})

describe('reports', () => {
  const s: Script = {
    titlePage: { title: 'T', author: '', contact: '' },
    blocks: [...script(), { kind: 'action', text: 'Alterada.', rev: 'azul' }]
  }
  const reports = buildReports(s)
  it('builds eight reports', () => {
    expect(reports.map((r) => r.id)).toEqual([
      'cenas', 'personagens', 'locais', 'horarios', 'elementos', 'revisoes', 'paginas', 'estatisticas'
    ])
  })
  it('counts scenes, characters and locations', () => {
    expect(reports[0].rows).toHaveLength(3)
    expect(reports[1].rows[0][0]).toBe('ANA')
    expect(reports[1].rows[0][1]).toBe(2)
    expect(reports[2].rows[0]).toEqual(['COZINHA', 2, '1', 'DIA, NOITE'])
  })
  it('reports revisions and exports csv', () => {
    expect(reports[5].rows[0][0]).toBe('Azul')
    const csv = reportToCsv(reports[0])
    expect(csv.split('\r\n')[0]).toBe('Nº;Cabeçalho;INT/EXT;Local;Hora;Página;Palavras')
  })
})

describe('dual dialogue', () => {
  const dual: Block[] = [
    { kind: 'scene_heading', text: 'INT. SALA - DIA' },
    { kind: 'character', text: 'ANA' },
    { kind: 'dialogue', text: 'Eu falo aqui.' },
    { kind: 'character', text: 'LUIZ', dual: true },
    { kind: 'dialogue', text: 'E eu falo ao mesmo tempo, com um pouco mais de texto para ocupar linhas.', dual: true }
  ]
  it('puts the second speech on the same rows', () => {
    const { pages, blockPage } = paginate(dual)
    const lines = pages[0]
    const luiz = lines.find((l) => l.text === 'LUIZ')!
    expect(luiz.sameRow).toBe(true)
    expect(luiz.left).toBeGreaterThan(46)
    expect(blockPage).toEqual([0, 0, 0, 0, 0])
    // rows: heading (1) + blank + the taller column; never more than the page
    expect(lines.filter((l) => !l.sameRow).length).toBeLessThanOrEqual(PAGE_LINES)
  })
  it('uses fewer rows than the same speech stacked', () => {
    const stacked = dual.map((b) => ({ ...b, dual: undefined }))
    const a = paginate(dual).pages[0].filter((l) => !l.sameRow).length
    const b = paginate(stacked).pages[0].filter((l) => !l.sameRow).length
    expect(a).toBeLessThan(b)
  })
  it('round-trips through Fountain with ^', () => {
    const text = toFountain({ titlePage: { title: '', author: '', contact: '' }, blocks: dual })
    expect(text).toContain('LUIZ ^')
    const back = parseFountain(text).blocks
    expect(back.filter((b) => b.dual).map((b) => b.kind)).toEqual(['character', 'dialogue'])
  })
})

describe('templates and structures', () => {
  it('every template makes a valid script', () => {
    for (const t of TEMPLATES) {
      const s = t.make()
      expect(s.blocks.length).toBeGreaterThan(0)
      expect(() => parseScriptFile(serialize(s))).not.toThrow()
    }
  })
  it('structures become boards with unique ids', () => {
    for (const st of STRUCTURES) {
      const b = boardFromStructure(st)
      expect(b.lanes).toHaveLength(st.lanes.length)
      const ids = [...b.lanes.map((l) => l.id), ...b.beats.map((x) => x.id)]
      expect(new Set(ids).size).toBe(ids.length)
      for (const beat of b.beats) expect(b.lanes.some((l) => l.id === beat.lane)).toBe(true)
    }
  })
  it('the picker has the three basics plus the thirty from the structure map, grouped by family', () => {
    expect(STRUCTURES).toHaveLength(33)
    expect(new Set(STRUCTURES.map((s) => s.id)).size).toBe(33)
    expect(STRUCTURES[0].id).toBe('tres-atos')
    for (const s of STRUCTURES) {
      expect(STRUCTURE_FAMILIES).toContain(s.family)
      expect(s.lanes.flatMap((l) => l.beats).length).toBeGreaterThan(0)
    }
    // Families appear in picker order, never interleaved.
    const order = STRUCTURES.map((s) => STRUCTURE_FAMILIES.indexOf(s.family))
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })
  it('map groups become lanes, and a structure without groups is one lane named after it', () => {
    const hero = STRUCTURES.find((s) => s.id === 'jornada-heroi')!
    expect(hero.origin).toContain('Campbell')
    expect(hero.lanes.map((l) => l.name)).toEqual(['Partida', 'Iniciação', 'Retorno'])
    expect(hero.lanes[0].beats[0].title).toBe('Mundo comum')
    expect(hero.lanes[0].beats[0].hint).toMatch(/^Mostra o herói na rotina/)
    const w = STRUCTURES.find((s) => s.id === 'estrutura-w')!
    expect(w.lanes).toHaveLength(1)
    expect(w.lanes[0].name).toBe('Estrutura em W')
    expect(w.lanes[0].beats).toHaveLength(9)
  })
  it('eight sequences keeps its id and now has the full map version', () => {
    const s = STRUCTURES.find((x) => x.id === 'sequencias')!
    expect(s.lanes.map((l) => l.name)).toEqual(['Ato 1', 'Ato 2', 'Ato 3'])
    expect(s.lanes.flatMap((l) => l.beats)).toHaveLength(8)
  })
})

describe('extras and file format', () => {
  it('SmartType includes hand-added entries', () => {
    const l = collectLists(script(), { characters: ['zeca'], locations: ['praça'], times: ['alvorada'] })
    expect(l.characters).toContain('ZECA')
    expect(l.locations).toContain('PRAÇA')
    expect(l.times).toContain('ALVORADA')
  })
  it('keeps board, revision settings, locks and block flags', () => {
    const s: Script = {
      titlePage: { title: 'X', author: '', contact: '' },
      blocks: [
        { kind: 'scene_heading', text: 'INT. A - DIA', sn: '1', rev: 'rosa' },
        { kind: 'character', text: 'ANA', dual: true }
      ],
      board: { lanes: [{ id: 'l1', name: 'Ato I' }], beats: [{ id: 'b1', lane: 'l1', title: 't', body: '', color: 'azul' }] },
      extras: { characters: ['ZECA'], locations: [], times: [] },
      revision: { mode: true, color: 'rosa' },
      scenesLocked: true,
      numberScenes: true
    }
    expect(parseScriptFile(serialize(s))).toEqual(s)
  })
})
