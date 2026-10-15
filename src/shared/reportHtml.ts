/** A report table as a printable page. The paper size, orientation, header and footer are set by the printer call, not here. */
export interface ReportPrint {
  title: string
  columns: string[]
  rows: (string | number)[][]
  scriptTitle: string
}

export const MAX_ROWS = 20000
export const MAX_CELL = 2000

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Cells that are plain numbers (or numbers with a trailing %, or a range of pages) line up on the right. */
function isNumeric(v: string | number): boolean {
  return typeof v === 'number' || /^-?\d+([.,]\d+)?\s?%?$/.test(String(v).trim())
}

/** Keeps what the printer is given inside sane limits and as text. */
export function cleanReport(r: ReportPrint): ReportPrint {
  const cols = r.columns.slice(0, 30).map((c) => String(c).slice(0, 200))
  const rows = r.rows.slice(0, MAX_ROWS).map((row) => cols.map((_, i) => (typeof row[i] === 'number' ? row[i] : String(row[i] ?? '').slice(0, MAX_CELL))))
  return { title: String(r.title).slice(0, 200), columns: cols, rows, scriptTitle: String(r.scriptTitle).slice(0, 200) }
}

export function buildReportHtml(input: ReportPrint): string {
  const r = cleanReport(input)
  // a column is numeric when every non-empty cell in it is
  const numeric = r.columns.map((_, i) => {
    const cells = r.rows.map((row) => row[i]).filter((v) => String(v).trim() !== '')
    return cells.length > 0 && cells.every(isNumeric)
  })
  const head = r.columns.map((c, i) => `<th scope="col"${numeric[i] ? ' class="n"' : ''}>${esc(c)}</th>`).join('')
  const body = r.rows
    .map((row) => `<tr>${row.map((v, i) => `<td${numeric[i] ? ' class="n"' : ''}>${esc(String(v))}</td>`).join('')}</tr>`)
    .join('\n')
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(r.scriptTitle ? `${r.scriptTitle} — ${r.title}` : r.title)}</title>
<style>
* { box-sizing: border-box }
body { margin: 0; font: 9pt/1.35 "Segoe UI", Arial, sans-serif; color: #111 }
h1 { font-size: 14pt; margin: 0 0 2pt }
.sub { color: #444; margin: 0 0 10pt }
table { width: 100%; border-collapse: collapse; table-layout: auto }
thead { display: table-header-group }
tr { break-inside: avoid }
th, td { border-bottom: 0.5pt solid #999; padding: 3pt 5pt; text-align: left; vertical-align: top; overflow-wrap: anywhere }
th { border-bottom: 1pt solid #111; font-size: 8pt; text-transform: uppercase; letter-spacing: .04em }
.n { text-align: right; white-space: nowrap }
.empty { color: #555; font-style: italic }
</style></head><body>
<h1>${esc(r.title)}</h1>
<p class="sub">${esc(r.scriptTitle || 'Sem título')}</p>
${
  r.rows.length === 0
    ? '<p class="empty">Sem dados neste relatório.</p>'
    : `<table><thead><tr>${head}</tr></thead><tbody>\n${body}\n</tbody></table>`
}
</body></html>`
}
