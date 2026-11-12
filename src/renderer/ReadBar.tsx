import { useEffect, useMemo, useRef, useState } from 'react'
import type { Block, TableRead, VoiceRole } from '../shared/types'
import { PITCHES, RATES, buildReading, castVoices, speakers, type ReadItem } from '../shared/reading'

interface Props {
  /** The script as it is now (read when Ler is pressed). */
  getBlocks(): Block[]
  /** Block index of the caret: reading starts there. */
  caretBlock(): number
  tableRead: TableRead | undefined
  onTableRead(t: TableRead): void
  /** The line being read (null = none), to highlight it in the text. */
  onLine(block: number | null): void
  onClose(): void
}

type Status = 'idle' | 'playing' | 'paused'

/** Voices installed on this computer. Chromium lists them only after the first use of speech, so it asks once, silently. */
function useVoices(): SpeechSynthesisVoice[] | null {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[] | null>(null)
  useEffect(() => {
    const synth = window.speechSynthesis
    if (!synth) {
      setVoices([])
      return
    }
    let done = false
    const finish = (list: SpeechSynthesisVoice[]): void => {
      if (done) return
      done = true
      // the script's language first
      setVoices([...list].sort((a, b) => Number(!a.lang.toLowerCase().startsWith('pt')) - Number(!b.lang.toLowerCase().startsWith('pt'))))
    }
    const take = (): void => {
      const l = synth.getVoices()
      if (l.length) finish(l)
    }
    take()
    if (!done) {
      const wake = new SpeechSynthesisUtterance(' ')
      wake.volume = 0
      synth.speak(wake)
    }
    synth.addEventListener('voiceschanged', take)
    const poll = window.setInterval(take, 250)
    const give = window.setTimeout(() => finish(synth.getVoices()), 5000)
    return () => {
      done = true
      window.clearInterval(poll)
      window.clearTimeout(give)
      synth.removeEventListener('voiceschanged', take)
    }
  }, [])
  return voices
}

