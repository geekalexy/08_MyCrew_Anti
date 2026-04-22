# Activate notebook-2 and check its content
$activateResponse = Invoke-RestMethod -Uri "http://localhost:3000/notebooks/notebook-2/activate" -Method PUT
Write-Host "Activated: $($activateResponse | ConvertTo-Json -Depth 5)"

Start-Sleep -Seconds 2

$contentResponse = Invoke-RestMethod -Uri "http://localhost:3000/content" -Method GET
Write-Host "Content: $($contentResponse | ConvertTo-Json -Depth 5)"
