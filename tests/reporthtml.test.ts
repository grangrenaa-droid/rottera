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

describe('empty columns', () => {
  it('a column with nothing in it (only — or blank) is not printed; the others are', () => {
    const h = buildReportHtml({ ...base, columns: ['Cena', 'Sinopse', 'Local'], rows: [[1, '—', 'COZINHA'], [2, '', 'RUA']] })
    expect(h).not.toContain('Sinopse')
    expect(h).toContain('COZINHA')
    expect(h).not.toContain('<td>—</td>')
  })

  it('a table where every column is empty still prints its first column', () => {
    const h = buildReportHtml({ ...base, columns: ['A', 'B'], rows: [['—', '—']] })
    expect(h).toContain('>A</th>')
  })
})

describe('call sheet (ordem do dia)', () => {
  const sheet = {
    day: 'Sábado · cabine',
    dayOf: 'Dia 1 de 2',
    start: '08:30',
    locations: ['CINE ESTRELA - CABINE DE PROJEÇÃO'],
    summary: '2 cenas · 2/8 pág.',
    notes: 'Haze liberado só depois das 10h.',
    scenes: [
      {
        time: '08:30', number: '1', part: true, intExt: 'INT.', location: 'CINE ESTRELA - CABINE DE PROJEÇÃO', dn: 'N', pages: '1/8',
        synopsis: 'João aceita passar um último filme.',
        shots: [{ time: '09:00', code: '1.2', text: 'Close — O café caindo' }, { time: '', code: '1.1', text: 'Plano médio · 35 mm — Marina de costas' }],
        cast: 'JOÃO, LUÍSA', elements: 'Objetos de cena: Rolo de 35 mm'
      },
      { time: '', number: '2', part: false, intExt: 'EXT.', location: 'RUA', dn: 'D', pages: '1/8', synopsis: '', shots: [], cast: '', elements: '' }
    ]
  }
  const html = buildReportHtml({ ...base, title: 'Ordem do dia · Sábado · cabine', callsheet: sheet })

  it('heads the page with the film, the day, its place in the plan, the start, the locations, the totals and the notes', () => {
    expect(html).toContain('Chuva')
    expect(html).toContain('Sábado · cabine')
    expect(html).toContain('Dia 1 de 2')
    expect(html).toContain('08:30')
    expect(html).toContain('CINE ESTRELA - CABINE DE PROJEÇÃO')
    expect(html).toContain('2 cenas · 2/8 pág.')
    expect(html).toContain('Haze liberado só depois das 10h.')
    // no table of the old layout
    expect(html).not.toContain('<table>')
  })

  it('gives each scene a block: its line, then synopsis, one shot per line, cast and elements', () => {
    const blocks = html.split('class="cs-scene').slice(1)
    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toContain('Cena 1 (parte)')
    expect(blocks[0]).toContain('João aceita passar um último filme.')
    expect((blocks[0].match(/class="cs-shot"/g) || []).length).toBe(2)
    expect(blocks[0].indexOf('1.2')).toBeLessThan(blocks[0].indexOf('1.1'))
    expect(blocks[0]).toContain('JOÃO, LUÍSA')
    expect(blocks[0]).toContain('Rolo de 35 mm')
  })

  it('leaves out what a scene does not have', () => {
    const second = html.split('class="cs-scene').slice(1)[1]
    expect(second).not.toContain('cs-syn')
    expect(second).not.toContain('cs-shots')
    expect(second).not.toContain('Elenco')
    expect(second).not.toContain('Elementos')
  })

  it('keeps what the printer gets as plain, bounded text', () => {
    const c = cleanReport({ ...base, callsheet: { ...sheet, day: 'x'.repeat(5000), scenes: 'nada' as never } })
    expect(c.callsheet!.day.length).toBeLessThanOrEqual(200)
    expect(c.callsheet!.scenes).toEqual([])
    const evil = buildReportHtml({ ...base, callsheet: { ...sheet, notes: '<img src=x onerror=alert(1)>' } })
    expect(evil).not.toContain('<img')
  })
})

describe('cells with more than one line', () => {
  it('keeps the line breaks of a cell (one shot per line)', () => {
    const h = buildReportHtml({ ...base, columns: ['Cena', 'Planos'], rows: [[1, '1.1 Plano médio\n1.2 Close']] })
    expect(h).toContain('1.1 Plano médio\n1.2 Close')
    expect(h).toMatch(/td \{[^}]*white-space: pre-line/)
  })
})

describe('several tables on one page', () => {
  it('prints each table after the other, each with its heading, and leaves out its empty columns', () => {
    const h = buildReportHtml({
      ...base,
      title: 'Ambientes e músicas',
      columns: [],
      rows: [],
      tables: [
        { title: 'Ambientes e sons-guia', columns: ['Locação', 'O que gravar', 'Observações'], rows: [['COZINHA', 'Geladeira', '—']] },
        { title: 'Músicas', columns: ['Título', 'Autor'], rows: [['Valsa', 'Ana']] }
      ]
    })
    expect(h.match(/<h2>/g)).toHaveLength(2)
    expect(h.match(/<table>/g)).toHaveLength(2)
    expect(h).toContain('<h2>Músicas</h2>')
    expect(h).not.toContain('Observações')
    expect(h).not.toContain('Sem dados neste relatório')
  })
})
