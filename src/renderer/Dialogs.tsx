import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Block, Extras, TitlePage } from '../shared/types'
import { emptyExtras } from '../shared/types'
import { TEMPLATES, type Template } from '../shared/templates'
import { collectLists } from '../shared/smarttype'
import { usageCounts } from '../shared/rename'
import type { BackupInfo, ConnectInfo } from '../shared/api'
import { MANUAL, searchManual, type ManualTopic } from '../shared/manual'

function Modal(props: { title: string; onClose(): void; children: ReactNode; wide?: boolean }): JSX.Element {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  return (
    <dialog ref={ref} onClose={props.onClose} aria-labelledby="dlg-h" className={props.wide ? 'wide' : undefined}>
      <h2 id="dlg-h">{props.title}</h2>
      {props.children}
    </dialog>
  )
}

export function TitleDialog(props: {
  value: TitlePage
  onSave(t: TitlePage): void
  onClose(): void
}): JSX.Element {
  const [t, setT] = useState(props.value)
  return (
    <Modal title="Página de título" onClose={props.onClose}>
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault()
          props.onSave(t)
        }}
      >
        <label htmlFor="tp-title">Título</label>
        <input id="tp-title" value={t.title} onChange={(e) => setT({ ...t, title: e.target.value })} />
        <label htmlFor="tp-author">Autor</label>
        <input id="tp-author" value={t.author} onChange={(e) => setT({ ...t, author: e.target.value })} />
        <label htmlFor="tp-contact">Contato</label>
        <textarea id="tp-contact" rows={3} value={t.contact} onChange={(e) => setT({ ...t, contact: e.target.value })} />
        <div className="row end">
          <button type="button" className="btn secondary" onClick={props.onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn primary">
            Salvar
          </button>
        </div>
      </form>
    </Modal>
  )
}

