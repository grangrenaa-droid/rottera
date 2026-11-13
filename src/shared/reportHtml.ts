/** A group of rows printed under a heading of its own: a shooting day, with its count and its notes. */
export interface ReportSection {
  title: string
  /** Shown at the right of the heading ("2 cenas · 4/8 pág."). */
  summary?: string
  /** A line under the heading (the day's notes). */
  note?: string
  rows: (string | number)[][]
}

/** One of several tables printed one after the other on the same report (ambiences, then music). */
export interface ReportTable {
  title: string
  columns: string[]
  rows: (string | number)[][]
}

/** One shot of a scene on a day sheet. */
export interface CallSheetShot {
  time: string
  code: string
  text: string
}

/** One scene (or the part of it) on a day sheet: its line, then what it needs. Empty fields are left out. */
export interface CallSheetScene {
  time: string
  number: string
  part: boolean
  intExt: string
  location: string
  dn: string
  pages: string
  synopsis: string
  /** In the order they are filmed. */
  shots: CallSheetShot[]
  cast: string
  elements: string
  /** The scene's sound, on one line (Som window), or nothing. */
  sound?: string
}

/** A shooting day as the crew reads it on set (ordem do dia): a heading, then a block per scene. */
export interface CallSheet {
  day: string
  /** "Dia 2 de 5". */
  dayOf: string
  /** The first time of the day, or ''. */
  start: string
  locations: string[]
  /** "3 cenas · 1 2/8 pág.". */
  summary: string
  notes: string
  /** The ambiences still to record at the day's locations (Som window), or nothing. */
  ambiences?: string
  scenes: CallSheetScene[]
}

/** A report table as a printable page. The paper size, orientation, header and footer are set by the printer call, not here. */
export interface ReportPrint {
  title: string
  columns: string[]
  rows: (string | number)[][]
  /** When given, the rows are printed in these groups (and `rows` is not used). */
  sections?: ReportSection[]
  /** When given, the page is a day sheet instead of a table. */
  callsheet?: CallSheet
  /** When given, these tables are printed one after the other, each with its heading (and `rows` is not used). */
  tables?: ReportTable[]
  scriptTitle: string
}

export const MAX_ROWS = 20000
export const MAX_CELL = 2000

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Cells that are numbers, alone or with a short unit ("35%", "2.000 W", "19,1 A", "10 min"), line up on the right. */
function isNumeric(v: string | number): boolean {
  return typeof v === 'number' || /^-?\d{1,3}(\.\d{3})*([.,]\d+)?\s?(%|[a-zA-Z]{1,3})?$|^-?\d+([.,]\d+)?\s?(%|[a-zA-Z]{1,3})?$/.test(String(v).trim())
}

/** Keeps what the printer is given inside sane limits and as text. */
export function cleanReport(r: ReportPrint): ReportPrint {
  const columnsOf = (v: unknown): string[] => (Array.isArray(v) ? v : []).slice(0, 30).map((c) => String(c).slice(0, 200))
  const cols = columnsOf(r.columns)
  const rowsOf = (list: unknown, cols: string[]): (string | number)[][] =>
    (Array.isArray(list) ? list : [])
      .slice(0, MAX_ROWS)
      .map((row) => cols.map((_, i) => (Array.isArray(row) && typeof row[i] === 'number' ? row[i] : String((Array.isArray(row) ? row[i] : '') ?? '').slice(0, MAX_CELL))))
  const clean = (list: unknown): (string | number)[][] => rowsOf(list, cols)
  const tables = Array.isArray(r.tables)
    ? r.tables.slice(0, 20).map((t) => {
        const c = columnsOf(t?.columns)
        return { title: String(t?.title ?? '').slice(0, 200), columns: c, rows: rowsOf(t?.rows, c) }
      })
    : undefined
  const text = (v: unknown, max: number): string | undefined => (typeof v === 'string' && v.trim() ? v.slice(0, max) : undefined)
  const sections = Array.isArray(r.sections)
    ? r.sections.slice(0, 1000).map((s) => ({
        title: String(s?.title ?? '').slice(0, 200),
        summary: text(s?.summary, 200),
        note: text(s?.note, MAX_CELL),
        rows: clean(s?.rows)
      }))
    : undefined
  const callsheet = r.callsheet && typeof r.callsheet === 'object' ? cleanCallSheet(r.callsheet) : undefined
  return {
    title: String(r.title).slice(0, 200),
    columns: cols,
    rows: clean(r.rows),
    ...(sections ? { sections } : {}),
    ...(callsheet ? { callsheet } : {}),
    ...(tables ? { tables } : {}),
    scriptTitle: String(r.scriptTitle).slice(0, 200)
  }
}

