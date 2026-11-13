import type { LightItem, LightItemType, LightMap, LightRole, MoveStop, SensorId } from './types'
import { newId } from './structures'

/** Pixels per metre in the drawing's own coordinate system. */
export const S = 60

export interface ItemDef {
  name: string
  group: 'Câmera' | 'Elenco' | 'Luzes' | 'Modificadores' | 'Set e energia' | 'Cenário'
  /** Not offered in the list of pieces any more; maps that already have it still show it. */
  retired?: boolean
  /** Beam or field of view. */
  cone?: { spread: number; range: number; color: string }
  length?: number
  /** Pieces with two sides (a table): the second one, in metres. */
  depth?: number
  /** Short note shown in the palette. */
  hint: string
  /** Lights: usual power (W) and colour temperature (K) of the fixture, the starting values of a new one. */
  watts?: number
  kelvin?: number
}

export const ITEM_DEFS: Record<LightItemType, ItemDef> = {
  camera: { name: 'Câmera', group: 'Câmera', cone: { spread: 40, range: 3.5, color: '#2f6fe0' }, hint: 'Campo de visão' },
  actor: { name: 'Ator ou atriz', group: 'Elenco', hint: 'Marca no chão, aponta para onde olha' },
  fresnel: { name: 'Fresnel', group: 'Luzes', cone: { spread: 35, range: 3, color: '#d99a00' }, hint: 'Foco com abertura ajustável', watts: 1000, kelvin: 3200 },
  led: { name: 'Painel LED', group: 'Luzes', cone: { spread: 60, range: 2.5, color: '#d99a00' }, hint: 'Luz suave e leve', watts: 200, kelvin: 5600 },
  hmi: { name: 'HMI', group: 'Luzes', cone: { spread: 30, range: 4.5, color: '#d99a00' }, hint: 'Luz forte tipo dia', watts: 1800, kelvin: 5600 },
  softbox: { name: 'Softbox', group: 'Luzes', cone: { spread: 70, range: 2.5, color: '#d99a00' }, hint: 'Luz suave de caixa', watts: 500, kelvin: 3200 },
  practical: { name: 'Luz prática', group: 'Luzes', hint: 'Abajur, lâmpada ou vela que aparece em cena', watts: 60, kelvin: 2700 },
  sun: { name: 'Sol ou janela', group: 'Luzes', cone: { spread: 14, range: 5, color: '#e0a800' }, hint: 'Luz natural entrando', watts: 0, kelvin: 5600 },
  par: { name: 'PAR', group: 'Luzes', cone: { spread: 24, range: 4, color: '#d99a00' }, hint: 'Facho forte e concentrado', watts: 1000, kelvin: 3200 },
  ellipsoidal: { name: 'Elipsoidal (Leko)', group: 'Luzes', cone: { spread: 19, range: 5, color: '#d99a00' }, hint: 'Recorte preciso, projeta gobos', watts: 750, kelvin: 3200 },
  tube: { name: 'Tubo de LED', group: 'Luzes', cone: { spread: 120, range: 1.5, color: '#d99a00' }, length: 1.2, hint: 'Bastão de LED, cor ajustável', watts: 75, kelvin: 5600 },
  kino: { name: 'Kino Flo', group: 'Luzes', cone: { spread: 90, range: 2, color: '#d99a00' }, hint: 'Fluorescente suave', watts: 220, kelvin: 5600 },
  chinaball: { name: 'Balão chinês', group: 'Luzes', hint: 'Luz suave para todos os lados', watts: 250, kelvin: 3200 },
  dedo: { name: 'Dedolight', group: 'Luzes', cone: { spread: 25, range: 2.5, color: '#d99a00' }, hint: 'Pequeno refletor de precisão', watts: 150, kelvin: 3200 },
  skypanel: { name: 'Painel LED grande', group: 'Luzes', cone: { spread: 100, range: 3, color: '#d99a00' }, hint: 'SkyPanel e similares: suave e potente', watts: 450, kelvin: 5600 },
  moon: { name: 'Luz de lua', group: 'Luzes', cone: { spread: 20, range: 6, color: '#5b7fc4' }, hint: 'Efeito de luar, ambiente noturno', watts: 0, kelvin: 7000 },
  flag: { name: 'Bandeira (negativo)', group: 'Modificadores', length: 0.9, hint: 'Corta luz' },
  diffuser: { name: 'Difusor', group: 'Modificadores', length: 0.9, hint: 'Suaviza a luz' },
  reflector: { name: 'Rebatedor', group: 'Modificadores', length: 0.9, hint: 'Rebate luz de volta' },
  bounce: { name: 'Bounce (isopor)', group: 'Modificadores', length: 1.2, hint: 'Painel branco de preenchimento' },
  overhead: { name: 'Butterfly / overhead', group: 'Modificadores', length: 3.6, hint: 'Quadro grande sobre a cena: seda, difusão ou negativo' },
  cookie: { name: 'Cucoloris', group: 'Modificadores', length: 0.9, hint: 'Recorte que projeta sombras (folhas, janela)' },
  // every light and flag already stands on one: drawing it apart only crowds the plot
  cstand: { name: 'C-stand', group: 'Set e energia', hint: 'Tripé de ferragem', retired: true },
  monitor: { name: 'Monitor (video assist)', group: 'Set e energia', hint: 'Onde fica a video village, fora do quadro e sem sombra na cena' },
  haze: { name: 'Máquina de fumaça', group: 'Set e energia', hint: 'Fumaça ou haze para dar volume à luz' },
  generator: { name: 'Gerador', group: 'Set e energia', hint: 'Fonte de energia, para planejar os cabos' },
  // the camera's Travelling and Dolly movements draw the track now
  dolly: { name: 'Trilho / dolly', group: 'Set e energia', length: 3, hint: 'Movimento de câmera', retired: true },
  table: { name: 'Mesa', group: 'Cenário', length: 1.2, depth: 0.8, hint: 'Móvel, com comprimento e largura' },
  chair: { name: 'Cadeira', group: 'Cenário', hint: 'Móvel' },
  door: { name: 'Porta', group: 'Cenário', length: 0.9, hint: 'Abertura na parede' },
  window: { name: 'Janela', group: 'Cenário', length: 1.2, hint: 'Abertura na parede' },
  wall: { name: 'Parede', group: 'Cenário', length: 4, hint: 'Limite do cenário' }
}

export const ITEM_TYPES = Object.keys(ITEM_DEFS) as LightItemType[]

export const isLight = (t: LightItemType): boolean => ITEM_DEFS[t].group === 'Luzes'
/** Pieces that are equipment to rent or bring (lights, cameras, modifiers, set and power): they have a model. */
export const hasModel = (t: LightItemType): boolean => ['Luzes', 'Câmera', 'Modificadores', 'Set e energia'].includes(ITEM_DEFS[t].group)

// ---------------------------------------------------------------- the technical sheet

export const ROLES: { id: LightRole; label: string }[] = [
  { id: 'key', label: 'Principal' },
  { id: 'fill', label: 'Preenchimento' },
  { id: 'back', label: 'Contra' },
  { id: 'rim', label: 'Recorte' },
  { id: 'background', label: 'Fundo' },
  { id: 'practical', label: 'Prática' },
  { id: 'ambient', label: 'Ambiente' },
  { id: 'effect', label: 'Efeito' }
]
export const roleLabel = (r: LightRole | undefined): string => ROLES.find((x) => x.id === r)?.label ?? ''

/** Common gels, with how far each moves the colour (in mireds; positive = warmer). */
export const GELS: { name: string; mired: number }[] = [
  { name: 'CTO', mired: 159 },
  { name: '1/2 CTO', mired: 81 },
  { name: '1/4 CTO', mired: 42 },
  { name: '1/8 CTO', mired: 20 },
  { name: 'CTB', mired: -131 },
  { name: '1/2 CTB', mired: -68 },
  { name: '1/4 CTB', mired: -30 },
  { name: '1/8 CTB', mired: -12 },
  { name: 'Plus Green', mired: 0 },
  { name: 'Minus Green', mired: 0 },
  { name: 'ND 0.3', mired: 0 },
  { name: 'ND 0.6', mired: 0 },
  { name: 'ND 0.9', mired: 0 }
]
export const DIFFUSIONS = ['216 (Full White)', '250 (1/2 White)', '251 (1/4 White)', 'Opal', 'Grid Cloth', 'Seda', 'Frost']
export const KELVINS = [2700, 3200, 4300, 5600, 6500]

