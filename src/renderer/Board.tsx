import { useState } from 'react'
import type { Beat, Board } from '../shared/types'
import type { BeatLink } from '../shared/beats'
import { STRUCTURES, STRUCTURE_FAMILIES, boardFromStructure, newId } from '../shared/structures'

const COLORS: { id: string; label: string }[] = [
  { id: '', label: 'Sem cor' },
  { id: 'amarela', label: 'Amarela' },
  { id: 'azul', label: 'Azul' },
  { id: 'verde', label: 'Verde' },
  { id: 'rosa', label: 'Rosa' }
]

interface Props {
  board: Board
  onChange(b: Board): void
  onMakeScene(beat: Beat): void
  /** Beats that already have a scene in the script, by beat id. */
  links: Map<string, BeatLink>
  onSendAll(): void
  onGoToScene(block: number): void
}

export function BoardView({ board, onChange, onMakeScene, links, onSendAll, onGoToScene }: Props): JSX.Element {
  const unsentCount = board.beats.filter((b) => !links.has(b.id)).length
  const [structure, setStructure] = useState(STRUCTURES[0].id)
  const [dragging, setDragging] = useState<string | null>(null)
  const chosen = STRUCTURES.find((s) => s.id === structure)

  const setBeat = (id: string, patch: Partial<Beat>): void =>
    onChange({ ...board, beats: board.beats.map((b) => (b.id === id ? { ...b, ...patch } : b)) })

  const moveBeatInLane = (id: string, dir: 1 | -1): void => {
    const beat = board.beats.find((b) => b.id === id)
    if (!beat) return
    const inLane = board.beats.filter((b) => b.lane === beat.lane)
    const i = inLane.findIndex((b) => b.id === id)
    const j = i + dir
    if (j < 0 || j >= inLane.length) return
    const swapWith = inLane[j]
    const beats = board.beats.slice()
    const a = beats.findIndex((b) => b.id === id)
    const b = beats.findIndex((x) => x.id === swapWith.id)
    ;[beats[a], beats[b]] = [beats[b], beats[a]]
    onChange({ ...board, beats })
  }

  const moveBeatToLane = (id: string, laneId: string): void => {
    const beat = board.beats.find((b) => b.id === id)
    if (!beat || beat.lane === laneId) return
    onChange({ ...board, beats: [...board.beats.filter((b) => b.id !== id), { ...beat, lane: laneId }] })
  }

  const laneShift = (id: string, dir: 1 | -1): void => {
    const i = board.lanes.findIndex((l) => l.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= board.lanes.length) return
    const lanes = board.lanes.slice()
    ;[lanes[i], lanes[j]] = [lanes[j], lanes[i]]
    onChange({ ...board, lanes })
  }

  const addLane = (): void =>
    onChange({ ...board, lanes: [...board.lanes, { id: newId('lane'), name: `Coluna ${board.lanes.length + 1}` }] })

  const addBeat = (lane: string): void =>
    onChange({
      ...board,
      beats: [...board.beats, { id: newId('beat'), lane, title: 'Novo beat', body: '', color: '' }]
    })

  const apply = (): void => {
    const s = STRUCTURES.find((x) => x.id === structure)
    if (!s) return
    if (board.lanes.length > 0) {
      const note = links.size > 0 ? ` As ${links.size} cenas já criadas a partir dos beats continuam no roteiro, mas deixam de estar ligadas a eles.` : ''
      if (!window.confirm(`Isto substitui o quadro atual.${note} Continuar?`)) return
    }
    onChange(boardFromStructure(s))
  }

  return (
    <div className="board" aria-label="Beat Board">
      <div className="board-bar">
        <label htmlFor="structure">Estrutura</label>
        <select id="structure" value={structure} onChange={(e) => setStructure(e.target.value)}>
          {STRUCTURE_FAMILIES.map((f) => (
            <optgroup key={f} label={f}>
              {STRUCTURES.filter((s) => s.family === f).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <button className="btn secondary" onClick={apply}>
          Aplicar estrutura
        </button>
        <button className="btn secondary" onClick={addLane}>
          Nova coluna
        </button>
        <button className="btn secondary" disabled={unsentCount === 0} onClick={onSendAll}>
          {unsentCount === 0 ? 'Todos os beats já têm cena' : `Criar cenas para ${unsentCount} ${unsentCount === 1 ? 'beat' : 'beats'}`}
        </button>
      </div>
      {chosen?.origin && (
        <p className="muted board-about">
          <strong>{chosen.origin}.</strong> {chosen.description}
          {chosen.note && <> {chosen.note}</>}
        </p>
      )}

      {board.lanes.length === 0 ? (
        <p className="muted board-empty">
          O quadro está vazio. Escolha uma estrutura acima ou crie uma coluna e adicione seus beats.
        </p>
      ) : (
        <div className={board.lanes.length === 1 ? 'lanes single' : 'lanes'}>
          {board.lanes.map((lane, li) => (
            <section
              key={lane.id}
              className="lane"
              aria-label={`Coluna ${lane.name}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragging) moveBeatToLane(dragging, lane.id)
                setDragging(null)
              }}
            >
              <header className="lane-head">
                <input
                  aria-label="Nome da coluna"
                  value={lane.name}
                  onChange={(e) =>
                    onChange({ ...board, lanes: board.lanes.map((l) => (l.id === lane.id ? { ...l, name: e.target.value } : l)) })
                  }
                />
                <button className="icon" aria-label="Mover coluna para a esquerda" disabled={li === 0} onClick={() => laneShift(lane.id, -1)}>
                  ←
                </button>
                <button
                  className="icon"
                  aria-label="Mover coluna para a direita"
                  disabled={li === board.lanes.length - 1}
                  onClick={() => laneShift(lane.id, 1)}
                >
                  →
                </button>
                <button
                  className="icon"
                  aria-label="Apagar coluna"
                  onClick={() => {
                    const n = board.beats.filter((b) => b.lane === lane.id).length
                    if (n > 0 && !window.confirm(`Apagar a coluna e os ${n} beats dela?`)) return
                    onChange({
                      lanes: board.lanes.filter((l) => l.id !== lane.id),
                      beats: board.beats.filter((b) => b.lane !== lane.id)
                    })
                  }}
                >
                  ✕
                </button>
              </header>

              {board.beats
                .filter((b) => b.lane === lane.id)
                .map((beat, bi, arr) => (
                  <article
                    key={beat.id}
                    className="beat"
                    data-color={beat.color || undefined}
                    draggable
                    onDragStart={() => setDragging(beat.id)}
                    onDragEnd={() => setDragging(null)}
                  >
                    <input
                      aria-label="Título do beat"
                      className="beat-title"
                      value={beat.title}
                      onChange={(e) => setBeat(beat.id, { title: e.target.value })}
                    />
                    <textarea
                      aria-label="Descrição do beat"
                      rows={3}
                      value={beat.body}
                      onChange={(e) => setBeat(beat.id, { body: e.target.value })}
                    />
                    <div className="beat-actions">
                      <select
                        aria-label="Cor do beat"
                        value={beat.color}
                        onChange={(e) => setBeat(beat.id, { color: e.target.value })}
                      >
                        {COLORS.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      <button className="icon" aria-label="Subir beat" disabled={bi === 0} onClick={() => moveBeatInLane(beat.id, -1)}>
                        ↑
                      </button>
                      <button
                        className="icon"
                        aria-label="Descer beat"
                        disabled={bi === arr.length - 1}
                        onClick={() => moveBeatInLane(beat.id, 1)}
                      >
                        ↓
                      </button>
                      {links.has(beat.id) ? (
                        <button
                          className="btn ghost small"
                          aria-label={`Ir para a cena ${links.get(beat.id)!.scene}: ${links.get(beat.id)!.heading || 'sem cabeçalho'}`}
                          onClick={() => onGoToScene(links.get(beat.id)!.block)}
                        >
                          Cena {links.get(beat.id)!.scene}
                        </button>
                      ) : (
                        <button className="btn ghost small" onClick={() => onMakeScene(beat)}>
                          Virar cena
                        </button>
                      )}
                      <button
                        className="icon"
                        aria-label="Apagar beat"
                        onClick={() => onChange({ ...board, beats: board.beats.filter((b) => b.id !== beat.id) })}
                      >
                        ✕
                      </button>
                    </div>
                  </article>
                ))}
              <button className="btn ghost add-beat" onClick={() => addBeat(lane.id)}>
                + Beat
              </button>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
