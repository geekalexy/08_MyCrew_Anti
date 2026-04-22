$body = @{
    source_type = "url"
    url = "https://en.wikipedia.org/wiki/Software_testing"
} | ConvertTo-Json
$response = Invoke-RestMethod -Uri "http://localhost:3000/content/sources" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 180
Write-Host "Success: $($response.success)"
if (-not $response.success) { Write-Host "Error: $($response.error)" }
