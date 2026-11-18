import { describe, expect, it } from 'vitest'
import { cleanLocations, emptyLocation, locationsReport, setLocation } from '../src/shared/locations'
import { sceneInfo } from '../src/shared/production'
import { parseScriptFile, serialize } from '../src/shared/scriptfile'
import type { Block, Script } from '../src/shared/types'

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const blocks: Block[] = [
  { kind: 'scene_heading', text: 'INT. COZINHA - DIA', nid: 's1' },
  { kind: 'action', text: 'Café.' },
  { kind: 'scene_heading', text: 'EXT. RUA - NOITE', nid: 's2' },
  { kind: 'scene_heading', text: 'INT. COZINHA - NOITE', nid: 's3' }
]

describe('locations', () => {
  it('a location sheet goes into the file and comes back as it was', () => {
    let l = setLocation({}, 'COZINHA', { address: 'Rua das Flores, 12', permit: 'granted', cost: 'R$ 800 por dia' })
    l = setLocation(l, 'COZINHA', { photos: [{ id: 'p1', image: PNG, caption: 'Vista da janela' }] })
    const s: Script = { titlePage: { title: '', author: '', contact: '' }, blocks, locations: l }
    expect(parseScriptFile(serialize(s)).locations).toEqual(l)
    expect(l.COZINHA).toMatchObject({ address: 'Rua das Flores, 12', permit: 'granted' })
  })

  it('throws away what is not valid: bad photos, bad permit, empty names', () => {
    const l = cleanLocations({
      COZINHA: { address: 'x'.repeat(5000), permit: 'talvez', photos: [{ id: 'a', image: 'javascript:alert(1)' }, { id: 'b', image: PNG }, 'x'] },
      '': { address: 'nada' },
      RUA: 'texto'
    })!
    expect(Object.keys(l)).toEqual(['COZINHA'])
    expect(l.COZINHA.address.length).toBeLessThanOrEqual(200)
    expect(l.COZINHA.permit).toBeUndefined()
    expect(l.COZINHA.photos.map((p) => p.id)).toEqual(['b'])
    expect(cleanLocations('x')).toBeUndefined()
  })

  it('the list of locations prints with the scenes shot in each one', () => {
    const l = setLocation({}, 'COZINHA', { address: 'Rua das Flores, 12', contact: 'Dona Ana', phone: '(81) 9999-0000', permit: 'pending' })
    const r = locationsReport(sceneInfo({ blocks }), l)
    expect(r.columns).toEqual(['Locação', 'Cenas', 'Endereço', 'Responsável', 'Telefone', 'Autorização', 'Custo'])
    expect(r.rows).toEqual([
      ['COZINHA', '1, 3', 'Rua das Flores, 12', 'Dona Ana', '(81) 9999-0000', 'Pendente', '—'],
      ['RUA', '2', '—', '—', '—', '—', '—']
    ])
  })

  it('an empty sheet is not kept', () => {
    expect(setLocation(setLocation({}, 'RUA', { notes: 'x' }), 'RUA', { notes: '' })).toEqual({})
    expect(emptyLocation().photos).toEqual([])
  })
})
