import { describe, expect, it } from 'vitest'
import { cleanSound, emptySheet, emptySound, micsOfScene, newMic, plansOfScene, reconcileSound, sheetsReport, musicReport, ambiencesReport, soundLineOf, ambiencesToRecord } from '../src/shared/sound'
import { buildPdfHtml } from '../src/main/pdf'
import type { SceneInfo } from '../src/shared/production'
import { parseScriptFile, serialize } from '../src/shared/scriptfile'
import type { LightMap, Script, Sound } from '../src/shared/types'

const map = (over: Partial<LightMap> = {}): LightMap => ({
  id: 'lm1',
  name: 'Cabine',
  scene: '1',
  sid: 's1',
  width: 6,
  height: 4,
  items: [{ id: 'a1', type: 'actor', x: 2, y: 3, rotation: 0, label: 'Luísa' }],
  notes: '',
  includeInPdf: true,
  ...over
})

function sound(): Sound {
  const s = emptySound()
  s.plans.push({
    id: 'p1',
    mapId: 'lm1',
    sid: 's1',
    scene: '1',
    width: 6,
    height: 4,
    notes: '',
    mics: [
      { ...newMic('shotgun', 5, 3), id: 'm1', label: 'Mic 1', channel: 1, model: 'MKH 416' },
      { ...newMic('lavalier', 1, 1), id: 'm2', label: 'Lapela 2', channel: 2, actorId: 'a1' }
    ]
  })
  s.sheets.s1 = { ...emptySheet(), capture: 'direct', risks: ['Trânsito'] }
  s.ambiences.push({ id: 'amb1', location: 'CINE ESTRELA', what: 'Ruído do projetor', duration: '1 min', notes: '', recorded: false })
  s.music.push({ id: 'mu1', title: 'Valsa', author: 'Ana', scenes: ['s1'], kind: 'diegetic', duration: '02:30', rights: 'pending', notes: '' })
  s.equipment.push({ id: 'eq1', name: 'Fone', qty: 2, rental: 'Locadora X', out: false, back: false, notes: '' })
  s.equipState['shotgun|MKH 416'] = { rental: 'Locadora X', out: true, back: false, notes: '' }
  return s
}

describe('sound data in the file', () => {
  it('a valid sound comes back as it was', () => {
    const s = sound()
    expect(cleanSound(JSON.parse(JSON.stringify(s)))).toEqual(s)
  })

  it('nothing usable is no sound at all', () => {
    expect(cleanSound(undefined)).toBeUndefined()
    expect(cleanSound(42)).toBeUndefined()
    expect(cleanSound({ plans: 'x' })).toBeUndefined()
  })

  it('keeps what is valid and drops or bounds the rest', () => {
    const raw = JSON.parse(JSON.stringify(sound()))
    raw.plans[0].mics.push({ id: 'm3', type: 'laser', x: 1, y: 1, rotation: 0, label: 'x' })
    raw.plans[0].mics[0].channel = 99
    raw.plans[0].mics[0].label = 'x'.repeat(5000)
    raw.sheets.s1.notes = 'y'.repeat(50000)
    const c = cleanSound(raw)!
    expect(c.plans[0].mics.map((m) => m.id)).toEqual(['m1', 'm2'])
    expect(c.plans[0].mics[0].channel).toBe(16)
    expect(c.plans[0].mics[0].label.length).toBeLessThanOrEqual(80)
    expect(c.sheets.s1.notes.length).toBeLessThanOrEqual(2000)
  })

  it('travels in the .rottera file', () => {
    const script: Script = { titlePage: { title: '', author: '', contact: '' }, blocks: [{ kind: 'scene_heading', text: 'INT. CABINE - NOITE', nid: 's1' }], sound: sound() }
    expect(parseScriptFile(serialize(script)).sound).toEqual(sound())
  })
})

describe('sound plans follow the light maps without changing them', () => {
  it('a plan on a light map takes its size and scene', () => {
    const s = reconcileSound({ ...sound(), plans: [{ ...sound().plans[0], width: 1, height: 1, sid: undefined, scene: '' }] }, [map()])
    expect(s.plans[0]).toMatchObject({ mapId: 'lm1', width: 6, height: 4, sid: 's1', scene: '1' })
  })

  it('a deleted light map leaves a sound-only plan of the same size', () => {
    const s = reconcileSound(sound(), [])
    expect(s.plans[0].mapId).toBeUndefined()
    expect(s.plans[0]).toMatchObject({ width: 6, height: 4, sid: 's1' })
    expect(s.plans[0].mics).toHaveLength(2)
  })

  it('a smaller light map keeps every microphone inside the plan', () => {
    const s = reconcileSound(sound(), [map({ width: 3, height: 2 })])
    expect(s.plans[0].mics[0]).toMatchObject({ x: 3, y: 2 })
  })

  it('finds the plans and microphones of a scene, with the actor a lavalier is clipped to', () => {
    expect(plansOfScene(sound(), [map()], 's1').map((p) => p.id)).toEqual(['p1'])
    expect(micsOfScene(sound(), [map()], 's1').map((x) => [x.mic.id, x.actor])).toEqual([
      ['m1', ''],
      ['m2', 'Luísa']
    ])
    // the actor was deleted in the light map: the lavalier names no one
    expect(micsOfScene(sound(), [map({ items: [] })], 's1')[1].actor).toBe('')
  })
})

