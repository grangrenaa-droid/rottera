# What a screen reader sees: Windows UI Automation view of the Rottera window.
#   -Mode dump   every keyboard-focusable control with its role and accessible name
#   -Mode walk   press Tab -Steps times and report which control gets focus each time
param(
  [Parameter(Mandatory = $true)][int]$ProcessId,
  [ValidateSet('dump', 'walk', 'esc')][string]$Mode = 'dump',
  [int]$Steps = 60
)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes, System.Windows.Forms
$AE = [System.Windows.Automation.AutomationElement]
$TS = [System.Windows.Automation.TreeScope]
$root = $AE::RootElement

Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class Win32Fg {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
  [DllImport("user32.dll")] public static extern void SwitchToThisWindow(IntPtr h, bool alt);
}
"@
function Bring-ToFront($el) {
  $h = [IntPtr]$el.Current.NativeWindowHandle
  [Win32Fg]::ShowWindow($h, 9) | Out-Null
  [Win32Fg]::SwitchToThisWindow($h, $true)
  [Win32Fg]::SetForegroundWindow($h) | Out-Null
  Start-Sleep -Milliseconds 250
}

$condPid = New-Object System.Windows.Automation.PropertyCondition($AE::ProcessIdProperty, $ProcessId)
$condWin = New-Object System.Windows.Automation.PropertyCondition($AE::ControlTypeProperty, [System.Windows.Automation.ControlType]::Window)
$win = $null
foreach ($w in $root.FindAll($TS::Children, $condPid)) { if ($w.Current.ClassName -eq 'Chrome_WidgetWin_1') { $win = $w; break } }
if (-not $win) { Write-Output 'NO_WINDOW'; exit 2 }

function Row($e) {
  $c = $e.Current
  $t = $c.ControlType.ProgrammaticName.Replace('ControlType.', '')
  $state = ''
  try {
    $tp = $e.GetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern)
    $state = 'toggle=' + $tp.Current.ToggleState
  } catch {}
  try {
    $vp = $e.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
    if ($c.ControlType.ProgrammaticName -match 'ComboBox|Edit') { $state = 'value=' + $vp.Current.Value }
  } catch {}
  return ('{0}|{1}|{2}|{3}' -f $t, ($c.Name -replace '[\r\n|]+', ' '), $c.IsEnabled, $state)
}

if ($Mode -eq 'esc') {
  Bring-ToFront $win
  [System.Windows.Forms.SendKeys]::SendWait('{ESC}')
  Write-Output 'ESC_SENT'
  exit 0
}

if ($Mode -eq 'dump') {
  $all = $win.FindAll($TS::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
  foreach ($e in $all) {
    if ($e.Current.IsKeyboardFocusable -and -not $e.Current.IsOffscreen) { Row $e }
  }
  exit 0
}

# walk
Bring-ToFront $win
try { $win.SetFocus() } catch {}
Start-Sleep -Milliseconds 400
$inEditor = $false
for ($i = 1; $i -le $Steps; $i++) {
  # inside the script editor Tab changes the element; Esc first is the documented way out
  if ($inEditor) { [System.Windows.Forms.SendKeys]::SendWait('{ESC}'); Start-Sleep -Milliseconds 80 }
  [System.Windows.Forms.SendKeys]::SendWait('{TAB}')
  Start-Sleep -Milliseconds 140
  try {
    $f = $AE::FocusedElement
    if ($f.Current.ProcessId -ne $ProcessId) { "{0}|OUTSIDE|||" -f $i; continue }
    $row = Row $f
    $inEditor = ($row -match 'Texto do roteiro')
    "{0}|{1}" -f $i, $row
  } catch { "{0}|ERROR|{1}||" -f $i, $_.Exception.Message }
}
