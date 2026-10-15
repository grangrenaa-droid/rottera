import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Version history kept next to the app data, outside the script file, so a bad edit, a bad Claude
 * replace_all or a damaged file never takes the only copy with it.
 *
 * One folder per script (by path; 'rascunho' for the untitled draft). Files are named
 * `<epoch ms>-<reason>.json` and hold the whole script file as it was saved.
 */
export type BackupReason = 'auto' | 'open' | 'shrink' | 'before-restore'

export interface BackupItem {
  id: string
  at: number
  reason: BackupReason
  bytes: number
  blocks: number
  words: number
}

/** Minimum gap between two automatic snapshots of the same script. */
export const AUTO_GAP_MS = 5 * 60 * 1000
/** How many snapshots one script keeps. The oldest go first. */
export const KEEP = 40
/** A save with fewer than this share of the previous block count is treated as a possible accident. */
export const SHRINK_RATIO = 0.6
export const SHRINK_MIN_BLOCKS = 20

const REASONS: BackupReason[] = ['auto', 'open', 'shrink', 'before-restore']

export function backupKey(path: string | null): string {
  if (!path) return 'rascunho'
  return createHash('sha1').update(path.toLowerCase()).digest('hex').slice(0, 16)
}

function dirFor(base: string, key: string): string {
  return join(base, key)
}

function parseId(id: string): { at: number; reason: BackupReason } | null {
  const m = /^(\d{10,16})-([a-z-]+)\.json$/.exec(id)
  if (!m || !REASONS.includes(m[2] as BackupReason)) return null
  return { at: Number(m[1]), reason: m[2] as BackupReason }
}

function listIds(base: string, key: string): string[] {
  const dir = dirFor(base, key)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((n) => parseId(n))
    .sort()
}

/** Counts without trusting the file: a damaged snapshot still lists, with zeros. */
export function measure(json: string): { blocks: number; words: number } {
  try {
    const d = JSON.parse(json) as { script?: { blocks?: { text?: unknown }[] } }
    const blocks = Array.isArray(d.script?.blocks) ? d.script!.blocks! : []
    let words = 0
    for (const b of blocks) {
      const t = typeof b.text === 'string' ? b.text.trim() : ''
      if (t) words += t.split(/\s+/).length
    }
    return { blocks: blocks.length, words }
  } catch {
    return { blocks: 0, words: 0 }
  }
}

/** Same script, whatever the save time written in the file says. */
function hash(s: string): string {
  let body = s
  try {
    const d = JSON.parse(s) as { script?: unknown }
    if (d && d.script !== undefined) body = JSON.stringify(d.script)
  } catch {
    /* hash the raw text */
  }
  return createHash('sha1').update(body).digest('hex')
}

export interface SnapshotOptions {
  now?: number
  /** Skip the time gap (opening a file, before a restore, a shrinking save). */
  force?: boolean
}

/**
 * Stores `json` unless the latest snapshot is identical, or too recent and not forced.
 * Returns the new snapshot id, or null when nothing was written.
 */
export function snapshot(base: string, key: string, json: string, reason: BackupReason, opts: SnapshotOptions = {}): string | null {
  const now = opts.now ?? Date.now()
  const ids = listIds(base, key)
  const last = ids[ids.length - 1]
  if (last) {
    const info = parseId(last)!
    try {
      if (hash(readFileSync(join(dirFor(base, key), last), 'utf8')) === hash(json)) return null
    } catch {
      /* unreadable previous snapshot: take a new one */
    }
    if (!opts.force && now - info.at < AUTO_GAP_MS) return null
  }
  const dir = dirFor(base, key)
  mkdirSync(dir, { recursive: true })
  let at = now
  // two snapshots in the same millisecond would collide; ids stay unique and ordered
  while (existsSync(join(dir, `${at}-${reason}.json`)) || (last && at <= parseId(last)!.at)) at++
  const id = `${at}-${reason}.json`
  writeFileSync(join(dir, id), json, 'utf8')
  prune(base, key)
  return id
}

function prune(base: string, key: string): void {
  const ids = listIds(base, key)
  const dir = dirFor(base, key)
  // protected ones (open, before-restore) outlive automatic ones when we are over the limit
  let over = ids.length - KEEP
  for (const id of ids) {
    if (over <= 0) break
    const r = parseId(id)!.reason
    if (r === 'open' || r === 'before-restore') continue
    try {
      unlinkSync(join(dir, id))
    } catch {
      /* ignore */
    }
    over--
  }
  // still over (all protected): drop the oldest regardless
  const rest = listIds(base, key)
  for (const id of rest.slice(0, Math.max(0, rest.length - KEEP * 2))) {
    try {
      unlinkSync(join(dir, id))
    } catch {
      /* ignore */
    }
  }
}

/** True when `next` has lost a large part of what `prev` had. */
export function shrank(prev: string, next: string): boolean {
  const a = measure(prev).blocks
  const b = measure(next).blocks
  return a >= SHRINK_MIN_BLOCKS && b < a * SHRINK_RATIO
}

export function list(base: string, key: string): BackupItem[] {
  const dir = dirFor(base, key)
  return listIds(base, key)
    .map((id) => {
      const info = parseId(id)!
      let text = ''
      try {
        text = readFileSync(join(dir, id), 'utf8')
      } catch {
        /* listed with zeros */
      }
      const m = measure(text)
      return { id, at: info.at, reason: info.reason, bytes: Buffer.byteLength(text), blocks: m.blocks, words: m.words }
    })
    .reverse()
}

export function read(base: string, key: string, id: string): string {
  if (!parseId(id)) throw new Error('Versão inválida.')
  return readFileSync(join(dirFor(base, key), id), 'utf8')
}
