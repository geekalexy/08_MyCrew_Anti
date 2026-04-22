# Test /content/generate with study_guide
$body = @{
    notebook_id = "notebook-2"
    content_type = "study_guide"
} | ConvertTo-Json

Write-Host "Generating study guide from IFS sources..."
$response = Invoke-RestMethod -Uri "http://localhost:3000/content/generate" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 300

Write-Host "`nResponse:"
$response | ConvertTo-Json -Depth 5
