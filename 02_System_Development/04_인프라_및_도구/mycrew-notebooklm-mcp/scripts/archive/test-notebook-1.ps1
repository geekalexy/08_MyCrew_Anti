# Activate notebook-1 and check content
$response = Invoke-RestMethod -Uri "http://localhost:3000/notebooks/notebook-1/activate" -Method PUT
Write-Host "Activate response:"
$response | ConvertTo-Json -Depth 5

Start-Sleep -Seconds 3

$content = Invoke-RestMethod -Uri "http://localhost:3000/content" -Method GET
Write-Host "`nContent response:"
$content | ConvertTo-Json -Depth 5
