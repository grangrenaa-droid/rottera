import { useMemo, useRef, useState } from 'react'
import type { CharacterSheet, Script } from '../shared/types'
import { FIELDS, characterKey, listCharacters, newSheet, presentationOf, sheetIsEmpty } from '../shared/characters'
import { fileToDataUrl } from './Storyboard'

interface Props {
  script: Script
  onChange(sheets: CharacterSheet[]): void
  onExport(): void
  flash(text: string): void
}

/** Character sheets. What is written here flows straight into the presentation next to it, and into the PDF. */
export function CharactersView({ script, onChange, onExport, flash }: Props): JSX.Element {
  const sheets = script.characters ?? []
  const entries = useMemo(() => listCharacters({ ...script, characters: sheets }), [script, sheets])
  const [selected, setSelected] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const picker = useRef<HTMLInputElement>(null)

  const current = entries.find((e) => e.key === selected) ?? entries[0] ?? null
  const key = current?.key ?? null

  const patch = (changes: Partial<CharacterSheet>): void => {
    if (!current) return
    const existing = sheets.find((s) => characterKey(s.name) === current.key)
    if (existing) {
      onChange(sheets.map((s) => (s.id === existing.id ? { ...s, ...changes } : s)))
    } else {
      onChange([...sheets, { ...newSheet(current.name), ...changes }])
    }
  }

  const addCharacter = (): void => {
    const name = newName.trim()
    if (!name) return
    if (entries.some((e) => e.key === characterKey(name))) {
      setSelected(characterKey(name))
      flash(`${name.toUpperCase()} já está na lista.`)
    } else {
      onChange([...sheets, newSheet(name)])
      setSelected(characterKey(name))
    }
    setNewName('')
  }

  const clearCurrent = (): void => {
    if (!current) return
    const existing = sheets.find((s) => characterKey(s.name) === current.key)
    if (!existing) return
    if (!sheetIsEmpty(existing) && !window.confirm(`Apagar a ficha de ${current.name}?`)) return
    onChange(sheets.filter((s) => s.id !== existing.id))
  }

  const sheet = current?.sheet ?? null
  const presentation = current ? presentationOf(sheet, current.name, current.stats) : null

  return (
    <div className="chars">
      <aside className="chars-list" aria-label="Personagens">
        <h2>Personagens ({entries.length})</h2>
        {entries.length === 0 ? (
          <p className="muted">Ninguém fala no roteiro ainda. Crie um personagem abaixo ou escreva uma fala.</p>
        ) : (
          <ul>
            {entries.map((e) => (
              <li key={e.key}>
                <button className={e.key === key ? 'on' : ''} aria-current={e.key === key} onClick={() => setSelected(e.key)}>
                  <b>{e.name}</b>
                  <span className="muted">
                    {e.stats ? `${e.stats.lines} ${e.stats.lines === 1 ? 'fala' : 'falas'} · ${e.stats.scenes} ${e.stats.scenes === 1 ? 'cena' : 'cenas'}` : 'ainda não fala'}
                    {!sheetIsEmpty(e.sheet) ? ' · ficha preenchida' : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="row"
          onSubmit={(ev) => {
            ev.preventDefault()
            addCharacter()
          }}
        >
          <label className="sr-only" htmlFor="new-char">
            Nome do novo personagem
          </label>
          <input id="new-char" placeholder="Novo personagem" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <button type="submit" className="btn secondary small">
            Adicionar
          </button>
        </form>
        <button className="btn secondary" onClick={onExport}>
          Exportar fichas (PDF)
        </button>
      </aside>

      {current && presentation ? (
        <>
          <section className="chars-form" aria-label={`Ficha de ${current.name}`}>
            <h2>Ficha de {current.name}</h2>
            <div className="chars-image">
              <div className="chars-photo">
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
                    flash(err instanceof Error ? err.message : 'Não consegui ler a imagem.')
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
            </div>

            {FIELDS.map((f) => (
              <div key={f.key} className="chars-field">
                <label htmlFor={`cf-${f.key}`}>{f.label}</label>
                {f.multiline ? (
                  <textarea
                    id={`cf-${f.key}`}
                    rows={3}
                    placeholder={f.hint}
                    value={sheet?.[f.key] ?? ''}
                    onChange={(e) => patch({ [f.key]: e.target.value })}
                  />
                ) : (
                  <input id={`cf-${f.key}`} placeholder={f.hint} value={sheet?.[f.key] ?? ''} onChange={(e) => patch({ [f.key]: e.target.value })} />
                )}
              </div>
            ))}

            <label className="check">
              <input type="checkbox" checked={sheet?.includeInPdf !== false} onChange={(e) => patch({ includeInPdf: e.target.checked })} />
              Incluir no PDF do roteiro
            </label>
            {sheet && (
              <button className="btn ghost small" onClick={clearCurrent}>
                {current.inScript ? 'Limpar a ficha' : 'Apagar personagem'}
              </button>
            )}
          </section>

          <section className="chars-card" aria-label="Apresentação do personagem">
            <p className="muted chars-live">Apresentação · atualiza sozinha quando você muda a ficha</p>
            <article className="card" aria-live="polite">
              <header>
                {presentation.image && <img src={presentation.image} alt="" />}
                <div>
                  <h3>{presentation.title}</h3>
                  {presentation.subtitle && <p className="sub">{presentation.subtitle}</p>}
                </div>
              </header>
              {presentation.empty && <p className="muted">A ficha está vazia. Escreva ao lado e tudo aparece aqui.</p>}
              {presentation.sections.map((s) => (
                <section key={s.heading}>
                  <h4>{s.heading}</h4>
                  <p>{s.text}</p>
                </section>
              ))}
              <section>
                <h4>No roteiro</h4>
                <ul>
                  {presentation.inScript.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </section>
            </article>
          </section>
        </>
      ) : (
        <p className="muted chars-empty">Escolha ou crie um personagem.</p>
      )}
    </div>
  )
}
