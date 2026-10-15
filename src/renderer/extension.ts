import { Extension, Node, mergeAttributes, type Editor } from '@tiptap/core'
import {
  Plugin,
  PluginKey,
  TextSelection,
  type EditorState,
  type Transaction
} from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { Kind, Paper } from '../shared/types'
import { KINDS, cycleKind, enterResult, tabResult } from '../shared/elements'
import { paginate, wrap, SPEC } from '../shared/paginate'
import { sceneNumbers } from '../shared/scenes'
import { UPPER } from '../shared/elements'
import { docNodeToBlocks } from './blocks'

/** One node type for every screenplay element; the `kind` attribute says which. */
export const BlockNode = Node.create({
  name: 'block',
  group: 'block',
  content: 'inline*',
  addAttributes() {
    return {
      kind: { default: 'action' },
      dual: { default: false },
      rev: { default: null },
      sn: { default: null },
      bid: { default: null }
    }
  },
  parseHTML() {
    return [
      {
        tag: 'p[data-kind]',
        getAttrs: (el) => ({ kind: (el as HTMLElement).getAttribute('data-kind') ?? 'action' })
      }
    ]
  },
  renderHTML({ node, HTMLAttributes }) {
    const extra: Record<string, string> = {}
    if (node.attrs.dual === true) extra['data-dual'] = 'true'
    if (typeof node.attrs.rev === 'string') extra['data-rev'] = node.attrs.rev
    return [
      'p',
      mergeAttributes(HTMLAttributes, { 'data-kind': node.attrs.kind, class: `el el-${node.attrs.kind}` }, extra),
      0
    ]
  }
})

// ---------------------------------------------------------------- view state plugin
export interface ViewState {
  paper: Paper
  showNumbers: boolean
  locked: boolean
  revMode: boolean
  revColor: string
  query: string
  caseSensitive: boolean
  current: number
}

export const viewKey = new PluginKey<ViewState>('roteraView')

const DEFAULT_VIEW: ViewState = {
  paper: 'letter',
  showNumbers: false,
  locked: false,
  revMode: false,
  revColor: 'azul',
  query: '',
  caseSensitive: false,
  current: 0
}

export interface Range {
  from: number
  to: number
}

export function findRanges(doc: PMNode, query: string, caseSensitive: boolean): Range[] {
  if (query === '') return []
  const q = caseSensitive ? query : query.toLowerCase()
  const out: Range[] = []
  doc.forEach((node, offset) => {
    const t = caseSensitive ? node.textContent : node.textContent.toLowerCase()
    let from = 0
    for (;;) {
      const i = t.indexOf(q, from)
      if (i === -1) break
      out.push({ from: offset + 1 + i, to: offset + 1 + i + q.length })
      from = i + q.length
    }
  })
  return out
}

function pageBreakWidget(page: number): HTMLElement {
  const el = document.createElement('span')
  el.className = 'page-break'
  el.setAttribute('contenteditable', 'false')
  el.setAttribute('data-page', String(page))
  el.setAttribute('aria-hidden', 'true')
  return el
}

function buildDecorations(doc: PMNode, vs: ViewState): DecorationSet {
  const decos: Decoration[] = []
  const blocks = docNodeToBlocks(doc)
  const starts: number[] = []
  const sizes: number[] = []
  doc.forEach((node, offset) => {
    starts.push(offset)
    sizes.push(node.nodeSize)
  })

  // Page breaks
  const pag = paginate(blocks, vs.paper)
  for (let p = 1; p < pag.pages.length; p++) {
    const line = pag.pages[p].find((l) => l.block >= 0)
    if (!line) continue
    const bi = line.block
    if (pag.blockPage[bi] === p || blocks[bi].dual || blocks[bi].kind === 'character') {
      decos.push(Decoration.widget(starts[bi], () => pageBreakWidget(p + 1), { side: -1, key: `pb-${p}` }))
      continue
    }
    // The page starts inside this block: find the character offset of the first line on this page.
    let before = 0
    for (let q = 0; q < p; q++) before += pag.pages[q].filter((l) => l.block === bi).length
    const b = blocks[bi]
    const text = UPPER.has(b.kind) ? b.text.toUpperCase() : b.text
    const lines = wrap(text, SPEC[b.kind].width)
    let offset = 0
    for (let k = 0; k < before && k < lines.length; k++) offset += lines[k].length + 1
    offset = Math.min(offset, b.text.length)
    decos.push(Decoration.widget(starts[bi] + 1 + offset, () => pageBreakWidget(p + 1), { side: -1, key: `pb-${p}` }))
  }

  // Scene numbers
  if (vs.showNumbers) {
    const nums = sceneNumbers(blocks, vs.locked)
    nums.forEach((n, i) => {
      if (n) decos.push(Decoration.node(starts[i], starts[i] + sizes[i], { 'data-sn': n }))
    })
  }

  // Search hits
  if (vs.query) {
    findRanges(doc, vs.query, vs.caseSensitive).forEach((r, i) => {
      decos.push(Decoration.inline(r.from, r.to, { class: i === vs.current ? 'find-hit find-current' : 'find-hit' }))
    })
  }
  return DecorationSet.create(doc, decos)
}

