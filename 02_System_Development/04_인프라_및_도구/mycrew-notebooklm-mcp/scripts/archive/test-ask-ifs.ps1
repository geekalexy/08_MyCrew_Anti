# Test /ask with real IFS content
$body = @{
    notebook_id = "notebook-2"
    question = "Qu'est-ce que l'IFS et quels sont ses principes fondamentaux?"
} | ConvertTo-Json

Write-Host "Asking question about IFS..."
$response = Invoke-RestMethod -Uri "http://localhost:3000/ask" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 120

Write-Host "`nResponse:"
if ($response.success) {
    Write-Host "SUCCESS!"
    Write-Host "Answer: $($response.data.answer.Substring(0, [Math]::Min(500, $response.data.answer.Length)))..."
} else {
    Write-Host "FAILED: $($response.error)"
}
