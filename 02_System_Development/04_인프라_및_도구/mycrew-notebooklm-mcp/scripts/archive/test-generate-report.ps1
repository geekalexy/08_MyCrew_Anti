# Test /content/generate with report type
$body = @{
    notebook_id = "notebook-2"
    content_type = "report"
} | ConvertTo-Json

Write-Host "Generating report from IFS sources..."
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/content/generate" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 300
    Write-Host "`nResponse:"
    $response | ConvertTo-Json -Depth 5
} catch {
    Write-Host "Error: $_"
    Write-Host "Response content: $($_.Exception.Response)"
}
