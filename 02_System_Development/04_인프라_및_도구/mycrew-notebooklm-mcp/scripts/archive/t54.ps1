# Test 54: Invalid notebook ID - should fail
$body = @{ question = "Test"; notebook_id = "non-existent-notebook" } | ConvertTo-Json
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/ask" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 10
    if ($response.success -eq $false) {
        Write-Host "PASS: Correctly rejected invalid notebook"
    } else {
        Write-Host "FAIL: Should have returned error"
    }
} catch {
    Write-Host "PASS: Correctly rejected invalid notebook"
}
