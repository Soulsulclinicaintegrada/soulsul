$ErrorActionPreference = "Stop"

$dbPath = "C:\Users\jusgo\Documents\sistema_clinica\clinica.db"
$url = "https://soulsul-production.up.railway.app/admin/import-db"
$token = "soulsul-sync-2026"

$bytes = [System.IO.File]::ReadAllBytes($dbPath)

$response = Invoke-RestMethod `
  -Uri $url `
  -Method Post `
  -ContentType "application/octet-stream" `
  -Headers @{ "x-import-token" = $token } `
  -Body $bytes

$response | ConvertTo-Json -Depth 4