export const SENSORS: { id: SensorId; label: string; width: number }[] = [
  { id: 's35', label: 'Super 35', width: 24.89 },
  { id: 'ff', label: 'Full Frame', width: 36 },
  { id: 'apsc', label: 'APS-C', width: 23.5 },
  { id: 'mft', label: 'Micro 4/3', width: 17.3 },
  { id: 's16', label: 'Super 16', width: 12.52 }
]
export const LENSES = [14, 18, 21, 25, 28, 32, 35, 40, 50, 65, 75, 85, 100, 135]
export const MOVES = ['Fixa', 'Panorâmica', 'Tilt', 'Travelling', 'Dolly in', 'Dolly out', 'Zoom', 'Steadicam / gimbal', 'Câmera na mão', 'Grua', 'Drone']
export const ANGLES = ['Normal', 'Plongée', 'Contra-plongée', 'Zenital', 'Holandês (inclinado)', 'Nível do chão', 'Ponto de vista']
export const SHOTS = [
  'Grande plano geral',
  'Plano geral',
  'Plano conjunto',
  'Plano americano',
  'Plano médio',
  'Primeiro plano',
  'Close',
  'Plano detalhe',
  'Ponto de vista (POV)',
  'Sobre o ombro',
  'Inserto'
]

type Way = 'forward' | 'back' | 'right'

/** Movements that take the camera somewhere, with the way they usually go (for where the end starts) and how the path is drawn. */
const PATH_MOVES: Record<string, { dir: Way; style: 'track' | 'dashed' | 'wavy' | 'dotted' | 'line'; tag?: string }> = {
  Travelling: { dir: 'right', style: 'track' },
  'Dolly in': { dir: 'forward', style: 'track' },
  'Dolly out': { dir: 'back', style: 'track' },
  'Steadicam / gimbal': { dir: 'forward', style: 'dashed' },
  'Câmera na mão': { dir: 'forward', style: 'wavy' },
  Grua: { dir: 'forward', style: 'line', tag: 'GRUA' },
  Drone: { dir: 'forward', style: 'dotted', tag: 'DRONE' }
}
/** True when the movement goes from one place to another (and has a direction and a distance). */
export const isPathMove = (move: string | undefined): boolean => move !== undefined && move in PATH_MOVES
/** Travelling and dolly run on a track: the path is straight or an arc of a circle, never freehand. */
export const isTrackMove = (move: string | undefined): boolean => move === 'Travelling' || move === 'Dolly in' || move === 'Dolly out'
export const isDolly = (move: string | undefined): boolean => move === 'Dolly in' || move === 'Dolly out'

/** An angle in (-180, 180]. */
const signed = (a: number): number => {
  const d = (((a % 360) + 540) % 360) - 180
  return d === -180 ? 180 : d
}
const turn = (a: number): number => ((Math.round(a) % 360) + 360) % 360
const r2 = (n: number): number => Math.round(n * 100) / 100

/** How far a pan turns, in degrees (positive = clockwise): from the camera to where the camera at the end points. */
export const panAngleOf = (it: LightItem): number => (it.moveRot !== undefined ? signed(it.moveRot - it.rotation) : it.panAngle ?? 60)

type Pt = { x: number; y: number }

/** Whether the piece is drawn with a path: a camera whose movement goes somewhere, or an actor with marks. */
export const hasPath = (it: LightItem): boolean =>
  (it.type === 'camera' && isPathMove(it.move)) || (it.type === 'actor' && (it.movePoints?.length ?? 0) > 0)

/**
 * The points a camera or an actor goes through after where it stands: camera A → A2 → A3, actor marks 1 → 2 → 3.
 * A moving camera has at least one, 2 m the usual way for its movement until it is placed (forward for a dolly in,
 * back for a dolly out, to the right for a travelling). A single end set the older way (moveTo, moveVia) is read as one point.
 */
export function stopsOf(it: LightItem): MoveStop[] {
  if (it.movePoints && it.movePoints.length) return it.movePoints
  if (it.type !== 'camera' || !isPathMove(it.move)) return []
  let at: Pt | undefined = it.moveTo
  if (!at) {
    const way = PATH_MOVES[it.move as string].dir
    const [lx, ly] = way === 'forward' ? [0, -2] : way === 'back' ? [0, 2] : [2, 0]
    const r = (it.rotation * Math.PI) / 180
    at = { x: r2(it.x + lx * Math.cos(r) - ly * Math.sin(r)), y: r2(it.y + lx * Math.sin(r) + ly * Math.cos(r)) }
  }
  const stop: MoveStop = { x: at.x, y: at.y }
  if (it.moveRot !== undefined) stop.rot = it.moveRot
  if (it.moveVia) stop.via = it.moveVia
  return [stop]
}

/** Where a moving piece ends (its last point); a pan, a zoom or a tilt stays where it is. */
export function moveEndOf(it: LightItem): Pt {
  const s = hasPath(it) ? stopsOf(it) : []
  const last = s[s.length - 1]
  return last ? { x: last.x, y: last.y } : { x: it.x, y: it.y }
}

/** Where point k points: its own rotation, or the one before it (the piece's own for the first). */
export function stopRot(it: LightItem, k: number): number {
  const s = stopsOf(it)
  for (let i = Math.min(k, s.length - 1); i >= 0; i--) if (s[i].rot !== undefined) return s[i].rot as number
  return it.rotation
}

/** Where the camera points at the end of the movement or of the pan. */
export const moveRotOf = (it: LightItem): number =>
  // a zoom does not turn
  it.move === 'Zoom'
    ? it.rotation
    : it.move === 'Panorâmica'
      ? it.moveRot ?? turn(it.rotation + panAngleOf(it))
      : hasPath(it)
        ? stopRot(it, stopsOf(it).length - 1)
        : it.rotation

/** Where the stretch to point k starts: the piece for the first, the point before otherwise. */
export function segStart(it: LightItem, k: number): Pt {
  return k === 0 ? { x: it.x, y: it.y } : stopsOf(it)[k - 1]
}

/** The point the stretch to point k goes through halfway: where it was bent to, or the middle of the straight line. */
export function segVia(it: LightItem, k: number): Pt {
  const a = segStart(it, k)
  const b = stopsOf(it)[k]
  return b.via ?? { x: r2((a.x + b.x) / 2), y: r2((a.y + b.y) / 2) }
}

/** The point the first stretch goes through halfway (kept for older callers). */
export const moveViaOf = (it: LightItem): Pt => segVia(it, 0)

