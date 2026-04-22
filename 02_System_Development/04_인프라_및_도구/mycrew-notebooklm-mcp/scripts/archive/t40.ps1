# Test 40: Reject missing content_type
try {
    Invoke-RestMethod -Uri "http://localhost:3000/content/download" -TimeoutSec 5 | Out-Null
    Write-Host "FAIL"
} catch { Write-Host "PASS" }
