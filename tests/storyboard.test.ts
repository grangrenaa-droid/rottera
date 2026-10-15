import { describe, expect, it } from 'vitest'
import { LAYOUTS, SB_PAGE, cleanFrame, isSafeImage, placeInScene, storyboardMegabytes, storyboardPages } from '../src/shared/storyboard'
import { parseScriptFile, serialize } from '../src/shared/scriptfile'
import type { Frame, Script, Storyboard } from '../src/shared/types'

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const frame = (n: number, image = PNG): Frame => ({ id: `f${n}`, image, caption: `Plano ${n}`, scene: '1' })
const sb = (n: number, over: Partial<Storyboard> = {}): Storyboard => ({
  frames: Array.from({ length: n }, (_, i) => frame(i + 1)),
  aspect: '16:9',
  layout: 6,
  includeInPdf: true,
  ...over
})

describe('storyboard layout', () => {
  it('splits frames into pages by layout', () => {
    expect(storyboardPages(sb(0))).toHaveLength(0)
    expect(storyboardPages(sb(6))).toHaveLength(1)
    expect(storyboardPages(sb(7))).toHaveLength(2)
    expect(storyboardPages(sb(7, { layout: 2 }))).toHaveLength(4)
    expect(storyboardPages(sb(9, { layout: 9 }))).toHaveLength(1)
  })
  it('keeps every picture and caption inside the printable area, for every layout and aspect', () => {
    for (const lay of LAYOUTS) {
      for (const aspect of ['16:9', '2.39:1', '4:3', '1:1', '9:16'] as const) {
        const pages = storyboardPages(sb(lay.cols * lay.rows * 2, { layout: lay.id, aspect }))
        for (const page of pages) {
          for (const c of page.cells) {
            expect(c.fx).toBeGreaterThanOrEqual(SB_PAGE.left - 1e-6)
            expect(c.fx + c.fw).toBeLessThanOrEqual(SB_PAGE.width - SB_PAGE.right + 1e-6)
            expect(c.fy).toBeGreaterThanOrEqual(SB_PAGE.top - 1e-6)
            expect(c.captionY + c.captionH).toBeLessThanOrEqual(SB_PAGE.height - SB_PAGE.bottom + 1e-6)
            expect(c.fh).toBeGreaterThan(0.3)
            expect(c.captionH).toBeGreaterThan(0.4)
          }
        }
      }
    }
  })
  it('never overlaps cells on a page', () => {
    for (const page of storyboardPages(sb(9, { layout: 9 }))) {
      for (const a of page.cells) {
        for (const b of page.cells) {
          if (a === b) continue
          const overlapX = a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6
          const overlapY = a.y < b.y + b.h - 1e-6 && b.y < a.y + a.h - 1e-6
          expect(overlapX && overlapY).toBe(false)
        }
      }
    }
  })
})

describe('storyboard data safety', () => {
  it('accepts raster data URLs and the empty string only', () => {
    expect(isSafeImage(PNG)).toBe(true)
    expect(isSafeImage('')).toBe(true)
    expect(isSafeImage('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=')).toBe(false)
    expect(isSafeImage('https://example.com/a.png')).toBe(false)
    expect(isSafeImage('file:///C:/secret.png')).toBe(false)
    expect(isSafeImage('javascript:alert(1)')).toBe(false)
    expect(isSafeImage('data:text/html;base64,PGI+')).toBe(false)
  })
  it('drops unsafe frames when reading a file, keeps the rest', () => {
    const s: Script = {
      titlePage: { title: 'T', author: '', contact: '' },
      blocks: [{ kind: 'action', text: 'a' }],
      storyboard: {
        frames: [frame(1), { id: 'bad', image: 'https://evil.example/x.png', caption: 'x', scene: '' }, frame(3)],
        aspect: '2.39:1',
        layout: 4,
        includeInPdf: false
      }
    }
    const back = parseScriptFile(serialize(s))
    expect(back.storyboard?.frames.map((f) => f.id)).toEqual(['f1', 'f3'])
    expect(back.storyboard?.aspect).toBe('2.39:1')
    expect(back.storyboard?.layout).toBe(4)
    expect(back.storyboard?.includeInPdf).toBe(false)
  })
  it('falls back to defaults for unknown aspect and layout', () => {
    const raw = JSON.parse(serialize({ titlePage: { title: '', author: '', contact: '' }, blocks: [{ kind: 'action', text: '' }], storyboard: sb(1) }))
    raw.script.storyboard.aspect = '5:1'
    raw.script.storyboard.layout = 7
    const back = parseScriptFile(JSON.stringify(raw))
    expect(back.storyboard?.aspect).toBe('16:9')
    expect(back.storyboard?.layout).toBe(6)
  })
  it('cleans frames and reports size', () => {
    expect(cleanFrame({ image: 'nope' })).toBeNull()
    const f = cleanFrame({ image: PNG, caption: 'x'.repeat(5000) })
    expect(f?.caption.length).toBe(2000)
    expect(f?.id).toBeTruthy()
    expect(storyboardMegabytes([frame(1)])).toBeGreaterThan(0)
  })
})

describe('placing a frame in its scene', () => {
  const order = ['1', '2', '3', '4']
  const fr = (id: string, scene: string): Frame => ({ id, image: '', caption: '', scene })
  const ids = (r: { frames: Frame[] }): string => r.frames.map((f) => f.id).join(' ')

  it('goes right after the last frame of its scene', () => {
    const frames = [fr('a', '1'), fr('b', '2'), fr('c', '2'), fr('d', '3'), fr('new', '')]
    const r = placeInScene(frames, 'new', '2', order)
    expect(ids(r)).toBe('a b c new d')
    expect(r.index).toBe(3)
    expect(r.frames[3].scene).toBe('2')
  })

  it('follows the script order when the scene has no frames yet', () => {
    const frames = [fr('a', '1'), fr('d', '4'), fr('new', '')]
    expect(ids(placeInScene(frames, 'new', '3', order))).toBe('a new d')
    expect(ids(placeInScene([fr('d', '4'), fr('c', '3'), fr('new', '')], 'new', '2', order))).toBe('new d c')
  })

  it('stays put when nothing tells where the scene goes', () => {
    const frames = [fr('x', ''), fr('new', ''), fr('y', '')]
    const r = placeInScene(frames, 'new', '2', order)
    expect(ids(r)).toBe('x new y')
    expect(r.index).toBe(1)
    expect(r.frames[1].scene).toBe('2')
    expect(ids(placeInScene([fr('a', '1'), fr('new', '')], 'new', '9', order))).toBe('a new')
  })
})
