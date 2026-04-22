$body = @{
    source_type = "text"
    text = "This is a comprehensive test document about software testing. It covers unit testing, integration testing, and end-to-end testing methodologies."
    name = "E2E-Test-Text-Source"
} | ConvertTo-Json
$response = Invoke-RestMethod -Uri "http://localhost:3000/content/sources" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 180
Write-Host "Success: $($response.success)"
if (-not $response.success) { Write-Host "Error: $($response.error)" }
