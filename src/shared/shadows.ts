import type { LightMap } from './types'

/**
 * Light and shadow on the light map, in metres (Etapa 1: only walls stop the light). Not a physical simulation: it
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

/** The walls of a map as segments: through the wall's centre, along its rotation, its length long. */
export function wallSegments(map: LightMap): Segment[] {
  return map.items
    .filter((it) => it.type === 'wall')
    .map((it) => {
      const h = (it.length ?? 4) / 2
      const a = (it.rotation * Math.PI) / 180
      const dx = Math.cos(a) * h
      const dy = Math.sin(a) * h
      return { x1: it.x - dx, y1: it.y - dy, x2: it.x + dx, y2: it.y + dy }
    })
}

/** Where a piece turned `rotation` degrees points: 0 is the top of the drawing, clockwise. */
const pointing = (rotation: number): Pt => {
  const a = (rotation * Math.PI) / 180
  return { x: Math.sin(a), y: -Math.cos(a) }
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
}

/**
 * The area a light reaches: rays across its opening, one per degree and a few grazing each wall's ends, each going as
 * far as its reach or the first wall. The points go round the area, starting at the light (unless it shines all round).
 */
export function litArea(b: Beam, walls: Segment[]): Pt[] {
  const dir = pointing(b.rotation)
  const o = { x: b.x + dir.x * (b.from ?? 0), y: b.y + dir.y * (b.from ?? 0) }
  const round = b.spread >= 359.5
  const half = round ? Math.PI : (b.spread / 2) * (Math.PI / 180)
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
  const pts = angles.map((d) => {
    const v = { x: Math.cos(a0 + d), y: Math.sin(a0 + d) }
    const t = Math.min(b.range, ...walls.map((s) => hit(o, v, s)))
    return { x: o.x + v.x * t, y: o.y + v.y * t }
  })
  return round ? pts : [o, ...pts]
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
