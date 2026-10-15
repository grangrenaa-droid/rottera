import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Frame, Storyboard, StoryboardAspect, StoryboardLayout } from '../shared/types'
import { ASPECTS, LAYOUTS, aspectRatio, placeInScene, storyboardMegabytes } from '../shared/storyboard'
import { newId } from '../shared/structures'

const MAX_SIDE = 1600
const MAX_SOURCE_BYTES = 25 * 1024 * 1024

/** Reads an image file and returns a JPEG data URL no larger than MAX_SIDE on its long edge. */
export async function fileToDataUrl(file: File, maxSide: number = MAX_SIDE): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error(`"${file.name}" não é uma imagem.`)
  if (file.size > MAX_SOURCE_BYTES) throw new Error(`"${file.name}" tem mais de 25 MB.`)
  let bmp: ImageBitmap
  try {
    bmp = await createImageBitmap(file)
  } catch {
    throw new Error(`Não consegui ler "${file.name}".`)
  }
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
  const w = Math.max(1, Math.round(bmp.width * scale))
  const h = Math.max(1, Math.round(bmp.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não consegui processar a imagem.')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  return canvas.toDataURL('image/jpeg', 0.85)
}

interface Props {
  storyboard: Storyboard
  scenes: { number: string; text: string }[]
  onChange(sb: Storyboard): void
  onExport(): void
  flash(text: string): void
}

export function StoryboardView({ storyboard, scenes, onChange, onExport, flash }: Props): JSX.Element {
  const { frames } = storyboard
  const addInput = useRef<HTMLInputElement>(null)
  const replaceInput = useRef<HTMLInputElement>(null)
  const [replaceId, setReplaceId] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [jumpId, setJumpId] = useState<string | null>(null)
  const sbRef = useRef(storyboard)
  sbRef.current = storyboard

  const lay = LAYOUTS.find((l) => l.id === storyboard.layout) ?? LAYOUTS[2]
  const per = lay.cols * lay.rows
  const mb = useMemo(() => storyboardMegabytes(frames), [frames])
  const pages = Math.ceil(frames.length / per)

  const addFiles = useCallback(
    async (files: File[]) => {
      const images = files.filter((f) => f.type.startsWith('image/'))
      if (images.length === 0) {
        if (files.length > 0) flash('Os arquivos não são imagens.')
        return
      }
      setBusy(true)
      const added: Frame[] = []
      const problems: string[] = []
      for (const f of images) {
        try {
          added.push({ id: newId('frame'), image: await fileToDataUrl(f), caption: '', scene: '' })
        } catch (e) {
          problems.push(e instanceof Error ? e.message : 'Erro ao ler a imagem.')
        }
      }
      setBusy(false)
      if (added.length > 0) onChange({ ...sbRef.current, frames: [...sbRef.current.frames, ...added] })
      flash(
        problems.length
          ? `${added.length} imagem(ns) adicionada(s). ${problems[0]}`
          : `${added.length} imagem(ns) adicionada(s).`
      )
    },
    [onChange, flash]
  )

  // paste an image from the clipboard
  useEffect(() => {
    const onPaste = (e: ClipboardEvent): void => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT')) return
      const files = [...(e.clipboardData?.files ?? [])]
      if (files.length > 0) {
        e.preventDefault()
        void addFiles(files)
      }
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [addFiles])

  const setFrame = (id: string, patch: Partial<Frame>): void =>
    onChange({ ...storyboard, frames: frames.map((f) => (f.id === id ? { ...f, ...patch } : f)) })

  // a frame that had no scene jumps next to the scene it was given
  const setScene = (f: Frame, scene: string): void => {
    if (f.scene || !scene) return setFrame(f.id, { scene })
    const placed = placeInScene(frames, f.id, scene, scenes.map((s) => s.number))
    onChange({ ...storyboard, frames: placed.frames })
    if (placed.index !== frames.indexOf(f)) {
      setJumpId(f.id)
      flash(`Quadro levado para a cena ${scene}: agora é o quadro ${placed.index + 1}.`)
    }
  }

  // keep the jumped frame in sight
  useEffect(() => {
    if (!jumpId) return
    const el = document.getElementById(`scene-${jumpId}`)
    el?.closest('li')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    el?.focus({ preventScroll: true })
    setJumpId(null)
  }, [jumpId])

  const move = (id: string, to: number): void => {
    const from = frames.findIndex((f) => f.id === id)
    if (from < 0 || to < 0 || to >= frames.length || from === to) return
    const next = frames.slice()
    const [m] = next.splice(from, 1)
    next.splice(to, 0, m)
    onChange({ ...storyboard, frames: next })
  }

  const ratio = aspectRatio(storyboard.aspect)

  return (
    <div
      className={over ? 'sb-view over' : 'sb-view'}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault()
          setOver(true)
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false)
        if (e.dataTransfer.files.length > 0) {
          e.preventDefault()
          void addFiles([...e.dataTransfer.files])
        }
      }}
    >
      <div className="board-bar">
        <input
          ref={addInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          aria-label="Escolher imagens"
          onChange={(e) => {
            void addFiles([...(e.target.files ?? [])])
            e.target.value = ''
          }}
        />
        <input
          ref={replaceInput}
          type="file"
          accept="image/*"
          hidden
          aria-label="Escolher imagem de substituição"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f || !replaceId) return
            try {
              setFrame(replaceId, { image: await fileToDataUrl(f) })
            } catch (err) {
              flash(err instanceof Error ? err.message : 'Erro ao ler a imagem.')
            }
          }}
        />
        <button className="btn primary" disabled={busy} onClick={() => addInput.current?.click()}>
          Adicionar imagens…
        </button>
        <button
          className="btn secondary"
          onClick={() =>
            onChange({ ...storyboard, frames: [...frames, { id: newId('frame'), image: '', caption: '', scene: '' }] })
          }
        >
          Quadro vazio
        </button>
        <label htmlFor="sb-aspect">Proporção</label>
        <select
          id="sb-aspect"
          value={storyboard.aspect}
          onChange={(e) => onChange({ ...storyboard, aspect: e.target.value as StoryboardAspect })}
        >
          {ASPECTS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
        <label htmlFor="sb-layout">Quadros</label>
        <select
          id="sb-layout"
          value={storyboard.layout}
          onChange={(e) => onChange({ ...storyboard, layout: Number(e.target.value) as StoryboardLayout })}
        >
          {LAYOUTS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
        <label className="check">
          <input
            type="checkbox"
            checked={storyboard.includeInPdf}
            onChange={(e) => onChange({ ...storyboard, includeInPdf: e.target.checked })}
          />
          Incluir no PDF do roteiro
        </label>
        <button className="btn secondary" disabled={frames.length === 0} onClick={onExport}>
          Exportar só o storyboard
        </button>
      </div>

      <p className="muted sb-summary" role="status">
        {frames.length === 0
          ? 'Arraste imagens para cá, cole da área de transferência ou use “Adicionar imagens…”.'
          : `${frames.length} quadro(s) · ${pages} página(s) no PDF · ${mb.toFixed(1)} MB de imagens`}
        {mb > 40 ? ' · muitas imagens: o arquivo do roteiro vai ficar grande.' : ''}
      </p>

      {frames.length > 0 && (
        <ol className="sb-grid">
          {frames.map((f, i) => (
            <li
              key={f.id}
              className={dragId === f.id ? 'sb-card dragging' : 'sb-card'}
              draggable
              onDragStart={(e) => {
                setDragId(f.id)
                e.dataTransfer.setData('text/plain', f.id)
              }}
              onDragEnd={() => setDragId(null)}
              onDragOver={(e) => {
                if (dragId) e.preventDefault()
              }}
              onDrop={(e) => {
                if (!dragId) return
                e.preventDefault()
                e.stopPropagation()
                move(dragId, i)
                setDragId(null)
              }}
            >
              {i % per === 0 && <span className="sb-page">Página {i / per + 1}</span>}
              <div className="sb-pic" style={{ aspectRatio: String(ratio) }}>
                {f.image ? (
                  <img src={f.image} alt={f.caption || `Quadro ${i + 1}`} draggable={false} />
                ) : (
                  <button
                    className="btn ghost"
                    onClick={() => {
                      setReplaceId(f.id)
                      replaceInput.current?.click()
                    }}
                  >
                    Escolher imagem…
                  </button>
                )}
                <b className="sb-num">{i + 1}</b>
              </div>
              <label className="sr-only" htmlFor={`cap-${f.id}`}>
                Legenda do quadro {i + 1}
              </label>
              <textarea
                id={`cap-${f.id}`}
                rows={2}
                placeholder="Legenda: ação, enquadramento, som…"
                value={f.caption}
                onChange={(e) => setFrame(f.id, { caption: e.target.value })}
              />
              <div className="sb-actions">
                <label className="sr-only" htmlFor={`scene-${f.id}`}>
                  Cena do quadro {i + 1}
                </label>
                <select id={`scene-${f.id}`} value={f.scene} onChange={(e) => setScene(f, e.target.value)}>
                  <option value="">Sem cena</option>
                  {scenes.map((s) => (
                    <option key={s.number} value={s.number}>
                      {s.number} · {s.text.slice(0, 28)}
                    </option>
                  ))}
                  {f.scene && !scenes.some((s) => s.number === f.scene) && <option value={f.scene}>{f.scene}</option>}
                </select>
                <button className="icon" aria-label={`Mover quadro ${i + 1} para antes`} disabled={i === 0} onClick={() => move(f.id, i - 1)}>
                  ←
                </button>
                <button
                  className="icon"
                  aria-label={`Mover quadro ${i + 1} para depois`}
                  disabled={i === frames.length - 1}
                  onClick={() => move(f.id, i + 1)}
                >
                  →
                </button>
                <button
                  className="btn ghost small"
                  onClick={() => {
                    setReplaceId(f.id)
                    replaceInput.current?.click()
                  }}
                >
                  Trocar imagem
                </button>
                <button
                  className="btn ghost small"
                  onClick={() => {
                    const copy = { ...f, id: newId('frame') }
                    const next = frames.slice()
                    next.splice(i + 1, 0, copy)
                    onChange({ ...storyboard, frames: next })
                  }}
                >
                  Duplicar
                </button>
                <button
                  className="icon"
                  aria-label={`Apagar quadro ${i + 1}`}
                  onClick={() => onChange({ ...storyboard, frames: frames.filter((x) => x.id !== f.id) })}
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
