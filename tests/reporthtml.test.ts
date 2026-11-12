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

  it('prints groups under headings of their own, with their count and note, and keeps each group on a page', () => {
    const h = buildReportHtml({
      ...base,
      rows: [],
      sections: [
        { title: 'Dia 1', summary: '2 cenas · 4/8 pág.', note: 'Chamada <7h>', rows: [[1, 'COZINHA', '1'], [4, 'COZINHA', '2']] },
        { title: 'Dia 2', rows: [] }
      ]
    })
    expect(h.match(/<tbody class="group">/g)).toHaveLength(2)
    expect(h).toContain('<span>Dia 1</span><span class="gs">2 cenas · 4/8 pág.</span>')
    expect(h).toContain('<tr class="gn"><td colspan="3">Chamada &lt;7h&gt;</td></tr>')
    expect(h).toContain('Nenhuma cena.')
    expect(h).toContain('tbody.group { break-inside: avoid }')
    expect(h).not.toContain('Sem dados neste relatório.')
  })

  it('never cuts a column name or a word in the middle', () => {
    const h = buildReportHtml(base)
    expect(h).toContain('white-space: nowrap }')
    expect(h).not.toContain('overflow-wrap: anywhere')
  })

  it('cleans the groups too', () => {
    const c = cleanReport({ ...base, sections: [{ title: 'x'.repeat(500), rows: [['a']], note: '  ' }] })
    expect(c.sections![0].title).toHaveLength(200)
    expect(c.sections![0].rows[0]).toHaveLength(3)
    expect(c.sections![0].note).toBeUndefined()
  })

  it('numbers with a unit line up as numbers; a Total line stands out; a narrow table is not stretched', () => {
    const h = buildReportHtml({
      ...base,
      columns: ['Aparelho', 'Total'],
      rows: [['Fresnel', '2.000 W'], ['LED', '200 W'], ['Total', '2.200 W'], ['Corrente em 127 V', '17,3 A']]
    })
    expect(h).toContain('<td class="n">2.000 W</td>')
    expect(h).toContain('<td class="n">17,3 A</td>')
    expect(h).toContain('<tr class="total"><td>Total</td>')
    expect(h.match(/class="total"/g)).toHaveLength(1)
    expect(h).toContain('table { width: auto;')
  })
})
