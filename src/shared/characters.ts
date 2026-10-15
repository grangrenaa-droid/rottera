import type { CharacterSheet, Script } from './types'
import { paginate } from './paginate'
import { sceneRanges } from './scenes'
import { isSafeImage } from './storyboard'
import { newId } from './structures'

/** Fields the writer fills in, in the order they appear in the sheet and in the presentation. */
export interface FieldDef {
  key: 'alias' | 'age' | 'role' | 'appearance' | 'personality' | 'goal' | 'conflict' | 'arc' | 'relationships' | 'notes'
  label: string
  hint: string
  multiline: boolean
}

export const FIELDS: FieldDef[] = [
  { key: 'alias', label: 'Apelido ou nome completo', hint: 'Como os outros o chamam, ou o nome por extenso', multiline: false },
  { key: 'age', label: 'Idade', hint: 'Ex.: 34, ou "por volta de 60"', multiline: false },
  { key: 'role', label: 'Papel na história', hint: 'Protagonista, antagonista, mentor…', multiline: false },
  { key: 'appearance', label: 'Aparência', hint: 'O que a câmera vê: físico, roupa, gestos', multiline: true },
  { key: 'personality', label: 'Personalidade', hint: 'Como pensa, fala e reage', multiline: true },
  { key: 'goal', label: 'Objetivo', hint: 'O que quer nesta história', multiline: true },
  { key: 'conflict', label: 'Conflito', hint: 'O que o impede, por dentro e por fora', multiline: true },
  { key: 'arc', label: 'Arco', hint: 'De onde parte e onde chega', multiline: true },
  { key: 'relationships', label: 'Relações', hint: 'Com quem se liga e como', multiline: true },
  { key: 'notes', label: 'Notas', hint: 'Qualquer outra coisa', multiline: true }
]

const MAX_FIELD = 4000

/** "MARINA (V.O.)" and "marina" are the same character. */
export function characterKey(name: string): string {
  return name
    .replace(/\s*\(.*\)\s*$/, '')
    .trim()
    .toUpperCase()
}

export function newSheet(name: string): CharacterSheet {
  return {
    id: newId('char'),
    name: name.trim(),
    alias: '',
    age: '',
    role: '',
    appearance: '',
    personality: '',
    goal: '',
    conflict: '',
    arc: '',
    relationships: '',
    notes: '',
    image: '',
    includeInPdf: true
  }
}

export function sheetIsEmpty(s: CharacterSheet | null | undefined): boolean {
  if (!s) return true
  return FIELDS.every((f) => s[f.key].trim() === '') && s.image === ''
}

export function cleanSheet(raw: Partial<CharacterSheet>): CharacterSheet | null {
  if (!raw || typeof raw !== 'object') return null
  const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, 80) : ''
  if (!name) return null
  const image = typeof raw.image === 'string' && isSafeImage(raw.image) ? raw.image : ''
  const text = (v: unknown, n = MAX_FIELD): string => (typeof v === 'string' ? v.slice(0, n) : '')
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 80) : newId('char'),
    name,
    alias: text(raw.alias, 120),
    age: text(raw.age, 60),
    role: text(raw.role, 120),
    appearance: text(raw.appearance),
    personality: text(raw.personality),
    goal: text(raw.goal),
    conflict: text(raw.conflict),
    arc: text(raw.arc),
    relationships: text(raw.relationships),
    notes: text(raw.notes),
    image,
    includeInPdf: raw.includeInPdf !== false
  }
}

// ---------------------------------------------------------------- numbers taken from the script
export interface CharacterStats {
  lines: number
  words: number
  scenes: number
  firstPage: number | null
  /** Share of all dialogue words in the script, 0 to 100. */
  share: number
  costars: { name: string; scenes: number }[]
}

const words = (t: string): number => (t.trim() ? t.trim().split(/\s+/).length : 0)

