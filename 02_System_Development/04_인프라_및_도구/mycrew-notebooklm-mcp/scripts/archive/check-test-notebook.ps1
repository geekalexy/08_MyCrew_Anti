# Check if notebook-2 is usable as test notebook
$body = @{ notebook_id = "notebook-2" } | ConvertTo-Json
$response = Invoke-RestMethod -Uri "http://localhost:3000/notebooks/notebook-2/activate" -Method PUT
Write-Host "Activate response:"
$response | ConvertTo-Json -Depth 5

Start-Sleep -Seconds 3

$content = Invoke-RestMethod -Uri "http://localhost:3000/content" -Method GET
Write-Host "`nContent response:"
$content | ConvertTo-Json -Depth 5