function mapRangeForward(trs: readonly Transaction[], ti: number, a: number, b: number): Range {
  let s = a
  let e = b
  for (let k = ti + 1; k < trs.length; k++) {
    s = trs[k].mapping.map(s, -1)
    e = trs[k].mapping.map(e, 1)
  }
  return { from: s, to: e }
}

export function setBlockAttr(tr: Transaction, pos: number, attrs: Record<string, unknown>): void {
  const node = tr.doc.nodeAt(pos)
  if (node) tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs })
}

const ViewPlugin = Extension.create({
  name: 'roteraView',
  addProseMirrorPlugins() {
    return [
      new Plugin<ViewState>({
        key: viewKey,
        state: {
          init: () => ({ ...DEFAULT_VIEW }),
          apply: (tr, value) => {
            const meta = tr.getMeta(viewKey) as Partial<ViewState> | undefined
            return meta ? { ...value, ...meta } : value
          }
        },
        props: {
          decorations(state) {
            const vs = viewKey.getState(state)
            return vs ? buildDecorations(state.doc, vs) : DecorationSet.empty
          }
        },
        appendTransaction(trs, _old, newState) {
          const vs = viewKey.getState(newState)
          if (!vs || !vs.revMode) return null
          if (!trs.some((t) => t.docChanged)) return null
          if (trs.some((t) => t.getMeta('revTag') || t.getMeta('noRev'))) return null
          const ranges: Range[] = []
          trs.forEach((tr, ti) => {
            if (!tr.docChanged) return
            tr.mapping.maps.forEach((map, mi) => {
              map.forEach((_os, _oe, ns, ne) => {
                let s = ns
                let e = ne
                for (let j = mi + 1; j < tr.mapping.maps.length; j++) {
                  s = tr.mapping.maps[j].map(s, -1)
                  e = tr.mapping.maps[j].map(e, 1)
                }
                ranges.push(mapRangeForward(trs, ti, s, e))
              })
            })
          })
          if (ranges.length === 0) return null
          const tr = newState.tr
          const size = newState.doc.content.size
          let changed = false
          for (const r of ranges) {
            const from = Math.max(0, Math.min(size, r.from) - 1)
            const to = Math.min(size, Math.max(r.to, r.from) + 1)
            newState.doc.nodesBetween(from, to, (node, pos) => {
              if (node.type.name === 'block') {
                if (node.attrs.rev !== vs.revColor) {
                  tr.setNodeMarkup(pos, undefined, { ...node.attrs, rev: vs.revColor })
                  changed = true
                }
                return false
              }
              return true
            })
          }
          if (!changed) return null
          tr.setMeta('revTag', true)
          return tr
        }
      })
    ]
  }
})

// ---------------------------------------------------------------- keymap
/** Callbacks the editor shell gives the keymap so it can drive the SmartType popup. */
export interface SmartApi {
  isOpen(): boolean
  accept(editor: Editor): boolean
  move(dir: 1 | -1): void
  dismiss(): void
}

function setKind(tr: Transaction, pos: number, kind: Kind): void {
  setBlockAttr(tr, pos, { kind })
}

function splitInto(tr: Transaction, state: EditorState, kind: Kind): void {
  const { $from } = state.selection
  const at = tr.mapping.map($from.pos)
  const attrs = { kind, dual: $from.parent.attrs.dual === true && (kind === 'dialogue' || kind === 'parenthetical') }
  tr.split(at, 1, [{ type: state.schema.nodes.block, attrs }])
  tr.setSelection(TextSelection.near(tr.doc.resolve(at + 2)))
}

/** Marks the speech that contains the caret as the right-hand side of a dual dialogue (or clears it). */
export function toggleDual(editor: Editor): boolean {
  const { $from } = editor.state.selection
  if ($from.depth < 1) return false
  const doc = editor.state.doc
  let idx = $from.index(0)
  // walk back to the character cue of this speech
  while (idx > 0 && doc.child(idx).attrs.kind !== 'character') {
    const k = doc.child(idx).attrs.kind
    if (k !== 'dialogue' && k !== 'parenthetical') return false
    idx -= 1
  }
  if (doc.child(idx).attrs.kind !== 'character') return false
  const turnOn = doc.child(idx).attrs.dual !== true
  // dual needs a speech right before it
  if (turnOn) {
    const prev = idx > 0 ? doc.child(idx - 1).attrs.kind : null
    if (prev !== 'dialogue' && prev !== 'parenthetical') return false
  }
  // collect contiguous group
  const group: number[] = []
  let cur = 0
  for (let i = 0; i < doc.childCount; i++) {
    const node = doc.child(i)
    if (i >= idx) {
      if (i === idx) group.push(cur)
      else if (node.attrs.kind === 'dialogue' || node.attrs.kind === 'parenthetical') group.push(cur)
      else break
    }
    cur += node.nodeSize
  }
  return editor.commands.command(({ tr }) => {
    for (const pos of group) setBlockAttr(tr, pos, { dual: turnOn })
    tr.setMeta('noRev', true)
    return true
  })
}

