import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Beat, Block, Board, CharacterSheet, Extras, Kind, LightMap, Paper, RevisionState, Script, Storyboard, TitlePage } from '../shared/types'
import { emptyScript, emptyStoryboard } from '../shared/types'
import { LABELS } from '../shared/elements'
import { paginate, type PageLine } from '../shared/paginate'
import type { MenuAction, RecentItem, SessionInfo } from '../shared/api'
import { folderOf, whenOpened } from '../shared/recent'
import { isDark, toggleTheme, type Theme } from '../shared/theme'
import { lockScenes, moveSceneTo, sceneNumbers, sceneRanges, unlockScenes } from '../shared/scenes'
import { renameCharacter, renameLocation } from '../shared/rename'
import { beatLinks, sendBeats } from '../shared/beats'
import { characterKey } from '../shared/characters'
import { REVISIONS, revisionLabel } from '../shared/revisions'
import type { Template } from '../shared/templates'
import { Editor, ELEMENT_OPTIONS, type CaretInfo, type EditorHandle } from './Editor'
import { BoardView } from './Board'
import { StoryboardView } from './Storyboard'
import { ScriptPage } from './ScriptPage'
import { LightMapView } from './LightMap'
import { ReportsView } from './Reports'
import { ConnectDialog, DiagnosticsDialog, ManualDialog, SmartTypeDialog, TemplatesDialog, TitleDialog, VersionsDialog } from './Dialogs'
import { createBridgeHandler } from './bridgeHandler'

type Saved = 'saved' | 'draft' | 'saving' | 'unsaved' | 'error'
type Panel = 'script' | 'board' | 'storyboard' | 'lightmap' | 'reports'
type DialogName = null | 'title' | 'templates' | 'smarttype' | 'connect' | 'versions' | 'manual' | 'diagnostics'

const SAVE_LABEL: Record<Saved, string> = {
  saved: 'Salvo',
  draft: 'Rascunho salvo (ainda sem arquivo)',
  saving: 'Salvando…',
  unsaved: 'Alterações não salvas',
  error: 'Erro ao salvar'
}

function readTheme(): Theme {
  try {
    const t = localStorage.getItem('theme')
    if (t === 'light' || t === 'night' || t === 'midnight' || t === 'auto') return t
  } catch {
    /* storage can be unavailable */
  }
  return 'auto'
}

const THEME_LABEL: Record<Theme, string> = {
  auto: 'Automático (segue o Windows)',
  light: 'Claro',
  night: 'Noite',
  midnight: 'Meia-noite'
}

/** Windows' own light or dark setting, which the automatic theme follows. */
function useSystemDark(): boolean {
  const [dark, setDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const on = (e: MediaQueryListEvent): void => setDark(e.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return dark
}

/** A round button showing a sun on a light screen and a moon on a dark one; it flips between the two. */
function ThemeToggle(props: { value: Theme; onChange(t: Theme): void }): JSX.Element {
  const systemDark = useSystemDark()
  const dark = isDark(props.value, systemDark)
  const label = dark ? 'Mudar para tema claro' : 'Mudar para tema escuro'
  return (
    <button className="theme-toggle" aria-label={label} title={label} onClick={() => props.onChange(toggleTheme(props.value, systemDark))}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {dark ? (
          <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
        ) : (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
          </>
        )}
      </svg>
    </button>
  )
}

/** True when the system language is Portuguese: Brazil prints on A4. */
function isBrazilian(): boolean {
  try {
    return navigator.language.toLowerCase().startsWith('pt')
  } catch {
    return false
  }
}

/** True while the window is narrow (or heavily zoomed): the toolbar moves its secondary actions into "Mais". */
function useNarrow(maxWidth: number): boolean {
  const [narrow, setNarrow] = useState(() => window.matchMedia(`(max-width: ${maxWidth}px)`).matches)
  useEffect(() => {
    const m = window.matchMedia(`(max-width: ${maxWidth}px)`)
    const on = (): void => setNarrow(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [maxWidth])
  return narrow
}

function baseName(path: string | null): string {
  if (!path) return ''
  return path.split(/[\\/]/).pop()?.replace(/\.(rottera|rotera)$/, '') ?? ''
}

function Popover(props: { label: string; children: ReactNode }): JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as globalThis.Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])
  return (
    <div className="popover" ref={ref}>
      <button className="btn ghost" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {props.label} <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="popover-panel" onClick={(e) => (e.target as HTMLElement).closest('[data-close]') && setOpen(false)}>
          {props.children}
        </div>
      )}
    </div>
  )
}

/** One row of the scene navigator. Memoised on plain values so that typing in a long script does not re-render thousands of rows. */
const SceneRow = memo(function SceneRow(props: {
  n: number
  index: number
  label: string
  text: string
  page: number
  active: boolean
  last: boolean
  dragging: boolean
  onFocusBlock(index: number): void
  onMove(from: number, to: number): void
  onDragStart(n: number | null): void
  onDropOn(n: number): void
}): JSX.Element {
  const { n, index, label, text, page, active, last, dragging } = props
  return (
    <li
      className={dragging ? 'dragging' : undefined}
      draggable
      onDragStart={() => props.onDragStart(n)}
      onDragEnd={() => props.onDragStart(null)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => props.onDropOn(n)}
    >
      <button
        className={active ? 'scene active' : 'scene'}
        aria-label={`Cena ${label}: ${text === '(cabeçalho vazio)' ? 'sem cabeçalho' : text.toLowerCase()}, página ${page}`}
        aria-current={active ? 'true' : undefined}
        onClick={() => props.onFocusBlock(index)}
      >
        <b>{label}</b>
        <span className="scene-text">{text}</span>
        <small>p. {page}</small>
      </button>
      <span className="scene-move">
        <button className="icon" aria-label={`Subir cena ${n + 1}`} disabled={n === 0} onClick={() => props.onMove(n, n - 1)}>
          ↑
        </button>
        <button className="icon" aria-label={`Descer cena ${n + 1}`} disabled={last} onClick={() => props.onMove(n, n + 1)}>
          ↓
        </button>
      </span>
    </li>
  )
})

