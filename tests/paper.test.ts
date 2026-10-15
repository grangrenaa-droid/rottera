import { describe, expect, it } from 'vitest'
import { PAPER, paginate } from '../src/shared/paginate'
import { buildPdfHtml } from '../src/main/pdf'
import { SB_PAGE, storyboardPages } from '../src/shared/storyboard'
import { parseScriptFile, serialize } from '../src/shared/scriptfile'
import type { Block, Script } from '../src/shared/types'

describe('BUG-008 paper size: Brazil prints on A4', () => {
  it('A4 fits more lines per page than letter, so a long script has fewer pages', () => {
    const blocks: Block[] = Array.from({ length: 400 }, (_, i) => ({ kind: 'action' as const, text: `Linha de ação número ${i}.` }))
    const letter = paginate(blocks, 'letter')
    const a4 = paginate(blocks, 'a4')
    expect(PAPER.a4.lines).toBeGreaterThan(PAPER.letter.lines)
    expect(a4.pages.length).toBeLessThan(letter.pages.length)
    for (const p of a4.pages) expect(p.length).toBeLessThanOrEqual(PAPER.a4.lines)
    for (const p of letter.pages) expect(p.length).toBeLessThanOrEqual(PAPER.letter.lines)
  })

  it('the PDF is laid out on the chosen sheet', () => {
    const s: Script = {
      titlePage: { title: 'T', author: '', contact: '' },
      blocks: [{ kind: 'action', text: 'a' }],
      paper: 'a4'
    }
    expect(buildPdfHtml(s)).toContain('size: 8.27in 11.69in')
    expect(buildPdfHtml({ ...s, paper: 'letter' })).toContain('size: 8.5in 11in')
    expect(buildPdfHtml({ ...s, paper: undefined })).toContain('size: 8.5in 11in')
  })

  it('storyboard pages stay inside the A4 sheet', () => {
    const frames = Array.from({ length: 9 }, (_, i) => ({ id: `f${i}`, image: '', caption: '', scene: '' }))
    for (const layout of [2, 4, 6, 9] as const) {
      for (const aspect of ['16:9', '2.39:1', '9:16'] as const) {
        for (const page of storyboardPages({ frames, aspect, layout }, 'a4')) {
          for (const c of page.cells) {
            expect(c.x + c.w).toBeLessThanOrEqual(PAPER.a4.width - SB_PAGE.right + 1e-6)
            expect(c.captionY + c.captionH).toBeLessThanOrEqual(PAPER.a4.height - SB_PAGE.bottom + 1e-6)
          }
        }
      }
    }
  })

  it('the paper choice is kept in the file and defaults to letter', () => {
    const base: Script = { titlePage: { title: '', author: '', contact: '' }, blocks: [{ kind: 'action', text: '' }] }
    expect(parseScriptFile(serialize({ ...base, paper: 'a4' })).paper).toBe('a4')
    expect(parseScriptFile(serialize(base)).paper).toBeUndefined()
    const raw = JSON.parse(serialize(base))
    raw.script.paper = 'tabloid'
    expect(parseScriptFile(JSON.stringify(raw)).paper).toBeUndefined()
  })
})
