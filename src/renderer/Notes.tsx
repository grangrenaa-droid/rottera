import { memo } from 'react'
import type { Block, Note, NoteColor } from '../shared/types'
import { NOTE_COLORS, NOTE_MAX, type NoteGroup } from '../shared/notes'

interface Props {
  blocks: Block[]
  groups: NoteGroup[]
  loose: Note[]
  /** Scene labels as the navigator shows them, by scene position. */
  sceneLabel(scene: number): string
  /** The note just made: its text box takes the focus. */
  fresh: string | null
  onAdd(): void
  onUpdate(id: string, patch: Partial<Note>): void
  onDelete(id: string): void
  onGo(block: number): void
  onPin(id: string): void
}

const colorLabel = (c: NoteColor): string => NOTE_COLORS.find((x) => x.id === c)?.label ?? ''

function quote(b: Block | undefined): string {
  const t = (b?.text ?? '').trim()
  if (!t) return '(linha vazia)'
  return t.length > 70 ? `${t.slice(0, 68)}…` : t
}

/** The notes column, on the right of the page: one post-it per note, in script order, grouped by scene. */
export function NotesPanel(p: Props): JSX.Element {
  const count = p.groups.reduce((n, g) => n + g.items.length, 0) + p.loose.length
  return (
    <aside className="notes-panel" aria-label="Notas">
      <div className="notes-head">
        <h2>Notas ({count})</h2>
        <button className="btn secondary" title="Nova nota na linha do cursor (Ctrl+Alt+M)" onClick={p.onAdd}>
          Nova nota
        </button>
      </div>
      {count === 0 && <p className="muted">Coloque o cursor numa linha do roteiro e clique em “Nova nota”. As notas não saem no PDF.</p>}
      {p.groups.map((g) => (
        <section key={g.heading} className="notes-group">
          <h3>{g.scene < 0 ? 'Antes da primeira cena' : `Cena ${p.sceneLabel(g.scene)} · ${quote(p.blocks[g.heading])}`}</h3>
          <ul>
            {g.items.map(({ note, block }) => (
              <PostIt
                key={note.id}
                note={note}
                where={quote(p.blocks[block])}
                block={block}
                autoFocus={note.id === p.fresh}
                onUpdate={p.onUpdate}
                onDelete={p.onDelete}
                onGo={p.onGo}
              />
            ))}
          </ul>
        </section>
      ))}
      {p.loose.length > 0 && (
        <section className="notes-group">
          <h3>Soltas</h3>
          <p className="muted">A linha destas notas foi apagada. Prenda na linha do cursor ou apague.</p>
          <ul>
            {p.loose.map((note) => (
              <PostIt
                key={note.id}
                note={note}
                where={null}
                block={-1}
                autoFocus={note.id === p.fresh}
                onUpdate={p.onUpdate}
                onDelete={p.onDelete}
                onGo={p.onGo}
                onPin={p.onPin}
              />
            ))}
          </ul>
        </section>
      )}
    </aside>
  )
}

const PostIt = memo(function PostIt(props: {
  note: Note
  where: string | null
  block: number
  autoFocus: boolean
  onUpdate(id: string, patch: Partial<Note>): void
  onDelete(id: string): void
  onGo(block: number): void
  onPin?(id: string): void
}): JSX.Element {
  const { note, where, block } = props
  return (
    <li className="postit" data-color={note.color}>
      {where !== null ? (
        <button className="postit-where" title="Ir para a linha no roteiro" aria-label={`Ir para a linha: ${where}`} onClick={() => props.onGo(block)}>
          {where}
        </button>
      ) : (
        <button className="postit-where" onClick={() => props.onPin?.(note.id)}>
          Prender na linha do cursor
        </button>
      )}
      <textarea
        aria-label={`Nota (${colorLabel(note.color)})`}
        value={note.text}
        maxLength={NOTE_MAX}
        rows={3}
        placeholder="Escreva a nota…"
        autoFocus={props.autoFocus}
        onChange={(e) => props.onUpdate(note.id, { text: e.target.value })}
      />
      <div className="postit-foot">
        <span className="postit-colors" role="group" aria-label="Cor da nota">
          {NOTE_COLORS.map((c) => (
            <button
              key={c.id}
              className="postit-swatch"
              data-color={c.id}
              title={c.label}
              aria-label={c.label}
              aria-pressed={note.color === c.id}
              onClick={() => props.onUpdate(note.id, { color: c.id })}
            />
          ))}
        </span>
        <span className="postit-kind">{colorLabel(note.color)}</span>
        <button className="icon" aria-label="Apagar nota" title="Apagar nota" onClick={() => props.onDelete(note.id)}>
          ×
        </button>
      </div>
    </li>
  )
})
