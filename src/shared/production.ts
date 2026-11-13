import type { Block, BreakdownCategory, BreakdownItem, Frame, Paper, Production, Script, ShootDay } from './types'
import { shotText } from './storyboard'
import type { Report } from './reports'
import type { CallSheet, ReportSection } from './reportHtml'
import { PAPER, paginate, type Pagination } from './paginate'
import { parseHeading } from './smarttype'
import { sceneNumbers } from './scenes'
import { newId } from './structures'
import { cleanPlace, isDate, longDate } from './sun'

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
    const raw: ShootDay[] = []
    for (const d of r.days.slice(0, 1000)) {
      if (!d || typeof d !== 'object') continue
      const x = d as Record<string, unknown>
      if (!strId(x.id)) continue
      const scenes = ids(x.scenes, 5000)
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
      if (x.shots && typeof x.shots === 'object') {
        const shots: Record<string, string[]> = {}
        for (const [id, list] of Object.entries(x.shots as Record<string, unknown>)) {
          const l = ids(list, 500)
          if (scenes.includes(id) && l.length) shots[id] = l
        }
        if (Object.keys(shots).length) day.shots = shots
      }
      if (x.shotTimes && typeof x.shotTimes === 'object') {
        const all: Record<string, Record<string, string>> = {}
        for (const [id, m] of Object.entries(x.shotTimes as Record<string, unknown>)) {
          if (!scenes.includes(id) || !m || typeof m !== 'object') continue
          const t = Object.fromEntries(Object.entries(m as Record<string, unknown>).filter((e): e is [string, string] => strId(e[0]) && isTime(e[1])))
          if (Object.keys(t).length) all[id] = t
        }
        if (Object.keys(all).length) day.shotTimes = all
      }
      if (isDate(x.date)) day.date = x.date
      const place = cleanPlace(x.place)
      if (place) day.place = place
      raw.push(day)
    }
    // a scene is shot on one day, unless the days it is on each say which of its shots they have
    const daysOf = new Map<string, ShootDay[]>()
    for (const d of raw) for (const s of d.scenes) daysOf.set(s, [...(daysOf.get(s) ?? []), d])
    const keeps = (d: ShootDay, s: string): boolean => {
      const list = daysOf.get(s) ?? []
      if (list.length <= 1) return true
      return list.some((x) => x.shots?.[s]) ? d.shots?.[s] !== undefined : list[0] === d
    }
    for (const d of raw) {
      let day = d
      for (const s of d.scenes) if (!keeps(d, s)) day = withoutShots(leave(day, s), s)
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

export function updateDay(p: Production, dayId: string, patch: Partial<Pick<ShootDay, 'label' | 'notes' | 'date' | 'place'>>): Production {
  return {
    ...p,
    days: p.days.map((d) => {
      if (d.id !== dayId) return d
      const next = { ...d, ...patch }
      // cleared fields leave the day, so the file stays as it was
      if (!next.date) delete next.date
      if (!next.place) delete next.place
      return next
    })
  }
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
      return inTimeOrder(next)
    })
  }
}

/** When a scene starts on a day: its own time there, or the earliest of its shots there; '' for none. */
function startTime(d: ShootDay, scene: string): string {
  return d.times?.[scene] || (Object.values(d.shotTimes?.[scene] ?? {}).sort()[0] ?? '')
}

/** The day's scenes in the order they are shot: earliest first; scenes with no time after, in the order they were. */
function inTimeOrder(d: ShootDay): ShootDay {
  const scenes = d.scenes
    .map((s, i) => ({ s, i, t: startTime(d, s) || '99:99' }))
    .sort((a, b) => a.t.localeCompare(b.t) || a.i - b.i)
    .map((x) => x.s)
  return scenes.every((s, i) => s === d.scenes[i]) ? d : { ...d, scenes }
}

/** When a shot (a storyboard frame) of a scene is filmed on a day, or ''. */
export const shotTime = (day: ShootDay, scene: string, shot: string): string => day.shotTimes?.[scene]?.[shot] ?? ''

/** Sets (or, with '', clears) the time a shot of a scene is filmed on a day the scene is on. */
export function setShotTime(p: Production, dayId: string, scene: string, shot: string, time: string): Production {
  return {
    ...p,
    days: p.days.map((d) => {
      if (d.id !== dayId || !d.scenes.includes(scene)) return d
      const mine = { ...(d.shotTimes?.[scene] ?? {}) }
      if (isTime(time)) mine[shot] = time
      else delete mine[shot]
      return inTimeOrder(withShotTimes(d, scene, mine))
    })
  }
}

