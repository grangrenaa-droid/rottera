import { useState } from 'react'
import type { Storyboard } from '../shared/types'
import type { SceneInfo } from '../shared/production'
import { StoryboardView } from './Storyboard'
import { ReferencesView } from './References'

interface Props {
  storyboard: Storyboard
  /** The scenes as the frames' scene picker lists them. */
  frameScenes: { number: string; text: string }[]
  scenes: SceneInfo[]
  sceneId(s: SceneInfo): string | null
  onChange(sb: Storyboard): void
  onExport(): void
  flash(text: string): void
  focusScene?: string
}

/** The Storyboard window: the frames, and the reference images. */
export function StoryboardWindow(p: Props): JSX.Element {
  const [tab, setTab] = useState<'frames' | 'refs'>('frames')
  return (
    <div className="sb-window">
      <div className="seg snd-tabs sb-tabs" role="group" aria-label="Storyboard">
        <button className="btn ghost" aria-pressed={tab === 'frames'} onClick={() => setTab('frames')}>
          Quadros
        </button>
        <button className="btn ghost" aria-pressed={tab === 'refs'} onClick={() => setTab('refs')}>
          Referências
        </button>
      </div>
      {tab === 'frames' ? (
        <StoryboardView storyboard={p.storyboard} scenes={p.frameScenes} onChange={p.onChange} onExport={p.onExport} flash={p.flash} focusScene={p.focusScene} />
      ) : (
        <ReferencesView
          references={p.storyboard.references ?? []}
          scenes={p.scenes}
          sceneId={p.sceneId}
          flash={p.flash}
          onChange={(refs) => {
            const next: Storyboard = { ...p.storyboard, references: refs }
            if (!refs.length) delete next.references
            p.onChange(next)
          }}
        />
      )}
    </div>
  )
}