/** The circle through three points, or null when they are in a line. */
export function circleThrough(a: Pt, b: Pt, c: Pt): { x: number; y: number; r: number } | null {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y))
  if (Math.abs(d) < 1e-9) return null
  const a2 = a.x * a.x + a.y * a.y
  const b2 = b.x * b.x + b.y * b.y
  const c2 = c.x * c.x + c.y * c.y
  const x = (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d
  const y = (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d
  return { x, y, r: Math.hypot(a.x - x, a.y - y) }
}

/** One stretch as points: an arc of a circle for a curved track, otherwise a curve through its middle point. */
function segmentPoints(it: LightItem, k: number, steps: number): [number, number][] {
  const a = segStart(it, k)
  const e = stopsOf(it)[k]
  const m = segVia(it, k)
  if (isTrackMove(it.move) && e.via) {
    const c = circleThrough(a, m, e)
    if (c) {
      const a0 = Math.atan2(a.y - c.y, a.x - c.x)
      const tau = Math.PI * 2
      const ccw = (to: number): number => (((to - a0) % tau) + tau) % tau
      const toEnd = ccw(Math.atan2(e.y - c.y, e.x - c.x))
      const toMid = ccw(Math.atan2(m.y - c.y, m.x - c.x))
      const sweep = toMid < toEnd ? toEnd : toEnd - tau
      const out: [number, number][] = []
      for (let s = 0; s <= steps; s++) {
        const ang = a0 + (sweep * s) / steps
        out.push([c.x + c.r * Math.cos(ang), c.y + c.r * Math.sin(ang)])
      }
      return out
    }
  }
  // a quadratic curve whose control point makes it pass through the middle point halfway
  const cx = 2 * m.x - (a.x + e.x) / 2
  const cy = 2 * m.y - (a.y + e.y) / 2
  const out: [number, number][] = []
  for (let s = 0; s <= steps; s++) {
    const t = s / steps
    out.push([(1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * cx + t * t * e.x, (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * cy + t * t * e.y])
  }
  return out
}

/** The whole path in metres, through every point; ends[k] is where point k is in points. */
export function movePath(it: LightItem, steps = 32): { points: [number, number][]; ends: number[] } {
  const points: [number, number][] = [[it.x, it.y]]
  const ends: number[] = []
  stopsOf(it).forEach((_s, k) => {
    points.push(...segmentPoints(it, k, steps).slice(1))
    ends.push(points.length - 1)
  })
  return { points, ends }
}

/**
 * The middle point of a track stretch from a to b, from where the pointer is: it slides only across the stretch
 * (on the line that halves it), so the track stays an arc of a circle; close to the straight line it snaps straight (undefined).
 */
export function trackVia(a: Pt, b: Pt, p: Pt): Pt | undefined {
  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
  const nx = -(b.y - a.y) / len
  const ny = (b.x - a.x) / len
  const s = (p.x - mx) * nx + (p.y - my) * ny
  if (Math.abs(s) < 0.1) return undefined
  return { x: r2(mx + nx * s), y: r2(my + ny * s) }
}

/** The radius of the track stretch to point k, in metres; null when it is straight. */
export function segRadius(it: LightItem, k: number): number | null {
  const s = stopsOf(it)[k]
  if (!isTrackMove(it.move) || !s?.via) return null
  const c = circleThrough(segStart(it, k), s.via, s)
  return c ? Math.round(c.r * 10) / 10 : null
}

/** The radius of the first curved stretch of a track, or null. */
export function trackRadius(it: LightItem): number | null {
  for (let k = 0; k < stopsOf(it).length; k++) {
    const r = segRadius(it, k)
    if (r !== null) return r
  }
  return null
}

/**
 * The field of view at the end of a dolly or a zoom.
 * Dolly: the camera at the end keeps the framing of the camera at the start (the width of the frame where its view reaches),
 * so going back takes a longer lens and range, coming closer a shorter one.
 * Zoom: the view reaches as far as it is pulled (endRange), keeping that frame width, so a longer reach is a longer lens.
 */
export function endViewOf(it: LightItem): { spread: number; range: number; lens?: number } | null {
  if (it.type !== 'camera' || !(isDolly(it.move) || it.move === 'Zoom')) return null
  const r0 = it.range ?? ITEM_DEFS.camera.cone!.range
  const half = (spreadOf(it) * Math.PI) / 360
  const width = 2 * r0 * Math.tan(half)
  let r1: number
  if (it.move === 'Zoom') r1 = it.endRange ?? Math.round(r0 * 1.4 * 10) / 10
  else {
    const e = moveEndOf(it)
    const rad = (it.rotation * Math.PI) / 180
    const forward = (e.x - it.x) * Math.sin(rad) - (e.y - it.y) * Math.cos(rad)
    r1 = r0 - forward
  }
  r1 = Math.min(30, Math.max(0.3, r1))
  const half1 = Math.atan(width / (2 * r1))
  const spread = Math.min(170, Math.max(1, Math.round((half1 * 360) / Math.PI)))
  const out: { spread: number; range: number; lens?: number } = { spread, range: Math.round(r1 * 10) / 10 }
  if (it.lens) {
    const w = SENSORS.find((s) => s.id === it.sensor)?.width ?? 24.89
    out.lens = Math.round(w / (2 * Math.tan(half1)))
  }
  return out
}

/** "50 → 85 mm", or "39° → 24°" for a camera with no lens. */
function viewChange(it: LightItem): string {
  const v = endViewOf(it)
  if (!v) return ''
  return it.lens && v.lens ? `lente ${it.lens} → ${v.lens} mm` : `${spreadOf(it)}° → ${v.spread}°`
}

/** How far the piece travels along its path, through every point, in metres. */
export function moveDistance(it: LightItem): number {
  const pts = movePath(it).points
  let d = 0
  for (let k = 1; k < pts.length; k++) d += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1])
  return Math.round(d * 10) / 10
}

const dec = (v: number): string => String(v).replace('.', ',')

/**
 * "Travelling · 2 m · curva de raio 3 m", "Steadicam / gimbal · 6,4 m · 3 pontos", "Dolly out · 2 m · lente 35 → 58 mm",
 * "Panorâmica · 60°", "Zoom · lente 35 → 56 mm".
 */
export function moveText(it: LightItem): string {
  if (!it.move) return ''
  if (isPathMove(it.move)) {
    const n = stopsOf(it).length
    const radii = stopsOf(it).map((_s, k) => segRadius(it, k)).filter((r): r is number => r !== null)
    const curves = radii.length === 0 ? '' : radii.length === 1 ? `curva de raio ${dec(radii[0])} m` : `curvas de raio ${radii.map(dec).join(', ')} m`
    return [`${it.move} · ${dec(moveDistance(it))} m`, n > 1 ? `${n + 1} pontos` : '', curves, viewChange(it)].filter(Boolean).join(' · ')
  }
  if (it.move === 'Panorâmica') return `Panorâmica · ${panAngleOf(it)}°`
  if (it.move === 'Zoom') return `Zoom · ${viewChange(it)}`
  return it.move
}

/** "Marcação · 3 marcas · 4,2 m" for an actor with marks, or "". */
export function marksText(it: LightItem): string {
  if (it.type !== 'actor' || !hasPath(it)) return ''
  const n = stopsOf(it).length
  return `Marcação · ${n + 1} marcas · ${dec(moveDistance(it))} m`
}

/** Horizontal angle of view of a lens on a sensor, in whole degrees. */
export function fieldOfView(lens: number, sensor: SensorId = 's35'): number {
  const w = SENSORS.find((s) => s.id === sensor)?.width ?? 24.89
  return Math.round((2 * Math.atan(w / (2 * lens)) * 180) / Math.PI)
}

/** The beam or view angle drawn: a camera with a lens shows what the lens sees. */
export function spreadOf(it: LightItem): number {
  if (it.type === 'camera' && it.lens) return fieldOfView(it.lens, it.sensor)
  return it.spread ?? ITEM_DEFS[it.type].cone?.spread ?? 40
}

/** Colour temperature after the gel, or null when the light has none. */
export function effectiveKelvin(it: LightItem): number | null {
  const k = it.kelvin ?? ITEM_DEFS[it.type].kelvin
  if (!k) return null
  const g = GELS.find((x) => x.name.toLowerCase() === (it.gel ?? '').trim().toLowerCase())
  if (!g || g.mired === 0) return k
  return Math.round(1e6 / (1e6 / k + g.mired) / 50) * 50
}

/** Warm (tungsten), neutral or cool (daylight): the colour the beam is drawn in. */
export function beamColor(it: LightItem): string {
  const k = effectiveKelvin(it)
  if (k === null) return ITEM_DEFS[it.type].cone?.color ?? '#d99a00'
  if (k < 3800) return '#e07b00'
  if (k <= 4800) return '#b8a000'
  return '#3d8bd6'
}

/** Lights get numbers on the drawing, in the order they were placed: #1, #2... */
export function lightNumbers(map: LightMap): Map<string, number> {
  const out = new Map<string, number>()
  for (const it of map.items) if (isLight(it.type)) out.set(it.id, out.size + 1)
  return out
}
export const GROUPS: ItemDef['group'][] = ['Câmera', 'Elenco', 'Luzes', 'Modificadores', 'Set e energia', 'Cenário']

/** The pieces offered in the list, in order (retired ones are left out). */
export const PALETTE_TYPES = (Object.keys(ITEM_DEFS) as LightItemType[]).filter((t) => !ITEM_DEFS[t].retired)

export function itemHasCone(t: LightItemType): boolean {
  return ITEM_DEFS[t].cone !== undefined
}
export function itemHasLength(t: LightItemType): boolean {
  return ITEM_DEFS[t].length !== undefined
}
/** Pieces with a width as well as a length (a table). */
export function itemHasDepth(t: LightItemType): boolean {
  return ITEM_DEFS[t].depth !== undefined
}

export function newLightMap(name = 'Mapa de luz', scene = ''): LightMap {
  return { id: newId('map'), name, scene, width: 8, height: 6, items: [], notes: '', includeInPdf: true }
}

export function newItem(type: LightItemType, x: number, y: number, label = ''): LightItem {
  const d = ITEM_DEFS[type]
  const it: LightItem = { id: newId('item'), type, x, y, rotation: 0, label }
  if (d.cone) {
    it.spread = d.cone.spread
    it.range = d.cone.range
  }
  if (d.length !== undefined) it.length = d.length
  if (d.depth !== undefined) it.depth = d.depth
  if (d.watts !== undefined) it.watts = d.watts
  if (d.kelvin !== undefined) it.kelvin = d.kelvin
  if (type === 'camera') it.sensor = 's35'
  return it
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n))
const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d)