const str = (v: unknown, max: number): string => (typeof v === 'string' || typeof v === 'number' ? String(v).slice(0, max) : '')
const list = <T>(v: unknown, max: number, each: (x: Record<string, unknown>) => T): T[] =>
  Array.isArray(v) ? v.slice(0, max).filter((x) => x && typeof x === 'object').map((x) => each(x as Record<string, unknown>)) : []

function cleanCallSheet(c: CallSheet): CallSheet {
  const x = c as unknown as Record<string, unknown>
  return {
    day: str(x.day, 200),
    dayOf: str(x.dayOf, 100),
    start: str(x.start, 20),
    locations: Array.isArray(x.locations) ? x.locations.slice(0, 100).map((l) => str(l, 200)) : [],
    summary: str(x.summary, 200),
    notes: str(x.notes, MAX_CELL),
    ambiences: str(x.ambiences, MAX_CELL),
    scenes: list(x.scenes, 2000, (s) => ({
      time: str(s.time, 20),
      number: str(s.number, 40),
      part: s.part === true,
      intExt: str(s.intExt, 40),
      location: str(s.location, 200),
      dn: str(s.dn, 4),
      pages: str(s.pages, 20),
      synopsis: str(s.synopsis, MAX_CELL),
      shots: list(s.shots, 500, (h) => ({ time: str(h.time, 20), code: str(h.code, 40), text: str(h.text, 400) })),
      cast: str(s.cast, MAX_CELL),
      elements: str(s.elements, MAX_CELL),
      sound: str(s.sound, MAX_CELL)
    }))
  }
}

/** The day sheet: a heading with the day, then one block per scene with its shots, cast and elements. */
function callSheetHtml(c: CallSheet, scriptTitle: string): string {
  const meta = [c.dayOf, c.start ? `Início ${c.start}` : '', c.summary].filter(Boolean)
  const head =
    `<header class="cs-head"><p class="cs-film">${esc(scriptTitle || 'Sem título')}</p><h1>Ordem do dia · ${esc(c.day)}</h1>` +
    `<p class="cs-meta">${meta.map((m) => `<span>${esc(m)}</span>`).join('')}</p>` +
    (c.locations.length ? `<p class="cs-locs"><b>Locações:</b> ${esc(c.locations.join(' · '))}</p>` : '') +
    (c.ambiences?.trim() ? `<p class="cs-locs"><b>Gravar ambientes:</b> ${esc(c.ambiences)}</p>` : '') +
    (c.notes.trim() ? `<div class="cs-notes">${esc(c.notes)}</div>` : '') +
    `</header>`
  const scene = (s: CallSheetScene): string => {
    const line = [`Cena ${s.number}${s.part ? ' (parte)' : ''}`, s.intExt, s.location, s.dn === 'N' ? 'Noite' : 'Dia', s.pages ? `${s.pages} pág.` : ''].filter(Boolean)
    const shots = s.shots.length
      ? `<ol class="cs-shots">${s.shots
          .map((h) => `<li class="cs-shot"><span class="cs-t">${esc(h.time)}</span><span class="cs-code">${esc(h.code)}</span><span>${esc(h.text)}</span></li>`)
          .join('')}</ol>`
      : ''
    return (
      `<section class="cs-scene"><div class="cs-line"><span class="cs-time">${esc(s.time || '—')}</span><span class="cs-what">${line.map(esc).join(' · ')}</span></div>` +
      (s.synopsis.trim() ? `<p class="cs-syn">${esc(s.synopsis)}</p>` : '') +
      shots +
      (s.cast.trim() ? `<p class="cs-row"><b>Elenco:</b> ${esc(s.cast)}</p>` : '') +
      (s.elements.trim() ? `<p class="cs-row"><b>Elementos:</b> ${esc(s.elements)}</p>` : '') +
      (s.sound?.trim() ? `<p class="cs-row"><b>Som:</b> ${esc(s.sound)}</p>` : '') +
      `</section>`
    )
  }
  return head + (c.scenes.length ? c.scenes.map(scene).join('\n') : '<p class="empty">Nenhuma cena neste dia.</p>')
}

