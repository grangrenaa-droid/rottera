import { describe, expect, it } from 'vitest'
import { insidePolygon, litArea, sunRotation, sunShadows, wallSegments } from '../src/shared/shadows'
import { cleanLightMap, lightMapSvg, newItem, newLightMap } from '../src/shared/lightmap'
import type { LightMap } from '../src/shared/types'

const wall = (x: number, y: number, length: number, rotation = 0) => ({ ...newItem('wall', x, y), length, rotation })
const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-6

describe('the walls of a map, as segments', () => {
  it('a wall is a segment through its centre, along its rotation', () => {
    const map: LightMap = { ...newLightMap('Sala'), items: [wall(3, 2, 4), wall(3, 2, 4, 90), newItem('table', 1, 1)] }
    const [a, b] = wallSegments(map)
    expect(wallSegments(map)).toHaveLength(2)
    expect([a.x1, a.y1, a.x2, a.y2].map((v) => Math.round(v * 1000) / 1000)).toEqual([1, 2, 5, 2])
    expect(near(b.x1, 3) && near(b.y1, 0) && near(b.x2, 3) && near(b.y2, 4)).toBe(true)
  })
})

describe('the area a light reaches', () => {
  // a light at (3, 4) pointing up (rotation 0), 60° wide, 3 m long
  const light = { x: 3, y: 4, rotation: 0, spread: 60, range: 3 }

  it('without walls, it is the whole beam', () => {
    const area = litArea(light, [])
    expect(Math.min(...area.map((p) => p.y))).toBeCloseTo(1, 1)
  })

  it('stops at a wall in its way, and goes on beside a wall out of its way', () => {
    const across = wallSegments({ ...newLightMap('x'), items: [wall(3, 2, 4)] })
    const area = litArea(light, across)
    expect(Math.min(...area.map((p) => p.y))).toBeGreaterThanOrEqual(2 - 1e-6)
    const aside = wallSegments({ ...newLightMap('x'), items: [wall(8, 2, 1)] })
    expect(Math.min(...litArea(light, aside).map((p) => p.y))).toBeCloseTo(1, 1)
  })

  it('a short wall casts a shadow: behind it is dark, beside it is lit', () => {
    const short = wallSegments({ ...newLightMap('x'), items: [wall(3, 2.5, 0.6)] })
    const area = litArea(light, short)
    expect(insidePolygon({ x: 3, y: 1.6 }, area)).toBe(false) // right behind the wall
    expect(insidePolygon({ x: 2, y: 1.8 }, area)).toBe(true) // to the side of its shadow
  })
})

describe('the sun and the moon', () => {
  it('light the map in parallel rays; behind a wall is in shadow', () => {
    // pointing down (180°): the sun comes from the top of the drawing
    const walls = wallSegments({ ...newLightMap('x'), items: [wall(3, 2, 4)] })
    const [shadow] = sunShadows(180, walls, 8, 6)
    expect(insidePolygon({ x: 3, y: 3 }, shadow)).toBe(true)
    expect(insidePolygon({ x: 3, y: 5.5 }, shadow)).toBe(true)
    expect(insidePolygon({ x: 3, y: 1 }, shadow)).toBe(false)
    expect(insidePolygon({ x: 0.5, y: 3 }, shadow)).toBe(false)
  })
})

describe('light and shadow on the drawing', () => {
  const map = (shadows: boolean): LightMap => ({
    ...newLightMap('Sala'),
    width: 8,
    height: 6,
    shadows,
    items: [wall(4, 2, 4), { ...newItem('fresnel', 4, 4), rotation: 0 }, { ...newItem('sun', 1, 1), rotation: 135 }]
  })

  it('is drawn only when the map asks for it', () => {
    const off = lightMapSvg(map(false))
    expect(off).not.toContain('data-lit')
    const on = lightMapSvg(map(true))
    expect(on.match(/data-lit=/g)).toHaveLength(1)
    expect(on).toContain('data-sun')
    expect(on).toContain('data-shade')
  })

  it('is kept in the file', () => {
    expect(cleanLightMap(JSON.parse(JSON.stringify(map(true))))?.shadows).toBe(true)
    expect(cleanLightMap(JSON.parse(JSON.stringify({ ...map(true), shadows: 'sim' })))?.shadows).toBeUndefined()
  })
})

describe('the sun when it moves', () => {
  it('gets a new mask, so two drawings or an old one on screen never keep the shadow of another place', () => {
    const at = (x: number): string => {
      const svg = lightMapSvg({ ...newLightMap('Sala'), id: 'sala', shadows: true, items: [wall(4, 2, 4), { ...newItem('sun', x, 1), id: 'sol' }] })
      return /<mask id="([^"]+)"/.exec(svg)?.[1] ?? ''
    }
    expect(at(1)).not.toBe(at(7))
    expect(at(1)).toBe(at(1))
  })
})

