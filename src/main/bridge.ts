import { createServer, type Server } from 'node:http'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { existsSync, unlinkSync, writeFileSync } from 'node:fs'
import { ipcMain, type BrowserWindow } from 'electron'

export interface BridgeInfo {
  enabled: boolean
  port: number | null
  bridgeFile: string
}

interface Pending {
  resolve(v: unknown): void
  reject(e: Error): void
  timer: NodeJS.Timeout
}

const MAX_BODY = 4 * 1024 * 1024
const TIMEOUT_MS = 20000

/**
 * Local-only bridge: the MCP server (a separate process started by Claude) posts commands here,
 * and the app applies them to the open script. Only 127.0.0.1, bearer token, no browser origins.
 */
export class Bridge {
  private server: Server | null = null
  private token = randomBytes(24).toString('hex')
  private port: number | null = null
  private pending = new Map<number, Pending>()
  private nextId = 1

  constructor(
    private readonly bridgeFile: string,
    private readonly getWindow: () => BrowserWindow | null,
    private readonly onActivity: () => void
  ) {
    ipcMain.handle('bridge:reply', (_e, msg: { id: number; result?: unknown; error?: string }) => {
      const p = this.pending.get(msg.id)
      if (!p) return
      this.pending.delete(msg.id)
      clearTimeout(p.timer)
      if (msg.error) p.reject(new Error(msg.error))
      else p.resolve(msg.result)
    })
  }

  info(): BridgeInfo {
    return { enabled: this.server !== null, port: this.port, bridgeFile: this.bridgeFile }
  }

  private call(method: string, params: unknown): Promise<unknown> {
    const win = this.getWindow()
    if (!win) return Promise.reject(new Error('O Rottera não tem janela aberta.'))
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error('O Rottera não respondeu a tempo.'))
      }, TIMEOUT_MS)
      this.pending.set(id, { resolve, reject, timer })
      win.webContents.send('bridge:request', { id, method, params })
    })
  }

  async start(): Promise<void> {
    if (this.server) return
    this.token = randomBytes(24).toString('hex')
    const server = createServer((req, res) => {
      const send = (status: number, body: unknown): void => {
        res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify(body))
      }
      // Browsers always send Origin on cross-site requests; the MCP client never does.
      if (req.headers.origin) return send(403, { ok: false, error: 'origin not allowed' })
      const host = String(req.headers.host ?? '')
      if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) return send(403, { ok: false, error: 'host not allowed' })
      const auth = String(req.headers.authorization ?? '')
      const want = Buffer.from(`Bearer ${this.token}`)
      const got = Buffer.from(auth)
      if (got.length !== want.length || !timingSafeEqual(got, want)) return send(401, { ok: false, error: 'unauthorized' })
      if (req.method !== 'POST' || req.url !== '/rpc') return send(404, { ok: false, error: 'not found' })

      let size = 0
      const chunks: Buffer[] = []
      req.on('data', (c: Buffer) => {
        size += c.length
        if (size > MAX_BODY) {
          send(413, { ok: false, error: 'body too large' })
          req.destroy()
          return
        }
        chunks.push(c)
      })
      req.on('end', () => {
        if (res.writableEnded) return
        let body: { method?: unknown; params?: unknown }
        try {
          body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as typeof body
        } catch {
          return send(400, { ok: false, error: 'invalid json' })
        }
        if (typeof body.method !== 'string') return send(400, { ok: false, error: 'method required' })
        this.onActivity()
        this.call(body.method, body.params ?? {}).then(
          (result) => send(200, { ok: true, result }),
          (e: Error) => send(200, { ok: false, error: e.message })
        )
      })
    })
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', () => resolve())
    })
    const addr = server.address()
    this.port = typeof addr === 'object' && addr ? addr.port : null
    this.server = server
    writeFileSync(
      this.bridgeFile,
      JSON.stringify({ port: this.port, token: this.token, pid: process.pid, startedAt: new Date().toISOString() }),
      { encoding: 'utf8', mode: 0o600 }
    )
  }

  stop(): void {
    this.server?.close()
    this.server = null
    this.port = null
    for (const [, p] of this.pending) {
      clearTimeout(p.timer)
      p.reject(new Error('Conexão encerrada.'))
    }
    this.pending.clear()
    if (existsSync(this.bridgeFile)) {
      try {
        unlinkSync(this.bridgeFile)
      } catch {
        /* ignore */
      }
    }
  }
}
