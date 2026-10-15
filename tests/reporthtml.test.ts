import { describe, expect, it } from 'vitest'
import { MAX_CELL, MAX_ROWS, buildReportHtml, cleanReport } from '../src/shared/reportHtml'

const base = { title: 'Lista de cenas', scriptTitle: 'Chuva', columns: ['Cena', 'Local', 'Páginas'], rows: [[1, 'COZINHA', '1-2'], [2, 'RUA', '3']] as (string | number)[][] }

describe('report page', () => {
  it('has a header row that repeats, the title and the script name', () => {
    const h = buildReportHtml(base)
    expect(h).toContain('<thead>')
    expect(h).toContain('table-header-group')
    expect(h).toContain('<h1>Lista de cenas</h1>')
    expect(h).toContain('Chuva')
    expect(h).toContain('<th scope="col" class="n">Cena</th>')
  })

  it('escapes everything that comes from the script', () => {
    const h = buildReportHtml({ ...base, scriptTitle: '<script>x</script>', rows: [['<img src=x onerror=alert(1)>', 'a & b', '1']] })
    expect(h).not.toContain('<script>')
    expect(h).not.toContain('<img')
    expect(h).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(h).toContain('a &amp; b')
  })

  it('right-aligns numeric columns and leaves text columns alone', () => {
    const h = buildReportHtml(base)
    expect(h).toContain('<td class="n">1</td>')
    expect(h).toContain('<td>COZINHA</td>')
  })

  it('says so when there is nothing to print', () => {
    expect(buildReportHtml({ ...base, rows: [] })).toContain('Sem dados neste relatório.')
  })

  it('caps rows, columns and cell length', () => {
    const c = cleanReport({
      ...base,
      columns: Array.from({ length: 50 }, (_, i) => `c${i}`),
      rows: Array.from({ length: MAX_ROWS + 10 }, () => ['x'.repeat(MAX_CELL + 50)])
    })
    expect(c.columns).toHaveLength(30)
    expect(c.rows).toHaveLength(MAX_ROWS)
    expect(String(c.rows[0][0]).length).toBe(MAX_CELL)
  })

  it('a row shorter than the header is padded, not printed misaligned', () => {
    const c = cleanReport({ ...base, rows: [['só uma']] })
    expect(c.rows[0]).toHaveLength(3)
  })
})
