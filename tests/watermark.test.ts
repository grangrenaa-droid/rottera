import { describe, expect, it } from 'vitest'
import { buildPdfHtml } from '../src/main/pdf'
import { parseScriptFile, serialize } from '../src/shared/scriptfile'
import type { Script } from '../src/shared/types'

const base: Script = {
  titlePage: { title: 'Teste', author: 'Ana', contact: '' },
  blocks: [{ kind: 'action', text: 'Uma linha.' }]
}

describe('watermark', () => {
  it('is saved in the file and comes back', () => {
    const s: Script = { ...base, watermark: { enabled: true, text: 'CONFIDENCIAL', strength: 'strong' } }
    expect(parseScriptFile(serialize(s)).watermark).toEqual({ enabled: true, text: 'CONFIDENCIAL', strength: 'strong' })
  })

  it('keeps the text when turned off, so turning it back on needs no retyping', () => {
    const s: Script = { ...base, watermark: { enabled: false, text: 'RASCUNHO', strength: 'medium' } }
    expect(parseScriptFile(serialize(s)).watermark).toEqual({ enabled: false, text: 'RASCUNHO', strength: 'medium' })
  })

  it('cleans bad values from a hand-edited file', () => {
    const raw = JSON.stringify({
      format: 'rotera',
      version: 1,
      savedAt: '',
      script: { ...base, watermark: { enabled: 'yes', text: 'X'.repeat(500), strength: 'huge' } }
    })
    const w = parseScriptFile(raw).watermark
    expect(w).toEqual({ enabled: false, text: 'X'.repeat(80), strength: 'medium' })
  })

  it('files without a watermark have none', () => {
    expect(parseScriptFile(serialize(base)).watermark).toBeUndefined()
  })

  it('prints on every page of the PDF when on', () => {
    const html = buildPdfHtml({ ...base, watermark: { enabled: true, text: 'CONFIDENCIAL', strength: 'medium' } })
    expect(html).toContain('.page::after')
    expect(html).toContain('content: "CONFIDENCIAL"')
  })

  it('prints nothing when off or empty', () => {
    expect(buildPdfHtml({ ...base, watermark: { enabled: false, text: 'CONFIDENCIAL', strength: 'medium' } })).not.toContain('::after')
    expect(buildPdfHtml({ ...base, watermark: { enabled: true, text: '   ', strength: 'medium' } })).not.toContain('::after')
    expect(buildPdfHtml(base)).not.toContain('::after')
  })

  it('escapes the text so it cannot break the stylesheet', () => {
    const html = buildPdfHtml({ ...base, watermark: { enabled: true, text: 'a"b\\c</style><x>', strength: 'light' } })
    expect(html).toContain('content: "a\\"b\\\\c\\3c /style\\3e \\3c x\\3e "')
    expect(html).not.toContain('</style><x>')
  })

  it('stronger is darker', () => {
    const alpha = (strength: 'light' | 'medium' | 'strong'): number => {
      const html = buildPdfHtml({ ...base, watermark: { enabled: true, text: 'A', strength } })
      return Number(/rgba\(0, ?0, ?0, ?([\d.]+)\)/.exec(html.slice(html.indexOf('.page::after')))![1])
    }
    expect(alpha('light')).toBeLessThan(alpha('medium'))
    expect(alpha('medium')).toBeLessThan(alpha('strong'))
  })
})
