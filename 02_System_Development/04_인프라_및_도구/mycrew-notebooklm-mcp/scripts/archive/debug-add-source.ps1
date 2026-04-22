# Debug script to investigate Add source dialog
$body = @{
    notebook_id = "notebook-1"
    source_type = "url"
    url = "https://en.wikipedia.org/wiki/Test"
    show_browser = $true
} | ConvertTo-Json

Write-Host "Testing Add source with visible browser..."
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/content/sources" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 120
    $response | ConvertTo-Json -Depth 5
} catch {
    Write-Host "Error: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host "Response: $($reader.ReadToEnd())"
    }
}
