import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AUTO_GAP_MS, KEEP, backupKey, list, measure, read, shrank, snapshot } from '../src/main/backups'

const file = (n: number, text = 'palavra outra'): string =>
  JSON.stringify({ format: 'rotera', version: 1, script: { blocks: Array.from({ length: n }, () => ({ kind: 'action', text })) } })
const base = (): string => mkdtempSync(join(tmpdir(), 'rotera-bk-'))
const K = backupKey('C:\roteiros\a.rotera')

describe('version history', () => {
  it('keys are stable per path, case-insensitive on the path, and separate for the draft', () => {
    expect(backupKey('C:\\A\\b.rotera')).toBe(backupKey('c:\\a\\B.rotera'))
    expect(backupKey('C:\\a.rotera')).not.toBe(backupKey('C:\\b.rotera'))
    expect(backupKey(null)).toBe('rascunho')
  })

  it('measures blocks and words, and survives a damaged file', () => {
    expect(measure(file(3))).toEqual({ blocks: 3, words: 6 })
    expect(measure('{not json')).toEqual({ blocks: 0, words: 0 })
  })

  it('stores the first snapshot, skips identical text and too-recent ones', () => {
    const b = base()
    const t0 = 1_700_000_000_000
    expect(snapshot(b, K, file(2), 'auto', { now: t0 })).not.toBeNull()
    expect(snapshot(b, K, file(2), 'auto', { now: t0 + 10 * 60_000 })).toBeNull() // identical
    expect(snapshot(b, K, file(3), 'auto', { now: t0 + 1000 })).toBeNull() // too soon
    expect(snapshot(b, K, file(3), 'auto', { now: t0 + AUTO_GAP_MS + 1 })).not.toBeNull()
    expect(list(b, K)).toHaveLength(2)
  })

  it('force ignores the gap but still skips identical text', () => {
    const b = base()
    const t0 = 1_700_000_000_000
    snapshot(b, K, file(2), 'auto', { now: t0 })
    expect(snapshot(b, K, file(5), 'open', { now: t0 + 5, force: true })).not.toBeNull()
    expect(snapshot(b, K, file(5), 'open', { now: t0 + 9, force: true })).toBeNull()
  })

  it('lists newest first and reads a snapshot back byte for byte', () => {
    const b = base()
    const t0 = 1_700_000_000_000
    snapshot(b, K, file(2), 'auto', { now: t0 })
    const id = snapshot(b, K, file(7), 'shrink', { now: t0 + 1, force: true })!
    const l = list(b, K)
    expect(l.map((x) => x.reason)).toEqual(['shrink', 'auto'])
    expect(l[0].blocks).toBe(7)
    expect(read(b, K, id)).toBe(file(7))
  })

  it('keeps at most KEEP snapshots, dropping the oldest automatic ones first', () => {
    const b = base()
    const t0 = 1_700_000_000_000
    snapshot(b, K, file(1, 'protegida'), 'open', { now: t0, force: true })
    for (let i = 1; i <= KEEP + 5; i++) snapshot(b, K, file(1, `v${i}`), 'auto', { now: t0 + i * (AUTO_GAP_MS + 1) })
    const l = list(b, K)
    expect(l.length).toBeLessThanOrEqual(KEEP)
    expect(l.some((x) => x.reason === 'open')).toBe(true)
    expect(l[0].at).toBeGreaterThan(l[l.length - 1].at)
  })

  it('detects a save that loses most of the script, but not a small script or a small cut', () => {
    expect(shrank(file(100), file(10))).toBe(true)
    expect(shrank(file(100), file(90))).toBe(false)
    expect(shrank(file(10), file(1))).toBe(false)
  })

  it('refuses ids that are not snapshots (no path tricks)', () => {
    const b = base()
    writeFileSync(join(b, 'x.json'), '{}')
    expect(() => read(b, K, '../x.json')).toThrow()
    expect(() => read(b, '..', '1700000000000-auto.json')).not.toThrow(/Versão inválida/)
    expect(readdirSync(b)).toContain('x.json')
  })
})

describe('same script, different save time', () => {
  it('is not stored again', () => {
    const b = base()
    const mk = (at: string): string => JSON.stringify({ format: 'rotera', version: 1, savedAt: at, script: { blocks: [{ kind: 'action', text: 'a' }] } })
    expect(snapshot(b, K, mk('2026-01-01T00:00:00Z'), 'auto', { now: 1_700_000_000_000 })).not.toBeNull()
    expect(snapshot(b, K, mk('2026-01-01T00:09:00Z'), 'open', { now: 1_700_000_900_000, force: true })).toBeNull()
  })
})