/** The day with these shot times for the scene (none: the scene's entry goes). */
function withShotTimes(d: ShootDay, scene: string, mine: Record<string, string>): ShootDay {
  const all = { ...(d.shotTimes ?? {}) }
  if (Object.keys(mine).length) all[scene] = mine
  else delete all[scene]
  const next: ShootDay = { ...d, shotTimes: all }
  if (Object.keys(all).length === 0) delete next.shotTimes
  return next
}

/** The scene leaves the day: its time, and the times of its shots, belong to that day and stay behind. */
function withoutTime(d: ShootDay, scene: string): ShootDay {
  let next = d
  if (d.times && scene in d.times) {
    const times = { ...d.times }
    delete times[scene]
    next = { ...d, times }
    if (Object.keys(times).length === 0) delete next.times
  }
  return next.shotTimes?.[scene] ? withShotTimes(next, scene, {}) : next
}

function withoutShots(d: ShootDay, scene: string): ShootDay {
  if (!d.shots || !(scene in d.shots)) return d
  const shots = { ...d.shots }
  delete shots[scene]
  const next: ShootDay = { ...d, shots }
  if (Object.keys(shots).length === 0) delete next.shots
  return next
}

/** The day without the scene (and the scene's time on it). */
function leave(d: ShootDay, scene: string): ShootDay {
  return d.scenes.includes(scene) ? withoutTime({ ...d, scenes: d.scenes.filter((s) => s !== scene) }, scene) : d
}

// ---------------------------------------------------------------- shots (storyboard frames) in the plan

/** A storyboard frame as a shot to film: "3.2", what it is, and the frame it comes from. */
export interface ShotInfo {
  /** The frame's id. */
  id: string
  /** The scene number and the shot's place in the scene: "3.2". */
  code: string
  /** "Close · 50 mm — Marina de costas". */
  text: string
}

const CAPTION_MAX = 60

/**
 * The shots of each scene, by scene id, in storyboard order: the frames of the scene, numbered after it (3.1, 3.2…).
 * A frame belongs to the scene of its scene id or, without one, to the scene its label names.
 */
export function sceneShots(frames: Frame[], scenes: SceneInfo[]): Map<string, ShotInfo[]> {
  const byNumber = new Map(scenes.filter((s) => s.id).map((s) => [s.number, s.id as string]))
  const numberOf = new Map(scenes.filter((s) => s.id).map((s) => [s.id as string, s.number]))
  const out = new Map<string, ShotInfo[]>()
  for (const f of frames) {
    const sid = f.sid ? (numberOf.has(f.sid) ? f.sid : undefined) : byNumber.get(f.scene.trim())
    if (!sid) continue
    const list = out.get(sid) ?? []
    const caption = f.caption.trim().replace(/\s+/g, ' ')
    const short = caption.length > CAPTION_MAX ? `${caption.slice(0, CAPTION_MAX - 1).trimEnd()}…` : caption
    const text = [shotText(f), short].filter(Boolean).join(' — ') || 'quadro sem descrição'
    list.push({ id: f.id, code: `${numberOf.get(sid)}.${list.length + 1}`, text })
    out.set(sid, list)
  }
  return out
}

/** A scene is in parts when the days it is on say which of its shots each one has. */
export const inParts = (p: Production, scene: string): boolean => p.days.some((d) => d.shots?.[scene] !== undefined)

/** Where each shot of a scene is shot: a day id, or '' for no day. `all` is every shot of the scene. */
function assignment(p: Production, scene: string, all: string[]): Map<string, string> {
  const days = p.days.filter((d) => d.scenes.includes(scene))
  const out = new Map<string, string>()
  if (!inParts(p, scene)) {
    // a whole scene takes all its shots to its day
    for (const id of all) out.set(id, days[0]?.id ?? '')
    return out
  }
  for (const id of all) out.set(id, '')
  for (const d of days) for (const id of d.shots?.[scene] ?? []) if (out.has(id)) out.set(id, d.id)
  return out
}

/** The shots of a scene shot on a day (null = the ones with no day), in storyboard order. */
export function shotsOf(p: Production, scene: string, all: string[], dayId: string | null): string[] {
  const a = assignment(p, scene, all)
  return all.filter((id) => a.get(id) === (dayId ?? ''))
}

/**
 * Lays a scene out on the days from where each of its shots goes. The scene shows on every day that has one of its
 * shots (added last on a day it was not on yet); when all its shots end up together it is whole again.
 */
