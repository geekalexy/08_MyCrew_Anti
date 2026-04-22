# Activate notebook-1 and take a screenshot
$response = Invoke-RestMethod -Uri "http://localhost:3000/notebooks/notebook-1/activate" -Method PUT
Write-Host "Activated notebook-1"

Start-Sleep -Seconds 2

# Try to add a source and capture debug info
$body = @{
    notebook_id = "notebook-1"
    source_type = "text"
    title = "E2E Test Source"
    content = "Test content for debugging the add source button."
} | ConvertTo-Json -Depth 5

Write-Host "Attempting to add source..."
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/content/sources" -Method POST -ContentType "application/json" -Body $body
    Write-Host "Response:"
    $response | ConvertTo-Json -Depth 5
} catch {
    Write-Host "Error: $_"
}
