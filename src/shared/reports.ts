import type { Block, Script } from './types'
import type { ReportSection } from './reportHtml'
import { LABELS, KINDS } from './elements'
import { paginate } from './paginate'
import { parseHeading } from './smarttype'
import { sceneNumbers } from './scenes'
import { revisionLabel } from './revisions'
import { electricLoad, gearList } from './lightmap'
import { breakdownReport, elementsReport, emptyProduction, intExt, sceneInfo, scheduleReport } from './production'

export interface Report {
  id: string
  title: string
  columns: string[]
  /** The flat table: what the screen and the CSV show. */
  rows: (string | number)[][]
  /** How the PDF prints it when that differs: in groups with headings (a shooting plan, day by day). */
  printed?: { columns: string[]; sections: ReportSection[] }
}

/** What goes to the PDF: the groups when the report has them, the flat table otherwise. */
export function printable(r: Pick<Report, 'title' | 'columns' | 'rows' | 'printed'>): {
  title: string
  columns: string[]
  rows: (string | number)[][]
  sections?: ReportSection[]
} {
  return r.printed ? { title: r.title, columns: r.printed.columns, rows: [], sections: r.printed.sections } : { title: r.title, columns: r.columns, rows: r.rows }
}

const words = (t: string): number => (t.trim() ? t.trim().split(/\s+/).length : 0)

function pagesLabel(set: Set<number>): string {
  const list = [...set].sort((a, b) => a - b)
  const out: string[] = []
  for (let i = 0; i < list.length; ) {
    let j = i
    while (j + 1 < list.length && list[j + 1] === list[j] + 1) j++
    out.push(i === j ? String(list[i]) : `${list[i]}-${list[j]}`)
    i = j + 1
  }
  return out.join(', ')
}

