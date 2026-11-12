// electron-builder hook (appxManifestCreated): adds to the Microsoft Store package the alias rottera.exe.
//
// Why: an AI client (Claude, Codex...) starts the connection script with the app's own executable. Inside a Store
// package that executable lives in a folder whose name changes with every update, and other programs may not run
// it from there. The alias is a fixed path (%LOCALAPPDATA%\Microsoft\WindowsApps\rottera.exe) that starts it.
const { readFileSync, writeFileSync } = require('node:fs')

const UAP3 = 'http://schemas.microsoft.com/appx/manifest/uap/windows10/3'

module.exports = async function appxManifestCreated(file) {
  let xml = readFileSync(file, 'utf8')
  const exe = /<Application\b[^>]*\bExecutable="([^"]+)"/.exec(xml)?.[1]
  if (!exe) throw new Error('appx manifest: Application Executable not found')
  if (!xml.includes(`xmlns:uap3="${UAP3}"`)) xml = xml.replace('<Package', `<Package\n   xmlns:uap3="${UAP3}"`)
  const alias = `
          <uap3:Extension Category="windows.appExecutionAlias" Executable="${exe}" EntryPoint="Windows.FullTrustApplication">
            <uap3:AppExecutionAlias>
              <desktop:ExecutionAlias Alias="rottera.exe" />
            </uap3:AppExecutionAlias>
          </uap3:Extension>`
  if (xml.includes('</Extensions>')) xml = xml.replace('</Extensions>', `${alias}</Extensions>`)
  else xml = xml.replace('</Application>', `<Extensions>${alias}</Extensions>\n    </Application>`)
  writeFileSync(file, xml, 'utf8')
}