describe('the sun comes from where it is', () => {
  it('its light goes from its place towards the middle of the set', () => {
    // top right of an 8 x 6 set: towards the middle, down and to the left
    expect(Math.round(sunRotation({ x: 7.2, y: 0.6, rotation: 135 }, 8, 6))).toBe(233)
    // right at the middle it has no side: its own direction
    expect(sunRotation({ x: 4, y: 3, rotation: 90 }, 8, 6)).toBe(90)
  })

  it('dragging the sun moves the shadow; turning it does not', () => {
    const shade = (x: number, y: number, rotation: number): string => {
      const svg = lightMapSvg({ ...newLightMap('Sala'), id: 'sala', width: 8, height: 6, shadows: true, items: [wall(2, 3, 4, 90), { ...newItem('sun', x, y), id: 'sol', rotation }] })
      return /data-shade="sol"[^>]*><polygon points="([^"]+)"/.exec(svg)?.[1] ?? ''
    }
    expect(shade(7.5, 0.5, 0)).toBe(shade(7.5, 0.5, 200))
    expect(shade(7.5, 0.5, 0)).not.toBe(shade(0.5, 5.5, 0))
  })
})

describe('doors and windows open a wall (Etapa 2)', () => {
  // a wall across the set at y = 3, from x = 1 to 7; a door on it at x = 2.5, a window at x = 5.5
  const room = (extra: LightMap['items'] = []): LightMap => ({
    ...newLightMap('Sala'),
    id: 'sala',
    width: 8,
    height: 6,
    items: [wall(4, 3, 6), { ...newItem('door', 2.5, 3.1), length: 1 }, { ...newItem('window', 5.5, 2.95), length: 1.2, rotation: 90 }, ...extra]
  })

  it('a door is a gap in the wall; a window too, when the light may pass it', () => {
    const closed = wallSegments(room())
    expect(closed.map((s) => [s.x1, s.x2].map((v) => Math.round(v * 100) / 100))).toEqual([
      [1, 2],
      [3, 7]
    ])
    const open = wallSegments(room(), { windows: 'open' })
    expect(open.map((s) => [s.x1, s.x2].map((v) => Math.round(v * 100) / 100))).toEqual([
      [1, 2],
      [3, 4.9],
      [6.1, 7]
    ])
  })

  it('a door or window away from any wall changes nothing', () => {
    const m = { ...room(), items: [wall(4, 3, 6), { ...newItem('door', 4, 5), length: 1 }] }
    expect(wallSegments(m)).toHaveLength(1)
  })

  it('a light goes through the door, sharp', () => {
    const beam = { x: 2.5, y: 5, rotation: 0, spread: 40, range: 4 }
    expect(insidePolygon({ x: 2.5, y: 2 }, litArea(beam, wallSegments(room())))).toBe(true)
  })

  it('the sun goes through a door in full, and through a window only softened', () => {
    const closed = sunShadows(180, wallSegments(room()), 8, 6)
    const open = sunShadows(180, wallSegments(room(), { windows: 'open' }), 8, 6)
    const shaded = (p: { x: number; y: number }, list: { x: number; y: number }[][]): boolean => list.some((q) => insidePolygon(p, q))
    // behind the door: no shadow at all
    expect(shaded({ x: 2.5, y: 4 }, closed)).toBe(false)
    // behind the window: shadow for the full sun, light for the soft one
    expect(shaded({ x: 5.5, y: 4 }, closed)).toBe(true)
    expect(shaded({ x: 5.5, y: 4 }, open)).toBe(false)
    // behind the wall: shadow either way
    expect(shaded({ x: 4, y: 4 }, open)).toBe(true)
  })

  it('the drawing shows the soft light through a window, and nothing new without one', () => {
    const sun = { ...newItem('sun', 4, 0.4), id: 'sol' }
    const lamp = { ...newItem('fresnel', 5.5, 5), id: 'luz', rotation: 0, range: 4 }
    const svg = lightMapSvg({ ...room([sun, lamp]), shadows: true })
    expect(svg).toContain('data-sun-window="sol"')
    expect(svg).toContain('data-soft="luz"')
    const plain = lightMapSvg({ ...newLightMap('x'), shadows: true, items: [wall(4, 3, 6), sun, lamp] })
    expect(plain).not.toContain('data-sun-window')
    expect(plain).not.toContain('data-soft')
  })
})
