# Drives a real Windows common file dialog (Open / Save) through UI Automation and the keyboard.
#   -ProcessId  pid of the Rottera main process that owns the dialog
#   -Path       full path to type in the file name box (ignored with -Cancel)
#   -Cancel     press Cancel instead of Open/Save
param(
  [int]$ProcessId = 0,
  [string]$Path = '',
  [switch]$Cancel,
  [int]$TimeoutSeconds = 20
)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes, System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class FgGuard {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern void SwitchToThisWindow(IntPtr h, bool alt);
  [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr h, uint flags);
}
"@
$AE = [System.Windows.Automation.AutomationElement]
$root = $AE::RootElement
$TS = [System.Windows.Automation.TreeScope]

function Find-Dialog {
  $condClass = New-Object System.Windows.Automation.PropertyCondition($AE::ClassNameProperty, '#32770')
  if ($ProcessId -eq 0) {
    # any top-level dialog on the desktop (used for dialogs that belong to another program)
    foreach ($w in $root.FindAll($TS::Children, $condClass)) { return $w }
    return $null
  }
  $condPid = New-Object System.Windows.Automation.PropertyCondition($AE::ProcessIdProperty, $ProcessId)
  # a modal dialog is listed under the window that owns it
  foreach ($w in $root.FindAll($TS::Children, $condPid)) {
    if ($w.Current.ClassName -eq '#32770') { return $w }
    $d = $w.FindFirst($TS::Descendants, $condClass)
    if ($d) { return $d }
  }
  return $null
}

function Escape-Keys([string]$s) {
  $sb = New-Object System.Text.StringBuilder
  foreach ($ch in $s.ToCharArray()) {
    if ('+^%~(){}[]'.Contains([string]$ch)) { [void]$sb.Append('{' + $ch + '}') } else { [void]$sb.Append($ch) }
  }
  return $sb.ToString()
}

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
$dlg = $null
while ((Get-Date) -lt $deadline -and -not $dlg) {
  $dlg = Find-Dialog
  if (-not $dlg) { Start-Sleep -Milliseconds 150 }
}
if (-not $dlg) { Write-Output 'NO_DIALOG'; exit 2 }
$title = $dlg.Current.Name
Start-Sleep -Milliseconds 400   # let the dialog finish drawing and take focus

# Never type into some other window: the dialog (or its owner) has to be the foreground window.
function Dialog-IsForeground {
  $fg = [FgGuard]::GetForegroundWindow()
  $mine = [IntPtr]$dlg.Current.NativeWindowHandle
  if ($fg -eq $mine) { return $true }
  # same top-level window tree (the dialog is owned by the foreground window)
  $root1 = [FgGuard]::GetAncestor($fg, 2)
  $root2 = [FgGuard]::GetAncestor($mine, 2)
  return ($root1 -ne [IntPtr]::Zero -and $root1 -eq $root2)
}
for ($t = 0; $t -lt 3 -and -not (Dialog-IsForeground); $t++) {
  try { [FgGuard]::SwitchToThisWindow([IntPtr]$dlg.Current.NativeWindowHandle, $true); [FgGuard]::SetForegroundWindow([IntPtr]$dlg.Current.NativeWindowHandle) | Out-Null } catch {}
  Start-Sleep -Milliseconds 400
}
if (-not (Dialog-IsForeground)) { Write-Output "NOT_FOREGROUND title=$title (no keys were sent)"; exit 6 }

if ($Cancel) {
  try { $dlg.SetFocus() } catch {}
  Start-Sleep -Milliseconds 150
  [System.Windows.Forms.SendKeys]::SendWait('{ESC}')
} else {
  $edit = $null
  foreach ($id in @('1148', '1001')) {
    $cond = New-Object System.Windows.Automation.AndCondition(
      (New-Object System.Windows.Automation.PropertyCondition($AE::AutomationIdProperty, $id)),
      (New-Object System.Windows.Automation.PropertyCondition($AE::ClassNameProperty, 'Edit')))
    $edit = $dlg.FindFirst($TS::Descendants, $cond)
    if ($edit) { break }
  }
  if (-not $edit) {
    # last resort: the first plain Edit control that is not the search box
    $ce = New-Object System.Windows.Automation.PropertyCondition($AE::ClassNameProperty, 'Edit')
    foreach ($e in $dlg.FindAll($TS::Descendants, $ce)) { if ($e.Current.AutomationId -ne 'SearchEditBox') { $edit = $e; break } }
  }
  if (-not $edit) { Write-Output "NO_FILENAME_BOX title=$title"; exit 4 }
  $edit.SetFocus()
  Start-Sleep -Milliseconds 200
  [System.Windows.Forms.SendKeys]::SendWait('^a')
  [System.Windows.Forms.SendKeys]::SendWait((Escape-Keys $Path))
  Start-Sleep -Milliseconds 250
  [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
}

# confirm the dialog really closed (a replace-file confirmation counts as still open)
$gone = $false
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Milliseconds 200
  if (-not (Find-Dialog)) { $gone = $true; break }
}
if ($gone) {
  if ($Cancel) { Write-Output "CANCELLED title=$title" } else { Write-Output "OK title=$title" }
} else {
  $still = Find-Dialog
  $texts = @()
  if ($still) {
    $ct = New-Object System.Windows.Automation.PropertyCondition($AE::ControlTypeProperty, [System.Windows.Automation.ControlType]::Text)
    foreach ($t in $still.FindAll($TS::Descendants, $ct)) { $texts += $t.Current.Name }
  }
  Write-Output ("STILL_OPEN title=$title texts=" + ($texts -join ' / '))
}
