import type { LightMap, MicType, SoundPlan } from './types'
import { S, escapeXml, lightMapSvg } from './lightmap'
import { MIC_DEFS } from './sound'

/** The colour of everything sound draws, apart from the light map's colours. */
const MIC = '#7c3aed'
const KNOB = '#2f6fe0'
const r1 = (n: number): string => String(Math.round(n * 10) / 10)
const r2 = (n: number): number => Math.round(n * 100) / 100

/** How much a type picks up in each direction, 1 = its full reach, θ from the front. */
const POLAR: Partial<Record<MicType, (c: number) => number>> = {
  cardioid: (c) => 0.5 * (1 + c),
  supercardioid: (c) => Math.abs(0.37 + 0.63 * c),
  shotgun: (c) => (c > 0 ? c ** 8 : 0.08 * -c),
  figure8: (c) => Math.abs(c)
}

/**
 * The pickup area of a microphone as an SVG path in px, pointing up (0°), the microphone at the origin: a heart for
 * a cardioid, a narrower heart with a small rear lobe for a supercardioid, a long narrow drop for a shotgun, two lobes
 * for a figure 8, a circle for an omni or a lavalier. The recorder picks up nothing.
 */
export function pickupPath(type: MicType, range: number): string {
  const R = range * S
  if (type === 'recorder' || R <= 0) return ''
  if (type === 'omni' || type === 'lavalier') return `M 0 ${r1(-R)} A ${r1(R)} ${r1(R)} 0 1 1 0 ${r1(R)} A ${r1(R)} ${r1(R)} 0 1 1 0 ${r1(-R)} Z`
  const f = POLAR[type] as (c: number) => number
  const pts: string[] = []
  for (let i = 0; i <= 72; i++) {
    const a = (i / 72) * 2 * Math.PI
    const r = R * f(Math.cos(a))
    pts.push(`${r1(r * Math.sin(a))} ${r1(-r * Math.cos(a))}`)
  }
  return `M ${pts.join(' L ')} Z`
}

/** Only the microphones' layer: each one with its pickup area, its symbol and its name. */
export function soundLayerSvg(plan: SoundPlan, map: LightMap | null, opts: { selectedId?: string | null; interactive?: boolean } = {}): string {
  const out = plan.mics.map((m) => {
    // a lavalier clipped to an actor is where the actor is
    const actor = m.type === 'lavalier' && m.actorId && map ? map.items.find((i) => i.id === m.actorId && i.type === 'actor') : undefined
    const x = r2((actor ? actor.x : m.x) * S)
    const y = r2((actor ? actor.y : m.y) * S)
    const def = MIC_DEFS[m.type]
    const area = pickupPath(m.type, m.range ?? def.range)
    const selected = opts.selectedId === m.id
    const turn =
      `<g transform="rotate(${m.rotation})">` +
      (area ? `<path d="${area}" fill="${MIC}" fill-opacity="0.12" stroke="${MIC}" stroke-width="1.2" stroke-dasharray="4 3"/>` : '') +
      // the boom, behind a microphone someone holds
      (m.operator ? `<line x1="0" y1="8" x2="0" y2="44" stroke="#555" stroke-width="3" stroke-linecap="round"/>` : '') +
      (def.group === 'Unidirecionais' ? `<line x1="0" y1="0" x2="0" y2="-14" stroke="${MIC}" stroke-width="2.5"/>` : '') +
      (selected && opts.interactive
        ? `<line x1="0" y1="0" x2="0" y2="-32" stroke="${KNOB}" stroke-width="1.5" stroke-dasharray="3 3"/>` +
          `<g data-mic-rotate="${escapeXml(m.id)}" style="cursor:grab"><circle cx="0" cy="-40" r="12" fill="transparent"/><circle cx="0" cy="-40" r="5" fill="${KNOB}"/></g>`
        : '') +
      `</g>`
    const symbol =
      m.type === 'recorder'
        ? `<rect x="-10" y="-7" width="20" height="14" rx="2" fill="#fff" stroke="${MIC}" stroke-width="2"/>`
        : `<circle r="${m.type === 'lavalier' ? 5 : 7}" fill="#fff" stroke="${MIC}" stroke-width="2"/>`
    const ring = selected ? `<circle r="13" fill="none" stroke="${KNOB}" stroke-width="2"/>` : ''
    const name = `<text y="24" text-anchor="middle" font-size="11" font-family="Segoe UI, Arial, sans-serif" fill="${MIC}">${escapeXml(m.label || def.label)}</text>`
    return `<g data-mic="${escapeXml(m.id)}" transform="translate(${x},${y})"${opts.interactive ? ' style="cursor:move"' : ''}>${turn}${ring}${symbol}${name}</g>`
  })
  return `<g class="sound-layer">${out.join('')}</g>`
}

/**
 * A whole sound plan: the light map below, faint and out of reach (it is never changed from here), or a plain grid
 * for a plan with no light map, and the microphones on top.
 */
export function soundPlanSvg(plan: SoundPlan, map: LightMap | null, opts: { selectedId?: string | null; interactive?: boolean } = {}): string {
  const w = map ? map.width : plan.width
  const h = map ? map.height : plan.height
  const W = w * S
  const H = h * S
  let below: string
  if (map) {
    const inner = lightMapSvg(map).replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
    below = `<g opacity="0.35" pointer-events="none">${inner}</g>`
  } else {
    const lines: string[] = []
    for (let m = 1; m < w; m++) lines.push(`<line x1="${m * S}" y1="0" x2="${m * S}" y2="${H}" stroke="#e4e4e4"/>`)
    for (let m = 1; m < h; m++) lines.push(`<line x1="0" y1="${m * S}" x2="${W}" y2="${m * S}" stroke="#e4e4e4"/>`)
    below = `<g pointer-events="none"><rect width="${W}" height="${H}" fill="#fff" stroke="#999"/>${lines.join('')}</g>`
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Planta de som">` +
    `${below}${soundLayerSvg(plan, map, opts)}</svg>`
  )
}
