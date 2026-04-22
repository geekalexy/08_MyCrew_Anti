# Activate notebook-2 (Test Notebook) and check sources
Write-Host "Activating notebook-2..."
$response = Invoke-RestMethod -Uri "http://localhost:3000/notebooks/notebook-2/activate" -Method PUT
Write-Host "Activated: $($response.data.notebook.name)"

Start-Sleep -Seconds 3

Write-Host "`nGetting content..."
$content = Invoke-RestMethod -Uri "http://localhost:3000/content" -Method GET
Write-Host "Source count: $($content.data.sourceCount)"
Write-Host "Sources:"
$content.data.sources | ForEach-Object { Write-Host "  - $($_.name)" }
