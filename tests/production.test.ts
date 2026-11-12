import { describe, expect, it } from 'vitest'
import {
  addDay,
  addItem,
  breakdownReport,
  cleanProduction,
  dayReport,
  elementsReport,
  emptyProduction,
  formatEighths,
  removeDay,
  removeItem,
  sceneInfo,
  scheduleReport,
  scheduleByLocation,
  scheduleScene,
  setSceneTime,
  splitDay,
  unscheduled
} from '../src/shared/production'
import { printable } from '../src/shared/reports'
import { parseScriptFile, serialize } from '../src/shared/scriptfile'
import { buildReports } from '../src/shared/reports'
import type { Block, Script } from '../src/shared/types'

const long = 'Descrição longa para ocupar linhas na página. '.repeat(6)
const blocks: Block[] = [
  { kind: 'scene_heading', text: 'INT. COZINHA - DIA', nid: 's1' },
  { kind: 'action', text: long },
  { kind: 'character', text: 'MARINA' },
  { kind: 'dialogue', text: 'Você veio.' },
  { kind: 'character', text: 'DAVI (O.S.)' },
  { kind: 'dialogue', text: 'Vim.' },
  { kind: 'character', text: 'marina' },
  { kind: 'dialogue', text: 'Entra.' },
  { kind: 'scene_heading', text: 'EXT. RUA - NOITE', nid: 's2' },
  { kind: 'action', text: 'Chove.' },
  { kind: 'scene_heading', text: 'INT./EXT. CARRO - MADRUGADA' }
]
const script: Script = { titlePage: { title: '', author: '', contact: '' }, blocks }

describe('scene info', () => {
  it('reads the heading, the cast and the length of every scene', () => {
    const s = sceneInfo(script)
    expect(s.map((x) => [x.number, x.id, x.intExt, x.location, x.time, x.night])).toEqual([
      ['1', 's1', 'INT.', 'COZINHA', 'DIA', false],
      ['2', 's2', 'EXT.', 'RUA', 'NOITE', true],
      ['3', null, 'INT./EXT.', 'CARRO', 'MADRUGADA', true]
    ])
    // the cast is who speaks, once each, without the extension
    expect(s[0].cast).toEqual(['MARINA', 'DAVI'])
    expect(s[1].cast).toEqual([])
    // a longer scene is longer, and no scene is shorter than one eighth
    expect(s[0].eighths).toBeGreaterThan(s[1].eighths)
    expect(Math.min(...s.map((x) => x.eighths))).toBeGreaterThanOrEqual(1)
  })

  it('counts a full page as eight eighths', () => {
    const page: Block[] = [{ kind: 'scene_heading', text: 'INT. A - DIA' }]
    for (let i = 0; i < 26; i++) page.push({ kind: 'action', text: 'Linha.' })
    page.push({ kind: 'scene_heading', text: 'INT. B - DIA' })
    const s = sceneInfo({ blocks: page })
    // 2 blank lines + heading + 26 × (blank + line) = 55 lines, a letter page
    expect(s[0].eighths).toBe(8)
  })

  it('writes eighths the way a stripboard does', () => {
    expect([1, 3, 8, 11, 16, 20].map(formatEighths)).toEqual(['1/8', '3/8', '1', '1 3/8', '2', '2 4/8'])
  })
})

