import type { LightItemType, LightMap } from './types'

/**
 * Light and shadow on the light map, in metres: walls, doors, windows and the modifiers (Etapas 1 to 3). Not a physical simulation: it
 * says where the light reaches and where it does not, not how much of it.
 */

export interface Segment {
  x1: number
  y1: number
  x2: number
  y2: number
}
export interface Pt {
  x: number
  y: number
}

/** How close to a wall a door or window must sit to open it, in metres. */
const ON_WALL = 0.3

/**
 * The walls of a map as segments: through the wall's centre, along its rotation, its length long. A door sitting on a
 * wall is a gap in it; a window too, when `windows` is 'open' (the light that goes through it is drawn softened). Only
 * where the opening sits matters, not how it is turned: its length is cut out of the wall around that point.
 */
export function wallSegments(map: LightMap, opts: { windows?: 'open' | 'closed' } = {}): Segment[] {
  const openings = map.items.filter((it) => it.type === 'door' || (it.type === 'window' && opts.windows === 'open'))
  const out: Segment[] = []
  for (const it of map.items) {
    if (it.type !== 'wall') continue
    const len = it.length ?? 4
    const a = (it.rotation * Math.PI) / 180
    const ux = Math.cos(a)
    const uy = Math.sin(a)
    const x0 = it.x - (ux * len) / 2
    const y0 = it.y - (uy * len) / 2
    // the stretches of the wall the openings take, along it (0 at one end, len at the other)
    const cuts: [number, number][] = []
    for (const o of openings) {
      const t = (o.x - x0) * ux + (o.y - y0) * uy
      const off = Math.abs(-(o.x - x0) * uy + (o.y - y0) * ux)
      if (off > ON_WALL || t < 0 || t > len) continue
      const h = (o.length ?? (o.type === 'door' ? 0.9 : 1.2)) / 2
      cuts.push([Math.max(0, t - h), Math.min(len, t + h)])
    }
    cuts.sort((p, q) => p[0] - q[0])
    let from = 0
    const piece = (s: number, e: number): void => {
      if (e - s > 1e-6) out.push({ x1: x0 + ux * s, y1: y0 + uy * s, x2: x0 + ux * e, y2: y0 + uy * e })
    }
    for (const [s, e] of cuts) {
      piece(from, s)
      from = Math.max(from, e)
    }
    piece(from, len)
  }
  return out
}

/**
 * The three kinds of light the map tells apart: the full one, the softened one (through windows and diffusers) and the
 * patterned one (through a cucoloris).
 */
export type Pass = 'sharp' | 'soft' | 'cookie'

/** The furniture, seen from above: length across and depth (width) up and down, by default, in metres. */
const PROPS: Partial<Record<LightItemType, { length: number; depth: number; round?: boolean }>> = {
  table: { length: 1.2, depth: 0.8 },
  chair: { length: 0.3, depth: 0.3 },
  roundtable: { length: 1, depth: 1, round: true },
  sofa: { length: 2, depth: 0.9 },
  armchair: { length: 0.9, depth: 0.85 },
  bed: { length: 1.9, depth: 1.4 },
  wardrobe: { length: 1.2, depth: 0.6 },
  counter: { length: 1.8, depth: 0.6 },
  shelf: { length: 1, depth: 0.35 }
}

type Placed = { type: LightItemType; x: number; y: number; rotation: number; length?: number; depth?: number }

/** A piece of furniture's outline seen from above, turned with it (a round table is a 16-sided ring); null for anything else. */
export function propOutline(it: Placed): Pt[] | null {
  const p = PROPS[it.type]
  if (!p) return null
  // a chair is drawn at a fixed size, whatever length it carries
  const len = it.type === 'chair' ? p.length : it.length ?? p.length
  const dep = it.type === 'chair' ? p.depth : p.round ? len : it.depth ?? p.depth
  const local: Pt[] = p.round
    ? Array.from({ length: 16 }, (_, k) => ({ x: (Math.cos((k * Math.PI) / 8) * len) / 2, y: (Math.sin((k * Math.PI) / 8) * len) / 2 }))
    : [
        { x: -len / 2, y: -dep / 2 },
        { x: len / 2, y: -dep / 2 },
        { x: len / 2, y: dep / 2 },
        { x: -len / 2, y: dep / 2 }
      ]
  const a = (it.rotation * Math.PI) / 180
  const c = Math.cos(a)
  const sn = Math.sin(a)
  return local.map((q) => ({ x: it.x + q.x * c - q.y * sn, y: it.y + q.x * sn + q.y * c }))
}

