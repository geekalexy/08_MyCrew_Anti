# Debug script - use auto-discover to find a valid notebook first
Write-Host "Step 1: Auto-discovering notebooks for current account..."

$discoverBody = @{
    max_notebooks = 3
} | ConvertTo-Json

try {
    $notebooks = Invoke-RestMethod -Uri "http://localhost:3000/notebooks/auto-discover" -Method POST -ContentType "application/json" -Body $discoverBody -TimeoutSec 120
    Write-Host "Discovered notebooks:"
    $notebooks | ConvertTo-Json -Depth 3

    if ($notebooks.data.discovered -gt 0) {
        $firstNotebook = $notebooks.data.notebooks[0]
        Write-Host "`nStep 2: Testing URL source on notebook: $($firstNotebook.name)"

        $body = @{
            notebook_id = $firstNotebook.id
            source_type = "url"
            url = "https://en.wikipedia.org/wiki/Test"
            show_browser = $true
        } | ConvertTo-Json

        $response = Invoke-RestMethod -Uri "http://localhost:3000/content/sources" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 120
        $response | ConvertTo-Json -Depth 5
    }
} catch {
    Write-Host "Error: $($_.Exception.Message)"
}
