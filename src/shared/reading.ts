import type { Block, TableRead, VoiceRole } from './types'

/** Who says a line: null is the narrator (headings, action, transitions); otherwise the character's name. */
export interface ReadItem {
  block: number
  who: string | null
  text: string
}

export const PITCHES: { value: number; label: string }[] = [
  { value: 0.8, label: 'Grave' },
  { value: 1, label: 'Normal' },
  { value: 1.2, label: 'Agudo' }
]
export const RATES = [0.8, 1, 1.2, 1.4]

const speaker = (cue: string): string => cue.trim().toUpperCase().replace(/\s*\(.*\)\s*$/, '')

/** A scene heading said aloud: "INT. COZINHA - DIA" -> "Interior. Cozinha, dia." */
export function spokenHeading(text: string): string {
  const t = text.trim()
  const m = /^(INT\.?\/EXT|INT\/EXT|I\/E|INT|EXT|EST)\.?\s*(.*)$/i.exec(t)
  const intro = m ? m[1].toUpperCase() : ''
  const rest = (m ? m[2] : t).toLocaleLowerCase('pt-BR').split(/\s+-\s+/).filter(Boolean).join(', ')
  const word = intro.includes('/') ? 'Interior e exterior' : intro.startsWith('INT') ? 'Interior' : intro.startsWith('EXT') || intro === 'EST' ? 'Exterior' : ''
  const body = rest ? rest.charAt(0).toLocaleUpperCase('pt-BR') + rest.slice(1) : ''
  return [word, body].filter(Boolean).join('. ') + (word || body ? '.' : '')
}

/**
 * The script as a table read, from block `from` on: the narrator reads headings, action, shots and transitions,
 * each character reads their own lines. Parentheticals are not read; character names only when `names` is on.
 */
export function buildReading(blocks: Block[], from = 0, names = false): ReadItem[] {
  // the speaker of a line that starts in the middle of a speech
  let who: string | null = null
  for (let i = Math.min(from, blocks.length) - 1; i >= 0; i--) {
    const k = blocks[i].kind
    if (k === 'character') {
      who = speaker(blocks[i].text)
      break
    }
    if (k !== 'dialogue' && k !== 'parenthetical') break
  }
  const out: ReadItem[] = []
  for (let i = Math.max(0, from); i < blocks.length; i++) {
    const b = blocks[i]
    const text = b.text.trim()
    switch (b.kind) {
      case 'character':
        who = speaker(text)
        if (names && who) out.push({ block: i, who: null, text: who.charAt(0) + who.slice(1).toLocaleLowerCase('pt-BR') + '.' })
        break
      case 'parenthetical':
        break
      case 'dialogue':
        if (text) out.push({ block: i, who, text })
        break
      case 'scene_heading':
        who = null
        if (text) out.push({ block: i, who: null, text: spokenHeading(text) })
        break
      case 'transition':
        who = null
        if (text) out.push({ block: i, who: null, text: text.toLocaleLowerCase('pt-BR') })
        break
      default:
        who = null
        if (text) out.push({ block: i, who: null, text })
    }
  }
  return out
}

/** The characters who speak, in order of first line. */
export function speakers(blocks: Block[]): string[] {
  const out: string[] = []
  for (const b of blocks) {
    if (b.kind !== 'character' || !b.text.trim()) continue
    const name = speaker(b.text)
    if (!out.includes(name)) out.push(name)
  }
  return out
}

/**
 * A voice for everyone who has none yet. With few voices installed, characters share them at different pitches
 * (voice 1 normal, voice 2 normal, voice 1 low, voice 2 low, voice 1 high...) so that each one sounds different.
 * The narrator gets the first voice. Choices already made are kept.
 */
export function castVoices(names: string[], voices: string[], current: TableRead | undefined): TableRead {
  const cast: Record<string, VoiceRole> = { ...(current?.cast ?? {}) }
  const narrator: VoiceRole = current?.narrator ?? { voice: voices[0] ?? '', pitch: 1 }
  if (voices.length === 0) return { ...current, narrator, cast }
  const order = [1, 0.8, 1.2]
  // the narrator's combination is used last, so that a character does not sound like the narrator
  const combos: VoiceRole[] = []
  for (const pitch of order) for (const voice of voices) combos.push({ voice, pitch })
  combos.sort((a, b) => Number(a.voice === narrator.voice && a.pitch === narrator.pitch) - Number(b.voice === narrator.voice && b.pitch === narrator.pitch))
  let k = 0
  for (const name of names) {
    if (cast[name] && voices.includes(cast[name].voice)) continue
    cast[name] = combos[k++ % combos.length]
  }
  return { ...current, narrator: voices.includes(narrator.voice) ? narrator : { voice: voices[0], pitch: narrator.pitch }, cast }
}

const MAX_NAME = 120

/** Reads the table-read settings from a file; anything malformed is dropped. */
export function cleanTableRead(raw: unknown): TableRead | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const role = (v: unknown): VoiceRole | undefined => {
    if (!v || typeof v !== 'object') return undefined
    const x = v as Record<string, unknown>
    if (typeof x.voice !== 'string' || x.voice.length > 200) return undefined
    const pitch = typeof x.pitch === 'number' && x.pitch >= 0.5 && x.pitch <= 1.5 ? x.pitch : 1
    return { voice: x.voice, pitch }
  }
  const out: TableRead = { cast: {} }
  const narrator = role(r.narrator)
  if (narrator) out.narrator = narrator
  if (typeof r.rate === 'number' && r.rate >= 0.5 && r.rate <= 2) out.rate = r.rate
  if (r.names === true) out.names = true
  if (r.cast && typeof r.cast === 'object') {
    for (const [name, v] of Object.entries(r.cast as Record<string, unknown>).slice(0, 500)) {
      const x = role(v)
      if (x && name.length <= MAX_NAME) out.cast[name] = x
    }
  }
  return out
}
