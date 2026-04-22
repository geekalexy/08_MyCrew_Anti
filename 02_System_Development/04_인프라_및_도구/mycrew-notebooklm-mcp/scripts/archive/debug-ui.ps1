# Debug: Open notebook-1 with visible browser and take screenshot
$body = @{
    notebook_id = "notebook-1"
    question = "Test"
    show_browser = $true
} | ConvertTo-Json

Write-Host "Opening CNV notebook with visible browser..."
Write-Host "WATCH THE BROWSER to see what's happening!"
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/ask" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 300
    Write-Host "Response: $($response | ConvertTo-Json -Depth 3)"
} catch {
    Write-Host "Error: $_"
}