describe('the sound sheets as a report', () => {
  const scene = (over: Partial<SceneInfo>): SceneInfo => ({
    n: 0, index: 0, end: 1, id: 's1', number: '1', heading: 'INT. COZINHA - DIA', intExt: 'INT.', location: 'COZINHA', time: 'DIA',
    night: false, eighths: 8, page: 1, cast: [], synopsis: '', ...over
  })

  it('prints one sheet per scene that has one, with only the lines that were filled', () => {
    const s = emptySound()
    s.sheets.s1 = { ...emptySheet(), capture: 'direct', risks: ['Trânsito'], roomTone: true, roomToneSeconds: 30 }
    const r = sheetsReport([scene({}), scene({ n: 1, id: 's2', number: '2', heading: 'EXT. RUA - NOITE' })], s, [])
    expect(r.title).toBe('Fichas de som')
    expect(r.printed?.columns).toEqual(['Item', 'Anotação'])
    expect(r.printed?.sections).toHaveLength(1)
    expect(r.printed?.sections[0].title).toBe('Cena 1 · INT. COZINHA - DIA')
    expect(r.printed?.sections[0].rows).toEqual([
      ['Captação', 'Som direto'],
      ['Riscos', 'Trânsito'],
      ['Room tone', '30 s']
    ])
  })

  it('who speaks shows how each is miked, and the microphones of the scene come from the plan', () => {
    const s = sound()
    s.sheets.s1 = { ...emptySheet(), voices: { MARINA: 'lapela', DAVI: 'vara' } }
    const r = sheetsReport([scene({ cast: ['MARINA', 'DAVI'] })], s, [map()])
    const rows = r.printed?.sections[0].rows ?? []
    expect(rows[0]).toEqual(['Quem fala', 'MARINA: lapela\nDAVI: vara'])
    expect(rows[1][0]).toBe('Microfones')
    expect(rows[1][1]).toContain('Lapela 2 presa em Luísa')
  })
})

describe('ambiences and music as reports', () => {
  const scene = (id: string, number: string, n: number): SceneInfo => ({
    n, index: n * 10, end: n * 10 + 5, id, number, heading: 'INT. X - DIA', intExt: 'INT.', location: 'X', time: 'DIA',
    night: false, eighths: 8, page: 1, cast: [], synopsis: ''
  })

  it('a song names its scenes by their numbers now, after a scene moved', () => {
    const r = musicReport([scene('s2', '1', 0), scene('s1', '2', 1)], sound())
    expect(r.id).toBe('musicas')
    expect(r.columns).toEqual(['Título', 'Autor', 'Cenas', 'Tipo', 'Duração', 'Direitos', 'Observações'])
    expect(r.rows).toEqual([['Valsa', 'Ana', '2', 'Toca na cena', '02:30', 'Pendente', '—']])
  })

  it('lists what to record at each location', () => {
    const r = ambiencesReport(sound())
    expect(r.columns).toEqual(['Locação', 'O que gravar', 'Duração', 'Gravado', 'Observações'])
    expect(r.rows).toEqual([['CINE ESTRELA', 'Ruído do projetor', '1 min', 'Não', '—']])
  })
})

describe('sound on the day sheet', () => {
  it('one line per scene: capture, microphones, risks and room tone', () => {
    const s = sound()
    s.sheets.s1 = { ...emptySheet(), capture: 'direct', risks: ['Trânsito', 'Geladeira'], roomTone: true, roomToneSeconds: 30 }
    expect(soundLineOf(s, [map()], 's1')).toBe('Som direto · Mic 1 (Shotgun, canal 1), Lapela 2 em Luísa (canal 2) · Riscos: Trânsito, Geladeira · Room tone 30 s')
  })

  it('nothing written and no microphones: no line', () => {
    expect(soundLineOf(emptySound(), [map()], 's1')).toBe('')
  })

  it('the ambiences still to record at the locations of the day', () => {
    const s = emptySound()
    const amb = (location: string, what: string, recorded = false) => ({ id: what, location, what, duration: '', notes: '', recorded })
    s.ambiences.push(
      amb('CINE ESTRELA - CABINE', 'ruído do projetor'),
      amb('CINE ESTRELA - SALA', 'plateia vazia'),
      amb('CINE ESTRELA - SALA', 'ar-condicionado', true),
      amb('RUA', 'chuva')
    )
    expect(ambiencesToRecord(s, ['CINE ESTRELA - CABINE', 'CINE ESTRELA - SALA'])).toBe('CINE ESTRELA - CABINE: ruído do projetor; CINE ESTRELA - SALA: plateia vazia')
  })
})

describe('the sound plans in the PDF', () => {
  it('one page per plan, with the light map faint below and the microphones in a table', () => {
    const script: Script = { titlePage: { title: 'Chuva', author: '', contact: '' }, blocks: [], lightMaps: [map()], sound: sound() }
    script.sound!.plans.push({ id: 'p2', sid: 's9', scene: '9', width: 4, height: 3, notes: '', mics: [] })
    const html = buildPdfHtml(script, { soundOnly: true })
    expect(html.match(/class="page lm snd"/g)).toHaveLength(2)
    expect(html).toContain('PLANTA DE SOM')
    expect(html).toContain('Shotgun')
    expect(html).toContain('MKH 416')
    expect(html).not.toContain('MAPA DE LUZ')
  })
})
