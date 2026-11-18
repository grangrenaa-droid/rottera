import { describe, expect, it } from 'vitest'
import { cleanPeople, emptyPerson, peopleReport, scheduleConflicts, whoPlays } from '../src/shared/people'
import { addDay, emptyProduction, sceneInfo, scheduleScene, updateDay } from '../src/shared/production'
import { parseScriptFile, serialize } from '../src/shared/scriptfile'
import type { Block, Script } from '../src/shared/types'

const blocks: Block[] = [
  { kind: 'scene_heading', text: 'INT. COZINHA - DIA', nid: 's1' },
  { kind: 'character', text: 'MARINA' },
  { kind: 'dialogue', text: 'Você veio.' },
  { kind: 'scene_heading', text: 'EXT. RUA - NOITE', nid: 's2' },
  { kind: 'character', text: 'DAVI (V.O.)' },
  { kind: 'dialogue', text: 'Vim.' }
]
const ana = { ...emptyPerson('cast'), id: 'p1', name: 'Ana Souza', character: 'MARINA', phone: '(81) 9999-0000', contract: 'signed' as const, unavailable: ['2026-11-21'] }

describe('the people of the film', () => {
  it('a person goes into the file and comes back as they were', () => {
    const s: Script = { titlePage: { title: '', author: '', contact: '' }, blocks, people: [ana] }
    expect(parseScriptFile(serialize(s)).people).toEqual([ana])
  })

  it('throws away what is not valid: bad dates, bad photo, unknown group or contract', () => {
    const [p] = cleanPeople([{ id: 'x', name: 'Rui', group: 'robôs', contract: 'talvez', unavailable: ['2026-02-30', '2026-11-21', 'amanhã'], photo: 'javascript:1' }, { name: 'sem id' }])!
    expect(p).toMatchObject({ id: 'x', name: 'Rui', group: 'crew', photo: '', unavailable: ['2026-11-21'] })
    expect(p.contract).toBeUndefined()
    expect(cleanPeople('x')).toBeUndefined()
  })

  it('who plays a character, whatever the extension after the name', () => {
    expect(whoPlays([ana], 'MARINA (CONT.)')?.name).toBe('Ana Souza')
    expect(whoPlays([ana], 'DAVI')).toBeUndefined()
  })

  it('warns when a scene with a character is shot on a day its actor cannot', () => {
    const scenes = sceneInfo({ blocks })
    let p = addDay(addDay(emptyProduction()))
    p = updateDay(p, p.days[0].id, { date: '2026-11-21' })
    p = updateDay(p, p.days[1].id, { date: '2026-11-22' })
    p = scheduleScene(p, 's1', p.days[0].id)
    p = scheduleScene(p, 's2', p.days[1].id)
    expect(scheduleConflicts([ana], p, scenes)).toEqual([{ dayId: p.days[0].id, text: 'Ana Souza (MARINA) não pode em 21/11/2026 · cena 1' }])
  })

  it('the list prints contacts, contract and the measurements for wardrobe', () => {
    const r = peopleReport([{ ...ana, height: '1,68 m', size: 'M', shoe: '37' }, { ...emptyPerson('crew'), id: 'p2', name: 'Rafa', role: 'Técnico de som' }])
    expect(r.columns).toEqual(['Nome', 'Grupo', 'Personagem ou função', 'Telefone', 'E-mail', 'Contrato', 'Altura', 'Manequim', 'Calçado'])
    expect(r.rows).toEqual([
      ['Ana Souza', 'Elenco', 'MARINA', '(81) 9999-0000', '—', 'Assinado', '1,68 m', 'M', '37'],
      ['Rafa', 'Equipe', 'Técnico de som', '—', '—', '—', '—', '—', '—']
    ])
  })
})
