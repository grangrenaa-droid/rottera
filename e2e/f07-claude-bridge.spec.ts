import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { bridgeInfo, expect, newScript, test } from './fixtures'

test.afterEach(({ errors }) => {
  expect(errors, 'console or page errors').toEqual([])
})

async function rpc(
  userData: string,
  method: string,
  params: unknown = {},
  opts: { token?: string; headers?: Record<string, string>; body?: string; path?: string } = {}
): Promise<{ status: number; json: Record<string, unknown> | null }> {
  const { port, token } = bridgeInfo(userData)
  const res = await fetch(`http://127.0.0.1:${port}${opts.path ?? '/rpc'}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.token ?? token}`, ...(opts.headers ?? {}) },
    body: opts.body ?? JSON.stringify({ method, params })
  })
  let json: Record<string, unknown> | null = null
  try {
    json = (await res.json()) as Record<string, unknown>
  } catch {
    /* not json */
  }
  return { status: res.status, json }
}

test.describe('F07 Claude bridge: security and robustness', () => {
  test('F07-N1 a wrong token is refused', async ({ page, userData }) => {
    await expect.poll(() => existsSync(join(userData, 'bridge.json'))).toBe(true)
    const r = await rpc(userData, 'status', {}, { token: 'errado' })
    expect(r.status).toBe(401)
  })

  test('F07-N2 a request that carries an Origin header (a web page) is refused', async ({ page, userData }) => {
    await expect.poll(() => existsSync(join(userData, 'bridge.json'))).toBe(true)
    const r = await rpc(userData, 'status', {}, { headers: { Origin: 'https://evil.example' } })
    expect(r.status).toBe(403)
  })

  test('F07-N3 a foreign Host header is refused (DNS rebinding)', async ({ userData, page }) => {
    await expect.poll(() => existsSync(join(userData, 'bridge.json'))).toBe(true)
    const { port, token } = bridgeInfo(userData)
    const net = await import('node:net')
    const status = await new Promise<number>((resolve, reject) => {
      const s = net.connect(port, '127.0.0.1', () => {
        const body = JSON.stringify({ method: 'status', params: {} })
        s.write(`POST /rpc HTTP/1.1\r\nHost: evil.example\r\nAuthorization: Bearer ${token}\r\nContent-Type: application/json\r\nContent-Length: ${body.length}\r\nConnection: close\r\n\r\n${body}`)
      })
      let data = ''
      s.on('data', (d) => (data += d))
      s.on('close', () => resolve(Number(/HTTP\/1\.1 (\d+)/.exec(data)?.[1])))
      s.on('error', reject)
    })
    expect(status).toBe(403)
  })

  test('F07-N4 invalid JSON and missing method are 400, and the server keeps working', async ({ page, userData }) => {
    await newScript(page)
    expect((await rpc(userData, '', {}, { body: '{nope' })).status).toBe(400)
    expect((await rpc(userData, '', {}, { body: '{"params":{}}' })).status).toBe(400)
    const ok = await rpc(userData, 'status')
    expect(ok.status).toBe(200)
    expect(ok.json?.ok).toBe(true)
  })

  test('F07-N5 an oversized body is refused and the server survives', async ({ page, userData }) => {
    await newScript(page)
    const huge = JSON.stringify({ method: 'status', params: { pad: 'x'.repeat(6 * 1024 * 1024) } })
    const r = await rpc(userData, '', {}, { body: huge }).catch(() => ({ status: 0, json: null }))
    expect([0, 413]).toContain(r.status)
    const ok = await rpc(userData, 'status')
    expect(ok.status).toBe(200)
  })

  test('F07-N6 wrong path and wrong method are 404', async ({ page, userData }) => {
    await expect.poll(() => existsSync(join(userData, 'bridge.json'))).toBe(true)
    expect((await rpc(userData, 'status', {}, { path: '/outro' })).status).toBe(404)
    const { port, token } = bridgeInfo(userData)
    const g = await fetch(`http://127.0.0.1:${port}/rpc`, { headers: { Authorization: `Bearer ${token}` } })
    expect(g.status).toBe(404)
  })

  test('F07-N7 unknown tool and bad arguments return errors, not crashes', async ({ page, userData }) => {
    await newScript(page)
    const unknown = await rpc(userData, 'apagar_tudo')
    expect(unknown.json?.ok).toBe(false)
    const badArgs = await rpc(userData, 'insert_blocks', { after: 'x', blocks: 'nao-lista' })
    expect(badArgs.json?.ok).toBe(false)
    const huge = await rpc(userData, 'insert_blocks', { blocks: Array.from({ length: 2500 }, () => ({ kind: 'action', text: 'x' })) })
    expect(huge.json?.ok).toBe(false)
    expect((await rpc(userData, 'status')).json?.ok).toBe(true)
  })

  test('F07-C1 twenty concurrent edits all land, none lost', async ({ page, userData }) => {
    await newScript(page)
    const calls = Array.from({ length: 20 }, (_, i) =>
      rpc(userData, 'insert_blocks', { blocks: [{ kind: 'action', text: `Linha concorrente ${i}` }] })
    )
    const results = await Promise.all(calls)
    expect(results.every((r) => r.json?.ok === true)).toBe(true)
    const status = (await rpc(userData, 'status')).json?.result as { blockCount: number }
    expect(status.blockCount).toBe(20) // the first insert takes the place of the empty starting heading
    const script = (await rpc(userData, 'get_script')).json?.result as { blocks: { text: string }[] }
    for (let i = 0; i < 20; i++) expect(script.blocks.some((b) => b.text === `Linha concorrente ${i}`)).toBe(true)
  })

  test('F07-C2 edits made by Claude can be undone with Ctrl+Z', async ({ page, userData }) => {
    await newScript(page)
    await rpc(userData, 'insert_blocks', { blocks: [{ kind: 'action', text: 'Feito pelo Claude.' }] })
    await expect(page.getByRole('textbox', { name: 'Texto do roteiro' })).toContainText('Feito pelo Claude.')
    await page.getByRole('textbox', { name: 'Texto do roteiro' }).click()
    await page.keyboard.press('Control+Z')
    await expect(page.getByRole('textbox', { name: 'Texto do roteiro' })).not.toContainText('Feito pelo Claude.')
  })

  test('F07-C3 turning the connection off removes the key file and refuses connections', async ({ page, userData }) => {
    await expect.poll(() => existsSync(join(userData, 'bridge.json'))).toBe(true)
    const { port } = bridgeInfo(userData)
    await page.getByRole('button', { name: 'Conectar ao Claude…' }).click()
    await page.getByLabel('Permitir que o Claude edite o roteiro (somente neste computador)').uncheck()
    await expect.poll(() => existsSync(join(userData, 'bridge.json'))).toBe(false)
    const refused = await fetch(`http://127.0.0.1:${port}/rpc`, { method: 'POST' }).then(() => false, () => true)
    expect(refused).toBe(true)
  })

  test('F07-C4 a call on the home screen explains that no script is open', async ({ page, userData }) => {
    await expect.poll(() => existsSync(join(userData, 'bridge.json'))).toBe(true)
    const r = await rpc(userData, 'get_script')
    expect(r.json?.ok).toBe(false)
    expect(String(r.json?.error)).toMatch(/Abra um roteiro/)
  })
})
