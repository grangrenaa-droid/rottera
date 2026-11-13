import type { EquipItem, EquipState, LightMap, Sound } from './types'
import { electricLoad, gearList, mapWatts, wattsOf } from './lightmap'
import type { Report } from './reports'
import { MIC_DEFS, cleanEquipItem } from './sound'

/**
 * A line of an equipment list that comes by itself from the drawings (the microphones on the sound plans; the lights
 * on the light maps, later). Its name and quantity are not edited; what is written on it is kept by `key`.
 */
export interface AutoLine {
  key: string
  name: string
  qty: number
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
      if (!lines.has(key)) lines.set(key, { key, name: model ? `${MIC_DEFS[m.type].label} · ${model}` : MIC_DEFS[m.type].label, qty: 0 })
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
 * The lights of the light maps, by type and power ("fresnel|2000"), in the order of the light palette. The quantity
 * is the most of them on one map: the same lights go from one set to the next.
 */
export function lightAutoLines(maps: LightMap[]): AutoLine[] {
  const lines = new Map<string, AutoLine>()
  for (const g of gearList(maps)) {
    const key = `${g.type}|${g.watts}`
    lines.set(key, { key, name: g.watts > 0 ? `${g.name} ${g.watts.toLocaleString('pt-BR')} W` : g.name, qty: 0 })
  }
  for (const m of maps) {
    const here = new Map<string, number>()
    for (const it of m.items) {
      const key = `${it.type}|${wattsOf(it)}`
      if (lines.has(key)) here.set(key, (here.get(key) ?? 0) + 1)
    }
    for (const [key, n] of here) {
      const line = lines.get(key) as AutoLine
      line.qty = Math.max(line.qty, n)
    }
  }
  return [...lines.values()]
}

/** The load of the heaviest light map: what one set draws at once. */
export function heaviestLoad(maps: LightMap[]): { watts: number; a127: number; a220: number } {
  return electricLoad(maps.reduce((w, m) => Math.max(w, mapWatts(m)), 0))
}