export function characterStats(script: Script): Map<string, CharacterStats> {
  const blocks = script.blocks
  const pag = paginate(blocks, script.paper)
  const ranges = sceneRanges(blocks)
  const names = new Map<string, string>() // key -> name as first written
  const acc = new Map<string, { lines: number; words: number; scenes: Set<number>; first: number | null }>()
  let totalWords = 0

  const sceneIndexOf = (i: number): number => ranges.findIndex((r) => i >= r.start && i < r.end)

  blocks.forEach((b, i) => {
    if (b.kind !== 'character' || !b.text.trim()) return
    const key = characterKey(b.text)
    if (!key) return
    if (!names.has(key)) names.set(key, b.text.replace(/\s*\(.*\)\s*$/, '').trim())
    const a = acc.get(key) ?? { lines: 0, words: 0, scenes: new Set<number>(), first: null }
    a.lines += 1
    for (let j = i + 1; j < blocks.length && (blocks[j].kind === 'dialogue' || blocks[j].kind === 'parenthetical'); j++) {
      if (blocks[j].kind === 'dialogue') {
        const w = words(blocks[j].text)
        a.words += w
        totalWords += w
      }
    }
    const s = sceneIndexOf(i)
    a.scenes.add(s)
    if (a.first === null) a.first = (pag.blockPage[i] ?? 0) + 1
    acc.set(key, a)
  })

  const out = new Map<string, CharacterStats>()
  for (const [key, a] of acc) {
    const co = new Map<string, number>()
    for (const [other, o] of acc) {
      if (other === key) continue
      let shared = 0
      for (const s of a.scenes) if (o.scenes.has(s)) shared += 1
      if (shared > 0) co.set(other, shared)
    }
    out.set(key, {
      lines: a.lines,
      words: a.words,
      scenes: a.scenes.size,
      firstPage: a.first,
      share: totalWords ? Math.round((a.words / totalWords) * 100) : 0,
      costars: [...co.entries()]
        .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
        .slice(0, 6)
        .map(([k, n]) => ({ name: names.get(k) ?? k, scenes: n }))
    })
  }
  return out
}

export interface CharacterEntry {
  key: string
  name: string
  sheet: CharacterSheet | null
  stats: CharacterStats | null
  inScript: boolean
}

/** Everyone who speaks in the script, plus sheets for people who do not (yet). */
export function listCharacters(script: Script): CharacterEntry[] {
  const stats = characterStats(script)
  const byKey = new Map<string, CharacterSheet>()
  for (const s of script.characters ?? []) byKey.set(characterKey(s.name), s)
  const entries = new Map<string, CharacterEntry>()
  for (const [key, st] of stats) {
    const sheet = byKey.get(key) ?? null
    const spoken = script.blocks.find((b) => b.kind === 'character' && characterKey(b.text) === key)
    entries.set(key, {
      key,
      name: sheet?.name || (spoken ? spoken.text.replace(/\s*\(.*\)\s*$/, '').trim() : key),
      sheet,
      stats: st,
      inScript: true
    })
  }
  for (const [key, sheet] of byKey) {
    if (!entries.has(key)) entries.set(key, { key, name: sheet.name, sheet, stats: null, inScript: false })
  }
  return [...entries.values()].sort((a, b) => (b.stats?.words ?? -1) - (a.stats?.words ?? -1) || a.name.localeCompare(b.name))
}

// ---------------------------------------------------------------- the presentation
export interface Presentation {
  /** Name in capitals. */
  title: string
  /** Alias, age and role on one line. */
  subtitle: string
  /** Sections the writer filled in, in order; empty ones are left out. */
  sections: { heading: string; text: string }[]
  /** What the script itself says about the character, always up to date. */
  inScript: string[]
  image: string
  /** True when there is nothing written yet. */
  empty: boolean
}

export function presentationOf(sheet: CharacterSheet | null, name: string, stats: CharacterStats | null): Presentation {
  const s = sheet
  const ageText = s && s.age.trim() ? (/^\d+$/.test(s.age.trim()) ? `${s.age.trim()} anos` : s.age.trim()) : ''
  const subtitle = [s?.alias.trim(), ageText, s?.role.trim()].filter(Boolean).join(' · ')
  const sections = FIELDS.filter((f) => !['alias', 'age', 'role'].includes(f.key))
    .map((f) => ({ heading: f.label, text: (s?.[f.key] ?? '').trim() }))
    .filter((x) => x.text !== '')

  const inScript: string[] = []
  if (stats) {
    inScript.push(`${stats.lines} ${stats.lines === 1 ? 'fala' : 'falas'}, ${stats.words} palavras de diálogo (${stats.share}% do diálogo do roteiro)`)
    inScript.push(`Aparece em ${stats.scenes} ${stats.scenes === 1 ? 'cena' : 'cenas'}`)
    if (stats.firstPage !== null) inScript.push(`Primeira aparição: página ${stats.firstPage}`)
    if (stats.costars.length) {
      inScript.push(`Contracena com: ${stats.costars.map((c) => `${c.name} (${c.scenes} ${c.scenes === 1 ? 'cena' : 'cenas'})`).join(', ')}`)
    }
  } else {
    inScript.push('Ainda não fala no roteiro')
  }
  return {
    title: (s?.name || name).toUpperCase(),
    subtitle,
    sections,
    inScript,
    image: s?.image ?? '',
    empty: sheetIsEmpty(s)
  }
}