function assignShots(p: Production, scene: string, all: string[], a: Map<string, string>): Production {
  const live = new Set(p.days.map((d) => d.id))
  const groups = new Map<string, string[]>()
  for (const id of all) {
    let g = a.get(id) ?? ''
    if (g && !live.has(g)) g = ''
    groups.set(g, [...(groups.get(g) ?? []), id])
  }
  const whole = groups.size <= 1
  return {
    ...p,
    days: p.days.map((d) => {
      const mine = groups.get(d.id)
      if (!mine) return withoutShots(leave(d, scene), scene)
      let on = d.scenes.includes(scene) ? d : { ...d, scenes: [...d.scenes, scene] }
      // a shot that left the day leaves its time behind
      const times = on.shotTimes?.[scene]
      if (times) on = withShotTimes(on, scene, Object.fromEntries(Object.entries(times).filter(([id]) => mine.includes(id))))
      return whole ? withoutShots(on, scene) : { ...on, shots: { ...on.shots, [scene]: mine } }
    })
  }
}

/** Sends one shot of a scene to a day (null = no day). The rest of the scene stays where it is. */
export function moveShot(p: Production, scene: string, all: string[], shotId: string, dayId: string | null): Production {
  if (!all.includes(shotId)) return p
  const a = assignment(p, scene, all)
  a.set(shotId, dayId ?? '')
  return assignShots(p, scene, all, a)
}

function reorder(p: Production, dayId: string, scene: string, at: number | undefined): Production {
  if (at === undefined) return p
  return {
    ...p,
    days: p.days.map((d) => {
      if (d.id !== dayId || !d.scenes.includes(scene)) return d
      const scenes = d.scenes.filter((s) => s !== scene)
      scenes.splice(Math.max(0, Math.min(at, scenes.length)), 0, scene)
      return { ...d, scenes }
    })
  }
}

/**
 * Puts a scene on a day (null = no day), at `at` in that day's order (default: last).
 * A whole scene is on one day at most, so it leaves the day it was on; its time belongs to that day and stays behind,
 * unless it only moves inside the same day.
 * `part` moves only the part of a scene in parts that is on day `from` (null = its shots with no day); `all` is
 * every shot of the scene.
 */
