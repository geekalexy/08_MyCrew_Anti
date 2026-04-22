# Test 39: Reject invalid download type
try {
    Invoke-RestMethod -Uri "http://localhost:3000/content/download?content_type=invalid_type" -TimeoutSec 5 | Out-Null
    Write-Host "FAIL"
} catch { Write-Host "PASS" }
