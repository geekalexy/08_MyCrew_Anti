# Simple test of /ask endpoint
$body = @{
    notebook_id = "notebook-2"
    question = "What is IFS therapy?"
} | ConvertTo-Json

Write-Host "Asking question to notebook-2..."
Write-Host "Question: What is IFS therapy?"
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/ask" -Method POST -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec 180
    Write-Host "Response received!"
    Write-Host "Success: $($response.success)"
    if ($response.data.answer -ne "Le système n'a pas pu répondre.") {
        Write-Host "REAL ANSWER!"
        Write-Host "Answer length: $($response.data.answer.Length) chars"
        Write-Host "Preview: $($response.data.answer.Substring(0, [Math]::Min(300, $response.data.answer.Length)))..."
    } else {
        Write-Host "ERROR: Got error message: $($response.data.answer)"
    }
} catch {
    Write-Host "Request failed: $_"
}
