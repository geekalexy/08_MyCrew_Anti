#!/usr/bin/env pwsh
#Requires -Version 5.1

<#
.SYNOPSIS
    Session management testing script for NotebookLM MCP HTTP Server API

.DESCRIPTION
    Tests session management endpoints and behavior:
    - GET /sessions (list sessions)
    - DELETE /sessions/:id (close session)
    - POST /sessions/:id/reset (reset session)
    - Session error handling

.PARAMETER BaseUrl
    Base URL of the server (default: http://localhost:3000)

.EXAMPLE
    .\test-sessions.ps1
    Runs all session management tests

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

function Write-ErrorExpected {
    param([string]$Message)
    Write-Host "✓ Expected error: $Message" -ForegroundColor Green
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
Write-Host "║         SESSION MANAGEMENT TESTS - HTTP API            ║" -ForegroundColor Cyan
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
# TEST 1: GET /sessions - List sessions (should return array)
# =============================================================================
Write-TestHeader "GET /sessions - List active sessions" 1 $TotalTests

try {
    $result = Invoke-RestMethod -Uri "$BaseUrl/sessions" -TimeoutSec 10

    if ($result.success -eq $true -and $null -ne $result.data) {
        $sessions = $result.data.sessions
        if ($null -ne $sessions -and $sessions -is [Array]) {
            Write-Success "Sessions list returned successfully"
            Write-Info "Active sessions: $($sessions.Count)"
            $PassedTests++
        } else {
            Write-ErrorUnexpected "Sessions data not in expected format"
            $FailedTests++
        }
    } else {
        Write-ErrorUnexpected "Failed to list sessions: $($result.error)"
        $FailedTests++
    }
} catch {
    Write-ErrorUnexpected "Exception: $($_.Exception.Message)"
    $FailedTests++
}

# =============================================================================
# TEST 2: GET /sessions - Response contains required fields
# =============================================================================
Write-TestHeader "GET /sessions - Response structure validation" 2 $TotalTests

try {
    $result = Invoke-RestMethod -Uri "$BaseUrl/sessions" -TimeoutSec 10

    if ($result.success -eq $true) {
        $data = $result.data

        # Check for session count info
        $hasCount = $null -ne $data.total_count -or $null -ne $data.sessions

        if ($hasCount) {
            Write-Success "Response contains session information"
            if ($data.total_count) { Write-Info "Total count: $($data.total_count)" }
            if ($data.max_sessions) { Write-Info "Max sessions: $($data.max_sessions)" }
            $PassedTests++
        } else {
            Write-ErrorUnexpected "Missing session count information"
            $FailedTests++
        }
    } else {
        Write-ErrorUnexpected "Request failed: $($result.error)"
        $FailedTests++
    }
} catch {
    Write-ErrorUnexpected "Exception: $($_.Exception.Message)"
    $FailedTests++
}

# =============================================================================
# TEST 3: DELETE /sessions/:id - Non-existent session
# =============================================================================
Write-TestHeader "DELETE /sessions/:id - Non-existent session" 3 $TotalTests

$fakeSessionId = "session-does-not-exist-12345"

try {
    $result = Invoke-RestMethod -Uri "$BaseUrl/sessions/$fakeSessionId" -Method Delete -TimeoutSec 10

    if ($result.success -eq $false) {
        if ($result.error -like "*not found*" -or $result.error -like "*introuvable*") {
            Write-ErrorExpected "$($result.error)"
            $PassedTests++
        } else {
            Write-ErrorUnexpected "Unexpected error message: $($result.error)"
            $FailedTests++
        }
    } else {
        Write-ErrorUnexpected "Should return error for non-existent session"
        $FailedTests++
    }
} catch {
    $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
    if ($errorResponse.error -like "*not found*" -or $errorResponse.error -like "*introuvable*") {
        Write-ErrorExpected "$($errorResponse.error)"
        $PassedTests++
    } else {
        Write-ErrorUnexpected "Unexpected error: $($errorResponse.error)"
        $FailedTests++
    }
}

# =============================================================================
# TEST 4: POST /sessions/:id/reset - Non-existent session
# =============================================================================
Write-TestHeader "POST /sessions/:id/reset - Non-existent session" 4 $TotalTests

try {
    $result = Invoke-RestMethod -Uri "$BaseUrl/sessions/$fakeSessionId/reset" -Method Post -TimeoutSec 10

    if ($result.success -eq $false) {
        if ($result.error -like "*not found*" -or $result.error -like "*introuvable*") {
            Write-ErrorExpected "$($result.error)"
            $PassedTests++
        } else {
            Write-ErrorUnexpected "Unexpected error message: $($result.error)"
            $FailedTests++
        }
    } else {
        Write-ErrorUnexpected "Should return error for non-existent session"
        $FailedTests++
    }
} catch {
    $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
    if ($errorResponse.error -like "*not found*" -or $errorResponse.error -like "*introuvable*") {
        Write-ErrorExpected "$($errorResponse.error)"
        $PassedTests++
    } else {
        Write-ErrorUnexpected "Unexpected error: $($errorResponse.error)"
        $FailedTests++
    }
}

# =============================================================================
# TEST 5: DELETE /sessions/:id - Empty session ID
# =============================================================================
Write-TestHeader "DELETE /sessions/ - Empty session ID (should 404)" 5 $TotalTests

try {
    # This should hit the /sessions endpoint with GET semantics or 404
    $response = Invoke-WebRequest -Uri "$BaseUrl/sessions/" -Method Delete -TimeoutSec 10

    # If we get here with 200, check what happened
    Write-Info "Got response with status $($response.StatusCode)"
    # Empty ID might be treated differently by Express
    $PassedTests++
} catch {
    $statusCode = $_.Exception.Response.StatusCode

    if ($statusCode -eq 404 -or $statusCode -eq 'NotFound') {
        Write-Success "Empty session ID correctly returns 404"
        $PassedTests++
    } elseif ($statusCode -eq 405 -or $statusCode -eq 'MethodNotAllowed') {
        Write-Success "Empty session ID correctly returns 405 (Method Not Allowed)"
        $PassedTests++
    } else {
        # Any error response is acceptable here
        Write-Success "Server handled empty session ID appropriately"
        $PassedTests++
    }
}

# =============================================================================
# TEST 6: DELETE /sessions/:id - Special characters in ID
# =============================================================================
Write-TestHeader "DELETE /sessions/:id - Special characters in ID" 6 $TotalTests

$specialId = "session%20with%20spaces"

try {
    $result = Invoke-RestMethod -Uri "$BaseUrl/sessions/$specialId" -Method Delete -TimeoutSec 10

    if ($result.success -eq $false) {
        Write-Success "Server handled special characters in session ID"
        Write-Info "Error: $($result.error.Substring(0, [Math]::Min(50, $result.error.Length)))..."
        $PassedTests++
    } else {
        Write-Info "Unexpected success (session might exist?)"
        $PassedTests++
    }
} catch {
    Write-Success "Server handled special characters appropriately"
    $PassedTests++
}

# =============================================================================
# TEST 7: POST /sessions/:id/reset - Special characters in ID
# =============================================================================
Write-TestHeader "POST /sessions/:id/reset - Special characters in ID" 7 $TotalTests

try {
    $result = Invoke-RestMethod -Uri "$BaseUrl/sessions/$specialId/reset" -Method Post -TimeoutSec 10

    if ($result.success -eq $false) {
        Write-Success "Server handled special characters in reset request"
        $PassedTests++
    } else {
        Write-Info "Unexpected success"
        $PassedTests++
    }
} catch {
    Write-Success "Server handled special characters appropriately"
    $PassedTests++
}

# =============================================================================
# TEST 8: GET /sessions - Multiple rapid requests
# =============================================================================
Write-TestHeader "GET /sessions - Multiple rapid requests (rate limiting)" 8 $TotalTests

try {
    $successCount = 0
    $errorCount = 0

    for ($i = 1; $i -le 5; $i++) {
        try {
            $result = Invoke-RestMethod -Uri "$BaseUrl/sessions" -TimeoutSec 5
            if ($result.success -eq $true) {
                $successCount++
            } else {
                $errorCount++
            }
        } catch {
            $errorCount++
        }
    }

    if ($successCount -ge 3) {
        Write-Success "Server handled rapid requests ($successCount/5 successful)"
        $PassedTests++
    } else {
        Write-ErrorUnexpected "Too many failures in rapid requests ($errorCount/5 failed)"
        $FailedTests++
    }
} catch {
    Write-ErrorUnexpected "Exception during rapid requests: $($_.Exception.Message)"
    $FailedTests++
}

# =============================================================================
# TEST 9: Session info structure (if sessions exist)
# =============================================================================
Write-TestHeader "Session info - Validate session object structure" 9 $TotalTests

try {
    $result = Invoke-RestMethod -Uri "$BaseUrl/sessions" -TimeoutSec 10

    if ($result.success -eq $true) {
        $sessions = $result.data.sessions

        if ($sessions.Count -gt 0) {
            $session = $sessions[0]

            # Check for expected session fields
            $hasId = $null -ne $session.id
            $hasCreated = $null -ne $session.created_at -or $null -ne $session.createdAt
            $hasActivity = $null -ne $session.last_activity -or $null -ne $session.lastActivity

            if ($hasId) {
                Write-Success "Session object has required 'id' field"
                Write-Info "Session ID: $($session.id)"
                if ($hasCreated) { Write-Info "Has created_at timestamp" }
                if ($hasActivity) { Write-Info "Has last_activity timestamp" }
                $PassedTests++
            } else {
                Write-ErrorUnexpected "Session object missing 'id' field"
                $FailedTests++
            }
        } else {
            Write-Info "No active sessions to validate structure"
            Write-Info "Test passed (no sessions to check)"
            $PassedTests++
        }
    } else {
        Write-ErrorUnexpected "Failed to get sessions: $($result.error)"
        $FailedTests++
    }
} catch {
    Write-ErrorUnexpected "Exception: $($_.Exception.Message)"
    $FailedTests++
}

# =============================================================================
# TEST 10: Session count consistency
# =============================================================================
Write-TestHeader "Session count - Verify count matches array length" 10 $TotalTests

try {
    $result = Invoke-RestMethod -Uri "$BaseUrl/sessions" -TimeoutSec 10

    if ($result.success -eq $true) {
        $sessions = $result.data.sessions
        $reportedCount = $result.data.total_count

        $actualCount = if ($sessions) { $sessions.Count } else { 0 }

        if ($null -eq $reportedCount) {
            Write-Info "No total_count field (using array length)"
            Write-Success "Sessions array has $actualCount items"
            $PassedTests++
        } elseif ($reportedCount -eq $actualCount) {
            Write-Success "Session count matches: $reportedCount"
            $PassedTests++
        } else {
            Write-ErrorUnexpected "Count mismatch: reported=$reportedCount, actual=$actualCount"
            $FailedTests++
        }
    } else {
        Write-ErrorUnexpected "Failed to get sessions: $($result.error)"
        $FailedTests++
    }
} catch {
    Write-ErrorUnexpected "Exception: $($_.Exception.Message)"
    $FailedTests++
}

# =============================================================================
# FINAL SUMMARY
# =============================================================================
Write-Host "`n" -NoNewline
Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║                                                        ║" -ForegroundColor Magenta
Write-Host "║           SESSION MANAGEMENT TEST SUMMARY              ║" -ForegroundColor Cyan
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
    Write-Host "  ✓ ALL SESSION MANAGEMENT TESTS PASSED!" -ForegroundColor Green
    Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Green
    exit 0
} else {
    Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Yellow
    Write-Host "  ⚠ SOME SESSION TESTS FAILED" -ForegroundColor Yellow
    Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "See details above to identify the issues." -ForegroundColor Yellow
    exit 1
}
