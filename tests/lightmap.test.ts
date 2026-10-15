import { describe, expect, it } from 'vitest'
import { ITEM_TYPES, cleanItem, cleanLightMap, lightMapSvg, newItem, newLightMap, symbolPreview, usedTypes } from '../src/shared/lightmap'
import { parseScriptFile, serialize } from '../src/shared/scriptfile'
import { buildPdfHtml } from '../src/main/pdf'
import type { LightMap, Script } from '../src/shared/types'

const withItems = (): LightMap => {
  const m = newLightMap('Cozinha', '3')
  m.items = [
    { ...newItem('camera', 4, 5.2, 'CAM A'), rotation: 0 },
    { ...newItem('actor', 4, 2.5, 'Marina'), rotation: 180 },
    { ...newItem('fresnel', 1.2, 2, 'Key 1K <script>'), rotation: 120 },
    newItem('flag', 6, 3),
    newItem('wall', 4, 0.1)
  ]
  m.notes = 'Janela à esquerda. Luz fria.'
  return m
}

describe('light map drawing', () => {
  it('draws every item and escapes labels', () => {
    const svg = lightMapSvg(withItems())
    expect(svg.startsWith('<svg')).toBe(true)
    expect((svg.match(/<g transform="translate\(/g) ?? []).length).toBeGreaterThanOrEqual(5)
    expect(svg).toContain('CAM A')
    expect(svg).toContain('Key 1K &lt;script&gt;')
    expect(svg).not.toContain('<script>')
    expect(svg).toContain('FUNDO')
  })
  it('adds a legend only for used types when asked', () => {
    const m = withItems()
    expect(usedTypes(m)).toEqual(['camera', 'actor', 'fresnel', 'flag', 'wall'])
    const plain = lightMapSvg(m)
    const legend = lightMapSvg(m, { legend: true })
    expect(Number(/height="(\d+)"/.exec(legend)?.[1])).toBeGreaterThan(Number(/height="(\d+)"/.exec(plain)?.[1]))
    expect(legend).toContain('Fresnel')
    expect(legend).not.toContain('Softbox')
  })
  it('marks items and the selection for the editor', () => {
    const m = withItems()
    const svg = lightMapSvg(m, { interactive: true, selectedId: m.items[1].id })
    expect(svg).toContain(`data-item="${m.items[0].id}"`)
    expect(svg).toContain('stroke-dasharray="6 4"')
  })
  it('has a symbol for every type', () => {
    for (const t of ITEM_TYPES) expect(symbolPreview(t)).toContain('<svg')
  })
  it('draws the flag as a hatched panel, so it does not look like a wall', () => {
    const flag = symbolPreview('flag')
    expect(flag).toMatch(/<rect [^>]*fill="#ffffff"[^>]*stroke=/)
    const lines = [...flag.matchAll(/<line x1="([-\d.]+)" y1="([-\d.]+)" x2="([-\d.]+)" y2="([-\d.]+)"/g)].map((m) => m.slice(1).map(Number))
    expect(lines.length).toBeGreaterThanOrEqual(5)
    // diagonal, and inside the 0.9 m panel (54 px long, 10 px tall)
    for (const [x1, y1, x2, y2] of lines) {
      expect(x1).not.toBe(x2)
      expect(y1).not.toBe(y2)
      for (const x of [x1, x2]) expect(Math.abs(x)).toBeLessThanOrEqual(27.01)
      for (const y of [y1, y2]) expect(Math.abs(y)).toBeLessThanOrEqual(5.01)
    }
  })
})

describe('light map data', () => {
  it('clamps values and drops unknown types', () => {
    const bad = cleanItem({ type: 'laser' as never, x: 1, y: 1 }, 8, 6)
    expect(bad).toBeNull()
    const it = cleanItem({ type: 'fresnel', x: 99, y: -4, rotation: 725, spread: 400, range: -3, label: 'x'.repeat(200) }, 8, 6)!
    expect(it.x).toBe(8)
    expect(it.y).toBe(0)
    expect(it.rotation).toBe(5)
    expect(it.spread).toBe(180)
    expect(it.range).toBe(0.5)
    expect(it.label.length).toBe(60)
    const m = cleanLightMap({ width: 500, height: 0.1, items: [] })!
    expect(m.width).toBe(60)
    expect(m.height).toBe(2)
  })
  it('survives the file round trip', () => {
    const s: Script = {
      titlePage: { title: 'T', author: '', contact: '' },
      blocks: [{ kind: 'action', text: 'a' }],
      lightMaps: [withItems()]
    }
    const back = parseScriptFile(serialize(s))
    expect(back.lightMaps).toHaveLength(1)
    expect(back.lightMaps?.[0].items).toHaveLength(5)
    expect(back.lightMaps?.[0].items[1].rotation).toBe(180)
    expect(back.lightMaps?.[0].notes).toContain('Luz fria')
  })
  it('ignores junk entries in a hand-edited file', () => {
    const raw = JSON.parse(serialize({ titlePage: { title: '', author: '', contact: '' }, blocks: [{ kind: 'action', text: '' }] }))
    raw.script.lightMaps = [null, 7, { name: 'ok', items: [{ type: 'camera' }, { type: 'nope' }, 3] }]
    const back = parseScriptFile(JSON.stringify(raw))
    expect(back.lightMaps).toHaveLength(1)
    expect(back.lightMaps?.[0].items).toHaveLength(1)
  })
})

describe('PDF order', () => {
  const script: Script = {
    titlePage: { title: 'Chuva', author: 'Ana', contact: '' },
    blocks: [
      { kind: 'scene_heading', text: 'INT. COZINHA - DIA' },
      { kind: 'action', text: 'Marina coa o café.' }
    ],
    storyboard: {
      frames: [{ id: 'f1', image: '', caption: 'Plano 1', scene: '1' }],
      aspect: '16:9',
      layout: 6,
      includeInPdf: true
    },
    lightMaps: [withItems(), { ...newLightMap('Rua', '4'), includeInPdf: false }]
  }
  const pos = (html: string, marker: string): number => html.indexOf(marker)

  it('puts the lighting diagrams after the script and the storyboard', () => {
    const html = buildPdfHtml(script)
    const title = pos(html, 'class="page title"')
    const scriptPage = pos(html, 'Marina coa o caf')
    const sb = pos(html, 'STORYBOARD')
    const lm = pos(html, 'MAPA DE LUZ')
    expect(title).toBeGreaterThan(-1)
    expect(title).toBeLessThan(scriptPage)
    expect(scriptPage).toBeLessThan(sb)
    expect(sb).toBeLessThan(lm)
  })
  it('prints only the maps marked for the PDF', () => {
    const html = buildPdfHtml(script)
    expect((html.match(/MAPA DE LUZ/g) ?? []).length).toBe(1)
    expect(html).toContain('COZINHA')
    expect(html).toContain('Cena 3')
    expect(html).toContain('Luz fria')
  })
  it('can print the maps alone, including ones left out of the script PDF', () => {
    const html = buildPdfHtml(script, { lightMapsOnly: true })
    expect((html.match(/MAPA DE LUZ/g) ?? []).length).toBe(2)
    expect(html).not.toContain('Marina coa o caf')
    expect(html).not.toContain('STORYBOARD')
  })
  it('leaves the maps out when the script alone is asked for', () => {
    const html = buildPdfHtml(script, { scriptOnly: true })
    expect(html).not.toContain('MAPA DE LUZ')
    expect(html).not.toContain('STORYBOARD')
  })
})
