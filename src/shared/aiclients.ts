/**
 * The Rottera MCP server is a plain stdio MCP server, so any app that runs local MCP servers can use it. Each app wants
 * the same three things (command, arguments, environment) in its own format; this builds what to paste for each one.
 */
export interface McpServer {
  command: string
  args: string[]
  env: Record<string, string>
}

export interface AiClient {
  id: string
  name: string
  /** Where the snippet goes, in plain words. */
  where: string
  /** A terminal command, or a block of configuration to paste into a file. */
  kind: 'command' | 'config'
  snippet: string
}

// Quote anything that looks like a path, leave short words like `node` or `1` alone.
const arg = (v: string): string => (/[\s\\/]/.test(v) ? `"${v}"` : v)

function cliCommand(prefix: string, envFlag: string, s: McpServer): string {
  const env = Object.entries(s.env).map(([k, v]) => `${envFlag} ${k}=${arg(v)}`)
  return [prefix, ...env, '--', arg(s.command), ...s.args.map(arg)].join(' ')
}

export function aiClients(s: McpServer): AiClient[] {
  const mcpServers = JSON.stringify({ mcpServers: { rottera: s } }, null, 2)
  const vscode = JSON.stringify({ servers: { rottera: { type: 'stdio', ...s } } }, null, 2)
  return [
    {
      id: 'claude-code',
      name: 'Claude Code',
      where: 'Cole no terminal uma vez.',
      kind: 'command',
      snippet: cliCommand('claude mcp add rottera', '-e', s)
    },
    {
      id: 'claude-desktop',
      name: 'Claude Desktop',
      where: 'Acrescente em claude_desktop_config.json (Configurações → Desenvolvedor → Editar configuração) e reinicie o Claude.',
      kind: 'config',
      snippet: mcpServers
    },
    {
      id: 'codex',
      name: 'Codex (OpenAI)',
      where: 'Cole no terminal uma vez. Vale para o Codex CLI, o app e a extensão do Codex, que leem a mesma configuração.',
      kind: 'command',
      snippet: cliCommand('codex mcp add rottera', '--env', s)
    },
    {
      id: 'gemini',
      name: 'Gemini CLI (Google)',
      where: 'Acrescente em .gemini/settings.json, na sua pasta de usuário, e reinicie o Gemini CLI.',
      kind: 'config',
      snippet: mcpServers
    },
    {
      id: 'cursor',
      name: 'Cursor',
      where: 'Acrescente em .cursor/mcp.json, na sua pasta de usuário (ou em Cursor Settings → MCP → Add new MCP server).',
      kind: 'config',
      snippet: mcpServers
    },
    {
      id: 'vscode',
      name: 'VS Code (GitHub Copilot)',
      where: 'No VS Code, rode o comando “MCP: Open User Configuration”, acrescente o bloco e use o Copilot no modo Agente.',
      kind: 'config',
      snippet: vscode
    },
    {
      id: 'windsurf',
      name: 'Windsurf',
      where: 'Acrescente em .codeium/windsurf/mcp_config.json, na sua pasta de usuário, e atualize a lista de servidores.',
      kind: 'config',
      snippet: mcpServers
    },
    {
      id: 'lmstudio',
      name: 'LM Studio (modelos locais)',
      where: 'Na aba Program, clique em Install → Edit mcp.json e acrescente o bloco. Use um modelo que aceite ferramentas.',
      kind: 'config',
      snippet: mcpServers
    },
    {
      id: 'other',
      name: 'Outro app com MCP',
      where: `A maioria aceita este bloco. Se o app pedir os campos separados: comando ${s.command}, argumentos ${s.args.join(' ')}, variáveis ${Object.entries(s.env).map(([k, v]) => `${k}=${v}`).join(', ')}.`,
      kind: 'config',
      snippet: mcpServers
    }
  ]
}
