import type { Block, Script } from './types'
import { LABELS, KINDS } from './elements'
import { paginate } from './paginate'
import { parseHeading } from './smarttype'
import { sceneNumbers } from './scenes'
import { revisionLabel } from './revisions'

export interface Report {
  id: string
  title: string
  columns: string[]
  rows: (string | number)[][]
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

function intExt(intro: string): string {
  const v = intro.toUpperCase()
  if (v.includes('/')) return 'INT./EXT.'
  if (v.startsWith('INT') || v === 'I') return 'INT.'
  if (v.startsWith('EXT')) return 'EXT.'
  return v || '—'
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

  return [r1, r2, r3, r4, r5, r6, r7, r8]
}

export function reportToCsv(r: Report): string {
  const cell = (v: string | number): string => {
    const s = String(v)
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [r.columns, ...r.rows].map((row) => row.map(cell).join(';')).join('\r\n') + '\r\n'
}

export type { Block }
