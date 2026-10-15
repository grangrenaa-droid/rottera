/**
 * What "Copiar diagnóstico" puts on the clipboard. It exists to help someone answer a support request, so it holds
 * versions, counts and recent errors, and never the text of the script or the names and folders of files.
 */
export interface DiagnosticsInput {
  app: string
  electron: string
  chrome: string
  node: string
  platform: string
  osRelease: string
  arch: string
  locale: string
  memoryGb: number
  uptimeMin: number
  packaged: boolean
  bridgeOn: boolean
  /** From the renderer: numbers about the open script and the screen, no text. */
  script: {
    open: boolean
    saved: string
    blocks: number
    scenes: number
    pages: number
    paper: string
    beats: number
    frames: number
    lightMaps: number
    characters: number
    versions: number
  } | null
  view: { panel: string; theme: string; width: number; height: number; zoom: number } | null
  startedAfterCrash: boolean
  events: string[]
}

const MAX_MESSAGE = 300

/** Removes what could identify a person or a file: drive paths, UNC paths, file URLs, e-mail addresses. */
export function scrub(text: string): string {
  return text
    .replace(/file:\/\/\/?[^\s"')]+/gi, '<arquivo>')
    .replace(/\\\\[^\s"')\\]+\\[^\s"')]+/g, '<caminho>')
    .replace(/[A-Za-z]:[\\/][^\s"')]*/g, '<caminho>')
    .replace(/\/(?:Users|home)\/[^\s"')]+/g, '<caminho>')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '<e-mail>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_MESSAGE)
}

export function formatDiagnostics(d: DiagnosticsInput, now: Date = new Date()): string {
  const lines: string[] = []
  lines.push('Diagnóstico do Rottera')
  lines.push(`Gerado em ${now.toISOString()}`)
  lines.push('Este texto não inclui o roteiro, nomes de arquivos nem pastas.')
  lines.push('')
  lines.push(`Rottera ${d.app}${d.packaged ? '' : ' (desenvolvimento)'}`)
  lines.push(`Electron ${d.electron}, Chrome ${d.chrome}, Node ${d.node}`)
  lines.push(`Sistema: ${d.platform} ${d.osRelease} (${d.arch}), idioma ${d.locale}`)
  lines.push(`Memória do computador: ${d.memoryGb} GB; programa aberto há ${d.uptimeMin} min`)
  lines.push(`Conexão com o Claude: ${d.bridgeOn ? 'ligada' : 'desligada'}`)
  lines.push(`Última abertura: ${d.startedAfterCrash ? 'o programa não tinha sido fechado normalmente' : 'normal'}`)
  if (d.view) {
    lines.push(`Tela: ${d.view.panel}, tema ${d.view.theme}, janela ${d.view.width}×${d.view.height}, zoom ${d.view.zoom}`)
  }
  if (d.script && d.script.open) {
    const s = d.script
    lines.push('')
    lines.push('Roteiro aberto (somente números)')
    lines.push(`Estado: ${s.saved}; papel ${s.paper}`)
    lines.push(`${s.blocks} blocos, ${s.scenes} cenas, ${s.pages} páginas`)
    lines.push(`${s.beats} beats, ${s.frames} quadros de storyboard, ${s.lightMaps} mapas de luz, ${s.characters} fichas`)
    lines.push(`${s.versions} versões guardadas`)
  } else {
    lines.push('')
    lines.push('Nenhum roteiro aberto.')
  }
  lines.push('')
  lines.push('Últimos eventos e erros (mais recentes por último)')
  if (d.events.length === 0) lines.push('(nenhum)')
  else d.events.slice(-30).forEach((e) => lines.push(e))
  return lines.join('\n')
}