/** A cell with nothing to say: blank or the dash the reports write for "none". */
const blank = (v: string | number): boolean => typeof v !== 'number' && (String(v).trim() === '' || String(v).trim() === '—')

/** Leaves out the columns no row has anything in (keeping at least the first). */
type TableLike = { columns: string[]; rows: (string | number)[][]; sections?: ReportSection[] }

function withoutEmptyColumns<T extends TableLike>(r: T): T {
  const all = r.sections ? r.sections.flatMap((s) => s.rows) : r.rows
  if (all.length === 0) return r
  let keep = r.columns.map((_, i) => all.some((row) => !blank(row[i] ?? '')))
  if (!keep.some(Boolean)) keep = r.columns.map((_, i) => i === 0)
  if (keep.every(Boolean)) return r
  const cut = (rows: (string | number)[][]): (string | number)[][] => rows.map((row) => row.filter((_, i) => keep[i]))
  return {
    ...r,
    columns: r.columns.filter((_, i) => keep[i]),
    rows: cut(r.rows),
    ...(r.sections ? { sections: r.sections.map((s) => ({ ...s, rows: cut(s.rows) })) } : {})
  }
}

/** A table, with its rows in groups when it has them. */
function tableHtml(r: TableLike): string {
  const all = r.sections ? r.sections.flatMap((s) => s.rows) : r.rows
  // a column is numeric when every non-empty cell in it is
  const numeric = r.columns.map((_, i) => {
    const cells = all.map((row) => row[i]).filter((v) => String(v).trim() !== '')
    return cells.length > 0 && cells.every(isNumeric)
  })
  const head = r.columns.map((c, i) => `<th scope="col"${numeric[i] ? ' class="n"' : ''}>${esc(c)}</th>`).join('')
  // a line that adds up the ones above it ("Total") stands out from them
  const line = (row: (string | number)[]): string =>
    `<tr${String(row.find((v) => String(v).trim() !== '') ?? '').trim() === 'Total' ? ' class="total"' : ''}>` +
    `${row.map((v, i) => `<td${numeric[i] ? ' class="n"' : ''}>${esc(String(v))}</td>`).join('')}</tr>`
  const span = r.columns.length
  // in groups: a heading for each (title, and its count at the right), its note, then its rows; a group stays on one page when it fits
  const body = r.sections
    ? r.sections
        .map(
          (s) =>
            `<tbody class="group"><tr class="gh"><th colspan="${span}" scope="colgroup"><div><span>${esc(s.title)}</span>${s.summary ? `<span class="gs">${esc(s.summary)}</span>` : ''}</div></th></tr>` +
            (s.note ? `<tr class="gn"><td colspan="${span}">${esc(s.note)}</td></tr>` : '') +
            (s.rows.length ? s.rows.map(line).join('') : `<tr><td colspan="${span}" class="empty">Nenhuma cena.</td></tr>`) +
            `</tbody>`
        )
        .join('\n')
    : `<tbody>\n${r.rows.map(line).join('\n')}\n</tbody>`
  return `<table><thead><tr>${head}</tr></thead>\n${body}\n</table>`
}

