import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, nativeImage, nativeTheme, shell } from 'electron'
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import * as backups from './backups'
import { arch, platform, release, totalmem } from 'node:os'
import { formatDiagnostics, scrub } from '../shared/diagnostics'
import { buildReportHtml, cleanReport, esc } from '../shared/reportHtml'
import { basename, extname, join } from 'node:path'
import type { MenuAction, OpenResult, RecentItem, ExportFormat, ConnectInfo, DiagnosticsStats, ReportPdfRequest } from '../shared/api'
import type { Script } from '../shared/types'
import { parseScriptFile, serialize } from '../shared/scriptfile'
import { parseFountain, toFountain } from '../shared/fountain'
import { parseFdx, toFdx } from '../shared/fdx'
import { buildPdfHtml, type PdfOptions } from './pdf'
import { Bridge } from './bridge'

const EXT = 'rottera'
/** Names the app had before: those files still open, and keep their extension until Salvar como. */
const LEGACY_EXTS = ['rotera', 'clapboard']
const LEGACY_APP_DIRS = ['Rotera', 'Clapboard', 'clapboard']
const MAX_IMPORT_BYTES = 5 * 1024 * 1024

let win: BrowserWindow | null = null
let bridge: Bridge | null = null
/** Set while the window waits for the renderer to write pending edits before closing. */
let onFlushDone: (() => void) | null = null

function userFile(name: string): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, name)
}

/** Write to a temp file in the same folder, then rename, so a crash never leaves half a script. */
function writeAtomic(path: string, data: string): void {
  const tmp = `${path}.tmp-${process.pid}`
  writeFileSync(tmp, data, 'utf8')
  renameSync(tmp, path)
}

function readJson<T>(path: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T
  } catch {
    return fallback
  }
}

let sessionInfo: { crashed: boolean; lastPath: string | null; lastName: string | null } = { crashed: false, lastPath: null, lastName: null }

// ---------------------------------------------------------------- app icon
/** The window and taskbar icon. Missing file: the default one, never a failure. */
function appIcon(): Electron.NativeImage | undefined {
  try {
    const p = join(app.getAppPath(), 'build', 'icon.png')
    return existsSync(p) ? nativeImage.createFromPath(p) : undefined
  } catch {
    return undefined
  }
}

// ---------------------------------------------------------------- data from before the rename
/**
 * The app used to be called Rotera, and before that Clapboard, and kept its data in a folder of that name. On the first
 * run under the new name, recent files, the draft, settings and version history are copied over once. Nothing is deleted.
 */
function migrateLegacyData(): void {
  try {
    const marker = userFile('migrated.json')
    if (existsSync(marker)) return
    const base = process.env.ROTERA_LEGACY_APPDATA || app.getPath('appData')
    const target = app.getPath('userData')
    for (const name of LEGACY_APP_DIRS) {
      const from = join(base, name)
      if (!existsSync(from) || from === target) continue
      for (const f of ['recent.json', 'draft.json', 'settings.json']) {
        const src = join(from, f)
        if (existsSync(src) && !existsSync(join(target, f))) writeFileSync(join(target, f), readFileSync(src))
      }
      const back = join(from, 'backups')
      if (existsSync(back)) copyFolder(back, join(target, 'backups'))
      break
    }
    writeFileSync(marker, JSON.stringify({ at: new Date().toISOString() }), 'utf8')
  } catch {
    /* a failed copy must not stop the app from starting */
  }
}

function copyFolder(from: string, to: string): void {
  mkdirSync(to, { recursive: true })
  for (const name of readdirSync(from)) {
    const a = join(from, name)
    const b = join(to, name)
    if (statSync(a).isDirectory()) copyFolder(a, b)
    else if (!existsSync(b)) writeFileSync(b, readFileSync(a))
  }
}

// ---------------------------------------------------------------- event log (for "Copiar diagnóstico")
const LOG_FILE = 'diagnostico.log'
const LOG_KEEP = 100
let rendererErrors = 0

