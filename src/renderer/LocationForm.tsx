import { useRef } from 'react'
import type { LocationSheet } from '../shared/types'
import { LOCATION_FIELDS, PERMITS, emptyLocation } from '../shared/locations'
import { newId } from '../shared/structures'
import { fileToDataUrl } from './Storyboard'

interface Props {
  /** The location as the headings write it ("COZINHA"). */
  name: string
  sheet: LocationSheet | undefined
  onChange(patch: Partial<LocationSheet>): void
  flash(text: string): void
  /** Keeps ids apart when the form shows in two places. */
  idPrefix: string
}

/** A location's technical sheet: permit, who to call, power, parking, noise, and the scouting photos. */
export function LocationForm(p: Props): JSX.Element {
  const l = p.sheet ?? emptyLocation()
  const picker = useRef<HTMLInputElement>(null)
  const id = (k: string): string => `${p.idPrefix}-${k}`

  const addPhotos = async (files: FileList | null): Promise<void> => {
    const list = [...(files ?? [])]
    const photos = [...l.photos]
    for (const f of list) {
      if (photos.length >= 12) {
        p.flash('Cada locação guarda até 12 fotos.')
        break
      }
      try {
        photos.push({ id: newId('foto'), image: await fileToDataUrl(f, 1400), caption: '' })
      } catch (err) {
        p.flash(err instanceof Error ? err.message : 'Não consegui ler a imagem.')
      }
    }
    if (photos.length !== l.photos.length) p.onChange({ photos })
  }

  return (
    <section className="loc-form" aria-label={`Ficha da locação ${p.name}`}>
      <fieldset>
        <legend>Autorização</legend>
        <div className="snd-choices">
          {(Object.keys(PERMITS) as NonNullable<LocationSheet['permit']>[]).map((k) => (
            <label key={k} className="check">
              <input type="radio" name={id('permit')} checked={l.permit === k} onChange={() => p.onChange({ permit: k })} />
              {PERMITS[k]}
            </label>
          ))}
        </div>
      </fieldset>
      {LOCATION_FIELDS.map((f) => (
        <div key={f.key} className="loc-field">
          <label htmlFor={id(f.key)}>{f.label}</label>
          {f.long ? (
            <textarea id={id(f.key)} rows={2} maxLength={2000} placeholder={f.hint} value={l[f.key]} onChange={(e) => p.onChange({ [f.key]: e.target.value })} />
          ) : (
            <input id={id(f.key)} maxLength={200} placeholder={f.hint} value={l[f.key]} onChange={(e) => p.onChange({ [f.key]: e.target.value })} />
          )}
        </div>
      ))}
      <fieldset>
        <legend>Fotos de scouting</legend>
        {l.photos.length === 0 && <p className="muted small">Nenhuma foto ainda.</p>}
        <ul className="loc-photos">
          {l.photos.map((ph, i) => (
            <li key={ph.id}>
              <img src={ph.image} alt={`Foto ${i + 1} de ${p.name}`} />
              <input
                maxLength={200}
                placeholder="Legenda"
                aria-label={`Legenda da foto ${i + 1} de ${p.name}`}
                value={ph.caption}
                onChange={(e) => p.onChange({ photos: l.photos.map((x) => (x.id === ph.id ? { ...x, caption: e.target.value } : x)) })}
              />
              <button className="icon" aria-label={`Tirar a foto ${i + 1} de ${p.name}`} onClick={() => p.onChange({ photos: l.photos.filter((x) => x.id !== ph.id) })}>
                ×
              </button>
            </li>
          ))}
        </ul>
        <input
          ref={picker}
          type="file"
          accept="image/*"
          multiple
          hidden
          aria-label={`Escolher fotos de ${p.name}`}
          onChange={(e) => {
            const files = e.target.files
            void addPhotos(files).finally(() => {
              e.target.value = ''
            })
          }}
        />
        <button className="btn secondary small" onClick={() => picker.current?.click()}>
          + Fotos
        </button>
      </fieldset>
    </section>
  )
}
