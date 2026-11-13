import { useEffect, useRef } from 'react'
import type { OutlineGroup } from '../shared/beats'

export interface EscaletaProps {
  groups: OutlineGroup[]
  /** beat whose group should scroll into view (changes on every click on the card's scene count) */
  reveal: { beatId: string | null; n: number } | null
  /** block whose heading field gets the focus once, as soon as it shows up (a scene just created); `n` makes each request new */
  focusBlock: { block: number; n: number } | null
  onSetHeading(block: number, text: string): void
  onSetSynopsis(block: number, text: string): void
  onAddScene(beatId: string | null): void
  onGoToScene(block: number): void
}

/**
 * The step outline next to the Beat Board: every scene of the script, grouped by beat, with its heading and synopsis.
 * Fields are uncontrolled and keyed by their saved value, so an outside change refreshes them without wiping what is
 * being typed; they save when they lose focus.
 */
export function EscaletaView({ groups, reveal, focusBlock, onSetHeading, onSetSynopsis, onAddScene, onGoToScene }: EscaletaProps): JSX.Element {
  const root = useRef<HTMLElement>(null)
  const focused = useRef(0)

  useEffect(() => {
    if (!reveal) return
    const el = root.current?.querySelector<HTMLElement>(`.outline-group[data-beat="${CSS.escape(reveal.beatId ?? '')}"]`)
    el?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [reveal])

  // the new scene's field appears once the script has caught up; focus it then
  useEffect(() => {
    if (!focusBlock || focused.current === focusBlock.n) return
    const el = root.current?.querySelector<HTMLTextAreaElement>(`.outline-scene[data-block="${focusBlock.block}"] .outline-head textarea`)
    if (!el) return
    focused.current = focusBlock.n
    el.focus()
    el.select()
  }, [focusBlock, groups])

  return (
    <aside className="outline" aria-label="Escaleta" ref={root}>
      <h2>Escaleta</h2>
      {groups.length === 0 && <p className="muted">O roteiro ainda não tem cenas.</p>}
      {groups.map((g) => (
        <section key={`${g.beatId ?? ''}:${g.scenes[0]?.block ?? 0}`} className="outline-group" data-beat={g.beatId ?? ''}>
          <h3>{g.title}</h3>
          {g.scenes.map((s) => (
            <div key={s.block} className="outline-scene" data-block={s.block}>
              <div className="outline-head">
                <span className="outline-num">{s.scene}</span>
                {/* a one-line textarea, so a long heading wraps instead of being cut; Enter never adds a line */}
                <textarea
                  key={`${s.block}:${s.heading}`}
                  rows={1}
                  aria-label={`Cabeçalho da cena ${s.scene}`}
                  defaultValue={s.heading}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      e.currentTarget.blur()
                    }
                  }}
                  onBlur={(e) => {
                    // a heading is one line, even when pasted with line breaks
                    const v = e.currentTarget.value.replace(/\s*[\r\n]+\s*/g, ' ').trim()
                    // an emptied heading keeps the old one: a scene without a heading is not a scene
                    if (!v) e.currentTarget.value = s.heading
                    else if (v !== s.heading) onSetHeading(s.block, v)
                  }}
                />
                <button className="icon" aria-label={`Ir para a cena ${s.scene} no roteiro`} title="Ir para a cena no roteiro" onClick={() => onGoToScene(s.block)}>
                  →
                </button>
              </div>
              <textarea
                key={`${s.block}:${s.synopsis}`}
                aria-label={`Sinopse da cena ${s.scene}`}
                placeholder="Sinopse: o que acontece e o que muda"
                defaultValue={s.synopsis}
                onBlur={(e) => {
                  if (e.currentTarget.value !== s.synopsis) onSetSynopsis(s.block, e.currentTarget.value)
                }}
              />
            </div>
          ))}
          <button className="btn ghost small outline-add" aria-label={`Nova cena em ${g.title}`} onClick={() => onAddScene(g.beatId)}>
            + cena neste beat
          </button>
        </section>
      ))}
    </aside>
  )
}
