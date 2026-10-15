import { describe, expect, it } from 'vitest'
import { FIELDS, characterKey, characterStats, cleanSheet, listCharacters, newSheet, presentationOf, sheetIsEmpty } from '../src/shared/characters'
import { parseScriptFile, serialize } from '../src/shared/scriptfile'
import { buildPdfHtml } from '../src/main/pdf'
import type { Block, CharacterSheet, Script } from '../src/shared/types'

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

const blocks: Block[] = [
  { kind: 'scene_heading', text: 'INT. COZINHA - DIA' },
  { kind: 'character', text: 'Marina' },
  { kind: 'dialogue', text: 'Você veio. Eu não esperava mais.' },
  { kind: 'character', text: 'DAVI' },
  { kind: 'dialogue', text: 'Eu disse que vinha.' },
  { kind: 'scene_heading', text: 'EXT. RUA - NOITE' },
  { kind: 'character', text: 'MARINA (V.O.)' },
  { kind: 'dialogue', text: 'Ele chegou tarde.' },
  { kind: 'scene_heading', text: 'INT. SALA - DIA' },
  { kind: 'character', text: 'DAVI' },
  { kind: 'dialogue', text: 'Cheguei.' },
  { kind: 'character', text: 'BIA' },
  { kind: 'dialogue', text: 'Finalmente.' }
]
const script = (extra: Partial<Script> = {}): Script => ({
  titlePage: { title: 'Chuva', author: 'Ana', contact: '' },
  blocks,
  ...extra
})

describe('character names', () => {
  it('ignores case, spaces and extensions', () => {
    expect(characterKey('marina')).toBe('MARINA')
    expect(characterKey(' Marina (V.O.) ')).toBe('MARINA')
    expect(characterKey('MARINA (CONT\'D)')).toBe('MARINA')
  })
})

describe('numbers taken from the script', () => {
  const stats = characterStats(script())
  it('counts lines, words, scenes and first page', () => {
    const m = stats.get('MARINA')!
    expect(m.lines).toBe(2)
    expect(m.words).toBe(6 + 3)
    expect(m.scenes).toBe(2)
    expect(m.firstPage).toBe(1)
    const d = stats.get('DAVI')!
    expect(d.lines).toBe(2)
    expect(d.scenes).toBe(2)
  })
  it('lists who shares scenes, most first', () => {
    const d = stats.get('DAVI')!
    // one shared scene each: ties are ordered by name
    expect(d.costars.map((c) => c.name)).toEqual(['BIA', 'Marina'])
    expect(d.costars.every((c) => c.scenes === 1)).toBe(true)
    const m = stats.get('MARINA')!
    expect(m.costars.map((c) => c.name)).toEqual(['DAVI'])
  })
  it('shares add up to about 100', () => {
    const total = [...stats.values()].reduce((n, s) => n + s.share, 0)
    expect(total).toBeGreaterThanOrEqual(98)
    expect(total).toBeLessThanOrEqual(102)
  })
})

describe('character list', () => {
  it('has everyone who speaks, busiest first, even without a sheet', () => {
    const list = listCharacters(script())
    expect(list.map((e) => e.key)).toEqual(['MARINA', 'DAVI', 'BIA'])
    expect(list.every((e) => e.sheet === null && e.inScript)).toBe(true)
  })
  it('attaches a sheet by name, whatever the case', () => {
    const sheet: CharacterSheet = { ...newSheet('marina'), goal: 'Recomeçar' }
    const list = listCharacters(script({ characters: [sheet] }))
    expect(list[0].sheet?.goal).toBe('Recomeçar')
    expect(list[0].name).toBe('marina')
  })
  it('keeps a sheet for someone who does not speak yet', () => {
    const list = listCharacters(script({ characters: [newSheet('Zeca')] }))
    const z = list.find((e) => e.key === 'ZECA')!
    expect(z.inScript).toBe(false)
    expect(z.stats).toBeNull()
  })
})