export function TemplatesDialog(props: { onPick(t: Template): void; onClose(): void }): JSX.Element {
  return (
    <Modal title="Novo roteiro a partir de modelo" onClose={props.onClose} wide>
      <ul className="templates">
        {TEMPLATES.map((t) => (
          <li key={t.id}>
            <button className="template" onClick={() => props.onPick(t)}>
              <strong>{t.name}</strong>
              <span className="muted">{t.description}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="row end">
        <button className="btn secondary" onClick={props.onClose}>
          Cancelar
        </button>
      </div>
    </Modal>
  )
}

type ListName = 'characters' | 'locations' | 'times'
const LIST_LABEL: Record<ListName, string> = {
  characters: 'Personagens',
  locations: 'Locais',
  times: 'Horários'
}

export function SmartTypeDialog(props: {
  blocks: Block[]
  extras: Extras | undefined
  onExtras(e: Extras): void
  onRename(kind: 'characters' | 'locations', from: string, to: string): number
  onClose(): void
}): JSX.Element {
  const extras = props.extras ?? emptyExtras()
  const [tab, setTab] = useState<ListName>('characters')
  const [draft, setDraft] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameTo, setRenameTo] = useState('')
  const [note, setNote] = useState('')

  const derived = useMemo(() => collectLists(props.blocks), [props.blocks])
  const usage = useMemo(() => usageCounts(props.blocks), [props.blocks])
  const custom = extras[tab]
  const all = useMemo(() => {
    const set = new Set<string>([...derived[tab], ...custom.map((c) => c.trim().toUpperCase())])
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [derived, custom, tab])

  const isCustom = (v: string): boolean => custom.some((c) => c.trim().toUpperCase() === v)
  const used = (v: string): number =>
    tab === 'characters' ? usage.characters.get(v) ?? 0 : tab === 'locations' ? usage.locations.get(v) ?? 0 : 0

  const add = (): void => {
    const v = draft.trim().toUpperCase()
    if (!v) return
    if (!isCustom(v)) props.onExtras({ ...extras, [tab]: [...custom, v] })
    setDraft('')
  }

  return (
    <Modal title="Gerenciar SmartType" onClose={props.onClose} wide>
      <p className="muted">
        As sugestões vêm do próprio roteiro. Aqui você acrescenta nomes que ainda não apareceram e renomeia personagens
        ou locais em todo o roteiro.
      </p>
      <div className="tabs" role="tablist">
        {(Object.keys(LIST_LABEL) as ListName[]).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            className={tab === k ? 'on' : ''}
            onClick={() => {
              setTab(k)
              setRenaming(null)
              setNote('')
            }}
          >
            {LIST_LABEL[k]}
          </button>
        ))}
      </div>
      <div className="row">
        <label className="sr-only" htmlFor="st-add">
          Novo item
        </label>
        <input
          id="st-add"
          value={draft}
          placeholder="Novo item"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add()
          }}
        />
        <button className="btn secondary" onClick={add}>
          Adicionar
        </button>
      </div>
      {all.length === 0 ? (
        <p className="muted">Nada aqui ainda.</p>
      ) : (
        <ul className="st-list">
          {all.map((v) => (
            <li key={v}>
              {renaming === v ? (
                <form
                  className="row"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (tab === 'times') return
                    const n = props.onRename(tab, v, renameTo)
                    setNote(`${n} ocorrência(s) renomeada(s).`)
                    setRenaming(null)
                  }}
                >
                  <input aria-label={`Novo nome para ${v}`} value={renameTo} onChange={(e) => setRenameTo(e.target.value)} autoFocus />
                  <button type="submit" className="btn primary small">
                    Renomear
                  </button>
                  <button type="button" className="btn ghost small" onClick={() => setRenaming(null)}>
                    Cancelar
                  </button>
                </form>
              ) : (
                <>
                  <span className="st-name">{v}</span>
                  <span className="muted">
                    {used(v) > 0 ? `${used(v)} no roteiro` : isCustom(v) ? 'adicionado' : 'no roteiro'}
                  </span>
                  {tab !== 'times' && used(v) > 0 && (
                    <button
                      className="btn ghost small"
                      onClick={() => {
                        setRenaming(v)
                        setRenameTo(v)
                      }}
                    >
                      Renomear em tudo
                    </button>
                  )}
                  {isCustom(v) && (
                    <button
                      className="btn ghost small"
                      onClick={() => props.onExtras({ ...extras, [tab]: custom.filter((c) => c.trim().toUpperCase() !== v) })}
                    >
                      Remover
                    </button>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <p role="status" className="muted">
        {note}
      </p>
      <div className="row end">
        <button className="btn primary" onClick={props.onClose}>
          Fechar
        </button>
      </div>
    </Modal>
  )
}

export function ConnectDialog(props: { onClose(): void; onCopied(): void }): JSX.Element {
  const [info, setInfo] = useState<ConnectInfo | null>(null)

  useEffect(() => {
    void window.api.connectInfo().then(setInfo)
  }, [])

  const copy = async (text: string): Promise<void> => {
    await window.api.copyText(text)
    props.onCopied()
  }

  return (
    <Modal title="Conectar ao Claude" onClose={props.onClose} wide>
      {!info ? (
        <p className="muted">Carregando…</p>
      ) : (
        <>
          <p>
            Com a conexão ligada, o Claude lê o roteiro aberto aqui e escreve nele: insere cenas, reescreve trechos,
            move cenas, procura e troca texto, consulta relatórios e preenche o Beat Board. Cada mudança aparece na
            hora e pode ser desfeita com Ctrl+Z. Nenhuma conta ou e-mail é necessário.
          </p>
          <label className="check">
            <input
              type="checkbox"
              checked={info.enabled}
              onChange={(e) => void window.api.connectSet(e.target.checked).then(setInfo)}
            />
            Permitir que o Claude edite o roteiro (somente neste computador)
          </label>
          <h3>Claude Code</h3>
          <p className="muted">Cole no terminal uma vez:</p>
          <pre className="code">{info.claudeCodeCommand}</pre>
          <button className="btn secondary" onClick={() => void copy(info.claudeCodeCommand)}>
            Copiar comando
          </button>
          <h3>Claude Desktop</h3>
          <p className="muted">Acrescente em claude_desktop_config.json e reinicie o Claude:</p>
          <pre className="code">{info.desktopConfig}</pre>
          <button className="btn secondary" onClick={() => void copy(info.desktopConfig)}>
            Copiar configuração
          </button>
          <p className="muted">
            A ponte só escuta em 127.0.0.1 e exige uma chave que muda toda vez que o Rottera abre. Mantenha o
            Rottera aberto enquanto conversa com o Claude.
          </p>
        </>
      )}
      <div className="row end">
        <button className="btn primary" onClick={props.onClose}>
          Fechar
        </button>
      </div>
    </Modal>
  )
}

const REASON_LABEL: Record<BackupInfo['reason'], string> = {
  auto: 'Salvamento automático',
  open: 'Como estava ao abrir',
  shrink: 'Antes de uma redução grande',
  'before-restore': 'Antes de uma restauração'
}

function whenText(at: number): string {
  return new Date(at).toLocaleString('pt-BR', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })
}

/** Earlier versions of the open script, kept outside the file. Restoring keeps the current one in the list. */
export function VersionsDialog(props: { path: string | null; onRestore(id: string): void; onClose(): void }): JSX.Element {
  const [items, setItems] = useState<BackupInfo[] | null>(null)
  useEffect(() => {
    let live = true
    void window.api.backupsList(props.path).then((l) => live && setItems(l))
    return () => {
      live = false
    }
  }, [props.path])
  return (
    <Modal title="Versões anteriores" onClose={props.onClose} wide>
      <p className="muted">
        O Rottera guarda cópias do roteiro enquanto você escreve, numa pasta própria. Restaurar não apaga nada: o texto de agora
        entra na lista como “Antes de uma restauração”.
      </p>
      {items === null ? (
        <p className="muted">Carregando…</p>
      ) : items.length === 0 ? (
        <p className="muted">Ainda não há versões deste roteiro. A primeira aparece depois do próximo salvamento.</p>
      ) : (
        <ul className="versions">
          {items.map((v, i) => (
            <li key={v.id}>
              <div>
                <b>{whenText(v.at)}</b>
                <span className="muted">
                  {REASON_LABEL[v.reason]} · {v.blocks} {v.blocks === 1 ? 'bloco' : 'blocos'} · {v.words} {v.words === 1 ? 'palavra' : 'palavras'}
                  {i === 0 ? ' · a mais recente' : ''}
                </span>
              </div>
              <button className="btn secondary small" aria-label={`Restaurar a versão de ${whenText(v.at)}`} onClick={() => props.onRestore(v.id)}>
                Restaurar
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="row end">
        <button type="button" className="btn secondary" onClick={props.onClose}>
          Fechar
        </button>
      </div>
    </Modal>
  )
}

/** The manual: topics on the left, the text on the right, one search box that matches words without accents. */
export function ManualDialog(props: { onClose(): void; initial?: string }): JSX.Element {
  const [query, setQuery] = useState('')
  const hits = useMemo(() => searchManual(query), [query])
  const [picked, setPicked] = useState<string>(props.initial ?? MANUAL[0].id)
  const current = hits.find((h) => h.topic.id === picked)?.topic ?? hits[0]?.topic ?? null
  const groups = useMemo(() => {
    const out: { group: string; topics: ManualTopic[] }[] = []
    for (const h of hits) {
      let g = out.find((x) => x.group === h.topic.group)
      if (!g) out.push((g = { group: h.topic.group, topics: [] }))
      g.topics.push(h.topic)
    }
    return out
  }, [hits])

  return (
    <Modal title="Manual do Rottera" onClose={props.onClose} wide>
      <div className="manual">
        <div className="manual-search">
          <label htmlFor="manual-q">Buscar no manual</label>
          <input
            id="manual-q"
            type="text"
            role="searchbox"
            autoComplete="off"
            placeholder="Por exemplo: duplo, papel, versões"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <p className="muted" role="status">
            {query.trim() === '' ? `${MANUAL.length} assuntos` : hits.length === 0 ? 'Nada encontrado.' : `${hits.length} ${hits.length === 1 ? 'assunto' : 'assuntos'}`}
          </p>
        </div>
        <nav className="manual-list" aria-label="Assuntos do manual">
          {groups.map((g) => (
            <div key={g.group}>
              <h3>{g.group}</h3>
              <ul>
                {g.topics.map((t) => (
                  <li key={t.id}>
                    <button className={current?.id === t.id ? 'on' : ''} aria-current={current?.id === t.id ? 'true' : undefined} onClick={() => setPicked(t.id)}>
                      {t.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <article className="manual-body" tabIndex={0} aria-label="Texto do assunto" aria-live="polite">
          {current ? (
            <>
              <h3>{current.title}</h3>
              {current.body.map((p, i) =>
                p.t === 'p' ? (
                  <p key={i}>{p.text}</p>
                ) : p.t === 'note' ? (
                  <p key={i} className="manual-note">
                    {p.text}
                  </p>
                ) : p.t === 'ul' ? (
                  <ul key={i}>
                    {p.items.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                ) : (
                  <ol key={i}>
                    {p.items.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ol>
                )
              )}
            </>
          ) : (
            <p className="muted">Nenhum assunto combina com essa busca. Tente uma palavra mais curta.</p>
          )}
        </article>
      </div>
      <div className="row end">
        <button type="button" className="btn secondary" onClick={props.onClose}>
          Fechar
        </button>
      </div>
    </Modal>
  )
}

/** Shows exactly what would be copied, so the person sees it before sharing it. */
export function DiagnosticsDialog(props: { build(): Promise<string>; onCopied(): void; onClose(): void }): JSX.Element {
  const [text, setText] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    void props.build().then((t) => live && setText(t))
    return () => {
      live = false
    }
    // built once when the dialog opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <Modal title="Diagnóstico" onClose={props.onClose} wide>
      <p className="muted">
        Este é o texto que será copiado. Ele traz versões, números e os últimos erros. Não leva o texto do roteiro, nomes de arquivos nem pastas.
        Cole-o na conversa com quem estiver ajudando.
      </p>
      <label htmlFor="diag-text">Texto do diagnóstico</label>
      <textarea id="diag-text" className="diag-text" readOnly rows={14} value={text ?? 'Carregando…'} />
      <div className="row end">
        <button type="button" className="btn secondary" onClick={props.onClose}>
          Fechar
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={text === null}
          onClick={() => {
            if (text === null) return
            void window.api.copyText(text).then(props.onCopied)
          }}
        >
          Copiar
        </button>
      </div>
    </Modal>
  )
}
