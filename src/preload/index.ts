import { contextBridge, ipcRenderer } from 'electron'
import type { BridgeRequest, RoteraApi, MenuAction } from '../shared/api'

const api: RoteraApi = {
  openFile: () => ipcRenderer.invoke('file:open'),
  readFile: (path) => ipcRenderer.invoke('file:read', path),
  saveFile: (path, script, suggestedName) => ipcRenderer.invoke('file:save', { path, script, suggestedName }),
  importFile: () => ipcRenderer.invoke('file:import'),
  exportFile: (format, script, suggestedName) =>
    ipcRenderer.invoke('file:export', { format, script, suggestedName }),
  previewPdf: (script, name) => ipcRenderer.invoke('file:previewPdf', { script, name }),
  exportText: (suggestedName, ext, content) => ipcRenderer.invoke('file:exportText', { suggestedName, ext, content }),
  exportReportPdf: (req) => ipcRenderer.invoke('file:exportReportPdf', req),
  recentList: () => ipcRenderer.invoke('recent:list'),
  recentForget: (path) => ipcRenderer.invoke('recent:forget', path),
  draftSave: (script) => ipcRenderer.invoke('draft:save', script),
  draftLoad: () => ipcRenderer.invoke('draft:load'),
  draftClear: () => ipcRenderer.invoke('draft:clear'),
  backupsList: (path) => ipcRenderer.invoke('backups:list', path),
  backupsRestore: (path, id) => ipcRenderer.invoke('backups:restore', { path, id }),
  sessionInfo: () => ipcRenderer.invoke('session:info'),
  diagnostics: (stats) => ipcRenderer.invoke('diag:build', stats),
  logError: (message) => ipcRenderer.invoke('log:error', message),
  onMenu: (handler) => {
    const listener = (_e: unknown, action: MenuAction): void => handler(action)
    ipcRenderer.on('menu', listener)
    return () => ipcRenderer.removeListener('menu', listener)
  },
  connectInfo: () => ipcRenderer.invoke('connect:info'),
  connectSet: (enabled) => ipcRenderer.invoke('connect:set', enabled),
  onBridge: (handler) => {
    const listener = (_e: unknown, req: BridgeRequest): void => handler(req)
    ipcRenderer.on('bridge:request', listener)
    return () => ipcRenderer.removeListener('bridge:request', listener)
  },
  bridgeReply: (msg) => ipcRenderer.invoke('bridge:reply', msg),
  onBridgeActivity: (handler) => {
    const listener = (): void => handler()
    ipcRenderer.on('bridge:activity', listener)
    return () => ipcRenderer.removeListener('bridge:activity', listener)
  },
  copyText: (text) => ipcRenderer.invoke('clipboard:write', text),
  onFlushRequest: (handler) => {
    const listener = (): void => handler()
    ipcRenderer.on('flush:request', listener)
    return () => ipcRenderer.removeListener('flush:request', listener)
  },
  flushDone: () => ipcRenderer.invoke('flush:done')
}

contextBridge.exposeInMainWorld('api', api)