describe('breakdown', () => {
  it('reuses an element with the same name and forgets it when no scene has it', () => {
    let p = addItem(emptyProduction(), 's1', 'props', 'Faca')
    p = addItem(p, 's2', 'props', ' faca ')
    p = addItem(p, 's2', 'props', 'Faca')
    p = addItem(p, 's2', 'wardrobe', 'Faca')
    p = addItem(p, 's2', 'props', '   ')
    expect(p.items.map((i) => [i.category, i.name, i.scenes])).toEqual([
      ['props', 'Faca', ['s1', 's2']],
      ['wardrobe', 'Faca', ['s2']]
    ])
    const knife = p.items[0].id
    p = removeItem(p, knife, 's1')
    expect(p.items[0].scenes).toEqual(['s2'])
    p = removeItem(p, knife, 's2')
    expect(p.items.map((i) => i.category)).toEqual(['wardrobe'])
  })

  it('makes a sheet per scene with a column for each category in use, and a list of elements', () => {
    let p = addItem(emptyProduction(), 's2', 'props', 'Guarda-chuva')
    p = addItem(p, 's1', 'props', 'Bule')
    p = addItem(p, 's1', 'vehicles', 'Fusca')
    p = addItem(p, 'apagada', 'animals', 'Gato')
    const info = sceneInfo(script)
    const b = breakdownReport(info, p)
    expect(b.columns).toEqual(['Nº', 'Cabeçalho', 'Págs.', 'Elenco', 'Objetos de cena', 'Veículos', 'Animais'])
    expect(b.rows[0].slice(3)).toEqual(['MARINA, DAVI', 'Bule', 'Fusca', '—'])
    expect(b.rows[2].slice(4)).toEqual(['—', '—', '—'])
    // an element only in a deleted scene is not listed
    expect(elementsReport(info, p).rows).toEqual([
      ['Objetos de cena', 'Bule', '1', 1],
      ['Objetos de cena', 'Guarda-chuva', '2', 1],
      ['Veículos', 'Fusca', '1', 1]
    ])
  })
})

