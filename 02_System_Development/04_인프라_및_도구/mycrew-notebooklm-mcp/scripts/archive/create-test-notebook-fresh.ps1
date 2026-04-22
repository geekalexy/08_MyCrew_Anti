# Create a fresh test notebook with current account
# This will auto-discover notebooks and we'll use one that the current account owns

Write-Host "=== Creating fresh test notebook ===" -ForegroundColor Cyan

# First, auto-discover to see what notebooks we have access to
Write-Host "`nAuto-discovering notebooks (visible browser)..."
$discoverBody = @{
    show_browser = $true
    max_notebooks = 10
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/notebooks/auto-discover" -Method POST -ContentType "application/json" -Body $discoverBody -TimeoutSec 180
    Write-Host "Discovered notebooks:"
    $response.data.notebooks | ForEach-Object {
        Write-Host "  - $($_.name): $($_.url)"
    }
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}
