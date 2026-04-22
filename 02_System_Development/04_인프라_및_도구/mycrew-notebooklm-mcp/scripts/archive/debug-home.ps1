# Navigate to NotebookLM home with visible browser
$body = @{
    question = "What notebooks do you see?"
    show_browser = $true
} | ConvertTo-Json

Write-Host "Opening NotebookLM home page (visible)..."
# Just do a health check to trigger a visible session
$response = Invoke-RestMethod -Uri "http://localhost:3000/notebooks/auto-discover" -Method POST -ContentType "application/json" -Body '{"show_browser": true, "max_notebooks": 5}' -TimeoutSec 180
$response | ConvertTo-Json -Depth 5
