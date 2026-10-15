import { describe, expect, it } from 'vitest'
import { parseScriptFile, serialize } from '../src/shared/scriptfile'

describe('files from before the app had its name', () => {
  const body = { version: 1, savedAt: '2026-01-01T00:00:00Z', script: { titlePage: { title: 'T', author: '', contact: '' }, blocks: [{ kind: 'action', text: 'x' }] } }

  it('reads format "clapboard" and "rotera", and writes "rotera"', () => {
    expect(parseScriptFile(JSON.stringify({ format: 'clapboard', ...body })).blocks[0].text).toBe('x')
    expect(parseScriptFile(JSON.stringify({ format: 'rotera', ...body })).blocks[0].text).toBe('x')
    expect(JSON.parse(serialize(parseScriptFile(JSON.stringify({ format: 'clapboard', ...body })))).format).toBe('rotera')
  })

  it('still refuses anything else', () => {
    expect(() => parseScriptFile(JSON.stringify({ format: 'fdx', ...body }))).toThrow()
  })
})
