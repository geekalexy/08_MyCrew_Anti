#!/usr/bin/env pwsh
#Requires -Version 5.1

<#
.SYNOPSIS
    Comprehensive test script for the NotebookLM MCP HTTP Server API

.DESCRIPTION
    Tests all REST API endpoints with readable output

.PARAMETER BaseUrl
    Base URL of the server (default: http://localhost:3000)

.EXAMPLE
    .\test-api.ps1
    Runs all tests on http://localhost:3000

.EXAMPLE
    .\test-api.ps1 -BaseUrl "http://localhost:8080"
    Runs all tests on a server with a different port

.EXAMPLE
    .\test-api.ps1 -BaseUrl "http://192.168.1.100:3000"
    Runs all tests on a remote server

.NOTES
    Prerequisites:
    - The server must be running
    - At least one notebook must be configured for complete tests
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

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

# Banner
Clear-Host
Write-Host "`n" -NoNewline
Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║                                                        ║" -ForegroundColor Magenta
Write-Host "║      NOTEBOOKLM MCP HTTP SERVER API TESTS             ║" -ForegroundColor Cyan
Write-Host "║                                                        ║" -ForegroundColor Magenta
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Magenta
Write-Host ""

# Check that the server is accessible
Write-Host "Checking server connection..." -ForegroundColor Yellow
try {
    $null = Invoke-RestMethod -Uri "$BaseUrl/health" -TimeoutSec 5
    Write-Success "Server accessible at $BaseUrl"
} catch {
    Write-Error-Custom "Unable to connect to server at $BaseUrl"
    Write-Host "Make sure the server is running with: npm run start:http" -ForegroundColor Yellow
    exit 1
}

# Request a valid notebook URL for add tests
Write-Host "`n" -NoNewline
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host " Test Configuration (optional)" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host ""
Write-Host "To test adding notebooks, provide a valid NotebookLM URL." -ForegroundColor White
Write-Host "Format: https://notebooklm.google.com/notebook/[id]" -ForegroundColor Gray
Write-Host ""
Write-Host "Press [Enter] to skip, or paste a URL:" -ForegroundColor Yellow
$testNotebookUrlForAdd = Read-Host "URL"

if ([string]::IsNullOrWhiteSpace($testNotebookUrlForAdd)) {
    Write-Info "Notebook add tests will be skipped`n"
    $script:testNotebookUrlForAdd = $null
} else {
    Write-Success "URL provided for add tests: $testNotebookUrlForAdd`n"
    $script:testNotebookUrlForAdd = $testNotebookUrlForAdd
}

$TotalTests = 11
$PassedTests = 0
$FailedTests = 0

# =============================================================================
# TEST 1: GET /health - Server health check
# =============================================================================
Write-TestHeader "GET /health - Server health check" 1 $TotalTests

try {
    $health = Invoke-RestMethod -Uri "$BaseUrl/health"

    if ($health.success) {
        Write-Success "Server is healthy"
        Write-Host "`nDetails:" -ForegroundColor White
        $health.data | Format-List

        if ($health.data.authenticated) {
            Write-Success "Google Authentication: ACTIVE"
        } else {
            Write-Info "Google Authentication: INACTIVE (run: npm run setup-auth)"
        }

        Write-Success "Active sessions: $($health.data.sessions)"
        Write-Success "Configured notebooks: $($health.data.library_notebooks)"

        $PassedTests++
    } else {
        Write-Error-Custom "Server returned success: false"
        $FailedTests++
    }
} catch {
    Write-Error-Custom "Error: $_"
    $FailedTests++
}

# =============================================================================
# TEST 2: GET /notebooks - List all notebooks
# =============================================================================
Write-TestHeader "GET /notebooks - List all notebooks" 2 $TotalTests

try {
    $notebooks = Invoke-RestMethod -Uri "$BaseUrl/notebooks"

    if ($notebooks.success) {
        $count = $notebooks.data.notebooks.Count
        Write-Success "Retrieved $count notebook(s)"

        if ($count -gt 0) {
            Write-Host "`nNotebook list:" -ForegroundColor White
            $notebooks.data.notebooks | Format-Table `
                @{Label="ID"; Expression={$_.id}; Width=15}, `
                @{Label="Name"; Expression={$_.name}; Width=20}, `
                @{Label="Use Count"; Expression={$_.use_count}; Width=13}, `
                @{Label="Active"; Expression={if($_.id -eq $notebooks.data.active_notebook_id){"✓"}else{""}}; Width=6}

            Write-Info "Active notebook: $($notebooks.data.active_notebook_id)"
        } else {
            Write-Info "No configured notebooks. Add one with POST /notebooks"
        }

        $PassedTests++
    } else {
        Write-Error-Custom "Server returned success: false"
        $FailedTests++
    }
} catch {
    Write-Error-Custom "Error: $_"
    $FailedTests++
}

# Save a notebook for following tests
$testNotebook = $null
if ($notebooks.data.notebooks.Count -gt 0) {
    $testNotebook = $notebooks.data.notebooks[0]
    $testNotebookId = $testNotebook.id
    $testNotebookUrl = $testNotebook.url
} else {
    Write-Host "`n⚠️  WARNING: No configured notebooks" -ForegroundColor Yellow
    Write-Host "   Some tests will be skipped" -ForegroundColor Yellow
    Write-Host "   Add at least one notebook for complete tests" -ForegroundColor Yellow
}

# =============================================================================
# TEST 3: POST /notebooks - Add a notebook (with validation)
# =============================================================================
Write-TestHeader "POST /notebooks - Add a notebook (with validation)" 3 $TotalTests

if ($script:testNotebookUrlForAdd) {
    Write-Info "This test may take 15-30 seconds (live validation)..."
    Write-Info "URL to test: $($script:testNotebookUrlForAdd)"

    # Sub-test 1: Add a valid notebook
    Write-Host "`nSub-test 3.1: Add a valid notebook" -ForegroundColor Yellow

    $testName = "Test-Notebook-Auto-$(Get-Date -Format 'HHmmss')"
    $body = @{
        url = $script:testNotebookUrlForAdd
        name = $testName
        description = "Automatic test notebook"
        topics = @("test", "validation", "auto")
    } | ConvertTo-Json

    try {
        $addResult = Invoke-RestMethod -Uri "$BaseUrl/notebooks" -Method Post -Body $body -ContentType "application/json"

        if ($addResult.success) {
            $addedNotebookId = $addResult.data.notebook.id
            Write-Success "Notebook added successfully"
            Write-Host "  Generated ID: $addedNotebookId" -ForegroundColor Cyan
            Write-Host "  Name: $($addResult.data.notebook.name)" -ForegroundColor Cyan
            Write-Host "  URL: $($addResult.data.notebook.url)" -ForegroundColor Gray

            # Save the ID for deletion test
            $script:notebookToDelete = $addedNotebookId

            $PassedTests++
        } else {
            Write-Error-Custom "Failed to add: $($addResult.error)"
            $FailedTests++
        }
    } catch {
        Write-Error-Custom "Error during add: $_"
        if ($_.ErrorDetails) {
            $errorDetail = $_.ErrorDetails.Message | ConvertFrom-Json
            Write-Host "  Detail: $($errorDetail.error)" -ForegroundColor Red
        }
        $FailedTests++
    }

    # Sub-test 2: Attempt to add a duplicate (same name)
    Write-Host "`nSub-test 3.2: Block duplicate name" -ForegroundColor Yellow

    $duplicateBody = @{
        url = $script:testNotebookUrlForAdd
        name = $testName  # Same name!
        description = "Duplicate attempt"
        topics = @("test")
    } | ConvertTo-Json

    try {
        $duplicateResult = Invoke-RestMethod -Uri "$BaseUrl/notebooks" -Method Post -Body $duplicateBody -ContentType "application/json"

        if ($duplicateResult.success -eq $false -and $duplicateResult.error -like "*already exists*") {
            Write-Success "Duplicate correctly blocked: $($duplicateResult.error.Substring(0, [Math]::Min(80, $duplicateResult.error.Length)))..."
        } else {
            Write-Error-Custom "Should block duplicate"
            $FailedTests++
        }
    } catch {
        # HTTP exception also OK
        $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
        if ($errorResponse.error -like "*already exists*") {
            Write-Success "Duplicate blocked (HTTP exception): $($errorResponse.error.Substring(0, [Math]::Min(80, $errorResponse.error.Length)))..."
        } else {
            Write-Error-Custom "Unexpected error: $($errorResponse.error)"
            $FailedTests++
        }
    }

    # Sub-test 3: Attempt to add with invalid URL
    Write-Host "`nSub-test 3.3: Block invalid URL" -ForegroundColor Yellow

    $invalidBody = @{
        url = "https://invalid-url.com/not-a-notebook"
        name = "Test-Invalid-URL"
        description = "Test invalid URL"
        topics = @("test")
    } | ConvertTo-Json

    try {
        $invalidResult = Invoke-RestMethod -Uri "$BaseUrl/notebooks" -Method Post -Body $invalidBody -ContentType "application/json"

        if ($invalidResult.success -eq $false -and $invalidResult.error -like "*Invalid*URL*") {
            Write-Success "Invalid URL blocked: $($invalidResult.error.Substring(0, [Math]::Min(80, $invalidResult.error.Length)))..."
        } else {
            Write-Error-Custom "Should block invalid URL"
            $FailedTests++
        }
    } catch {
        # HTTP exception also OK
        $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
        if ($errorResponse.error -like "*Invalid*URL*") {
            Write-Success "Invalid URL blocked (HTTP exception): $($errorResponse.error.Substring(0, [Math]::Min(80, $errorResponse.error.Length)))..."
        } else {
            Write-Error-Custom "Unexpected error: $($errorResponse.error)"
            $FailedTests++
        }
    }

} else {
    Write-Info "Test skipped: No URL provided to test POST /notebooks"
    Write-Info "Rerun with a valid NotebookLM URL to enable this test"
}

# =============================================================================
# TEST 4: GET /notebooks/:id - Notebook details
# =============================================================================
Write-TestHeader "GET /notebooks/:id - Notebook details" 4 $TotalTests

if ($testNotebookId) {
    try {
        $notebook = Invoke-RestMethod -Uri "$BaseUrl/notebooks/$testNotebookId"

        if ($notebook.success) {
            Write-Success "Retrieved notebook details: $testNotebookId"
            Write-Host "`nDetails:" -ForegroundColor White
            $notebook.data.notebook | Format-List id, name, description, url, topics, use_count, last_used
            $PassedTests++
        } else {
            Write-Error-Custom "Server returned success: false"
            $FailedTests++
        }
    } catch {
        Write-Error-Custom "Error: $_"
        $FailedTests++
    }

    # Error test: nonexistent notebook
    Write-Host "`nError test: nonexistent notebook" -ForegroundColor Yellow
    try {
        $errorResult = Invoke-RestMethod -Uri "$BaseUrl/notebooks/nonexistent-notebook-xyz"
        # If no HTTP exception, check success: false
        if ($errorResult.success -eq $false) {
            Write-Success "Expected error received: $($errorResult.error)"
        } else {
            Write-Error-Custom "Should return success: false"
            $FailedTests++
        }
    } catch {
        # HTTP exception (404, 500, etc.) - also OK
        $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Success "HTTP exception received: $($errorResponse.error)"
    }
} else {
    Write-Info "No notebook available to test GET /notebooks/:id"
    Write-Info "Add a notebook with POST /notebooks to enable this test"
}

# =============================================================================
# TEST 5: PUT /notebooks/:id/activate - Activate a notebook
# =============================================================================
Write-TestHeader "PUT /notebooks/:id/activate - Activate a notebook" 5 $TotalTests

if ($testNotebookId) {
    try {
        $activate = Invoke-RestMethod -Uri "$BaseUrl/notebooks/$testNotebookId/activate" -Method Put

        if ($activate.success) {
            Write-Success "Notebook activated: $testNotebookId"
            Write-Host "`nDetails:" -ForegroundColor White
            $activate.data.notebook | Format-List id, name, last_used

            # Verify it's actually active
            $verify = Invoke-RestMethod -Uri "$BaseUrl/notebooks"
            $actualActiveId = $verify.data.active_notebook_id
            if ($actualActiveId -eq $testNotebookId) {
                Write-Success "Verification: notebook is active (active_notebook_id = $actualActiveId)"
            } else {
                Write-Error-Custom "Verification failed:"
                Write-Host "  Expected: $testNotebookId" -ForegroundColor Red
                Write-Host "  Received: $actualActiveId" -ForegroundColor Red
                $FailedTests++
            }

            $PassedTests++
        } else {
            Write-Error-Custom "Server returned success: false"
            $FailedTests++
        }
    } catch {
        Write-Error-Custom "Error: $_"
        $FailedTests++
    }
} else {
    Write-Info "No notebook available to test PUT /notebooks/:id/activate"
}

# =============================================================================
# TEST 6: POST /ask - Question without notebook_id (uses active)
# =============================================================================
Write-TestHeader "POST /ask - Question without notebook_id (uses active)" 6 $TotalTests

if ($testNotebookId) {
    Write-Info "This test may take 30-60 seconds (first question)..."
    Write-Info "Notebook used: $testNotebookId"

    try {
        $body = @{
            question = "Automatic test: just reply 'OK'"
        } | ConvertTo-Json

        $ask = Invoke-RestMethod -Uri "$BaseUrl/ask" -Method Post -Body $body -ContentType "application/json"

        if ($ask.success) {
            Write-Success "Question asked successfully"
            Write-Host "`nDetails:" -ForegroundColor White
            Write-Host "  Question: $($ask.data.question)" -ForegroundColor Cyan
            Write-Host "  Notebook used: $($ask.data.notebook_url)" -ForegroundColor Yellow
            Write-Host "  Session ID: $($ask.data.session_id)" -ForegroundColor Magenta
            Write-Host "  Answer: $($ask.data.answer.Substring(0, [Math]::Min(100, $ask.data.answer.Length)))..." -ForegroundColor White

            # Save session_id for test 7
            $script:testSessionId = $ask.data.session_id

            $PassedTests++
        } else {
            Write-Error-Custom "Server returned success: false"
            $FailedTests++
        }
    } catch {
        Write-Error-Custom "Error: $_"
        if ($_.ErrorDetails) {
            $errorDetail = $_.ErrorDetails.Message | ConvertFrom-Json
            Write-Host "Detail: $($errorDetail.error)" -ForegroundColor Red
        }
        $FailedTests++
    }
} else {
    Write-Info "No notebook available to test POST /ask"
}

# =============================================================================
# TEST 7: GET /sessions - List active sessions
# =============================================================================
Write-TestHeader "GET /sessions - List active sessions" 7 $TotalTests

try {
    $sessions = Invoke-RestMethod -Uri "$BaseUrl/sessions"

    if ($sessions.success) {
        $count = $sessions.data.count
        Write-Success "Active sessions: $count / $($sessions.data.max_sessions)"

        if ($count -gt 0) {
            Write-Host "`nSession details:" -ForegroundColor White
            $sessions.data.sessions | Format-Table `
                @{Label="Session ID"; Expression={$_.id}; Width=12}, `
                @{Label="Messages"; Expression={$_.message_count}; Width=9}, `
                @{Label="Age (s)"; Expression={$_.age_seconds}; Width=9}, `
                @{Label="Inactive (s)"; Expression={$_.inactive_seconds}; Width=12}, `
                @{Label="Notebook"; Expression={$_.notebook_url.Substring(43, [Math]::Min(25, $_.notebook_url.Length - 43)) + "..."}; Width=30}

            # Save a session for test 8
            $script:testSessionIdForClose = $sessions.data.sessions[0].id
        } else {
            Write-Info "No active sessions"
        }

        $PassedTests++
    } else {
        Write-Error-Custom "Server returned success: false"
        $FailedTests++
    }
} catch {
    Write-Error-Custom "Error: $_"
    $FailedTests++
}

# =============================================================================
# TEST 8: POST /ask - Question with session_id (context)
# =============================================================================
Write-TestHeader "POST /ask - Question with session_id (continue conversation)" 8 $TotalTests

if ($script:testSessionId) {
    Write-Info "This test may take 30-60 seconds (follow-up question)..."
    Write-Info "Reusing session: $($script:testSessionId)"

    try {
        $body = @{
            question = "Follow-up question: just reply 'FOLLOW-UP OK'"
            session_id = $script:testSessionId
        } | ConvertTo-Json

        $ask = Invoke-RestMethod -Uri "$BaseUrl/ask" -Method Post -Body $body -ContentType "application/json"

        if ($ask.success) {
            Write-Success "Follow-up question asked successfully"
            Write-Host "`nDetails:" -ForegroundColor White
            Write-Host "  Session reused: $($ask.data.session_id)" -ForegroundColor Magenta
            Write-Host "  Messages in session: $($ask.data.session_info.message_count)" -ForegroundColor Cyan
            Write-Host "  Session age (s): $($ask.data.session_info.age_seconds)" -ForegroundColor Yellow
            Write-Host "  Answer: $($ask.data.answer.Substring(0, [Math]::Min(100, $ask.data.answer.Length)))..." -ForegroundColor White

            if ($ask.data.session_info.message_count -gt 1) {
                Write-Success "Context preserved: $($ask.data.session_info.message_count) messages in session"
            }

            $PassedTests++
        } else {
            Write-Error-Custom "Server returned success: false"
            $FailedTests++
        }
    } catch {
        Write-Error-Custom "Error: $_"
        $FailedTests++
    }
} else {
    Write-Info "No session available to test POST /ask with session_id"
}

# =============================================================================
# TEST 9: DELETE /sessions/:id - Close a session
# =============================================================================
Write-TestHeader "DELETE /sessions/:id - Close a session" 9 $TotalTests

if ($script:testSessionIdForClose) {
    try {
        Write-Info "Closing session: $($script:testSessionIdForClose)"

        $close = Invoke-RestMethod -Uri "$BaseUrl/sessions/$($script:testSessionIdForClose)" -Method Delete

        if ($close.success) {
            Write-Success "Session closed successfully"
            Write-Host "`nDetails:" -ForegroundColor White
            $close.data | Format-List

            # Verify it's gone
            $sessionsAfter = Invoke-RestMethod -Uri "$BaseUrl/sessions"
            Write-Success "Remaining sessions: $($sessionsAfter.data.count)"

            $PassedTests++
        } else {
            Write-Error-Custom "Server returned success: false"
            $FailedTests++
        }
    } catch {
        Write-Error-Custom "Error: $_"
        $FailedTests++
    }
} else {
    Write-Info "No session available to test DELETE /sessions/:id"
}

# =============================================================================
# TEST 10: POST /ask - Question with direct notebook_url
# =============================================================================
Write-TestHeader "POST /ask - Question with direct notebook_url (bypass library)" 10 $TotalTests

if ($testNotebookUrl) {
    Write-Info "This test may take 30-60 seconds (direct URL)..."
    Write-Info "URL used: $testNotebookUrl"

    try {
        $body = @{
            question = "Test with direct URL: reply 'DIRECT OK'"
            notebook_url = $testNotebookUrl
        } | ConvertTo-Json

        $ask = Invoke-RestMethod -Uri "$BaseUrl/ask" -Method Post -Body $body -ContentType "application/json"

        if ($ask.success) {
            Write-Success "Question with direct URL successful"
            Write-Host "`nDetails:" -ForegroundColor White
            Write-Host "  Question: $($ask.data.question)" -ForegroundColor Cyan
            Write-Host "  URL used: $($ask.data.notebook_url)" -ForegroundColor Yellow
            Write-Host "  Session ID: $($ask.data.session_id)" -ForegroundColor Magenta
            Write-Host "  Answer: $($ask.data.answer.Substring(0, [Math]::Min(100, $ask.data.answer.Length)))..." -ForegroundColor White

            $PassedTests++
        } else {
            Write-Error-Custom "Server returned success: false"
            $FailedTests++
        }
    } catch {
        Write-Error-Custom "Error: $_"
        $FailedTests++
    }
} else {
    Write-Info "No notebook available to test POST /ask with notebook_url"
}

# =============================================================================
# TEST 11: DELETE /notebooks/:id - Delete a notebook
# =============================================================================
Write-TestHeader "DELETE /notebooks/:id - Delete a notebook" 11 $TotalTests

# ONLY delete the notebook created in test 3 (never delete existing notebooks)
if ($script:notebookToDelete) {
    try {
        Write-Info "Deleting notebook added in test 3: $($script:notebookToDelete)"

        $delete = Invoke-RestMethod -Uri "$BaseUrl/notebooks/$($script:notebookToDelete)" -Method Delete

        if ($delete.success) {
            Write-Success "Notebook deleted successfully"
            Write-Host "`nDetails:" -ForegroundColor White
            $delete.data | Format-List

            # Verify it's gone
            $notebooksAfter = Invoke-RestMethod -Uri "$BaseUrl/notebooks"
            $countAfter = $notebooksAfter.data.notebooks.Count
            Write-Success "Remaining notebooks: $countAfter"

            if ($notebooksAfter.data.notebooks.id -notcontains $script:notebookToDelete) {
                Write-Success "Verification: notebook was successfully deleted"
            } else {
                Write-Error-Custom "Verification failed: notebook still exists"
            }

            $PassedTests++
        } else {
            Write-Error-Custom "Server returned success: false"
            $FailedTests++
        }
    } catch {
        Write-Error-Custom "Error: $_"
        $FailedTests++
    }
} else {
    Write-Info "Test skipped: No notebook was added in test 3 (no URL provided)"
    Write-Info "To test DELETE, provide a NotebookLM URL when prompted at the beginning"
}

# =============================================================================
# FINAL SUMMARY
# =============================================================================
Write-Host "`n" -NoNewline
Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║                                                        ║" -ForegroundColor Magenta
Write-Host "║                    TEST SUMMARY                        ║" -ForegroundColor Cyan
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
    Write-Host "  ✓ ALL TESTS PASSED SUCCESSFULLY!" -ForegroundColor Green
    Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Green
    exit 0
} else {
    Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Yellow
    Write-Host "  ⚠ SOME TESTS FAILED" -ForegroundColor Yellow
    Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Review the details above to identify issues." -ForegroundColor Yellow
    exit 1
}
