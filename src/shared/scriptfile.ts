import type { Block, Frame, Kind, Script, ScriptFile, StoryboardAspect, StoryboardLayout } from './types'
import { KINDS } from './elements'
import { cleanFrame } from './storyboard'
import { cleanLightMap } from './lightmap'
import { cleanSheet } from './characters'
import type { CharacterSheet } from './types'
import type { LightMap } from './types'
import type { Note } from './types'
import { cleanNote } from './notes'
import { cleanProduction } from './production'
import { cleanTableRead } from './reading'

/** Longest scene synopsis: a line or two, not a treatment. */
export const SYNOPSIS_MAX = 400

/** One line of plain text, trimmed and cut to SYNOPSIS_MAX. */
export function cleanSynopsis(v: string): string {
  return v.replace(/\s*[\r\n]+\s*/g, ' ').trim().slice(0, SYNOPSIS_MAX)
}

/** Longest watermark text; longer than this would print too small to read. */
export const WATERMARK_MAX = 80

export function serialize(script: Script): string {
  const file: ScriptFile = {
    format: 'rotera',
    version: 1,
    savedAt: new Date().toISOString(),
    script
  }
  return JSON.stringify(file, null, 1)
}

export function parseScriptFile(raw: string): Script {
  const data = JSON.parse(raw) as Partial<ScriptFile>
  if ((data.format !== 'rotera' && data.format !== 'clapboard') || !data.script || !Array.isArray(data.script.blocks)) {
    throw new Error('Arquivo não é um roteiro do Rottera.')
  }
  const blocks: Block[] = data.script.blocks.map((b) => {
    const out: Block = {
      kind: (KINDS as string[]).includes(b.kind) ? (b.kind as Kind) : 'action',
      text: typeof b.text === 'string' ? b.text : ''
    }
    if (b.dual === true) out.dual = true
    if (typeof b.rev === 'string') out.rev = b.rev
    if (typeof b.sn === 'string') out.sn = b.sn
    if (out.kind === 'scene_heading' && typeof b.bid === 'string' && b.bid.length <= 64) out.bid = b.bid
    if (typeof b.nid === 'string' && b.nid && b.nid.length <= 64) out.nid = b.nid
    if (out.kind === 'scene_heading' && typeof b.syn === 'string' && b.syn.trim()) out.syn = cleanSynopsis(b.syn)
    return out
  })
  const src = data.script
  const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [])
  const tp = data.script.titlePage ?? { title: '', author: '', contact: '' }
  const script: Script = {
    blocks: blocks.length ? blocks : [{ kind: 'scene_heading', text: '' }],
    titlePage: {
      title: String(tp.title ?? ''),
      author: String(tp.author ?? ''),
      contact: String(tp.contact ?? '')
    }
  }
  if (src.board && Array.isArray(src.board.lanes) && Array.isArray(src.board.beats)) {
    script.board = {
      lanes: src.board.lanes.map((l) => ({ id: String(l.id), name: String(l.name ?? '') })),
      beats: src.board.beats.map((b) => ({
        id: String(b.id),
        lane: String(b.lane),
        title: String(b.title ?? ''),
        body: String(b.body ?? ''),
        color: String(b.color ?? '')
      }))
    }
  }
  if (src.storyboard && Array.isArray(src.storyboard.frames)) {
    const sb = src.storyboard
    const aspects = ['16:9', '2.39:1', '4:3', '1:1', '9:16']
    const layouts = [2, 4, 6, 9]
    script.storyboard = {
      frames: sb.frames.map((f) => cleanFrame(f)).filter((f): f is Frame => f !== null),
      aspect: (aspects.includes(sb.aspect) ? sb.aspect : '16:9') as StoryboardAspect,
      layout: (layouts.includes(sb.layout) ? sb.layout : 6) as StoryboardLayout,
      includeInPdf: sb.includeInPdf !== false
    }
  }
  if (Array.isArray(src.characters)) {
    script.characters = src.characters
      .slice(0, 200)
      .map((c) => cleanSheet(c))
      .filter((c): c is CharacterSheet => c !== null)
  }
  if (Array.isArray(src.lightMaps)) {
    script.lightMaps = src.lightMaps
      .slice(0, 50)
      .map((m) => cleanLightMap(m))
      .filter((m): m is LightMap => m !== null)
  }
  if (src.extras) {
    script.extras = {
      characters: strs(src.extras.characters),
      locations: strs(src.extras.locations),
      times: strs(src.extras.times)
    }
  }
  if (src.revision) script.revision = { mode: src.revision.mode === true, color: String(src.revision.color ?? 'azul') }
  if (src.paper === 'a4' || src.paper === 'letter') script.paper = src.paper
  if (src.scenesLocked === true) script.scenesLocked = true
  if (src.numberScenes === true) script.numberScenes = true
  if (src.watermark && typeof src.watermark === 'object') {
    const w = src.watermark
    script.watermark = {
      enabled: w.enabled === true,
      text: String(w.text ?? '').slice(0, WATERMARK_MAX),
      strength: w.strength === 'light' || w.strength === 'strong' ? w.strength : 'medium'
    }
  }
  if (src.production && typeof src.production === 'object') {
    const p = cleanProduction(src.production)
    if (p.items.length || p.days.length) script.production = p
  }
  const tableRead = cleanTableRead(src.tableRead)
  if (tableRead) script.tableRead = tableRead
  if (Array.isArray(src.notes)) {
    script.notes = src.notes
      .slice(0, 2000)
      .map((n) => cleanNote(n))
      .filter((n): n is Note => n !== null)
  }
  return script
}
