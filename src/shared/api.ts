import type { Script } from './types'

export interface OpenResult {
  path: string
  script: Script
}

export interface RecentItem {
  path: string
  name: string
  openedAt: string
}

export type ExportFormat = 'pdf' | 'storyboard-pdf' | 'lightmap-pdf' | 'characters-pdf' | 'fdx' | 'fountain'

export type MenuAction =
  | 'new'
  | 'new-template'
  | 'open'
  | 'save'
  | 'save-as'
  | 'import'
  | 'export-pdf'
  | 'preview-pdf'
  | 'export-fdx'
  | 'export-fountain'
  | 'title-page'
  | 'versions'
  | 'manual'
  | 'diagnostics'
  | 'toggle-navigator'
  | 'theme-auto'
  | 'theme-light'
  | 'theme-night'
  | 'theme-midnight'
  | 'home'
  | 'find'
  | 'smarttype'
  | 'view-script'
  | 'view-board'
  | 'view-storyboard'
  | 'view-lightmap'
  | 'export-lightmap'
  | 'export-characters'
  | 'export-storyboard'
  | 'view-reports'
  | 'claude'

export interface BridgeRequest {
  id: number
  method: string
  params: unknown
}

export interface BackupInfo {
  id: string
  at: number
  reason: 'auto' | 'open' | 'shrink' | 'before-restore'
  bytes: number
  blocks: number
  words: number
}

export interface SessionInfo {
  /** The last run did not quit normally. */
  crashed: boolean
  lastPath: string | null
  lastName: string | null
}

/** Numbers about the open script and the screen, sent only to build the diagnostics text. No script text. */
export interface DiagnosticsStats {
  path: string | null
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
  } | null
  view: { panel: string; theme: string; width: number; height: number; zoom: number } | null
}

export interface ReportPdfRequest {
  title: string
  columns: string[]
  rows: (string | number)[][]
  scriptTitle: string
  paper: 'a4' | 'letter'
  landscape: boolean
}

export interface ConnectInfo {
  enabled: boolean
  bridgeFile: string
  mcpScript: string
  command: string
  claudeCodeCommand: string
  desktopConfig: string
  packaged: boolean
}

export interface RoteraApi {
  openFile(): Promise<OpenResult | null>
  readFile(path: string): Promise<OpenResult>
  saveFile(path: string | null, script: Script, suggestedName: string): Promise<string | null>
  importFile(): Promise<{ script: Script; name: string } | null>
  exportFile(format: ExportFormat, script: Script, suggestedName: string): Promise<string | null>
  /** Opens (or refreshes) a window showing the PDF that Exportar PDF would write. */
  previewPdf(script: Script, name: string): Promise<void>
  exportText(suggestedName: string, ext: string, content: string): Promise<string | null>
  exportReportPdf(req: ReportPdfRequest): Promise<string | null>
  recentList(): Promise<RecentItem[]>
  recentForget(path: string): Promise<void>
  draftSave(script: Script): Promise<void>
  draftLoad(): Promise<Script | null>
  draftClear(): Promise<void>
  backupsList(path: string | null): Promise<BackupInfo[]>
  backupsRestore(path: string | null, id: string): Promise<Script>
  sessionInfo(): Promise<SessionInfo>
  diagnostics(stats: DiagnosticsStats): Promise<string>
  logError(message: string): Promise<void>
  onMenu(handler: (action: MenuAction) => void): () => void
  connectInfo(): Promise<ConnectInfo>
  connectSet(enabled: boolean): Promise<ConnectInfo>
  onBridge(handler: (req: BridgeRequest) => void): () => void
  bridgeReply(msg: { id: number; result?: unknown; error?: string }): Promise<void>
  onBridgeActivity(handler: () => void): () => void
  copyText(text: string): Promise<void>
  /** The window is about to close: write pending edits, then call flushDone. */
  onFlushRequest(handler: () => void): () => void
  flushDone(): Promise<void>
}

declare global {
  interface Window {
    api: RoteraApi
  }
}
