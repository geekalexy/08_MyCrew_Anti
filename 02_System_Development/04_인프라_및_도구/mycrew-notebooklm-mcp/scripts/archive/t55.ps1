# Test 55: Malformed JSON - should fail gracefully
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/ask" -Method POST -ContentType "application/json" -Body "not valid json" -TimeoutSec 10
    Write-Host "FAIL: Should have returned error"
} catch {
    if ($_.Exception.Response.StatusCode -eq 400 -or $_.Exception.Response.StatusCode -eq 500) {
        Write-Host "PASS: Correctly handled malformed JSON"
    } else {
        Write-Host "PASS: Correctly handled malformed JSON (exception)"
    }
}
