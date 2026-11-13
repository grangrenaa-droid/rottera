import type { Ambience, Capture, EquipItem, EquipState, LightMap, Mic, MicType, Song, Sound, SoundPlan, SoundSheet } from './types'
import type { SceneInfo } from './production'
import type { Report } from './reports'
import type { ReportSection } from './reportHtml'
import { newId } from './structures'

/** The microphone types, as the palette and the sheets name them, with the reach each starts with. */
export const MIC_DEFS: Record<MicType, { label: string; group: 'Unidirecionais' | 'Outros'; range: number }> = {
  cardioid: { label: 'Cardioide', group: 'Unidirecionais', range: 1.5 },
  supercardioid: { label: 'Supercardioide', group: 'Unidirecionais', range: 2 },
  shotgun: { label: 'Shotgun', group: 'Unidirecionais', range: 3 },
  omni: { label: 'Omnidirecional', group: 'Outros', range: 1.2 },
  figure8: { label: 'Figura 8', group: 'Outros', range: 1.5 },
  lavalier: { label: 'Lapela', group: 'Outros', range: 0.5 },
  recorder: { label: 'Gravador', group: 'Outros', range: 0 }
}
export const MIC_TYPES = Object.keys(MIC_DEFS) as MicType[]

export const RISKS = ['Trânsito', 'Avião', 'Obra', 'Vento', 'Chuva', 'Eco', 'Gerador', 'Ar-condicionado', 'Geladeira']

export const CAPTURES: { id: Capture; label: string }[] = [
  { id: 'direct', label: 'Som direto' },
  { id: 'adr', label: 'Dublagem (ADR)' },
  { id: 'playback', label: 'Playback' },
  { id: 'mos', label: 'Sem som (MOS)' }
]

export const LABEL_MAX = 80
export const TEXT_MAX = 2000
const PLAN_MAX = 60

export function emptySound(): Sound {
  return { plans: [], sheets: {}, ambiences: [], music: [], equipment: [], equipState: {} }
}

export function emptySheet(): SoundSheet {
  return { voices: {}, risks: [], otherRisk: '', requests: '', roomTone: false, roomToneSeconds: 30, effects: '', playback: '', notes: '' }
}

export function newMic(type: MicType, x: number, y: number): Mic {
  const m: Mic = { id: newId('mic'), type, x, y, rotation: 0, label: '' }
  if (MIC_DEFS[type].range > 0) m.range = MIC_DEFS[type].range
  return m
}

// ---------------------------------------------------------------- reading the file

type Raw = Record<string, unknown>
const obj = (v: unknown): Raw | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : null)
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64
const text = (v: unknown, max = TEXT_MAX): string => (typeof v === 'string' ? v.slice(0, max) : '')
const num = (v: unknown, lo: number, hi: number): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : undefined
const list = <T>(v: unknown, max: number, each: (x: Raw) => T | null): T[] =>
  Array.isArray(v) ? v.slice(0, max).map((x) => (obj(x) ? each(obj(x) as Raw) : null)).filter((x): x is T => x !== null) : []

function cleanMic(x: Raw): Mic | null {
  if (!id(x.id) || !MIC_TYPES.includes(x.type as MicType)) return null
  const m: Mic = {
    id: x.id,
    type: x.type as MicType,
    x: num(x.x, 0, PLAN_MAX) ?? 0,
    y: num(x.y, 0, PLAN_MAX) ?? 0,
    rotation: Math.round(num(x.rotation, -360, 720) ?? 0),
    label: text(x.label, LABEL_MAX)
  }
  if (text(x.model, LABEL_MAX)) m.model = text(x.model, LABEL_MAX)
  const ch = num(x.channel, 1, 16)
  if (ch !== undefined) m.channel = Math.round(ch)
  if (x.wireless === true) m.wireless = true
  const h = num(x.height, 0, 20)
  if (h !== undefined) m.height = h
  const r = num(x.range, 0.1, 30)
  if (r !== undefined) m.range = r
  if (text(x.operator, LABEL_MAX)) m.operator = text(x.operator, LABEL_MAX)
  if (id(x.actorId)) m.actorId = x.actorId
  return m
}