describe('shooting plan', () => {
  it('puts each scene on one day at most, in the order chosen', () => {
    let p = addDay(addDay(emptyProduction()))
    const [d1, d2] = p.days.map((d) => d.id)
    p = scheduleScene(p, 's1', d1)
    p = scheduleScene(p, 's2', d1, 0)
    expect(p.days[0].scenes).toEqual(['s2', 's1'])
    p = scheduleScene(p, 's1', d2)
    expect(p.days.map((d) => d.scenes)).toEqual([['s2'], ['s1']])
    p = scheduleScene(p, 's1', null)
    expect(p.days.map((d) => d.scenes)).toEqual([['s2'], []])
    const info = sceneInfo(script)
    expect(unscheduled(info, p).map((s) => s.number)).toEqual(['1', '3'])
    // deleting a day sends its scenes back
    expect(unscheduled(info, removeDay(p, d1)).map((s) => s.number)).toEqual(['1', '2', '3'])
  })

  it('reports every day with a total, then the scenes with no day; a day gets its own call sheet', () => {
    let p = addDay(emptyProduction())
    p = { ...p, days: [{ ...p.days[0], label: 'Sábado 14/03', notes: 'Chuva artificial às 18h' }] }
    p = scheduleScene(p, 's2', p.days[0].id)
    p = scheduleScene(p, 'apagada', p.days[0].id)
    p = addItem(p, 's2', 'sfx', 'Chuva')
    p = setSceneTime(p, p.days[0].id, 's2', '18:30')
    const info = sceneInfo(script)
    const r = scheduleReport(info, p)
    expect(r.columns.slice(0, 3)).toEqual(['Dia', 'Horário', 'Cena'])
    expect(r.rows.map((row) => row.slice(0, 5))).toEqual([
      ['Sábado 14/03', '18:30', '2', 'EXT.', 'RUA'],
      ['Sábado 14/03', '', 'Total', '', '1 cena'],
      ['Sem dia', '—', '1', 'INT.', 'COZINHA'],
      ['Sem dia', '—', '3', 'INT./EXT.', 'CARRO']
    ])
    const day = dayReport(p.days[0], 0, info, p)
    expect(day.title).toBe('Ordem do dia · Sábado 14/03')
    expect(day.rows[0]).toEqual(['18:30', '2', 'EXT.', 'RUA', '—', 'N', '1/8', '—', 'Efeitos especiais: Chuva'])
    expect(day.rows[2]).toEqual(['', 'Notas', '', 'Chuva artificial às 18h', '', '', '', '', ''])
  })

  it('prints the plan day by day: a heading with the count and the notes, the scenes without the day on each line', () => {
    let p = addDay(emptyProduction())
    p = { ...p, days: [{ ...p.days[0], label: 'Sábado 14/03', notes: 'Chuva artificial às 18h' }] }
    p = scheduleScene(p, 's2', p.days[0].id)
    p = setSceneTime(p, p.days[0].id, 's2', '18:30')
    const info = sceneInfo(script)
    const r = scheduleReport(info, p)
    expect(r.printed!.columns[0]).toBe('Horário')
    expect(r.printed!.sections.map((s) => [s.title, s.summary, s.note])).toEqual([
      ['Sábado 14/03', '1 cena · 1/8 pág.', 'Chuva artificial às 18h'],
      ['Sem dia marcado', expect.stringMatching(/^2 cenas · /), undefined]
    ])
    expect(r.printed!.sections[0].rows).toEqual([['18:30', '2', 'EXT.', 'RUA', '—', 'N', '1/8', '—', '—']])
    // the PDF gets the groups, the CSV keeps the flat table
    expect(printable(r)).toEqual({ title: 'Plano de filmagem', columns: r.printed!.columns, rows: [], sections: r.printed!.sections })
    expect(printable({ title: 'X', columns: ['a'], rows: [[1]] })).toEqual({ title: 'X', columns: ['a'], rows: [[1]] })
    const day = dayReport(p.days[0], 0, info, p)
    expect(day.printed!.sections).toHaveLength(1)
    expect(day.printed!.sections[0]).toEqual(expect.objectContaining({ title: 'Cenas do dia', note: 'Chuva artificial às 18h' }))
  })

  it('keeps a time per scene and day: it stays when the scene moves inside the day, goes when it leaves, follows a split', () => {
    let p = addDay(addDay(emptyProduction()))
    const [d1, d2] = p.days.map((d) => d.id)
    for (const id of ['a', 'b', 'c']) p = scheduleScene(p, id, d1)
    p = setSceneTime(p, d1, 'a', '07:00')
    p = setSceneTime(p, d1, 'c', '15:45')
    p = setSceneTime(p, d1, 'b', '25:00') // not a time
    p = setSceneTime(p, d1, 'zz', '09:00') // not on that day
    expect(p.days[0].times).toEqual({ a: '07:00', c: '15:45' })
    p = scheduleScene(p, 'c', d1, 0)
    expect(p.days[0].times).toEqual({ a: '07:00', c: '15:45' })
    p = scheduleScene(p, 'a', d2)
    expect(p.days.map((d) => d.times)).toEqual([{ c: '15:45' }, undefined])
    p = scheduleScene(p, 'a', d1)
    const split = splitDay(p, d1, 'b')
    expect(split.days.map((d) => [d.scenes, d.times])).toEqual([[['c'], { c: '15:45' }], [['b', 'a'], undefined], [[], undefined]])
    p = setSceneTime(p, d1, 'c', '')
    expect(p.days[0].times).toBeUndefined()
    // and in the file
    p = setSceneTime(p, d1, 'b', '10:15')
    expect(cleanProduction(JSON.parse(JSON.stringify({ ...p, days: [{ ...p.days[0], times: { ...p.days[0].times, b: '10:15', a: 'meio-dia', x: '09:00' } }] }))).days[0].times).toEqual({ b: '10:15' })
  })
})

