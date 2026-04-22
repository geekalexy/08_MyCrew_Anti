$body = @{
    name = "E2E-Test-Notebook"
    show_browser = $true
} | ConvertTo-Json

Write-Host "Creating test notebook..." -ForegroundColor Cyan
$response = Invoke-RestMethod -Uri "http://localhost:3000/notebooks/create" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 120
$response | ConvertTo-Json -Depth 5
