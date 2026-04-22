$body = @{
    notebook_id = "notebook-1"
    content_type = "report"
} | ConvertTo-Json

Write-Host "Testing Studio tab with English UI..."
$response = Invoke-RestMethod -Uri "http://localhost:3000/content/generate" -Method POST -ContentType "application/json" -Body $body
$response | ConvertTo-Json -Depth 5
