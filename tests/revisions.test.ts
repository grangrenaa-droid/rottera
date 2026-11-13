import { describe, expect, it } from 'vitest'
import { inflateRawSync } from 'node:zlib'
import { latestRevision, revisionHeading, startRevision } from '../src/shared/revisions'
import { parseScriptFile, serialize } from '../src/shared/scriptfile'
import { buildPdfHtml } from '../src/main/pdf'
import { toDocx } from '../src/main/docx'
import type { Block, Script } from '../src/shared/types'

function unzip(buf: Buffer): Record<string, string> {
  const out: Record<string, string> = {}
  let p = 0
  while (buf.readUInt32LE(p) === 0x04034b50) {
    const size = buf.readUInt32LE(p + 18)
    const nameLen = buf.readUInt16LE(p + 26)
    const extra = buf.readUInt16LE(p + 28)
    const name = buf.subarray(p + 30, p + 30 + nameLen).toString('utf8')
    const start = p + 30 + nameLen + extra
    out[name] = inflateRawSync(buf.subarray(start, start + size)).toString('utf8')
    p = start + size
  }
  return out
}

/** Two pages of action, a change on page 1 (blue) and one on page 2 (pink). */
function script(): Script {
  const blocks: Block[] = [{ kind: 'scene_heading', text: 'INT. COZINHA - DIA' }]
  for (let i = 0; i < 70; i++) blocks.push({ kind: 'action', text: `Linha ${i}.` })
  blocks[2] = { ...blocks[2], rev: 'azul' }
  blocks[60] = { ...blocks[60], rev: 'rosa' }
  return {
    titlePage: { title: '', author: '', contact: '' },
    blocks,
    revision: { mode: false, color: 'rosa', dates: { azul: '2026-11-02', rosa: '2026-11-12' } }
  }
}

describe('revision sets', () => {
  it('a set gets its date when its round starts, and keeps it', () => {
    const on = startRevision({ mode: true, color: 'azul' }, '2026-11-02')
    expect(on.dates).toEqual({ azul: '2026-11-02' })
    expect(startRevision(on, '2026-11-20').dates).toEqual({ azul: '2026-11-02' })
    expect(startRevision({ ...on, color: 'rosa' }, '2026-11-12').dates).toEqual({ azul: '2026-11-02', rosa: '2026-11-12' })
    // with the mode off nothing starts
    expect(startRevision({ mode: false, color: 'verde' }, '2026-11-12').dates).toBeUndefined()
  })

  it('the latest set on a page is the one later in the production order', () => {
    expect(latestRevision(['azul', 'amarela', 'rosa'])).toBe('amarela')
    expect(latestRevision([])).toBeNull()
  })

  it('heads a page with the set and its date', () => {
    expect(revisionHeading('rosa', { rosa: '2026-11-12' })).toBe('REVISÃO ROSA · 12/11/2026')
    expect(revisionHeading('azul')).toBe('REVISÃO AZUL')
  })

  it('the dates are kept in the file', () => {
    const back = parseScriptFile(serialize(script()))
    expect(back.revision?.dates).toEqual({ azul: '2026-11-02', rosa: '2026-11-12' })
  })
})

describe('revision marks in the PDF', () => {
  const html = buildPdfHtml(script(), { scriptOnly: true })
  const pages = html.split('<section class="page">').slice(1)

  it('marks each changed line with an asterisk in the right margin', () => {
    expect((html.match(/<span class="rv"[^>]*>\*<\/span>/g) || []).length).toBe(2)
  })

  it('heads each changed page with its latest set and date, and leaves the others alone', () => {
    const pageOf = (text: string): string => pages.find((p) => p.includes(`>${text}<`)) ?? ''
    expect(pageOf('Linha 1.')).toContain('REVISÃO AZUL · 02/11/2026') // blocks[2]
    expect(pageOf('Linha 59.')).toContain('REVISÃO ROSA · 12/11/2026') // blocks[60]
    expect(pageOf('Linha 1.')).not.toBe(pageOf('Linha 59.'))
    // a page in between with no change has no heading
    expect(pages.filter((p) => !p.includes('REVISÃO')).length).toBeGreaterThan(0)
    const clean = buildPdfHtml({ ...script(), blocks: script().blocks.map(({ rev: _r, ...b }) => b) }, { scriptOnly: true })
    expect(clean).not.toContain('REVISÃO')
    expect(clean).not.toContain('class="rv"')
  })

  it('a numbered heading carries the mark after its number', () => {
    const s = script()
    s.numberScenes = true
    s.blocks[0] = { ...s.blocks[0], rev: 'azul' }
    expect(buildPdfHtml(s, { scriptOnly: true })).toMatch(/<span class="sn"[^>]*>1 \*<\/span>/)
  })
})

describe('revision marks in Word', () => {
  it('puts an asterisk in the right margin beside each changed paragraph, and only there', () => {
    const doc = unzip(toDocx(script()))['word/document.xml']
    const frames = doc.match(/<w:framePr [^>]*\/>[\s\S]*?<w:t xml:space="preserve">\*<\/w:t>/g) || []
    expect(frames).toHaveLength(2)
    const clean = unzip(toDocx({ ...script(), blocks: script().blocks.map(({ rev: _r, ...b }) => b) }))['word/document.xml']
    expect(clean).not.toContain('w:framePr')
  })
})
