# Automatically create a test notebook
# This navigates to homepage and clicks "Create notebook"

Write-Host "=== Creating Test Notebook ===" -ForegroundColor Cyan

# Step 1: Close existing sessions to get fresh browser
Write-Host "1. Checking server health..."
$health = Invoke-RestMethod -Uri "http://localhost:3000/health" -Method GET
Write-Host "   Server: $($health.data.status), Auth: $($health.data.authenticated)"

# Step 2: Make a simple request to open browser at homepage
Write-Host "2. Opening browser at NotebookLM homepage..."
Write-Host "   The browser will open. Please:"
Write-Host "   - Click '+ Creer un notebook' button"
Write-Host "   - Copy the new notebook URL"
Write-Host "   - Paste it here when ready"
Write-Host ""

# Navigate to homepage by using a non-existent notebook (will redirect to home)
$body = @{
    question = "test"
    show_browser = $true
} | ConvertTo-Json

try {
    # This will timeout or fail but will open the browser
    $response = Invoke-RestMethod -Uri "http://localhost:3000/ask" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 120
    Write-Host "Response: $($response | ConvertTo-Json -Depth 3)"
} catch {
    Write-Host "Browser should be open now. Please create the notebook manually."
}
