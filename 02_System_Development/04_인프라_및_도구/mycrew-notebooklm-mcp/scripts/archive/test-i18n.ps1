$body = @{
    question = "Qu'est-ce que la CNV en une phrase?"
    notebook_id = "notebook-1"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:3000/ask" -Method POST -ContentType "application/json" -Body $body
$response | ConvertTo-Json -Depth 10
