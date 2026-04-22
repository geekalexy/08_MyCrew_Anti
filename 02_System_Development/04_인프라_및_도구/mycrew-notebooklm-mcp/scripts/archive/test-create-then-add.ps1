# Step 1: Create a new notebook on current account
Write-Host "Creating a test notebook..."
$createBody = @{
    name = "Test-English-Account"
    url = "https://notebooklm.google.com"
} | ConvertTo-Json

# First, let's just do a simple /ask with show_browser to see what account we're on
Write-Host "Testing /ask with visible browser to verify account..."
$askBody = @{
    question = "Hello, what is this notebook about?"
    show_browser = $true
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:3000/ask" -Method POST -ContentType "application/json" -Body $askBody -TimeoutSec 120
Write-Host "Response:"
$response | ConvertTo-Json -Depth 5
