import { deflateRawSync } from 'node:zlib'
import type { Block, Kind, Script } from '../shared/types'
import { PAPER, SPEC } from '../shared/paginate'
import { UPPER } from '../shared/elements'
import { sceneNumbers } from '../shared/scenes'

/*
 * The script as a Word document (.docx), in screenplay format, with one paragraph style per element
 * ("Cabeçalho de cena", "Ação", "Personagem"...) so it can go on being edited in Word in the same format.
 * Word does its own page breaks; (CONTINUA)/(CONT.) are not added. Notes, synopses, storyboard and light maps stay out.
 */

// ---------------------------------------------------------------- zip (store + deflate, no dependency)

const CRC = (() => {
  const t: number[] = []
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(b: Buffer): number {
  let c = 0xffffffff
  for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

export function zip(files: { name: string; data: string | Buffer }[]): Buffer {
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0
  for (const f of files) {
    const name = Buffer.from(f.name, 'utf8')
    const raw = typeof f.data === 'string' ? Buffer.from(f.data, 'utf8') : f.data
    const body = deflateRawSync(raw)
    const crc = crc32(raw)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4) // version needed
    local.writeUInt16LE(0x0800, 6) // utf-8 names
    local.writeUInt16LE(8, 8) // deflate
    local.writeUInt32LE(0, 10) // time and date
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(body.length, 18)
    local.writeUInt32LE(raw.length, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0x0800, 8)
    central.writeUInt16LE(8, 10)
    central.writeUInt32LE(0, 12)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(body.length, 20)
    central.writeUInt32LE(raw.length, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt32LE(offset, 42)
    locals.push(local, name, body)
    centrals.push(central, name)
    offset += local.length + name.length + body.length
  }
  const dir = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(files.length, 8)
  end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(dir.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, dir, end])
}

// ---------------------------------------------------------------- document

const xml = (s: string): string =>
  s
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const TW = 1440 // twips per inch

export const STYLE: Record<Kind, { id: string; name: string }> = {
  scene_heading: { id: 'CabecalhoCena', name: 'Cabeçalho de cena' },
  action: { id: 'Acao', name: 'Ação' },
  character: { id: 'Personagem', name: 'Personagem' },
  parenthetical: { id: 'Parentetico', name: 'Parentético' },
  dialogue: { id: 'Dialogo', name: 'Diálogo' },
  transition: { id: 'Transicao', name: 'Transição' },
  shot: { id: 'Plano', name: 'Plano' }
}

/**
 * The text runs from 1.5 in to 7.5 in on any paper, as in the app and its PDF: on A4 (narrower than Letter) the right
 * margin is 0.77 in, not 1 in, so a line holds the same 60 characters and the pages break in the same places.
 */
const TEXT_LEFT = 1.5
const TEXT_RIGHT = 7.5
/**
 * A little room past 7.5 in (0.025 in, less than a character): a word processor rounds the width of Courier and
 * otherwise pushes the last word of a full 60-character line to the next one.
 */
const SLACK = 36

/** Indents of each element inside the text area, from the same table the app paginates with. */
function indents(kind: Kind): { left: number; right: number } {
  const s = SPEC[kind]
  const textRight = TEXT_RIGHT
  const left = Math.max(0, s.left / 10 - TEXT_LEFT)
  const right = Math.max(0, textRight - (s.left + s.width) / 10)
  return { left: Math.round(left * TW), right: Math.round(right * TW) }
}

function stylesXml(): string {
  const styles = (Object.keys(STYLE) as Kind[])
    .map((k) => {
      const ind = indents(k)
      // a cue goes with its speech, and a speech is never cut by a page: the word processor would leave its end on the
      // next page with no name (the app's PDF writes (CONTINUA) and CONT. there; a word processor cannot)
      const keepNext = k === 'scene_heading' || k === 'character' || k === 'parenthetical' ? '<w:keepNext/>' : ''
      const keepLines = k === 'dialogue' || k === 'parenthetical' ? '<w:keepLines/>' : ''
      const keep = keepNext + keepLines
      const jc = SPEC[k].align === 'right' ? '<w:jc w:val="right"/>' : ''
      const caps = UPPER.has(k) ? '<w:caps/>' : ''
      return `<w:style w:type="paragraph" w:customStyle="1" w:styleId="${STYLE[k].id}"><w:name w:val="${STYLE[k].name}"/><w:basedOn w:val="Normal"/><w:qFormat/>
<w:pPr>${keep}<w:spacing w:before="${SPEC[k].before * 240}" w:after="0" w:line="240" w:lineRule="exact"/><w:ind w:left="${ind.left}" w:right="${ind.right}"/>${jc}</w:pPr><w:rPr>${caps}</w:rPr></w:style>`
    })
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New" w:eastAsia="Courier New"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="pt-BR"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="exact"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:customStyle="1" w:styleId="Titulo"><w:name w:val="Título do roteiro"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/></w:pPr><w:rPr><w:b/><w:caps/></w:rPr></w:style>
<w:style w:type="table" w:default="1" w:styleId="TabelaNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:left w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>
${styles}
</w:styles>`
}

const run = (text: string): string => `<w:r><w:t xml:space="preserve">${xml(text)}</w:t></w:r>`
const para = (style: string, inner: string, extraPPr = ''): string => `<w:p><w:pPr><w:pStyle w:val="${style}"/>${extraPPr}</w:pPr>${inner}</w:p>`

/** Where revision asterisks go, from the page's left edge: the column of the PDF's right-hand scene numbers. */
const MARK_COLUMN = 7.65

/**
 * Revision mode: an asterisk in the right margin beside a changed paragraph. It is a framed paragraph, which floats
 * at the height of the paragraph that follows it and takes no room in the text, so the pages break as before.
 * `before` is the blank space above that paragraph (in lines), so the mark sits on its first line of text.
 */
function revMark(before: number): string {
  return `<w:p><w:pPr><w:framePr w:w="${Math.round(0.2 * TW)}" w:hSpace="0" w:wrap="around" w:vAnchor="text" w:hAnchor="page" w:x="${Math.round(MARK_COLUMN * TW)}" w:y="${before * 240}"/><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="exact"/></w:pPr>${run('*')}</w:p>`
}

function blockPara(b: Block, number: string | undefined, next?: Block): string {
  const p = blockParaText(b, number, next)
  // a numbered heading carries the mark after its right-hand number (see blockParaText)
  return b.rev && !(b.kind === 'scene_heading' && number) ? revMark(SPEC[b.kind].before) + p : p
}

function blockParaText(b: Block, number: string | undefined, next?: Block): string {
  const style = STYLE[b.kind].id
  // a speech in parts (line, parenthetical, line) stays together, so its second part never opens a page without the name
  if (b.kind === 'dialogue' && next && !next.dual && (next.kind === 'parenthetical' || next.kind === 'dialogue')) {
    return para(style, run(b.text), '<w:keepNext/>')
  }
  if (b.kind === 'scene_heading' && number) {
    // the scene number in both margins, as in a shooting script (and in the PDF)
    const right = Math.round((TEXT_RIGHT - TEXT_LEFT + 0.5) * TW)
    return para(
      style,
      `${run(number)}<w:r><w:tab/></w:r>${run(b.text)}<w:r><w:tab/></w:r>${run(b.rev ? `${number} *` : number)}`,
      `<w:tabs><w:tab w:val="left" w:pos="0"/><w:tab w:val="right" w:pos="${right}"/></w:tabs><w:ind w:left="0" w:right="-720" w:hanging="720"/>`
    )
  }
  return para(style, run(b.text))
}

/** One speech of a dual dialogue inside its table cell: the indents are halved to fit the column. */
function cellPara(b: Block): string {
  const left = b.kind === 'character' ? 720 : b.kind === 'parenthetical' ? 360 : 0
  return para(STYLE[b.kind].id, run(b.text), `<w:ind w:left="${left}" w:right="0"/>`)
}

function dualTable(left: Block[], right: Block[], textWidth: number): string {
  const half = Math.floor(textWidth / 2)
  const cell = (bs: Block[]): string =>
    `<w:tc><w:tcPr><w:tcW w:w="${half}" w:type="dxa"/></w:tcPr>${bs.map(cellPara).join('') || '<w:p/>'}</w:tc>`
  return `<w:tbl><w:tblPr><w:tblW w:w="${half * 2}" w:type="dxa"/><w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr>
<w:tblGrid><w:gridCol w:w="${half}"/><w:gridCol w:w="${half}"/></w:tblGrid><w:tr><w:trPr><w:cantSplit/></w:trPr>${cell(left)}${cell(right)}</w:tr></w:tbl>` +
    // a table needs a paragraph after it; this one takes no room, so the next element keeps its usual one blank line
    `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/></w:pPr></w:p>`
}

function sectPr(paper: { width: number; height: number }, header: boolean): string {
  return `<w:sectPr>${header ? '<w:headerReference w:type="default" r:id="rIdHeader"/>' : ''}<w:pgSz w:w="${Math.round(paper.width * TW)}" w:h="${Math.round(paper.height * TW)}"/>
<w:pgMar w:top="${TW}" w:right="${Math.round((paper.width - TEXT_RIGHT) * TW) - SLACK}" w:bottom="${TW}" w:left="${Math.round(TEXT_LEFT * TW)}" w:header="${TW / 2}" w:footer="${TW / 2}" w:gutter="0"/>${header ? '<w:pgNumType w:start="1"/><w:titlePg/>' : ''}</w:sectPr>`
}

export function toDocx(script: Script): Buffer {
  const paper = PAPER[script.paper ?? 'letter']
  const textWidth = Math.round((TEXT_RIGHT - TEXT_LEFT) * TW)
  const blocks = script.blocks
  const numbers = script.numberScenes || script.scenesLocked ? sceneNumbers(blocks, script.scenesLocked === true) : []
  const body: string[] = []

  const tp = script.titlePage
  if (tp.title.trim()) {
    body.push(para('Titulo', run(tp.title), '<w:spacing w:before="3600"/>'))
    if (tp.author.trim()) {
      body.push(para('Normal', run('Escrito por'), '<w:spacing w:before="720"/><w:jc w:val="center"/>'))
      body.push(para('Normal', run(tp.author), '<w:spacing w:before="240"/><w:jc w:val="center"/>'))
    }
    tp.contact
      .split(/\r?\n/)
      .filter((l) => l.trim())
      .forEach((l, i) => body.push(para('Normal', run(l), i === 0 ? '<w:spacing w:before="4320"/>' : '')))
    // the title page is its own section: no page number, and the script starts again at 1
    body.push(`<w:p><w:pPr>${sectPr(paper, false)}</w:pPr></w:p>`)
  }

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]
    // a dual dialogue: the left speech, then the right one marked dual
    if (b.kind === 'character' && !b.dual) {
      let j = i + 1
      while (j < blocks.length && !blocks[j].dual && (blocks[j].kind === 'dialogue' || blocks[j].kind === 'parenthetical')) j++
      if (j < blocks.length && blocks[j].dual && blocks[j].kind === 'character') {
        let k = j + 1
        while (k < blocks.length && blocks[k].dual && (blocks[k].kind === 'dialogue' || blocks[k].kind === 'parenthetical')) k++
        // a change in either speech of a dual dialogue marks the pair
        const changed = blocks.slice(i, k).some((x) => x.rev)
        body.push((changed ? revMark(SPEC.character.before) : '') + dualTable(blocks.slice(i, j), blocks.slice(j, k), textWidth))
        i = k - 1
        continue
      }
    }
    body.push(blockPara(b, numbers[i] ?? undefined, blocks[i + 1]))
  }

  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<w:body>
${body.join('\n')}
${sectPr(paper, true)}
</w:body></w:document>`

  const header = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="right"/></w:pPr>
<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>2</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r><w:r><w:t>.</w:t></w:r></w:p></w:hdr>`

  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z')
  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>${xml(tp.title)}</dc:title><dc:creator>${xml(tp.author)}</dc:creator><dc:language>pt-BR</dc:language>
<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`

  return zip([
    {
      name: '[Content_Types].xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`
    },
    {
      name: '_rels/.rels',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`
    },
    {
      name: 'word/_rels/document.xml.rels',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rIdHeader" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/></Relationships>`
    },
    { name: 'word/document.xml', data: document },
    { name: 'word/styles.xml', data: stylesXml() },
    { name: 'word/header1.xml', data: header },
    { name: 'docProps/core.xml', data: core }
  ])
}
