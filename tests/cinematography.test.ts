import { describe, expect, it } from 'vitest'
import {
  ITEM_DEFS,
  ITEM_TYPES,
  PALETTE_TYPES,
  beamColor,
  cleanItem,
  cleanLightMap,
  effectiveKelvin,
  electricLoad,
  fieldOfView,
  gearList,
  lightMapSvg,
  lightNumbers,
  endViewOf,
  moveDistance,
  panAngleOf,
  trackRadius,
  trackVia,
  moveEndOf,
  movePath,
  moveRotOf,
  moveViaOf,
  hasPath,
  segRadius,
  stopName,
  stopRot,
  stopsOf,
  moveText,
  loadText,
  newItem,
  newLightMap,
  sheetRows,
  LIGHT_COLUMNS,
  CAMERA_COLUMNS,
  spreadOf,
  techSummary
} from '../src/shared/lightmap'
import { cleanFrame, shotText } from '../src/shared/storyboard'
import { buildReports } from '../src/shared/reports'
import { lightAutoLines } from '../src/shared/equipment'
import { buildPdfHtml } from '../src/main/pdf'
import type { LightMap, Script } from '../src/shared/types'

describe('equipment', () => {
  it('has the fixtures a lighting crew asks for, each drawn as valid SVG', () => {
    for (const t of ['par', 'ellipsoidal', 'tube', 'kino', 'chinaball', 'dedo', 'skypanel', 'moon', 'overhead', 'cookie', 'haze', 'generator'] as const) {
      expect(ITEM_TYPES).toContain(t)
    }
    const map: LightMap = { ...newLightMap('Todos'), width: 30, height: 30, items: ITEM_TYPES.map((t, i) => newItem(t, 1 + (i % 10) * 2.5, 1 + Math.floor(i / 10) * 6)) }
    const svg = lightMapSvg(map, { legend: true })
    expect(svg).not.toMatch(/NaN|undefined/)
    expect(svg.match(/<g transform="translate\(/g)?.length).toBeGreaterThanOrEqual(ITEM_TYPES.length)
  })
})

describe('technical sheet of the lights', () => {
  it('a new light starts with the usual power and colour of the fixture', () => {
    expect(newItem('fresnel', 1, 1)).toEqual(expect.objectContaining({ watts: 1000, kelvin: 3200 }))
    expect(newItem('hmi', 1, 1)).toEqual(expect.objectContaining({ watts: 1800, kelvin: 5600 }))
    expect(newItem('table', 1, 1).watts).toBeUndefined()
  })

  it('a gel moves the colour temperature, and the beam is drawn warm or cool', () => {
    const tungsten = { ...newItem('fresnel', 1, 1), kelvin: 3200 }
    expect(effectiveKelvin({ ...tungsten, gel: 'CTB' })).toBe(5500)
    expect(effectiveKelvin({ ...newItem('hmi', 1, 1), gel: 'cto' })).toBe(2950)
    expect(effectiveKelvin({ ...tungsten, gel: 'ND 0.6' })).toBe(3200)
    expect(beamColor(tungsten)).not.toBe(beamColor({ ...tungsten, gel: 'CTB' }))
    expect(beamColor(newItem('moon', 1, 1))).toBe(beamColor(newItem('hmi', 1, 1))) // both cool
  })

  it('numbers the lights in the order they were placed, and only the lights', () => {
    const m: LightMap = { ...newLightMap(), items: [newItem('camera', 1, 1), newItem('fresnel', 2, 2), newItem('table', 3, 3), newItem('led', 4, 4)] }
    expect([...lightNumbers(m).values()]).toEqual([1, 2])
    expect(lightMapSvg(m)).toContain('>2</text>')
  })

  it('keeps the sheet in the file and drops anything out of range', () => {
    const raw = { type: 'fresnel', x: 1, y: 1, rotation: 0, label: 'Key', watts: 2000, kelvin: 99999, gel: 'CTO', diffusion: '216', intensity: 150, height: 2.4, role: 'key' }
    expect(cleanItem(raw as never, 8, 6)).toEqual(expect.objectContaining({ watts: 2000, kelvin: 20000, gel: 'CTO', diffusion: '216', intensity: 100, height: 2.4, role: 'key' }))
    expect(cleanItem({ ...raw, role: 'chefe' } as never, 8, 6)?.role).toBeUndefined()
    // a table has no technical sheet
    expect(cleanItem({ ...raw, type: 'table' } as never, 8, 6)?.watts).toBeUndefined()
    expect(techSummary(cleanItem(raw as never, 8, 6)!)).toBe('Principal · 2000 W · 20000 K · CTO · 216')
  })
})

describe('camera', () => {
  it('the angle of view comes from the lens and the sensor', () => {
    expect(fieldOfView(35, 's35')).toBe(39)
    expect(fieldOfView(35, 'ff')).toBe(54)
    expect(fieldOfView(50, 'ff')).toBe(40)
    const cam = { ...newItem('camera', 1, 1), spread: 90 }
    expect(spreadOf(cam)).toBe(90) // no lens: the angle set by hand
    expect(spreadOf({ ...cam, lens: 35, sensor: 'ff' as const })).toBe(54)
    expect(cleanItem({ type: 'camera', x: 1, y: 1, lens: 2, sensor: 'imax', shot: 'Plano médio', move: 'Travelling', height: 1.5 } as never, 8, 6)).toEqual(
      expect.objectContaining({ lens: 4, shot: 'Plano médio', move: 'Travelling', height: 1.5 })
    )
  })
})

describe('equipment list and electrical load', () => {
  const maps: LightMap[] = [
    { ...newLightMap('Cozinha'), items: [newItem('fresnel', 1, 1), newItem('fresnel', 2, 1), { ...newItem('fresnel', 3, 1), watts: 650 }, newItem('sun', 4, 1), newItem('camera', 5, 5)] },
    { ...newLightMap('Rua'), items: [newItem('hmi', 1, 1), newItem('fresnel', 2, 2)] }
  ]

  it('counts what to rent by fixture and power, across maps, leaving natural light out', () => {
    expect(gearList(maps).map((g) => [g.name, g.watts, g.count, g.maps])).toEqual([
      ['Fresnel', 1000, 3, ['Cozinha', 'Rua']],
      ['Fresnel', 650, 1, ['Cozinha']],
      ['HMI', 1800, 1, ['Rua']]
    ])
  })

  it('gives the current at 127 V and 220 V', () => {
    expect(electricLoad(5450)).toEqual({ watts: 5450, a127: 42.9, a220: 24.8 })
    expect(loadText(3250)).toBe('3.250 W · 25,6 A em 127 V · 14,8 A em 220 V')
  })

  it('goes into Relatórios and into the PDF as a technical sheet after each map', () => {
    const script: Script = { titlePage: { title: 'T', author: '', contact: '' }, blocks: [{ kind: 'scene_heading', text: 'INT. A - DIA' }], lightMaps: maps }
    const r = buildReports(script).find((x) => x.id === 'equipamento')
    expect(r?.rows.at(-3)).toEqual(['Total', '', 5, 5450, ''])
    expect(r?.rows.at(-2)).toEqual(['Corrente em 127 V', '', '', '42,9 A', ''])
    const html = buildPdfHtml(script, { lightMapsOnly: true })
    expect(html.match(/FICHA TÉCNICA/g)).toHaveLength(2)
    expect(html).toContain('Carga deste mapa:</b> 2.650 W · 20,9 A em 127 V')
    expect(sheetRows(maps[0]).cameras).toHaveLength(1)
    // a map with only furniture has no technical sheet
    expect(buildPdfHtml({ ...script, lightMaps: [{ ...newLightMap('Vazio'), items: [newItem('table', 1, 1)] }] }, { lightMapsOnly: true })).not.toContain('FICHA TÉCNICA')
    expect(cleanLightMap(JSON.parse(JSON.stringify(maps[0])))?.items[2].watts).toBe(650)
  })
})

describe('shot list', () => {
  it('each frame keeps its shot, angle, movement and lens, and they make the shot list', () => {
    const f = cleanFrame({ id: 'f', image: '', caption: 'Marina na janela', scene: '3', shot: 'Plano médio', angle: 'Plongée', move: 'Travelling', lens: 35 })
    expect(f).toEqual(expect.objectContaining({ shot: 'Plano médio', angle: 'Plongée', move: 'Travelling', lens: 35 }))
    expect(shotText(f!)).toBe('Plano médio · Plongée · Travelling · 35 mm')
    expect(cleanFrame({ id: 'g', image: '', caption: '', scene: '', lens: 9999, shot: '  ' })).not.toHaveProperty('lens')
    const script: Script = {
      titlePage: { title: '', author: '', contact: '' },
      blocks: [{ kind: 'scene_heading', text: 'INT. A - DIA' }],
      storyboard: { frames: [f!, { id: 'g', image: '', caption: '', scene: '' }], aspect: '16:9', layout: 6, includeInPdf: true }
    }
    expect(buildReports(script).find((x) => x.id === 'planos')?.rows).toEqual([
      ['3', 1, 'Plano médio', 'Plongée', 'Travelling', '35 mm', 'Marina na janela'],
      ['—', 2, '—', '—', '—', '—', '—']
    ])
    expect(buildPdfHtml(script, { storyboardOnly: true })).toContain('1 · Cena 3 · Plano médio · Plongée · Travelling · 35 mm')
  })
})

void ITEM_DEFS

describe('camera movement on the map', () => {
  const cam = (patch: object) => ({ ...newItem('camera', 4, 4), label: 'A', ...patch })
  const draw = (patch: object, interactive = false): string =>
    lightMapSvg({ ...newLightMap(), width: 10, height: 10, items: [cam(patch)] }, { interactive, selectedId: interactive ? 'x' : null })

  it('a moving camera goes along a path to a faint camera where it ends, A to A′', () => {
    const svg = draw({ move: 'Travelling', moveTo: { x: 7, y: 4 } })
    expect(svg).toContain('opacity="0.4"')
    expect(svg).toContain('>A2</text>') // the point where it ends
    expect(svg).toMatch(/<polyline points="0,7 [^"]* 180,7"/) // a rail, 3 m to the right
    expect(moveText(cam({ move: 'Travelling', moveTo: { x: 7, y: 8 } }))).toBe('Travelling · 5 m')
  })

  it('until it is dragged, the end is 2 m the usual way of the movement, from where the camera points', () => {
    expect(moveEndOf(cam({ move: 'Dolly in' }))).toEqual({ x: 4, y: 2 })
    expect(moveEndOf(cam({ move: 'Dolly out' }))).toEqual({ x: 4, y: 6 })
    expect(moveEndOf(cam({ move: 'Travelling' }))).toEqual({ x: 6, y: 4 })
    expect(moveEndOf(cam({ move: 'Dolly in', rotation: 90 }))).toEqual({ x: 6, y: 4 }) // pointing right, it goes right
    expect(draw({ move: 'Drone' })).toContain('>DRONE</text>')
  })

  it('in the editor, the end can be grabbed', () => {
    const svg = lightMapSvg({ ...newLightMap(), items: [{ ...cam({ move: 'Dolly in' }), id: 'c1' }] }, { interactive: true })
    expect(svg).toContain('data-move-end="c1|0"')
    expect(lightMapSvg({ ...newLightMap(), items: [{ ...cam({ move: 'Dolly in' }), id: 'c1' }] })).not.toContain('data-move-end')
  })

  it('a pan is an arc with its angle; tilt and zoom are written by the camera; a fixed camera draws nothing more', () => {
    expect(draw({ move: 'Panorâmica', panAngle: 90 })).toMatch(/<path d="M 0 -36 A 36 36 0 0 1 36 0"/)
    expect(moveText(cam({ move: 'Panorâmica', panAngle: -45 }))).toBe('Panorâmica · -45°')
    expect(draw({ move: 'Tilt' })).toContain('>TILT</text>')
    expect(draw({ move: 'Fixa' })).toBe(draw({}))
  })

  it('keeps the end in the file, inside the map; the old crane, gimbal and slider pieces are gone', () => {
    const back = cleanItem({ type: 'camera', x: 1, y: 1, move: 'Travelling', moveTo: { x: 99, y: 2 }, panAngle: 500 } as never, 8, 6)
    expect(back).toEqual(expect.objectContaining({ moveTo: { x: 8, y: 2 }, panAngle: 180 }))
    expect(cleanItem({ type: 'camera', x: 1, y: 1, moveTo: 'ali' } as never, 8, 6)?.moveTo).toBeUndefined()
    for (const t of ['crane', 'gimbal', 'slider']) expect(ITEM_TYPES).not.toContain(t)
    expect(sheetRows({ ...newLightMap(), items: [cam({ move: 'Travelling' })] }).cameras[0][7]).toBe('Travelling · 2 m')
  })
})

describe('rotation handle', () => {
  it('the selected piece has a knob where it points, only in the editor', () => {
    const it = { ...newItem('fresnel', 2, 2), id: 'f1' }
    const map = { ...newLightMap(), items: [it] }
    expect(lightMapSvg(map, { interactive: true, selectedId: 'f1' })).toContain('data-rotate="f1"')
    expect(lightMapSvg(map, { interactive: true, selectedId: null })).not.toContain('data-rotate')
    expect(lightMapSvg(map, { selectedId: 'f1' })).not.toContain('data-rotate')
  })
})

describe('the camera at the end and a curved path', () => {
  const cam = (patch: object) => ({ ...newItem('camera', 2, 5), id: 'c1', label: 'A', move: 'Steadicam / gimbal', moveTo: { x: 6, y: 5 }, ...patch })

  it('the path is straight until its middle is dragged, then curves through that point', () => {
    expect(moveViaOf(cam({}))).toEqual({ x: 4, y: 5 })
    expect(moveDistance(cam({}))).toBe(4)
    const bent = cam({ moveVia: { x: 4, y: 3 } })
    const mid = movePath(bent).points[16]
    expect(mid[0]).toBeCloseTo(4)
    expect(mid[1]).toBeCloseTo(3)
    expect(moveDistance(bent)).toBeGreaterThan(4.5)
  })

  it('the camera at the end turns on its own, and has its own field of view', () => {
    expect(moveRotOf(cam({ rotation: 30 }))).toBe(30)
    expect(moveRotOf(cam({ rotation: 30, moveRot: 270 }))).toBe(270)
    const svg = lightMapSvg({ ...newLightMap(), width: 10, height: 8, items: [cam({ moveRot: 90 })] })
    // 4 m to the right, turned 90°, faint; its field of view (the polygon) is drawn with the others, over every piece
    expect(svg).toContain('<g transform="translate(240 0)"><g transform="rotate(90)"><g opacity="0.4"><rect')
    expect(svg).toContain('<g transform="translate(240 0) rotate(90)"><g opacity="0.4"><polygon')
  })

  it('in the editor, the selected camera shows the knob of the end camera and the middle of the path', () => {
    const map = { ...newLightMap(), width: 10, height: 8, items: [cam({})] }
    const svg = lightMapSvg(map, { interactive: true, selectedId: 'c1' })
    expect(svg).toContain('data-rotate-end="c1|0"')
    expect(svg).toContain('data-move-via="c1|0"')
    expect(lightMapSvg(map, { interactive: true, selectedId: null })).not.toContain('data-move-via')
  })

  it('keeps both in the file', () => {
    const back = cleanItem({ type: 'camera', x: 1, y: 1, move: 'Travelling', moveVia: { x: 3, y: -4 }, moveRot: -90 } as never, 8, 6)
    expect(back).toEqual(expect.objectContaining({ moveVia: { x: 3, y: 0 }, moveRot: 270 }))
  })
})

describe('pan, track, dolly and zoom', () => {
  const cam = (patch: object) => ({ ...newItem('camera', 4, 4), id: 'c1', lens: 35, sensor: 's35' as const, range: 3.5, ...patch })

  it('a pan has a faint camera in the same place, turned to where it ends, with its own knob', () => {
    expect(panAngleOf(cam({ move: 'Panorâmica' }))).toBe(60) // until it is turned
    expect(moveRotOf(cam({ move: 'Panorâmica', rotation: 330 }))).toBe(30)
    expect(panAngleOf(cam({ move: 'Panorâmica', rotation: 10, moveRot: 280 }))).toBe(-90)
    expect(moveEndOf(cam({ move: 'Panorâmica' }))).toEqual({ x: 4, y: 4 })
    const svg = lightMapSvg({ ...newLightMap(), width: 10, height: 8, items: [cam({ move: 'Panorâmica', moveRot: 90 })] }, { interactive: true, selectedId: 'c1' })
    expect(svg).toContain('<g transform="rotate(90)"><g opacity="0.4" pointer-events="none">')
    expect(svg).toContain('data-rotate-end="c1"')
    expect(svg).not.toContain('data-move-end') // it does not move
  })

  it('a travelling or dolly curves only as an arc of a circle, its middle sliding across the track', () => {
    const t = cam({ move: 'Travelling', moveTo: { x: 8, y: 4 } })
    // dragged anywhere, the middle stays on the line that halves the track
    const from = { x: 4, y: 4 }
    const to = { x: 8, y: 4 }
    expect(trackVia(from, to, { x: 7, y: 2 })).toEqual({ x: 6, y: 2 })
    expect(trackVia(from, to, { x: 5, y: 4.05 })).toBeUndefined() // close to straight: straight
    void t
    const curved = { ...t, moveVia: { x: 6, y: 2 } }
    expect(trackRadius(curved)).toBe(2) // a half circle around (6, 4)
    for (const [x, y] of movePath(curved).points) expect(Math.hypot(x - 6, y - 4)).toBeCloseTo(2)
    expect(moveText(curved)).toBe('Travelling · 6,3 m · curva de raio 2 m')
    // other movements still bend freely
    expect(trackRadius({ ...curved, move: 'Steadicam / gimbal' })).toBeNull()
  })

  it('a dolly keeps the framing: back is a longer lens and range, closer a shorter one', () => {
    const out = endViewOf(cam({ move: 'Dolly out' }))!
    expect(out.range).toBe(5.5)
    expect(out.lens).toBeGreaterThan(50)
    expect(out.lens).toBeLessThan(60)
    const inn = endViewOf(cam({ move: 'Dolly in' }))!
    expect(inn.range).toBe(1.5)
    expect(inn.lens).toBeLessThan(20)
    // the frame is as wide where both views reach
    const width = (spread: number, range: number): number => 2 * range * Math.tan((spread * Math.PI) / 360)
    expect(width(out.spread, out.range)).toBeCloseTo(width(39, 3.5), 0)
    expect(moveText(cam({ move: 'Dolly out' }))).toBe('Dolly out · 2 m · lente 35 → 55 mm')
  })

  it('a zoom pulled further reaches further with a longer lens, and the handle is where the view ends', () => {
    const near = endViewOf(cam({ move: 'Zoom', endRange: 3.5 }))!
    const far = endViewOf(cam({ move: 'Zoom', endRange: 7 }))!
    expect(near.lens).toBe(35)
    expect(far.lens).toBeGreaterThan(65)
    expect(far.spread).toBeLessThan(near.spread)
    expect(moveText(cam({ move: 'Zoom', endRange: 7 }))).toBe('Zoom · lente 35 → 70 mm') // twice the reach, twice the lens
    const svg = lightMapSvg({ ...newLightMap(), width: 10, height: 10, items: [cam({ move: 'Zoom', endRange: 7 })] }, { interactive: true, selectedId: 'c1' })
    expect(svg).toContain('data-zoom-end="c1"')
    expect(svg).toContain('y="-425"') // the handle, 7 m along the view
    expect(cleanItem({ type: 'camera', x: 1, y: 1, move: 'Zoom', endRange: 99 } as never, 8, 6)?.endRange).toBe(30)
    // a turn left over from a pan does not turn a zoom
    expect(moveRotOf(cam({ move: 'Zoom', moveRot: 270 }))).toBe(0)
  })
})

describe('points of movement, for the camera and for the actors', () => {
  const cam = (patch: object) => ({ ...newItem('camera', 1, 5), id: 'c1', label: 'A', move: 'Steadicam / gimbal', ...patch })

  it('a camera goes through every point, each turned its own way, named A2, A3...', () => {
    const c = cam({ movePoints: [{ x: 4, y: 5, rot: 90 }, { x: 4, y: 2 }, { x: 7, y: 2, rot: 180 }] })
    expect(stopsOf(c)).toHaveLength(3)
    expect([0, 1, 2].map((k) => stopRot(c, k))).toEqual([90, 90, 180]) // a point with no turn keeps the one before
    expect([0, 1, 2].map((k) => stopName(c, k))).toEqual(['A2', 'A3', 'A4'])
    expect(moveDistance(c)).toBe(9)
    expect(moveEndOf(c)).toEqual({ x: 7, y: 2 })
    expect(moveText(c)).toBe('Steadicam / gimbal · 9 m · 4 pontos')
    const svg = lightMapSvg({ ...newLightMap(), width: 10, height: 8, items: [c] }, { interactive: true, selectedId: 'c1' })
    for (const k of [0, 1, 2]) {
      expect(svg).toContain(`data-move-end="c1|${k}"`)
      expect(svg).toContain(`data-rotate-end="c1|${k}"`)
      expect(svg).toContain(`data-move-via="c1|${k}"`)
    }
    expect(svg.match(/opacity="0.4"/g)).toHaveLength(6) // three faint cameras and their three fields of view
    expect(svg).toContain('>A4</text>')
  })

  it('each stretch of a track curves on its own, always as an arc', () => {
    const t = cam({ move: 'Travelling', movePoints: [{ x: 5, y: 5, via: { x: 3, y: 3 } }, { x: 9, y: 5 }] })
    expect(segRadius(t, 0)).toBe(2)
    expect(segRadius(t, 1)).toBeNull()
    expect(moveText(t)).toBe('Travelling · 10,3 m · 3 pontos · curva de raio 2 m')
  })

  it('an actor has marks: the actor again, faint, at each one, with arrows of another colour', () => {
    const actor = { ...newItem('actor', 2, 2), id: 'm1', label: 'Marina' }
    expect(hasPath(actor)).toBe(false)
    const walking = { ...actor, movePoints: [{ x: 5, y: 2, rot: 90 }, { x: 5, y: 5 }] }
    expect(hasPath(walking)).toBe(true)
    expect(stopName(walking, 0)).toBe('Marina 2')
    expect(techSummary(walking)).toBe('Marcação · 3 marcas · 6 m')
    const svg = lightMapSvg({ ...newLightMap(), width: 8, height: 8, items: [walking] })
    expect(svg).toContain('>Marina 3</text>')
    expect(svg).toContain('fill="#c2410c"') // the arrow heads of the blocking
    expect(svg.match(/opacity="0.4"/g)).toHaveLength(2)
  })

  it('keeps the points in the file; a single end of the older way still reads as one point', () => {
    const back = cleanItem({ type: 'actor', x: 1, y: 1, movePoints: [{ x: 3, y: 99, rot: 450, via: { x: 2, y: 2 } }, 'lixo', { x: 4 }] } as never, 8, 6)
    expect(back?.movePoints).toEqual([{ x: 3, y: 6, rot: 90, via: { x: 2, y: 2 } }])
    const old = cam({ move: 'Dolly in', moveTo: { x: 1, y: 3 }, moveRot: 45 })
    expect(stopsOf(old)).toEqual([{ x: 1, y: 3, rot: 45 }])
  })
})

describe('pieces offered for a light map', () => {
  it('leaves out the C-stand and the track (the camera movements draw it), but old maps still show them', () => {
    expect(PALETTE_TYPES).not.toContain('cstand')
    expect(PALETTE_TYPES).not.toContain('dolly')
    for (const t of ['haze', 'monitor', 'generator'] as const) expect(ITEM_DEFS[t].group).toBe('Set e energia')
    const old = cleanItem({ type: 'cstand', x: 1, y: 1 } as never, 8, 6)
    expect(old?.type).toBe('cstand')
    expect(lightMapSvg({ ...newLightMap(), items: [old!, newItem('dolly', 3, 3)] }, { legend: true })).toContain('Trilho / dolly')
  })
  it('a table has a length and a width, kept within limits and drawn to scale', () => {
    expect(newItem('table', 2, 2)).toMatchObject({ length: 1.2, depth: 0.8 })
    // a table from an older map, saved without its sides, gets the usual ones
    expect(cleanItem({ id: 't', type: 'table', x: 1, y: 1, rotation: 0, label: '' }, 8, 6)).toMatchObject({ length: 1.2, depth: 0.8 })
    expect(cleanItem({ id: 't', type: 'table', x: 1, y: 1, rotation: 0, label: '', length: 99, depth: 0 }, 8, 6)).toMatchObject({ length: 30, depth: 0.2 })
    // only the table has a width
    expect(cleanItem({ id: 'w', type: 'wall', x: 1, y: 1, rotation: 0, label: '', depth: 2 } as never, 8, 6)).not.toHaveProperty('depth')
    const svg = lightMapSvg({ ...newLightMap(), items: [{ ...newItem('table', 3, 3), length: 2, depth: 1 }] })
    expect(svg).toContain('width="120" height="60"') // 60 px per metre
  })

  it("the cameras' fields of view are drawn over every piece and take no clicks; a light's beam stays with the light", () => {
    const camera = { ...newItem('camera', 2, 5), id: 'c' }
    const actor = { ...newItem('actor', 2, 3), id: 'a' }
    const wall = { ...newItem('wall', 2, 2), id: 'w' }
    const light = { ...newItem('fresnel', 6, 5), id: 'l' }
    const svg = lightMapSvg({ ...newLightMap(), width: 10, height: 8, items: [camera, actor, wall, light] }, { interactive: true })
    const layer = svg.indexOf('<g pointer-events="none">')
    expect(layer).toBeGreaterThan(svg.indexOf('data-item="a"')) // after the actor, drawn after the camera
    expect(layer).toBeGreaterThan(svg.indexOf('data-item="w"'))
    expect(svg.slice(layer)).toContain('fill="#2f6fe0" fill-opacity="0.16"') // the camera's blue view
    const cameraPiece = svg.slice(svg.indexOf('data-item="c"'), svg.indexOf('data-item="a"'))
    expect(cameraPiece).not.toContain('fill-opacity="0.16"')
    expect(svg.slice(svg.indexOf('data-item="l"'), layer)).toContain('fill-opacity="0.16"') // the light's beam
  })
})

describe('the model of a piece of equipment', () => {
  const m = (items: LightMap['items']): LightMap => ({ ...newLightMap('Set'), items })
  it('is kept for equipment (lights, cameras, modifiers, set and power) and not for actors or scenery', () => {
    expect(cleanItem({ ...newItem('fresnel', 1, 1), model: '  Arri 650 Plus ' }, 6, 4)?.model).toBe('Arri 650 Plus')
    expect(cleanItem({ ...newItem('camera', 1, 1), model: 'Sony FX6' }, 6, 4)?.model).toBe('Sony FX6')
    expect(cleanItem({ ...newItem('monitor', 1, 1), model: 'SmallHD 703' }, 6, 4)?.model).toBe('SmallHD 703')
    expect(cleanItem({ ...newItem('actor', 1, 1), model: 'x' }, 6, 4)?.model).toBeUndefined()
    expect(cleanItem({ ...newItem('wall', 1, 1), model: 'x' }, 6, 4)?.model).toBeUndefined()
  })

  it('shows in the technical sheet', () => {
    const rows = sheetRows(m([{ ...newItem('fresnel', 1, 1), model: 'Arri 650 Plus' }, { ...newItem('camera', 2, 2), model: 'Sony FX6' }]))
    expect(LIGHT_COLUMNS.slice(0, 3)).toEqual(['Nº', 'Aparelho', 'Modelo'])
    expect(rows.lights[0][2]).toBe('Arri 650 Plus')
    expect(CAMERA_COLUMNS.slice(0, 2)).toEqual(['Câmera', 'Modelo'])
    expect(rows.cameras[0][1]).toBe('Sony FX6')
  })

  it('separates lines of the equipment list, which also has cameras, modifiers and set pieces', () => {
    const maps = [m([{ ...newItem('fresnel', 1, 1), model: 'Arri 650 Plus', watts: 650 }, { ...newItem('fresnel', 2, 1), watts: 650 }, { ...newItem('camera', 3, 3), model: 'Sony FX6' }, newItem('flag', 1, 2), newItem('flag', 2, 2), newItem('actor', 1, 1), newItem('wall', 1, 1)])]
    expect(lightAutoLines(maps).map((l) => [l.name, l.qty])).toEqual([
      ['Câmera · Sony FX6', 1],
      ['Fresnel 650 W · Arri 650 Plus', 1],
      ['Fresnel 650 W', 1],
      ['Bandeira (negativo)', 2]
    ])
    expect(gearList(maps).map((g) => g.name)).toEqual(['Fresnel · Arri 650 Plus', 'Fresnel'])
  })
})