describe('the presentation follows the sheet', () => {
  const stats = characterStats(script())
  it('is empty until something is written', () => {
    const p = presentationOf(null, 'Marina', stats.get('MARINA')!)
    expect(p.empty).toBe(true)
    expect(p.sections).toEqual([])
    expect(p.title).toBe('MARINA')
    expect(p.inScript.join(' ')).toMatch(/2 falas/)
  })
  it('puts every written field in the presentation, in order, and leaves blanks out', () => {
    const s: CharacterSheet = { ...newSheet('Marina'), alias: 'Mari', age: '34', role: 'Protagonista', goal: 'Recomeçar', arc: 'Da culpa ao perdão', notes: '' }
    const p = presentationOf(s, 'Marina', stats.get('MARINA')!)
    expect(p.subtitle).toBe('Mari · 34 anos · Protagonista')
    expect(p.sections.map((x) => x.heading)).toEqual(['Objetivo', 'Arco'])
    expect(p.sections[0].text).toBe('Recomeçar')
    expect(p.empty).toBe(false)
  })
  it('changing a field changes the presentation, nothing is cached', () => {
    const s = newSheet('Marina')
    const before = presentationOf(s, 'Marina', null)
    const after = presentationOf({ ...s, conflict: 'Teme ser abandonada' }, 'Marina', null)
    expect(before.sections).toHaveLength(0)
    expect(after.sections[0]).toEqual({ heading: 'Conflito', text: 'Teme ser abandonada' })
  })
  it('numbers from the script update when the script changes', () => {
    const more: Block[] = [...blocks, { kind: 'character', text: 'Marina' }, { kind: 'dialogue', text: 'De novo.' }]
    const s = characterStats({ ...script(), blocks: more }).get('MARINA')!
    expect(s.lines).toBe(3)
  })
  it('does not turn a text age into "anos"', () => {
    const p = presentationOf({ ...newSheet('Davi'), age: 'por volta de 60' }, 'Davi', null)
    expect(p.subtitle).toBe('por volta de 60')
  })
})

describe('file safety', () => {
  it('round-trips sheets and keeps images only when they are safe', () => {
    const s: Script = script({
      characters: [
        { ...newSheet('Marina'), goal: 'Recomeçar', image: PNG },
        { ...newSheet('Davi'), image: 'https://evil.example/x.png' }
      ]
    })
    const back = parseScriptFile(serialize(s)).characters!
    expect(back).toHaveLength(2)
    expect(back[0].image).toBe(PNG)
    expect(back[1].image).toBe('')
  })
  it('drops sheets without a name and clamps long text', () => {
    expect(cleanSheet({ name: '   ' })).toBeNull()
    const c = cleanSheet({ name: 'Zeca', notes: 'x'.repeat(9000) })!
    expect(c.notes.length).toBe(4000)
  })
  it('empty means no text and no picture', () => {
    expect(sheetIsEmpty(newSheet('A'))).toBe(true)
    expect(sheetIsEmpty({ ...newSheet('A'), image: PNG })).toBe(false)
    expect(FIELDS.length).toBe(10)
  })
})

describe('PDF', () => {
  const withSheets = script({
    characters: [
      { ...newSheet('Marina'), age: '34', goal: 'Recomeçar' },
      { ...newSheet('Davi'), goal: 'Voltar', includeInPdf: false },
      newSheet('Bia')
    ]
  })
  it('prints written sheets after the script and before the storyboard and maps', () => {
    const html = buildPdfHtml({
      ...withSheets,
      storyboard: { frames: [{ id: 'f', image: '', caption: 'c', scene: '1' }], aspect: '16:9', layout: 6, includeInPdf: true }
    })
    const script = html.indexOf('INT. COZINHA')
    const sheet = html.indexOf('FICHA DE PERSONAGEM')
    const sb = html.indexOf('STORYBOARD')
    expect(script).toBeGreaterThan(-1)
    expect(sheet).toBeGreaterThan(script)
    expect(sb).toBeGreaterThan(sheet)
  })
  it('leaves out empty sheets and sheets marked as excluded', () => {
    const html = buildPdfHtml(withSheets)
    expect((html.match(/FICHA DE PERSONAGEM/g) ?? []).length).toBe(1)
    expect(html).toContain('MARINA')
    expect(html).toContain('Recomeçar')
    expect(html).not.toContain('Voltar')
  })
  it('can print the sheets alone, including excluded ones that have text', () => {
    const html = buildPdfHtml(withSheets, { charactersOnly: true })
    expect(html).not.toContain('INT. COZINHA')
    expect(html).toContain('Voltar')
  })
})