export function cleanItem(raw: Partial<LightItem>, width: number, height: number): LightItem | null {
  if (!raw || typeof raw !== 'object') return null
  if (!ITEM_TYPES.includes(raw.type as LightItemType)) return null
  const type = raw.type as LightItemType
  const d = ITEM_DEFS[type]
  const it: LightItem = {
    id: typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 80) : newId('item'),
    type,
    x: clamp(num(raw.x, width / 2), 0, width),
    y: clamp(num(raw.y, height / 2), 0, height),
    rotation: ((Math.round(num(raw.rotation, 0)) % 360) + 360) % 360,
    label: typeof raw.label === 'string' ? raw.label.slice(0, 60) : ''
  }
  if (d.cone) {
    it.spread = clamp(num(raw.spread, d.cone.spread), 5, 180)
    it.range = clamp(num(raw.range, d.cone.range), 0.5, 30)
  }
  if (d.length !== undefined) it.length = clamp(num(raw.length, d.length), 0.2, 30)
  if (d.depth !== undefined) it.depth = clamp(num(raw.depth, d.depth), 0.2, 30)
  const text = (v: unknown, max: number): string | undefined => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined)
  const opt = (v: unknown, lo: number, hi: number, round = false): number | undefined =>
    typeof v === 'number' && Number.isFinite(v) ? clamp(round ? Math.round(v) : v, lo, hi) : undefined
  const model = hasModel(type) ? text(raw.model, 80) : undefined
  if (model) it.model = model
  if (isLight(type)) {
    const extra: Partial<LightItem> = {
      watts: opt(raw.watts, 0, 24000, true),
      kelvin: opt(raw.kelvin, 1000, 20000, true),
      gel: text(raw.gel, 40),
      diffusion: text(raw.diffusion, 40),
      intensity: opt(raw.intensity, 0, 100, true),
      height: opt(raw.height, 0, 30),
      role: ROLES.some((r) => r.id === raw.role) ? raw.role : undefined
    }
    for (const [k, v] of Object.entries(extra)) if (v !== undefined) (it as unknown as Record<string, unknown>)[k] = v
  }
  if (type === 'camera') {
    const extra: Partial<LightItem> = {
      height: opt(raw.height, 0, 30),
      lens: opt(raw.lens, 4, 1200),
      sensor: SENSORS.some((s) => s.id === raw.sensor) ? raw.sensor : undefined,
      move: text(raw.move, 40),
      shot: text(raw.shot, 40),
      moveTo:
        raw.moveTo && typeof raw.moveTo === 'object' && typeof raw.moveTo.x === 'number' && typeof raw.moveTo.y === 'number' && Number.isFinite(raw.moveTo.x + raw.moveTo.y)
          ? { x: clamp(raw.moveTo.x, 0, width), y: clamp(raw.moveTo.y, 0, height) }
          : undefined,
      moveVia:
        raw.moveVia && typeof raw.moveVia === 'object' && typeof raw.moveVia.x === 'number' && typeof raw.moveVia.y === 'number' && Number.isFinite(raw.moveVia.x + raw.moveVia.y)
          ? { x: clamp(raw.moveVia.x, 0, width), y: clamp(raw.moveVia.y, 0, height) }
          : undefined,
      endRange: opt(raw.endRange, 0.3, 30),
      moveRot: typeof raw.moveRot === 'number' && Number.isFinite(raw.moveRot) ? ((Math.round(raw.moveRot) % 360) + 360) % 360 : undefined,
      panAngle: opt(raw.panAngle, -180, 180, true)
    }
    for (const [k, v] of Object.entries(extra)) if (v !== undefined) (it as unknown as Record<string, unknown>)[k] = v
  }
  if (type === 'camera' || type === 'actor') {
    const pt = (v: unknown): { x: number; y: number } | undefined => {
      const o = v as { x?: unknown; y?: unknown } | null
      return o && typeof o === 'object' && typeof o.x === 'number' && typeof o.y === 'number' && Number.isFinite(o.x + o.y)
        ? { x: clamp(o.x, 0, width), y: clamp(o.y, 0, height) }
        : undefined
    }
    if (Array.isArray(raw.movePoints)) {
      const stops: MoveStop[] = []
      for (const v of raw.movePoints.slice(0, 30)) {
        const at = pt(v)
        if (!at) continue
        const o = v as MoveStop
        const stop: MoveStop = { ...at }
        if (typeof o.rot === 'number' && Number.isFinite(o.rot)) stop.rot = ((Math.round(o.rot) % 360) + 360) % 360
        const via = pt(o.via)
        if (via) stop.via = via
        stops.push(stop)
      }
      if (stops.length) it.movePoints = stops
    }
  }
  return it
}

export function cleanLightMap(raw: Partial<LightMap>): LightMap | null {
  if (!raw || typeof raw !== 'object') return null
  const width = clamp(num(raw.width, 8), 2, 60)
  const height = clamp(num(raw.height, 6), 2, 60)
  const items = Array.isArray(raw.items)
    ? raw.items
        .slice(0, 300)
        .map((i) => cleanItem(i, width, height))
        .filter((i): i is LightItem => i !== null)
    : []
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 80) : newId('map'),
    name: typeof raw.name === 'string' ? raw.name.slice(0, 80) : 'Mapa de luz',
    scene: typeof raw.scene === 'string' ? raw.scene.slice(0, 40) : '',
    width,
    height,
    items,
    notes: typeof raw.notes === 'string' ? raw.notes.slice(0, 4000) : '',
    includeInPdf: raw.includeInPdf !== false,
    ...(typeof raw.sid === 'string' && raw.sid && raw.sid.length <= 64 ? { sid: raw.sid } : {})
  }
}

// ---------------------------------------------------------------- drawing
const INK = '#1a1a1a'
const MID = '#6b6b6b'
const FONT = "'Courier Prime', 'Courier New', monospace"

export const escapeXml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const f = (n: number): string => (Math.round(n * 100) / 100).toString()

function coneSvg(spread: number, range: number, color: string, fromY: number): string {
  const r = range * S
  const a = (spread / 2) * (Math.PI / 180)
  const lx = -Math.sin(a) * r
  const rx = Math.sin(a) * r
  const y = fromY - Math.cos(a) * r
  return (
    `<polygon points="0,${f(fromY)} ${f(lx)},${f(y)} ${f(rx)},${f(y)}" fill="${color}" fill-opacity="0.16" pointer-events="none" ` +
    `stroke="${color}" stroke-width="1" stroke-dasharray="5 4"/>`
  )
}

