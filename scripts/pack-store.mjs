// Builds the Microsoft Store package (.appx, which the Store accepts as an MSIX-family package).
//
// The Store signs the package itself, so nothing here needs a certificate. The package must carry the identity
// Partner Center gives when the name is reserved (Product identity page): put it in build/store-identity.json as
//   { "identityName": "...", "publisher": "CN=...", "publisherDisplayName": "..." }
// Without that file a test package is built, with a made-up identity, only for installing on this computer.
// Windows installs it only when signed (the alias rottera.exe rules out unsigned packages): make a certificate
// whose subject is "CN=Rottera Teste", trust it on this computer, and give it to electron-builder in CSC_LINK
// (the .pfx) and CSC_KEY_PASSWORD.
//
// usage: npm run dist:store
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const run = (args) => {
  const r = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

const idFile = join(root, 'build', 'store-identity.json')
const real = existsSync(idFile)
const id = real
  ? JSON.parse(readFileSync(idFile, 'utf8'))
  : {
      identityName: 'Rottera.Teste',
      publisher: 'CN=Rottera Teste',
      publisherDisplayName: 'Rottera (teste)'
    }
for (const k of ['identityName', 'publisher', 'publisherDisplayName']) {
  if (typeof id[k] !== 'string' || !id[k].trim()) throw new Error(`build/store-identity.json: falta "${k}"`)
}

run([join(root, 'node_modules', 'electron-vite', 'bin', 'electron-vite.js'), 'build'])
run([
  join(root, 'node_modules', 'electron-builder', 'cli.js'),
  '--win',
  'appx',
  '--x64',
  `-c.appx.identityName=${id.identityName}`,
  `-c.appx.publisher=${id.publisher}`,
  `-c.appx.publisherDisplayName=${id.publisherDisplayName}`
])
console.log(real ? 'pacote para enviar à loja em dist/' : 'pacote de TESTE (identidade inventada) em dist/: não serve para enviar à loja')
