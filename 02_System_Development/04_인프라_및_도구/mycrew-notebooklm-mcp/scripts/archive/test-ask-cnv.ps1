# Test /ask with CNV notebook (READ ONLY - no modifications)
$body = @{
    notebook_id = "notebook-1"
    question = "Qu'est-ce que la CNV?"
} | ConvertTo-Json

Write-Host "Asking CNV notebook (read-only test)..."
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/ask" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 180
    Write-Host "`nResponse:"
    if ($response.success) {
        Write-Host "SUCCESS!"
        Write-Host "Answer length: $($response.data.answer.Length) chars"
        Write-Host "Answer preview: $($response.data.answer.Substring(0, [Math]::Min(300, $response.data.answer.Length)))..."
    } else {
        Write-Host "FAILED: $($response.error)"
    }
} catch {
    Write-Host "Error: $_"
}