/** Symbol of one item in local coordinates, pointing up. Returns markup with no transform. */
function symbolSvg(it: LightItem): string {
  const d = ITEM_DEFS[it.type]
  const len = (it.length ?? d.length ?? 1) * S
  const stroke = `stroke="${INK}" stroke-width="1.6"`
  switch (it.type) {
    case 'camera':
      return (
        `<rect x="-12" y="-8" width="24" height="24" rx="2" fill="#dbe7ff" ${stroke}/>` +
        `<polygon points="-6,-8 6,-8 11,-19 -11,-19" fill="#ffffff" ${stroke}/>`
      )
    case 'actor':
      return (
        `<circle r="14" fill="#ffe2cf" ${stroke}/>` +
        `<polygon points="0,-24 -7,-13 7,-13" fill="${INK}"/>`
      )
    case 'fresnel':
      return (
        `<circle r="11" fill="#fff3c4" ${stroke}/>` +
        `<line x1="-15" y1="-13" x2="15" y2="-13" ${stroke}/>` +
        [-6, 0, 6].map((x) => `<line x1="${x}" y1="-2" x2="${x}" y2="-9" stroke="${INK}" stroke-width="1"/>`).join('')
      )
    case 'led':
      return (
        `<rect x="-17" y="-7" width="34" height="14" rx="2" fill="#fff3c4" ${stroke}/>` +
        [-10, 0, 10].map((x) => `<circle cx="${x}" cy="0" r="2" fill="${INK}"/>`).join('')
      )
    case 'hmi':
      return (
        `<polygon points="-6,-12 6,-12 13,0 6,12 -6,12 -13,0" fill="#fff3c4" ${stroke}/>` +
        `<text x="0" y="4" text-anchor="middle" font-family="${FONT}" font-size="11" font-weight="700" fill="${INK}">H</text>`
      )
    case 'softbox':
      return `<polygon points="-8,10 8,10 19,-10 -19,-10" fill="#fff3c4" ${stroke}/><line x1="-19" y1="-10" x2="19" y2="-10" stroke="${INK}" stroke-width="3"/>`
    case 'practical':
      return (
        `<circle r="13" fill="none" stroke="#d99a00" stroke-width="1.2" stroke-dasharray="3 3"/>` +
        `<circle r="6" fill="#fff3c4" ${stroke}/>`
      )
    case 'sun': {
      const rays = Array.from({ length: 10 }, (_, k) => {
        const a = (k * 36 * Math.PI) / 180
        return `<line x1="${f(Math.cos(a) * 11)}" y1="${f(Math.sin(a) * 11)}" x2="${f(Math.cos(a) * 17)}" y2="${f(Math.sin(a) * 17)}" stroke="#d99a00" stroke-width="1.6"/>`
      }).join('')
      return `<circle r="8" fill="#ffd54a" ${stroke}/>${rays}`
    }
    case 'flag': {
      // hatched, not solid: a solid bar reads as a wall. Hatch lines are clipped by hand so the SVG needs no ids.
      const h = len / 2
      const step = 6
      const hatch: string[] = []
      for (let x0 = -h - 10; x0 < h; x0 += step) {
        const t0 = Math.max(0, (-h - x0) / 10)
        const t1 = Math.min(1, (h - x0) / 10)
        if (t0 >= t1) continue
        hatch.push(`<line x1="${f(x0 + t0 * 10)}" y1="${f(5 - t0 * 10)}" x2="${f(x0 + t1 * 10)}" y2="${f(5 - t1 * 10)}" stroke="${INK}" stroke-width="1.2"/>`)
      }
      return `<rect x="${f(-h)}" y="-5" width="${f(len)}" height="10" fill="#ffffff" ${stroke}/>${hatch.join('')}`
    }
    case 'diffuser':
      return `<rect x="${f(-len / 2)}" y="-3" width="${f(len)}" height="6" fill="#ffffff" stroke="${INK}" stroke-width="1.4" stroke-dasharray="4 3"/>`
    case 'reflector': {
      const n = Math.max(2, Math.floor(len / 8))
      const ticks = Array.from({ length: n }, (_, k) => {
        const x = -len / 2 + (k + 0.5) * (len / n)
        return `<line x1="${f(x)}" y1="3" x2="${f(x + 4)}" y2="9" stroke="${INK}" stroke-width="1"/>`
      }).join('')
      return `<rect x="${f(-len / 2)}" y="-3" width="${f(len)}" height="6" fill="#d9d9d9" ${stroke}/>${ticks}`
    }
    case 'bounce':
      return `<rect x="${f(-len / 2)}" y="-4" width="${f(len)}" height="8" fill="#f2f2f2" ${stroke}/>`
    case 'cstand':
      return (
        `<circle r="5" fill="#ffffff" ${stroke}/>` +
        `<line x1="-12" y1="0" x2="12" y2="0" ${stroke}/><line x1="0" y1="-12" x2="0" y2="12" ${stroke}/>`
      )
    case 'monitor':
      return (
        `<rect x="-11" y="-8" width="22" height="16" rx="1.5" fill="#e8e8e8" ${stroke}/>` +
        `<text x="0" y="4" text-anchor="middle" font-family="${FONT}" font-size="10" font-weight="700" fill="${INK}">M</text>`
      )
    case 'dolly': {
      const h = len / 2
      return (
        `<line x1="${f(-h)}" y1="-5" x2="${f(h)}" y2="-5" ${stroke}/><line x1="${f(-h)}" y1="5" x2="${f(h)}" y2="5" ${stroke}/>` +
        `<rect x="-9" y="-9" width="18" height="18" fill="#ffffff" ${stroke}/>` +
        `<polygon points="${f(h)},0 ${f(h - 8)},-4 ${f(h - 8)},4" fill="${INK}"/>`
      )
    }
    case 'table': {
      // to scale: the length across, the width (depth) up and down
      const w = (it.depth ?? d.depth ?? 0.8) * S
      return `<rect x="${f(-len / 2)}" y="${f(-w / 2)}" width="${f(len)}" height="${f(w)}" rx="2" fill="#efe3d0" ${stroke}/>`
    }
    case 'chair':
      return `<rect x="-9" y="-9" width="18" height="18" rx="2" fill="#efe3d0" ${stroke}/><line x1="-9" y1="9" x2="9" y2="9" stroke="${INK}" stroke-width="4"/>`
    case 'door': {
      const h = len / 2
      return (
        `<line x1="${f(-h)}" y1="0" x2="${f(h)}" y2="0" stroke="${INK}" stroke-width="2"/>` +
        `<path d="M ${f(-h)} 0 L ${f(-h)} ${f(-len)} A ${f(len)} ${f(len)} 0 0 1 ${f(h)} 0" fill="none" stroke="${MID}" stroke-width="1" stroke-dasharray="3 3"/>`
      )
    }
    case 'window': {
      const h = len / 2
      return `<rect x="${f(-h)}" y="-4" width="${f(len)}" height="8" fill="#dff1ff" ${stroke}/><line x1="${f(-h)}" y1="0" x2="${f(h)}" y2="0" stroke="${INK}" stroke-width="1"/>`
    }
    case 'wall':
      return `<line x1="${f(-len / 2)}" y1="0" x2="${f(len / 2)}" y2="0" stroke="${INK}" stroke-width="7" stroke-linecap="square"/>`
    case 'par':
      return `<circle r="11" fill="#fff3c4" ${stroke}/><circle r="5" fill="none" stroke="${INK}" stroke-width="1.2"/><line x1="-11" y1="-13" x2="11" y2="-13" ${stroke}/>`
    case 'ellipsoidal':
      return (
        `<rect x="-7" y="-6" width="14" height="20" rx="2" fill="#fff3c4" ${stroke}/>` +
        `<rect x="-5" y="-14" width="10" height="8" fill="#ffffff" ${stroke}/>` +
        `<line x1="-7" y1="4" x2="7" y2="4" stroke="${INK}" stroke-width="1"/>`
      )
    case 'tube': {
      const h = len / 2
      return `<rect x="${f(-h)}" y="-3" width="${f(len)}" height="6" rx="3" fill="#fff3c4" ${stroke}/>`
    }
    case 'kino':
      return (
        `<rect x="-17" y="-8" width="34" height="16" rx="1.5" fill="#fff3c4" ${stroke}/>` +
        [-4, 0, 4].map((y) => `<line x1="-14" y1="${y}" x2="14" y2="${y}" stroke="${INK}" stroke-width="1"/>`).join('')
      )
    case 'chinaball':
      return (
        `<circle r="22" fill="none" stroke="#d99a00" stroke-width="1.2" stroke-dasharray="3 3"/>` +
        `<circle r="12" fill="#fff8e1" ${stroke}/>` +
        `<line x1="-12" y1="0" x2="12" y2="0" stroke="${INK}" stroke-width="0.8"/><ellipse rx="5" ry="12" fill="none" stroke="${INK}" stroke-width="0.8"/>`
      )
    case 'dedo':
      return `<circle r="7" fill="#fff3c4" ${stroke}/><line x1="-10" y1="-9" x2="10" y2="-9" ${stroke}/><line x1="-10" y1="-9" x2="-13" y2="-14" stroke="${INK}" stroke-width="1.2"/><line x1="10" y1="-9" x2="13" y2="-14" stroke="${INK}" stroke-width="1.2"/>`
    case 'skypanel':
      return (
        `<rect x="-22" y="-8" width="44" height="16" rx="2" fill="#fff3c4" ${stroke}/>` +
        [-11, 0, 11].map((x) => `<line x1="${x}" y1="-8" x2="${x}" y2="8" stroke="${INK}" stroke-width="0.8"/>`).join('')
      )
    case 'moon':
      return `<path d="M 6.5 -8.87 A 11 11 0 1 0 6.5 8.87 A 9 9 0 1 1 6.5 -8.87 Z" fill="#dfe8fb" ${stroke}/>`
    case 'overhead': {
      // a frame seen from above: drawn as a big dashed square with its diagonals
      const h = len / 2
      return (
        `<rect x="${f(-h)}" y="${f(-h)}" width="${f(len)}" height="${f(len)}" fill="#ffffff" fill-opacity="0.35" stroke="${INK}" stroke-width="1.4" stroke-dasharray="8 5"/>` +
        `<line x1="${f(-h)}" y1="${f(-h)}" x2="${f(h)}" y2="${f(h)}" stroke="${MID}" stroke-width="0.8"/><line x1="${f(h)}" y1="${f(-h)}" x2="${f(-h)}" y2="${f(h)}" stroke="${MID}" stroke-width="0.8"/>`
      )
    }
    case 'cookie': {
      const h = len / 2
      const holes = Array.from({ length: Math.max(2, Math.floor(len / 12)) }, (_, k) => {
        const x = -h + (k + 0.5) * (len / Math.max(2, Math.floor(len / 12)))
        return `<circle cx="${f(x)}" cy="${k % 2 ? -1.5 : 1.5}" r="2.2" fill="#ffffff" stroke="${INK}" stroke-width="0.8"/>`
      }).join('')
      return `<rect x="${f(-h)}" y="-5" width="${f(len)}" height="10" fill="#9a9a9a" ${stroke}/>${holes}`
    }
    case 'haze':
      return `<circle cx="-7" cy="2" r="7" fill="#eeeeee" ${stroke}/><circle cx="5" cy="-3" r="9" fill="#eeeeee" ${stroke}/><circle cx="9" cy="6" r="6" fill="#eeeeee" ${stroke}/>`
    case 'generator':
      return `<rect x="-16" y="-11" width="32" height="22" rx="2" fill="#e8e8e8" ${stroke}/><polygon points="2,-8 -6,2 0,2 -3,9 6,-2 0,-2" fill="${INK}"/>`
  }
}

