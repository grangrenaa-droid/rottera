import { XMLParser } from 'fast-xml-parser'
import type { Block, Kind, Script } from './types'

const MAX_BYTES = 5 * 1024 * 1024

const FROM_FDX: Record<string, Kind> = {
  'scene heading': 'scene_heading',
  action: 'action',
  character: 'character',
  dialogue: 'dialogue',
  parenthetical: 'parenthetical',
  transition: 'transition',
  shot: 'shot',
  general: 'action'
}

const TO_FDX: Record<Kind, string> = {
  scene_heading: 'Scene Heading',
  action: 'Action',
  character: 'Character',
  dialogue: 'Dialogue',
  parenthetical: 'Parenthetical',
  transition: 'Transition',
  shot: 'Shot'
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return []
  return Array.isArray(v) ? v : [v]
}

function textOf(p: Record<string, unknown>): string {
  return asArray(p.Text as unknown)
    .map((t) => {
      if (typeof t === 'string' || typeof t === 'number') return String(t)
      if (t && typeof t === 'object') {
        const v = (t as Record<string, unknown>)['#text']
        return v === undefined ? '' : String(v)
      }
      return ''
    })
    .join('')
}

/** Parses an FDX (.fdx) screenplay document. Throws on oversized or unrelated input. */
export function parseFdx(xml: string): Script {
  if (xml.length > MAX_BYTES) throw new Error('Arquivo FDX grande demais (limite de 5 MB).')
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Arquivo FDX com declarações DTD não é aceito.')
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    processEntities: true,
    parseTagValue: false,
    isArray: (name) => name === 'Paragraph' || name === 'Text'
  })
  const doc = parser.parse(xml) as Record<string, any>
  const fd = doc.FinalDraft
  if (!fd) throw new Error('Arquivo não é um FDX válido.')

  const blocks: Block[] = []
  for (const p of asArray<Record<string, unknown>>(fd.Content?.Paragraph)) {
    const kind = FROM_FDX[String(p.Type ?? 'Action').toLowerCase()] ?? 'action'
    blocks.push({ kind, text: textOf(p) })
  }

  const tpLines: string[] = []
  for (const p of asArray<Record<string, unknown>>(fd.TitlePage?.Content?.Paragraph)) {
    const t = textOf(p).trim()
    if (t) tpLines.push(t)
  }
  const byIdx = tpLines.findIndex((l) => /^(escrito por|written by|by|de)$/i.test(l))
  return {
    titlePage: {
      title: tpLines[0] ?? '',
      author: byIdx >= 0 ? (tpLines[byIdx + 1] ?? '') : '',
      contact: ''
    },
    blocks: blocks.length ? blocks : [{ kind: 'scene_heading', text: '' }]
  }
}

// XML 1.0 cannot carry most control characters, not even escaped. Drop them (tab, LF and CR stay).
// eslint-disable-next-line no-control-regex
const ILLEGAL_XML = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g

const esc = (s: string): string =>
  s
    .replace(ILLEGAL_XML, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

export function toFdx(script: Script): string {
  const para = (type: string, text: string): string =>
    `    <Paragraph Type="${esc(type)}"><Text>${esc(text)}</Text></Paragraph>`
  const body = script.blocks.map((b) => para(TO_FDX[b.kind], b.text)).join('\n')
  const tp = script.titlePage
  const tpParas = [tp.title, 'Escrito por', tp.author]
    .filter((x) => x.trim() !== '')
    .map((t) => `      <Paragraph Alignment="Center"><Text>${esc(t)}</Text></Paragraph>`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>
<FinalDraft DocumentType="Script" Template="No" Version="1">
  <Content>
${body}
  </Content>
  <TitlePage>
    <Content>
${tpParas}
    </Content>
  </TitlePage>
</FinalDraft>
`
}
