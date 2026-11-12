import type { Block, BreakdownCategory, BreakdownItem, Paper, Production, Script, ShootDay } from './types'
import type { Report } from './reports'
import type { ReportSection } from './reportHtml'
import { PAPER, paginate, type Pagination } from './paginate'
import { parseHeading } from './smarttype'
import { sceneNumbers } from './scenes'
import { newId } from './structures'

/** The breakdown categories, in the order a breakdown sheet lists them. */
export const CATEGORIES: { id: BreakdownCategory; label: string }[] = [
  { id: 'extras', label: 'Figuração' },
  { id: 'stunts', label: 'Dublês' },
  { id: 'props', label: 'Objetos de cena' },
  { id: 'wardrobe', label: 'Figurino' },
  { id: 'makeup', label: 'Maquiagem e cabelo' },
  { id: 'vehicles', label: 'Veículos' },
  { id: 'animals', label: 'Animais' },
  { id: 'sfx', label: 'Efeitos especiais' },
  { id: 'vfx', label: 'Efeitos visuais' },
  { id: 'set', label: 'Cenografia' },
  { id: 'sound', label: 'Som e música' },
  { id: 'equipment', label: 'Equipamento especial' }
]
const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as string[]
export const categoryLabel = (c: BreakdownCategory): string => CATEGORIES.find((x) => x.id === c)?.label ?? c

export const ITEM_MAX = 120
export const DAY_LABEL_MAX = 80
export const DAY_NOTES_MAX = 2000

export function emptyProduction(): Production {
  return { items: [], days: [] }
}

export function intExt(intro: string): string {
  const v = intro.toUpperCase()
  if (v.includes('/')) return 'INT./EXT.'
  if (v.startsWith('INT') || v === 'I') return 'INT.'
  if (v.startsWith('EXT')) return 'EXT.'
  return v || '—'
}

const isNight = (time: string): boolean => /NOITE|NIGHT|MADRUGADA/i.test(time)
const castName = (t: string): string => t.trim().toUpperCase().replace(/\s*\(.*\)\s*$/, '')

export interface SceneInfo {
  /** Position among the scenes, 0-based. */
  n: number
  /** Block index of the heading, and the index after the scene's last block. */
  index: number
  end: number
  /** The scene id (the heading's nid), or null while nothing refers to the scene yet. */
  id: string | null
  number: string
  heading: string
  intExt: string
  location: string
  time: string
  night: boolean
  /** Length in eighths of a page (at least 1). */
  eighths: number
  /** Page where the scene starts, 1-based. */
  page: number
  /** Who speaks in the scene, in order of first line. */
  cast: string[]
  /** The writer's one-line summary of the scene, or ''. */
  synopsis: string
}

export function sceneInfo(script: Pick<Script, 'blocks' | 'paper' | 'scenesLocked'>, pag?: Pagination): SceneInfo[] {
  const blocks = script.blocks
  const paper: Paper = script.paper ?? 'letter'
  const p = pag ?? paginate(blocks, paper)
  const numbers = sceneNumbers(blocks, script.scenesLocked === true)
  // where each block's first printed line sits, counting lines from the top of page 1
  const firstLine: number[] = new Array(blocks.length).fill(-1)
  let pos = 0
  for (const page of p.pages) {
    for (const line of page) {
      if (line.block >= 0 && firstLine[line.block] === -1) firstLine[line.block] = pos
      pos += line.sameRow ? 0 : 1
    }
  }
  const total = pos
  const lineAt = (blockIndex: number): number => {
    for (let i = blockIndex; i < blocks.length; i++) if (firstLine[i] !== -1) return firstLine[i]
    return total
  }
  const heads: number[] = []
  blocks.forEach((b, i) => {
    if (b.kind === 'scene_heading') heads.push(i)
  })
  return heads.map((index, n) => {
    const end = heads[n + 1] ?? blocks.length
    const h = parseHeading(blocks[index].text)
    const lines = Math.max(0, (end < blocks.length ? lineAt(end) : total) - lineAt(index))
    const cast: string[] = []
    for (let i = index + 1; i < end; i++) {
      const b = blocks[i]
      if (b.kind !== 'character' || !b.text.trim()) continue
      const name = castName(b.text)
      if (!cast.includes(name)) cast.push(name)
    }
    return {
      n,
      index,
      end,
      id: blocks[index].nid ?? null,
      number: numbers[index] ?? String(n + 1),
      heading: blocks[index].text.trim().toUpperCase(),
      intExt: intExt(h.intro),
      location: h.location.toUpperCase(),
      time: h.time.toUpperCase(),
      night: isNight(h.time),
      eighths: Math.max(1, Math.round((lines / PAPER[paper].lines) * 8)),
      page: (p.blockPage[index] ?? 0) + 1,
      cast,
      synopsis: blocks[index].syn?.trim() ?? ''
    }
  })
}