/** Text under the item, in the unrotated frame. Also gives a rough half-size for the label offset. */
function labelOffset(it: LightItem): number {
  const len = (it.length ?? ITEM_DEFS[it.type].length ?? 1) * S
  switch (it.type) {
    case 'flag':
    case 'diffuser':
    case 'reflector':
    case 'bounce':
    case 'door':
    case 'window':
    case 'wall':
    case 'dolly':
    case 'tube':
    case 'cookie':
      void len
      return 22
    case 'overhead':
      return Math.min(len / 2 + 14, 240)
    case 'chinaball':
      return 34
    case 'table':
      return Math.min(((it.depth ?? ITEM_DEFS.table.depth ?? 0.8) * S) / 2 + 14, 240)
    default:
      return 30
  }
}

export interface SvgOptions {
  /** Draw the legend of the types used below the drawing. */
  legend?: boolean
  selectedId?: string | null
  /** Mark items with data-item so the editor can pick them. */
  interactive?: boolean
}

const ARROW = '#2f6fe0'
/** An actor's blocking: marks and arrows in another colour than the camera's. */
const WALK = '#c2410c'

/** The name of point k: A2, A3 for a camera A; Marina 2 for an actor; 2, 3 with no name. */
export function stopName(it: LightItem, k: number): string {
  const n = k + 2
  if (!it.label) return String(n)
  return it.label.length <= 2 ? `${it.label}${n}` : `${it.label} ${n}`
}

/** A knob at `dist` px where the piece points, with a dotted line to it; `attr` names what dragging it turns. */
function rotationKnob(attr: string, id: string, dist: number): string {
  return (
    `<line x1="0" y1="0" x2="0" y2="${-dist + 8}" stroke="${ARROW}" stroke-width="1.5" stroke-dasharray="3 3"/>` +
    `<g ${attr}="${escapeXml(id)}" style="cursor:grab"><circle cx="0" cy="${-dist}" r="12" fill="transparent"/>` +
    `<circle cx="0" cy="${-dist}" r="7" fill="#ffffff" stroke="${ARROW}" stroke-width="2"/>` +
    `<path d="M -3.5 ${-dist - 1} a 3.5 3.5 0 1 1 3.5 3.5" fill="none" stroke="${ARROW}" stroke-width="1.4"/></g>`
  )
}

/**
 * The camera's movement, drawn from the camera: a path to where it ends (with a faint camera there, A to A',
 * which can be dragged), an arc for a pan, a word for tilt and zoom.
 * `under` is in the drawing's frame under the camera, `inner` in the camera's rotated frame, `outer` is upright text,
 * `views` the fields of view of the faint cameras (drawn later, over every piece of the map).
 */
function movementSvg(it: LightItem, interactive: boolean, selected: boolean): { under: string; inner: string; outer: string; views?: string } {
  const move = it.move
  const rad = (it.rotation * Math.PI) / 180
  // a point of the camera's frame, in the drawing's frame (for upright text)
  const world = (x: number, y: number): [number, number] => [x * Math.cos(rad) - y * Math.sin(rad), x * Math.sin(rad) + y * Math.cos(rad)]
  const text = (x: number, y: number, t: string, color = INK): string => {
    const [wx, wy] = world(x, y)
    return `<text x="${f(wx)}" y="${f(wy + 4)}" text-anchor="middle" font-family="${FONT}" font-size="10" font-weight="700" fill="${color}" paint-order="stroke" stroke="#ffffff" stroke-width="3">${escapeXml(t)}</text>`
  }
  const head = (x: number, y: number, ux: number, uy: number, color = ARROW): string =>
    `<polygon points="${f(x)},${f(y)} ${f(x - ux * 9 - uy * 5)},${f(y - uy * 9 + ux * 5)} ${f(x - ux * 9 + uy * 5)},${f(y - uy * 9 - ux * 5)}" fill="${color}"/>`

  if (hasPath(it)) {
    const actor = it.type === 'actor'
    const spec: { style: string; tag?: string } = actor ? { style: 'walk' } : PATH_MOVES[move as string]
    const color = actor ? WALK : ARROW
    const stops = stopsOf(it)
    const { points, ends } = movePath(it)
    const pts = points.map(([x, y]) => [(x - it.x) * S, (y - it.y) * S] as [number, number])
    const acc: number[] = [0]
    for (let k = 1; k < pts.length; k++) acc.push(acc[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]))
    const normal = (k: number): [number, number] => {
      const p = pts[Math.max(0, k - 1)]
      const q = pts[Math.min(pts.length - 1, k + 1)]
      const l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1
      return [-(q[1] - p[1]) / l, (q[0] - p[0]) / l]
    }
    const line = (list: [number, number][], attrs: string): string =>
      `<polyline points="${list.map(([x, y]) => `${f(x)},${f(y)}`).join(' ')}" fill="none" ${attrs}/>`
    let drawn = ''
    // the rails of a track run the whole way
    if (spec.style === 'track') {
      const rail = (side: number): [number, number][] =>
        pts.map((p, k) => {
          const [nx, ny] = normal(k)
          return [p[0] + nx * 7 * side, p[1] + ny * 7 * side]
        })
      drawn += line(rail(1), `stroke="${MID}" stroke-width="1.4"`) + line(rail(-1), `stroke="${MID}" stroke-width="1.4"`)
    }
    // each stretch: its line stops short of the point it goes to, with an arrow there
    let from = 0
    ends.forEach((to) => {
      let stopAt = to
      while (stopAt > from && acc[to] - acc[stopAt] < 24) stopAt--
      const part = pts.slice(from, stopAt + 1)
      if (spec.style === 'wavy') {
        drawn += line(
          part.map((p, j): [number, number] => {
            const [nx, ny] = normal(from + j)
            const w = Math.sin(acc[from + j] / 4) * 4
            return [p[0] + nx * w, p[1] + ny * w]
          }),
          `stroke="${color}" stroke-width="1.6"`
        )
      } else {
        const dash =
          spec.style === 'dashed' || spec.style === 'walk' ? ' stroke-dasharray="7 5"' : spec.style === 'dotted' ? ' stroke-dasharray="1.5 5" stroke-linecap="round"' : ''
        drawn += line(part, `stroke="${color}" stroke-width="${spec.style === 'dotted' ? 2.4 : 1.6}"${dash}`)
      }
      const [hx, hy] = pts[stopAt]
      const [px0, py0] = pts[Math.max(from, stopAt - 1)]
      const hl = Math.hypot(hx - px0, hy - py0) || 1
      drawn += head(hx, hy, (hx - px0) / hl, (hy - py0) / hl, color)
      from = to
    })

    // each point: the piece again, faint, turned its own way (a camera with its field of view), and its name
    const label = (x: number, y: number, t: string, c = INK): string =>
      `<text x="${f(x)}" y="${f(y + 4)}" text-anchor="middle" font-family="${FONT}" font-size="10" font-weight="700" fill="${c}" paint-order="stroke" stroke="#ffffff" stroke-width="3">${escapeXml(t)}</text>`
    const d = ITEM_DEFS.camera
    let ghosts = ''
    let views = ''
    stops.forEach((s, k) => {
      const [ex, ey] = pts[ends[k]]
      const rot = stopRot(it, k)
      const last = k === stops.length - 1
      // the camera at the last point of a dolly frames like the camera at the start
      const view = last ? endViewOf(it) : null
      const cone = actor ? '' : coneSvg(view?.spread ?? spreadOf(it), view?.range ?? it.range ?? d.cone!.range, d.cone!.color, -19)
      const ref = `${escapeXml(it.id)}|${k}`
      const grab = interactive ? ` data-move-end="${ref}" style="cursor:grab"` : ''
      const knob = selected && interactive ? rotationKnob('data-rotate-end', `${it.id}|${k}`, actor ? 38 : 46) : ''
      if (cone) views += `<g transform="translate(${f(ex)} ${f(ey)}) rotate(${f(rot)})"><g opacity="0.4">${cone}</g></g>`
      ghosts +=
        `<g transform="translate(${f(ex)} ${f(ey)})"${grab}><g transform="rotate(${f(rot)})"><g opacity="0.4">${symbolSvg({ ...it, move: undefined })}</g>${knob}</g>` +
        (interactive ? '<circle r="18" fill="transparent"/>' : '') +
        `</g>`
      // its name, past it in the direction of travel
      const [bx, by] = pts[Math.max(0, ends[k] - 1)]
      const tl = Math.hypot(ex - bx, ey - by) || 1
      ghosts += label(ex + ((ex - bx) / tl) * 34, ey + ((ey - by) / tl) * 34, stopName(it, k))
    })
    // the middle of each stretch: dragged to bend it
    let bends = ''
    if (selected && interactive) {
      stops.forEach((_s, k) => {
        const m = segVia(it, k)
        const mx = (m.x - it.x) * S
        const my = (m.y - it.y) * S
        bends +=
          `<g data-move-via="${escapeXml(it.id)}|${k}" style="cursor:grab"><circle cx="${f(mx)}" cy="${f(my)}" r="11" fill="transparent"/>` +
          `<rect x="${f(mx - 5)}" y="${f(my - 5)}" width="10" height="10" transform="rotate(45 ${f(mx)} ${f(my)})" fill="#ffffff" stroke="${color}" stroke-width="2"/></g>`
      })
    }
    const mid = ends.length ? Math.floor(ends[0] / 2) : 0
    const [nmx, nmy] = normal(mid)
    const tag = spec.tag ? label(pts[mid][0] + nmx * 16, pts[mid][1] + nmy * 16, spec.tag, color) : ''
    // the faint pieces and the handles go on top of everything of the piece (its field of view would otherwise be in the way)
    return { under: drawn, inner: '', outer: ghosts + bends + tag, views }
  }
  if (it.type !== 'camera' || !move || move === 'Fixa') return { under: '', inner: '', outer: '' }
  if (move === 'Panorâmica' || move === 'Zoom') {
    const d = ITEM_DEFS.camera
    const knob = selected && interactive && move === 'Panorâmica' ? rotationKnob('data-rotate-end', it.id, 46) : ''
    const view = endViewOf(it)
    const endCone = coneSvg(view?.spread ?? spreadOf(it), view?.range ?? it.range ?? d.cone!.range, d.cone!.color, -19)
    // the camera at the end: faint, where the camera is, turned to where the pan ends (or with the zoomed field of view);
    // it does not take clicks (the camera is under it), only its knob or handle does
    const views = `<g transform="rotate(${f(moveRotOf(it))})"><g opacity="0.4">${endCone}</g></g>`
    const ghost =
      `<g transform="rotate(${f(moveRotOf(it))})"><g opacity="0.4" pointer-events="none">${move === 'Panorâmica' ? symbolSvg({ ...it, move: undefined }) : ''}</g>${knob}` +
      (selected && interactive && move === 'Zoom' && view
        ? `<g data-zoom-end="${escapeXml(it.id)}" style="cursor:grab"><circle cx="0" cy="${f(-view.range * S)}" r="11" fill="transparent"/>` +
          `<rect x="-5" y="${f(-view.range * S - 5)}" width="10" height="10" fill="#ffffff" stroke="${ARROW}" stroke-width="2"/></g>`
        : '') +
      `</g>`
    if (move === 'Zoom') return { under: '', inner: '', outer: ghost, views }
    const a = panAngleOf(it)
    const r = 36
    const t = (a * Math.PI) / 180
    const ex = Math.sin(t) * r
    const ey = -Math.cos(t) * r
    const sweep = a >= 0 ? 1 : 0
    const large = Math.abs(a) > 180 ? 1 : 0
    // tangent at the end of the arc, in the direction of the turn
    const s = a >= 0 ? 1 : -1
    return {
      under: '',
      inner: `<path d="M 0 ${-r} A ${r} ${r} 0 ${large} ${sweep} ${f(ex)} ${f(ey)}" fill="none" stroke="${ARROW}" stroke-width="1.6"/>` + head(ex, ey, Math.cos(t) * s, Math.sin(t) * s),
      outer: ghost,
      views
    }
  }
  // tilt and anything else: a word by the camera
  return { under: '', inner: '', outer: text(0, 44, move.toUpperCase(), ARROW) }
}

