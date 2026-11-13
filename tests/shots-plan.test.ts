import { describe, expect, it } from 'vitest'
import {
  addDay,
  cleanProduction,
  dayReport,
  emptyProduction,
  moveShot,
  removeDay,
  sceneInfo,
  sceneShots,
  scheduleReport,
  scheduleScene,
  setSceneTime,
  setShotTime,
  shotTime,
  shotsByTime,
  shotsOf,
  splitDay,
  unscheduled
} from '../src/shared/production'
import type { Block, Frame, Production, Script } from '../src/shared/types'

const blocks: Block[] = [
  { kind: 'scene_heading', text: 'INT. COZINHA - DIA', nid: 's1' },
  { kind: 'action', text: 'Marina coa o café.' },
  { kind: 'scene_heading', text: 'EXT. RUA - NOITE', nid: 's2' },
  { kind: 'action', text: 'Chove.' }
]
const script: Script = { titlePage: { title: '', author: '', contact: '' }, blocks }
const frames: Frame[] = [
  { id: 'f1', image: '', caption: 'Marina de costas', scene: '1', sid: 's1', shot: 'Plano médio', lens: 35 },
  { id: 'f2', image: '', caption: 'O café caindo', scene: '1', sid: 's1', shot: 'Close' },
  { id: 'f3', image: '', caption: 'Rua molhada', scene: '2', sid: 's2', shot: 'Plano geral' },
  // a frame without a scene id still belongs to the scene its label names
  { id: 'f4', image: '', caption: 'Carro passa', scene: '2' }
]
const scenes = sceneInfo(script)
const shots = sceneShots(frames, scenes)
const ALL1 = ['f1', 'f2']

/** Two days, scene 1 on the first. */
function planned(): { p: Production; a: string; b: string } {
  let p = addDay(addDay(emptyProduction()))
  const [a, b] = p.days.map((d) => d.id)
  p = scheduleScene(p, 's1', a)
  return { p, a, b }
}

