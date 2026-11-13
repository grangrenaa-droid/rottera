import { describe, expect, it } from 'vitest'
import { cleanEquipment, equipmentReport, soundAutoLines } from '../src/shared/equipment'
import { emptySound, newMic } from '../src/shared/sound'
import type { Sound } from '../src/shared/types'

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
      { key: 'shotgun|MKH 416', name: 'Shotgun · MKH 416', qty: 2 },
      { key: 'lavalier|', name: 'Lapela', qty: 2 }
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