/**
 * One piece of the map. `view` is the camera's field of view (and those of its faint cameras), kept apart to be
 * drawn over every other piece; a light's beam stays with the light.
 */
function itemSvg(it: LightItem, opts: SvgOptions, number?: number): { svg: string; view: string } {
  const d = ITEM_DEFS[it.type]
  const x = it.x * S
  const y = it.y * S
  let cone = ''
  if (d.cone) {
    const fronts: Partial<Record<LightItemType, number>> = { camera: -19, sun: 0, softbox: -10, tube: -3, kino: -8, skypanel: -8, ellipsoidal: -14, dedo: -9, moon: 0, par: -13 }
    const topY = fronts[it.type] ?? -12
    cone = coneSvg(spreadOf(it), it.range ?? d.cone.range, it.type === 'camera' ? d.cone.color : beamColor(it), topY)
  }
  const isCamera = it.type === 'camera'
  const selected = opts.selectedId === it.id
  const sel = selected
    ? `<circle r="${f(Math.max(28, Math.min(((it.length ?? 0) * S) / 2 + 10, 120)))}" fill="none" stroke="#2f6fe0" stroke-width="2" stroke-dasharray="6 4"/>`
    : ''
  // the rotation handle of the selected piece: a knob where it points, dragged to turn it
  const handle = selected && opts.interactive ? rotationKnob('data-rotate', it.id, Math.max(46, Math.min(((it.length ?? 0) * S) / 2 + 26, 140))) : ''
  const label = it.label
    ? `<text x="0" y="${labelOffset(it)}" text-anchor="middle" font-family="${FONT}" font-size="11" fill="${INK}" ` +
      `paint-order="stroke" stroke="#ffffff" stroke-width="3">${escapeXml(it.label)}</text>`
    : ''
  const attrs = opts.interactive ? ` data-item="${escapeXml(it.id)}" style="cursor:grab"` : ''
  const movement = movementSvg(it, opts.interactive === true, selected)
  // the light's number, upright whatever the rotation, as in a lighting plot
  const badge =
    number === undefined
      ? ''
      : `<g transform="translate(17 -17)"><circle r="8" fill="${INK}"/><text y="3.5" text-anchor="middle" font-family="${FONT}" font-size="10" font-weight="700" fill="#ffffff">${number}</text></g>`
  const svg =
    `<g${attrs} transform="translate(${f(x)} ${f(y)})">` +
    sel +
    movement.under +
    `<g transform="rotate(${f(it.rotation)})">${movement.inner}${isCamera ? '' : cone}${symbolSvg(it)}${handle}</g>` +
    label +
    movement.outer +
    badge +
    (opts.interactive ? `<circle r="${f(Math.max(18, d.cone ? 18 : 20))}" fill="transparent"/>` : '') +
    `</g>`
  const views = (isCamera ? `<g transform="rotate(${f(it.rotation)})">${cone}</g>` : '') + (movement.views ?? '')
  return { svg, view: views ? `<g transform="translate(${f(x)} ${f(y)})">${views}</g>` : '' }
}

/** Types present in the map, in palette order. */
export function usedTypes(map: LightMap): LightItemType[] {
  const present = new Set(map.items.map((i) => i.type))
  return ITEM_TYPES.filter((t) => present.has(t))
}