/** The furniture a point stands on (a lamp on a table, an actor on a sofa): those pieces do not hide it. */
export function propsUnder(map: LightMap, p: Pt): string[] {
  return map.items.filter((it) => {
    const o = propOutline(it)
    return o !== null && insidePolygon(p, o)
  }).map((it) => it.id)
}

/** How wide an actor's body is, in metres (the actor's mark on the map). */
const BODY = 0.47

/** The modifiers that stand in the light's way, how long they are by default, and which light they let through. */
const MODIFIERS: Partial<Record<LightItemType, { length: number; lets?: Pass }>> = {
  flag: { length: 0.9 },
  diffuser: { length: 0.9, lets: 'soft' },
  cookie: { length: 0.9, lets: 'cookie' },
  reflector: { length: 0.9 },
  bounce: { length: 1.2 }
}

/**
 * What stops one kind of light: the walls (windows let the softened light through) and every modifier standing in
 * the set, except the one that kind of light goes through, and the furniture. `skip` leaves pieces out (a reflector sending light back
 * does not stop its own light). With `towards`, the actors stand in the way too: each body across the way the light
 * comes to it (`towards` says which way that is, for each actor).
 */
export function blockers(map: LightMap, pass: Pass, skip?: string | string[], towards?: (actor: { x: number; y: number }) => Pt): Segment[] {
  const out = wallSegments(map, { windows: pass === 'soft' ? 'open' : 'closed' })
  const left = new Set(typeof skip === 'string' ? [skip] : skip ?? [])
  for (const it of map.items) {
    if (left.has(it.id)) continue
    if (it.type === 'actor' && towards) {
      const v = towards(it)
      const n = Math.hypot(v.x, v.y)
      if (n < 1e-9) continue
      const half = BODY / 2
      out.push({ x1: it.x - (v.y / n) * half, y1: it.y + (v.x / n) * half, x2: it.x + (v.y / n) * half, y2: it.y - (v.x / n) * half })
      continue
    }
    const outline = propOutline(it)
    if (outline) {
      outline.forEach((q, k) => {
        const r = outline[(k + 1) % outline.length]
        out.push({ x1: q.x, y1: q.y, x2: r.x, y2: r.y })
      })
      continue
    }
    const m = MODIFIERS[it.type]
    if (!m || m.lets === pass) continue
    const len = it.length ?? m.length
    const a = (it.rotation * Math.PI) / 180
    const dx = (Math.cos(a) * len) / 2
    const dy = (Math.sin(a) * len) / 2
    out.push({ x1: it.x - dx, y1: it.y - dy, x2: it.x + dx, y2: it.y + dy })
  }
  return out
}

/** Where a piece turned `rotation` degrees points: 0 is the top of the drawing, clockwise. */
export const pointing = (rotation: number): Pt => {
  const a = (rotation * Math.PI) / 180
  return { x: Math.sin(a), y: -Math.cos(a) }
}

/** The rotation that points along a direction (the other way round from `pointing`). */
export const rotationOf = (v: Pt): number => ((((Math.atan2(v.x, -v.y) * 180) / Math.PI) % 360) + 360) % 360

/** Light going along `v` (length 1) that meets a flat piece lying along `rotation`: where it goes, as off a mirror. */
export function reflectDirection(v: Pt, rotation: number): Pt {
  const a = (rotation * Math.PI) / 180
  const u = { x: Math.cos(a), y: Math.sin(a) }
  const k = 2 * (v.x * u.x + v.y * u.y)
  return { x: k * u.x - v.x, y: k * u.y - v.y }
}

/**
 * The light a reflector or a bounce sends back when light going along `incoming` reaches it, with `range` metres
 * left. A reflector is a mirror: a narrow beam the mirror way. A bounce scatters it: a wide, shorter beam straight off
 * its face, on the side the light came from.
 */
type Flat = { x: number; y: number; rotation: number; type: LightItemType; length?: number }

/** How wide a flat piece looks from where its light goes: its length across that way. */
function across(mod: Flat, dir: Pt): number {
  const a = (mod.rotation * Math.PI) / 180
  const len = mod.length ?? MODIFIERS[mod.type]?.length ?? 0.9
  return len * Math.abs(Math.cos(a) * dir.y - Math.sin(a) * dir.x)
}

