import { useEffect, useMemo, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import Document from '@tiptap/extension-document'
import Text from '@tiptap/extension-text'
import History from '@tiptap/extension-history'
import { TextSelection } from '@tiptap/pm/state'
import type { Block, Extras, Kind } from '../shared/types'
import { KINDS, LABELS } from '../shared/elements'
import { collectLists, suggest } from '../shared/smarttype'
import {
  BlockNode,
  RoteraExtensions,
  ScreenplayKeys,
  findRanges,
  toggleDual,
  viewKey,
  type SmartApi,
  type ViewState
} from './extension'
import { blockToJson, blocksToDoc, docToBlocks } from './blocks'

export interface CaretInfo {
  kind: Kind
  block: number
  dual: boolean
}

export interface EditorHandle {
  focus(): void
  setKind(kind: Kind): void
  focusBlock(index: number): void
  getBlocks(): Block[]
  /** Replaces blocks [start, end) with `blocks` in one undoable step. */
  replaceRange(start: number, end: number, blocks: Block[], opts?: { noRev?: boolean }): void
  setView(view: Partial<ViewState>): void
  find(query: string, caseSensitive: boolean): { count: number; current: number }
  findStep(dir: 1 | -1): { count: number; current: number }
  replaceCurrent(replacement: string): { count: number; current: number }
  replaceAllHits(replacement: string): number
  toggleDual(): boolean
  selection(): { block: number; text: string; kind: Kind }
}

interface Props {
  initial: Block[]
  extras: Extras | undefined
  onChange(blocks: Block[]): void
  onCaret(info: CaretInfo): void
  onReady(handle: EditorHandle): void
}

interface Popup {
  from: number
  items: string[]
  index: number
  left: number
  top: number
}

export function Editor({ initial, extras, onChange, onCaret, onReady }: Props): JSX.Element {
  const [popup, setPopup] = useState<Popup | null>(null)
  const popupRef = useRef<Popup | null>(null)
  popupRef.current = popup
  const extrasRef = useRef<Extras | undefined>(extras)
  extrasRef.current = extras

  const smart = useMemo<SmartApi>(
    () => ({
      isOpen: () => popupRef.current !== null,
      accept: (editor) => {
        const p = popupRef.current
        if (!p) return false
        const { $from } = editor.state.selection
        const start = $from.start()
        const end = $from.end()
        const item = p.items[p.index]
        editor.commands.command(({ tr }) => {
          tr.insertText(item, start + p.from, end)
          tr.setSelection(TextSelection.near(tr.doc.resolve(start + p.from + item.length)))
          return true
        })
        setPopup(null)
        return true
      },
      move: (dir) => {
        const p = popupRef.current
        if (!p) return
        setPopup({ ...p, index: (p.index + dir + p.items.length) % p.items.length })
      },
      dismiss: () => setPopup(null)
    }),
    []
  )

  const editor = useEditor({
    extensions: [
      Document.extend({ content: 'block+' }),
      Text,
      History,
      BlockNode,
      ...RoteraExtensions.slice(1),
      ScreenplayKeys.configure({ smart })
    ],
    content: blocksToDoc(initial),
    editorProps: {
      attributes: {
        class: 'sheet-content',
        spellcheck: 'true',
        lang: 'pt-BR',
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': 'Texto do roteiro',
        'aria-describedby': 'editor-hint'
      }
    },
    autofocus: 'end'
  })

  useEffect(() => {
    if (!editor) return
    const refresh = (): void => {
      const { selection } = editor.state
      const { $from } = selection
      if ($from.parent.type.name === 'block') {
        onCaret({
          kind: $from.parent.attrs.kind as Kind,
          block: $from.index(0),
          dual: $from.parent.attrs.dual === true
        })
      }
      const atEnd = selection.empty && $from.parentOffset === $from.parent.content.size
      if (!atEnd || $from.parent.type.name !== 'block') {
        setPopup(null)
        return
      }
      const lists = collectLists(docToBlocks(editor), extrasRef.current)
      const s = suggest($from.parent.attrs.kind as Kind, $from.parent.textContent, lists)
      if (!s) {
        setPopup(null)
        return
      }
      const c = editor.view.coordsAtPos($from.pos)
      setPopup((prev) => ({
        from: s.from,
        items: s.items,
        index: prev && prev.items[prev.index] === s.items[0] ? prev.index : 0,
        left: c.left,
        top: c.bottom + 4
      }))
    }
    const onUpdate = (): void => {
      onChange(docToBlocks(editor))
      refresh()
    }
    editor.on('update', onUpdate)
    editor.on('selectionUpdate', refresh)
    refresh()
    return () => {
      editor.off('update', onUpdate)
      editor.off('selectionUpdate', refresh)
    }
  }, [editor, onChange, onCaret])

  useEffect(() => {
    if (!editor) return

    const starts = (): number[] => {
      const out: number[] = []
      editor.state.doc.forEach((_n, offset) => out.push(offset))
      return out
    }
    const viewState = (): ViewState => viewKey.getState(editor.state) as ViewState
    const stats = (): { count: number; current: number } => {
      const vs = viewState()
      const hits = findRanges(editor.state.doc, vs.query, vs.caseSensitive)
      return { count: hits.length, current: hits.length === 0 ? 0 : Math.min(vs.current, hits.length - 1) }
    }
    const setView = (v: Partial<ViewState>): void => {
      editor.view.dispatch(editor.state.tr.setMeta(viewKey, v).setMeta('addToHistory', false))
    }
    const gotoHit = (): void => {
      const vs = viewState()
      const hits = findRanges(editor.state.doc, vs.query, vs.caseSensitive)
      const h = hits[Math.min(vs.current, hits.length - 1)]
      if (!h) return
      const tr = editor.state.tr.setSelection(TextSelection.create(editor.state.doc, h.from, h.to)).scrollIntoView()
      tr.setMeta('addToHistory', false)
      editor.view.dispatch(tr)
    }

    onReady({
      focus: () => editor.commands.focus(),
      getBlocks: () => docToBlocks(editor),
      setKind: (kind) => {
        const { $from } = editor.state.selection
        if ($from.parent.type.name !== 'block') return
        const pos = $from.before()
        editor
          .chain()
          .command(({ tr }) => {
            const node = tr.doc.nodeAt(pos)
            if (node) tr.setNodeMarkup(pos, undefined, { ...node.attrs, kind })
            return true
          })
          .focus()
          .run()
      },
      focusBlock: (index) => {
        const s = starts()
        const pos = s[Math.max(0, Math.min(index, s.length - 1))] ?? 0
        editor.chain().focus().setTextSelection(pos + 1).scrollIntoView().run()
      },
      replaceRange: (start, end, blocks, opts) => {
        const s = starts()
        const size = editor.state.doc.content.size
        const from = start >= s.length ? size : s[Math.max(0, start)]
        const to = end >= s.length ? size : s[Math.max(0, end)]
        const nodes = blocks.map((b) => editor.state.schema.nodeFromJSON(blockToJson(b)))
        const total = s.length - (Math.min(end, s.length) - Math.max(0, start)) + nodes.length
        if (total === 0) nodes.push(editor.state.schema.nodeFromJSON(blockToJson({ kind: 'scene_heading', text: '' })))
        const tr = editor.state.tr.replaceWith(from, to, nodes)
        if (opts?.noRev) tr.setMeta('noRev', true)
        editor.view.dispatch(tr)
      },
      setView,
      find: (query, caseSensitive) => {
        setView({ query, caseSensitive, current: 0 })
        const st = stats()
        if (st.count > 0) gotoHit()
        return st
      },
      findStep: (dir) => {
        const st = stats()
        if (st.count === 0) return st
        const next = (st.current + dir + st.count) % st.count
        setView({ current: next })
        gotoHit()
        return { count: st.count, current: next }
      },
      replaceCurrent: (replacement) => {
        const vs = viewState()
        const hits = findRanges(editor.state.doc, vs.query, vs.caseSensitive)
        const h = hits[Math.min(vs.current, hits.length - 1)]
        if (!h) return { count: 0, current: 0 }
        editor.view.dispatch(editor.state.tr.insertText(replacement, h.from, h.to))
        const st = stats()
        if (st.count > 0) {
          setView({ current: Math.min(vs.current, st.count - 1) })
          gotoHit()
        }
        return st
      },
      replaceAllHits: (replacement) => {
        const vs = viewState()
        const hits = findRanges(editor.state.doc, vs.query, vs.caseSensitive)
        if (hits.length === 0) return 0
        const tr = editor.state.tr
        for (const h of [...hits].reverse()) tr.insertText(replacement, h.from, h.to)
        editor.view.dispatch(tr)
        return hits.length
      },
      toggleDual: () => toggleDual(editor),
      selection: () => {
        const { $from, from, to } = editor.state.selection
        const text = from === to ? $from.parent.textContent : editor.state.doc.textBetween(from, to, '\n')
        return { block: $from.index(0), text, kind: $from.parent.attrs.kind as Kind }
      }
    })
  }, [editor, onReady])

  return (
    <div className="sheet-wrap">
      <span id="editor-hint" className="sr-only">
        Tab troca o tipo do elemento. Para sair do editor com o teclado, aperte Esc e depois Tab.
      </span>
      <div className="sheet">
        <EditorContent editor={editor} />
      </div>
      {popup && (
        <ul
          className="smart"
          role="listbox"
          aria-label="Sugestões"
          style={{ left: popup.left, top: popup.top }}
        >
          {popup.items.slice(0, 8).map((item, i) => (
            <li key={item} role="option" aria-selected={i === popup.index} className={i === popup.index ? 'on' : ''}>
              {item.trim()}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export const ELEMENT_OPTIONS = KINDS.map((k, i) => ({ kind: k, label: LABELS[k], shortcut: `Ctrl+${i + 1}` }))
