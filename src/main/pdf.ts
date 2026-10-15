import { readFileSync } from 'node:fs'
import type { Script } from '../shared/types'
import { PAPER, paginate } from '../shared/paginate'
import { SB_PAGE, storyboardPages } from '../shared/storyboard'
import { lightMapSvg } from '../shared/lightmap'
import { listCharacters, presentationOf } from '../shared/characters'

function fontFace(file: string, weight: number): string {
  try {
    const path = require.resolve(`@fontsource/courier-prime/files/${file}`)
    const b64 = readFileSync(path).toString('base64')
    return `@font-face{font-family:'Courier Prime';font-weight:${weight};src:url(data:font/woff2;base64,${b64}) format('woff2');}`
  } catch {
    return ''
  }
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const inch = (n: number): string => `${n.toFixed(3)}in`

export interface PdfOptions {
  /** Print only the storyboard pages. */
  storyboardOnly?: boolean
  /** Print only the script, even when the storyboard is set to be included. */
  scriptOnly?: boolean
  /** Print only the lighting diagrams. */
  lightMapsOnly?: boolean
  /** Print only the character presentations. */
  charactersOnly?: boolean
}

function storyboardHtml(script: Script): string {
  const sb = script.storyboard
  if (!sb || sb.frames.length === 0) return ''
  const pages = storyboardPages(sb, script.paper ?? 'letter')
  const title = script.titlePage.title.trim() || 'Roteiro'
  return pages
    .map((page) => {
      const cells = page.cells
        .map((c) => {
          const f = sb.frames[c.index]
          const label = [`${c.index + 1}`, f.scene ? `Cena ${f.scene}` : ''].filter(Boolean).join(' · ')
          const pic = f.image
            ? `<img src="${f.image}" alt="" style="left:${inch(c.fx)};top:${inch(c.fy)};width:${inch(c.fw)};height:${inch(c.fh)}">`
            : ''
          return (
            `<div class="sb-frame" style="left:${inch(c.fx)};top:${inch(c.fy)};width:${inch(c.fw)};height:${inch(c.fh)}"></div>` +
            pic +
            `<div class="sb-cap" style="left:${inch(c.x)};top:${inch(c.captionY)};width:${inch(c.w)};height:${inch(c.captionH)}">` +
            `<b>${esc(label)}</b>${f.caption ? `<span>${esc(f.caption)}</span>` : ''}</div>`
          )
        })
        .join('')
      return (
        `<section class="page sb">` +
        `<div class="sb-head"><b>STORYBOARD</b> — ${esc(title.toUpperCase())}` +
        `<span>${page.number} / ${pages.length}</span></div>` +
        cells +
        `</section>`
      )
    })
    .join('')
}

/** One page per character: the presentation, built from the sheet and from the script's own numbers. */
function charactersHtml(script: Script, onlyIncluded: boolean): string {
  const entries = listCharacters(script).filter((e) => {
    const written = e.sheet !== null && !presentationOf(e.sheet, e.name, e.stats).empty
    if (!onlyIncluded) return e.inScript || written
    return written && e.sheet?.includeInPdf !== false
  })
  const title = script.titlePage.title.trim() || 'Roteiro'
  return entries
    .map((e, i) => {
      const p = presentationOf(e.sheet, e.name, e.stats)
      const pic = p.image ? `<img class="ch-pic" src="${p.image}" alt="">` : ''
      const sections = p.sections
        .map((x) => `<h3>${esc(x.heading)}</h3><p>${esc(x.text).replace(/\n/g, '<br>')}</p>`)
        .join('')
      const stats = p.inScript.map((x) => `<li>${esc(x)}</li>`).join('')
      return (
        `<section class="page ch">` +
        `<div class="sb-head"><b>FICHA DE PERSONAGEM</b> — ${esc(title.toUpperCase())}<span>${i + 1} / ${entries.length}</span></div>` +
        `<div class="ch-body">` +
        `<div class="ch-top">${pic}<div><h2>${esc(p.title)}</h2>${p.subtitle ? `<div class="ch-sub">${esc(p.subtitle)}</div>` : ''}</div></div>` +
        sections +
        `<h3>No roteiro</h3><ul>${stats}</ul>` +
        `</div></section>`
      )
    })
    .join('')
}

function lightMapsHtml(script: Script, onlyIncluded: boolean): string {
  const maps = (script.lightMaps ?? []).filter((m) => !onlyIncluded || m.includeInPdf)
  const title = script.titlePage.title.trim() || 'Roteiro'
  return maps
    .map((m, i) => {
      const svg = lightMapSvg(m, { legend: true })
      const where = m.scene ? ` · Cena ${esc(m.scene)}` : ''
      return (
        `<section class="page lm">` +
        `<div class="sb-head"><b>MAPA DE LUZ</b> — ${esc(m.name.toUpperCase())}${where}` +
        `<span>${i + 1} / ${maps.length}</span></div>` +
        `<div class="lm-sub">${esc(title.toUpperCase())} · ${m.width} m × ${m.height} m</div>` +
        `<div class="lm-svg">${svg}</div>` +
        (m.notes.trim() ? `<div class="lm-notes"><b>Notas</b>${esc(m.notes)}</div>` : '') +
        `</section>`
      )
    })
    .join('')
}

/** Builds the print document: title page, script pages, then (optionally) the storyboard pages. */
export function buildPdfHtml(script: Script, opts: PdfOptions = {}): string {
  const tp = script.titlePage
  const paper = script.paper ?? 'letter'
  const sheet = PAPER[paper]
  const hasTitle = tp.title.trim() !== ''
  const only = opts.storyboardOnly === true || opts.lightMapsOnly === true || opts.charactersOnly === true
  const wantStoryboard =
    opts.storyboardOnly === true || (!only && script.storyboard?.includeInPdf === true && !opts.scriptOnly)
  const wantMaps = opts.lightMapsOnly === true || (!only && !opts.scriptOnly)
  const wantCharacters = opts.charactersOnly === true || (!only && !opts.scriptOnly)

  let scriptPart = ''
  if (!only) {
    const { pages } = paginate(script.blocks, paper)
    const title = hasTitle
      ? `<section class="page title">
         <div class="t-main">${esc(tp.title.toUpperCase())}</div>
         ${tp.author ? `<div class="t-by">Escrito por</div><div class="t-author">${esc(tp.author)}</div>` : ''}
         ${tp.contact ? `<div class="t-contact">${esc(tp.contact).replace(/\n/g, '<br>')}</div>` : ''}
       </section>`
      : ''
    const body = pages
      .map((lines, idx) => {
        const num = idx > 0 ? `<div class="num">${idx + 1}.</div>` : ''
        const rows = lines
          .map((l) => {
            const style = `margin-left:${(l.left / 10).toFixed(1)}in;width:${(l.width / 10).toFixed(1)}in;${
              l.align === 'right' ? 'text-align:right;' : ''
            }${l.sameRow ? 'margin-top:-12pt;' : ''}`
            return `<div class="l" style="${style}">${l.text === '' ? '&nbsp;' : esc(l.text)}</div>`
          })
          .join('')
        return `<section class="page">${num}${rows}</section>`
      })
      .join('')
    scriptPart = title + body
  }

  const chPart = wantCharacters ? charactersHtml(script, opts.charactersOnly !== true) : ''
  const sbPart = wantStoryboard ? storyboardHtml(script) : ''
  const lmPart = wantMaps ? lightMapsHtml(script, opts.lightMapsOnly !== true) : ''

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(tp.title || 'Roteiro')}</title>
<style>
${fontFace('courier-prime-latin-400-normal.woff2', 400)}
${fontFace('courier-prime-latin-700-normal.woff2', 700)}
@page { size: ${sheet.width}in ${sheet.height}in; margin: 0 }
html, body { margin: 0; padding: 0; background: #fff; color: #000 }
body { font: 12pt/12pt 'Courier Prime', 'Courier New', Courier, monospace }
.page { position: relative; width: ${sheet.width}in; height: ${sheet.height}in; box-sizing: border-box; padding-top: 1in; overflow: hidden;
        page-break-after: always; break-after: page }
.l { height: 12pt; white-space: pre; overflow: visible }
.num { position: absolute; top: 0.5in; right: 1in }
.title { padding-top: 3.5in; text-align: center }
.t-main { font-weight: 700; font-size: 12pt; margin-bottom: 36pt }
.t-by { margin-bottom: 12pt }
.t-contact { position: absolute; left: 1.5in; bottom: 1in; text-align: left }
.sb { padding-top: 0 }
.sb-head { position: absolute; left: ${SB_PAGE.left}in; right: ${SB_PAGE.right}in; top: 0.45in; font-size: 10pt; line-height: 12pt;
           border-bottom: 0.75pt solid #000; padding-bottom: 4pt }
.sb-head span { float: right }
.sb-frame { position: absolute; border: 0.75pt solid #000; box-sizing: border-box; background: #fff }
.sb img { position: absolute; object-fit: contain; box-sizing: border-box; background: #fff }
.sb-cap { position: absolute; font-size: 9pt; line-height: 11pt; overflow: hidden }
.sb-cap b { display: block; font-size: 9pt }
.sb-cap span { display: block; white-space: normal }
.lm { padding-top: 0 }
.lm-sub { position: absolute; left: ${SB_PAGE.left}in; right: ${SB_PAGE.right}in; top: 0.85in; font-size: 9pt; color: #444 }
.lm-svg { position: absolute; left: ${SB_PAGE.left}in; top: 1.2in; width: ${(sheet.width - SB_PAGE.left - SB_PAGE.right).toFixed(2)}in }
.lm-svg svg { width: ${(sheet.width - SB_PAGE.left - SB_PAGE.right).toFixed(2)}in; height: auto; display: block }
.lm-notes { position: absolute; left: ${SB_PAGE.left}in; right: ${SB_PAGE.right}in; bottom: 0.6in; font-size: 9pt; line-height: 11pt;
            white-space: pre-wrap; max-height: 1.6in; overflow: hidden }
.lm-notes b { display: block }
.ch { padding-top: 0 }
.ch-body { position: absolute; left: ${SB_PAGE.left}in; right: ${SB_PAGE.right}in; top: 0.95in; bottom: 0.7in; overflow: hidden; font-size: 10pt; line-height: 13pt }
.ch-top { display: flex; gap: 0.25in; align-items: flex-start; margin-bottom: 14pt }
.ch-pic { width: 1.9in; height: 2.4in; object-fit: cover; border: 0.75pt solid #000 }
.ch-body h2 { font-size: 16pt; line-height: 19pt; margin: 0 0 4pt }
.ch-sub { font-size: 10pt; color: #333 }
.ch-body h3 { font-size: 9pt; text-transform: uppercase; letter-spacing: .06em; margin: 11pt 0 2pt; border-bottom: 0.5pt solid #777 }
.ch-body p { margin: 0 }
.ch-body ul { margin: 2pt 0 0; padding-left: 14pt }
</style></head><body>${scriptPart}${chPart}${sbPart}${lmPart}</body></html>`
}