export function lightMapSvg(map: LightMap, opts: SvgOptions = {}): string {
  const W = map.width * S
  const H = map.height * S
  const types = opts.legend ? usedTypes(map) : []
  const perRow = 3
  const rows = Math.ceil(types.length / perRow)
  const legendH = rows > 0 ? rows * 34 + 18 : 0
  const total = H + legendH

  const grid: string[] = []
  for (let m = 1; m < map.width; m++) {
    grid.push(`<line x1="${m * S}" y1="0" x2="${m * S}" y2="${H}" stroke="${m % 5 === 0 ? '#bdbdbd' : '#e4e4e4'}" stroke-width="1"/>`)
  }
  for (let m = 1; m < map.height; m++) {
    grid.push(`<line x1="0" y1="${m * S}" x2="${W}" y2="${m * S}" stroke="${m % 5 === 0 ? '#bdbdbd' : '#e4e4e4'}" stroke-width="1"/>`)
  }

  const scaleBar =
    `<g transform="translate(14 ${H - 16})"><line x1="0" y1="0" x2="${S}" y2="0" stroke="${INK}" stroke-width="2"/>` +
    `<line x1="0" y1="-4" x2="0" y2="4" stroke="${INK}" stroke-width="2"/><line x1="${S}" y1="-4" x2="${S}" y2="4" stroke="${INK}" stroke-width="2"/>` +
    `<text x="${S + 6}" y="4" font-family="${FONT}" font-size="11" fill="${INK}">1 m</text></g>`
  const north = `<text x="${W / 2}" y="14" text-anchor="middle" font-family="${FONT}" font-size="10" fill="${MID}">FUNDO</text>`
  const front = `<text x="${W / 2}" y="${H - 6}" text-anchor="middle" font-family="${FONT}" font-size="10" fill="${MID}">FRENTE</text>`

  // draw cones and modifiers under the actors and cameras
  const order = (t: LightItemType): number =>
    t === 'wall' || t === 'door' || t === 'window' || t === 'table' || t === 'chair' ? 0 : t === 'overhead' ? 1 : t === 'actor' || t === 'camera' ? 3 : 2
  const numbers = lightNumbers(map)
  const drawn = map.items
    .slice()
    .sort((a, b) => order(a.type) - order(b.type))
    .map((i) => itemSvg(i, opts, numbers.get(i.id)))
  const items = drawn.map((p) => p.svg).join('')
  // the cameras' fields of view over every piece, so what each camera sees is never hidden; they take no clicks
  const views = drawn.map((p) => p.view).join('')
  const viewLayer = views ? `<g pointer-events="none">${views}</g>` : ''

  let legend = ''
  if (types.length > 0) {
    const colW = W / perRow
    legend =
      `<line x1="0" y1="${H + 6}" x2="${W}" y2="${H + 6}" stroke="${INK}" stroke-width="1"/>` +
      types
        .map((t, k) => {
          const col = k % perRow
          const row = Math.floor(k / perRow)
          const sym = symbolSvg({ ...newItemShape(t), id: 'l', x: 0, y: 0 })
          return (
            `<g transform="translate(${f(col * colW + 22)} ${H + 30 + row * 34})"><g transform="scale(0.7)">${sym}</g>` +
            `<text x="30" y="4" font-family="${FONT}" font-size="11" fill="${INK}">${escapeXml(ITEM_DEFS[t].name)}</text></g>`
          )
        })
        .join('')
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${total}" width="${W}" height="${total}" role="img" ` +
    `aria-label="${escapeXml(map.name)}">` +
    `<rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff" stroke="${INK}" stroke-width="2"/>` +
    grid.join('') +
    north +
    front +
    items +
    viewLayer +
    scaleBar +
    legend +
    `</svg>`
  )
}

function newItemShape(t: LightItemType): Omit<LightItem, 'id' | 'x' | 'y'> {
  const d = ITEM_DEFS[t]
  const it: Omit<LightItem, 'id' | 'x' | 'y'> = { type: t, rotation: 0, label: '' }
  if (d.length !== undefined) {
    // keep legend symbols small
    it.length = Math.min(d.length, 0.9)
  }
  if (d.depth !== undefined) it.depth = Math.min(d.depth, 0.6)
  return it
}

/** Short summary lines for a map, used by reports and the Claude tools. */
export function describeItem(it: LightItem): string {
  const d = ITEM_DEFS[it.type]
  return `${d.name}${it.label ? ` “${it.label}”` : ''}${techSummary(it) ? ` (${techSummary(it)})` : ''} em (${it.x.toFixed(1)} m, ${it.y.toFixed(1)} m), ${it.rotation}°`
}

/** Standalone symbol (no beam) for palettes and legends, in a 60 x 60 box centred on the origin. */
export function symbolPreview(t: LightItemType): string {
  const shape = newItemShape(t)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-30 -30 60 60" width="28" height="28" aria-hidden="true">${symbolSvg({ ...shape, id: 'p', x: 0, y: 0 })}</svg>`
}

/** 'Principal · 1000 W · 3200 K · CTO' for a light, '35 mm (Super 35, 39°) · Plano médio' for a camera; '' when there is nothing to say. */
export function techSummary(it: LightItem): string {
  if (it.type === 'camera') {
    const lens = it.lens ? `${it.lens} mm (${SENSORS.find((s) => s.id === it.sensor)?.label ?? 'Super 35'}, ${fieldOfView(it.lens, it.sensor)}°)` : ''
    return [lens, it.height !== undefined ? `${it.height} m de altura` : '', it.shot ?? '', moveText(it)].filter(Boolean).join(' · ')
  }
  if (it.type === 'actor') return marksText(it)
  if (!isLight(it.type)) return ''
  const k = it.kelvin ?? ITEM_DEFS[it.type].kelvin
  const w = it.watts ?? ITEM_DEFS[it.type].watts
  return [roleLabel(it.role), w ? `${w} W` : '', k ? `${k} K` : '', it.gel ?? '', it.diffusion ?? '', it.intensity !== undefined && it.intensity < 100 ? `${it.intensity}%` : '']
    .filter(Boolean)
    .join(' · ')
}

// ---------------------------------------------------------------- equipment list and electrical load

export interface GearLine {
  type: LightItemType
  name: string
  /** Power of each one, in watts. */
  watts: number
  count: number
  /** Names of the maps they are in. */
  maps: string[]
}

/** Power of a light as planned (its own value, or the fixture's usual one). */
export const wattsOf = (it: LightItem): number => (isLight(it.type) ? it.watts ?? ITEM_DEFS[it.type].watts ?? 0 : 0)

/** The lights to rent, by fixture and power, from one map or many. Natural light (sun, moon) is not equipment. */
export function gearList(maps: LightMap[]): GearLine[] {
  const lines = new Map<string, GearLine>()
  for (const m of maps) {
    for (const it of m.items) {
      if (!isLight(it.type)) continue
      const w = wattsOf(it)
      if (w === 0 && (it.type === 'sun' || it.type === 'moon')) continue
      const model = it.model?.trim() ?? ''
      const key = `${it.type}|${w}|${model}`
      const line = lines.get(key) ?? { type: it.type, name: model ? `${ITEM_DEFS[it.type].name} · ${model}` : ITEM_DEFS[it.type].name, watts: w, count: 0, maps: [] }
      line.count += 1
      const name = m.name || 'Sem nome'
      if (!line.maps.includes(name)) line.maps.push(name)
      lines.set(key, line)
    }
  }
  return [...lines.values()].sort((a, b) => ITEM_TYPES.indexOf(a.type) - ITEM_TYPES.indexOf(b.type) || b.watts - a.watts)
}

/** Total power and the current it draws at 127 V and 220 V (single phase, resistive load). */
export function electricLoad(watts: number): { watts: number; a127: number; a220: number } {
  return { watts, a127: Math.round((watts / 127) * 10) / 10, a220: Math.round((watts / 220) * 10) / 10 }
}

export const mapWatts = (map: LightMap): number => map.items.reduce((t, it) => t + wattsOf(it), 0)

const br = (n: number): string => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
/** "3.250 W · 25,6 A em 127 V · 14,8 A em 220 V" */
export function loadText(watts: number): string {
  const l = electricLoad(watts)
  return `${br(l.watts)} W · ${br(l.a127)} A em 127 V · ${br(l.a220)} A em 220 V`
}

/** The technical sheet of a map: one row per light, one per camera. */
export function sheetRows(map: LightMap): { lights: string[][]; cameras: string[][] } {
  const numbers = lightNumbers(map)
  const lights = map.items
    .filter((it) => isLight(it.type))
    .map((it) => {
      const k = it.kelvin ?? ITEM_DEFS[it.type].kelvin
      const eff = effectiveKelvin(it)
      const w = wattsOf(it)
      return [
        String(numbers.get(it.id) ?? ''),
        ITEM_DEFS[it.type].name,
        it.model || '—',
        it.label || '—',
        roleLabel(it.role) || '—',
        w ? `${br(w)} W` : '—',
        k ? (eff !== null && eff !== k ? `${k} K → ${eff} K` : `${k} K`) : '—',
        it.gel || '—',
        it.diffusion || '—',
        it.intensity !== undefined ? `${it.intensity}%` : '100%',
        it.height !== undefined ? `${br(it.height)} m` : '—'
      ]
    })
  const cameras = map.items
    .filter((it) => it.type === 'camera')
    .map((it) => [
      it.label || 'Câmera',
      it.model || '—',
      it.lens ? `${it.lens} mm` : '—',
      it.lens ? SENSORS.find((s) => s.id === it.sensor)?.label ?? 'Super 35' : '—',
      `${spreadOf(it)}°`,
      it.height !== undefined ? `${br(it.height)} m` : '—',
      it.shot || '—',
      moveText(it) || '—'
    ])
  return { lights, cameras }
}

export const LIGHT_COLUMNS = ['Nº', 'Aparelho', 'Modelo', 'Legenda', 'Função', 'Potência', 'Temperatura', 'Gelatina', 'Difusão', 'Intensidade', 'Altura']
export const CAMERA_COLUMNS = ['Câmera', 'Modelo', 'Lente', 'Sensor', 'Ângulo', 'Altura', 'Plano', 'Movimento']
