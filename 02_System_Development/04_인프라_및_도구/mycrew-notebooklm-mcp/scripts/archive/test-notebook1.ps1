# Test with notebook-1 (CNV) to see if issue is notebook-specific
$body = @{
    notebook_id = "notebook-1"
    question = "What is CNV?"
} | ConvertTo-Json

Write-Host "Asking question to notebook-1 (CNV)..."
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/ask" -Method POST -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec 180
    Write-Host "Success: $($response.success)"
    Write-Host "Answer: $($response.data.answer.Substring(0, [Math]::Min(200, $response.data.answer.Length)))..."
} catch {
    Write-Host "Error: $_"
}
