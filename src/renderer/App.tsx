import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Beat, Block, Board, CharacterSheet, Extras, Kind, LightMap, Note, Paper, Production, RevisionState, Script, Storyboard, TableRead, TitlePage, Watermark } from '../shared/types'
import { emptyScript, emptyStoryboard } from '../shared/types'
import { LABELS } from '../shared/elements'
import { LONG_SCRIPT_BLOCKS, LONG_SCRIPT_DELAY, paginate, type PageLine } from '../shared/paginate'
import type { MenuAction, RecentItem, SessionInfo } from '../shared/api'
import { folderOf, whenOpened } from '../shared/recent'
import { isDark, toggleTheme, type Theme } from '../shared/theme'
import { lockScenes, moveSceneTo, sceneNumbers, sceneRanges, unlockScenes } from '../shared/scenes'
import { renameCharacter, renameLocation } from '../shared/rename'
import { beatLinks, sendBeats } from '../shared/beats'
import { characterKey } from '../shared/characters'
import { groupNotes, noteMarks } from '../shared/notes'
import { newId } from '../shared/structures'
import { NotesPanel } from './Notes'
import { ReadBar } from './ReadBar'
import { emptyProduction, sceneInfo } from '../shared/production'
import { printable, type Report } from '../shared/reports'
import { SYNOPSIS_MAX, cleanSynopsis } from '../shared/scriptfile'
import { ProductionView, type SceneLinks } from './Production'
import { REVISIONS, revisionLabel } from '../shared/revisions'
import type { Template } from '../shared/templates'
import { Editor, ELEMENT_OPTIONS, type CaretInfo, type EditorHandle } from './Editor'
import { BoardView } from './Board'
import { StoryboardView } from './Storyboard'
import { ScriptPage } from './ScriptPage'
import { LightMapView } from './LightMap'
import { ReportsView } from './Reports'
import { ConnectDialog, CopyFolderDialog, DiagnosticsDialog, ExportDialog, ManualDialog, SmartTypeDialog, TemplatesDialog, TitleDialog, VersionsDialog, WatermarkDialog } from './Dialogs'
import { createBridgeHandler } from './bridgeHandler'

type Saved = 'saved' | 'draft' | 'saving' | 'unsaved' | 'error'
type Panel = 'script' | 'board' | 'storyboard' | 'lightmap' | 'reports' | 'shooting'
type DialogName = null | 'title' | 'templates' | 'smarttype' | 'connect' | 'versions' | 'manual' | 'diagnostics' | 'watermark' | 'copyfolder' | 'export'

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

/** Toolbar buttons that move into "Mais" when the bar would need a second row, in the order they go. */
const FOLD_ORDER = ['theme', 'dual', 'preview', 'notes', 'nav', 'find', 'pdf'] as const
type FoldKey = (typeof FOLD_ORDER)[number]

/**
 * Keeps the toolbar to one row by moving buttons into "Mais", one at a time, while they do not fit. Each button's
 * width is remembered from when it was on the bar, so the result depends only on the bar's width and cannot flip
 * back and forth. Every control is followed by an 8px gap (margin in .toolbar-main, gap and reserve in .toolbar-end).
 */
function useToolbarFold(): { ref: (el: HTMLDivElement | null) => void; folded: (k: FoldKey) => boolean } {
  const [count, setCount] = useState(0)
  const widths = useRef(new Map<string, number>())
  const observer = useRef<ResizeObserver | null>(null)
  const ref = useCallback((bar: HTMLDivElement | null) => {
    observer.current?.disconnect()
    if (!bar) return
    const measure = (): void => {
      const s = getComputedStyle(bar)
      const room = bar.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight)
      let need = 0
      for (const el of bar.querySelectorAll<HTMLElement>('.toolbar-main > *, .toolbar-end > *')) {
        if (getComputedStyle(el).position === 'absolute') continue // the hidden label of the element list
        const w = el.getBoundingClientRect().width + 8
        if (el.dataset.fold) widths.current.set(el.dataset.fold, w)
        else need += w
      }
      for (const k of FOLD_ORDER) need += widths.current.get(k) ?? 0
      let n = 0
      while (n < FOLD_ORDER.length && need > room + 0.5) need -= widths.current.get(FOLD_ORDER[n++]) ?? 0
      setCount((p) => (p === n ? p : n))
    }
    observer.current = new ResizeObserver(measure)
    observer.current.observe(bar)
  }, [])
  const folded = useCallback((k: FoldKey) => FOLD_ORDER.indexOf(k) < count, [count])
  return { ref, folded }
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

