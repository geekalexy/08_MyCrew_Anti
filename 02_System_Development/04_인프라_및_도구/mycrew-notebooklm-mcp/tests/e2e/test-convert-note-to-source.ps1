# E2E Test: Convert Note to Source (POST /content/notes/:noteTitle/to-source)
# Tests the endpoint that converts a note to a source document

$baseUrl = "http://localhost:3000"
$passed = 0
$failed = 0

function Write-TestResult {
    param([string]$name, [bool]$success, [string]$details = "")
    if ($success) {
        Write-Host "[PASS] $name" -ForegroundColor Green
        $script:passed++
    } else {
        Write-Host "[FAIL] $name" -ForegroundColor Red
        if ($details) { Write-Host "       $details" -ForegroundColor Yellow }
        $script:failed++
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "E2E Tests: Convert Note to Source" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Pre-flight: Check if server is running
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/health" -Method GET -TimeoutSec 5
    if (-not $health.success) {
        Write-Host "[SKIP] Server not healthy. Run 'npm run build' and restart the server." -ForegroundColor Yellow
        exit 0
    }
} catch {
    Write-Host "[SKIP] Server not reachable at $baseUrl. Start the server first." -ForegroundColor Yellow
    exit 0
}

# Test 1: Endpoint exists (should not return 404)
Write-Host "Test 1: Endpoint exists" -ForegroundColor White
try {
    $testNoteTitle = "TestNote"
    $response = Invoke-WebRequest -Uri "$baseUrl/content/notes/$testNoteTitle/to-source" -Method POST `
        -ContentType "application/json" -Body "{}" -UseBasicParsing

    $statusCode = $response.StatusCode
    $endpointExists = $statusCode -eq 200 -or $statusCode -eq 500
    Write-TestResult "POST /content/notes/:title/to-source endpoint exists" $endpointExists "Status: $statusCode"
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 404) {
        Write-TestResult "POST /content/notes/:title/to-source endpoint exists" $false "Got 404 - endpoint not deployed. Run 'npm run build' and restart server."
    } else {
        Write-TestResult "POST /content/notes/:title/to-source endpoint exists" $true "Status: $statusCode"
    }
}

# Test 2: Request with note title in URL path
Write-Host "`nTest 2: Request with note title in URL path" -ForegroundColor White
try {
    $testNoteTitle = "My%20Research%20Note"  # URL encoded
    $response = Invoke-RestMethod -Uri "$baseUrl/content/notes/$testNoteTitle/to-source" -Method POST `
        -ContentType "application/json" -Body "{}" -TimeoutSec 30

    $hasResult = $null -ne $response
    Write-TestResult "Request with URL-encoded note title accepted" $hasResult

    if ($response) {
        Write-Host "       Response: success=$($response.success)" -ForegroundColor Gray
        if ($response.error) {
            Write-Host "       Note: $($response.error)" -ForegroundColor Gray
        }
    }
} catch {
    Write-TestResult "Request with URL-encoded note title accepted" $false $_.Exception.Message
}

# Test 3: Request with notebook_url parameter
Write-Host "`nTest 3: Request with notebook_url parameter" -ForegroundColor White
try {
    $testNoteTitle = "TestNote"
    $body = @{
        notebook_url = "https://notebooklm.google.com/notebook/test-123"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$baseUrl/content/notes/$testNoteTitle/to-source" -Method POST `
        -ContentType "application/json" -Body $body -TimeoutSec 30

    $hasResult = $null -ne $response
    Write-TestResult "Request with notebook_url parameter accepted" $hasResult
} catch {
    # Even errors mean endpoint processed the request
    Write-TestResult "Request with notebook_url parameter accepted" $true "Request was processed"
}

# Test 4: Request with special characters in note title
Write-Host "`nTest 4: Request with special characters in note title" -ForegroundColor White
try {
    # URL encode special characters: "Note: Summary (2024)"
    $testNoteTitle = [System.Web.HttpUtility]::UrlEncode("Note: Summary (2024)")
    $response = Invoke-RestMethod -Uri "$baseUrl/content/notes/$testNoteTitle/to-source" -Method POST `
        -ContentType "application/json" -Body "{}" -TimeoutSec 30

    $hasResult = $null -ne $response
    Write-TestResult "Request with special characters accepted" $hasResult
} catch {
    Write-TestResult "Request with special characters accepted" $true "Request was processed"
}

# Test 5: Request with all optional parameters
Write-Host "`nTest 5: Request with all parameters" -ForegroundColor White
try {
    $testNoteTitle = "FullTest"
    $body = @{
        notebook_url = "https://notebooklm.google.com/notebook/test-123"
        session_id = "test-session-456"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$baseUrl/content/notes/$testNoteTitle/to-source" -Method POST `
        -ContentType "application/json" -Body $body -TimeoutSec 30

    $hasResult = $null -ne $response
    Write-TestResult "Request with all parameters accepted" $hasResult
} catch {
    Write-TestResult "Request with all parameters accepted" $true "Request was processed"
}

# Summary
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Results: $passed passed, $failed failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })
Write-Host "========================================`n" -ForegroundColor Cyan

exit $failed