export function scheduleScene(
  p: Production,
  scene: string,
  dayId: string | null,
  at?: number,
  part?: { from: string | null; all: string[] }
): Production {
  if (part && part.all.length > 0 && inParts(p, scene)) {
    if ((part.from ?? '') === (dayId ?? '')) return dayId ? reorder(p, dayId, scene, at) : p
    const a = assignment(p, scene, part.all)
    for (const [id, g] of a) if (g === (part.from ?? '')) a.set(id, dayId ?? '')
    const out = assignShots(p, scene, part.all, a)
    return dayId ? reorder(out, dayId, scene, at) : out
  }
  const days = p.days.map((d) => {
    if (!d.scenes.includes(scene)) return withoutShots(d, scene)
    const left = withoutShots({ ...d, scenes: d.scenes.filter((s) => s !== scene) }, scene)
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
  // the times, and the shots of scenes in parts, go with their scenes
  if (day.times) {
    const mine = Object.entries(day.times).filter(([id]) => moved.includes(id))
    if (mine.length) rest.times = Object.fromEntries(mine)
    for (const [id] of mine) first = withoutTime(first, id)
  }
  if (day.shots) {
    const mine = Object.entries(day.shots).filter(([id]) => moved.includes(id))
    if (mine.length) rest.shots = Object.fromEntries(mine)
    for (const [id] of mine) first = withoutShots(first, id)
  }
  if (day.shotTimes) {
    const mine = Object.entries(day.shotTimes).filter(([id]) => moved.includes(id))
    if (mine.length) rest.shotTimes = Object.fromEntries(mine)
    for (const [id] of mine) first = withShotTimes(first, id, {})
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
/** With storyboard shots, the plan says which shots are filmed in each scene. */
const PLAN_COLUMNS_SHOTS = ['Horário', 'Cena', 'INT/EXT', 'Local', 'Sinopse', 'Planos', 'D/N', 'Págs.', 'Elenco', 'Elementos']

/** A scene, or the part of it, as a line of the plan. */
export interface PlanEntry {
  scene: SceneInfo
  time: string
  /** The shots filmed in it, in storyboard order, each with its time that day ('' = none); empty without storyboard. */
  shots: (ShotInfo & { time: string })[]
  /** Only some of the scene's shots: its pages are counted in proportion. */
  part: boolean
  eighths: number
}

const hasShots = (shots: Map<string, ShotInfo[]>): boolean => [...shots.values()].some((l) => l.length > 0)

/**
 * The scene (or the part of it) shot on a day (null = with no day). Its time is the scene's own on that day or, without
 * one, the time of its first shot.
 */
export function entryOf(s: SceneInfo, p: Production, shots: Map<string, ShotInfo[]>, day: ShootDay | null): PlanEntry {
  const all = (s.id && shots.get(s.id)) || []
  const own = day && s.id ? sceneTime(day, s.id) : ''
  if (!s.id || all.length === 0) return { scene: s, time: own, shots: [], part: false, eighths: s.eighths }
  const sid = s.id
  const ids = new Set(shotsOf(p, sid, all.map((x) => x.id), day ? day.id : null))
  // a scene on no day at all is whole, with all its shots
  const mine = (day || ids.size ? all.filter((x) => ids.has(x.id)) : all).map((x) => ({ ...x, time: day ? shotTime(day, sid, x.id) : '' }))
  const first = mine.map((x) => x.time).filter(Boolean).sort()[0] ?? ''
  const part = mine.length < all.length
  return { scene: s, time: own || first, shots: mine, part, eighths: part ? Math.max(1, Math.round((s.eighths * mine.length) / all.length)) : s.eighths }
}

/** The shots in the order they are filmed: by time, then the ones with no time, in storyboard order. */
export const shotsByTime = (list: PlanEntry['shots']): PlanEntry['shots'] =>
  list
    .map((x, i) => ({ x, i }))
    .sort((a, b) => (a.x.time || '99:99').localeCompare(b.x.time || '99:99') || a.i - b.i)
    .map(({ x }) => x)

function planRow(e: PlanEntry, p: Production, withShots: boolean): (string | number)[] {
  const s = e.scene
  // one shot per line: the PDF and the report table keep the line breaks of a cell
  const shotList = shotsByTime(e.shots).map((x) => `${x.time ? `${x.time} ` : ''}${x.code} ${x.text}`).join('\n') || '—'
  return [
    e.time || '—',
    e.part ? `${s.number} (parte)` : s.number,
    s.intExt,
    s.location || '—',
    s.synopsis || '—',
    ...(withShots ? [shotList] : []),
    s.night ? 'N' : 'D',
    formatEighths(e.eighths),
    s.cast.join(', ') || '—',
    elementsText(p, s.id) || '—'
  ]
}

/** The total line of a day, in the plan's columns. */
function totalRow(list: PlanEntry[], withShots: boolean): (string | number)[] {
  const e = list.reduce((t, x) => t + x.eighths, 0)
  return ['', 'Total', '', `${list.length} ${list.length === 1 ? 'cena' : 'cenas'}`, '', ...(withShots ? [''] : []), '', e ? formatEighths(e) : '0', '', '']
}

/** Scenes in parts whose shots are not all on a day: the part with no day, as the plan lists it. */
export function looseParts(scenes: SceneInfo[], p: Production, shots: Map<string, ShotInfo[]>): SceneInfo[] {
  return scenes.filter((s) => {
    const all = (s.id && shots.get(s.id)) || []
    return s.id !== null && all.length > 0 && inParts(p, s.id) && shotsOf(p, s.id, all.map((x) => x.id), null).length > 0
  })
}

/** What has no day: the scenes on no day, and the parts of scenes with shots on no day, in script order. */
function poolEntries(scenes: SceneInfo[], p: Production, shots: Map<string, ShotInfo[]>): PlanEntry[] {
  return [...unscheduled(scenes, p), ...looseParts(scenes, p, shots)].sort((a, b) => a.n - b.n).map((s) => entryOf(s, p, shots, null))
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
function daySummary(list: PlanEntry[]): string {
  const e = list.reduce((t, x) => t + x.eighths, 0)
  return `${list.length} ${list.length === 1 ? 'cena' : 'cenas'} · ${e ? formatEighths(e) : '0'} pág.`
}

const dayEntries = (d: ShootDay, scenes: SceneInfo[], p: Production, shots: Map<string, ShotInfo[]>): PlanEntry[] =>
  dayScenes(d, scenes).map((s) => entryOf(s, p, shots, d))

/** One day as a group of the printed plan: its name, its count, its notes, and its scenes at their times. */
function daySection(d: ShootDay, n: number, scenes: SceneInfo[], p: Production, shots: Map<string, ShotInfo[]>, title = dayLabel(d, n)): ReportSection {
  const list = dayEntries(d, scenes, p, shots)
  const withShots = hasShots(shots)
  return { title, summary: daySummary(list), note: d.notes.trim() || undefined, rows: list.map((e) => planRow(e, p, withShots)) }
}

/**
 * The whole plan: every day with its scenes and a total, then what has no day.
 * The PDF prints it day by day, each under a heading of its own; the CSV keeps one flat table with the day on each line.
 * `shots` (from the storyboard, see sceneShots) adds the shots filmed in each scene.
 */
export function scheduleReport(scenes: SceneInfo[], p: Production, shots: Map<string, ShotInfo[]> = new Map()): Report {
  const withShots = hasShots(shots)
  const columns = withShots ? PLAN_COLUMNS_SHOTS : PLAN_COLUMNS
  const rows: (string | number)[][] = []
  p.days.forEach((d, n) => {
    const list = dayEntries(d, scenes, p, shots)
    for (const e of list) rows.push([dayLabel(d, n), ...planRow(e, p, withShots)])
    rows.push([dayLabel(d, n), ...totalRow(list, withShots)])
  })
  const pool = poolEntries(scenes, p, shots)
  for (const e of pool) rows.push(['Sem dia', ...planRow(e, p, withShots)])
  const sections = p.days.map((d, n) => daySection(d, n, scenes, p, shots))
  if (pool.length) sections.push({ title: 'Sem dia marcado', summary: daySummary(pool), rows: pool.map((e) => planRow(e, p, withShots)) })
  return { id: 'plano', title: 'Plano de filmagem', columns: ['Dia', ...columns], rows, printed: { columns, sections } }
}

/** One day as the crew reads it on set: its place in the plan, start, locations and notes, then a block per scene. */
/** What the Som window adds to a day sheet: each scene's sound line, and the ambiences to record at the day's locations. */
export interface DaySound {
  line(sceneId: string): string
  ambiences(locations: string[]): string
}

function callSheetOf(day: ShootDay, n: number, total: number, list: PlanEntry[], p: Production, sound?: DaySound, sun?: string): CallSheet {
  const locations: string[] = []
  for (const e of list) {
    const l = e.scene.location || e.scene.heading
    if (l && !locations.includes(l)) locations.push(l)
  }
  return {
    day: dayLabel(day, n),
    dayOf: `Dia ${n + 1} de ${total}`,
    start: list.map((e) => e.time).filter(Boolean).sort()[0] ?? '',
    locations,
    summary: daySummary(list),
    notes: day.notes.trim(),
    ...(day.date ? { date: longDate(day.date) } : {}),
    ...(sun ? { sun } : {}),
    ...(sound ? { ambiences: sound.ambiences([...new Set(list.map((e) => locationKey(e.scene)))]) } : {}),
    scenes: list.map((e) => ({
      time: e.time,
      number: e.scene.number,
      part: e.part,
      intExt: e.scene.intExt,
      location: e.scene.location,
      dn: e.scene.night ? 'N' : 'D',
      pages: formatEighths(e.eighths),
      synopsis: e.scene.synopsis,
      shots: shotsByTime(e.shots).map((x) => ({ time: x.time, code: x.code, text: x.text })),
      cast: e.scene.cast.join(', '),
      elements: elementsText(p, e.scene.id),
      ...(sound ? { sound: e.scene.id ? sound.line(e.scene.id) : '' } : {})
    }))
  }
}

/** The call sheet for one day: a table for the screen and the CSV, a day sheet for the PDF. */
export function dayReport(day: ShootDay, n: number, scenes: SceneInfo[], p: Production, shots: Map<string, ShotInfo[]> = new Map(), sound?: DaySound, sun?: string): Report {
  const withShots = hasShots(shots)
  const columns = withShots ? PLAN_COLUMNS_SHOTS : PLAN_COLUMNS
  const list = dayEntries(day, scenes, p, shots)
  const rows = list.map((e) => planRow(e, p, withShots))
  rows.push(totalRow(list, withShots))
  if (day.notes.trim()) rows.push(['', 'Notas', '', day.notes.trim(), ...columns.slice(4).map(() => '')])
  return {
    id: `dia-${day.id}`,
    title: `Ordem do dia · ${dayLabel(day, n)}`,
    columns,
    rows,
    printed: { columns, sections: [daySection(day, n, scenes, p, shots, 'Cenas do dia')], callsheet: callSheetOf(day, n, p.days.length, list, p, sound, sun) }
  }
}

export type { Block }
