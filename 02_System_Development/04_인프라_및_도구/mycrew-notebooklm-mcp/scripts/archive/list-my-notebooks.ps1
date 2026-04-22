# Auto-discover notebooks from current account
Write-Host "=== Auto-discovering notebooks from current account ===" -ForegroundColor Cyan

$body = @{
    max_notebooks = 20
    show_browser = $true
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/notebooks/auto-discover" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 180

    Write-Host "`nDiscovered $($response.data.notebooks.Count) notebooks:" -ForegroundColor Green

    $response.data.notebooks | ForEach-Object {
        Write-Host "  - $($_.name)" -ForegroundColor Yellow
        Write-Host "    URL: $($_.url)" -ForegroundColor Gray
    }
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red

    # Fallback: just list already known notebooks
    Write-Host "`nFallback: listing known notebooks..." -ForegroundColor Cyan
    $notebooks = Invoke-RestMethod -Uri "http://localhost:3000/notebooks" -Method GET
    $notebooks.data.notebooks | ForEach-Object {
        Write-Host "  - $($_.id): $($_.name)" -ForegroundColor Yellow
    }
}