describe('storyboard shots in the shooting plan', () => {
  it('numbers each scene’s shots after the scene, in storyboard order', () => {
    expect(shots.get('s1')!.map((s) => [s.id, s.code])).toEqual([
      ['f1', '1.1'],
      ['f2', '1.2']
    ])
    expect(shots.get('s2')!.map((s) => s.code)).toEqual(['2.1', '2.2'])
    expect(shots.get('s1')![0].text).toBe('Plano médio · 35 mm — Marina de costas')
  })

  it('a scene on a day takes all its shots there, and the day sheet lists them', () => {
    const { p, a } = planned()
    expect(shotsOf(p, 's1', ALL1, a)).toEqual(['f1', 'f2'])
    const day = dayReport(p.days[0], 0, scenes, p, shots)
    expect(day.columns).toContain('Planos')
    const row = day.rows[0].map(String)
    // one shot per line
    expect(row[day.columns.indexOf('Planos')]).toBe('1.1 Plano médio · 35 mm — Marina de costas\n1.2 Close — O café caindo')
  })

  it('without storyboard shots the plan has no Planos column', () => {
    const { p } = planned()
    expect(dayReport(p.days[0], 0, scenes, p).columns).not.toContain('Planos')
  })

  it('one shot can go to another day: the scene shows on both, each with its own shots', () => {
    const { p: p0, a, b } = planned()
    const p = moveShot(p0, 's1', ALL1, 'f2', b)
    expect(shotsOf(p, 's1', ALL1, a)).toEqual(['f1'])
    expect(shotsOf(p, 's1', ALL1, b)).toEqual(['f2'])
    expect(p.days.map((d) => d.scenes)).toEqual([['s1'], ['s1']])
    const first = dayReport(p.days[0], 0, scenes, p, shots)
    const second = dayReport(p.days[1], 1, scenes, p, shots)
    const col = first.columns.indexOf('Planos')
    expect(String(first.rows[0][col])).toMatch(/^1\.1 /)
    expect(String(second.rows[0][col])).toMatch(/^1\.2 /)
    // a part of a scene says so
    expect(String(first.rows[0][first.columns.indexOf('Cena')])).toBe('1 (parte)')
  })

  it('when all the shots are back on one day the scene is whole again', () => {
    const { p: p0, a, b } = planned()
    const split = moveShot(p0, 's1', ALL1, 'f2', b)
    const whole = moveShot(split, 's1', ALL1, 'f2', a)
    expect(whole.days.map((d) => d.scenes)).toEqual([['s1'], []])
    expect(whole.days.every((d) => d.shots === undefined)).toBe(true)
  })

  it('a shot with no day waits in the list of things with no day, so nothing is forgotten', () => {
    const { p: p0, a } = planned()
    const p = moveShot(p0, 's1', ALL1, 'f2', null)
    expect(shotsOf(p, 's1', ALL1, a)).toEqual(['f1'])
    expect(shotsOf(p, 's1', ALL1, null)).toEqual(['f2'])
    // the scene is planned (it has a day), but its other shot is in "Sem dia marcado"
    expect(unscheduled(scenes, p).map((s) => s.id)).toEqual(['s2'])
    const plan = scheduleReport(scenes, p, shots)
    const pool = plan.printed!.sections!.find((s) => s.title === 'Sem dia marcado')!
    const col = plan.printed!.columns.indexOf('Planos')
    expect(pool.rows.map((r) => String(r[col]))).toContain('1.2 Close — O café caindo')
  })

  it('moving a part of a scene moves only that part', () => {
    const { p: p0, a, b } = planned()
    const split = moveShot(p0, 's1', ALL1, 'f2', b)
    // the part on day b back onto day a: the scene is whole on a
    const joined = scheduleScene(split, 's1', a, undefined, { from: b, all: ALL1 })
    expect(joined.days.map((d) => d.scenes)).toEqual([['s1'], []])
    expect(shotsOf(joined, 's1', ALL1, a)).toEqual(['f1', 'f2'])
    // the part on day a to no day: only shot 2 is left on b
    const away = scheduleScene(split, 's1', null, undefined, { from: a, all: ALL1 })
    expect(shotsOf(away, 's1', ALL1, b)).toEqual(['f2'])
    expect(shotsOf(away, 's1', ALL1, null)).toEqual(['f1'])
  })

  it('deleting a day leaves its shots with no day; splitting a day takes the shots along', () => {
    const { p: p0, b } = planned()
    const split = moveShot(p0, 's1', ALL1, 'f2', b)
    const gone = removeDay(split, b)
    expect(shotsOf(gone, 's1', ALL1, null)).toEqual(['f2'])
    // day b gets scene 2 after the part of scene 1, then is split before scene 2
    const two = scheduleScene(split, 's2', b)
    const cut = splitDay(two, b, 's2')
    expect(cut.days).toHaveLength(3)
    expect(shotsOf(cut, 's1', ALL1, b)).toEqual(['f2'])
  })

  it('the file keeps the parts, and drops a second day of a scene that does not say which shots it has', () => {
    const { p: p0, a, b } = planned()
    const split = moveShot(p0, 's1', ALL1, 'f2', b)
    expect(cleanProduction(JSON.parse(JSON.stringify(split)))).toEqual(split)
    const bad = { days: [{ id: a, label: '', notes: '', scenes: ['s1'] }, { id: b, label: '', notes: '', scenes: ['s1'] }] }
    expect(cleanProduction(bad).days.map((d) => d.scenes)).toEqual([['s1'], []])
  })
})