export function reflectedBeam(mod: Flat, incoming: Pt, range: number): Beam {
  if (mod.type !== 'bounce') {
    const r = reflectDirection(incoming, mod.rotation)
    return { x: mod.x, y: mod.y, rotation: rotationOf(r), spread: 30, range: Math.max(1.5, range), width: across(mod, r) }
  }
  const a = (mod.rotation * Math.PI) / 180
  let n = { x: -Math.sin(a), y: Math.cos(a) }
  if (n.x * incoming.x + n.y * incoming.y > 0) n = { x: -n.x, y: -n.y }
  return { x: mod.x, y: mod.y, rotation: rotationOf(n), spread: 120, range: Math.max(2.5, range * 0.8), width: across(mod, n) }
}

/** The light a diffuser spreads on when light going along `incoming` goes through it: wide and soft, the same way on. */
export function diffusedBeam(mod: Flat, incoming: Pt, range: number): Beam {
  return { x: mod.x, y: mod.y, rotation: rotationOf(incoming), spread: 90, range: Math.max(1.5, range), width: across(mod, incoming) }
}

/** How far along a ray (from o, direction v of length 1) it meets a segment; Infinity when it does not. */
function hit(o: Pt, v: Pt, s: Segment): number {
  const wx = s.x2 - s.x1
  const wy = s.y2 - s.y1
  const den = v.x * wy - v.y * wx
  if (Math.abs(den) < 1e-12) return Infinity
  const qx = s.x1 - o.x
  const qy = s.y1 - o.y
  const t = (qx * wy - qy * wx) / den
  const u = (qx * v.y - qy * v.x) / den
  return t > 1e-9 && u >= -1e-9 && u <= 1 + 1e-9 ? t : Infinity
}

const wrap = (a: number): number => {
  let x = a
  while (x > Math.PI) x -= 2 * Math.PI
  while (x <= -Math.PI) x += 2 * Math.PI
  return x
}

export interface Beam {
  x: number
  y: number
  rotation: number
  /** Opening, in degrees. */
  spread: number
  /** Reach, in metres. */
  range: number
  /** How far ahead of the piece's centre the beam starts, in metres. */
  from?: number
  /** How wide the face the light comes out of is, in metres: the beam starts that wide (0, or none: from a point). */
  width?: number
}

/**
 * Where a beam's rays come from: a point behind its face (`back` metres behind), so the rays leave the face's whole
 * width at the beam's opening. A light shining all round, or one opening almost flat, comes from its centre.
 */
function source(b: Beam): { apex: Pt; dir: Pt; back: number; half: number; round: boolean } {
  const dir = pointing(b.rotation)
  const round = b.spread >= 359.5
  const half = round ? Math.PI : (b.spread / 2) * (Math.PI / 180)
  const o = { x: b.x + dir.x * (b.from ?? 0), y: b.y + dir.y * (b.from ?? 0) }
  const w = b.width ?? 0
  const back = round || w <= 0 || half >= (85 * Math.PI) / 180 ? 0 : w / 2 / Math.tan(Math.max(half, Math.PI / 360))
  return { apex: { x: o.x - dir.x * back, y: o.y - dir.y * back }, dir, back, half, round }
}

/**
 * The area a light reaches: rays across its opening, one per degree and a few grazing each wall's ends, each going as
 * far as its reach or the first wall. The points go round the area, starting at the light (unless it shines all round).
 */
export function litArea(b: Beam, all: Segment[]): Pt[] {
  const { apex: o, dir, back, half, round } = source(b)
  // how far along a ray (`d` off the axis) the face is: nothing before it stops the light
  const face = (d: number): number => (back > 0 ? back / Math.cos(d) : 0)
  // only what is within reach can stop a ray
  const walls = all.filter((s) => distanceTo(o, s) <= face(half) + b.range)
  const a0 = Math.atan2(dir.y, dir.x)
  const steps = Math.max(4, Math.ceil(round ? 360 : b.spread))
  const angles: number[] = []
  for (let i = 0; i <= steps; i++) angles.push(-half + (2 * half * i) / steps)
  // rays just beside each end of a wall, so its shadow starts exactly there
  for (const s of walls) {
    for (const e of [
      { x: s.x1, y: s.y1 },
      { x: s.x2, y: s.y2 }
    ]) {
      const d = wrap(Math.atan2(e.y - o.y, e.x - o.x) - a0)
      for (const k of [-1e-4, 0, 1e-4]) if (Math.abs(d + k) <= half) angles.push(d + k)
    }
  }
  angles.sort((x, y) => x - y)
  const at = (d: number, t: number): Pt => ({ x: o.x + Math.cos(a0 + d) * t, y: o.y + Math.sin(a0 + d) * t })
  const pts = angles.map((d) => {
    const v = { x: Math.cos(a0 + d), y: Math.sin(a0 + d) }
    const start = face(d)
    let t = start + b.range
    for (const s of walls) {
      const h = hit(o, v, s)
      if (h > start + 1e-9 && h < t) t = h
    }
    return at(d, t)
  })
  if (round) return pts
  // a face with a width: the area starts along it (a trapezoid); from a point it starts at the point (a triangle)
  return back > 0 ? [at(angles[0], face(angles[0])), ...pts, at(angles[angles.length - 1], face(angles[angles.length - 1]))] : [o, ...pts]
}

