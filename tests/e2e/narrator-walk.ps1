# Runs Windows Narrator against the Rottera window and records what it says.
# For every Tab it presses Narrator key + Ctrl + X ("copy the last spoken phrase") and reads the clipboard.
# The user's clipboard text is saved first and restored at the end. Narrator is closed again if this script started it.
param(
  [Parameter(Mandatory = $true)][int]$ProcessId,
  [int]$Steps = 40,
  [int]$WaitMs = 1100
)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes, System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class NarratorKeys {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
  [DllImport("user32.dll")] public static extern void SwitchToThisWindow(IntPtr h, bool alt);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  public const byte VK_INSERT = 0x2D, VK_CONTROL = 0x11, VK_X = 0x58;
  public const uint EXT = 1, UP = 2;
  // Narrator key (Insert) + Ctrl + X
  public static void CopyLastPhrase() {
    keybd_event(VK_INSERT, 0x52, EXT, UIntPtr.Zero);
    keybd_event(VK_CONTROL, 0x1D, 0, UIntPtr.Zero);
    keybd_event(VK_X, 0x2D, 0, UIntPtr.Zero);
    keybd_event(VK_X, 0x2D, UP, UIntPtr.Zero);
    keybd_event(VK_CONTROL, 0x1D, UP, UIntPtr.Zero);
    keybd_event(VK_INSERT, 0x52, EXT | UP, UIntPtr.Zero);
  }
}
"@

$AE = [System.Windows.Automation.AutomationElement]
$TS = [System.Windows.Automation.TreeScope]
$root = $AE::RootElement
$condPid = New-Object System.Windows.Automation.PropertyCondition($AE::ProcessIdProperty, $ProcessId)
$win = $null
foreach ($w in $root.FindAll($TS::Children, $condPid)) { if ($w.Current.ClassName -eq 'Chrome_WidgetWin_1') { $win = $w; break } }
if (-not $win) { Write-Output 'NO_WINDOW'; exit 2 }

$savedClip = $null
try { $savedClip = Get-Clipboard -Raw -ErrorAction Stop } catch {}

$startedNarrator = $false
if (-not (Get-Process -Name Narrator -ErrorAction SilentlyContinue)) {
  Start-Process -FilePath "$env:WINDIR\System32\Narrator.exe" | Out-Null
  $startedNarrator = $true
  Start-Sleep -Seconds 5
}
if (-not (Get-Process -Name Narrator -ErrorAction SilentlyContinue)) { Write-Output 'NARRATOR_NOT_RUNNING'; exit 3 }

# Narrator may open its own start window; dismiss it by bringing the app back to the front
$h = [IntPtr]$win.Current.NativeWindowHandle
[NarratorKeys]::ShowWindow($h, 9) | Out-Null
[NarratorKeys]::SwitchToThisWindow($h, $true)
[NarratorKeys]::SetForegroundWindow($h) | Out-Null
Start-Sleep -Milliseconds 1500

function Heard {
  [System.Windows.Forms.Clipboard]::Clear()
  [NarratorKeys]::CopyLastPhrase()
  Start-Sleep -Milliseconds 350
  try { return (Get-Clipboard -Raw -ErrorAction Stop) } catch { return '' }
}

"0|(initial)|" + (Heard)
$inEditor = $false
for ($i = 1; $i -le $Steps; $i++) {
  # never send keys to another program: check the foreground window first
  $cur = $null
  try { $cur = $AE::FocusedElement } catch {}
  if ($cur -and $cur.Current.ProcessId -ne $ProcessId) {
    "{0}|FOCUS_LEFT_APP|" -f $i
    break
  }
  if ($inEditor) { [System.Windows.Forms.SendKeys]::SendWait('{ESC}'); Start-Sleep -Milliseconds 120 }
  [System.Windows.Forms.SendKeys]::SendWait('{TAB}')
  Start-Sleep -Milliseconds $WaitMs
  $said = Heard
  $f = $null
  try { $f = $AE::FocusedElement } catch {}
  $what = ''
  if ($f) {
    if ($f.Current.ProcessId -ne $ProcessId) { "{0}|FOCUS_LEFT_APP|" -f $i; break }
    $what = $f.Current.ControlType.ProgrammaticName.Replace('ControlType.', '') + ' / ' + $f.Current.Name
    $inEditor = ($f.Current.Name -match 'Texto do roteiro')
    if ($inEditor) {
      # Narrator's queue runs a phrase behind; give the text box time to be spoken and capture it again
      Start-Sleep -Milliseconds 4500
      $late = Heard
      "{0}b|{1}|{2}" -f $i, 'Edit / Texto do roteiro (after waiting)', ($late -replace '[

|]+', ' ')
    }
  }
  "{0}|{1}|{2}" -f $i, ($what -replace '[

|]+', ' '), ($said -replace '[

|]+', ' ')
}

if ($startedNarrator) {
  # Narrator is protected: Stop-Process is denied. Its own toggle, Ctrl + Windows + Enter, closes it.
  [NarratorKeys]::keybd_event(0x11, 0x1D, 0, [UIntPtr]::Zero)
  [NarratorKeys]::keybd_event(0x5B, 0x5B, 1, [UIntPtr]::Zero)
  [NarratorKeys]::keybd_event(0x0D, 0x1C, 0, [UIntPtr]::Zero)
  [NarratorKeys]::keybd_event(0x0D, 0x1C, 2, [UIntPtr]::Zero)
  [NarratorKeys]::keybd_event(0x5B, 0x5B, 3, [UIntPtr]::Zero)
  [NarratorKeys]::keybd_event(0x11, 0x1D, 2, [UIntPtr]::Zero)
  Start-Sleep -Seconds 3
  if (Get-Process -Name Narrator -ErrorAction SilentlyContinue) { 'NARRATOR_STILL_RUNNING' } else { 'NARRATOR_CLOSED' }
}
if ($null -ne $savedClip) { Set-Clipboard -Value $savedClip } else { Set-Clipboard -Value ' ' }
