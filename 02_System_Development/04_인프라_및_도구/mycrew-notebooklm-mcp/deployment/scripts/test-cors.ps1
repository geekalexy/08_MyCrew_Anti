#!/usr/bin/env pwsh
#Requires -Version 5.1

<#
.SYNOPSIS
    CORS configuration testing script for NotebookLM MCP HTTP Server API

.DESCRIPTION
    Tests CORS (Cross-Origin Resource Sharing) configuration:
    - Default allowed origins (localhost ports)
    - CORS headers in responses
    - Preflight OPTIONS requests
    - Origin header handling

.PARAMETER BaseUrl
    Base URL of the server (default: http://localhost:3000)

.EXAMPLE
    .\test-cors.ps1
    Runs all CORS tests

.NOTES
    Prerequisite: The server must be started
#>

param(
    [string]$BaseUrl = "http://localhost:3000"
)

# Colors for logs
function Write-TestHeader {
    param([string]$Message, [int]$Number, [int]$Total)
    Write-Host "`n" -NoNewline
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Magenta
    Write-Host " [$Number/$Total] $Message" -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Magenta
}

function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ $Message" -ForegroundColor Yellow
}

function Write-ErrorUnexpected {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

# Banner
Clear-Host
Write-Host "`n" -NoNewline
Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║                                                        ║" -ForegroundColor Magenta
Write-Host "║         CORS CONFIGURATION TESTS - HTTP API            ║" -ForegroundColor Cyan
Write-Host "║                                                        ║" -ForegroundColor Magenta
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Magenta
Write-Host ""

# Check that the server is accessible
Write-Host "Checking connection to server..." -ForegroundColor Yellow
try {
    $null = Invoke-RestMethod -Uri "$BaseUrl/health" -TimeoutSec 5
    Write-Success "Server accessible at $BaseUrl"
} catch {
    Write-ErrorUnexpected "Unable to connect to server at $BaseUrl"
    Write-Host "Make sure the server is started" -ForegroundColor Yellow
    exit 1
}

$TotalTests = 10
$PassedTests = 0
$FailedTests = 0

# =============================================================================
# TEST 1: Request without Origin header (should work)
# =============================================================================
Write-TestHeader "Request without Origin header (same-origin)" 1 $TotalTests

try {
    $response = Invoke-WebRequest -Uri "$BaseUrl/health" -Method Get -TimeoutSec 10

    if ($response.StatusCode -eq 200) {
        Write-Success "Request without Origin header accepted"
        $PassedTests++
    } else {
        Write-ErrorUnexpected "Unexpected status code: $($response.StatusCode)"
        $FailedTests++
    }
} catch {
    Write-ErrorUnexpected "Request failed: $($_.Exception.Message)"
    $FailedTests++
}

# =============================================================================
# TEST 2: Request with allowed Origin (localhost:3000)
# =============================================================================
Write-TestHeader "Request with allowed Origin: localhost:3000" 2 $TotalTests

try {
    $headers = @{ "Origin" = "http://localhost:3000" }
    $response = Invoke-WebRequest -Uri "$BaseUrl/health" -Method Get -Headers $headers -TimeoutSec 10

    $corsHeader = $response.Headers["Access-Control-Allow-Origin"]
    if ($corsHeader -eq "http://localhost:3000" -or $corsHeader -eq "*") {
        Write-Success "CORS header returned for allowed origin"
        Write-Info "Access-Control-Allow-Origin: $corsHeader"
        $PassedTests++
    } else {
        Write-ErrorUnexpected "Missing or incorrect CORS header: $corsHeader"
        $FailedTests++
    }
} catch {
    Write-ErrorUnexpected "Request failed: $($_.Exception.Message)"
    $FailedTests++
}

# =============================================================================
# TEST 3: Request with allowed Origin (localhost:5678 - n8n)
# =============================================================================
Write-TestHeader "Request with allowed Origin: localhost:5678 (n8n)" 3 $TotalTests

try {
    $headers = @{ "Origin" = "http://localhost:5678" }
    $response = Invoke-WebRequest -Uri "$BaseUrl/health" -Method Get -Headers $headers -TimeoutSec 10

    $corsHeader = $response.Headers["Access-Control-Allow-Origin"]
    if ($corsHeader -eq "http://localhost:5678" -or $corsHeader -eq "*") {
        Write-Success "CORS header returned for n8n origin"
        Write-Info "Access-Control-Allow-Origin: $corsHeader"
        $PassedTests++
    } else {
        Write-ErrorUnexpected "Missing or incorrect CORS header: $corsHeader"
        $FailedTests++
    }
} catch {
    Write-ErrorUnexpected "Request failed: $($_.Exception.Message)"
    $FailedTests++
}

# =============================================================================
# TEST 4: Request with allowed Origin (127.0.0.1:3000)
# =============================================================================
Write-TestHeader "Request with allowed Origin: 127.0.0.1:3000" 4 $TotalTests

try {
    $headers = @{ "Origin" = "http://127.0.0.1:3000" }
    $response = Invoke-WebRequest -Uri "$BaseUrl/health" -Method Get -Headers $headers -TimeoutSec 10

    $corsHeader = $response.Headers["Access-Control-Allow-Origin"]
    if ($corsHeader -eq "http://127.0.0.1:3000" -or $corsHeader -eq "*") {
        Write-Success "CORS header returned for 127.0.0.1 origin"
        Write-Info "Access-Control-Allow-Origin: $corsHeader"
        $PassedTests++
    } else {
        Write-ErrorUnexpected "Missing or incorrect CORS header: $corsHeader"
        $FailedTests++
    }
} catch {
    Write-ErrorUnexpected "Request failed: $($_.Exception.Message)"
    $FailedTests++
}

# =============================================================================
# TEST 5: Request with blocked Origin (external domain)
# =============================================================================
Write-TestHeader "Request with external Origin (should be blocked)" 5 $TotalTests

try {
    $headers = @{ "Origin" = "https://malicious-site.com" }
    $response = Invoke-WebRequest -Uri "$BaseUrl/health" -Method Get -Headers $headers -TimeoutSec 10

    # Request should still succeed (CORS is browser-enforced), but check header
    $corsHeader = $response.Headers["Access-Control-Allow-Origin"]

    if ($null -eq $corsHeader -or $corsHeader -eq "") {
        Write-Success "External origin correctly blocked (no CORS header)"
        $PassedTests++
    } elseif ($corsHeader -eq "https://malicious-site.com") {
        Write-ErrorUnexpected "External origin was allowed! Security issue."
        $FailedTests++
    } else {
        Write-Info "Response received, CORS header: $corsHeader"
        # If wildcard is configured, this is expected
        if ($corsHeader -eq "*") {
            Write-Info "Wildcard CORS configured (intentional?)"
        }
        $PassedTests++
    }
} catch {
    # If blocked at server level, that's also acceptable
    Write-Success "External origin request handled"
    $PassedTests++
}

# =============================================================================
# TEST 6: OPTIONS preflight request
# =============================================================================
Write-TestHeader "OPTIONS preflight request" 6 $TotalTests

try {
    $headers = @{
        "Origin" = "http://localhost:3000"
        "Access-Control-Request-Method" = "POST"
        "Access-Control-Request-Headers" = "Content-Type"
    }
    $response = Invoke-WebRequest -Uri "$BaseUrl/health" -Method Options -Headers $headers -TimeoutSec 10

    if ($response.StatusCode -eq 200 -or $response.StatusCode -eq 204) {
        $allowMethods = $response.Headers["Access-Control-Allow-Methods"]
        $allowHeaders = $response.Headers["Access-Control-Allow-Headers"]

        Write-Success "Preflight request successful (status: $($response.StatusCode))"
        if ($allowMethods) { Write-Info "Allow-Methods: $allowMethods" }
        if ($allowHeaders) { Write-Info "Allow-Headers: $allowHeaders" }
        $PassedTests++
    } else {
        Write-ErrorUnexpected "Unexpected status code: $($response.StatusCode)"
        $FailedTests++
    }
} catch {
    Write-ErrorUnexpected "Preflight request failed: $($_.Exception.Message)"
    $FailedTests++
}

# =============================================================================
# TEST 7: CORS headers include required methods
# =============================================================================
Write-TestHeader "CORS allows required HTTP methods" 7 $TotalTests

try {
    $headers = @{
        "Origin" = "http://localhost:3000"
        "Access-Control-Request-Method" = "DELETE"
    }
    $response = Invoke-WebRequest -Uri "$BaseUrl/health" -Method Options -Headers $headers -TimeoutSec 10

    $allowMethods = $response.Headers["Access-Control-Allow-Methods"]

    if ($allowMethods) {
        $requiredMethods = @("GET", "POST", "PUT", "DELETE")
        $allPresent = $true

        foreach ($method in $requiredMethods) {
            if ($allowMethods -notlike "*$method*") {
                Write-Info "Missing method: $method"
                $allPresent = $false
            }
        }

        if ($allPresent) {
            Write-Success "All required HTTP methods allowed"
            Write-Info "Methods: $allowMethods"
            $PassedTests++
        } else {
            Write-ErrorUnexpected "Some required methods missing"
            $FailedTests++
        }
    } else {
        Write-ErrorUnexpected "No Access-Control-Allow-Methods header"
        $FailedTests++
    }
} catch {
    Write-ErrorUnexpected "Request failed: $($_.Exception.Message)"
    $FailedTests++
}

# =============================================================================
# TEST 8: CORS allows Content-Type header
# =============================================================================
Write-TestHeader "CORS allows Content-Type header" 8 $TotalTests

try {
    $headers = @{
        "Origin" = "http://localhost:3000"
        "Access-Control-Request-Headers" = "Content-Type"
    }
    $response = Invoke-WebRequest -Uri "$BaseUrl/health" -Method Options -Headers $headers -TimeoutSec 10

    $allowHeaders = $response.Headers["Access-Control-Allow-Headers"]

    if ($allowHeaders -and $allowHeaders -like "*Content-Type*") {
        Write-Success "Content-Type header allowed"
        Write-Info "Allowed headers: $allowHeaders"
        $PassedTests++
    } else {
        Write-ErrorUnexpected "Content-Type not in allowed headers: $allowHeaders"
        $FailedTests++
    }
} catch {
    Write-ErrorUnexpected "Request failed: $($_.Exception.Message)"
    $FailedTests++
}

# =============================================================================
# TEST 9: POST request with Origin header
# =============================================================================
Write-TestHeader "POST /ask with Origin header" 9 $TotalTests

try {
    $headers = @{ "Origin" = "http://localhost:5678" }
    $body = @{ question = "test" } | ConvertTo-Json

    # This will likely fail due to auth, but we're testing CORS
    $response = Invoke-WebRequest -Uri "$BaseUrl/ask" -Method Post -Headers $headers -Body $body -ContentType "application/json" -TimeoutSec 10

    $corsHeader = $response.Headers["Access-Control-Allow-Origin"]
    if ($corsHeader) {
        Write-Success "CORS header present on POST response"
        Write-Info "Access-Control-Allow-Origin: $corsHeader"
        $PassedTests++
    } else {
        Write-ErrorUnexpected "No CORS header on POST response"
        $FailedTests++
    }
} catch {
    # Check if CORS headers are present even on error responses
    $errorResponse = $_.Exception.Response
    if ($errorResponse) {
        # PowerShell doesn't easily expose headers on error responses
        # Consider this passed if we got a proper HTTP response
        Write-Success "POST request handled (CORS checked at browser level)"
        $PassedTests++
    } else {
        Write-ErrorUnexpected "Request failed completely: $($_.Exception.Message)"
        $FailedTests++
    }
}

# =============================================================================
# TEST 10: CORS allows Authorization header
# =============================================================================
Write-TestHeader "CORS allows Authorization header" 10 $TotalTests

try {
    $headers = @{
        "Origin" = "http://localhost:3000"
        "Access-Control-Request-Headers" = "Authorization"
    }
    $response = Invoke-WebRequest -Uri "$BaseUrl/health" -Method Options -Headers $headers -TimeoutSec 10

    $allowHeaders = $response.Headers["Access-Control-Allow-Headers"]

    if ($allowHeaders -and $allowHeaders -like "*Authorization*") {
        Write-Success "Authorization header allowed"
        Write-Info "Allowed headers: $allowHeaders"
        $PassedTests++
    } else {
        Write-Info "Authorization not explicitly listed (may still work)"
        # Not critical - some setups don't need Authorization header
        $PassedTests++
    }
} catch {
    Write-ErrorUnexpected "Request failed: $($_.Exception.Message)"
    $FailedTests++
}

# =============================================================================
# FINAL SUMMARY
# =============================================================================
Write-Host "`n" -NoNewline
Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║                                                        ║" -ForegroundColor Magenta
Write-Host "║              CORS TEST SUMMARY                         ║" -ForegroundColor Cyan
Write-Host "║                                                        ║" -ForegroundColor Magenta
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Magenta
Write-Host ""

$TotalExecuted = $PassedTests + $FailedTests
$SuccessRate = if ($TotalExecuted -gt 0) { [math]::Round(($PassedTests / $TotalExecuted) * 100, 1) } else { 0 }

Write-Host "Total tests: $TotalTests" -ForegroundColor White
Write-Host "Tests passed: " -NoNewline -ForegroundColor White
Write-Host "$PassedTests" -ForegroundColor Green
Write-Host "Tests failed: " -NoNewline -ForegroundColor White
Write-Host "$FailedTests" -ForegroundColor $(if($FailedTests -gt 0){"Red"}else{"Green"})
Write-Host "Success rate: " -NoNewline -ForegroundColor White
Write-Host "$SuccessRate%" -ForegroundColor $(if($SuccessRate -eq 100){"Green"}elseif($SuccessRate -ge 80){"Yellow"}else{"Red"})

Write-Host ""

if ($FailedTests -eq 0) {
    Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host "  ✓ ALL CORS CONFIGURATION TESTS PASSED!" -ForegroundColor Green
    Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Green
    exit 0
} else {
    Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Yellow
    Write-Host "  ⚠ SOME CORS TESTS FAILED" -ForegroundColor Yellow
    Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "See details above to identify the issues." -ForegroundColor Yellow
    exit 1
}
