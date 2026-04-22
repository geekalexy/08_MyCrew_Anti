# Test with a real, substantive question
$body = @{
    notebook_id = "notebook-1"
    question = "Quelles sont les 4 étapes du processus OSBD en Communication NonViolente et comment les appliquer concrètement?"
} | ConvertTo-Json

Write-Host "Asking a real question about CNV..."
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/ask" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 180
    Write-Host "`nResponse:"
    if ($response.success -and $response.data.answer -ne "Le système n'a pas pu répondre.") {
        Write-Host "SUCCESS! Got real answer!"
        Write-Host "Answer: $($response.data.answer.Substring(0, [Math]::Min(500, $response.data.answer.Length)))..."
    } else {
        Write-Host "Still got error: $($response.data.answer)"
    }
} catch {
    Write-Host "Error: $_"
}