/** A short, scrubbed line per event. It never stops anything: failures here are ignored. */
function logEvent(kind: string, message: string): void {
  try {
    const path = userFile(LOG_FILE)
    appendFileSync(path, `${new Date().toISOString()} ${kind} ${scrub(message)}\n`, 'utf8')
    const lines = readFileSync(path, 'utf8').split('\n').filter(Boolean)
    if (lines.length > LOG_KEEP * 2) writeFileSync(path, lines.slice(-LOG_KEEP).join('\n') + '\n', 'utf8')
  } catch {
    /* ignore */
  }
}

function recentEvents(): string[] {
  try {
    return readFileSync(userFile(LOG_FILE), 'utf8').split('\n').filter(Boolean).slice(-30)
  } catch {
    return []
  }
}

// ---------------------------------------------------------------- version history
function backupsDir(): string {
  return userFile('backups')
}

/** History must never stop a save: any failure here is swallowed. */
function keepVersion(key: string, json: string, reason: backups.BackupReason, force = false): void {
  try {
    backups.snapshot(backupsDir(), key, json, reason, { force })
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------- recent files
function recentList(): RecentItem[] {
  return readJson<RecentItem[]>(userFile('recent.json'), []).filter((r) => existsSync(r.path))
}

function recentAdd(path: string): void {
  const list = recentList().filter((r) => r.path !== path)
  list.unshift({ path, name: basename(path, extname(path)), openedAt: new Date().toISOString() })
  writeFileSync(userFile('recent.json'), JSON.stringify(list.slice(0, 12)), 'utf8')
}

// ---------------------------------------------------------------- IPC
function registerIpc(): void {
  ipcMain.handle('file:open', async (): Promise<OpenResult | null> => {
    if (!win) return null
    const r = await dialog.showOpenDialog(win, {
      title: 'Abrir roteiro',
      filters: [{ name: 'Roteiro', extensions: [EXT, ...LEGACY_EXTS] }],
      properties: ['openFile']
    })
    if (r.canceled || !r.filePaths[0]) return null
    const path = r.filePaths[0]
    const raw = readFileSync(path, 'utf8')
    const script = parseScriptFile(raw)
    keepVersion(backups.backupKey(path), raw, 'open', true)
    recentAdd(path)
    return { path, script }
  })

  ipcMain.handle('file:read', (_e, path: string): OpenResult => {
    const raw = readFileSync(path, 'utf8')
    const script = parseScriptFile(raw)
    keepVersion(backups.backupKey(path), raw, 'open', true)
    recentAdd(path)
    return { path, script }
  })

  ipcMain.handle(
    'file:save',
    async (_e, a: { path: string | null; script: Script; suggestedName: string }): Promise<string | null> => {
      let path = a.path
      if (!path) {
        if (!win) return null
        const r = await dialog.showSaveDialog(win, {
          title: 'Salvar roteiro',
          defaultPath: `${a.suggestedName || 'Sem título'}.${EXT}`,
          filters: [{ name: 'Roteiro Rottera', extensions: [EXT] }]
        })
        if (r.canceled || !r.filePath) return null
        path = r.filePath.endsWith(`.${EXT}`) ? r.filePath : `${r.filePath}.${EXT}`
      }
      const next = serialize(a.script)
      const key = backups.backupKey(path)
      if (existsSync(path)) {
        // a save that drops most of the script keeps what was there first
        try {
          const prev = readFileSync(path, 'utf8')
          if (backups.shrank(prev, next)) keepVersion(key, prev, 'shrink', true)
        } catch {
          /* unreadable previous file: nothing to keep */
        }
      }
      writeAtomic(path, next)
      keepVersion(key, next, 'auto')
      recentAdd(path)
      return path
    }
  )

  ipcMain.handle('file:import', async (): Promise<{ script: Script; name: string } | null> => {
    if (!win) return null
    const r = await dialog.showOpenDialog(win, {
      title: 'Importar roteiro',
      filters: [{ name: 'FDX ou Fountain', extensions: ['fdx', 'fountain', 'txt'] }],
      properties: ['openFile']
    })
    if (r.canceled || !r.filePaths[0]) return null
    const path = r.filePaths[0]
    const raw = readFileSync(path)
    if (raw.length > MAX_IMPORT_BYTES) throw new Error('Arquivo grande demais (limite de 5 MB).')
    const text = raw.toString('utf8')
    const ext = extname(path).toLowerCase()
    const script = ext === '.fdx' ? parseFdx(text) : parseFountain(text)
    return { script, name: basename(path, ext) }
  })

  ipcMain.handle(
    'file:export',
    async (_e, a: { format: ExportFormat; script: Script; suggestedName: string }): Promise<string | null> => {
      if (!win) return null
      const ext = a.format === 'pdf' || a.format === 'storyboard-pdf' || a.format === 'lightmap-pdf' || a.format === 'characters-pdf' ? 'pdf' : a.format === 'fdx' ? 'fdx' : 'fountain'
      const r = await dialog.showSaveDialog(win, {
        title: 'Exportar',
        defaultPath: `${a.suggestedName || 'Sem título'}.${ext}`,
        filters: [{ name: ext.toUpperCase(), extensions: [ext] }]
      })
      if (r.canceled || !r.filePath) return null
      if (a.format === 'fdx') writeFileSync(r.filePath, toFdx(a.script), 'utf8')
      else if (a.format === 'fountain') writeFileSync(r.filePath, toFountain(a.script), 'utf8')
      else writeFileSync(r.filePath, await renderPdf(a.script, { storyboardOnly: a.format === 'storyboard-pdf', lightMapsOnly: a.format === 'lightmap-pdf', charactersOnly: a.format === 'characters-pdf' }))
      return r.filePath
    }
  )

  ipcMain.handle('file:previewPdf', (_e, a: { script: Script; name: string }) => showPreview(a.script, a.name))

  ipcMain.handle('file:exportReportPdf', async (_e, req: ReportPdfRequest): Promise<string | null> => {
    if (!win) return null
    if (!req || !Array.isArray(req.columns) || !Array.isArray(req.rows)) throw new Error('Relatório inválido.')
    const clean = cleanReport(req)
    const r = await dialog.showSaveDialog(win, {
      title: 'Exportar relatório',
      defaultPath: `${clean.title || 'Relatório'}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (r.canceled || !r.filePath) return null
    writeFileSync(r.filePath, await renderReportPdf(buildReportHtml(clean), clean.scriptTitle || 'Sem título', clean.title, req.paper === 'a4' ? 'A4' : 'Letter', req.landscape === true))
    return r.filePath
  })

  ipcMain.handle(
    'file:exportText',
    async (_e, a: { suggestedName: string; ext: string; content: string }): Promise<string | null> => {
      if (!win) return null
      const ext = a.ext.replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'txt'
      const r = await dialog.showSaveDialog(win, {
        title: 'Exportar',
        defaultPath: `${a.suggestedName || 'Relatório'}.${ext}`,
        filters: [{ name: ext.toUpperCase(), extensions: [ext] }]
      })
      if (r.canceled || !r.filePath) return null
      writeFileSync(r.filePath, '﻿' + a.content, 'utf8')
      return r.filePath
    }
  )

  ipcMain.handle('flush:done', () => {
    onFlushDone?.()
  })
  ipcMain.handle('clipboard:write', (_e, text: string) => clipboard.writeText(String(text)))
  ipcMain.handle('connect:info', () => connectInfo())
  ipcMain.handle('connect:set', async (_e, enabled: boolean) => {
    if (!bridge) return connectInfo()
    if (enabled) await bridge.start()
    else bridge.stop()
    writeFileSync(userFile('settings.json'), JSON.stringify({ bridge: enabled }), 'utf8')
    return connectInfo()
  })

  ipcMain.handle('recent:list', () => recentList())
  ipcMain.handle('recent:forget', (_e, path: string) => {
    const list = recentList().filter((r) => r.path !== path)
    writeFileSync(userFile('recent.json'), JSON.stringify(list), 'utf8')
  })

  ipcMain.handle('draft:save', (_e, script: Script) => {
    const json = serialize(script)
    writeAtomic(userFile('draft.json'), json)
    keepVersion(backups.backupKey(null), json, 'auto')
  })
  ipcMain.handle('draft:load', (): Script | null => {
    const p = userFile('draft.json')
    if (!existsSync(p)) return null
    try {
      return parseScriptFile(readFileSync(p, 'utf8'))
    } catch {
      return null
    }
  })
  ipcMain.handle('backups:list', (_e, path: string | null) => backups.list(backupsDir(), backups.backupKey(path)))
  ipcMain.handle('backups:restore', (_e, a: { path: string | null; id: string }): Script => {
    const key = backups.backupKey(a.path)
    const raw = backups.read(backupsDir(), key, a.id)
    const script = parseScriptFile(raw) // refuses a damaged snapshot before anything is replaced
    const currentPath = a.path ?? userFile('draft.json')
    if (existsSync(currentPath)) keepVersion(key, readFileSync(currentPath, 'utf8'), 'before-restore', true)
    return script
  })
  ipcMain.handle('session:info', () => sessionInfo)
  ipcMain.handle('log:error', (_e, message: unknown) => {
    // a runaway loop in the page must not fill the disk
    if (rendererErrors++ < 50) logEvent('erro-tela', String(message))
  })
  ipcMain.handle('diag:build', (_e, stats: DiagnosticsStats): string => {
    const key = backups.backupKey(stats.path)
    let versions = 0
    try {
      versions = backups.list(backupsDir(), key).length
    } catch {
      /* none */
    }
    return formatDiagnostics({
      app: app.getVersion(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      platform: platform(),
      osRelease: release(),
      arch: arch(),
      locale: app.getLocale(),
      memoryGb: Math.round(totalmem() / 1073741824),
      uptimeMin: Math.round(process.uptime() / 60),
      packaged: app.isPackaged,
      bridgeOn: connectInfo().enabled,
      script: stats.script ? { ...stats.script, versions } : null,
      view: stats.view,
      startedAfterCrash: sessionInfo.crashed,
      events: recentEvents()
    })
  })

  ipcMain.handle('draft:clear', () => {
    const p = userFile('draft.json')
    if (existsSync(p)) unlinkSync(p)
  })
}

/** A report table on the paper and orientation the writer picked, with the script title and page numbers in the margins. */
async function renderReportPdf(html: string, scriptTitle: string, title: string, pageSize: 'A4' | 'Letter', landscape: boolean): Promise<Buffer> {
  const htmlPath = userFile('print-report.html')
  writeFileSync(htmlPath, html, 'utf8')
  const printWin = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true, javascript: false }
  })
  const footer =
    `<div style="font-size:8px;width:100%;padding:0 0.6in;color:#444;display:flex;justify-content:space-between;font-family:Segoe UI,Arial,sans-serif">` +
    `<span>${esc(scriptTitle)} — ${esc(title)}</span><span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>`
  try {
    await printWin.loadFile(htmlPath)
    return await printWin.webContents.printToPDF({
      pageSize,
      landscape,
      printBackground: false,
      margins: { marginType: 'custom', top: 0.6, bottom: 0.7, left: 0.6, right: 0.6 },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: footer
    })
  } finally {
    printWin.destroy()
    try {
      unlinkSync(htmlPath)
    } catch {
      /* ignore */
    }
  }
}

async function renderPdf(script: Script, opts: PdfOptions = {}): Promise<Buffer> {
  const htmlPath = userFile('print.html')
  writeFileSync(htmlPath, buildPdfHtml(script, opts), 'utf8')
  const printWin = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true, javascript: false }
  })
  try {
    await printWin.loadFile(htmlPath)
    return await printWin.webContents.printToPDF({
      pageSize: 'Letter',
      printBackground: false,
      margins: { marginType: 'none' },
      preferCSSPageSize: true
    })
  } finally {
    printWin.destroy()
    try {
      unlinkSync(htmlPath)
    } catch {
      /* ignore */
    }
  }
}

let previewWin: BrowserWindow | null = null

/** Shows the script exactly as Exportar PDF writes it, in its own window with Chromium's PDF viewer. */
async function showPreview(script: Script, name: string): Promise<void> {
  const file = userFile('preview.pdf')
  writeFileSync(file, await renderPdf(script))
  if (!previewWin || previewWin.isDestroyed()) {
    previewWin = new BrowserWindow({
      width: 900,
      height: 1000,
      minWidth: 480,
      minHeight: 400,
      icon: appIcon(),
      autoHideMenuBar: true,
      backgroundColor: '#525659',
      webPreferences: { sandbox: true, contextIsolation: true, plugins: true }
    })
    previewWin.setMenu(null)
    // the viewer would otherwise rename the window after the file
    previewWin.on('page-title-updated', (e) => e.preventDefault())
    previewWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    previewWin.on('closed', () => {
      previewWin = null
      try {
        unlinkSync(file)
      } catch {
        /* ignore */
      }
    })
  }
  previewWin.setTitle(`Visualizar impressão — ${name}`)
  await previewWin.loadFile(file, { search: String(Date.now()) })
  if (previewWin.isMinimized()) previewWin.restore()
  previewWin.show()
  previewWin.focus()
}

// ---------------------------------------------------------------- Claude connection
function connectInfo(): ConnectInfo {
  const bridgeFile = userFile('bridge.json')
  const packaged = app.isPackaged
  const mcpScript = packaged
    ? join(process.resourcesPath, 'mcp', 'rottera-mcp.cjs')
    : join(app.getAppPath(), 'mcp', 'rottera-mcp.cjs')
  const exe = process.execPath
  const q = (v: string): string => `"${v}"`
  const claudeCodeCommand = packaged
    ? `claude mcp add rottera -e ELECTRON_RUN_AS_NODE=1 -e ROTERA_BRIDGE_FILE=${q(bridgeFile)} -- ${q(exe)} ${q(mcpScript)}`
    : `claude mcp add rottera -e ROTERA_BRIDGE_FILE=${q(bridgeFile)} -- node ${q(mcpScript)}`
  const desktopConfig = JSON.stringify(
    {
      mcpServers: {
        rottera: {
          command: packaged ? exe : 'node',
          args: [mcpScript],
          env: packaged
            ? { ELECTRON_RUN_AS_NODE: '1', ROTERA_BRIDGE_FILE: bridgeFile }
            : { ROTERA_BRIDGE_FILE: bridgeFile }
        }
      }
    },
    null,
    2
  )
  return {
    enabled: bridge?.info().enabled ?? false,
    bridgeFile,
    mcpScript,
    command: packaged ? `${q(exe)} ${q(mcpScript)}` : `node ${q(mcpScript)}`,
    claudeCodeCommand,
    desktopConfig,
    packaged
  }
}

// ---------------------------------------------------------------- window and menu
function send(action: MenuAction): void {
  win?.webContents.send('menu', action)
}

function buildMenu(): void {
  const item = (label: string, action: MenuAction, accelerator?: string): Electron.MenuItemConstructorOptions => ({
    label,
    accelerator,
    click: () => send(action)
  })
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Arquivo',
      submenu: [
        item('Novo roteiro', 'new', 'CmdOrCtrl+N'),
        item('Novo a partir de modelo...', 'new-template', 'CmdOrCtrl+Shift+N'),
        item('Abrir...', 'open', 'CmdOrCtrl+O'),
        item('Salvar', 'save', 'CmdOrCtrl+S'),
        item('Salvar como...', 'save-as', 'CmdOrCtrl+Shift+S'),
        { type: 'separator' },
        item('Importar FDX ou Fountain...', 'import'),
        item('Visualizar impressão', 'preview-pdf', 'CmdOrCtrl+Shift+P'),
        {
          label: 'Exportar',
          submenu: [
            item('PDF...', 'export-pdf', 'CmdOrCtrl+P'),
            item('Somente o storyboard (PDF)...', 'export-storyboard'),
            item('Somente os mapas de luz (PDF)...', 'export-lightmap'),
            item('Somente as fichas de personagem (PDF)...', 'export-characters'),
            item('FDX (formato de roteiro)...', 'export-fdx'),
            item('Fountain...', 'export-fountain')
          ]
        },
        { type: 'separator' },
        item('Página de título...', 'title-page'),
        item('Versões anteriores...', 'versions'),
        item('Conectar ao Claude...', 'claude'),
        item('Tela inicial', 'home'),
        { type: 'separator' },
        { role: 'quit', label: 'Sair' }
      ]
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'undo', label: 'Desfazer' },
        { role: 'redo', label: 'Refazer' },
        { type: 'separator' },
        { role: 'cut', label: 'Recortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Colar' },
        { role: 'selectAll', label: 'Selecionar tudo' },
        { type: 'separator' },
        item('Localizar e substituir...', 'find', 'CmdOrCtrl+F'),
        item('Gerenciar SmartType...', 'smarttype')
      ]
    },
    {
      label: 'Exibir',
      submenu: [
        item('Roteiro', 'view-script', 'CmdOrCtrl+Alt+1'),
        item('Beat Board', 'view-board', 'CmdOrCtrl+Alt+2'),
        item('Storyboard', 'view-storyboard', 'CmdOrCtrl+Alt+4'),
        item('Mapa de Luz', 'view-lightmap', 'CmdOrCtrl+Alt+5'),
        item('Relatórios', 'view-reports', 'CmdOrCtrl+Alt+3'),
        { type: 'separator' },
        item('Mostrar ou ocultar navegador', 'toggle-navigator', 'CmdOrCtrl+\\'),
        { type: 'separator' },
        item('Tema automático (segue o Windows)', 'theme-auto'),
        item('Tema claro', 'theme-light'),
        item('Tema noite', 'theme-night'),
        item('Tema meia-noite', 'theme-midnight'),
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Tela cheia' },
        { role: 'zoomIn', label: 'Aumentar zoom' },
        { role: 'zoomOut', label: 'Diminuir zoom' },
        { role: 'resetZoom', label: 'Zoom padrão' }
      ]
    },
    {
      label: 'Ajuda',
      submenu: [item('Manual do Rottera', 'manual', 'F1'), item('Copiar diagnóstico...', 'diagnostics')]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 760,
    minHeight: 520,
    title: 'Rottera',
    icon: appIcon(),
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0f1114' : '#eceff3',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://') && !url.startsWith('http://localhost')) e.preventDefault()
  })
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) void win.loadURL(devUrl)
  else void win.loadFile(join(__dirname, '../renderer/index.html'))
  // Give the renderer a chance to write pending edits before the window goes away.
  let closing = false
  win.on('close', (e) => {
    const w = win
    if (closing || !w || w.isDestroyed()) return
    e.preventDefault()
    closing = true
    const finish = (): void => {
      if (!w.isDestroyed()) w.destroy()
    }
    onFlushDone = finish
    w.webContents.send('flush:request')
    setTimeout(finish, 3000)
  })
  win.webContents.on('unresponsive', () => logEvent('janela-sem-resposta', ''))
  win.webContents.on('did-fail-load', (_e, code, desc) => logEvent('falha-ao-carregar', `${code} ${desc}`))
  win.on('closed', () => {
    win = null
    previewWin?.close()
  })
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })
  void app.whenReady().then(() => {
    migrateLegacyData()
    // a marker that exists at start means the last run did not quit normally
    const lock = userFile('running.lock')
    const crashed = existsSync(lock)
    const last = recentList()[0]
    sessionInfo = { crashed, lastPath: crashed && last ? last.path : null, lastName: crashed && last ? last.name : null }
    writeFileSync(lock, String(Date.now()), 'utf8')
    logEvent('inicio', `versão ${app.getVersion()}${crashed ? '; a abertura anterior não terminou normalmente' : ''}`)
    app.on('render-process-gone', (_e, _wc, d) => logEvent('tela-caiu', `${d.reason} (código ${d.exitCode})`))
    app.on('child-process-gone', (_e, d) => logEvent('processo-caiu', `${d.type}: ${d.reason}`))
    registerIpc()
    buildMenu()
    createWindow()
    bridge = new Bridge(
      userFile('bridge.json'),
      () => win,
      () => win?.webContents.send('bridge:activity')
    )
    const settings = readJson<{ bridge?: boolean }>(userFile('settings.json'), {})
    if (settings.bridge !== false) void bridge.start().catch(() => undefined)
  })
  process.on('uncaughtExceptionMonitor', (e) => logEvent('erro-principal', e instanceof Error ? e.stack ?? e.message : String(e)))
  app.on('before-quit', () => {
    bridge?.stop()
  })
  app.on('will-quit', () => {
    try {
      unlinkSync(userFile('running.lock'))
    } catch {
      /* already gone */
    }
  })
  app.on('window-all-closed', () => app.quit())
}
