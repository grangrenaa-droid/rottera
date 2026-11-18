import { describe, expect, it } from 'vitest'
import { blockers, insidePolygon, litArea, propOutline, reflectDirection, sunRotation, sunShadows, wallSegments } from '../src/shared/shadows'
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

describe('modifiers change the light (Etapa 3)', () => {
  const mod = (type: Parameters<typeof newItem>[0], x: number, y: number, extra: Record<string, unknown> = {}) => ({ ...newItem(type, x, y), id: String(type), ...extra })
  const lamp = { ...newItem('fresnel', 4, 5), id: 'luz', rotation: 0, range: 4 }
  const svgOf = (items: LightMap['items']): string => lightMapSvg({ ...newLightMap('Sala'), id: 'sala', width: 8, height: 6, shadows: true, items })

  it('a flag stops the light like a wall', () => {
    const map = { ...newLightMap('x'), items: [mod('flag', 4, 3, { length: 1.2 })] }
    const area = litArea({ x: 4, y: 5, rotation: 0, spread: 30, range: 4 }, blockers(map, 'sharp'))
    expect(insidePolygon({ x: 4, y: 2 }, area)).toBe(false)
    expect(insidePolygon({ x: 4, y: 3.5 }, area)).toBe(true)
  })

  it('a diffuser lets the light through softened, a cookie in patches', () => {
    const soft = svgOf([mod('diffuser', 4, 3, { length: 1.2 }), lamp])
    expect(soft).toContain('data-soft="luz"')
    const cookie = svgOf([mod('cookie', 4, 3, { length: 1.2 }), lamp])
    expect(cookie).toContain('data-cookie="luz"')
    expect(cookie).toContain('<pattern')
  })

  it('a reflector sends back the light that reaches it, sharp; a bounce, soft and wide', () => {
    // a reflector in the beam, turned 45°: the light goes off to the side
    const hard = svgOf([mod('reflector', 4, 3, { rotation: 45 }), lamp])
    expect(hard).toContain('data-bounce="reflector"')
    expect(hard).not.toContain('data-bounce-soft')
    const soft = svgOf([mod('bounce', 4, 3, { rotation: 45 }), lamp])
    expect(soft).toContain('data-bounce-soft="bounce"')
    // out of the beam: nothing comes back
    expect(svgOf([mod('reflector', 7.5, 0.5), lamp])).not.toContain('data-bounce')
  })

  it('the reflected light goes the mirror way', () => {
    // light going up (0, -1) meets a reflector lying at 45°: it goes off sideways
    const r = reflectDirection({ x: 0, y: -1 }, 45)
    expect(Math.abs(r.y)).toBeLessThan(1e-9)
    expect(Math.abs(Math.abs(r.x) - 1)).toBeLessThan(1e-9)
  })

  it('a butterfly makes the light softer and lighter under it', () => {
    expect(svgOf([mod('overhead', 4, 3), { ...newItem('sun', 7, 0.5), id: 'sol' }])).toContain('data-overhead="overhead"')
  })

  it('without modifiers nothing new is drawn', () => {
    const plain = svgOf([lamp])
    for (const tag of ['data-soft', 'data-cookie', 'data-bounce', 'data-overhead']) expect(plain).not.toContain(tag)
  })
})

describe('the actor in the light (Etapa 3, ajustes)', () => {
  const lamp = { ...newItem('fresnel', 4, 5), id: 'luz', rotation: 0, range: 4 }
  const ana = { ...newItem('actor', 4, 3), id: 'ana' }
  const svgOf = (items: LightMap['items']): string => lightMapSvg({ ...newLightMap('Sala'), id: 'sala', width: 8, height: 6, shadows: true, items })
  const polygonOf = (svg: string, attr: string): { x: number; y: number }[] => {
    const m = new RegExp(`${attr} points="([^"]+)"`).exec(svg)
    if (!m) throw new Error(`no ${attr}`)
    return m[1].split(' ').map((p) => {
      const [x, y] = p.split(',').map(Number)
      return { x: x / 60, y: y / 60 }
    })
  }

  it('an actor stands in the way of the light: the body is a blocker across where the light comes from', () => {
    const map = { ...newLightMap('x'), items: [ana] }
    const segs = blockers(map, 'sharp', undefined, () => ({ x: 0, y: -1 }))
    expect(segs).toHaveLength(1)
    expect(Math.abs(segs[0].y1 - 3) + Math.abs(segs[0].y2 - 3)).toBeLessThan(1e-9)
    expect(Math.abs(segs[0].x2 - segs[0].x1)).toBeGreaterThan(0.4)
    // without knowing where the light comes from, nobody stands in the way
    expect(blockers(map, 'sharp')).toHaveLength(0)
  })

  it('an actor in a beam casts a shadow behind', () => {
    const area = polygonOf(svgOf([ana, lamp]), 'data-lit="luz"')
    expect(insidePolygon({ x: 4, y: 3.5 }, area)).toBe(true)
    expect(insidePolygon({ x: 4, y: 2 }, area)).toBe(false)
    expect(insidePolygon({ x: 3.5, y: 2 }, area)).toBe(true)
  })

  it('an actor in the sun casts a shadow', () => {
    const sun = { ...newItem('sun', 4, 0.4), id: 'sol' }
    const shade = /data-shade="sol"[^>]*>(.*?)<\/g>/.exec(svgOf([sun, ana]))![1]
    expect(shade).toContain('<polygon')
  })

  it('an actor shows the side the light comes from, or that no light reaches', () => {
    const lit = svgOf([ana, lamp])
    expect(lit).toContain('data-actor-lit="ana"')
    expect(lit).not.toContain('data-actor-dark')
    const dark = svgOf([{ ...ana, x: 7, y: 1 }, lamp])
    expect(dark).toContain('data-actor-dark="ana"')
  })

  it('a diffuser in the beam spreads a soft, wider light forward', () => {
    const svg = svgOf([{ ...newItem('diffuser', 4, 3), id: 'dif', length: 1.2 }, lamp])
    expect(svg).toContain('data-diffused="dif"')
    expect(svgOf([{ ...newItem('diffuser', 7.5, 0.5), id: 'dif' }, lamp])).not.toContain('data-diffused')
  })

  it('a bounce sends back light that can be seen, and lights an actor in front of it', () => {
    const bounce = { ...newItem('bounce', 4, 2.5), id: 'b', rotation: 0 }
    const svg = svgOf([bounce, lamp])
    const op = Number(/data-bounce-soft="b"[^>]*fill-opacity="([\d.]+)"/.exec(svg)![1])
    expect(op).toBeGreaterThanOrEqual(0.2)
    // an actor behind the lamp, out of its beam, gets only the bounce's light
    const back = svgOf([bounce, { ...lamp, rotation: 0 }, { ...ana, x: 5.2, y: 4.2 }])
    expect(back).toContain('data-actor-lit="ana"')
  })
})

