// Builds a portable Windows folder (and zip) that runs on PCs with Smart App Control turned on.
//
// Why: electron-builder edits the executable (icon, asar integrity). The edited file is a new,
// unsigned binary that Smart App Control refuses. The stock Electron executable, byte for byte, is
// known to Windows, and Electron loads resources/app.asar next to it without changing the exe.
// So: take the stock Electron folder, rename the exe, and drop our app.asar and MCP script in.
//
// usage: npm run dist:portable
import { execSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' })
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version

run('npx electron-vite build')
// Only used to get a correct app.asar; its edited executable is not shipped.
run('npx electron-builder --win dir --x64')

const asar = join(root, 'dist', 'win-unpacked', 'resources', 'app.asar')
if (!existsSync(asar)) throw new Error('app.asar not found: ' + asar)

const out = join(root, 'dist', 'Rottera-portable')
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
cpSync(join(root, 'node_modules', 'electron', 'dist'), out, { recursive: true })
renameSync(join(out, 'electron.exe'), join(out, 'Rottera.exe'))
rmSync(join(out, 'resources', 'default_app.asar'), { force: true })
cpSync(asar, join(out, 'resources', 'app.asar'))
cpSync(join(root, 'mcp'), join(out, 'resources', 'mcp'), { recursive: true })
cpSync(join(root, 'scripts', 'LEIA-ME.txt'), join(out, 'LEIA-ME.txt'))

if (process.platform === 'win32') {
  const zip = join(root, 'dist', `Rottera-${version}-win-x64-portable.zip`)
  rmSync(zip, { force: true })
  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path '${out}\\*' -DestinationPath '${zip}' -CompressionLevel Optimal"`,
    { stdio: 'inherit' }
  )
  console.log('zip:', zip)
}
console.log('folder:', out)
console.log('run:', join(out, 'Rottera.exe'))