function cleanPlan(x: Raw): SoundPlan | null {
  if (!id(x.id)) return null
  const p: SoundPlan = {
    id: x.id,
    scene: text(x.scene, 40),
    width: num(x.width, 1, PLAN_MAX) ?? 6,
    height: num(x.height, 1, PLAN_MAX) ?? 4,
    mics: list(x.mics, 300, cleanMic),
    notes: text(x.notes)
  }
  if (id(x.mapId)) p.mapId = x.mapId
  if (id(x.sid)) p.sid = x.sid
  return p
}

function cleanSheet(x: Raw): SoundSheet {
  const s = emptySheet()
  if (CAPTURES.some((c) => c.id === x.capture)) s.capture = x.capture as Capture
  const voices = obj(x.voices)
  if (voices) {
    for (const [name, how] of Object.entries(voices).slice(0, 200)) {
      if (name.length <= LABEL_MAX && (how === 'lapela' || how === 'vara' || how === 'ambos')) s.voices[name] = how
    }
  }
  s.risks = Array.isArray(x.risks) ? [...new Set(x.risks.filter((r): r is string => RISKS.includes(r as string)))] : []
  s.otherRisk = text(x.otherRisk)
  s.requests = text(x.requests)
  s.roomTone = x.roomTone === true
  s.roomToneSeconds = Math.round(num(x.roomToneSeconds, 5, 3600) ?? 30)
  s.effects = text(x.effects)
  s.playback = text(x.playback)
  s.notes = text(x.notes)
  return s
}

const cleanAmbience = (x: Raw): Ambience | null =>
  id(x.id)
    ? { id: x.id, location: text(x.location, 200), what: text(x.what, 400), duration: text(x.duration, 40), notes: text(x.notes), recorded: x.recorded === true }
    : null

const KINDS: Song['kind'][] = ['diegetic', 'score']
const RIGHTS: Song['rights'][] = ['licensed', 'pending', 'original', 'public']
const cleanSong = (x: Raw): Song | null =>
  id(x.id)
    ? {
        id: x.id,
        title: text(x.title, 200),
        author: text(x.author, 200),
        scenes: Array.isArray(x.scenes) ? [...new Set(x.scenes.filter(id))].slice(0, 2000) : [],
        kind: KINDS.includes(x.kind as Song['kind']) ? (x.kind as Song['kind']) : 'diegetic',
        duration: text(x.duration, 20),
        rights: RIGHTS.includes(x.rights as Song['rights']) ? (x.rights as Song['rights']) : 'pending',
        notes: text(x.notes)
      }
    : null

export const cleanEquipItem = (x: Raw): EquipItem | null =>
  id(x.id)
    ? { id: x.id, name: text(x.name, 200), qty: Math.round(num(x.qty, 0, 9999) ?? 1), rental: text(x.rental, 200), out: x.out === true, back: x.back === true, notes: text(x.notes) }
    : null

export function cleanEquipState(v: unknown): Record<string, EquipState> {
  const out: Record<string, EquipState> = {}
  const o = obj(v)
  if (!o) return out
  for (const [key, raw] of Object.entries(o).slice(0, 2000)) {
    const x = obj(raw)
    if (key.length > 400 || !x) continue
    out[key] = { rental: text(x.rental, 200), out: x.out === true, back: x.back === true, notes: text(x.notes) }
  }
  return out
}

