import type { Lighting, LightSheet, Place, Production, ShootDay } from './types'
import type { SceneInfo } from './production'
import { dayLabel } from './production'
import type { Report } from './reports'
import type { ReportSection } from './reportHtml'
import { shortDate, sunTimes, sunWarning, type SunTimes } from './sun'
import { cleanPlace } from './sun'
import { cleanEquipItem, cleanEquipState } from './sound'

export { cleanPlace, longDate, shortDate } from './sun'

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

const QUALITY = { hard: 'Dura', soft: 'Suave' }
const CONTRAST = { high: 'Alto', low: 'Baixo' }

/** The lines of a scene's light sheet, in the sheet's order, without the empty ones. */
export function lightSheetRows(sheet: LightSheet | undefined): [string, string][] {
  const s = sheet ?? emptyLightSheet()
  const rows: [string, string][] = []
  const add = (k: string, v: string): void => {
    if (v.trim()) rows.push([k, v.trim()])
  }
  add('Luz', s.quality ? QUALITY[s.quality] : '')
  add('Contraste', s.contrast ? CONTRAST[s.contrast] : '')
  add('Cor', s.color)
  add('De onde vem a luz', [...s.sources, s.otherSource.trim()].filter(Boolean).join(', '))
  add('Horário e continuidade', s.story)
  add('Efeitos', [...s.effects, s.otherEffect.trim()].filter(Boolean).join(', '))
  add('Energia e gerador', s.power)
  add('Montagem', s.setupMinutes ? `${s.setupMinutes} min` : '')
  add('Observações', s.notes)
  return rows
}

/** "Exportar fichas (PDF)": a light sheet for each scene that has something on it. */
export function lightSheetsReport(scenes: SceneInfo[], lighting: Lighting): Report {
  const sections: ReportSection[] = []
  const flat: string[][] = []
  for (const sc of scenes) {
    if (!sc.id) continue
    const rows = lightSheetRows(lighting.sheets[sc.id])
    if (!rows.length) continue
    sections.push({ title: `Cena ${sc.number} · ${sc.heading}`, rows })
    for (const [k, v] of rows) flat.push([sc.number, k, v])
  }
  return { id: 'fichas-luz', title: 'Fichas de luz', columns: ['Cena', 'Item', 'Anotação'], rows: flat, printed: { columns: ['Item', 'Anotação'], sections } }
}

/** Whether the light of a scene comes from the sun, even indoors (its sheet says Sol or Janela). */
export const daylightOf = (lighting: Lighting, sceneId: string | null): boolean =>
  !!sceneId && (lighting.sheets[sceneId]?.sources ?? []).some((s) => DAYLIGHT_SOURCES.includes(s))

/** Where a day is shot (its own place, or the film's) and its sun; null sun without a date or a place. */
export function daySun(day: ShootDay, lighting: Lighting): { place: Place | undefined; sun: SunTimes | null } {
  const place = day.place ?? lighting.place
  return { place, sun: day.date && place ? sunTimes(day.date, place) : null }
}

/** The scenes of a day whose light does not fit the time they are shot at. */
export function dayWarnings(day: ShootDay, scenes: SceneInfo[], lighting: Lighting): { scene: SceneInfo; at: string; text: string }[] {
  const { sun } = daySun(day, lighting)
  if (!sun) return []
  const out: { scene: SceneInfo; at: string; text: string }[] = []
  for (const id of day.scenes) {
    const at = day.times?.[id]
    const scene = scenes.find((s) => s.id === id)
    if (!at || !scene) continue
    const text = sunWarning(scene, at, sun, daylightOf(lighting, id))
    if (text) out.push({ scene, at, text })
  }
  return out
}

const span = (r: [string, string]): string => (r[0] && r[1] ? `${r[0]}–${r[1]}` : '—')

/** The sun for the day sheet, on one line. */
export function daySunLine(sun: SunTimes): string {
  return [sun.sunrise ? `nasce ${sun.sunrise}` : '', sun.goldenEvening[0] && sun.goldenEvening[1] ? `golden hour ${span(sun.goldenEvening)}` : '', sun.sunset ? `se põe ${sun.sunset}` : '']
    .filter(Boolean)
    .join(' · ')
}

export const SUN_COLUMNS = ['Dia', 'Data', 'Lugar', 'Blue hour (manhã)', 'Nascer do sol', 'Golden hour (manhã)', 'Golden hour (tarde)', 'Pôr do sol', 'Blue hour (tarde)']

/** Sol e horários as a PDF: the sun of each shooting day, then the scenes whose light does not fit. */
export function sunReport(scenes: SceneInfo[], lighting: Lighting, production: Production): Report {
  const days: (string | number)[][] = []
  const warnings: (string | number)[][] = []
  production.days.forEach((d, n) => {
    const { place, sun } = daySun(d, lighting)
    days.push([
      dayLabel(d, n),
      d.date ? shortDate(d.date) : '—',
      place ? place.name || `${place.lat}, ${place.lon}` : '—',
      sun ? span(sun.blueMorning) : '—',
      sun?.sunrise || '—',
      sun ? span(sun.goldenMorning) : '—',
      sun ? span(sun.goldenEvening) : '—',
      sun?.sunset || '—',
      sun ? span(sun.blueEvening) : '—'
    ])
    for (const w of dayWarnings(d, scenes, lighting)) warnings.push([dayLabel(d, n), `${w.scene.number} · ${w.scene.heading}`, w.at, w.text])
  })
  const tables = [
    { title: 'Sol por dia', columns: SUN_COLUMNS, rows: days },
    { title: 'Avisos', columns: ['Dia', 'Cena', 'Horário', 'Aviso'], rows: warnings }
  ]
  return { id: 'sol', title: 'Sol e horários', columns: SUN_COLUMNS, rows: days, printed: { columns: [], sections: [], tables } }
}
