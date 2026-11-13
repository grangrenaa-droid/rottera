import { describe, expect, it } from 'vitest'
import { cleanEquipment, equipmentReport, heaviestLoad, lightAutoLines, renameLightModel, renameSoundModel, soundAutoLines } from '../src/shared/equipment'
import { emptyLighting } from '../src/shared/lighting'
import { newItem } from '../src/shared/lightmap'
import { emptySound, newMic } from '../src/shared/sound'
import type { LightMap, Sound } from '../src/shared/types'

function sound(): Sound {
  const s = emptySound()
  const mic = (type: Parameters<typeof newMic>[0], model?: string) => ({ ...newMic(type, 1, 1), ...(model ? { model } : {}) })
  s.plans.push(
    { id: 'p1', scene: '1', width: 6, height: 4, notes: '', mics: [mic('shotgun', 'MKH 416'), mic('shotgun', 'MKH 416'), mic('lavalier')] },
    { id: 'p2', scene: '2', width: 6, height: 4, notes: '', mics: [mic('shotgun', 'MKH 416'), mic('lavalier'), mic('lavalier')] }
  )
  return s
}

describe('equipment that comes from the plans', () => {
  it('counts each type and model by the most used at once on one plan', () => {
    expect(soundAutoLines(sound())).toEqual([
      { key: 'shotgun|MKH 416', name: 'Shotgun · MKH 416', base: 'Shotgun', model: 'MKH 416', qty: 2 },
      { key: 'lavalier|', name: 'Lapela', base: 'Lapela', model: '', qty: 2 }
    ])
  })

  it('no plans, no lines', () => {
    expect(soundAutoLines(emptySound())).toEqual([])
  })
})

describe('the equipment list as a report', () => {
  it('lists the lines from the plans first, then the ones typed by hand, with yes and no', () => {
    const r = equipmentReport(
      'Equipamento de som',
      soundAutoLines(sound()),
      [{ id: 'e1', name: 'Fone', qty: 2, rental: '', out: false, back: false, notes: '' }],
      { 'shotgun|MKH 416': { rental: 'Locadora X', out: true, back: false, notes: '' } }
    )
    expect(r.columns).toEqual(['Item', 'Qtd.', 'Locadora', 'Retirado', 'Devolvido', 'Observações'])
    expect(r.rows).toEqual([
      ['Shotgun · MKH 416', 2, 'Locadora X', 'Sim', 'Não', '—'],
      ['Lapela', 2, '—', 'Não', 'Não', '—'],
      ['Fone', 2, '—', 'Não', 'Não', '—']
    ])
  })

  it('a hand-typed list is read back safely', () => {
    expect(cleanEquipment([{ id: 'e1', name: 'Fone', qty: 2 }, { name: 'sem id' }, 'x'])).toEqual([
      { id: 'e1', name: 'Fone', qty: 2, rental: '', out: false, back: false, notes: '' }
    ])
  })
})

describe('equipment that comes from the light maps', () => {
  it('counts each light by type and power, the most used at once on one map', () => {
    const map = (id: string, items: LightMap['items']): LightMap => ({ id, name: id, scene: '', width: 6, height: 4, items, notes: '', includeInPdf: true })
    const f = (w: number) => ({ ...newItem('fresnel', 1, 1), watts: w })
    const maps = [map('a', [f(2000), f(2000), f(650)]), map('b', [f(2000), newItem('actor', 1, 1)])]
    expect(lightAutoLines(maps).map((l) => [l.key, l.qty])).toEqual([
      ['fresnel|2000', 2],
      ['fresnel|650', 1]
    ])
    expect(lightAutoLines(maps)[0].name).toMatch(/2\.000 W$/)
    expect(heaviestLoad(maps).watts).toBe(4650)
  })
})

describe('renaming a line of the equipment list changes the model on the plans', () => {
  it('sound: every microphone of that type and model gets the new model, and what was written on the line goes along', () => {
    const s = sound()
    s.equipState['shotgun|MKH 416'] = { rental: 'Locadora X', out: true, back: false, notes: '' }
    const next = renameSoundModel(s, 'shotgun|MKH 416', '  MKH 50 ')
    const models = next.plans.flatMap((p) => p.mics.map((m) => [m.type, m.model ?? '']))
    expect(models).toEqual([
      ['shotgun', 'MKH 50'],
      ['shotgun', 'MKH 50'],
      ['lavalier', ''],
      ['shotgun', 'MKH 50'],
      ['lavalier', ''],
      ['lavalier', '']
    ])
    expect(next.equipState['shotgun|MKH 50']).toEqual({ rental: 'Locadora X', out: true, back: false, notes: '' })
    expect(next.equipState['shotgun|MKH 416']).toBeUndefined()
    expect(soundAutoLines(next).map((l) => l.name)).toEqual(['Shotgun · MKH 50', 'Lapela'])
  })

  it('sound: an empty name takes the model away', () => {
    const next = renameSoundModel(sound(), 'shotgun|MKH 416', '')
    expect(next.plans[0].mics[0].model).toBeUndefined()
    expect(soundAutoLines(next)[0].key).toBe('shotgun|')
  })

  it('light: the lights of that type, power and model on every map get the new model', () => {
    const map = (id: string, items: LightMap['items']): LightMap => ({ id, name: id, scene: '', width: 6, height: 4, items, notes: '', includeInPdf: true })
    const f = (w: number) => ({ ...newItem('fresnel', 1, 1), watts: w })
    const maps = [map('a', [f(2000), f(2000), f(650)]), map('b', [f(2000)])]
    const lighting = emptyLighting()
    lighting.equipState['fresnel|2000'] = { rental: 'Locadora Y', out: false, back: false, notes: 'com bandeiras' }
    const r = renameLightModel(maps, lighting, 'fresnel|2000', 'Arri 2K')
    expect(r.maps.flatMap((m) => m.items.map((i) => [i.watts, i.model ?? '']))).toEqual([
      [2000, 'Arri 2K'],
      [2000, 'Arri 2K'],
      [650, ''],
      [2000, 'Arri 2K']
    ])
    expect(r.lighting.equipState['fresnel|2000|Arri 2K']?.notes).toBe('com bandeiras')
    expect(lightAutoLines(r.maps).map((l) => [l.name, l.base, l.model])).toEqual([
      ['Fresnel 2.000 W · Arri 2K', 'Fresnel 2.000 W', 'Arri 2K'],
      ['Fresnel 650 W', 'Fresnel 650 W', '']
    ])
    // a map that does not change stays the same object
    expect(renameLightModel([maps[0]], lighting, 'hmi|1800', 'x').maps[0]).toBe(maps[0])
  })
})
