import { describe, expect, it } from 'vitest'
import { cleanLighting, cleanPlace, emptyLightSheet, emptyLighting } from '../src/shared/lighting'
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
