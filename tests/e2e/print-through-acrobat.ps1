param([string]$Pdf, [string]$Out, [string]$Helper)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName UIAutomationClient
$acro = 'C:\Program Files\Adobe\Acrobat DC\Acrobat\Acrobat.exe'
$before = @(Get-Process | ForEach-Object Id)
Start-Process -FilePath $acro -ArgumentList @('/t', "`"$Pdf`"", '"Microsoft Print to PDF"', '"Microsoft Print To PDF"', '"PORTPROMPT:"') | Out-Null
# the Save Print Output dialog belongs to the Acrobat window: find that process
$pid2 = 0
$root = [System.Windows.Automation.AutomationElement]::RootElement
for ($i = 0; $i -lt 40 -and $pid2 -eq 0; $i++) {
  Start-Sleep -Milliseconds 500
  foreach ($w in $root.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)) {
    if ($w.Current.ClassName -eq 'AcrobatSDIWindow' -and ($before -notcontains $w.Current.ProcessId)) { $pid2 = $w.Current.ProcessId }
  }
}
"acrobat pid: $pid2"
$r = & $Helper -ProcessId $pid2 -Path $Out -TimeoutSeconds 60
"dialog: $r"
for ($i = 0; $i -lt 60 -and -not (Test-Path $Out); $i++) { Start-Sleep -Milliseconds 500 }
Start-Sleep -Seconds 2
"output exists: " + (Test-Path $Out)
if (Test-Path $Out) { "size: " + (Get-Item $Out).Length }
$null = Get-Process -Name Acrobat, AcroCEF -ErrorAction SilentlyContinue | Where-Object { $before -notcontains $_.Id } | Stop-Process -Force -ErrorAction SilentlyContinue
