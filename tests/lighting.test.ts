import { describe, expect, it } from 'vitest'
import { cleanLighting, cleanPlace, daySunLine, emptyLightSheet, emptyLighting, lightSheetsReport, sunReport } from '../src/shared/lighting'
import { addDay, emptyProduction, scheduleScene, setSceneTime, updateDay, type SceneInfo } from '../src/shared/production'
import { findCity } from '../src/shared/cities'
import { sunTimes } from '../src/shared/sun'
import { cleanProduction } from '../src/shared/production'
import { parseScriptFile, serialize } from '../src/shared/scriptfile'
import type { Script } from '../src/shared/types'

describe('lighting data in the file', () => {
  it('a valid sheet and place come back as they were', () => {
    const l = emptyLighting()
    l.place = { name: 'Recife - PE', lat: -8.047, lon: -34.877, tz: -3 }
    l.sheets.s1 = { ...emptyLightSheet(), quality: 'soft', contrast: 'high', color: 'âmbar', sources: ['Janela', 'Abajur'], effects: ['TV'], setupMinutes: 40 }
    l.equipment.push({ id: 'e1', name: 'Tripé', qty: 4, rental: '', out: false, back: false, notes: '' })
    const s: Script = { titlePage: { title: '', author: '', contact: '' }, blocks: [{ kind: 'scene_heading', text: 'INT. SALA - DIA', nid: 's1' }], lighting: l }
    expect(parseScriptFile(serialize(s)).lighting).toEqual(l)
  })

  it('throws away what is not valid', () => {
    const l = cleanLighting({ sheets: { s1: { quality: 'roxo', sources: ['Janela', 'Disco voador', 3], setupMinutes: -5 }, '': {} }, place: { lat: 200 }, equipment: 'x' })!
    expect(l.sheets.s1.quality).toBeUndefined()
    expect(l.sheets.s1.sources).toEqual(['Janela'])
    expect(l.sheets.s1.setupMinutes).toBeUndefined()
    expect(Object.keys(l.sheets)).toEqual(['s1'])
    expect(l.place).toBeUndefined()
    expect(l.equipment).toEqual([])
    expect(cleanLighting('nada')).toBeUndefined()
  })

  it('a place needs a latitude, a longitude and a time zone that make sense', () => {
    expect(cleanPlace({ name: 'X', lat: -10, lon: -50, tz: -3 })).toEqual({ name: 'X', lat: -10, lon: -50, tz: -3 })
    expect(cleanPlace({ name: 'X', lat: -10, lon: -50, tz: 30 })).toBeUndefined()
    expect(cleanPlace({ lat: 'a', lon: -50, tz: -3 })).toBeUndefined()
  })

  it('a shooting day keeps its date and its own place', () => {
    const p = cleanProduction({
      items: [],
      days: [
        { id: 'd1', label: '', notes: '', scenes: [], date: '2026-11-20', place: { name: 'Olinda - PE', lat: -8.009, lon: -34.855, tz: -3 } },
        { id: 'd2', label: '', notes: '', scenes: [], date: '20/11', place: { lat: 1 } }
      ]
    })
    expect(p.days[0].date).toBe('2026-11-20')
    expect(p.days[0].place?.name).toBe('Olinda - PE')
    expect(p.days[1].date).toBeUndefined()
    expect(p.days[1].place).toBeUndefined()
  })
})

describe('the light reports', () => {
  const scene = (id: string, number: string, n: number, heading: string, time: string, intExt = 'EXT.'): SceneInfo => ({
    n, index: n * 10, end: n * 10 + 5, id, number, heading, intExt, location: heading.split(' ')[1] ?? '', time, night: /NOITE/.test(time),
    eighths: 8, page: 1, cast: [], synopsis: ''
  })
  const scenes = [scene('s1', '1', 0, 'EXT. RUA - NOITE', 'NOITE'), scene('s2', '2', 1, 'INT. SALA - DIA', 'DIA', 'INT.')]

  it('a sheet per scene, with only the lines that were filled, in the sheet order', () => {
    const l = emptyLighting()
    l.sheets.s2 = { ...emptyLightSheet(), quality: 'soft', contrast: 'low', sources: ['Janela'], otherSource: 'reflexo da piscina', setupMinutes: 40 }
    const r = lightSheetsReport(scenes, l)
    expect(r.title).toBe('Fichas de luz')
    expect(r.printed?.sections.map((s) => s.title)).toEqual(['Cena 2 · INT. SALA - DIA'])
    expect(r.printed?.sections[0].rows).toEqual([
      ['Luz', 'Suave'],
      ['Contraste', 'Baixo'],
      ['De onde vem a luz', 'Janela, reflexo da piscina'],
      ['Montagem', '40 min']
    ])
  })

  it('the sun of each day, and a warning for a night scene in daylight', () => {
    const l = emptyLighting()
    l.place = findCity('São Paulo - SP')
    let p = addDay(addDay(emptyProduction()))
    p = updateDay(p, p.days[0].id, { date: '2026-06-21' })
    p = scheduleScene(p, 's1', p.days[0].id)
    p = setSceneTime(p, p.days[0].id, 's1', '14:00')
    const r = sunReport(scenes, l, p)
    const [days, warnings] = r.printed!.tables!
    expect(days.columns).toEqual(['Dia', 'Data', 'Lugar', 'Blue hour (manhã)', 'Nascer do sol', 'Golden hour (manhã)', 'Golden hour (tarde)', 'Pôr do sol', 'Blue hour (tarde)'])
    expect(days.rows[0].slice(0, 3)).toEqual(['Dia 1', '21/06/2026', 'São Paulo - SP'])
    expect(String(days.rows[0][4])).toMatch(/^06:4\d$/)
    expect(days.rows[1].slice(1, 4)).toEqual(['—', 'São Paulo - SP', '—'])
    expect(warnings.rows).toHaveLength(1)
    expect(warnings.rows[0].slice(0, 3)).toEqual(['Dia 1', '1 · EXT. RUA - NOITE', '14:00'])
  })

  it('one line of sun for the day sheet', () => {
    const sun = sunTimes('2026-06-21', findCity('São Paulo - SP')!)!
    expect(daySunLine(sun)).toBe(`nasce ${sun.sunrise} · golden hour ${sun.goldenEvening[0]}–${sun.goldenEvening[1]} · se põe ${sun.sunset}`)
  })
})
