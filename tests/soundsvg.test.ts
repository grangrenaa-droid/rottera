import { describe, expect, it } from 'vitest'
import { pickupPath, soundLayerSvg, soundPlanSvg } from '../src/shared/soundsvg'
import { S } from '../src/shared/lightmap'
import type { LightMap, SoundPlan } from '../src/shared/types'

/** The x,y points of a path's line segments. */
function points(d: string): { x: number; y: number }[] {
  const nums = (d.match(/-?\d+(\.\d+)?/g) || []).map(Number)
  const out: { x: number; y: number }[] = []
  for (let i = 0; i + 1 < nums.length; i += 2) out.push({ x: nums[i], y: nums[i + 1] })
  return out
}
const width = (d: string): number => Math.max(...points(d).map((p) => Math.abs(p.x)))

const map: LightMap = {
  id: 'lm1',
  name: 'Cabine',
  scene: '1',
  sid: 's1',
  width: 6,
  height: 4,
  items: [{ id: 'a1', type: 'actor', x: 2, y: 3, rotation: 0, label: 'Luísa' }],
  notes: '',
  includeInPdf: true
}
const plan: SoundPlan = {
  id: 'p1',
  mapId: 'lm1',
  sid: 's1',
  scene: '1',
  width: 6,
  height: 4,
  notes: '',
  mics: [
    { id: 'm1', type: 'shotgun', x: 5, y: 1, rotation: 270, label: 'Mic 1', range: 3 },
    { id: 'm2', type: 'lavalier', x: 1, y: 1, rotation: 0, label: 'Lapela 2', range: 0.5, actorId: 'a1' }
  ]
}

describe('pickup areas', () => {
  it('an omni picks up all around, as a circle of its reach', () => {
    expect(pickupPath('omni', 2)).toContain(`A ${2 * S} ${2 * S}`)
  })

  it('a shotgun reaches its range ahead and is narrower than a cardioid', () => {
    const shotgun = pickupPath('shotgun', 3)
    expect(Math.min(...points(shotgun).map((p) => p.y))).toBeCloseTo(-3 * S, 0)
    expect(width(shotgun)).toBeLessThan(width(pickupPath('cardioid', 3)))
  })

  it('the recorder has no pickup area', () => {
    expect(pickupPath('recorder', 1)).toBe('')
  })
})

describe('the sound plan drawing', () => {
  it('draws the light map faint and out of reach, with the microphones on top', () => {
    const svg = soundPlanSvg(plan, map)
    expect(svg).toMatch(/<g opacity="0\.35" pointer-events="none">[\s\S]*Luísa/)
    expect(svg).toContain('data-mic="m1"')
    expect(svg.indexOf('opacity="0.35"')).toBeLessThan(svg.indexOf('data-mic="m1"'))
  })

  it('a lavalier clipped to an actor is drawn where the actor is', () => {
    expect(soundLayerSvg(plan, map)).toContain(`data-mic="m2" transform="translate(${2 * S},${3 * S})"`)
  })

  it('a lavalier whose actor was deleted is drawn where it was put', () => {
    expect(soundLayerSvg(plan, { ...map, items: [] })).toContain(`data-mic="m2" transform="translate(${1 * S},${1 * S})"`)
  })

  it('the selected microphone gets a knob to turn it, only when it can be edited', () => {
    expect(soundLayerSvg(plan, map, { selectedId: 'm1', interactive: true })).toContain('data-mic-rotate="m1"')
    expect(soundLayerSvg(plan, map, { selectedId: 'm1' })).not.toContain('data-mic-rotate')
  })

  it('a sound-only plan has its own grid, without a light map', () => {
    const svg = soundPlanSvg({ ...plan, mapId: undefined }, null)
    expect(svg).toContain(`viewBox="0 0 ${6 * S} ${4 * S}"`)
    expect(svg).not.toContain('Luísa')
  })
})