/** 11 -> "1 3/8", 8 -> "1", 3 -> "3/8": the way page counts are written on a stripboard. */
export function formatEighths(e: number): string {
  const whole = Math.floor(e / 8)
  const rest = e % 8
  if (rest === 0) return String(whole)
  return whole ? `${whole} ${rest}/8` : `${rest}/8`
}

// ---------------------------------------------------------------- reading and editing

const strId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64
const ids = (v: unknown, max: number): string[] => (Array.isArray(v) ? [...new Set(v.filter(strId))].slice(0, max) : [])

export function cleanProduction(raw: unknown): Production {
  const out = emptyProduction()
  if (!raw || typeof raw !== 'object') return out
  const r = raw as Record<string, unknown>
  if (Array.isArray(r.items)) {
    for (const it of r.items.slice(0, 5000)) {
      if (!it || typeof it !== 'object') continue
      const x = it as Record<string, unknown>
      const name = typeof x.name === 'string' ? x.name.trim().slice(0, ITEM_MAX) : ''
      if (!strId(x.id) || !name || !CATEGORY_IDS.includes(x.category as string)) continue
      out.items.push({ id: x.id, category: x.category as BreakdownCategory, name, scenes: ids(x.scenes, 5000) })
    }
  }
  if (Array.isArray(r.days)) {
    const seen = new Set<string>()
    for (const d of r.days.slice(0, 1000)) {
      if (!d || typeof d !== 'object') continue
      const x = d as Record<string, unknown>
      if (!strId(x.id)) continue
      // a scene is shot on one day only
      const scenes = ids(x.scenes, 5000).filter((s) => !seen.has(s))
      scenes.forEach((s) => seen.add(s))
      const day: ShootDay = {
        id: x.id,
        label: typeof x.label === 'string' ? x.label.slice(0, DAY_LABEL_MAX) : '',
        notes: typeof x.notes === 'string' ? x.notes.slice(0, DAY_NOTES_MAX) : '',
        scenes
      }
      if (x.times && typeof x.times === 'object') {
        const times: Record<string, string> = {}
        for (const [id, t] of Object.entries(x.times as Record<string, unknown>)) if (scenes.includes(id) && isTime(t)) times[id] = t
        if (Object.keys(times).length) day.times = times
      }
      out.days.push(day)
    }
  }
  return out
}

const same = (a: string, b: string): boolean => a.trim().toLocaleLowerCase('pt-BR') === b.trim().toLocaleLowerCase('pt-BR')

/** Adds an element to a scene. An element with the same name in the same category is reused. */
export function addItem(p: Production, scene: string, category: BreakdownCategory, name: string): Production {
  const clean = name.trim().slice(0, ITEM_MAX)
  if (!clean) return p
  const found = p.items.find((i) => i.category === category && same(i.name, clean))
  if (found) {
    if (found.scenes.includes(scene)) return p
    return { ...p, items: p.items.map((i) => (i === found ? { ...i, scenes: [...i.scenes, scene] } : i)) }
  }
  return { ...p, items: [...p.items, { id: newId('item'), category, name: clean, scenes: [scene] }] }
}

/** Takes an element out of a scene; an element left in no scene is forgotten. */
export function removeItem(p: Production, itemId: string, scene: string): Production {
  const items: BreakdownItem[] = []
  for (const i of p.items) {
    if (i.id !== itemId) items.push(i)
    else if (i.scenes.length > 1) items.push({ ...i, scenes: i.scenes.filter((s) => s !== scene) })
  }
  return { ...p, items }
}

