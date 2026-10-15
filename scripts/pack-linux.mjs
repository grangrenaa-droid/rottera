// Builds the Linux x64 package: a .tar.gz with the app folder, a launcher and a menu installer.
//
// Why our own tar: electron-builder's tar.gz made on Windows has no execute bits (NTFS keeps none),
// so the extracted app would not start. Here every entry gets its Unix mode explicitly.
//
// usage: npm run dist:linux
import { execSync } from 'node:child_process'
import { createReadStream, createWriteStream, existsSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createGzip } from 'node:zlib'
import { once } from 'node:events'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' })
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version

run('npx electron-vite build')
run('npx electron-builder --linux dir --x64')

const app = join(root, 'dist', 'linux-unpacked')
if (!existsSync(join(app, 'rottera'))) throw new Error('linux build not found: ' + app)

const top = `Rottera-${version}-linux-x64`
const out = join(root, 'dist', `${top}.tar.gz`)
const EXEC = new Set(['rottera', 'chrome-sandbox', 'chrome_crashpad_handler', 'abrir-rottera.sh', 'instalar.sh'])
const modeOf = (name) => (EXEC.has(name) || name.endsWith('.so') || /\.so\.\d+$/.test(name) ? 0o755 : 0o644)

// [path inside the archive, source file or null for a folder, mode]
const entries = [[`${top}/`, null, 0o755]]
const walk = (dir, rel) => {
  for (const name of readdirSync(dir).sort()) {
    const src = join(dir, name)
    const path = `${rel}/${name}`
    if (statSync(src).isDirectory()) {
      entries.push([`${path}/`, null, 0o755])
      walk(src, path)
    } else entries.push([path, src, modeOf(name)])
  }
}
walk(app, top)
entries.push([`${top}/rottera.png`, join(root, 'build', 'icon.png'), 0o644])
for (const name of ['abrir-rottera.sh', 'instalar.sh']) entries.push([`${top}/${name}`, join(root, 'scripts', 'linux', name), 0o755])
entries.push([`${top}/LEIA-ME.txt`, join(root, 'scripts', 'linux', 'LEIA-ME.txt'), 0o644])

const mtime = Math.floor(Date.now() / 1000)
/** A ustar header block. Long paths are split between the prefix and name fields. */
function header(path, size, mode, dir) {
  const h = Buffer.alloc(512)
  let name = path
  let prefix = ''
  if (Buffer.byteLength(name) > 100) {
    const cut = name.lastIndexOf('/', Math.min(155, name.length - 2))
    prefix = name.slice(0, cut)
    name = name.slice(cut + 1)
    if (Buffer.byteLength(name) > 100 || Buffer.byteLength(prefix) > 155) throw new Error('path too long for tar: ' + path)
  }
  const oct = (n, len) => n.toString(8).padStart(len - 1, '0') + '\0'
  h.write(name, 0)
  h.write(oct(mode, 8), 100)
  h.write(oct(0, 8), 108)
  h.write(oct(0, 8), 116)
  h.write(oct(size, 12), 124)
  h.write(oct(mtime, 12), 136)
  h.write('        ', 148)
  h.write(dir ? '5' : '0', 156)
  h.write('ustar\0', 257)
  h.write('00', 263)
  h.write('root', 265)
  h.write('root', 297)
  h.write(prefix, 345)
  let sum = 0
  for (const b of h) sum += b
  h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148)
  return h
}

rmSync(out, { force: true })
const gz = createGzip({ level: 9 })
const file = createWriteStream(out)
gz.pipe(file)
const write = async (buf) => {
  if (!gz.write(buf)) await once(gz, 'drain')
}
for (const [path, src, mode] of entries) {
  const size = src ? statSync(src).size : 0
  await write(header(path, size, mode, !src))
  if (!src) continue
  for await (const chunk of createReadStream(src)) await write(chunk)
  if (size % 512) await write(Buffer.alloc(512 - (size % 512)))
}
gz.end(Buffer.alloc(1024))
await once(file, 'close')
console.log('tar.gz:', out)