/** The Som window's data as the file brings it; undefined when nothing in it is usable. */
export function cleanSound(raw: unknown): Sound | undefined {
  const r = obj(raw)
  if (!r) return undefined
  const s = emptySound()
  s.plans = list(r.plans, 1000, cleanPlan)
  const sheets = obj(r.sheets)
  if (sheets) for (const [sid, x] of Object.entries(sheets).slice(0, 5000)) if (id(sid) && obj(x)) s.sheets[sid] = cleanSheet(obj(x) as Raw)
  s.ambiences = list(r.ambiences, 2000, cleanAmbience)
  s.music = list(r.music, 2000, cleanSong)
  s.equipment = list(r.equipment, 2000, cleanEquipItem)
  s.equipState = cleanEquipState(r.equipState)
  const empty = !s.plans.length && !Object.keys(s.sheets).length && !s.ambiences.length && !s.music.length && !s.equipment.length && !Object.keys(s.equipState).length
  return empty ? undefined : s
}

// ---------------------------------------------------------------- plans and light maps

/**
 * Keeps the sound plans in step with the light maps, which they never change: a plan on a map takes the map's size
 * and scene; a plan whose map was deleted keeps its last size as a sound-only plan; no microphone is left outside.
 */
export function reconcileSound(sound: Sound, maps: LightMap[]): Sound {
  let changed = false
  const plans = sound.plans.map((p) => {
    const m = p.mapId ? maps.find((x) => x.id === p.mapId) : undefined
    let next: SoundPlan = p
    if (p.mapId && !m) {
      next = { ...p }
      delete next.mapId
    } else if (m && (p.width !== m.width || p.height !== m.height || p.sid !== m.sid || p.scene !== m.scene)) {
      next = { ...p, width: m.width, height: m.height, scene: m.scene }
      if (m.sid) next.sid = m.sid
      else delete next.sid
    }
    const inside = next.mics.every((x) => x.x <= next.width && x.y <= next.height)
    if (!inside) next = { ...next, mics: next.mics.map((x) => ({ ...x, x: Math.min(x.x, next.width), y: Math.min(x.y, next.height) })) }
    if (next !== p) changed = true
    return next
  })
  return changed ? { ...sound, plans } : sound
}

/** The sound plans of a scene (on its light maps, or of its own). */
export function plansOfScene(sound: Sound, maps: LightMap[], sceneId: string): SoundPlan[] {
  return sound.plans.filter((p) => {
    const m = p.mapId ? maps.find((x) => x.id === p.mapId) : undefined
    return (m ? m.sid : p.sid) === sceneId
  })
}

/** The microphones of a scene, each with the name of the actor a lavalier is clipped to ('' for none or gone). */
export function micsOfScene(sound: Sound, maps: LightMap[], sceneId: string): { mic: Mic; actor: string }[] {
  return plansOfScene(sound, maps, sceneId).flatMap((p) => {
    const m = p.mapId ? maps.find((x) => x.id === p.mapId) : undefined
    return p.mics.map((mic) => {
      const a = mic.actorId && m ? m.items.find((i) => i.id === mic.actorId && i.type === 'actor') : undefined
      return { mic, actor: a ? a.label : '' }
    })
  })
}

const VOICE_LABEL: Record<'lapela' | 'vara' | 'ambos', string> = { lapela: 'lapela', vara: 'vara', ambos: 'lapela e vara' }

/** A microphone as one line of a sheet: "Lapela 2 presa em Luísa (canal 2)", "Mic 1 (Shotgun · MKH 416, canal 1)". */
export function micLine(mic: Mic, actor: string): string {
  const type = MIC_DEFS[mic.type].label
  const name = mic.label.trim() || type
  const named = name.toLowerCase().startsWith(type.toLowerCase())
  const bits = [named ? '' : type, mic.model?.trim() ?? ''].filter(Boolean).join(' · ')
  const more = [bits, mic.channel ? `canal ${mic.channel}` : '', mic.wireless ? 'sem fio' : ''].filter(Boolean).join(', ')
  return `${name}${mic.type === 'lavalier' && actor ? ` presa em ${actor}` : ''}${more ? ` (${more})` : ''}`
}