export function itemsOfScene(p: Production, scene: string): BreakdownItem[] {
  return p.items.filter((i) => i.scenes.includes(scene))
}

export function addDay(p: Production): Production {
  return { ...p, days: [...p.days, { id: newId('day'), label: '', notes: '', scenes: [] }] }
}

/** Deleting a day sends its scenes back to the unscheduled list. */
export function removeDay(p: Production, dayId: string): Production {
  return { ...p, days: p.days.filter((d) => d.id !== dayId) }
}

export function updateDay(p: Production, dayId: string, patch: Partial<Pick<ShootDay, 'label' | 'notes'>>): Production {
  return { ...p, days: p.days.map((d) => (d.id === dayId ? { ...d, ...patch } : d)) }
}

export function moveDay(p: Production, dayId: string, dir: 1 | -1): Production {
  const i = p.days.findIndex((d) => d.id === dayId)
  const j = i + dir
  if (i < 0 || j < 0 || j >= p.days.length) return p
  const days = [...p.days]
  ;[days[i], days[j]] = [days[j], days[i]]
  return { ...p, days }
}

/** A shooting time as the time field gives it: "08:30". */
export const isTime = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)

/** When a scene is shot on its day, or ''. */
export const sceneTime = (day: ShootDay, scene: string): string => day.times?.[scene] ?? ''

/** Sets (or, with '', clears) the time a scene is shot on its day. */
export function setSceneTime(p: Production, dayId: string, scene: string, time: string): Production {
  return {
    ...p,
    days: p.days.map((d) => {
      if (d.id !== dayId || !d.scenes.includes(scene)) return d
      const times = { ...(d.times ?? {}) }
      if (isTime(time)) times[scene] = time
      else delete times[scene]
      const next: ShootDay = { ...d, times }
      if (Object.keys(times).length === 0) delete next.times
      return next
    })
  }
}

function withoutTime(d: ShootDay, scene: string): ShootDay {
  if (!d.times || !(scene in d.times)) return d
  const times = { ...d.times }
  delete times[scene]
  const next: ShootDay = { ...d, times }
  if (Object.keys(times).length === 0) delete next.times
  return next
}

/**
 * Puts a scene on a day (null = no day), at `at` in that day's order (default: last).
 * A scene is on one day at most, so it leaves the day it was on; its time belongs to that day and stays behind,
 * unless it only moves inside the same day.
 */
export function scheduleScene(p: Production, scene: string, dayId: string | null, at?: number): Production {
  const days = p.days.map((d) => {
    if (!d.scenes.includes(scene)) return d
    const left = { ...d, scenes: d.scenes.filter((s) => s !== scene) }
    return d.id === dayId ? left : withoutTime(left, scene)
  })
  if (dayId === null) return { ...p, days }
  return {
    ...p,
    days: days.map((d) => {
      if (d.id !== dayId) return d
      const scenes = [...d.scenes]
      scenes.splice(at === undefined ? scenes.length : Math.max(0, Math.min(at, scenes.length)), 0, scene)
      return { ...d, scenes }
    })
  }
}

export const dayLabel = (d: ShootDay, n: number): string => d.label.trim() || `Dia ${n + 1}`

/** The location a scene is shot at, as the plan groups it. */
export const locationKey = (s: SceneInfo): string => s.location.trim() || 'SEM LOCAL'

/**
 * One shooting day per location for the scenes that have no day yet; days already planned are not touched.
 * A location that already has a day named after it (made here before) gets its new scenes on that day.
 * Inside a day: day scenes before night scenes, then script order. Days come in the order the locations first appear.
 * `ids` gives each scene its id (the heading's anchor); scenes it cannot give one to are left out.
 */