describe('set pieces in the light (Etapa 3, ajustes)', () => {
  const lamp = { ...newItem('fresnel', 4, 5), id: 'luz', rotation: 0, range: 4 }
  const mesa = { ...newItem('table', 4, 3), id: 'mesa', length: 1.2, depth: 0.4 }
  const svgOf = (items: LightMap['items']): string => lightMapSvg({ ...newLightMap('Sala'), id: 'sala', width: 8, height: 6, shadows: true, items })
  const polygonOf = (svg: string, attr: string): { x: number; y: number }[] =>
    /points="([^"]+)"/.exec(svg.slice(svg.indexOf(attr)))![1].split(' ').map((p) => {
      const [x, y] = p.split(',').map(Number)
      return { x: x / 60, y: y / 60 }
    })

  it('a piece of furniture is its outline seen from above, turned with it', () => {
    const corners = propOutline({ ...newItem('table', 2, 2), length: 1.2, depth: 0.8 })!
    expect(corners.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).sort()).toEqual(['1.40,1.60', '1.40,2.40', '2.60,1.60', '2.60,2.40'])
    const turned = propOutline({ ...newItem('table', 2, 2), length: 1.2, depth: 0.8, rotation: 90 })!
    expect(Math.max(...turned.map((p) => p.y)) - Math.min(...turned.map((p) => p.y))).toBeCloseTo(1.2)
    expect(propOutline({ ...newItem('roundtable', 2, 2), length: 1 })!.length).toBeGreaterThanOrEqual(12)
    expect(propOutline(newItem('chair', 2, 2))!.length).toBe(4)
    expect(propOutline(newItem('wall', 2, 2))).toBeNull()
  })

  it('furniture stops the light: its outline is in the way of every light', () => {
    const map = { ...newLightMap('x'), items: [mesa] }
    for (const pass of ['sharp', 'soft', 'cookie'] as const) expect(blockers(map, pass)).toHaveLength(4)
  })

  it('a table in a beam casts a shadow behind', () => {
    const area = polygonOf(svgOf([mesa, lamp]), 'data-lit="luz"')
    expect(insidePolygon({ x: 4, y: 3.5 }, area)).toBe(true)
    expect(insidePolygon({ x: 4, y: 2 }, area)).toBe(false)
  })

  it('a lamp standing on a table still lights the room, and an actor sitting on a sofa still gets the light', () => {
    const abajur = { ...newItem('practical', 4, 3), id: 'abajur' }
    expect(insidePolygon({ x: 4, y: 2 }, polygonOf(svgOf([mesa, abajur]), 'data-lit="abajur"'))).toBe(true)
    const sofa = { ...newItem('sofa', 4, 3), id: 'sofa' }
    const ana = { ...newItem('actor', 4, 3), id: 'ana' }
    expect(svgOf([sofa, ana, lamp])).toContain('data-actor-lit="ana"')
  })

  it('a piece shows the sides the light gets to, or is darkened when none does', () => {
    const lit = svgOf([mesa, lamp])
    expect(lit).toContain('data-prop-lit="mesa"')
    expect(lit).not.toContain('data-prop-dark')
    expect(svgOf([{ ...mesa, x: 7, y: 1 }, lamp])).toContain('data-prop-dark="mesa"')
  })
})
