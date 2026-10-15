import type { Block, Kind, Script } from './types'
import { looksLikeSceneHeading } from './elements'

const TITLE_KEYS: Record<string, 'title' | 'author' | 'contact'> = {
  title: 'title',
  author: 'author',
  authors: 'author',
  contact: 'contact'
}

function isTransition(line: string): boolean {
  return line === line.toUpperCase() && /(TO|PARA):$/.test(line.trim()) && /[A-Z]/.test(line)
}

export function parseFountain(source: string): Script {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const script: Script = { titlePage: { title: '', author: '', contact: '' }, blocks: [] }
  let i = 0

  // Title page: leading "Key: value" lines, ended by a blank line.
  if (lines[0] && /^[A-Za-z ]+:/.test(lines[0])) {
    let lastKey: 'title' | 'author' | 'contact' | null = null
    while (i < lines.length && lines[i].trim() !== '') {
      const m = /^([A-Za-z ]+):\s*(.*)$/.exec(lines[i])
      if (m) {
        lastKey = TITLE_KEYS[m[1].trim().toLowerCase()] ?? null
        if (lastKey) script.titlePage[lastKey] = m[2].trim()
      } else if (lastKey) {
        script.titlePage[lastKey] = (script.titlePage[lastKey] + ' ' + lines[i].trim()).trim()
      }
      i++
    }
  }

  const blocks: Block[] = []
  let inBoneyard = false
  let prevBlank = true
  let inDialogue = false
  let dual = false

  for (; i < lines.length; i++) {
    let line = lines[i]
    if (inBoneyard) {
      if (line.includes('*/')) inBoneyard = false
      continue
    }
    if (/(?<!\\)\/\*/.test(line)) {
      if (!line.includes('*/')) inBoneyard = true
      line = line.replace(/(?<!\\)\/\*.*?\*\//g, '')
    }
    line = line.replace(/(?<!\\)\[\[.*?\]\]/g, '')
    // a backslash in front of a note or boneyard opener keeps it as plain text
    line = line.replace(/\\\[\[/g, '[[').replace(/\\\/\*/g, '/*')

    if (line.trim() === '') {
      prevBlank = true
      inDialogue = false
      dual = false
      continue
    }
    const t = line.trim()
    if (inDialogue) {
      // inside a speech everything is dialogue or a parenthetical, whatever character it starts with
      const kindD: Kind = /^\(.*\)$/.test(t) ? 'parenthetical' : 'dialogue'
      blocks.push(dual ? { kind: kindD, text: t, dual: true } : { kind: kindD, text: t })
      prevBlank = false
      continue
    }
    if (t.startsWith('#') || t.startsWith('=')) continue // sections and synopses
    if (/^={3,}$/.test(t)) continue // page break

    let kind: Kind
    let text = t
    if (t.startsWith('!')) {
      kind = 'action'
      text = line.replace(/^\s*!/, '').trimEnd()
    } else if (t.startsWith('.') && !t.startsWith('..')) {
      kind = 'scene_heading'
      text = t.slice(1).trim()
    } else if (looksLikeSceneHeading(t) && prevBlank) {
      kind = 'scene_heading'
    } else if (t.startsWith('>') && !t.endsWith('<')) {
      kind = 'transition'
      text = t.slice(1).trim()
    } else if (prevBlank && isTransition(t)) {
      kind = 'transition'
    } else if (inDialogue) {
      kind = /^\(.*\)$/.test(t) ? 'parenthetical' : 'dialogue'
    } else if (t.startsWith('@')) {
      kind = 'character'
      text = t.slice(1).trim()
      inDialogue = true
      if (/\^$/.test(text)) {
        dual = true
        text = text.replace(/\s*\^$/, '')
      }
    } else if (
      prevBlank &&
      t === t.toUpperCase() &&
      /[A-ZÀ-Ý]/.test(t) &&
      lines[i + 1] !== undefined &&
      lines[i + 1].trim() !== ''
    ) {
      kind = 'character'
      dual = /\^$/.test(t)
      text = t.replace(/\s*\^$/, '')
      inDialogue = true
    } else {
      kind = 'action'
      text = line.replace(/^!/, '').trimEnd()
    }
    const isDual = dual && (kind === 'character' || kind === 'dialogue' || kind === 'parenthetical')
    blocks.push(isDual ? { kind, text, dual: true } : { kind, text })
    prevBlank = false
  }
  script.blocks = blocks.length ? blocks : [{ kind: 'scene_heading', text: '' }]
  return script
}

/** True when this text, written as a plain line, would be read back as something other than an action. */
function needsForce(text: string, first: boolean): boolean {
  if (/^[.@#>=~!]/.test(text)) return true
  if (looksLikeSceneHeading(text)) return true
  if (isTransition(text.toUpperCase()) && text === text.toUpperCase()) return true
  if (first && /^[A-Za-z ]+:/.test(text)) return true // would be read as a title page entry
  if (/^\(.*\)$/.test(text)) return true
  return false
}

export function toFountain(script: Script): string {
  const out: string[] = []
  const tp = script.titlePage
  const oneLine = (v: string): string => v.replace(/\s*\n+\s*/g, ' ').trim()
  if (tp.title) out.push(`Title: ${oneLine(tp.title)}`)
  if (tp.author) out.push(`Author: ${oneLine(tp.author)}`)
  if (tp.contact) out.push(`Contact: ${oneLine(tp.contact)}`)
  if (out.length) out.push('')

  let prev: Kind | null = null
  for (const b of script.blocks) {
    const text = b.text.trim()
    if (!text && b.kind !== 'action') continue
    // notes and boneyard openers in the writer's text must not be read back as comments
    const safe = text.replace(/\[\[/g, '\\[[').replace(/\/\*/g, '\\/*')
    const inGroup =
      (b.kind === 'dialogue' || b.kind === 'parenthetical') &&
      (prev === 'character' || prev === 'dialogue' || prev === 'parenthetical')
    if (!inGroup && out.length && out[out.length - 1] !== '') out.push('')
    switch (b.kind) {
      case 'scene_heading':
        out.push(looksLikeSceneHeading(text) ? safe.toUpperCase() : `.${safe.toUpperCase()}`)
        break
      case 'character': {
        const u = safe.toUpperCase()
        const cue = u === safe && /[A-ZÀ-Ý]/.test(u) && !/[a-zà-ÿ]/.test(safe) ? u : `@${safe}`
        out.push(b.dual ? `${cue} ^` : cue)
        break
      }
      case 'parenthetical':
        out.push(safe.startsWith('(') ? safe : `(${safe})`)
        break
      case 'transition': {
        const u = safe.toUpperCase()
        out.push(isTransition(u) ? u : `> ${u}`)
        break
      }
      case 'shot':
        out.push(safe.toUpperCase())
        break
      case 'dialogue':
        out.push(safe)
        break
      default:
        out.push(needsForce(text, out.length === 0) ? `!${safe}` : safe)
    }
    prev = b.kind
  }
  return out.join('\n') + '\n'
}
