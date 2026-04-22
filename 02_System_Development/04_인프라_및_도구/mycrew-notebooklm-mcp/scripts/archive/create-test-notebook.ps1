# Create a test notebook via browser automation
# This script navigates to NotebookLM and creates a new empty notebook

$body = @{
    question = "Navigation test"
    show_browser = $true
    notebook_url = "https://notebooklm.google.com"
} | ConvertTo-Json

Write-Host "Opening NotebookLM homepage to create notebook..."
Write-Host "Please manually click '+ Create notebook' button"
Write-Host ""

# Just open the browser to NotebookLM homepage
$response = Invoke-RestMethod -Uri "http://localhost:3000/ask" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 60
$response | ConvertTo-Json -Depth 5
