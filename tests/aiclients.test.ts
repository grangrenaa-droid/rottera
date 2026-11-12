import { describe, expect, it } from 'vitest'
import { aiClients } from '../src/shared/aiclients'

const server = {
  command: 'C:\\Rottera\\Rottera.exe',
  args: ['C:\\Rottera\\resources\\mcp\\rottera-mcp.cjs'],
  env: { ELECTRON_RUN_AS_NODE: '1', ROTERA_BRIDGE_FILE: 'C:\\Users\\a\\AppData\\Roaming\\Rottera\\bridge.json' }
}

const byId = (id: string) => {
  const c = aiClients(server).find((x) => x.id === id)
  if (!c) throw new Error(`missing ${id}`)
  return c
}

describe('aiClients', () => {
  it('lists the apps that can run a local MCP server, ending with the generic one', () => {
    const ids = aiClients(server).map((c) => c.id)
    expect(ids).toEqual(['claude-code', 'claude-desktop', 'codex', 'gemini', 'cursor', 'vscode', 'windsurf', 'lmstudio', 'other'])
    for (const c of aiClients(server)) {
      expect(c.name).not.toBe('')
      expect(c.where).not.toBe('')
      expect(c.snippet).not.toBe('')
    }
  })

  it('keeps the Claude Code command exactly as before', () => {
    expect(byId('claude-code').snippet).toBe(
      'claude mcp add rottera -e ELECTRON_RUN_AS_NODE=1 -e ROTERA_BRIDGE_FILE="C:\\Users\\a\\AppData\\Roaming\\Rottera\\bridge.json" -- "C:\\Rottera\\Rottera.exe" "C:\\Rottera\\resources\\mcp\\rottera-mcp.cjs"'
    )
  })

  it('gives Codex a one-line command with every variable', () => {
    expect(byId('codex').snippet).toBe(
      'codex mcp add rottera --env ELECTRON_RUN_AS_NODE=1 --env ROTERA_BRIDGE_FILE="C:\\Users\\a\\AppData\\Roaming\\Rottera\\bridge.json" -- "C:\\Rottera\\Rottera.exe" "C:\\Rottera\\resources\\mcp\\rottera-mcp.cjs"'
    )
  })

  it('writes mcpServers JSON that parses back to the same server', () => {
    for (const id of ['claude-desktop', 'gemini', 'cursor', 'windsurf', 'lmstudio', 'other']) {
      expect(JSON.parse(byId(id).snippet)).toEqual({ mcpServers: { rottera: server } })
    }
  })

  it('writes the VS Code format, which uses "servers" and a type', () => {
    expect(JSON.parse(byId('vscode').snippet)).toEqual({ servers: { rottera: { type: 'stdio', ...server } } })
  })

  it('works in development, where node runs the script and no extra variable is needed', () => {
    const dev = { command: 'node', args: ['/src/mcp/rottera-mcp.cjs'], env: { ROTERA_BRIDGE_FILE: '/home/a/bridge.json' } }
    const code = aiClients(dev).find((c) => c.id === 'claude-code')!
    expect(code.snippet).toBe('claude mcp add rottera -e ROTERA_BRIDGE_FILE="/home/a/bridge.json" -- node "/src/mcp/rottera-mcp.cjs"')
  })
})