/** Table read: the script read aloud with the computer's voices, the narration in one voice and each character in another. */
export function ReadBar(p: Props): JSX.Element {
  const voices = useVoices()
  const [status, setStatus] = useState<Status>('idle')
  const [who, setWho] = useState<string | null>(null)
  const queue = useRef<ReadItem[]>([])
  // a reading that was stopped must not go on when its last line ends
  const run = useRef(0)
  const names = useMemo(() => voices?.map((v) => v.name) ?? [], [voices])
  const [cast, setCast] = useState<string[]>(() => speakers(p.getBlocks()))
  const settings = useMemo(() => castVoices(cast, names, p.tableRead), [cast, names, p.tableRead])
  const rate = settings.rate ?? 1
  const live = useRef(settings)
  live.current = settings
  // the voices panel closes like the other menus: a click elsewhere, or Esc
  const panel = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    const away = (e: MouseEvent): void => {
      const d = panel.current
      if (d?.open && !d.contains(e.target as Node)) d.open = false
    }
    const esc = (e: KeyboardEvent): void => {
      const d = panel.current
      if (e.key === 'Escape' && d?.open) {
        d.open = false
        d.querySelector('summary')?.focus()
      }
    }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [])

  const stop = (): void => {
    run.current++
    window.speechSynthesis?.cancel()
    setStatus('idle')
    setWho(null)
    p.onLine(null)
  }
  // closing the bar or leaving the script stops the reading
  useEffect(
    () => () => {
      run.current++
      window.speechSynthesis?.cancel()
    },
    []
  )

  const roleOf = (item: ReadItem): VoiceRole => {
    const s = live.current
    return (item.who && s.cast[item.who]) || s.narrator || { voice: names[0] ?? '', pitch: 1 }
  }

  const say = (text: string, role: VoiceRole, onDone?: () => void): void => {
    const u = new SpeechSynthesisUtterance(text)
    const v = voices?.find((x) => x.name === role.voice)
    if (v) {
      u.voice = v
      u.lang = v.lang
    } else u.lang = 'pt-BR'
    u.pitch = role.pitch
    u.rate = live.current.rate ?? 1
    if (onDone) {
      u.onend = onDone
      u.onerror = onDone
    }
    window.speechSynthesis.speak(u)
  }

  const speakAt = (i: number, mine: number): void => {
    if (mine !== run.current) return
    const item = queue.current[i]
    if (!item) {
      setStatus('idle')
      setWho(null)
      p.onLine(null)
      return
    }
    setWho(item.who)
    p.onLine(item.block)
    say(item.text, roleOf(item), () => speakAt(i + 1, mine))
  }

  const play = (): void => {
    if (status === 'paused') {
      window.speechSynthesis.resume()
      setStatus('playing')
      return
    }
    const blocks = p.getBlocks()
    setCast(speakers(blocks))
    queue.current = buildReading(blocks, p.caretBlock(), settings.names === true)
    window.speechSynthesis.cancel()
    const mine = ++run.current
    setStatus('playing')
    speakAt(0, mine)
  }

  const pause = (): void => {
    window.speechSynthesis.pause()
    setStatus('paused')
  }

  const change = (patch: Partial<typeof settings>): void => p.onTableRead({ ...settings, ...patch })
  const setRole = (name: string | null, patch: Partial<VoiceRole>): void => {
    if (name === null) change({ narrator: { ...(settings.narrator ?? { voice: names[0] ?? '', pitch: 1 }), ...patch } })
    else change({ cast: { ...settings.cast, [name]: { ...settings.cast[name], ...patch } } })
  }

  if (voices === null) {
    return (
      <div className="findbar readbar" role="region" aria-label="Leitura em voz alta">
        <span className="muted">Preparando as vozes…</span>
        <button className="btn ghost" aria-label="Fechar leitura" onClick={p.onClose}>
          ✕
        </button>
      </div>
    )
  }
  if (voices.length === 0) {
    return (
      <div className="findbar readbar" role="region" aria-label="Leitura em voz alta">
        <span>
          Este computador não tem vozes de leitura. No Windows: Configurações → Hora e idioma → Fala → Adicionar vozes (Português do Brasil).
        </span>
        <button className="btn ghost" aria-label="Fechar leitura" onClick={p.onClose}>
          ✕
        </button>
      </div>
    )
  }

  const roleRow = (name: string | null): JSX.Element => {
    const role = name === null ? settings.narrator ?? { voice: names[0], pitch: 1 } : settings.cast[name]
    const label = name ?? 'Narrador'
    return (
      <tr key={label}>
        <th scope="row">{name === null ? 'Narrador (cabeçalhos e ação)' : name}</th>
        <td>
          <select aria-label={`Voz de ${label}`} value={role?.voice ?? ''} onChange={(e) => setRole(name, { voice: e.target.value })}>
            {voices.map((v) => (
              <option key={v.name} value={v.name}>
                {v.name.replace(/^Microsoft\s+/, '').replace(/\s*-\s*Portuguese \(Brazil\)$/, '')}
              </option>
            ))}
          </select>
        </td>
        <td>
          <select aria-label={`Tom de ${label}`} value={role?.pitch ?? 1} onChange={(e) => setRole(name, { pitch: Number(e.target.value) })}>
            {PITCHES.map((x) => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </select>
        </td>
        <td>
          <button
            className="btn ghost"
            aria-label={`Ouvir a voz de ${label}`}
            onClick={() => {
              window.speechSynthesis.cancel()
              say(name === null ? 'Interior. Cozinha, dia.' : `Eu sou ${name.charAt(0)}${name.slice(1).toLocaleLowerCase('pt-BR')}.`, role ?? { voice: names[0], pitch: 1 })
            }}
          >
            Ouvir
          </button>
        </td>
      </tr>
    )
  }

  return (
    <div className="findbar readbar" role="region" aria-label="Leitura em voz alta">
      {status === 'playing' ? (
        <button className="btn secondary" onClick={pause}>
          Pausar
        </button>
      ) : (
        <button className="btn primary" title="Lê a partir da linha do cursor" onClick={play}>
          {status === 'paused' ? 'Continuar' : 'Ler do cursor'}
        </button>
      )}
      <button className="btn ghost" disabled={status === 'idle'} onClick={stop}>
        Parar
      </button>
      <label className="sr-only" htmlFor="read-rate">
        Velocidade
      </label>
      <select id="read-rate" value={rate} onChange={(e) => change({ rate: Number(e.target.value) })}>
        {RATES.map((r) => (
          <option key={r} value={r}>
            Velocidade {String(r).replace('.', ',')}×
          </option>
        ))}
      </select>
      <label className="check">
        <input type="checkbox" checked={settings.names === true} onChange={(e) => change({ names: e.target.checked })} />
        Ler os nomes
      </label>
      <details className="read-voices" ref={panel}>
        <summary>Vozes</summary>
        <div className="read-voices-panel">
          <table>
            <thead>
              <tr>
                <th scope="col">Quem</th>
                <th scope="col">Voz</th>
                <th scope="col">Tom</th>
                <th scope="col">
                  <span className="sr-only">Ouvir</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {roleRow(null)}
              {cast.map((n) => roleRow(n))}
            </tbody>
          </table>
          {names.length < 3 && (
            <p className="muted small">
              Há {names.length} {names.length === 1 ? 'voz instalada' : 'vozes instaladas'}: os personagens dividem as vozes em tons diferentes. Mais vozes: Configurações do Windows → Hora e idioma → Fala.
            </p>
          )}
        </div>
      </details>
      <span className="muted read-who">
        {status === 'idle' ? '' : `${status === 'paused' ? 'Pausado' : 'Lendo'}: ${who ?? 'narrador'}`}
      </span>
      <button
        className="btn ghost"
        aria-label="Fechar leitura"
        onClick={() => {
          stop()
          p.onClose()
        }}
      >
        ✕
      </button>
    </div>
  )
}