describe('production in the file', () => {
  it('is saved and comes back, and anything malformed is dropped', () => {
    let p = addItem(emptyProduction(), 's1', 'props', 'Bule')
    p = scheduleScene(addDay(p), 's1', null)
    p = scheduleScene(p, 's1', p.days[0].id)
    const back = parseScriptFile(serialize({ ...script, production: p }))
    expect(back.production).toEqual(p)
    const dirty = cleanProduction({
      items: [{ id: 'a', category: 'naves', name: 'X', scenes: [] }, { id: 'b', category: 'props', name: '', scenes: [] }, 'lixo'],
      days: [{ id: 'd1', label: 5, scenes: ['s1', 's1', 7] }, { id: 'd2', scenes: ['s1', 's2'] }]
    })
    expect(dirty.items).toEqual([])
    // a scene listed twice, or on two days, stays on the first
    expect(dirty.days.map((d) => [d.label, d.scenes])).toEqual([['', ['s1']], ['', ['s2']]])
  })

  it('shows up in Relatórios', () => {
    const ids = buildReports(script).map((r) => r.id)
    expect(ids.slice(-3)).toEqual(['decupagem', 'elementos-producao', 'plano'])
  })
})

describe('smart planning', () => {
  const many: Block[] = [
    { kind: 'scene_heading', text: 'INT. COZINHA - NOITE', nid: 'a' },
    { kind: 'scene_heading', text: 'EXT. RUA - DIA', nid: 'b' },
    { kind: 'scene_heading', text: 'INT. COZINHA - DIA', nid: 'c' },
    { kind: 'scene_heading', text: 'INT. CARRO - NOITE' },
    { kind: 'scene_heading', text: 'EXT. RUA - NOITE', nid: 'e' },
    { kind: 'scene_heading', text: 'INT. COZINHA - DIA', nid: 'f' }
  ]
  const s = (): Script => ({ titlePage: { title: '', author: '', contact: '' }, blocks: many })
  let given = 0
  const ids = (list: { id: string | null }[]): (string | null)[] => list.map((x) => x.id ?? `novo${++given}`)

  it('puts the scenes with no day on one day per location, day scenes first, in script order', () => {
    const info = sceneInfo(s())
    const r = scheduleByLocation(info, emptyProduction(), ids)
    expect(r.days).toBe(3)
    expect(r.scenes).toBe(6)
    expect(r.production.days.map((d) => [d.label, d.scenes])).toEqual([
      ['COZINHA', ['c', 'f', 'a']],
      ['RUA', ['b', 'e']],
      ['CARRO', ['novo1']]
    ])
  })

  it('leaves planned days alone and adds new scenes to a location day made before', () => {
    const info = sceneInfo(s())
    let p = addDay(emptyProduction())
    p = scheduleScene(p, 'b', p.days[0].id) // the writer put RUA (day) on day 1 by hand
    p = { ...p, days: [...p.days, { id: 'kitchen', label: 'Cozinha', notes: '', scenes: ['a'] }] }
    const r = scheduleByLocation(info, p, ids)
    // new days follow the order in which their location first appears in the script
    expect(r.production.days.map((d) => d.scenes)).toEqual([['b'], ['a', 'c', 'f'], [expect.stringMatching(/^novo/)], ['e']])
    expect(r.days).toBe(2)
    // nothing left: running it again changes nothing
    const again = scheduleByLocation(sceneInfo(s()), { ...r.production, days: r.production.days }, () => [])
    expect(again.scenes).toBe(0)
  })

  it('splits a day in two before a scene', () => {
    let p = addDay(emptyProduction())
    p = { ...p, days: [{ ...p.days[0], label: 'COZINHA', notes: 'Chegar às 7h', scenes: ['a', 'c', 'f'] }] }
    const two = splitDay(p, p.days[0].id, 'c')
    expect(two.days.map((d) => [d.label, d.notes, d.scenes])).toEqual([
      ['COZINHA', 'Chegar às 7h', ['a']],
      ['COZINHA · parte 2', '', ['c', 'f']]
    ])
    // not before the first scene, not for a scene that is not there
    expect(splitDay(p, p.days[0].id, 'a')).toBe(p)
    expect(splitDay(p, p.days[0].id, 'zz')).toBe(p)
  })
})