const NO_LINKS: SceneLinks = { frames: 0, maps: [] }

/** Drops the scene link of the entries whose scene label changed, so they are linked again by the new label. */
function unlinkChanged<T extends { id: string; scene: string; sid?: string }>(prev: T[], next: T[]): T[] {
  const before = new Map(prev.map((x) => [x.id, x.scene]))
  return next.map((x) => {
    if (!x.sid || !before.has(x.id) || before.get(x.id) === x.scene) return x
    const copy = { ...x }
    delete copy.sid
    return copy
  })
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
  /** Storyboard frames and light maps of this scene (see the scene links in App). */
  frames: number
  maps: number
  firstMap: string | null
  /** The scene's synopsis, and whether it is being edited here. */
  syn: string
  editingSyn: boolean
  onEditSyn(index: number): void
  /** null = cancelled. */
  onSaveSyn(index: number, text: string | null): void
  onFocusBlock(index: number): void
  onMove(from: number, to: number): void
  onDragStart(n: number | null): void
  onDropOn(n: number): void
  onOpenStoryboard(label: string): void
  onOpenMap(id: string): void
}): JSX.Element {
  const { n, index, label, text, page, active, last, dragging, frames, maps, firstMap, syn, editingSyn } = props
  const cancelled = useRef(false)
  return (
    <li
      className={dragging ? 'dragging' : undefined}
      draggable={!editingSyn}
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
      {editingSyn ? (
        <textarea
          className="scene-syn-edit"
          aria-label={`Sinopse da cena ${label}`}
          defaultValue={syn}
          maxLength={SYNOPSIS_MAX}
          rows={2}
          placeholder="O que acontece nesta cena…"
          autoFocus
          onFocus={() => {
            cancelled.current = false
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              e.currentTarget.blur()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              cancelled.current = true
              e.currentTarget.blur()
            }
          }}
          onBlur={(e) => props.onSaveSyn(index, cancelled.current ? null : e.target.value)}
        />
      ) : syn ? (
        <button className="scene-syn" title="Sinopse (não sai no PDF). Clique para editar." aria-label={`Sinopse da cena ${label}: ${syn}. Editar`} onClick={() => props.onEditSyn(index)}>
          {syn}
        </button>
      ) : (
        <button className={active ? 'link scene-syn-add on' : 'link scene-syn-add'} aria-label={`Escrever sinopse da cena ${label}`} onClick={() => props.onEditSyn(index)}>
          + sinopse
        </button>
      )}
      {(frames > 0 || maps > 0) && (
        <span className="scene-links">
          {frames > 0 && (
            <button className="link" aria-label={`Storyboard da cena ${label}: ${frames} ${frames === 1 ? 'quadro' : 'quadros'}`} onClick={() => props.onOpenStoryboard(label)}>
              {frames} {frames === 1 ? 'quadro' : 'quadros'}
            </button>
          )}
          {maps > 0 && firstMap && (
            <button className="link" aria-label={`Mapa de luz da cena ${label}`} onClick={() => props.onOpenMap(firstMap)}>
              {maps} {maps === 1 ? 'mapa de luz' : 'mapas de luz'}
            </button>
          )}
        </span>
      )}
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
  const [watermark, setWatermark] = useState<Watermark | undefined>(undefined)
  const [notes, setNotesState] = useState<Note[]>([])
  const [production, setProductionState] = useState<Production>(emptyProduction())
  /** Block index of the scene heading whose synopsis is being edited in the navigator. */
  const [synEdit, setSynEdit] = useState<number | null>(null)
  const [showSynopsis, setShowSynopsis] = useState(() => {
    try {
      return localStorage.getItem('showSynopsis') !== 'false'
    } catch {
      return true
    }
  })
  /** Where the storyboard or the light map tab opens when reached from a scene. */
  const [jump, setJump] = useState<{ scene?: string; map?: string }>({})
  const [notesOpen, setNotesOpen] = useState(false)
  const [readOpen, setReadOpen] = useState(false)
  /** Why the last copy to the copy folder failed, or null. */
  const [copyFailed, setCopyFailed] = useState<string | null>(null)
  const copyFailedRef = useRef<string | null>(null)
  const [tableRead, setTableReadState] = useState<TableRead | undefined>(undefined)
  const [freshNote, setFreshNote] = useState<string | null>(null)
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
  const fold = useToolbarFold()
  const folded = fold.folded
  // keeps the first toolbar row free under Salvar/Exportar, which sit at the top right (see .toolbar-reserve)
  const [toolbarEnd, setToolbarEnd] = useState({ w: 0, h: 0 })
  const endObserver = useRef<ResizeObserver | null>(null)
  const toolbarEndRef = useCallback((el: HTMLDivElement | null) => {
    endObserver.current?.disconnect()
    if (!el) return
    // only a real change re-renders: the whole app renders again, which is slow on a long script
    endObserver.current = new ResizeObserver(() => {
      const w = el.offsetWidth
      const h = el.offsetHeight
      setToolbarEnd((p) => (p.w === w && p.h === h ? p : { w, h }))
    })
    endObserver.current.observe(el)
  }, [])

  // with the notes column open the page may not fit beside it: the page is drawn smaller instead of scrolling sideways
  const fitObserver = useRef<ResizeObserver | null>(null)
  const canvasRef = useCallback((el: HTMLElement | null) => {
    fitObserver.current?.disconnect()
    if (!el) return
    fitObserver.current = new ResizeObserver(() => {
      const s = getComputedStyle(el)
      const room = el.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight)
      // 8.5 in = 816 px; never below 70 %, where the script would get hard to read
      const fit = Math.max(0.7, Math.min(1, room / 816))
      el.style.setProperty('--sheet-fit', fit.toFixed(3))
    })
    fitObserver.current.observe(el)
  }, [])

  const handle = useRef<EditorHandle | null>(null)
  const scriptRef = useRef<Script>(emptyScript())
  const pathRef = useRef<string | null>(null)
  const timer = useRef<number | null>(null)
  const claudeTimer = useRef<number | null>(null)

  scriptRef.current = { titlePage, blocks, board, storyboard, lightMaps, paper, characters, extras, revision, scenesLocked, numberScenes, watermark, notes, production, tableRead }
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
        // the copy folder: say once when copying stops working, and again when it works
        const c = await window.api.copyFolderGet()
        const failed = c.dir && c.last && !c.last.ok ? c.last.error ?? 'erro desconhecido' : null
        if (failed && !copyFailedRef.current) flash(`Salvo, mas a cópia em ${c.dir} não foi feita: ${failed}.`)
        copyFailedRef.current = failed
        setCopyFailed(failed)
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

  // a long script: the navigator, the page count and the other panels follow the text when typing stops
  const blocksTimer = useRef<number | null>(null)
  const onChange = useCallback(
    (b: Block[]) => {
      scheduleAutosave()
      if (blocksTimer.current !== null) window.clearTimeout(blocksTimer.current)
      blocksTimer.current = null
      if (b.length < LONG_SCRIPT_BLOCKS) return setBlocks(b)
      blocksTimer.current = window.setTimeout(() => {
        blocksTimer.current = null
        setBlocks(b)
      }, LONG_SCRIPT_DELAY)
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

  // writes without touching the scene links (used by the scene-link sync below)
  const putStoryboard = useCallback(
    (sb: Storyboard) => {
      scriptRef.current = { ...scriptRef.current, storyboard: sb }
      setStoryboardState(sb)
      scheduleAutosave()
    },
    [scheduleAutosave]
  )

  const putLightMaps = useCallback(
    (maps: LightMap[]) => {
      scriptRef.current = { ...scriptRef.current, lightMaps: maps }
      setLightMapsState(maps)
      scheduleAutosave()
    },
    [scheduleAutosave]
  )

  // edits from the screen or the AI: a frame or map whose scene was changed by hand is linked again by its new label
  const setStoryboard = useCallback(
    (sb: Storyboard) => putStoryboard({ ...sb, frames: unlinkChanged(scriptRef.current.storyboard?.frames ?? [], sb.frames) }),
    [putStoryboard]
  )

  const setLightMaps = useCallback(
    (maps: LightMap[]) => putLightMaps(unlinkChanged(scriptRef.current.lightMaps ?? [], maps)),
    [putLightMaps]
  )

  const setTableRead = useCallback(
    (t: TableRead) => {
      scriptRef.current = { ...scriptRef.current, tableRead: t }
      setTableReadState(t)
      scheduleAutosave()
    },
    [scheduleAutosave]
  )
  /** The line being read aloud: highlighted and kept in sight. */
  const onReadLine = useCallback((block: number | null) => {
    handle.current?.setView({ reading: block })
    if (block !== null) handle.current?.revealBlock(block)
  }, [])

  const setProduction = useCallback(
    (p: Production) => {
      scriptRef.current = { ...scriptRef.current, production: p }
      setProductionState(p)
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

  const setNotes = useCallback(
    (next: Note[]) => {
      scriptRef.current = { ...scriptRef.current, notes: next }
      setNotesState(next)
      scheduleAutosave()
    },
    [scheduleAutosave]
  )

  // ------------------------------------------------------------ open, new, import
  const openScript = useCallback((s: Script, p: string | null) => {
    handle.current = null
    // an update of the script that was open must not land on this one
    if (blocksTimer.current !== null) window.clearTimeout(blocksTimer.current)
    blocksTimer.current = null
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
    setWatermark(s.watermark)
    setNotesState(s.notes ?? [])
    setProductionState(s.production ?? emptyProduction())
    setTableReadState(s.tableRead)
    setReadOpen(false)
    setJump({})
    setFreshNote(null)
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
    async (format: 'pdf' | 'storyboard-pdf' | 'lightmap-pdf' | 'characters-pdf' | 'fdx' | 'fountain' | 'docx' | 'html') => {
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
  // the caret moves at every key: the app redraws only when its line or element type changes
  const onCaret = useCallback((c: CaretInfo) => setCaret((p) => (p.block === c.block && p.kind === c.kind && p.dual === c.dual ? p : c)), [])
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

  // ------------------------------------------------------------ synopses
  useEffect(() => {
    handle.current?.setView({ showSynopsis })
    try {
      localStorage.setItem('showSynopsis', String(showSynopsis))
    } catch {
      /* ignore */
    }
  }, [showSynopsis, ready, docKey])
  const saveSynopsis = useCallback((index: number, text: string | null) => {
    if (text !== null) handle.current?.setSynopsis(index, cleanSynopsis(text))
    setSynEdit(null)
  }, [])
  /** Opens the synopsis of a scene for editing, in the navigator. */
  const editSynopsis = useCallback((index: number) => {
    setPanel('script')
    setNavigator(true)
    setSynEdit(index)
  }, [])
  // a click on the synopsis line in the text
  useEffect(() => {
    const on = (e: Event): void => editSynopsis((e as CustomEvent<number>).detail)
    window.addEventListener('rottera:edit-synopsis', on)
    return () => window.removeEventListener('rottera:edit-synopsis', on)
  }, [editSynopsis])

  // ------------------------------------------------------------ notes
  const marks = useMemo(() => noteMarks(blocks, notes), [blocks, notes])
  const marksKey = JSON.stringify(marks)
  useEffect(() => {
    handle.current?.setView({ notes: marks })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marksKey, ready, docKey])
  const noteGroups = useMemo(() => (notesOpen ? groupNotes(blocks, notes) : { groups: [], loose: [] }), [notesOpen, blocks, notes])

  /** A new note on the caret's line; opens the notes column and puts the cursor in it. */
  const addNote = useCallback(() => {
    if (view !== 'editor') return
    const anchor = handle.current?.anchorAtCaret() ?? null
    if (!anchor) return
    const note: Note = { id: newId('note'), text: '', color: 'yellow', anchor }
    setNotes([...(scriptRef.current.notes ?? []), note])
    setPanel('script')
    setNotesOpen(true)
    setFreshNote(note.id)
  }, [view, setNotes])
  const updateNote = useCallback(
    (id: string, patch: Partial<Note>) => setNotes((scriptRef.current.notes ?? []).map((n) => (n.id === id ? { ...n, ...patch } : n))),
    [setNotes]
  )
  const deleteNote = useCallback((id: string) => setNotes((scriptRef.current.notes ?? []).filter((n) => n.id !== id)), [setNotes])
  const pinNote = useCallback(
    (id: string) => {
      const anchor = handle.current?.anchorAtCaret() ?? null
      if (anchor) updateNote(id, { anchor })
    },
    [updateNote]
  )

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
        case 'export-docx': return void doExport('docx')
        case 'export-html': return void doExport('html')
        case 'title-page': return setDialog('title')
        case 'watermark': return setDialog('watermark')
        case 'versions': return handle.current ? setDialog('versions') : undefined
        case 'copy-folder': return setDialog('copyfolder')
        case 'manual': return setDialog('manual')
        case 'diagnostics': return setDialog('diagnostics')
        case 'toggle-navigator': return setNavigator((v) => !v)
        case 'toggle-notes': return setNotesOpen((v) => !v)
        case 'toggle-synopsis': return setShowSynopsis((v) => !v)
        case 'read-aloud':
          setPanel('script')
          return setReadOpen((v) => !v)
        case 'edit-synopsis': {
          const bs = handle.current?.getBlocks() ?? []
          let i = Math.min(handle.current?.selection().block ?? 0, bs.length - 1)
          while (i > 0 && bs[i]?.kind !== 'scene_heading') i--
          if (bs[i]?.kind === 'scene_heading') editSynopsis(i)
          return
        }
        case 'new-note': return addNote()
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
        case 'view-shooting': return setPanel('shooting')
        case 'claude': return setDialog('connect')
      }
    })
  }, [doNew, doOpen, saveNow, doImport, doExport, doPreview, goHome, openFind, addNote, editSynopsis])

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
        setNotes,
        save: () => saveNow(false),
        touched: () => {
          setMessage('A IA editou o roteiro. Ctrl+Z desfaz.')
          window.setTimeout(() => setMessage((m) => (m?.startsWith('A IA editou') ? null : m)), 4000)
        }
      }),
    [setBoard, setStoryboard, setLightMaps, setCharacters, setNotes, saveNow, scheduleAutosave]
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
  // ------------------------------------------------------------ scene links
  // Frames and light maps keep the id of their scene (sid); their label follows that scene's number.
  // Ones without an id (old files, the AI, a scene picked by hand) are linked by their label.
  useEffect(() => {
    const h = handle.current
    if (view !== 'editor' || !h) return
    const idNumber = new Map<string, string>()
    const numberIndex = new Map<string, number>()
    blocks.forEach((b, i) => {
      if (b.kind !== 'scene_heading') return
      const num = numbers[i] ?? ''
      if (b.nid) idNumber.set(b.nid, num)
      if (num && !numberIndex.has(num)) numberIndex.set(num, i)
    })
    const frames = storyboard.frames
    const maps = lightMaps
    const toLink = [...frames, ...maps].filter((x) => !x.sid && numberIndex.has(x.scene))
    const anchors = new Map<string, string>()
    if (toLink.length) {
      const nums = [...new Set(toLink.map((x) => x.scene))]
      h.anchorBlocks(nums.map((n) => numberIndex.get(n) as number)).forEach((a, k) => {
        if (a) anchors.set(nums[k], a)
      })
    }
    const fix = <T extends { scene: string; sid?: string }>(x: T): T => {
      if (x.sid && idNumber.has(x.sid)) {
        const num = idNumber.get(x.sid) as string
        return num === x.scene ? x : { ...x, scene: num }
      }
      if (!x.sid && anchors.has(x.scene)) return { ...x, sid: anchors.get(x.scene) }
      return x
    }
    const nextFrames = frames.map(fix)
    if (nextFrames.some((x, i) => x !== frames[i])) putStoryboard({ ...storyboard, frames: nextFrames })
    const nextMaps = maps.map(fix)
    if (nextMaps.some((x, i) => x !== maps[i])) putLightMaps(nextMaps)
  }, [view, blocks, numbers, storyboard, lightMaps, ready, putStoryboard, putLightMaps])

  const linksBySid = useMemo(() => {
    const m = new Map<string, SceneLinks>()
    const get = (sid: string): SceneLinks => {
      let l = m.get(sid)
      if (!l) m.set(sid, (l = { frames: 0, maps: [] }))
      return l
    }
    for (const fr of storyboard.frames) if (fr.sid) get(fr.sid).frames += 1
    for (const lm of lightMaps) if (lm.sid) get(lm.sid).maps.push({ id: lm.id, name: lm.name })
    return m
  }, [storyboard.frames, lightMaps])
  const linksOf = useCallback((sid: string | null): SceneLinks => (sid ? linksBySid.get(sid) : undefined) ?? NO_LINKS, [linksBySid])
  const openStoryboardAt = useCallback((scene: string) => {
    setJump({ scene })
    setPanel('storyboard')
  }, [])
  const openMap = useCallback((map: string) => {
    setJump({ map })
    setPanel('lightmap')
  }, [])
  useEffect(() => {
    if (panel !== 'storyboard' && panel !== 'lightmap') setJump((j) => (j.scene || j.map ? {} : j))
  }, [panel])

  const shootingScenes = useMemo(
    () => (panel === 'shooting' ? sceneInfo({ blocks, paper, scenesLocked }, pagination) : []),
    [panel, blocks, paper, scenesLocked, pagination]
  )
  const sceneIdsOf = useCallback((list: { id: string | null; index: number }[]) => {
    const missing = list.filter((sc) => !sc.id)
    const given = missing.length ? handle.current?.anchorBlocks(missing.map((sc) => sc.index)) ?? [] : []
    let k = 0
    return list.map((sc) => sc.id ?? given[k++] ?? null)
  }, [])
  const sceneIdOf = useCallback((sc: { id: string | null; index: number }) => sc.id ?? handle.current?.anchorBlocks([sc.index])[0] ?? null, [])
  const exportReportPdf = useCallback(
    (report: Report, landscape: boolean) =>
      void window.api
        .exportReportPdf({
          // a shooting plan prints day by day; other reports as their table
          ...printable(report),
          scriptTitle: scriptRef.current.titlePage.title || baseName(pathRef.current) || 'Sem título',
          paper: scriptRef.current.paper === 'a4' ? 'a4' : 'letter',
          landscape
        })
        .then((p) => p && flash(`Exportado: ${p.split(/[\\/]/).pop()}`))
        .catch(() => flash('Não foi possível exportar o relatório.')),
    [flash]
  )
  const exportCsv = useCallback(
    (name: string, csv: string) => void window.api.exportText(name, 'csv', csv).then((p) => p && flash(`Exportado: ${p.split(/[\\/]/).pop()}`)),
    [flash]
  )

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
              <button className="btn ghost" onClick={() => setDialog('connect')}>Conectar a uma IA…</button>
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
      <div className="toolbar" role="toolbar" aria-label="Ferramentas" ref={fold.ref}>
        <span className="toolbar-reserve" aria-hidden="true" style={{ width: toolbarEnd.w + 8, height: toolbarEnd.h + 2 }} />
        <div className="toolbar-main">
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
            <button className="btn ghost" aria-pressed={panel === 'shooting'} onClick={() => setPanel('shooting')}>Filmagem</button>
          </div>
          {!folded('nav') && (
            <button className="btn ghost" data-fold="nav" onClick={() => setNavigator((v) => !v)} aria-pressed={navigator}>Navegador</button>
          )}
          {!folded('notes') && (
            <button className="btn ghost" data-fold="notes" onClick={() => setNotesOpen((v) => !v)} aria-pressed={notesOpen}>Notas</button>
          )}
          {!folded('find') && <button className="btn ghost" data-fold="find" onClick={openFind}>Localizar</button>}
          {!folded('dual') && (
            <button className="btn ghost" data-fold="dual" aria-pressed={caret.dual} title="Ctrl+D" onClick={toggleDualDialogue}>
              Diálogo duplo
            </button>
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
            {/* the toolbar buttons that did not fit on the bar (see useToolbarFold) */}
            {folded('nav') && (
              <button className="btn ghost" data-close onClick={() => setNavigator((v) => !v)} aria-pressed={navigator}>
                {navigator ? 'Ocultar navegador de cenas' : 'Mostrar navegador de cenas'}
              </button>
            )}
            {folded('notes') && (
              <button className="btn ghost" data-close onClick={() => setNotesOpen((v) => !v)} aria-pressed={notesOpen}>
                {notesOpen ? 'Ocultar notas' : 'Mostrar notas'}
              </button>
            )}
            {folded('find') && <button className="btn ghost" data-close onClick={openFind}>Localizar e substituir…</button>}
            {folded('dual') && (
              <button className="btn ghost" data-close aria-pressed={caret.dual} onClick={toggleDualDialogue}>
                Diálogo duplo (Ctrl+D)
              </button>
            )}
            {folded('preview') && <button className="btn ghost" data-close onClick={() => void doPreview()}>Visualizar impressão</button>}
            {folded('theme') && (
              <>
                <label className="stack" htmlFor="theme-select-narrow">Tema</label>
                <select id="theme-select-narrow" value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
                  {(Object.keys(THEME_LABEL) as Theme[]).map((t) => (
                    <option key={t} value={t}>{THEME_LABEL[t]}</option>
                  ))}
                </select>
              </>
            )}
            {folded(FOLD_ORDER[0]) && <hr />}
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
            <button className="btn ghost" data-close onClick={() => setReadOpen(true)}>Leitura em voz alta…</button>
            <button className="btn ghost" data-close onClick={() => setDialog('title')}>Página de título…</button>
            <button className="btn ghost" data-close onClick={() => setDialog('watermark')}>Marca d’água…</button>
            <button className="btn ghost" data-close onClick={() => setDialog('versions')}>Versões anteriores…</button>
            <button className="btn ghost" data-close onClick={() => setDialog('copyfolder')}>Cópia em outra pasta…</button>
            <button className="btn ghost" data-close onClick={() => setDialog('smarttype')}>Gerenciar SmartType…</button>
            <button className="btn ghost" data-close onClick={() => setDialog('export')}>Exportar…</button>
            <button className="btn ghost" data-close onClick={() => void doImport()}>Importar…</button>
            <button className="btn ghost" data-close onClick={() => setDialog('connect')}>Conectar a uma IA…</button>
            <button className="btn ghost" data-close onClick={() => setDialog('manual')}>Manual</button>
            <button className="btn ghost" data-close onClick={() => setDialog('diagnostics')}>Copiar diagnóstico…</button>
          </Popover>
        </div>
        <div className="toolbar-end" ref={toolbarEndRef}>
          {!folded('theme') && (
            <span data-fold="theme">
              <ThemeToggle value={theme} onChange={setTheme} />
            </span>
          )}
          {!folded('preview') && (
            <button className="btn ghost" data-fold="preview" title="Visualizar impressão (Ctrl+Shift+P)" onClick={() => void doPreview()}>
              Visualizar
            </button>
          )}
          {!folded('pdf') && <button className="btn secondary" data-fold="pdf" onClick={() => void doExport('pdf')}>Exportar PDF</button>}
          <button
            className="btn primary icon-only"
            aria-label={path ? 'Salvar' : 'Salvar como…'}
            title={path ? 'Salvar (Ctrl+S)' : 'Salvar como… (Ctrl+S)'}
            onClick={() => void saveNow(!path)}
          >
            {/* a floppy disk */}
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 3h11.2a2 2 0 0 1 1.4.6l2.8 2.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
              <path d="M7 3v5h8V3" />
              <path d="M7 21v-7h10v7" />
            </svg>
          </button>
        </div>
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

      {panel === 'script' && readOpen && (
        <ReadBar
          getBlocks={() => handle.current?.getBlocks() ?? []}
          caretBlock={() => handle.current?.selection().block ?? 0}
          tableRead={tableRead}
          onTableRead={setTableRead}
          onLine={onReadLine}
          onClose={() => {
            setReadOpen(false)
            handle.current?.focus()
          }}
        />
      )}

      <div className={'body' + (navigator && panel === 'script' ? ' with-nav' : '') + (notesOpen && panel === 'script' ? ' with-notes' : '')}>
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
                    frames={linksOf(blocks[s.index]?.nid ?? null).frames}
                    maps={linksOf(blocks[s.index]?.nid ?? null).maps.length}
                    firstMap={linksOf(blocks[s.index]?.nid ?? null).maps[0]?.id ?? null}
                    onOpenStoryboard={openStoryboardAt}
                    onOpenMap={openMap}
                    syn={blocks[s.index]?.syn ?? ''}
                    editingSyn={synEdit === s.index}
                    onEditSyn={editSynopsis}
                    onSaveSyn={saveSynopsis}
                  />
                ))}
              </ol>
            )}
          </aside>
        )}
        <main className="canvas" aria-label="Área de trabalho" ref={canvasRef}>
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
              focusScene={jump.scene}
            />
          )}
          {panel === 'lightmap' && (
            <LightMapView
              maps={lightMaps}
              scenes={scenes.map((sc) => ({ number: sc.number, text: sc.text }))}
              onChange={setLightMaps}
              onExport={() => void doExport('lightmap-pdf')}
              focusMap={jump.map}
            />
          )}
          {panel === 'shooting' && (
            <ProductionView
              scenes={shootingScenes}
              production={production}
              onChange={setProduction}
              sceneId={sceneIdOf}
              sceneIds={sceneIdsOf}
              current={Math.max(0, activeScene)}
              links={linksOf}
              onGoToScene={goToSceneBlock}
              onOpenStoryboard={openStoryboardAt}
              onOpenMap={openMap}
              onExportPdf={exportReportPdf}
              onExportCsv={exportCsv}
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
                    ...printable(report),
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
        {notesOpen && panel === 'script' && (
          <NotesPanel
            blocks={blocks}
            groups={noteGroups.groups}
            loose={noteGroups.loose}
            sceneLabel={(n) => (numberScenes || scenesLocked ? scenes[n]?.number ?? String(n + 1) : String(n + 1))}
            fresh={freshNote}
            onAdd={addNote}
            onUpdate={updateNote}
            onDelete={deleteNote}
            onGo={focusSceneBlock}
            onPin={pinNote}
          />
        )}
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
        {claudeActive && <span className="pill claude" role="status">IA conectada</span>}
        {copyFailed && (
          <button className="pill warn" title={copyFailed} onClick={() => setDialog('copyfolder')}>
            Cópia em outra pasta falhou
          </button>
        )}
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
      {dialog === 'export' && (
        <ExportDialog
          frames={storyboard.frames.length}
          maps={lightMaps.length}
          onExport={(f) => {
            setDialog(null)
            void doExport(f)
          }}
          onPreview={() => {
            setDialog(null)
            void doPreview()
          }}
          onReports={() => {
            setDialog(null)
            setPanel('reports')
          }}
          onShooting={() => {
            setDialog(null)
            setPanel('shooting')
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'copyfolder' && (
        <CopyFolderDialog
          onClose={() => setDialog(null)}
          onChanged={(info) => {
            // a new folder gets a copy right away
            if (info.dir && pathRef.current) void saveNow(false)
            if (!info.dir) {
              copyFailedRef.current = null
              setCopyFailed(null)
            }
          }}
        />
      )}
      {dialog === 'watermark' && (
        <WatermarkDialog
          value={watermark}
          onClose={() => setDialog(null)}
          onSave={(w) => {
            setWatermark(w)
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
