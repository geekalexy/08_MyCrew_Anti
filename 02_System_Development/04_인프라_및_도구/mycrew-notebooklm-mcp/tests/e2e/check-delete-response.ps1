$response = Invoke-WebRequest -Uri "http://localhost:3000/content/sources?source_name=NonExistent" -Method DELETE -UseBasicParsing
Write-Host "Status: $($response.StatusCode)"
Write-Host "Content: $($response.Content)"
