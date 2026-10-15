import type { LightItem, LightItemType, LightMap } from './types'
import { newId } from './structures'

/** Pixels per metre in the drawing's own coordinate system. */
export const S = 60

export interface ItemDef {
  name: string
  group: 'Câmera' | 'Elenco' | 'Luzes' | 'Modificadores' | 'Acessórios' | 'Cenário'
  /** Beam or field of view. */
  cone?: { spread: number; range: number; color: string }
  length?: number
  /** Short note shown in the palette. */
  hint: string
}

export const ITEM_DEFS: Record<LightItemType, ItemDef> = {
  camera: { name: 'Câmera', group: 'Câmera', cone: { spread: 40, range: 3.5, color: '#2f6fe0' }, hint: 'Campo de visão' },
  actor: { name: 'Ator ou atriz', group: 'Elenco', hint: 'Marca no chão, aponta para onde olha' },
  fresnel: { name: 'Fresnel', group: 'Luzes', cone: { spread: 35, range: 3, color: '#d99a00' }, hint: 'Foco com abertura ajustável' },
  led: { name: 'Painel LED', group: 'Luzes', cone: { spread: 60, range: 2.5, color: '#d99a00' }, hint: 'Luz suave e leve' },
  hmi: { name: 'HMI', group: 'Luzes', cone: { spread: 30, range: 4.5, color: '#d99a00' }, hint: 'Luz forte tipo dia' },
  softbox: { name: 'Softbox', group: 'Luzes', cone: { spread: 70, range: 2.5, color: '#d99a00' }, hint: 'Luz suave de caixa' },
  practical: { name: 'Luz prática', group: 'Luzes', hint: 'Abajur, lâmpada ou vela que aparece em cena' },
  sun: { name: 'Sol ou janela', group: 'Luzes', cone: { spread: 14, range: 5, color: '#e0a800' }, hint: 'Luz natural entrando' },
  flag: { name: 'Bandeira (negativo)', group: 'Modificadores', length: 0.9, hint: 'Corta luz' },
  diffuser: { name: 'Difusor', group: 'Modificadores', length: 0.9, hint: 'Suaviza a luz' },
  reflector: { name: 'Rebatedor', group: 'Modificadores', length: 0.9, hint: 'Rebate luz de volta' },
  bounce: { name: 'Bounce (isopor)', group: 'Modificadores', length: 1.2, hint: 'Painel branco de preenchimento' },
  cstand: { name: 'C-stand', group: 'Acessórios', hint: 'Tripé de ferragem' },
  monitor: { name: 'Monitor', group: 'Acessórios', hint: 'Vídeo assist' },
  dolly: { name: 'Trilho / dolly', group: 'Acessórios', length: 3, hint: 'Movimento de câmera' },
  table: { name: 'Mesa', group: 'Cenário', hint: 'Móvel' },
  chair: { name: 'Cadeira', group: 'Cenário', hint: 'Móvel' },
  door: { name: 'Porta', group: 'Cenário', length: 0.9, hint: 'Abertura na parede' },
  window: { name: 'Janela', group: 'Cenário', length: 1.2, hint: 'Abertura na parede' },
  wall: { name: 'Parede', group: 'Cenário', length: 4, hint: 'Limite do cenário' }
}

export const ITEM_TYPES = Object.keys(ITEM_DEFS) as LightItemType[]
export const GROUPS: ItemDef['group'][] = ['Câmera', 'Elenco', 'Luzes', 'Modificadores', 'Acessórios', 'Cenário']

export function itemHasCone(t: LightItemType): boolean {
  return ITEM_DEFS[t].cone !== undefined
}
export function itemHasLength(t: LightItemType): boolean {
  return ITEM_DEFS[t].length !== undefined
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
    includeInPdf: raw.includeInPdf !== false
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
    `<polygon points="0,${f(fromY)} ${f(lx)},${f(y)} ${f(rx)},${f(y)}" fill="${color}" fill-opacity="0.16" ` +
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
    case 'table':
      return `<rect x="-22" y="-13" width="44" height="26" rx="2" fill="#efe3d0" ${stroke}/>`
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
      void len
      return 22
    case 'table':
      return 28
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

function itemSvg(it: LightItem, opts: SvgOptions): string {
  const d = ITEM_DEFS[it.type]
  const x = it.x * S
  const y = it.y * S
  let cone = ''
  if (d.cone) {
    const topY = it.type === 'camera' ? -19 : it.type === 'sun' ? 0 : it.type === 'softbox' ? -10 : -12
    cone = coneSvg(it.spread ?? d.cone.spread, it.range ?? d.cone.range, d.cone.color, topY)
  }
  const sel =
    opts.selectedId === it.id
      ? `<circle r="${f(Math.max(28, Math.min(((it.length ?? 0) * S) / 2 + 10, 120)))}" fill="none" stroke="#2f6fe0" stroke-width="2" stroke-dasharray="6 4"/>`
      : ''
  const label = it.label
    ? `<text x="0" y="${labelOffset(it)}" text-anchor="middle" font-family="${FONT}" font-size="11" fill="${INK}" ` +
      `paint-order="stroke" stroke="#ffffff" stroke-width="3">${escapeXml(it.label)}</text>`
    : ''
  const attrs = opts.interactive ? ` data-item="${escapeXml(it.id)}" style="cursor:grab"` : ''
  return (
    `<g${attrs} transform="translate(${f(x)} ${f(y)})">` +
    sel +
    `<g transform="rotate(${f(it.rotation)})">${cone}${symbolSvg(it)}</g>` +
    label +
    (opts.interactive ? `<circle r="${f(Math.max(18, d.cone ? 18 : 20))}" fill="transparent"/>` : '') +
    `</g>`
  )
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
    t === 'wall' || t === 'door' || t === 'window' || t === 'table' || t === 'chair' ? 0 : t === 'actor' || t === 'camera' ? 3 : 2
  const items = map.items
    .slice()
    .sort((a, b) => order(a.type) - order(b.type))
    .map((i) => itemSvg(i, opts))
    .join('')

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
  return it
}

/** Short summary lines for a map, used by reports and the Claude tools. */
export function describeItem(it: LightItem): string {
  const d = ITEM_DEFS[it.type]
  return `${d.name}${it.label ? ` “${it.label}”` : ''} em (${it.x.toFixed(1)} m, ${it.y.toFixed(1)} m), ${it.rotation}°`
}

/** Standalone symbol (no beam) for palettes and legends, in a 60 x 60 box centred on the origin. */
export function symbolPreview(t: LightItemType): string {
  const shape = newItemShape(t)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-30 -30 60 60" width="28" height="28" aria-hidden="true">${symbolSvg({ ...shape, id: 'p', x: 0, y: 0 })}</svg>`
}
