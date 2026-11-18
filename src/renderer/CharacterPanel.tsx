import { useMemo, useRef } from 'react'
import type { CharacterSheet, Person, Script } from '../shared/types'
import { whoPlays } from '../shared/people'
import { FIELDS, listCharacters, setSheet } from '../shared/characters'
import { fileToDataUrl } from './Storyboard'

interface Props {
  script: Script
  /** The character shown (its key, "MARINA"); null = the first one. */
  selected: string | null
  onSelect(key: string): void
  onChange(sheets: CharacterSheet[]): void
  flash(text: string): void
  /** Filmagem → Elenco: who plays the character. */
  people: Person[]
}

/** A character's sheet beside the script: the same sheet as in Relatórios, written without leaving the text. */
export function CharacterPanel(p: Props): JSX.Element {
  const sheets = p.script.characters ?? []
  const entries = useMemo(() => listCharacters({ ...p.script, characters: sheets }), [p.script, sheets])
  const picker = useRef<HTMLInputElement>(null)
  const current = entries.find((e) => e.key === p.selected) ?? entries[0] ?? null
  const sheet = current?.sheet ?? null
  const patch = (changes: Partial<CharacterSheet>): void => {
    if (current) p.onChange(setSheet(sheets, current.name, changes))
  }

  return (
    <section className="side-char" aria-label="Ficha do personagem">
      {entries.length === 0 ? (
        <p className="muted">Ninguém fala no roteiro ainda. Escreva uma fala, ou crie o personagem em Relatórios → Fichas de personagem.</p>
      ) : (
        <>
          <label htmlFor="side-char-pick">Personagem</label>
          <select id="side-char-pick" value={current?.key ?? ''} onChange={(e) => p.onSelect(e.target.value)}>
            {entries.map((e) => (
              <option key={e.key} value={e.key}>
                {e.key}
              </option>
            ))}
          </select>
          {current && (
            <>
              <p className="muted small">
                {current.stats ? `${current.stats.lines} ${current.stats.lines === 1 ? 'fala' : 'falas'} · ${current.stats.scenes} ${current.stats.scenes === 1 ? 'cena' : 'cenas'}` : 'ainda não fala'}
              </p>
              {(() => {
                const actor = whoPlays(p.people, current.name)
                return actor ? <p className="side-actor">Interpretado por {actor.name || 'sem nome'}</p> : null
              })()}
              <div className="side-photo">
                {sheet?.image ? <img src={sheet.image} alt={`Imagem de referência de ${current.name}`} /> : <span className="muted">Sem imagem</span>}
              </div>
              <input
                ref={picker}
                type="file"
                accept="image/*"
                hidden
                aria-label="Escolher imagem do personagem"
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (!f) return
                  try {
                    patch({ image: await fileToDataUrl(f, 900) })
                  } catch (err) {
                    p.flash(err instanceof Error ? err.message : 'Não consegui ler a imagem.')
                  }
                }}
              />
              <div className="row">
                <button className="btn secondary small" onClick={() => picker.current?.click()}>
                  {sheet?.image ? 'Trocar imagem' : 'Escolher imagem'}
                </button>
                {sheet?.image && (
                  <button className="btn ghost small" onClick={() => patch({ image: '' })}>
                    Remover imagem
                  </button>
                )}
              </div>
              {FIELDS.map((f) => (
                <div key={f.key} className="side-field">
                  <label htmlFor={`sc-${f.key}`}>{f.label}</label>
                  {f.multiline ? (
                    <textarea id={`sc-${f.key}`} rows={2} placeholder={f.hint} value={sheet?.[f.key] ?? ''} onChange={(e) => patch({ [f.key]: e.target.value })} />
                  ) : (
                    <input id={`sc-${f.key}`} placeholder={f.hint} value={sheet?.[f.key] ?? ''} onChange={(e) => patch({ [f.key]: e.target.value })} />
                  )}
                </div>
              ))}
            </>
          )}
        </>
      )}
    </section>
  )
}
