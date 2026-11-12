import { describe, expect, it } from 'vitest'
import { inflateRawSync } from 'node:zlib'
import { XMLValidator } from 'fast-xml-parser'
import { toDocx } from '../src/main/docx'
import { scriptPageHtml } from '../src/main/pdf'
import type { Script } from '../src/shared/types'

/** Reads the files of a zip made by toDocx (local headers, deflate). */
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

const script: Script = {
  titlePage: { title: 'Chuva & Café', author: 'Ana Souza', contact: 'ana@exemplo.com\n(11) 9999-0000' },
  paper: 'a4',
  numberScenes: true,
  blocks: [
    { kind: 'scene_heading', text: 'INT. COZINHA - DIA', syn: 'não vai para o Word' },
    { kind: 'action', text: 'Marina coa o café <devagar>.' },
    { kind: 'character', text: 'MARINA' },
    { kind: 'dialogue', text: 'Você veio.' },
    { kind: 'character', text: 'DAVI', dual: true },
    { kind: 'parenthetical', text: '(ao mesmo tempo)', dual: true },
    { kind: 'dialogue', text: 'Eu vim.', dual: true },
    { kind: 'transition', text: 'CORTA PARA:' }
  ]
}

describe('Word export', () => {
  const files = unzip(toDocx(script))

  it('is a Word package whose parts are all well-formed XML', () => {
    expect(Object.keys(files).sort()).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'docProps/core.xml',
      'word/_rels/document.xml.rels',
      'word/document.xml',
      'word/header1.xml',
      'word/styles.xml'
    ])
    for (const [name, text] of Object.entries(files)) expect(XMLValidator.validate(text), name).toBe(true)
  })

  it('has one paragraph style per screenplay element, with the right indents for the paper', () => {
    const styles = files['word/styles.xml']
    for (const name of ['Cabeçalho de cena', 'Ação', 'Personagem', 'Parentético', 'Diálogo', 'Transição', 'Plano']) expect(styles).toContain(`w:val="${name}"`)
    // character cue 3.7 in from the page edge = 2.2 in inside the 1.5 in margin
    expect(styles).toMatch(/w:styleId="Personagem">[\s\S]*?<w:ind w:left="3168"/)
    // dialogue ends 6.0 in from the page edge on any paper, as in the app (1.5 in before the text's right edge at 7.5 in)
    expect(styles).toMatch(/w:styleId="Dialogo">[\s\S]*?<w:ind w:left="1440" w:right="2160"/)
  })

  it('keeps 6 in of text on A4 too (a narrower right margin), so lines and pages break as in the app', () => {
    const doc = files['word/document.xml']
    // A4 is 8.27 in wide: 0.77 in on the right, less a hair of room for the word processor's rounding
    expect(doc).toContain('w:right="1073" w:bottom="1440" w:left="2160"')
  })

  it('never cuts a speech across pages, so its end does not open a page without the name', () => {
    const styles = files['word/styles.xml']
    expect(styles).toMatch(/w:styleId="Dialogo">[\s\S]*?<w:keepLines\/>/)
    expect(styles).toMatch(/w:styleId="Personagem">[\s\S]*?<w:keepNext\/>/)
    expect(styles).toMatch(/w:styleId="Parentetico">[\s\S]*?<w:keepNext\/><w:keepLines\/>/)
    // the dual dialogue row stays whole, and the paragraph after its table takes no room
    const doc = files['word/document.xml']
    expect(doc).toContain('<w:trPr><w:cantSplit/></w:trPr>')
    expect(doc).toContain('<w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/>')
  })

  it('writes the scene number in both margins', () => {
    const doc = files['word/document.xml']
    expect(doc).toMatch(/<w:t xml:space="preserve">1<\/w:t><\/w:r><w:r><w:tab\/><\/w:r><w:r><w:t xml:space="preserve">INT\. COZINHA - DIA<\/w:t><\/w:r><w:r><w:tab\/><\/w:r><w:r><w:t xml:space="preserve">1<\/w:t>/)
    expect(doc).toContain('<w:tab w:val="right" w:pos="9360"/>')
  })

  it('writes the title page as its own section, numbers scenes in the margin, and puts dual dialogue side by side', () => {
    const doc = files['word/document.xml']
    expect(doc).toContain('Chuva &amp; Café')
    expect(doc).toContain('Marina coa o café &lt;devagar&gt;.')
    expect(doc.match(/<w:sectPr>/g)).toHaveLength(2)
    expect(doc).toContain('<w:pgSz w:w="11909" w:h="16834"/>') // A4
    expect(doc).toMatch(/<w:pStyle w:val="CabecalhoCena"\/>.*?<w:t xml:space="preserve">1<\/w:t>.*?<w:tab\/>.*?INT\. COZINHA - DIA/)
    expect(doc).toMatch(/<w:tbl>[\s\S]*Você veio\.[\s\S]*<\/w:tc><w:tc>[\s\S]*DAVI[\s\S]*Eu vim\.[\s\S]*<\/w:tbl>/)
    expect(doc).not.toContain('não vai para o Word')
    expect(files['docProps/core.xml']).toContain('<dc:creator>Ana Souza</dc:creator>')
  })
})

describe('web page export', () => {
  it('is the PDF’s pages with a screen frame around them', () => {
    const html = scriptPageHtml(script)
    expect(html).toContain('@media screen')
    expect(html).toContain('CHUVA &amp; CAFÉ')
    expect(html).toContain('<meta name="viewport"')
    expect(html.indexOf('@media screen')).toBeLessThan(html.indexOf('</style>'))
  })
})