/**
 * Tab and Shift+Tab change the element type inside the editor, which would trap a keyboard user.
 * Esc arms an exit: the next Tab (or Shift+Tab) moves focus out of the editor instead.
 */
let exitArmed = false

export const ScreenplayKeys = Extension.create<{ smart: SmartApi }>({
  name: 'screenplayKeys',
  addOptions() {
    return {
      smart: { isOpen: () => false, accept: () => false, move: () => undefined, dismiss: () => undefined }
    }
  },
  addKeyboardShortcuts() {
    const smart = (): SmartApi => this.options.smart

    const current = (editor: Editor): { kind: Kind; text: string; pos: number; atEnd: boolean } | null => {
      const { selection } = editor.state
      if (!selection.empty) return null
      const { $from } = selection
      if ($from.parent.type.name !== 'block') return null
      return {
        kind: $from.parent.attrs.kind as Kind,
        text: $from.parent.textContent,
        pos: $from.before(),
        atEnd: $from.parentOffset === $from.parent.content.size
      }
    }

    const shortcuts: Record<string, (a: { editor: Editor }) => boolean> = {
      Enter: ({ editor }) => {
        if (smart().isOpen()) return smart().accept(editor)
        const c = current(editor)
        if (!c) return false
        // Enter on a blank line leaves dialogue, character and similar kinds.
        if (c.text.trim() === '') {
          if (c.kind === 'action') return false
          return editor.commands.command(({ tr }) => {
            setKind(tr, c.pos, 'action')
            setBlockAttr(tr, c.pos, { dual: false })
            return true
          })
        }
        const r = enterResult(c.kind, c.text)
        return editor.commands.command(({ tr, state }) => {
          if (r.current) setKind(tr, c.pos, r.current)
          splitInto(tr, state, r.next)
          return true
        })
      },
      Tab: ({ editor }) => {
        if (smart().isOpen()) return smart().accept(editor)
        if (exitArmed) {
          exitArmed = false
          return false // let the browser move focus to the next control
        }
        const c = current(editor)
        if (!c) return true
        const r = tabResult(c.kind, c.text)
        return editor.commands.command(({ tr, state }) => {
          if (r.type === 'cycle') {
            setKind(tr, c.pos, r.kind)
          } else if (r.type === 'text') {
            if (!c.atEnd) return true
            const start = c.pos + 1
            tr.insertText(r.text, start, start + c.text.length)
            tr.setSelection(TextSelection.near(tr.doc.resolve(start + r.text.length)))
          } else if (c.atEnd) {
            splitInto(tr, state, r.kind)
          }
          return true
        })
      },
      'Shift-Tab': ({ editor }) => {
        if (exitArmed) {
          exitArmed = false
          return false
        }
        const c = current(editor)
        if (!c) return true
        return editor.commands.command(({ tr }) => {
          setKind(tr, c.pos, cycleKind(c.kind, -1))
          return true
        })
      },
      'Mod-d': ({ editor }) => {
        toggleDual(editor)
        return true
      },
      Escape: () => {
        if (smart().isOpen()) {
          smart().dismiss()
          return true
        }
        exitArmed = true
        return false
      },
      ArrowDown: () => {
        if (!smart().isOpen()) return false
        smart().move(1)
        return true
      },
      ArrowUp: () => {
        if (!smart().isOpen()) return false
        smart().move(-1)
        return true
      }
    }

    KINDS.forEach((kind, i) => {
      shortcuts[`Mod-${i + 1}`] = ({ editor }) => {
        const c = current(editor)
        if (!c) return true
        return editor.commands.command(({ tr }) => {
          setKind(tr, c.pos, kind)
          return true
        })
      }
    })
    return shortcuts
  }
})

const DisarmExit = Extension.create({
  name: 'disarmExit',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleKeyDown(_view, event) {
            if (event.key !== 'Escape' && event.key !== 'Tab' && !['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) {
              exitArmed = false
            }
            return false
          }
        }
      })
    ]
  }
})

export const RoteraExtensions = [BlockNode, ViewPlugin, DisarmExit]
