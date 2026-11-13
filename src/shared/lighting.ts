import type { Lighting, LightSheet } from './types'
import { cleanPlace } from './sun'
import { cleanEquipItem, cleanEquipState } from './sound'

export { cleanPlace } from './sun'

/** Where the light of the story comes from, as the sheet lists it. */
export const LIGHT_SOURCES = ['Sol', 'Janela', 'Lua', 'Luz de teto', 'Abajur', 'TV ou tela', 'Fogo ou vela', 'Poste', 'Faróis', 'Letreiro ou neon']
export const LIGHT_EFFECTS = ['Pisca', 'Fogo', 'TV', 'Relâmpago', 'Giroflex', 'Faróis passando', 'Lanterna']
/** Sources that make an interior depend on the sun (Sol e horários warns about them as about exteriors). */
export const DAYLIGHT_SOURCES = ['Sol', 'Janela']

const SHORT = 200
const LONG = 2000

export function emptyLighting(): Lighting {
  return { sheets: {}, equipment: [], equipState: {} }
}

export function emptyLightSheet(): LightSheet {
  return { color: '', sources: [], otherSource: '', story: '', effects: [], otherEffect: '', power: '', notes: '' }
}

const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '')
const pick = (v: unknown, from: string[]): string[] => (Array.isArray(v) ? from.filter((x) => v.includes(x)) : [])

function cleanSheet(x: Record<string, unknown>): LightSheet {
  const s: LightSheet = {
    color: text(x.color, SHORT),
    sources: pick(x.sources, LIGHT_SOURCES),
    otherSource: text(x.otherSource, SHORT),
    story: text(x.story, LONG),
    effects: pick(x.effects, LIGHT_EFFECTS),
    otherEffect: text(x.otherEffect, SHORT),
    power: text(x.power, LONG),
    notes: text(x.notes, LONG)
  }
  if (x.quality === 'hard' || x.quality === 'soft') s.quality = x.quality
  if (x.contrast === 'high' || x.contrast === 'low') s.contrast = x.contrast
  if (typeof x.setupMinutes === 'number' && Number.isFinite(x.setupMinutes) && x.setupMinutes > 0) s.setupMinutes = Math.min(9999, Math.round(x.setupMinutes))
  return s
}

/** The Luz window's data as the file brings it; nothing when it is not there. */
export function cleanLighting(raw: unknown): Lighting | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const r = raw as Record<string, unknown>
  const l = emptyLighting()
  if (r.sheets && typeof r.sheets === 'object') {
    for (const [id, v] of Object.entries(r.sheets as Record<string, unknown>).slice(0, 5000)) {
      if (id && id.length <= 64 && v && typeof v === 'object') l.sheets[id] = cleanSheet(v as Record<string, unknown>)
    }
  }
  const place = cleanPlace(r.place)
  if (place) l.place = place
  if (Array.isArray(r.equipment)) {
    l.equipment = r.equipment
      .slice(0, 2000)
      .map((x) => (x && typeof x === 'object' ? cleanEquipItem(x as Record<string, unknown>) : null))
      .filter((x): x is NonNullable<typeof x> => x !== null)
  }
  l.equipState = cleanEquipState(r.equipState)
  return l
}
