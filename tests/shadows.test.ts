import { describe, expect, it } from 'vitest'
import { insidePolygon, litArea, sunShadows, wallSegments } from '../src/shared/shadows'
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