export function scheduleByLocation(
  scenes: SceneInfo[],
  p: Production,
  ids: (s: SceneInfo[]) => (string | null)[]
): { production: Production; days: number; scenes: number } {
  const loose = unscheduled(scenes, p)
  if (loose.length === 0) return { production: p, days: 0, scenes: 0 }
  const anchors = ids(loose)
  const groups = new Map<string, { scene: SceneInfo; id: string }[]>()
  loose.forEach((s, i) => {
    const id = anchors[i]
    if (!id) return
    const key = locationKey(s)
    const list = groups.get(key) ?? []
    list.push({ scene: s, id })
    groups.set(key, list)
  })
  let out = p
  let made = 0
  let placed = 0
  for (const [location, list] of groups) {
    list.sort((a, b) => Number(a.scene.night) - Number(b.scene.night) || a.scene.n - b.scene.n)
    let day = out.days.find((d) => d.label.trim().toUpperCase() === location)
    if (!day) {
      day = { id: newId('day'), label: location, notes: '', scenes: [] }
      out = { ...out, days: [...out.days, day] }
      made++
    }
    const dayId = day.id
    for (const { id } of list) {
      out = scheduleScene(out, id, dayId)
      placed++
    }
  }
  return { production: out, days: made, scenes: placed }
}

/** Splits a day in two before this scene: it and the scenes after it go to a new day right after. */
export function splitDay(p: Production, dayId: string, sceneId: string): Production {
  const i = p.days.findIndex((d) => d.id === dayId)
  const day = p.days[i]
  const at = day ? day.scenes.indexOf(sceneId) : -1
  if (!day || at <= 0) return p
  const label = day.label.trim()
  const moved = day.scenes.slice(at)
  const rest: ShootDay = { id: newId('day'), label: label ? `${label} · parte 2` : '', notes: '', scenes: moved }
  let first: ShootDay = { ...day, scenes: day.scenes.slice(0, at) }
  // the times go with their scenes
  if (day.times) {
    const mine = Object.entries(day.times).filter(([id]) => moved.includes(id))
    if (mine.length) rest.times = Object.fromEntries(mine)
    for (const [id] of mine) first = withoutTime(first, id)
  }
  const days = [...p.days]
  days.splice(i, 1, first, rest)
  return { ...p, days }
}

// ---------------------------------------------------------------- reports

function elementsText(p: Production, scene: string | null): string {
  if (!scene) return ''
  const mine = itemsOfScene(p, scene)
  return CATEGORIES.map((c) => {
    const names = mine.filter((i) => i.category === c.id).map((i) => i.name)
    return names.length ? `${c.label}: ${names.join(', ')}` : ''
  })
    .filter(Boolean)
    .join('; ')
}

/** One row per scene: its length, cast and one column per category in use. */
export function breakdownReport(scenes: SceneInfo[], p: Production): Report {
  const used = CATEGORIES.filter((c) => p.items.some((i) => i.category === c.id && i.scenes.length > 0))
  return {
    id: 'decupagem',
    title: 'Decupagem por cena',
    columns: ['Nº', 'Cabeçalho', 'Págs.', 'Elenco', ...used.map((c) => c.label)],
    rows: scenes.map((s) => {
      const mine = s.id ? itemsOfScene(p, s.id) : []
      return [
        s.number,
        s.heading || '—',
        formatEighths(s.eighths),
        s.cast.join(', ') || '—',
        ...used.map((c) => mine.filter((i) => i.category === c.id).map((i) => i.name).join(', ') || '—')
      ]
    })
  }
}

/** One row per element, with the scenes it appears in. */
export function elementsReport(scenes: SceneInfo[], p: Production): Report {
  const numberOf = new Map(scenes.filter((s) => s.id).map((s) => [s.id as string, s.number]))
  const order = new Map(scenes.filter((s) => s.id).map((s) => [s.id as string, s.n]))
  const rows: (string | number)[][] = []
  for (const c of CATEGORIES) {
    const items = p.items
      .filter((i) => i.category === c.id)
      .map((i) => ({ i, live: i.scenes.filter((s) => numberOf.has(s)).sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0)) }))
      .filter((x) => x.live.length > 0)
      .sort((a, b) => a.i.name.localeCompare(b.i.name, 'pt-BR'))
    for (const { i, live } of items) rows.push([c.label, i.name, live.map((s) => numberOf.get(s)).join(', '), live.length])
  }
  return { id: 'elementos-producao', title: 'Elementos de produção', columns: ['Categoria', 'Elemento', 'Cenas', 'Nº de cenas'], rows }
}

