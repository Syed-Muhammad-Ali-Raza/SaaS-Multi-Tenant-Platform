Set-Location "C:\Users\Senarios\Desktop\h"
$p = Join-Path $env:TEMP "opencode\web6.log"
try {
  $out = & pnpm --filter web build 2>&1 | Out-String
  $code = $LASTEXITCODE
} catch {
  $out = $_.Exception.Message
  $code = -1
}
$clean = ($out -replace "\x1b\[[0-9;]*m", "") -split "`r?`n"
$LOG = "OUTPUT-START"
Write-Output "== exit: $code =="
$show = $false
foreach ($ln in $clean) {
  if ($ln -match "Type error|^TypeScript found|error TS") { $show = $true; Write-Output $ln; continue }
  if ($show) {
    if ($ln -match "^>|Cannot find name|is missing|not assignable|\.tsx?:\d+:\d+|\.tsx?\(\d+,\d+\)") { Write-Output $ln }
  }
}
Write-Output "OUTPUT-END"
