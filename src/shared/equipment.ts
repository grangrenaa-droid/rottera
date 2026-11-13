import type { EquipItem, EquipState, Lighting, LightItem, LightItemType, LightMap, Mic, Sound } from './types'
import { ITEM_DEFS, ITEM_TYPES, electricLoad, hasModel, mapWatts, wattsOf } from './lightmap'
import type { Report } from './reports'
import { MIC_DEFS, cleanEquipItem } from './sound'

/**
 * A line of an equipment list that comes by itself from the drawings (the microphones on the sound plans, the
 * equipment on the light maps). Its name is `base` (the type, fixed) and `model`; the model is edited on the list and
 * changes on the drawings too (renameSoundModel, renameLightModel). The quantity is counted; what is written on the
 * line (rental, out, back, notes) is kept by `key`.
 */
export interface AutoLine {
  key: string
  name: string
  base: string
  model: string
  qty: number
}

/** Moves what was written on a line to its new key, when its model changed (the new key's own note wins). */
function moveState(state: Record<string, EquipState>, from: string, to: string): Record<string, EquipState> {
  if (from === to || !state[from]) return state
  const next = { ...state }
  if (!next[to]) next[to] = next[from]
  delete next[from]
  return next
}

/** The sound line `key` ("shotgun|MKH 416") gets a new model: every microphone of that type and model, on every plan. */
export function renameSoundModel(sound: Sound, key: string, model: string): Sound {
  const [type, old = ''] = key.split('|')
  const now = model.trim().slice(0, 80)
  const plans = sound.plans.map((p) => {
    if (!p.mics.some((m) => m.type === type && (m.model?.trim() ?? '') === old)) return p
    return {
      ...p,
      mics: p.mics.map((m) => {
        if (m.type !== type || (m.model?.trim() ?? '') !== old) return m
        const next: Mic = { ...m, model: now }
        if (!now) delete next.model
        return next
      })
    }
  })
  return { ...sound, plans, equipState: moveState(sound.equipState, key, `${type}|${now}`) }
}

/** The light line `key` ("fresnel|2000" or "fresnel|2000|Arri 2K") gets a new model, on every light map. */
export function renameLightModel(maps: LightMap[], lighting: Lighting, key: string, model: string): { maps: LightMap[]; lighting: Lighting } {
  const [type, watts, ...rest] = key.split('|')
  const old = rest.join('|')
  const now = model.trim().slice(0, 80)
  const hit = (it: LightItem): boolean => it.type === type && String(wattsOf(it)) === watts && (it.model?.trim() ?? '') === old
  const next = maps.map((m) => {
    if (!m.items.some(hit)) return m
    return {
      ...m,
      items: m.items.map((it) => {
        if (!hit(it)) return it
        const n: LightItem = { ...it, model: now }
        if (!now) delete n.model
        return n
      })
    }
  })
  const to = `${type}|${watts}${now ? `|${now}` : ''}`
  return { maps: next, lighting: { ...lighting, equipState: moveState(lighting.equipState, key, to) } }
}

/**
 * The microphones of the sound plans, by type and model ("shotgun|MKH 416"), in the order they first appear. The
 * quantity is the most of them used at once on one plan: the same microphones go from one set to the next.
 */
export function soundAutoLines(sound: Sound): AutoLine[] {
  const lines = new Map<string, AutoLine>()
  for (const p of sound.plans) {
    const here = new Map<string, number>()
    for (const m of p.mics) {
      const model = m.model?.trim() ?? ''
      const key = `${m.type}|${model}`
      here.set(key, (here.get(key) ?? 0) + 1)
      const base = MIC_DEFS[m.type].label
      if (!lines.has(key)) lines.set(key, { key, name: model ? `${base} · ${model}` : base, base, model, qty: 0 })
    }
    for (const [key, n] of here) {
      const line = lines.get(key) as AutoLine
      line.qty = Math.max(line.qty, n)
    }
  }
  return [...lines.values()]
}

/** A hand-typed equipment list as the file brings it. */
export function cleanEquipment(raw: unknown): EquipItem[] {
  if (!Array.isArray(raw)) return []
  return raw
    .slice(0, 2000)
    .map((x) => (x && typeof x === 'object' ? cleanEquipItem(x as Record<string, unknown>) : null))
    .filter((x): x is EquipItem => x !== null)
}

const yes = (v: boolean): string => (v ? 'Sim' : 'Não')
const dash = (s: string): string => s.trim() || '—'

/** The list to print or export: the lines from the drawings first, then the ones typed by hand. */
export function equipmentReport(
  title: string,
  auto: AutoLine[],
  items: EquipItem[],
  state: Record<string, EquipState>,
  id = 'equipamento'
): Report {
  const rows: (string | number)[][] = auto.map((l) => {
    const s = state[l.key]
    return [l.name, l.qty, dash(s?.rental ?? ''), yes(s?.out === true), yes(s?.back === true), dash(s?.notes ?? '')]
  })
  for (const i of items) rows.push([dash(i.name), i.qty, dash(i.rental), yes(i.out), yes(i.back), dash(i.notes)])
  return { id, title, columns: ['Item', 'Qtd.', 'Locadora', 'Retirado', 'Devolvido', 'Observações'], rows }
}

/**
 * The equipment of the light maps (lights, cameras, modifiers, set and power), by type, power and model
 * ("fresnel|2000", "fresnel|650|Arri 650 Plus", "camera|0|Sony FX6"), in the order of the palette. The quantity is the
 * most of them on one map: the same equipment goes from one set to the next. Sun and moon without power are left out.
 */
export function lightAutoLines(maps: LightMap[]): AutoLine[] {
  const lines = new Map<string, AutoLine & { type: LightItemType; watts: number }>()
  const keyOf = (it: LightItem): string | null => {
    if (!hasModel(it.type)) return null
    const w = wattsOf(it)
    if (w === 0 && (it.type === 'sun' || it.type === 'moon')) return null
    const model = it.model?.trim() ?? ''
    return `${it.type}|${w}${model ? `|${model}` : ''}`
  }
  for (const m of maps) {
    const here = new Map<string, number>()
    for (const it of m.items) {
      const key = keyOf(it)
      if (!key) continue
      here.set(key, (here.get(key) ?? 0) + 1)
      if (!lines.has(key)) {
        const w = wattsOf(it)
        const model = it.model?.trim() ?? ''
        const base = `${ITEM_DEFS[it.type].name}${w > 0 ? ` ${w.toLocaleString('pt-BR')} W` : ''}`
        lines.set(key, { key, name: model ? `${base} · ${model}` : base, base, model, qty: 0, type: it.type, watts: w })
      }
    }
    for (const [key, n] of here) {
      const line = lines.get(key) as AutoLine
      line.qty = Math.max(line.qty, n)
    }
  }
  return [...lines.values()]
    .sort((a, b) => ITEM_TYPES.indexOf(a.type) - ITEM_TYPES.indexOf(b.type) || b.watts - a.watts)
    .map(({ key, name, base, model, qty }) => ({ key, name, base, model, qty }))
}

/** The load of the heaviest light map: what one set draws at once. */
export function heaviestLoad(maps: LightMap[]): { watts: number; a127: number; a220: number } {
  return electricLoad(maps.reduce((w, m) => Math.max(w, mapWatts(m)), 0))
}