export function buildReportHtml(input: ReportPrint): string {
  const r = withoutEmptyColumns(cleanReport(input))
  const all = r.sections ? r.sections.flatMap((s) => s.rows) : r.rows
  const content = r.tables
    ? r.tables.map((t) => `<h2>${esc(t.title)}</h2>\n${t.rows.length ? tableHtml(withoutEmptyColumns(t)) : '<p class="empty">Nada nesta lista.</p>'}`).join('\n')
    : all.length === 0 && !r.sections?.length
      ? '<p class="empty">Sem dados neste relatório.</p>'
      : tableHtml(r)
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(r.scriptTitle ? `${r.scriptTitle} — ${r.title}` : r.title)}</title>
<style>
* { box-sizing: border-box }
body { margin: 0; font: 9pt/1.35 "Segoe UI", Arial, sans-serif; color: #111 }
h1 { font-size: 14pt; margin: 0 0 2pt }
h2 { font-size: 11pt; margin: 14pt 0 4pt; break-after: avoid }
.sub { color: #444; margin: 0 0 10pt }
/* as wide as its content needs (a table of two short columns does not stretch across the page), never wider than it */
table { width: auto; min-width: 50%; max-width: 100%; border-collapse: collapse; table-layout: auto }
thead { display: table-header-group }
tr { break-inside: avoid }
th, td { border-bottom: 0.5pt solid #999; padding: 3pt 5pt; text-align: left; vertical-align: top; overflow-wrap: break-word }
/* a cell with several lines (one shot per line) keeps them */
td { white-space: pre-line }
/* column names are never cut in the middle of a word ("HORÁR / IO") */
thead th { border-bottom: 1pt solid #111; font-size: 8pt; text-transform: uppercase; letter-spacing: .04em; white-space: nowrap }
/* room after a number, so it does not run into the text of the next column ("43 1", "10 DIA") */
.n { text-align: right; white-space: nowrap; padding-right: 16pt }
tr.total td { font-weight: 600; border-top: 1pt solid #111 }
.empty { color: #555; font-style: italic }
tbody.group { break-inside: avoid }
tr.gh th { padding: 12pt 5pt 3pt; border-bottom: 1pt solid #111; font-size: 10.5pt; font-weight: 700 }
tr.gh div { display: flex; justify-content: space-between; gap: 12pt }
tr.gh .gs { font-size: 9pt; font-weight: 400; color: #333; white-space: nowrap }
tr.gn td { font-style: italic; color: #333; border-bottom: 0.5pt dashed #999 }
/* the day sheet */
.cs-head { border-bottom: 1.5pt solid #111; padding-bottom: 6pt; margin-bottom: 4pt }
.cs-film { margin: 0; font-size: 9pt; text-transform: uppercase; letter-spacing: .06em; color: #333 }
.cs-head h1 { font-size: 16pt; margin: 2pt 0 4pt }
.cs-meta { margin: 0; display: flex; flex-wrap: wrap; gap: 4pt 14pt; font-size: 10pt; font-weight: 600 }
.cs-locs { margin: 4pt 0 0; font-size: 9.5pt }
.cs-notes { margin-top: 6pt; padding: 5pt 7pt; border: 1pt solid #111; font-size: 9.5pt; white-space: pre-wrap }
.cs-scene { break-inside: avoid; border-bottom: 0.5pt solid #999; padding: 6pt 0 7pt }
.cs-line { display: flex; gap: 10pt; align-items: baseline; font-size: 10.5pt; font-weight: 700 }
.cs-time { min-width: 34pt; font-variant-numeric: tabular-nums }
.cs-syn, .cs-row, .cs-shots { margin: 3pt 0 0 44pt }
.cs-syn { font-style: italic; color: #333 }
.cs-shots { list-style: none; padding: 0 }
.cs-shot { display: flex; gap: 8pt; padding: 1pt 0 }
.cs-t { min-width: 30pt; font-variant-numeric: tabular-nums; color: #333 }
.cs-code { min-width: 26pt; font-weight: 700; font-variant-numeric: tabular-nums }
</style></head><body>
${
  r.callsheet
    ? callSheetHtml(r.callsheet, r.scriptTitle)
    : `<h1>${esc(r.title)}</h1>
<p class="sub">${esc(r.scriptTitle || 'Sem título')}</p>
${content}`
}
</body></html>`
}
