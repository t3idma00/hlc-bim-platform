param(
  [int]$Port = 3000,
  [switch]$StopOnly
)

$listeners = netstat -ano |
  Select-String "LISTENING" |
  ForEach-Object {
    $parts = $_.Line -split "\s+" | Where-Object { $_ }
    if ($parts.Length -ge 5 -and $parts[1] -match ":$Port$") {
      [int]$parts[-1]
    }
  } |
  Select-Object -Unique

foreach ($processId in $listeners) {
  if ($processId -and $processId -ne 0) {
    Write-Host "Stopping process $processId on port $Port"
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
  }
}

Start-Sleep -Seconds 1

if ($StopOnly) {
  Write-Host "Stopped dev server listeners on port $Port."
  exit 0
}

npx next dev --webpack --port $Port