/**
 * The lines of a scene's sheet, in the sheet's order, without the empty ones. Who speaks follows the scene's cast as
 * the script has it now: someone who no longer speaks in the scene is not printed.
 */
export function sheetRows(sheet: SoundSheet | undefined, mics: { mic: Mic; actor: string }[], cast: string[]): [string, string][] {
  const s = sheet ?? emptySheet()
  const rows: [string, string][] = []
  const add = (k: string, v: string): void => {
    if (v.trim()) rows.push([k, v.trim()])
  }
  add('Captação', CAPTURES.find((c) => c.id === s.capture)?.label ?? '')
  add('Quem fala', cast.filter((who) => s.voices[who]).map((who) => `${who}: ${VOICE_LABEL[s.voices[who]]}`).join('\n'))
  add('Microfones', mics.map((m) => micLine(m.mic, m.actor)).join('\n'))
  add('Riscos', [...s.risks, s.otherRisk.trim()].filter(Boolean).join(', '))
  add('O que pedir no set', s.requests)
  add('Room tone', s.roomTone ? `${s.roomToneSeconds} s` : '')
  add('Efeitos', s.effects)
  add('Playback', s.playback)
  add('Observações', s.notes)
  return rows
}

/** "Exportar fichas (PDF)": a sheet for each scene with something on it, the scene's microphones included. */
export function sheetsReport(scenes: SceneInfo[], sound: Sound, maps: LightMap[]): Report {
  const sections: ReportSection[] = []
  const flat: string[][] = []
  for (const sc of scenes) {
    if (!sc.id) continue
    const rows = sheetRows(sound.sheets[sc.id], micsOfScene(sound, maps, sc.id), sc.cast)
    if (!rows.length) continue
    sections.push({ title: `Cena ${sc.number} · ${sc.heading}`, rows })
    for (const [k, v] of rows) flat.push([sc.number, k, v])
  }
  return { id: 'fichas-som', title: 'Fichas de som', columns: ['Cena', 'Item', 'Anotação'], rows: flat, printed: { columns: ['Item', 'Anotação'], sections } }
}

const yesNo = (v: boolean): string => (v ? 'Sim' : 'Não')
const dash = (s: string): string => s.trim() || '—'

export const SONG_KIND: Record<Song['kind'], string> = { diegetic: 'Toca na cena', score: 'Trilha' }
export const SONG_RIGHTS: Record<Song['rights'], string> = { licensed: 'Licenciada', pending: 'Pendente', original: 'Original', public: 'Domínio público' }

/** What to record at each location besides the dialogue. */
export function ambiencesReport(sound: Sound): Report {
  return {
    id: 'ambientes',
    title: 'Ambientes e sons-guia',
    columns: ['Locação', 'O que gravar', 'Duração', 'Gravado', 'Observações'],
    rows: sound.ambiences.map((a) => [a.location, dash(a.what), dash(a.duration), yesNo(a.recorded), dash(a.notes)])
  }
}

/** The music list; a song's scenes are written by their numbers as they are now (a song follows its scenes). */
export function musicReport(scenes: SceneInfo[], sound: Sound): Report {
  const number = new Map(scenes.filter((s) => s.id).map((s) => [s.id as string, s]))
  return {
    id: 'musicas',
    title: 'Músicas',
    columns: ['Título', 'Autor', 'Cenas', 'Tipo', 'Duração', 'Direitos', 'Observações'],
    rows: sound.music.map((m) => {
      const at = m.scenes
        .map((id) => number.get(id))
        .filter((s): s is SceneInfo => !!s)
        .sort((a, b) => a.n - b.n)
        .map((s) => s.number)
      return [dash(m.title), dash(m.author), at.join(', ') || '—', SONG_KIND[m.kind], dash(m.duration), SONG_RIGHTS[m.rights], dash(m.notes)]
    })
  }
}
