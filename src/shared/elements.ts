import type { Kind } from './types'

export const KINDS: Kind[] = [
  'scene_heading',
  'action',
  'character',
  'parenthetical',
  'dialogue',
  'transition',
  'shot'
]

export const LABELS: Record<Kind, string> = {
  scene_heading: 'Cabeçalho de cena',
  action: 'Ação',
  character: 'Personagem',
  parenthetical: 'Parentético',
  dialogue: 'Diálogo',
  transition: 'Transição',
  shot: 'Plano'
}

/** Kinds shown in capitals on the page. */
export const UPPER: ReadonlySet<Kind> = new Set<Kind>(['scene_heading', 'character', 'transition', 'shot'])

const SCENE_START = /^(INT\/EXT|INT|EXT|EST|I\/E)[. ]/i

export function looksLikeSceneHeading(text: string): boolean {
  return SCENE_START.test(text.trim()) && text.trim().length > 4
}

/** Kind of the block that follows when Enter is pressed. */
export const ENTER_NEXT: Record<Kind, Kind> = {
  scene_heading: 'action',
  action: 'action',
  character: 'dialogue',
  parenthetical: 'dialogue',
  dialogue: 'action',
  transition: 'scene_heading',
  shot: 'action'
}

export interface EnterResult {
  /** New kind for the block the cursor was in, when it changes. */
  current?: Kind
  /** Kind for the block created after it. */
  next: Kind
}

export function enterResult(kind: Kind, text: string): EnterResult {
  if (kind === 'action' && looksLikeSceneHeading(text)) {
    return { current: 'scene_heading', next: 'action' }
  }
  return { next: ENTER_NEXT[kind] }
}

export function cycleKind(kind: Kind, dir: 1 | -1): Kind {
  const i = KINDS.indexOf(kind)
  return KINDS[(i + dir + KINDS.length) % KINDS.length]
}

/** Text of a scene heading after Tab, or null when Tab should leave the heading. */
export function sceneHeadingTab(text: string): string | null {
  const t = text.trim()
  const intro = /^(INT\/EXT|INT|EXT|EST|I\/E)\.?$/i.exec(t)
  if (intro) {
    const v = intro[1].toUpperCase()
    return `${v === 'I/E' ? 'INT./EXT' : v}. `
  }
  if (/^(INT\/EXT|INT|EXT|EST|I\/E)\.?\s+\S/i.test(t) && !t.includes(' - ')) {
    return `${t} - `
  }
  return null
}

export type TabResult =
  | { type: 'cycle'; kind: Kind }
  | { type: 'text'; text: string }
  | { type: 'new'; kind: Kind }

export function tabResult(kind: Kind, text: string): TabResult {
  if (text.trim() === '') return { type: 'cycle', kind: cycleKind(kind, 1) }
  switch (kind) {
    case 'scene_heading': {
      const t = sceneHeadingTab(text)
      return t === null ? { type: 'new', kind: 'action' } : { type: 'text', text: t }
    }
    case 'action':
      return { type: 'new', kind: 'character' }
    case 'character':
      return { type: 'new', kind: 'parenthetical' }
    case 'parenthetical':
      return { type: 'new', kind: 'dialogue' }
    case 'dialogue':
      return { type: 'new', kind: 'character' }
    case 'transition':
      return { type: 'new', kind: 'scene_heading' }
    case 'shot':
      return { type: 'new', kind: 'action' }
  }
}
