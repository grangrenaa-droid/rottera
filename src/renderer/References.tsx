import { useRef, useState } from 'react'
import type { Reference, ReferenceKind } from '../shared/types'
import type { SceneInfo } from '../shared/production'
import { REFERENCE_KINDS } from '../shared/storyboard'
import { newId } from '../shared/structures'
import { fileToDataUrl } from './Storyboard'

interface Props {
  references: Reference[]
  scenes: SceneInfo[]
  /** The scene's id, given to its heading first if it has none. */
  sceneId(s: SceneInfo): string | null
  onChange(refs: Reference[]): void
  flash(text: string): void
}

/** Reference images (light, colour, wardrobe, location, framing), each with a caption, a kind and its scenes. */
export function ReferencesView(p: Props): JSX.Element {
  const picker = useRef<HTMLInputElement>(null)
  const [scene, setScene] = useState('')
  const [kind, setKind] = useState<ReferenceKind | ''>('')
  const shown = p.references.filter((r) => (!kind || r.kind === kind) && (!scene || r.scenes.length === 0 || r.scenes.includes(scene)))

  const put = (id: string, patch: Partial<Reference>): void => p.onChange(p.references.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const add = async (files: File[]): Promise<void> => {
    const added: Reference[] = []
    for (const f of files) {
      if (p.references.length + added.length >= 300) {
        p.flash('O storyboard guarda até 300 referências.')
        break
      }
      try {
        added.push({ id: newId('ref'), image: await fileToDataUrl(f, 1600), caption: '', kind: kind || 'other', scenes: scene && !scene.startsWith('sem-id-') ? [scene] : [] })
      } catch (err) {
        p.flash(err instanceof Error ? err.message : 'Não consegui ler a imagem.')
      }
    }
    if (added.length) p.onChange([...p.references, ...added])
  }
  const toggleScene = (r: Reference, s: SceneInfo, on: boolean): void => {
    const id = p.sceneId(s)
    if (!id) return
    put(r.id, { scenes: on ? [...r.scenes.filter((x) => x !== id), id] : r.scenes.filter((x) => x !== id) })
  }
  const label = (s: SceneInfo): string => `${s.number} · ${s.heading || '(cabeçalho vazio)'}`

  return (
    <div className="refs">
      <div className="refs-bar">
        <input
          ref={picker}
          type="file"
          accept="image/*"
          multiple
          hidden
          aria-label="Escolher imagens de referência"
          onChange={(e) => {
            const files = [...(e.target.files ?? [])]
            void add(files).finally(() => {
              e.target.value = ''
            })
          }}
        />
        <button className="btn primary" onClick={() => picker.current?.click()}>
          + Imagens
        </button>
        <label className="refs-filter">
          Filtrar por cena
          <select value={scene} onChange={(e) => setScene(e.target.value)}>
            <option value="">Todas as cenas</option>
            {/* a scene nothing points to yet has no id: it shows the references for the whole film */}
            {p.scenes.map((s) => (
              <option key={s.index} value={s.id ?? `sem-id-${s.index}`}>
                {label(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="refs-filter">
          Filtrar por tipo
          <select value={kind} onChange={(e) => setKind(e.target.value as ReferenceKind | '')}>
            <option value="">Todos os tipos</option>
            {(Object.keys(REFERENCE_KINDS) as ReferenceKind[]).map((k) => (
              <option key={k} value={k}>
                {REFERENCE_KINDS[k]}
              </option>
            ))}
          </select>
        </label>
        <span className="muted small">
          {shown.length} de {p.references.length} {p.references.length === 1 ? 'referência' : 'referências'}
        </span>
      </div>
      {p.references.length === 0 && <p className="muted">Nenhuma referência ainda. Traga imagens de clima, cor, luz, figurino ou lugares para as cenas.</p>}
      <ol className="refs-grid">
        {shown.map((r) => {
          const n = p.references.indexOf(r) + 1
          const linked = p.scenes.filter((s) => s.id && r.scenes.includes(s.id))
          return (
            <li key={r.id} className="ref-card">
              <img src={r.image} alt={r.caption || `Referência ${n}`} />
              <textarea rows={2} maxLength={600} placeholder="O que esta imagem mostra para a cena" aria-label={`Legenda da referência ${n}`} value={r.caption} onChange={(e) => put(r.id, { caption: e.target.value })} />
              <div className="row">
                <select aria-label={`Tipo da referência ${n}`} value={r.kind} onChange={(e) => put(r.id, { kind: e.target.value as ReferenceKind })}>
                  {(Object.keys(REFERENCE_KINDS) as ReferenceKind[]).map((k) => (
                    <option key={k} value={k}>
                      {REFERENCE_KINDS[k]}
                    </option>
                  ))}
                </select>
                <button className="icon" aria-label={`Apagar a referência ${n}`} onClick={() => p.onChange(p.references.filter((x) => x.id !== r.id))}>
                  ×
                </button>
              </div>
              <details className="snd-song-scenes">
                <summary>Cenas: {linked.length ? linked.map((s) => s.number).join(', ') : 'o filme todo'}</summary>
                <div className="snd-choices">
                  {p.scenes.map((s) => (
                    <label key={s.index} className="check">
                      <input type="checkbox" checked={!!s.id && r.scenes.includes(s.id)} onChange={(e) => toggleScene(r, s, e.target.checked)} />
                      {label(s)}
                    </label>
                  ))}
                </div>
              </details>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