export function App(): JSX.Element {
  const [view, setView] = useState<'home' | 'editor'>('home')
  const [panel, setPanel] = useState<Panel>('script')
  const panelRef = useRef<Panel>('script')
  panelRef.current = panel
  const [docKey, setDocKey] = useState(0)
  const [initial, setInitial] = useState<Block[]>(emptyScript().blocks)
  const [blocks, setBlocks] = useState<Block[]>(emptyScript().blocks)
  const [titlePage, setTitlePage] = useState<TitlePage>(emptyScript().titlePage)
  const [board, setBoardState] = useState<Board>({ lanes: [], beats: [] })
  const [storyboard, setStoryboardState] = useState<Storyboard>(emptyStoryboard())
  const [lightMaps, setLightMapsState] = useState<LightMap[]>([])
  const [paper, setPaperState] = useState<Paper>('letter')
  const [characters, setCharactersState] = useState<CharacterSheet[]>([])
  const [extras, setExtras] = useState<Extras | undefined>(undefined)
  const [revision, setRevision] = useState<RevisionState>({ mode: false, color: 'azul' })
  const [scenesLocked, setScenesLocked] = useState(false)
  const [numberScenes, setNumberScenes] = useState(false)
  const [path, setPath] = useState<string | null>(null)
  const [saved, setSaved] = useState<Saved>('saved')
  const savedRef = useRef<Saved>('saved')
  savedRef.current = saved
  const [caret, setCaret] = useState<CaretInfo>({ kind: 'scene_heading', block: 0, dual: false })
  const [navigator, setNavigator] = useState(true)
  const [theme, setTheme] = useState<Theme>(readTheme)
  const [recent, setRecent] = useState<RecentItem[]>([])
  const [hasDraft, setHasDraft] = useState(false)
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogName>(null)
  const [findOpen, setFindOpen] = useState(false)
  const [ready, setReady] = useState(0)
  const [claudeActive, setClaudeActive] = useState(false)
  const [dragScene, setDragScene] = useState<number | null>(null)
  const narrow = useNarrow(1000)

  const handle = useRef<EditorHandle | null>(null)
  const scriptRef = useRef<Script>(emptyScript())
  const pathRef = useRef<string | null>(null)
  const timer = useRef<number | null>(null)
  const claudeTimer = useRef<number | null>(null)

  scriptRef.current = { titlePage, blocks, board, storyboard, lightMaps, paper, characters, extras, revision, scenesLocked, numberScenes }
  pathRef.current = path

  // ------------------------------------------------------------ theme
  useEffect(() => {
    if (theme === 'auto') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('theme', theme)
    } catch {
      /* ignore */
    }
  }, [theme])

  useEffect(() => {
    const name = titlePage.title || baseName(path) || 'Sem título'
    document.title = view === 'editor' ? `${name} — Rottera` : 'Rottera'
  }, [view, titlePage.title, path])

  const flash = useCallback((text: string) => {
    setMessage(text)
    window.setTimeout(() => setMessage((m) => (m === text ? null : m)), 5000)
  }, [])

  // errors in the page go to the event log that "Copiar diagnóstico" shows (scrubbed in the main process)
  useEffect(() => {
    const onError = (e: ErrorEvent): void => void window.api.logError(`${e.message} (${e.filename ? 'em um script da tela' : ''})`).catch(() => undefined)
    const onRejection = (e: PromiseRejectionEvent): void =>
      void window.api.logError(`promessa rejeitada: ${e.reason instanceof Error ? e.reason.message : String(e.reason)}`).catch(() => undefined)
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  // ------------------------------------------------------------ home data
  const refreshHome = useCallback(async () => {
    setRecent(await window.api.recentList())
    setSession(await window.api.sessionInfo())
    setHasDraft((await window.api.draftLoad()) !== null)
  }, [])

  useEffect(() => {
    void refreshHome()
  }, [refreshHome])

  // the first page of the last script and its page count, for the home screen; null falls back to its title
  const [preview, setPreview] = useState<{ path: string; lines: PageLine[]; pages: number; paper: Paper } | null>(null)
  const lastPath = recent[0]?.path
  useEffect(() => {
    if (view !== 'home' || !lastPath) return setPreview(null)
    let live = true
    void window.api.peekScript(lastPath).then((s) => {
      if (!live) return
      if (!s) return setPreview(null)
      const paper = s.paper ?? 'letter'
      const { pages } = paginate(s.blocks, paper)
      setPreview({ path: lastPath, paper, lines: pages[0] ?? [], pages: pages.length })
    })
    return () => {
      live = false
    }
  }, [view, lastPath])

  // ------------------------------------------------------------ saving
  const saveNow = useCallback(async (forceDialog = false): Promise<void> => {
    const script = scriptRef.current
    const live = handle.current?.getBlocks()
    const toSave: Script = live ? { ...script, blocks: live } : script
    setSaved('saving')
    try {
      const name = toSave.titlePage.title || baseName(pathRef.current) || 'Sem título'
      if (!forceDialog && !pathRef.current) {
        await window.api.draftSave(toSave)
        setSaved('draft')
        return
      }
      const p = await window.api.saveFile(forceDialog ? null : pathRef.current, toSave, name)
      if (p) {
        setPath(p)
        pathRef.current = p
        await window.api.draftClear()
        setSaved('saved')
      } else {
        setSaved('unsaved')
      }
    } catch {
      setSaved('error')
    }
  }, [])

  const scheduleAutosave = useCallback(() => {
    setSaved('unsaved')
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      timer.current = null
      void saveNow(false)
    }, 1500)
  }, [saveNow])

  /** Writes any edit still waiting for the autosave timer. Call before replacing the open script. */
  const flushPending = useCallback(async (): Promise<void> => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
      await saveNow(false)
    }
  }, [saveNow])

  const onChange = useCallback(
    (b: Block[]) => {
      setBlocks(b)
      scheduleAutosave()
    },
    [scheduleAutosave]
  )

  const setBoard = useCallback(
    (b: Board) => {
      scriptRef.current = { ...scriptRef.current, board: b }
      setBoardState(b)
      scheduleAutosave()
    },
    [scheduleAutosave]
  )

  const setStoryboard = useCallback(
    (sb: Storyboard) => {
      scriptRef.current = { ...scriptRef.current, storyboard: sb }
      setStoryboardState(sb)
      scheduleAutosave()
    },
    [scheduleAutosave]
  )

  const setLightMaps = useCallback(
    (maps: LightMap[]) => {
      scriptRef.current = { ...scriptRef.current, lightMaps: maps }
      setLightMapsState(maps)
      scheduleAutosave()
    },
    [scheduleAutosave]
  )

  const setCharacters = useCallback(
    (sheets: CharacterSheet[]) => {
      scriptRef.current = { ...scriptRef.current, characters: sheets }
      setCharactersState(sheets)
      scheduleAutosave()
    },
    [scheduleAutosave]
  )

  // ------------------------------------------------------------ open, new, import
  const openScript = useCallback((s: Script, p: string | null) => {
    handle.current = null
    setInitial(s.blocks)
    setBlocks(s.blocks)
    setTitlePage(s.titlePage)
    setBoardState(s.board ?? { lanes: [], beats: [] })
    setStoryboardState(s.storyboard ?? emptyStoryboard())
    setLightMapsState(s.lightMaps ?? [])
    setCharactersState(s.characters ?? [])
    // files made before the paper option are letter; new scripts follow the system language (A4 for Brazil)
    setPaperState(s.paper ?? (p === null && isBrazilian() ? 'a4' : 'letter'))
    setExtras(s.extras)
    setRevision(s.revision ?? { mode: false, color: 'azul' })
    setScenesLocked(s.scenesLocked === true)
    setNumberScenes(s.numberScenes === true)
    setPath(p)
    pathRef.current = p
    setSaved('saved')
    setCaret({ kind: s.blocks[0]?.kind ?? 'scene_heading', block: 0, dual: false })
    setPanel('script')
    setFindOpen(false)
    setDocKey((k) => k + 1)
    setView('editor')
  }, [])

  /** Opens a script after saving whatever the current one still has pending. */
  const loadScript = useCallback(
    async (s: Script, p: string | null): Promise<void> => {
      await flushPending()
      openScript(s, p)
    },
    [flushPending, openScript]
  )

  const doNew = useCallback(() => void loadScript(emptyScript(), null), [loadScript])

  const doOpen = useCallback(async () => {
    try {
      const r = await window.api.openFile()
      if (r) await loadScript(r.script, r.path)
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Não foi possível abrir o arquivo.')
    }
  }, [loadScript, flash])

  const doOpenRecent = useCallback(
    async (item: RecentItem) => {
      try {
        const r = await window.api.readFile(item.path)
        await loadScript(r.script, r.path)
      } catch {
        await window.api.recentForget(item.path)
        flash('Não foi possível abrir este arquivo. Ele foi removido da lista.')
        void refreshHome()
      }
    },
    [loadScript, flash, refreshHome]
  )

  const doImport = useCallback(async () => {
    try {
      const r = await window.api.importFile()
      if (!r) return
      const s = r.script
      if (!s.titlePage.title) s.titlePage.title = r.name
      await loadScript(s, null)
      flash('Roteiro importado. Use Salvar para criar o arquivo.')
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Não foi possível importar o arquivo.')
    }
  }, [loadScript, flash])

  const doRestoreDraft = useCallback(async () => {
    const d = await window.api.draftLoad()
    if (d) await loadScript(d, null)
  }, [loadScript])

  const doRestoreVersion = useCallback(
    async (id: string) => {
      try {
        await flushPending()
        const s = await window.api.backupsRestore(pathRef.current, id)
        setDialog(null)
        await loadScript(s, pathRef.current)
        scheduleAutosave()
        flash('Versão restaurada. O texto de antes continua na lista de versões.')
      } catch (e) {
        flash(e instanceof Error ? e.message : 'Não foi possível restaurar essa versão.')
      }
    },
    [flushPending, loadScript, scheduleAutosave, flash]
  )

  /** Numbers only: no script text, no file names. The main process adds versions and recent errors. */
  const buildDiagnostics = useCallback(async (): Promise<string> => {
    const open = handle.current !== null
    const s = scriptRef.current
    const live = handle.current?.getBlocks() ?? s.blocks
    return window.api.diagnostics({
      path: pathRef.current,
      script: open
        ? {
            open: true,
            saved: SAVE_LABEL[savedRef.current],
            blocks: live.length,
            scenes: live.filter((b) => b.kind === 'scene_heading').length,
            pages: paginate(live, s.paper).pages.length,
            paper: s.paper ?? 'letter',
            beats: s.board?.beats.length ?? 0,
            frames: s.storyboard?.frames.length ?? 0,
            lightMaps: s.lightMaps?.length ?? 0,
            characters: s.characters?.length ?? 0
          }
        : null,
      view: {
        panel: open ? panelRef.current : 'início',
        theme: readTheme(),
        width: window.innerWidth,
        height: window.innerHeight,
        zoom: Math.round(window.devicePixelRatio * 100) / 100
      }
    })
  }, [])

  const doExport = useCallback(
    async (format: 'pdf' | 'storyboard-pdf' | 'lightmap-pdf' | 'characters-pdf' | 'fdx' | 'fountain') => {
      try {
        const s = { ...scriptRef.current, blocks: handle.current?.getBlocks() ?? scriptRef.current.blocks }
        const p = await window.api.exportFile(format, s, s.titlePage.title || baseName(pathRef.current) || 'Sem título')
        if (p) flash(`Exportado: ${p.split(/[\\/]/).pop()}`)
      } catch {
        flash('Não foi possível exportar.')
      }
    },
    [flash]
  )

  const doPreview = useCallback(async () => {
    try {
      const s = { ...scriptRef.current, blocks: handle.current?.getBlocks() ?? scriptRef.current.blocks }
      await window.api.previewPdf(s, s.titlePage.title || baseName(pathRef.current) || 'Sem título')
    } catch {
      flash('Não foi possível montar a visualização.')
    }
  }, [flash])

  const goHome = useCallback(async () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    if (view === 'editor') await saveNow(false)
    handle.current = null
    await refreshHome()
    setView('home')
  }, [view, saveNow, refreshHome])

  // ------------------------------------------------------------ editor settings
  const onCaret = useCallback((c: CaretInfo) => setCaret(c), [])
  const onReady = useCallback((h: EditorHandle) => {
    handle.current = h
    setReady((n) => n + 1)
  }, [])

  useEffect(() => {
    handle.current?.setView({
      showNumbers: numberScenes,
      locked: scenesLocked,
      revMode: revision.mode,
      revColor: revision.color,
      paper
    })
  }, [numberScenes, scenesLocked, revision, paper, ready, docKey])

  // ------------------------------------------------------------ find
  const openFind = useCallback(() => {
    if (view !== 'editor') return
    setPanel('script')
    setFindOpen(true)
  }, [view])

  // ------------------------------------------------------------ scene operations
  const applyBlocks = useCallback((next: Block[], focusBlock?: number) => {
    const h = handle.current
    if (!h) return
    h.replaceRange(0, h.getBlocks().length, next, { noRev: true })
    if (focusBlock !== undefined) h.focusBlock(focusBlock)
  }, [])

  const moveSceneAction = useCallback(
    (from: number, to: number) => {
      const h = handle.current
      if (!h) return
      const next = moveSceneTo(h.getBlocks(), from, to)
      if (!next) return
      applyBlocks(next, sceneRanges(next)[to]?.start)
    },
    [applyBlocks]
  )
  // stable handles for the memoised navigator rows: they always call the latest closure
  const moveSceneRef = useRef(moveSceneAction)
  moveSceneRef.current = moveSceneAction
  const dragSceneRef = useRef<number | null>(null)
  dragSceneRef.current = dragScene
  const moveSceneStable = useCallback((from: number, to: number) => moveSceneRef.current(from, to), [])
  const focusSceneBlock = useCallback((index: number) => handle.current?.focusBlock(index), [])
  const dropOnScene = useCallback((to: number) => {
    const from = dragSceneRef.current
    if (from !== null) moveSceneRef.current(from, to)
    setDragScene(null)
  }, [])

  const toggleLock = useCallback(() => {
    const h = handle.current
    if (!h) return
    const bs = h.getBlocks()
    applyBlocks(scenesLocked ? unlockScenes(bs) : lockScenes(bs), caret.block)
    setScenesLocked(!scenesLocked)
    scheduleAutosave()
  }, [scenesLocked, caret.block, applyBlocks, scheduleAutosave])

  const clearRevisions = useCallback(() => {
    const h = handle.current
    if (!h) return
    const bs = h.getBlocks().map((b) => {
      if (b.rev === undefined) return b
      const { rev: _r, ...rest } = b
      return rest
    })
    applyBlocks(bs, caret.block)
    flash('Marcas de revisão removidas.')
  }, [applyBlocks, caret.block, flash])

  const renameInScript = useCallback(
    (kind: 'characters' | 'locations', from: string, to: string): number => {
      const h = handle.current
      if (!h) return 0
      const bs = h.getBlocks()
      const r = kind === 'characters' ? renameCharacter(bs, from, to) : renameLocation(bs, from, to)
      for (let i = bs.length - 1; i >= 0; i--) {
        if (r.blocks[i] !== bs[i]) h.replaceRange(i, i + 1, [r.blocks[i]])
      }
      if (kind === 'characters') {
        const fromKey = characterKey(from)
        const sheets = scriptRef.current.characters ?? []
        if (sheets.some((c) => characterKey(c.name) === fromKey)) {
          setCharacters(sheets.map((c) => (characterKey(c.name) === fromKey ? { ...c, name: to.trim() } : c)))
        }
      }
      if (extras) {
        const f = from.trim().toUpperCase()
        setExtras({
          ...extras,
          [kind]: extras[kind].map((v) => (v.trim().toUpperCase() === f ? to.trim().toUpperCase() : v))
        })
      }
      return r.count
    },
    [extras, setCharacters]
  )

  const toggleDualDialogue = useCallback(() => {
    if (!handle.current?.toggleDual()) {
      flash('Para criar diálogo duplo, coloque o cursor numa fala que venha logo depois de outra fala.')
    }
  }, [flash])

  /** Creates scenes for beats that have none (all of them, or just `only`). Beats that already have a scene are left alone. */
  const sendBeatsToScript = useCallback(
    (only?: string[]) => {
      const h = handle.current
      if (!h) return
      const board = scriptRef.current.board ?? { lanes: [], beats: [] }
      const r = sendBeats(board, h.getBlocks(), only)
      if (r.created.length === 0) {
        flash('Todos esses beats já têm cena.')
        return
      }
      h.replaceRange(0, h.getBlocks().length, r.blocks, { noRev: true })
      const first = beatLinks(r.blocks, board).get(r.created[0])
      if (only && first) {
        setPanel('script')
        window.setTimeout(() => h.focusBlock(first.block), 0)
      }
      flash(r.created.length === 1 ? 'Cena criada e ligada ao beat.' : `${r.created.length} cenas criadas e ligadas aos beats.`)
    },
    [flash]
  )

  const makeSceneFromBeat = useCallback((beat: Beat) => sendBeatsToScript([beat.id]), [sendBeatsToScript])

  const goToSceneBlock = useCallback((block: number) => {
    setPanel('script')
    window.setTimeout(() => handle.current?.focusBlock(block), 0)
  }, [])

  const pickTemplate = useCallback(
    (t: Template) => {
      setDialog(null)
      void loadScript(t.make(), null)
    },
    [loadScript]
  )

  // ------------------------------------------------------------ menu from the main process
  useEffect(() => {
    return window.api.onMenu((a: MenuAction) => {
      switch (a) {
        case 'new': return doNew()
        case 'new-template': return setDialog('templates')
        case 'open': return void doOpen()
        case 'save': return void saveNow(!pathRef.current)
        case 'save-as': return void saveNow(true)
        case 'import': return void doImport()
        case 'export-pdf': return void doExport('pdf')
        case 'preview-pdf': return void doPreview()
        case 'export-fdx': return void doExport('fdx')
        case 'export-fountain': return void doExport('fountain')
        case 'title-page': return setDialog('title')
        case 'versions': return handle.current ? setDialog('versions') : undefined
        case 'manual': return setDialog('manual')
        case 'diagnostics': return setDialog('diagnostics')
        case 'toggle-navigator': return setNavigator((v) => !v)
        case 'theme-auto': return setTheme('auto')
        case 'theme-light': return setTheme('light')
        case 'theme-night': return setTheme('night')
        case 'theme-midnight': return setTheme('midnight')
        case 'home': return void goHome()
        case 'find': return openFind()
        case 'smarttype': return setDialog('smarttype')
        case 'view-script': return setPanel('script')
        case 'view-board': return setPanel('board')
        case 'view-storyboard': return setPanel('storyboard')
        case 'view-lightmap': return setPanel('lightmap')
        case 'export-lightmap': return void doExport('lightmap-pdf')
        case 'export-characters': return void doExport('characters-pdf')
        case 'export-storyboard': return void doExport('storyboard-pdf')
        case 'view-reports': return setPanel('reports')
        case 'claude': return setDialog('connect')
      }
    })
  }, [doNew, doOpen, saveNow, doImport, doExport, doPreview, goHome, openFind])

  // the main process asks for a flush before it closes the window
  useEffect(() => {
    return window.api.onFlushRequest(() => {
      void flushPending().finally(() => void window.api.flushDone())
    })
  }, [flushPending])

  // ------------------------------------------------------------ Claude bridge
  const bridge = useMemo(
    () =>
      createBridgeHandler({
        handle: () => handle.current,
        script: () => scriptRef.current,
        path: () => pathRef.current,
        setTitlePage: (t) => {
          scriptRef.current = { ...scriptRef.current, titlePage: t }
          setTitlePage(t)
          scheduleAutosave()
        },
        setBoard,
        setStoryboard,
        setLightMaps,
        setCharacters,
        save: () => saveNow(false),
        touched: () => {
          setMessage('O Claude editou o roteiro. Ctrl+Z desfaz.')
          window.setTimeout(() => setMessage((m) => (m?.startsWith('O Claude') ? null : m)), 4000)
        }
      }),
    [setBoard, setStoryboard, setLightMaps, setCharacters, saveNow, scheduleAutosave]
  )

  useEffect(() => {
    return window.api.onBridge((req) => {
      bridge(req.method, req.params).then(
        (result) => void window.api.bridgeReply({ id: req.id, result }),
        (e: unknown) =>
          void window.api.bridgeReply({ id: req.id, error: e instanceof Error ? e.message : 'Erro desconhecido.' })
      )
    })
  }, [bridge])

  useEffect(() => {
    return window.api.onBridgeActivity(() => {
      setClaudeActive(true)
      if (claudeTimer.current !== null) window.clearTimeout(claudeTimer.current)
      claudeTimer.current = window.setTimeout(() => setClaudeActive(false), 60000)
    })
  }, [])

  // ------------------------------------------------------------ derived
  const pagination = useMemo(() => paginate(blocks, paper), [blocks, paper])
  const numbers = useMemo(() => sceneNumbers(blocks, scenesLocked), [blocks, scenesLocked])
  const scenes = useMemo(
    () =>
      sceneRanges(blocks).map((r, n) => ({
        n,
        index: r.start,
        end: r.end,
        number: numbers[r.start] ?? String(n + 1),
        text: blocks[r.start].text.trim() || '(cabeçalho vazio)',
        page: (pagination.blockPage[r.start] ?? 0) + 1
      })),
    [blocks, numbers, pagination]
  )
  const activeScene = scenes.findIndex((s) => caret.block >= s.index && caret.block < s.end)
  const currentPage = (pagination.blockPage[caret.block] ?? 0) + 1
  const words = useMemo(
    () => blocks.reduce((n, b) => n + (b.text.trim() ? b.text.trim().split(/\s+/).length : 0), 0),
    [blocks]
  )

  // ------------------------------------------------------------ render
  if (view === 'home') {
    const [last, ...older] = recent
    const sheet = preview && last && preview.path === last.path ? preview : null
    return (
      <div className="home">
        <header className="home-head">
          <div>
            <h1 className="wordmark">
              Rottera
              <svg className="wordmark-clapper" viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
                <rect x="4" y="12" width="24" height="16" rx="1.5" />
                <path d="M4 16h24M8 12l-2 4M14 12l-2 4M20 12l-2 4M26 12l-2 4" />
                <g transform="rotate(-14 4 11)">
                  <rect x="4" y="7" width="24" height="4" rx="0.5" />
                  <path d="M9 7l-2 4M15 7l-2 4M21 7l-2 4M27 7l-2 4" />
                </g>
              </svg>
            </h1>
            <p className="muted">Escreva. O formato e as cópias de segurança ficam com a gente.</p>
          </div>
          <ThemeToggle value={theme} onChange={setTheme} />
        </header>
        {session?.crashed && (
          <div className="banner" role="status">
            <span>
              O Rottera não foi fechado normalmente da última vez.
              {session.lastPath ? ` Seu trabalho está salvo; confira “${session.lastName}”.` : ' Veja se há um rascunho abaixo.'}
            </span>
            {session.lastPath && (
              <button
                className="btn secondary"
                onClick={() => {
                  const p = session.lastPath as string
                  setSession(null)
                  void window.api.readFile(p).then((r) => loadScript(r.script, r.path)).catch(() => flash('Não encontrei esse arquivo.'))
                }}
              >
                Abrir “{session.lastName}”
              </button>
            )}
            <button className="btn ghost" onClick={() => setSession(null)}>
              Dispensar
            </button>
          </div>
        )}
        {hasDraft && (
          <div className="banner" role="status">
            <span>Há um rascunho sem arquivo da última sessão.</span>
            <button className="btn secondary" onClick={() => void doRestoreDraft()}>Recuperar rascunho</button>
          </div>
        )}
        <div className="home-main">
          <figure className="home-page">
            {last ? (
              <button className={sheet ? 'title-page script' : 'title-page'} onClick={() => void doOpenRecent(last)} title={last.path}>
                {sheet ? (
                  <ScriptPage lines={sheet.lines} paper={sheet.paper} />
                ) : (
                  <span className="title-page-title">{last.name}</span>
                )}
                <span className="title-page-action">Continuar escrevendo</span>
              </button>
            ) : (
              <button className="title-page script" onClick={doNew}>
                <ScriptPage lines={[]} paper="letter" caret />
                <span className="title-page-action">Começar um roteiro</span>
              </button>
            )}
            <figcaption className="muted">
              {last ? (
                <>
                  {sheet && <strong className="home-page-name">{last.name}</strong>}
                  {sheet && (
                    <span className="home-page-count">{sheet.pages === 1 ? '1 página' : `${sheet.pages} páginas`}</span>
                  )}
                  Aberto {whenOpened(last.openedAt)}
                  {folderOf(last.path) && <>, na pasta {folderOf(last.path)}</>}
                </>
              ) : (
                'Seus roteiros aparecem aqui depois que você abrir ou salvar um.'
              )}
            </figcaption>
          </figure>
          <div className="home-side">
            <div className="home-actions">
              <button className="btn secondary" onClick={doNew}>Novo roteiro</button>
              <button className="btn secondary" onClick={() => setDialog('templates')}>Novo a partir de modelo…</button>
              <button className="btn secondary" onClick={() => void doOpen()}>Abrir…</button>
              <button className="btn secondary" onClick={() => void doImport()}>Importar FDX ou Fountain…</button>
            </div>
            {older.length > 0 && (
              <section aria-labelledby="recent-heading">
                <h2 id="recent-heading">Recentes</h2>
                <ul className="recent">
                  {older.map((r) => (
                    <li key={r.path}>
                      <button className="recent-item" onClick={() => void doOpenRecent(r)} title={r.path}>
                        <strong>{r.name}</strong>
                        <span className="muted">
                          {folderOf(r.path) && <>{folderOf(r.path)}, </>}
                          {whenOpened(r.openedAt)}
                        </span>
                      </button>
                      <button
                        className="icon recent-forget"
                        aria-label={`Tirar “${r.name}” da lista`}
                        title="Tirar da lista. O arquivo continua onde está."
                        onClick={() => void window.api.recentForget(r.path).then(refreshHome)}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <p className="home-links">
              <button className="btn ghost" onClick={() => setDialog('connect')}>Conectar ao Claude…</button>
              <button className="btn ghost" onClick={() => setDialog('manual')}>Manual</button>
            </p>
          </div>
        </div>
        {message && <div className="toast" role="status">{message}</div>}
        {dialog === 'templates' && <TemplatesDialog onPick={pickTemplate} onClose={() => setDialog(null)} />}
        {dialog === 'connect' && <ConnectDialog onClose={() => setDialog(null)} onCopied={() => flash('Copiado.')} />}
        {dialog === 'manual' && <ManualDialog onClose={() => setDialog(null)} />}
        {dialog === 'diagnostics' && <DiagnosticsDialog build={buildDiagnostics} onCopied={() => flash('Diagnóstico copiado.')} onClose={() => setDialog(null)} />}
      </div>
    )
  }

  const revText = revision.mode ? `Revisão ${revisionLabel(revision.color)}` : ''

  return (
    <div className="app">
      <div className="toolbar" role="toolbar" aria-label="Ferramentas">
        <button className="btn ghost" onClick={() => void goHome()}>Início</button>
        <label className="sr-only" htmlFor="kind">Elemento</label>
        <select id="kind" value={caret.kind} onChange={(e) => handle.current?.setKind(e.target.value as Kind)}>
          {ELEMENT_OPTIONS.map((o) => (
            <option key={o.kind} value={o.kind}>
              {o.label} ({o.shortcut})
            </option>
          ))}
        </select>
        <div className="seg" role="group" aria-label="Visão">
          <button className="btn ghost" aria-pressed={panel === 'script'} onClick={() => setPanel('script')}>Roteiro</button>
          <button className="btn ghost" aria-pressed={panel === 'board'} onClick={() => setPanel('board')}>Beat Board</button>
          <button className="btn ghost" aria-pressed={panel === 'storyboard'} onClick={() => setPanel('storyboard')}>Storyboard</button>
          <button className="btn ghost" aria-pressed={panel === 'lightmap'} onClick={() => setPanel('lightmap')}>Mapa de Luz</button>
          <button className="btn ghost" aria-pressed={panel === 'reports'} onClick={() => setPanel('reports')}>Relatórios</button>
        </div>
        {!narrow && (
          <>
            <button className="btn ghost" onClick={() => setNavigator((v) => !v)} aria-pressed={navigator}>Navegador</button>
            <button className="btn ghost" onClick={openFind}>Localizar</button>
            <button className="btn ghost" aria-pressed={caret.dual} title="Ctrl+D" onClick={toggleDualDialogue}>
              Diálogo duplo
            </button>
          </>
        )}
        <Popover label="Produção">
          <label className="check">
            <input
              type="checkbox"
              checked={revision.mode}
              onChange={(e) => setRevision({ ...revision, mode: e.target.checked })}
            />
            Modo de revisão
          </label>
          <label className="stack" htmlFor="rev-color">Cor da revisão</label>
          <select id="rev-color" value={revision.color} onChange={(e) => setRevision({ ...revision, color: e.target.value })}>
            {REVISIONS.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
          <button className="btn ghost" data-close onClick={clearRevisions}>Limpar marcas de revisão</button>
          <hr />
          <label className="check">
            <input type="checkbox" checked={numberScenes} onChange={(e) => setNumberScenes(e.target.checked)} />
            Mostrar números de cena
          </label>
          <label className="check">
            <input type="checkbox" checked={scenesLocked} onChange={toggleLock} />
            Travar numeração (novas cenas viram 3A, 3B…)
          </label>
        </Popover>
        <Popover label="Mais">
          {narrow && (
            <>
              <button className="btn ghost" data-close onClick={() => setNavigator((v) => !v)} aria-pressed={navigator}>
                {navigator ? 'Ocultar navegador de cenas' : 'Mostrar navegador de cenas'}
              </button>
              <button className="btn ghost" data-close onClick={openFind}>Localizar e substituir…</button>
              <button className="btn ghost" data-close aria-pressed={caret.dual} onClick={toggleDualDialogue}>
                Diálogo duplo (Ctrl+D)
              </button>
              <button className="btn ghost" data-close onClick={() => void doPreview()}>Visualizar impressão</button>
              <label className="stack" htmlFor="theme-select-narrow">Tema</label>
              <select id="theme-select-narrow" value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
                {(Object.keys(THEME_LABEL) as Theme[]).map((t) => (
                  <option key={t} value={t}>{THEME_LABEL[t]}</option>
                ))}
              </select>
              <hr />
            </>
          )}
          <label className="stack" htmlFor="paper-select">Papel do PDF</label>
          <select
            id="paper-select"
            value={paper}
            onChange={(e) => {
              setPaperState(e.target.value as Paper)
              scheduleAutosave()
            }}
          >
            <option value="a4">A4 (21 × 29,7 cm)</option>
            <option value="letter">Carta / Letter (21,6 × 27,9 cm)</option>
          </select>
          <hr />
          <button className="btn ghost" data-close onClick={() => setDialog('title')}>Página de título…</button>
          <button className="btn ghost" data-close onClick={() => setDialog('versions')}>Versões anteriores…</button>
          <button className="btn ghost" data-close onClick={() => setDialog('smarttype')}>Gerenciar SmartType…</button>
          <button className="btn ghost" data-close onClick={() => void doExport('storyboard-pdf')}>Exportar só o storyboard (PDF)…</button>
          <button className="btn ghost" data-close onClick={() => void doExport('lightmap-pdf')}>Exportar só os mapas de luz (PDF)…</button>
          <button className="btn ghost" data-close onClick={() => void doExport('characters-pdf')}>Exportar só as fichas de personagem (PDF)…</button>
          <button className="btn ghost" data-close onClick={() => void doExport('fdx')}>Exportar FDX…</button>
          <button className="btn ghost" data-close onClick={() => void doExport('fountain')}>Exportar Fountain…</button>
          <button className="btn ghost" data-close onClick={() => void doImport()}>Importar…</button>
          <button className="btn ghost" data-close onClick={() => setDialog('connect')}>Conectar ao Claude…</button>
          <button className="btn ghost" data-close onClick={() => setDialog('manual')}>Manual</button>
          <button className="btn ghost" data-close onClick={() => setDialog('diagnostics')}>Copiar diagnóstico…</button>
        </Popover>
        <span className="spacer" />
        {!narrow && <ThemeToggle value={theme} onChange={setTheme} />}
        {!narrow && (
          <button className="btn ghost" title="Visualizar impressão (Ctrl+Shift+P)" onClick={() => void doPreview()}>
            Visualizar
          </button>
        )}
        <button className="btn secondary" onClick={() => void doExport('pdf')}>Exportar PDF</button>
        <button className="btn primary" onClick={() => void saveNow(!path)}>{path ? 'Salvar' : 'Salvar como…'}</button>
      </div>

      {panel === 'script' && findOpen && (
        <FindBar
          handle={handle}
          onClose={() => {
            handle.current?.find('', false)
            setFindOpen(false)
            handle.current?.focus()
          }}
        />
      )}

      <div className={navigator && panel === 'script' ? 'body with-nav' : 'body'}>
        {navigator && panel === 'script' && (
          <aside className="nav" aria-label="Navegador de cenas">
            <h2>Cenas ({scenes.length})</h2>
            {scenes.length === 0 ? (
              <p className="muted">Nenhuma cena ainda. Comece com INT. ou EXT.</p>
            ) : (
              <ol>
                {scenes.map((s) => (
                  <SceneRow
                    key={s.index}
                    n={s.n}
                    index={s.index}
                    label={numberScenes || scenesLocked ? s.number : String(s.n + 1)}
                    text={s.text}
                    page={s.page}
                    active={s.n === activeScene}
                    last={s.n === scenes.length - 1}
                    dragging={dragScene === s.n}
                    onFocusBlock={focusSceneBlock}
                    onMove={moveSceneStable}
                    onDragStart={setDragScene}
                    onDropOn={dropOnScene}
                  />
                ))}
              </ol>
            )}
          </aside>
        )}
        <main className="canvas" aria-label="Área de trabalho">
          <div hidden={panel !== 'script'}>
            <Editor
              key={docKey}
              initial={initial}
              extras={extras}
              onChange={onChange}
              onCaret={onCaret}
              onReady={onReady}
            />
          </div>
          {panel === 'board' && (
            <BoardView
              board={board}
              onChange={setBoard}
              onMakeScene={makeSceneFromBeat}
              links={beatLinks(blocks, board)}
              onSendAll={() => sendBeatsToScript()}
              onGoToScene={goToSceneBlock}
            />
          )}
          {panel === 'storyboard' && (
            <StoryboardView
              storyboard={storyboard}
              scenes={scenes.map((sc) => ({ number: sc.number, text: sc.text }))}
              onChange={setStoryboard}
              onExport={() => void doExport('storyboard-pdf')}
              flash={flash}
            />
          )}
          {panel === 'lightmap' && (
            <LightMapView
              maps={lightMaps}
              scenes={scenes.map((sc) => ({ number: sc.number, text: sc.text }))}
              onChange={setLightMaps}
              onExport={() => void doExport('lightmap-pdf')}
            />
          )}
          {panel === 'reports' && (
            <ReportsView
              script={{ ...scriptRef.current, blocks }}
              onCharacters={setCharacters}
              onExportCharacters={() => void doExport('characters-pdf')}
              onExportPdf={(report, landscape) =>
                void window.api
                  .exportReportPdf({
                    ...report,
                    scriptTitle: titlePage.title || baseName(pathRef.current) || 'Sem título',
                    paper: paper === 'a4' ? 'a4' : 'letter',
                    landscape
                  })
                  .then((p) => p && flash(`Exportado: ${p.split(/[\\/]/).pop()}`))
                  .catch(() => flash('Não foi possível exportar o relatório.'))
              }
              flash={flash}
              onExport={(name, csv) =>
                void window.api.exportText(name, 'csv', csv).then((p) => p && flash(`Exportado: ${p.split(/[\\/]/).pop()}`))
              }
            />
          )}
        </main>
      </div>

      {/* Not a live region as a whole: a screen reader would read the whole bar at every keystroke.
          Only the element type and the save state are announced when they change. */}
      <div className="status" role="group" aria-label="Barra de status">
        <span>{LABELS[caret.kind]}</span>
        <span>Página {currentPage} de {pagination.pages.length}</span>
        <span>{words} palavras</span>
        {revText && <span className="pill">{revText}</span>}
        {scenesLocked && <span className="pill">Cenas travadas</span>}
        <span className="spacer" />
        {claudeActive && <span className="pill claude" role="status">Claude conectado</span>}
        <span role="status" aria-live="polite">{SAVE_LABEL[saved]}</span>
      </div>

      {message && <div className="toast" role="status">{message}</div>}

      {dialog === 'title' && (
        <TitleDialog
          value={titlePage}
          onClose={() => setDialog(null)}
          onSave={(t) => {
            setTitlePage(t)
            setDialog(null)
            scheduleAutosave()
          }}
        />
      )}
      {dialog === 'templates' && <TemplatesDialog onPick={pickTemplate} onClose={() => setDialog(null)} />}
      {dialog === 'smarttype' && (
        <SmartTypeDialog
          blocks={handle.current?.getBlocks() ?? blocks}
          extras={extras}
          onExtras={(e) => {
            setExtras(e)
            scheduleAutosave()
          }}
          onRename={renameInScript}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'connect' && <ConnectDialog onClose={() => setDialog(null)} onCopied={() => flash('Copiado.')} />}
      {dialog === 'versions' && <VersionsDialog path={path} onRestore={(id) => void doRestoreVersion(id)} onClose={() => setDialog(null)} />}
      {dialog === 'manual' && <ManualDialog onClose={() => setDialog(null)} />}
      {dialog === 'diagnostics' && <DiagnosticsDialog build={buildDiagnostics} onCopied={() => flash('Diagnóstico copiado.')} onClose={() => setDialog(null)} />}
    </div>
  )
}

function FindBar(props: { handle: React.MutableRefObject<EditorHandle | null>; onClose(): void }): JSX.Element {
  const [q, setQ] = useState('')
  const [r, setR] = useState('')
  const [cs, setCs] = useState(false)
  const [stat, setStat] = useState({ count: 0, current: 0 })
  const [note, setNote] = useState('')
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    input.current?.focus()
    input.current?.select()
  }, [])

  const run = (query: string, caseSensitive: boolean): void => {
    const h = props.handle.current
    if (!h) return
    setStat(h.find(query, caseSensitive))
    setNote('')
  }

  return (
    <div className="findbar" role="search">
      <label className="sr-only" htmlFor="f-q">Localizar</label>
      <input
        id="f-q"
        ref={input}
        placeholder="Localizar"
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          run(e.target.value, cs)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') setStat(props.handle.current?.findStep(e.shiftKey ? -1 : 1) ?? stat)
          if (e.key === 'Escape') props.onClose()
        }}
      />
      <label className="sr-only" htmlFor="f-r">Substituir por</label>
      <input
        id="f-r"
        placeholder="Substituir por"
        value={r}
        onChange={(e) => setR(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') props.onClose()
        }}
      />
      <label className="check">
        <input
          type="checkbox"
          checked={cs}
          onChange={(e) => {
            setCs(e.target.checked)
            run(q, e.target.checked)
          }}
        />
        Maiúsculas
      </label>
      <span className="muted" aria-live="polite">
        {q ? (stat.count === 0 ? 'Nada encontrado' : `${stat.current + 1} de ${stat.count}`) : ''}
      </span>
      <button className="btn ghost" onClick={() => setStat(props.handle.current?.findStep(-1) ?? stat)}>Anterior</button>
      <button className="btn ghost" onClick={() => setStat(props.handle.current?.findStep(1) ?? stat)}>Próximo</button>
      <button
        className="btn secondary"
        onClick={() => {
          const s = props.handle.current?.replaceCurrent(r)
          if (s) setStat(s)
        }}
      >
        Substituir
      </button>
      <button
        className="btn secondary"
        onClick={() => {
          const n = props.handle.current?.replaceAllHits(r) ?? 0
          setStat({ count: 0, current: 0 })
          setNote(`${n} substituída(s)`)
        }}
      >
        Substituir tudo
      </button>
      <span className="muted" role="status">{note}</span>
      <button className="btn ghost" aria-label="Fechar busca" onClick={props.onClose}>✕</button>
    </div>
  )
}
