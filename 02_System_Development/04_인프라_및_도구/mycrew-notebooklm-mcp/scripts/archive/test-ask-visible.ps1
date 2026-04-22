# Test /ask with visible browser to see what's happening
$body = @{
    notebook_id = "notebook-2"
    question = "Qu'est-ce que l'IFS?"
    show_browser = $true
} | ConvertTo-Json

Write-Host "Asking with visible browser..."
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/ask" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 180
    Write-Host "`nResponse:"
    if ($response.success) {
        Write-Host "SUCCESS!"
        Write-Host "Answer: $($response.data.answer)"
    } else {
        Write-Host "FAILED: $($response.error)"
    }
} catch {
    Write-Host "Error: $_"
}