const PLAN_COLUMNS = ['Horário', 'Cena', 'INT/EXT', 'Local', 'Sinopse', 'D/N', 'Págs.', 'Elenco', 'Elementos']

function planRow(s: SceneInfo, p: Production, time = ''): (string | number)[] {
  return [time || '—', s.number, s.intExt, s.location || '—', s.synopsis || '—', s.night ? 'N' : 'D', formatEighths(s.eighths), s.cast.join(', ') || '—', elementsText(p, s.id) || '—']
}

/** The total line of a day, in the plan's columns. */
function totalRow(list: SceneInfo[]): (string | number)[] {
  const e = list.reduce((t, s) => t + s.eighths, 0)
  return ['', 'Total', '', `${list.length} ${list.length === 1 ? 'cena' : 'cenas'}`, '', '', e ? formatEighths(e) : '0', '', '']
}

/** Resolves a day's scene ids to the scenes still in the script, in the day's order. */
export function dayScenes(day: ShootDay, scenes: SceneInfo[]): SceneInfo[] {
  const byId = new Map(scenes.filter((s) => s.id).map((s) => [s.id as string, s]))
  return day.scenes.map((id) => byId.get(id)).filter((s): s is SceneInfo => s !== undefined)
}

/** Scenes on no day, in script order. */
export function unscheduled(scenes: SceneInfo[], p: Production): SceneInfo[] {
  const on = new Set(p.days.flatMap((d) => d.scenes))
  return scenes.filter((s) => !s.id || !on.has(s.id))
}

/** What a day adds up to, for the heading of its group in the PDF: "2 cenas · 4/8 pág.". */
function daySummary(list: SceneInfo[]): string {
  const e = list.reduce((t, s) => t + s.eighths, 0)
  return `${list.length} ${list.length === 1 ? 'cena' : 'cenas'} · ${e ? formatEighths(e) : '0'} pág.`
}

/** One day as a group of the printed plan: its name, its count, its notes, and its scenes at their times. */
function daySection(d: ShootDay, n: number, scenes: SceneInfo[], p: Production, title = dayLabel(d, n)): ReportSection {
  const list = dayScenes(d, scenes)
  return { title, summary: daySummary(list), note: d.notes.trim() || undefined, rows: list.map((s) => planRow(s, p, sceneTime(d, s.id as string))) }
}

/**
 * The whole plan: every day with its scenes and a total, then the scenes with no day.
 * The PDF prints it day by day, each under a heading of its own; the CSV keeps one flat table with the day on each line.
 */
export function scheduleReport(scenes: SceneInfo[], p: Production): Report {
  const rows: (string | number)[][] = []
  p.days.forEach((d, n) => {
    const list = dayScenes(d, scenes)
    for (const s of list) rows.push([dayLabel(d, n), ...planRow(s, p, sceneTime(d, s.id as string))])
    rows.push([dayLabel(d, n), ...totalRow(list)])
  })
  const pool = unscheduled(scenes, p)
  for (const s of pool) rows.push(['Sem dia', ...planRow(s, p)])
  const sections = p.days.map((d, n) => daySection(d, n, scenes, p))
  if (pool.length) sections.push({ title: 'Sem dia marcado', summary: daySummary(pool), rows: pool.map((s) => planRow(s, p)) })
  return { id: 'plano', title: 'Plano de filmagem', columns: ['Dia', ...PLAN_COLUMNS], rows, printed: { columns: PLAN_COLUMNS, sections } }
}

/** The call sheet's scene list for one day. */
export function dayReport(day: ShootDay, n: number, scenes: SceneInfo[], p: Production): Report {
  const list = dayScenes(day, scenes)
  const rows = list.map((s) => planRow(s, p, sceneTime(day, s.id as string)))
  rows.push(totalRow(list))
  if (day.notes.trim()) rows.push(['', 'Notas', '', day.notes.trim(), '', '', '', '', ''])
  return {
    id: `dia-${day.id}`,
    title: `Ordem do dia · ${dayLabel(day, n)}`,
    columns: PLAN_COLUMNS,
    rows,
    printed: { columns: PLAN_COLUMNS, sections: [daySection(day, n, scenes, p, 'Cenas do dia')] }
  }
}

export type { Block }