/** How far a point is from a segment. */
function distanceTo(p: Pt, s: Segment): number {
  const wx = s.x2 - s.x1
  const wy = s.y2 - s.y1
  const len2 = wx * wx + wy * wy
  const t = len2 < 1e-12 ? 0 : Math.max(0, Math.min(1, ((p.x - s.x1) * wx + (p.y - s.y1) * wy) / len2))
  return Math.hypot(p.x - (s.x1 + t * wx), p.y - (s.y1 + t * wy))
}

/** Whether nothing stands on the way from `o` to `p`, past the first `skip` metres. */
function clear(o: Pt, p: Pt, walls: Segment[], skip = 0): boolean {
  const dist = Math.hypot(p.x - o.x, p.y - o.y)
  if (dist < 1e-9) return true
  const v = { x: (p.x - o.x) / dist, y: (p.y - o.y) / dist }
  return walls.every((s) => {
    const h = hit(o, v, s)
    return h <= skip + 1e-9 || h >= dist - 1e-9
  })
}

/**
 * Whether a beam gets to a point: within its reach and opening, with nothing in the way (one ray, the same answer
 * as being inside its lit area, for much less work).
 */
export function reaches(b: Beam, p: Pt, walls: Segment[]): boolean {
  const { apex: o, dir, back, half, round } = source(b)
  const dist = Math.hypot(p.x - o.x, p.y - o.y)
  let start = 0
  if (!round && dist > 1e-9) {
    const off = Math.abs(wrap(Math.atan2(p.y - o.y, p.x - o.x) - Math.atan2(dir.y, dir.x)))
    if (off > half + 1e-9) return false
    // in front of the face, not between it and the point the rays come from
    start = back > 0 ? back / Math.cos(off) : 0
    if (dist < start - 1e-9) return false
  }
  if (dist > start + b.range) return false
  return clear(o, p, walls, start)
}

/** Whether the sun (or the moon) pointing `rotation` gets to a point: nothing between it and the sun's side. */
export function sunReaches(rotation: number, p: Pt, walls: Segment[]): boolean {
  const d = pointing(rotation)
  const back = { x: -d.x, y: -d.y }
  return walls.every((s) => hit(p, back, s) === Infinity)
}

/**
 * The sun or the moon: parallel rays going where the piece points, over the whole map. Each wall leaves a shadow,
 * from the wall to beyond the map's edge.
 */
export function sunShadows(rotation: number, walls: Segment[], width: number, height: number): Pt[][] {
  const d = pointing(rotation)
  const far = Math.hypot(width, height) * 2
  return walls.map((s) => [
    { x: s.x1, y: s.y1 },
    { x: s.x2, y: s.y2 },
    { x: s.x2 + d.x * far, y: s.y2 + d.y * far },
    { x: s.x1 + d.x * far, y: s.y1 + d.y * far }
  ])
}

/** Whether a point is inside a polygon (even-odd rule). */
export function insidePolygon(p: Pt, poly: Pt[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

/**
 * Where the sun or the moon shines: from where the piece is towards the middle of the set (dragging it to another
 * side moves the shadows). Right at the middle it has no side, and its own rotation says it.
 */
export function sunRotation(it: { x: number; y: number; rotation: number }, width: number, height: number): number {
  const dx = width / 2 - it.x
  const dy = height / 2 - it.y
  if (Math.hypot(dx, dy) < 0.05) return it.rotation
  return (((Math.atan2(dx, -dy) * 180) / Math.PI) % 360 + 360) % 360
}
