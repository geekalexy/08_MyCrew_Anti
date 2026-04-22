# Test with ASCII-only question (no accents)
$body = @{
    notebook_id = "notebook-1"
    question = "What are the main steps of the CNV process?"
} | ConvertTo-Json

Write-Host "Asking ASCII-only question..."
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/ask" -Method POST -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec 180
    Write-Host "`nResponse:"
    if ($response.success -and $response.data.answer -ne "Le systeme n'a pas pu repondre.") {
        Write-Host "SUCCESS! Got answer!"
        Write-Host "Answer length: $($response.data.answer.Length) chars"
        Write-Host "Answer preview: $($response.data.answer.Substring(0, [Math]::Min(500, $response.data.answer.Length)))..."
    } else {
        Write-Host "Error or empty: $($response.data.answer)"
    }
} catch {
    Write-Host "Error: $_"
}
