/** A group of rows printed under a heading of its own: a shooting day, with its count and its notes. */
export interface ReportSection {
  title: string
  /** Shown at the right of the heading ("2 cenas · 4/8 pág."). */
  summary?: string
  /** A line under the heading (the day's notes). */
  note?: string
  rows: (string | number)[][]
}

/** A report table as a printable page. The paper size, orientation, header and footer are set by the printer call, not here. */
export interface ReportPrint {
  title: string
  columns: string[]
  rows: (string | number)[][]
  /** When given, the rows are printed in these groups (and `rows` is not used). */
  sections?: ReportSection[]
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
  const cols = r.columns.slice(0, 30).map((c) => String(c).slice(0, 200))
  const clean = (list: unknown): (string | number)[][] =>
    (Array.isArray(list) ? list : [])
      .slice(0, MAX_ROWS)
      .map((row) => cols.map((_, i) => (Array.isArray(row) && typeof row[i] === 'number' ? row[i] : String((Array.isArray(row) ? row[i] : '') ?? '').slice(0, MAX_CELL))))
  const text = (v: unknown, max: number): string | undefined => (typeof v === 'string' && v.trim() ? v.slice(0, max) : undefined)
  const sections = Array.isArray(r.sections)
    ? r.sections.slice(0, 1000).map((s) => ({
        title: String(s?.title ?? '').slice(0, 200),
        summary: text(s?.summary, 200),
        note: text(s?.note, MAX_CELL),
        rows: clean(s?.rows)
      }))
    : undefined
  return { title: String(r.title).slice(0, 200), columns: cols, rows: clean(r.rows), ...(sections ? { sections } : {}), scriptTitle: String(r.scriptTitle).slice(0, 200) }
}

export function buildReportHtml(input: ReportPrint): string {
  const r = cleanReport(input)
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
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(r.scriptTitle ? `${r.scriptTitle} — ${r.title}` : r.title)}</title>
<style>
* { box-sizing: border-box }
body { margin: 0; font: 9pt/1.35 "Segoe UI", Arial, sans-serif; color: #111 }
h1 { font-size: 14pt; margin: 0 0 2pt }
.sub { color: #444; margin: 0 0 10pt }
/* as wide as its content needs (a table of two short columns does not stretch across the page), never wider than it */
table { width: auto; min-width: 50%; max-width: 100%; border-collapse: collapse; table-layout: auto }
thead { display: table-header-group }
tr { break-inside: avoid }
th, td { border-bottom: 0.5pt solid #999; padding: 3pt 5pt; text-align: left; vertical-align: top; overflow-wrap: break-word }
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
</style></head><body>
<h1>${esc(r.title)}</h1>
<p class="sub">${esc(r.scriptTitle || 'Sem título')}</p>
${
  all.length === 0 && !r.sections?.length
    ? '<p class="empty">Sem dados neste relatório.</p>'
    : `<table><thead><tr>${head}</tr></thead>\n${body}\n</table>`
}
</body></html>`
}
