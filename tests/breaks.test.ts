import { describe, expect, it } from 'vitest'
import { addBreak, addDay, cleanProduction, dayReport, emptyProduction, removeBreak, sceneInfo, scheduleScene, setSceneTime, updateBreak } from '../src/shared/production'
import { buildReportHtml } from '../src/shared/reportHtml'
import type { Block } from '../src/shared/types'

const blocks: Block[] = [
  { kind: 'scene_heading', text: 'INT. COZINHA - DIA', nid: 's1' },
  { kind: 'action', text: 'Café.' },
  { kind: 'scene_heading', text: 'EXT. RUA - DIA', nid: 's2' },
  { kind: 'action', text: 'Chove.' }
]
const scenes = sceneInfo({ blocks })

function planned() {
  let p = addDay(emptyProduction())
  const d = p.days[0].id
  p = scheduleScene(p, 's1', d)
  p = scheduleScene(p, 's2', d)
  p = setSceneTime(p, d, 's1', '09:00')
  p = setSceneTime(p, d, 's2', '14:00')
  return { p, d }
}

describe('meal breaks on a shooting day', () => {
  it('a day gets breaks, changes them and loses them', () => {
    const { p: p0, d } = planned()
    let p = addBreak(p0, d, 'lunch')
    const id = p.days[0].breaks![0].id
    expect(p.days[0].breaks![0]).toMatchObject({ kind: 'lunch', time: '', minutes: 60 })
    p = updateBreak(p, d, id, { time: '12:30', minutes: 45 })
    expect(p.days[0].breaks![0]).toMatchObject({ time: '12:30', minutes: 45 })
    expect(removeBreak(p, d, id).days[0].breaks).toBeUndefined()
  })

  it('breaks are read back safely from the file', () => {
    const p = cleanProduction({
      items: [],
      days: [{ id: 'd1', label: '', notes: '', scenes: [], breaks: [{ id: 'b1', kind: 'snack', time: '16:00', minutes: 20 }, { id: 'b2', kind: 'banquete', time: '25:00', minutes: -3 }, 'x'] }]
    })
    expect(p.days[0].breaks).toEqual([
      { id: 'b1', kind: 'snack', time: '16:00', minutes: 20 },
      { id: 'b2', kind: 'snack', time: '', minutes: 30 }
    ])
  })

  it('the day sheet puts each break between the scenes, by its time; one with no time goes last', () => {
    const { p: p0, d } = planned()
    let p = addBreak(p0, d, 'lunch')
    p = updateBreak(p, d, p.days[0].breaks![0].id, { time: '12:00', minutes: 60 })
    p = addBreak(p, d, 'snack')
    const c = dayReport(p.days[0], 0, scenes, p).printed!.callsheet!
    expect(c.breaks).toEqual([
      { time: '12:00', label: 'Almoço', length: '1 h' },
      { time: '', label: 'Lanche', length: '30 min' }
    ])
    const html = buildReportHtml({ title: 'x', columns: [], rows: [], scriptTitle: '', callsheet: c })
    const at = (s: string): number => html.indexOf(s)
    expect(at('Cena 1')).toBeLessThan(at('Almoço'))
    expect(at('Almoço')).toBeLessThan(at('Cena 2'))
    expect(at('Cena 2')).toBeLessThan(at('Lanche'))
    expect(html).toContain('<section class="cs-break">')
  })
})