describe('shooting time of each shot', () => {
  it('a shot gets a time on its day; the day sheet lists the shots by time, and the scene starts at the first one', () => {
    const { p: p0, a } = planned()
    let p = setShotTime(p0, a, 's1', 'f2', '09:00')
    p = setShotTime(p, a, 's1', 'f1', '10:30')
    expect(shotTime(p.days[0], 's1', 'f2')).toBe('09:00')
    const day = dayReport(p.days[0], 0, scenes, p, shots)
    const row = day.rows[0].map(String)
    expect(row[day.columns.indexOf('Planos')]).toBe('09:00 1.2 Close — O café caindo\n10:30 1.1 Plano médio · 35 mm — Marina de costas')
    expect(row[day.columns.indexOf('Horário')]).toBe('09:00')
    // the scene's own time wins
    const own = dayReport(setSceneTime(p, a, 's1', '08:00').days[0], 0, scenes, setSceneTime(p, a, 's1', '08:00'), shots)
    expect(String(own.rows[0][own.columns.indexOf('Horário')])).toBe('08:00')
    // a time that is not a time clears it
    expect(shotTime(setShotTime(p, a, 's1', 'f2', '').days[0], 's1', 'f2')).toBe('')
  })

  it('a shot that goes to another day leaves its time behind; the others keep theirs', () => {
    const { p: p0, a, b } = planned()
    let p = setShotTime(p0, a, 's1', 'f1', '10:30')
    p = setShotTime(p, a, 's1', 'f2', '11:00')
    p = moveShot(p, 's1', ALL1, 'f2', b)
    expect(shotTime(p.days[0], 's1', 'f1')).toBe('10:30')
    expect(shotTime(p.days[0], 's1', 'f2')).toBe('')
    expect(shotTime(p.days[1], 's1', 'f2')).toBe('')
    // the whole scene leaving the day leaves every shot time behind
    const away = scheduleScene(setShotTime(p0, a, 's1', 'f1', '10:30'), 's1', b)
    expect(shotTime(away.days[1], 's1', 'f1')).toBe('')
    expect(away.days[0].shotTimes).toBeUndefined()
  })

  it('the file keeps the shot times, and splitting a day takes them along', () => {
    const { p: p0, a } = planned()
    let p = setShotTime(p0, a, 's1', 'f1', '10:30')
    expect(cleanProduction(JSON.parse(JSON.stringify(p)))).toEqual(p)
    p = scheduleScene(p, 's2', a, 0)
    const cut = splitDay(p, a, 's1')
    expect(shotTime(cut.days[1], 's1', 'f1')).toBe('10:30')
    expect(cut.days[0].shotTimes).toBeUndefined()
  })
})

describe('a day in time order', () => {
  it('a time puts the scene in its place: earliest on top, scenes with no time after, in their order', () => {
    const { p: p0, a } = planned()
    let p = scheduleScene(p0, 's2', a)
    expect(p.days[0].scenes).toEqual(['s1', 's2'])
    p = setSceneTime(p, a, 's2', '07:00')
    expect(p.days[0].scenes).toEqual(['s2', 's1'])
    // a scene with no time of its own starts at its first shot
    p = setShotTime(p, a, 's1', 'f2', '06:30')
    expect(p.days[0].scenes).toEqual(['s1', 's2'])
    p = setShotTime(p, a, 's1', 'f2', '')
    expect(p.days[0].scenes).toEqual(['s2', 's1'])
  })

  it('the shots of a scene are listed by time, the ones with no time after, in storyboard order', () => {
    const list = [
      { id: 'a', code: '1.1', text: '', time: '' },
      { id: 'b', code: '1.2', text: '', time: '10:00' },
      { id: 'c', code: '1.3', text: '', time: '09:00' },
      { id: 'd', code: '1.4', text: '', time: '' }
    ]
    expect(shotsByTime(list).map((x) => x.code)).toEqual(['1.3', '1.2', '1.1', '1.4'])
  })
})

describe('the day sheet', () => {
  it('says which day of the plan it is, when it starts and where, and lists each scene with its shots by time', () => {
    const { p: p0, a } = planned()
    let p = scheduleScene(p0, 's2', a)
    p = setShotTime(p, a, 's1', 'f2', '09:00')
    p = setSceneTime(p, a, 's2', '11:00')
    const c = dayReport(p.days[0], 0, scenes, p, shots).printed!.callsheet!
    expect(c.day).toBe('Dia 1')
    expect(c.dayOf).toBe('Dia 1 de 2')
    expect(c.start).toBe('09:00')
    expect(c.locations).toEqual(['COZINHA', 'RUA'])
    expect(c.scenes.map((s) => [s.time, s.number, s.intExt, s.dn])).toEqual([
      ['09:00', '1', 'INT.', 'D'],
      ['11:00', '2', 'EXT.', 'N']
    ])
    expect(c.scenes[0].shots.map((x) => [x.time, x.code])).toEqual([
      ['09:00', '1.2'],
      ['', '1.1']
    ])
  })
})

describe('sound on the day sheet', () => {
  it('a scene carries its sound line and the heading the ambiences to record that day', () => {
    const { p: p0, a } = planned()
    const p = scheduleScene(p0, 's2', a)
    const located: string[][] = []
    const c = dayReport(p.days[0], 0, scenes, p, shots, {
      line: (id) => (id === 's1' ? 'Som direto' : ''),
      ambiences: (locs) => (located.push(locs), 'COZINHA: geladeira')
    }).printed!.callsheet!
    expect(c.scenes.map((s) => s.sound)).toEqual(['Som direto', ''])
    expect(c.ambiences).toBe('COZINHA: geladeira')
    expect(located).toEqual([['COZINHA', 'RUA']])
  })
})
