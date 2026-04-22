# Check which account is currently logged in by navigating to NotebookLM home
Write-Host "=== Checking current account ===" -ForegroundColor Cyan

# Use /ask with show_browser to see the current state
$body = @{
    question = "Hello"
    show_browser = $true
} | ConvertTo-Json

Write-Host "Opening browser to check account..."
Write-Host "(Look at the browser window to see which Google account is logged in)"
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/ask" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 120
    Write-Host "Response: $($response | ConvertTo-Json -Depth 3)"
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}