export function buildReports(script: Script): Report[] {
  const blocks = script.blocks
  const pag = paginate(blocks, script.paper)
  const page = (i: number): number => (pag.blockPage[i] ?? 0) + 1
  const numbers = sceneNumbers(blocks, script.scenesLocked === true)

  // Scenes: heading index -> info, with the blocks that belong to it.
  interface Scene {
    index: number
    end: number
    number: string
    intro: string
    location: string
    time: string
    heading: string
  }
  const scenes: Scene[] = []
  blocks.forEach((b, i) => {
    if (b.kind !== 'scene_heading') return
    const h = parseHeading(b.text)
    scenes.push({
      index: i,
      end: blocks.length,
      number: numbers[i] ?? '',
      intro: h.intro,
      location: h.location.toUpperCase(),
      time: h.time.toUpperCase(),
      heading: b.text.trim().toUpperCase()
    })
  })
  scenes.forEach((s, n) => {
    if (scenes[n + 1]) s.end = scenes[n + 1].index
  })
  const sceneOf = (blockIndex: number): Scene | undefined => scenes.find((s) => blockIndex >= s.index && blockIndex < s.end)
  const lastPage = pag.pages.length

  const r1: Report = {
    id: 'cenas',
    title: 'Lista de cenas',
    columns: ['Nº', 'Cabeçalho', 'INT/EXT', 'Local', 'Hora', 'Página', 'Palavras'],
    rows: scenes.map((s) => [
      s.number,
      s.heading,
      intExt(s.intro),
      s.location || '—',
      s.time || '—',
      page(s.index),
      blocks.slice(s.index + 1, s.end).reduce((n, b) => n + words(b.text), 0)
    ])
  }

  // Step outline: the scenes and what happens in each
  const r1b: Report = {
    id: 'escaleta',
    title: 'Escaleta',
    columns: ['Nº', 'Cabeçalho', 'Página', 'Sinopse'],
    rows: scenes.map((s) => [s.number, s.heading, page(s.index), blocks[s.index].syn?.trim() || '—'])
  }

  // Characters
  interface Ch {
    lines: number
    words: number
    scenes: Set<string>
    first: number
  }
  const chars = new Map<string, Ch>()
  blocks.forEach((b, i) => {
    if (b.kind !== 'character' || !b.text.trim()) return
    const name = b.text.trim().toUpperCase().replace(/\s*\(.*\)\s*$/, '')
    const c = chars.get(name) ?? { lines: 0, words: 0, scenes: new Set<string>(), first: page(i) }
    c.lines += 1
    for (let j = i + 1; j < blocks.length && (blocks[j].kind === 'dialogue' || blocks[j].kind === 'parenthetical'); j++) {
      if (blocks[j].kind === 'dialogue') c.words += words(blocks[j].text)
    }
    const sc = sceneOf(i)
    if (sc) c.scenes.add(sc.number)
    chars.set(name, c)
  })
  const r2: Report = {
    id: 'personagens',
    title: 'Personagens',
    columns: ['Personagem', 'Falas', 'Palavras', 'Cenas', 'Primeira página'],
    rows: [...chars.entries()]
      .sort((a, b) => b[1].words - a[1].words || a[0].localeCompare(b[0]))
      .map(([n, c]) => [n, c.lines, c.words, c.scenes.size, c.first])
  }

  // Locations
  const locs = new Map<string, { scenes: number; pages: Set<number>; times: Set<string> }>()
  for (const s of scenes) {
    const key = s.location || '(sem local)'
    const l = locs.get(key) ?? { scenes: 0, pages: new Set<number>(), times: new Set<string>() }
    l.scenes += 1
    l.pages.add(page(s.index))
    if (s.time) l.times.add(s.time)
    locs.set(key, l)
  }
  const r3: Report = {
    id: 'locais',
    title: 'Locais',
    columns: ['Local', 'Cenas', 'Páginas', 'Horários'],
    rows: [...locs.entries()]
      .sort((a, b) => b[1].scenes - a[1].scenes || a[0].localeCompare(b[0]))
      .map(([n, l]) => [n, l.scenes, pagesLabel(l.pages), [...l.times].sort().join(', ') || '—'])
  }

  // Times of day
  const times = new Map<string, { scenes: number; int: number; ext: number }>()
  for (const s of scenes) {
    const key = s.time || '(sem hora)'
    const t = times.get(key) ?? { scenes: 0, int: 0, ext: 0 }
    t.scenes += 1
    const ie = intExt(s.intro)
    if (ie === 'EXT.') t.ext += 1
    else t.int += 1
    times.set(key, t)
  }
  const r4: Report = {
    id: 'horarios',
    title: 'Horários e interior/exterior',
    columns: ['Hora', 'Cenas', 'Interior', 'Exterior'],
    rows: [...times.entries()].sort((a, b) => b[1].scenes - a[1].scenes).map(([n, t]) => [n, t.scenes, t.int, t.ext])
  }

  // Elements
  const totalWords = blocks.reduce((n, b) => n + words(b.text), 0)
  const r5: Report = {
    id: 'elementos',
    title: 'Elementos do roteiro',
    columns: ['Elemento', 'Blocos', 'Palavras', '% das palavras'],
    rows: KINDS.map((k) => {
      const bs = blocks.filter((b) => b.kind === k)
      const w = bs.reduce((n, b) => n + words(b.text), 0)
      return [LABELS[k], bs.length, w, totalWords ? `${Math.round((w / totalWords) * 100)}%` : '0%']
    })
  }

  // Revisions
  const revs = new Map<string, { blocks: number; scenes: Set<string>; pages: Set<number> }>()
  blocks.forEach((b, i) => {
    if (!b.rev) return
    const r = revs.get(b.rev) ?? { blocks: 0, scenes: new Set<string>(), pages: new Set<number>() }
    r.blocks += 1
    const sc = sceneOf(i)
    if (sc) r.scenes.add(sc.number)
    r.pages.add(page(i))
    revs.set(b.rev, r)
  })
  const r6: Report = {
    id: 'revisoes',
    title: 'Revisões',
    columns: ['Revisão', 'Blocos alterados', 'Cenas', 'Páginas'],
    rows: [...revs.entries()].map(([id, r]) => [
      revisionLabel(id),
      r.blocks,
      [...r.scenes].join(', ') || '—',
      pagesLabel(r.pages)
    ])
  }

  // Per page
  const r7: Report = {
    id: 'paginas',
    title: 'Resumo por página',
    columns: ['Página', 'Linhas usadas', 'Cenas que começam', 'Personagens que falam'],
    rows: pag.pages.map((lines, p) => {
      const starting = scenes.filter((s) => page(s.index) === p + 1).map((s) => s.number)
      const speaking = new Set<string>()
      for (const l of lines) {
        if (l.kind === 'character' && l.block >= 0) {
          speaking.add(blocks[l.block].text.trim().toUpperCase().replace(/\s*\(.*\)\s*$/, ''))
        }
      }
      return [p + 1, lines.filter((l) => l.text !== '').length, starting.join(', ') || '—', [...speaking].join(', ') || '—']
    })
  }

  // Statistics
  const dialogueWords = blocks.filter((b) => b.kind === 'dialogue').reduce((n, b) => n + words(b.text), 0)
  const r8: Report = {
    id: 'estatisticas',
    title: 'Estatísticas',
    columns: ['Métrica', 'Valor'],
    rows: [
      ['Páginas', lastPage],
      ['Duração estimada (1 min por página)', `${lastPage} min`],
      ['Cenas', scenes.length],
      ['Personagens com fala', chars.size],
      ['Falas', [...chars.values()].reduce((n, c) => n + c.lines, 0)],
      ['Palavras', totalWords],
      ['Palavras de diálogo', dialogueWords],
      ['Diálogo / total', totalWords ? `${Math.round((dialogueWords / totalWords) * 100)}%` : '0%']
    ]
  }

  // production: the breakdown and the shooting plan (Filmagem tab)
  const prod = script.production ?? emptyProduction()
  const info = sceneInfo(script, pag)
  // camera: the shot list, from the storyboard frames
  const frames = script.storyboard?.frames ?? []
  const shots: Report = {
    id: 'planos',
    title: 'Lista de planos',
    columns: ['Cena', 'Quadro', 'Plano', 'Ângulo', 'Movimento', 'Lente', 'Descrição'],
    rows: frames.map((fr, i) => [fr.scene || '—', i + 1, fr.shot || '—', fr.angle || '—', fr.move || '—', fr.lens ? `${fr.lens} mm` : '—', fr.caption.trim() || '—'])
  }

  // light: what to rent and the electrical load, from every light map
  const gear = gearList(script.lightMaps ?? [])
  const totalW = gear.reduce((n, g) => n + g.watts * g.count, 0)
  const load = electricLoad(totalW)
  const fmt = (n: number): string => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
  const equipment: Report = {
    id: 'equipamento',
    title: 'Equipamento de luz',
    columns: ['Aparelho', 'Potência (W)', 'Quantidade', 'Total (W)', 'Mapas'],
    rows: gear.length
      ? [
          ...gear.map((g) => [g.name, g.watts, g.count, g.watts * g.count, g.maps.join(', ')]),
          ['Total', '', gear.reduce((n, g) => n + g.count, 0), totalW, ''],
          ['Corrente em 127 V', '', '', `${fmt(load.a127)} A`, ''],
          ['Corrente em 220 V', '', '', `${fmt(load.a220)} A`, '']
        ]
      : []
  }

  return [r1, r2, r3, r4, r5, r6, r7, r8, r1b, shots, equipment, breakdownReport(info, prod), elementsReport(info, prod), scheduleReport(info, prod)]
}

export function reportToCsv(r: Report): string {
  const cell = (v: string | number): string => {
    const s = String(v)
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [r.columns, ...r.rows].map((row) => row.map(cell).join(';')).join('\r\n') + '\r\n'
}

export type { Block }
