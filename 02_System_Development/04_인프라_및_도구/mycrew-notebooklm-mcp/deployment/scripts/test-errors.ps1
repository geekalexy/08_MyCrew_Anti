#!/usr/bin/env pwsh
#Requires -Version 5.1

<#
.SYNOPSIS
    Error case testing script for NotebookLM MCP HTTP Server API

.DESCRIPTION
    Tests all error cases to verify that the API returns the correct errors

.PARAMETER BaseUrl
    Base URL of the server (default: http://localhost:3000)

.EXAMPLE
    .\test-errors.ps1
    Runs all error tests

.EXAMPLE
    .\test-errors.ps1 -BaseUrl "http://localhost:8080"
    Runs tests on a server at a different port

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
    Write-Host "✗ Unexpected error: $Message" -ForegroundColor Red
}

# Banner
Clear-Host
Write-Host "`n" -NoNewline
Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║                                                        ║" -ForegroundColor Magenta
Write-Host "║         ERROR CASE TESTS - HTTP API                    ║" -ForegroundColor Cyan
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

# Get existing notebooks for tests
$notebooks = Invoke-RestMethod -Uri "$BaseUrl/notebooks"
$existingNotebook = if ($notebooks.data.notebooks.Count -gt 0) { $notebooks.data.notebooks[0] } else { $null }

$TotalTests = 12
$PassedTests = 0
$FailedTests = 0

# =============================================================================
# TEST 1: POST /ask - Missing question
# =============================================================================
Write-TestHeader "POST /ask - Error: missing question" 1 $TotalTests

try {
    $body = @{} | ConvertTo-Json
    $null = Invoke-RestMethod -Uri "$BaseUrl/ask" -Method Post -Body $body -ContentType "application/json"
    Write-ErrorUnexpected "Should return a 400 error"
    $FailedTests++
} catch {
    if ($_.Exception.Response.StatusCode -eq 400 -or $_.Exception.Response.StatusCode -eq 'BadRequest') {
        $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-ErrorExpected "$($errorResponse.error)"
        if ($errorResponse.error -like "*question*") {
            Write-Success "Correct error message (mentions 'question')"
            $PassedTests++
        } else {
            Write-ErrorUnexpected "Error message doesn't mention the missing field"
            $FailedTests++
        }
    } else {
        Write-ErrorUnexpected "Incorrect HTTP code: $($_.Exception.Response.StatusCode)"
        $FailedTests++
    }
}

# =============================================================================
# TEST 2: POST /ask - Non-existent notebook (invalid notebook_id)
# =============================================================================
Write-TestHeader "POST /ask - Error: non-existent notebook_id" 2 $TotalTests

try {
    $body = @{
        question = "Test question"
        notebook_id = "notebook-that-does-not-exist-xyz-123"
    } | ConvertTo-Json

    $result = Invoke-RestMethod -Uri "$BaseUrl/ask" -Method Post -Body $body -ContentType "application/json"

    # If no HTTP exception, check success: false
    if ($result.success -eq $false) {
        Write-ErrorExpected "$($result.error.Substring(0, [Math]::Min(80, $result.error.Length)))..."

        if ($result.error -like "*not found*" -or $result.error -like "*introuvable*") {
            Write-Success "Correct error message (notebook not found)"
            $PassedTests++
        } else {
            Write-ErrorUnexpected "Unexpected error message"
            $FailedTests++
        }
    } else {
        Write-ErrorUnexpected "Should return success: false"
        $FailedTests++
    }
} catch {
    # HTTP exception (500, etc.)
    $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
    Write-ErrorExpected "$($errorResponse.error.Substring(0, [Math]::Min(80, $errorResponse.error.Length)))..."

    if ($errorResponse.error -like "*not found*" -or $errorResponse.error -like "*introuvable*") {
        Write-Success "Correct error message (notebook not found)"
        $PassedTests++
    } else {
        Write-ErrorUnexpected "Unexpected error message"
        $FailedTests++
    }
}

# =============================================================================
# TEST 3: POST /ask - No notebook configured and no notebook_url
# =============================================================================
Write-TestHeader "POST /ask - Error: no notebook (if library empty)" 3 $TotalTests

if ($notebooks.data.notebooks.Count -eq 0) {
    try {
        $body = @{
            question = "Test question without notebook"
        } | ConvertTo-Json

        $null = Invoke-RestMethod -Uri "$BaseUrl/ask" -Method Post -Body $body -ContentType "application/json"
        Write-ErrorUnexpected "Should return an error"
        $FailedTests++
    } catch {
        $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-ErrorExpected "$($errorResponse.error.Substring(0, [Math]::Min(80, $errorResponse.error.Length)))..."

        if ($errorResponse.error -like "*No notebooks*" -or $errorResponse.error -like "*Aucun notebook*") {
            Write-Success "Correct error message (no notebooks)"
            $PassedTests++
        } else {
            Write-ErrorUnexpected "Unexpected error message"
            $FailedTests++
        }
    }
} else {
    Write-Info "Test skipped: notebooks are configured (cannot test 'no notebook')"
    Write-Info "To test this case: temporarily delete all your notebooks"
}

# =============================================================================
# TEST 4: POST /notebooks - Missing URL
# =============================================================================
Write-TestHeader "POST /notebooks - Error: missing URL" 4 $TotalTests

try {
    $body = @{
        name = "Test Notebook"
        description = "Test"
        topics = @("test")
    } | ConvertTo-Json

    $null = Invoke-RestMethod -Uri "$BaseUrl/notebooks" -Method Post -Body $body -ContentType "application/json"
    Write-ErrorUnexpected "Should return a 400 error"
    $FailedTests++
} catch {
    if ($_.Exception.Response.StatusCode -eq 400 -or $_.Exception.Response.StatusCode -eq 'BadRequest') {
        $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-ErrorExpected "$($errorResponse.error)"
        if ($errorResponse.error -like "*url*") {
            Write-Success "Correct error message (mentions 'url')"
            $PassedTests++
        } else {
            Write-ErrorUnexpected "Error message doesn't mention the missing field"
            $FailedTests++
        }
    } else {
        Write-ErrorUnexpected "Incorrect HTTP code"
        $FailedTests++
    }
}

# =============================================================================
# TEST 5: POST /notebooks - Missing name
# =============================================================================
Write-TestHeader "POST /notebooks - Error: missing name" 5 $TotalTests

try {
    $body = @{
        url = "https://notebooklm.google.com/notebook/test-123"
        description = "Test"
        topics = @("test")
    } | ConvertTo-Json

    $null = Invoke-RestMethod -Uri "$BaseUrl/notebooks" -Method Post -Body $body -ContentType "application/json"
    Write-ErrorUnexpected "Should return a 400 error"
    $FailedTests++
} catch {
    if ($_.Exception.Response.StatusCode -eq 400 -or $_.Exception.Response.StatusCode -eq 'BadRequest') {
        $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-ErrorExpected "$($errorResponse.error)"
        if ($errorResponse.error -like "*name*") {
            Write-Success "Correct error message (mentions 'name')"
            $PassedTests++
        } else {
            Write-ErrorUnexpected "Error message doesn't mention the missing field"
            $FailedTests++
        }
    } else {
        Write-ErrorUnexpected "Incorrect HTTP code"
        $FailedTests++
    }
}

# =============================================================================
# TEST 6: POST /notebooks - Invalid URL (incorrect format)
# =============================================================================
Write-TestHeader "POST /notebooks - Error: invalid URL format" 6 $TotalTests

try {
    $body = @{
        url = "https://example.com/not-a-notebook"
        name = "Test Invalid URL"
        description = "Test"
        topics = @("test")
    } | ConvertTo-Json

    $result = Invoke-RestMethod -Uri "$BaseUrl/notebooks" -Method Post -Body $body -ContentType "application/json"

    # If no HTTP exception, check success: false
    if ($result.success -eq $false) {
        Write-ErrorExpected "$($result.error.Substring(0, [Math]::Min(80, $result.error.Length)))..."

        # Accept various error messages for invalid URL: "Invalid URL", "format", "NotebookLM URL", "notebooklm.google.com"
        if ($result.error -like "*Invalid*URL*" -or $result.error -like "*format*" -or $result.error -like "*NotebookLM*URL*" -or $result.error -like "*notebooklm.google.com*") {
            Write-Success "Correct error message (invalid URL)"
            $PassedTests++
        } else {
            Write-ErrorUnexpected "Unexpected error message"
            $FailedTests++
        }
    } else {
        Write-ErrorUnexpected "Should return success: false"
        $FailedTests++
    }
} catch {
    # HTTP exception (500, etc.)
    $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
    Write-ErrorExpected "$($errorResponse.error.Substring(0, [Math]::Min(80, $errorResponse.error.Length)))..."

    # Accept various error messages for invalid URL: "Invalid URL", "format", "NotebookLM URL", "notebooklm.google.com"
    if ($errorResponse.error -like "*Invalid*URL*" -or $errorResponse.error -like "*format*" -or $errorResponse.error -like "*NotebookLM*URL*" -or $errorResponse.error -like "*notebooklm.google.com*") {
        Write-Success "Correct error message (invalid URL)"
        $PassedTests++
    } else {
        Write-ErrorUnexpected "Unexpected error message"
        $FailedTests++
    }
}

# =============================================================================
# TEST 7: POST /notebooks - Duplicate name
# =============================================================================
Write-TestHeader "POST /notebooks - Error: name already in use" 7 $TotalTests

if ($existingNotebook) {
    Write-Info "Testing with existing notebook: $($existingNotebook.name)"

    try {
        $body = @{
            url = "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000000"
            name = $existingNotebook.name  # Use the same name
            description = "Test duplicate"
            topics = @("test")
        } | ConvertTo-Json

        $result = Invoke-RestMethod -Uri "$BaseUrl/notebooks" -Method Post -Body $body -ContentType "application/json"

        # If no HTTP exception, check success: false
        if ($result.success -eq $false) {
            Write-ErrorExpected "$($result.error.Substring(0, [Math]::Min(80, $result.error.Length)))..."

            if ($result.error -like "*already exists*" -or $result.error -like "*déjà*") {
                Write-Success "Correct error message (name already in use)"
                $PassedTests++
            } else {
                Write-ErrorUnexpected "Unexpected error message"
                $FailedTests++
            }
        } else {
            Write-ErrorUnexpected "Should return success: false"
            $FailedTests++
        }
    } catch {
        # HTTP exception (500, etc.)
        $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-ErrorExpected "$($errorResponse.error.Substring(0, [Math]::Min(80, $errorResponse.error.Length)))..."

        if ($errorResponse.error -like "*already exists*" -or $errorResponse.error -like "*déjà*") {
            Write-Success "Correct error message (name already in use)"
            $PassedTests++
        } else {
            Write-ErrorUnexpected "Unexpected error message"
            $FailedTests++
        }
    }
} else {
    Write-Info "Test skipped: no existing notebook (cannot test duplicate)"
    Write-Info "To test this case: add at least one notebook"
}

# =============================================================================
# TEST 8: POST /notebooks - Inaccessible notebook (invalid ID)
# =============================================================================
Write-TestHeader "POST /notebooks - Error: inaccessible notebook" 8 $TotalTests

Write-Info "This test may take 15-30 seconds (live validation)..."

try {
    $body = @{
        url = "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-invalid-id-xyz"
        name = "Test Inaccessible Notebook XYZ"
        description = "Test of a notebook that doesn't exist"
        topics = @("test")
    } | ConvertTo-Json

    $result = Invoke-RestMethod -Uri "$BaseUrl/notebooks" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 60

    # If no HTTP exception, check success: false
    if ($result.success -eq $false) {
        Write-ErrorExpected "$($result.error.Substring(0, [Math]::Min(100, $result.error.Length)))..."

        if ($result.error -like "*Invalid*" -or $result.error -like "*inaccessible*" -or $result.error -like "*not found*") {
            Write-Success "Correct error message (inaccessible notebook)"
            $PassedTests++
        } else {
            Write-ErrorUnexpected "Unexpected error message"
            $FailedTests++
        }
    } else {
        Write-ErrorUnexpected "Should return success: false"
        $FailedTests++
    }
} catch {
    # HTTP exception (500, etc.)
    $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
    Write-ErrorExpected "$($errorResponse.error.Substring(0, [Math]::Min(100, $errorResponse.error.Length)))..."

    if ($errorResponse.error -like "*Invalid*" -or $errorResponse.error -like "*inaccessible*" -or $errorResponse.error -like "*not found*") {
        Write-Success "Correct error message (inaccessible notebook)"
        $PassedTests++
    } else {
        Write-ErrorUnexpected "Unexpected error message"
        $FailedTests++
    }
}

# =============================================================================
# TEST 9: GET /notebooks/:id - Non-existent notebook
# =============================================================================
Write-TestHeader "GET /notebooks/:id - Error: non-existent notebook" 9 $TotalTests

try {
    $result = Invoke-RestMethod -Uri "$BaseUrl/notebooks/notebook-nonexistent-xyz-999"

    # If no HTTP exception, check success: false
    if ($result.success -eq $false) {
        Write-ErrorExpected "$($result.error)"

        if ($result.error -like "*not found*" -or $result.error -like "*introuvable*") {
            Write-Success "Correct error message (notebook not found)"
            $PassedTests++
        } else {
            Write-ErrorUnexpected "Unexpected error message"
            $FailedTests++
        }
    } else {
        Write-ErrorUnexpected "Should return success: false"
        $FailedTests++
    }
} catch {
    # HTTP exception (500, etc.)
    $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
    Write-ErrorExpected "$($errorResponse.error)"

    if ($errorResponse.error -like "*not found*" -or $errorResponse.error -like "*introuvable*") {
        Write-Success "Correct error message (notebook not found)"
        $PassedTests++
    } else {
        Write-ErrorUnexpected "Unexpected error message"
        $FailedTests++
    }
}

# =============================================================================
# TEST 10: DELETE /notebooks/:id - Non-existent notebook
# =============================================================================
Write-TestHeader "DELETE /notebooks/:id - Error: non-existent notebook" 10 $TotalTests

try {
    $result = Invoke-RestMethod -Uri "$BaseUrl/notebooks/notebook-nonexistent-xyz-999" -Method Delete

    # If no HTTP exception, check success: false
    if ($result.success -eq $false) {
        Write-ErrorExpected "$($result.error)"

        if ($result.error -like "*not found*" -or $result.error -like "*introuvable*") {
            Write-Success "Correct error message (notebook not found)"
            $PassedTests++
        } else {
            Write-ErrorUnexpected "Unexpected error message"
            $FailedTests++
        }
    } else {
        Write-ErrorUnexpected "Should return success: false"
        $FailedTests++
    }
} catch {
    # HTTP exception (500, etc.)
    $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
    Write-ErrorExpected "$($errorResponse.error)"

    if ($errorResponse.error -like "*not found*" -or $errorResponse.error -like "*introuvable*") {
        Write-Success "Correct error message (notebook not found)"
        $PassedTests++
    } else {
        Write-ErrorUnexpected "Unexpected error message"
        $FailedTests++
    }
}

# =============================================================================
# TEST 11: PUT /notebooks/:id/activate - Non-existent notebook
# =============================================================================
Write-TestHeader "PUT /notebooks/:id/activate - Error: non-existent notebook" 11 $TotalTests

try {
    $result = Invoke-RestMethod -Uri "$BaseUrl/notebooks/notebook-nonexistent-xyz-999/activate" -Method Put

    # If no HTTP exception, check success: false
    if ($result.success -eq $false) {
        Write-ErrorExpected "$($result.error)"

        if ($result.error -like "*not found*" -or $result.error -like "*introuvable*") {
            Write-Success "Correct error message (notebook not found)"
            $PassedTests++
        } else {
            Write-ErrorUnexpected "Unexpected error message"
            $FailedTests++
        }
    } else {
        Write-ErrorUnexpected "Should return success: false"
        $FailedTests++
    }
} catch {
    # HTTP exception (500, etc.)
    $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
    Write-ErrorExpected "$($errorResponse.error)"

    if ($errorResponse.error -like "*not found*" -or $errorResponse.error -like "*introuvable*") {
        Write-Success "Correct error message (notebook not found)"
        $PassedTests++
    } else {
        Write-ErrorUnexpected "Unexpected error message"
        $FailedTests++
    }
}

# =============================================================================
# TEST 12: DELETE /sessions/:id - Non-existent session
# =============================================================================
Write-TestHeader "DELETE /sessions/:id - Error: non-existent session" 12 $TotalTests

try {
    $result = Invoke-RestMethod -Uri "$BaseUrl/sessions/session-nonexistent-xyz-999" -Method Delete

    # If no HTTP exception, check success: false
    if ($result.success -eq $false) {
        Write-ErrorExpected "$($result.error)"

        if ($result.error -like "*not found*" -or $result.error -like "*introuvable*") {
            Write-Success "Correct error message (session not found)"
            $PassedTests++
        } else {
            Write-ErrorUnexpected "Unexpected error message"
            $FailedTests++
        }
    } else {
        Write-ErrorUnexpected "Should return success: false"
        $FailedTests++
    }
} catch {
    # HTTP exception (500, etc.)
    $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
    Write-ErrorExpected "$($errorResponse.error)"

    if ($errorResponse.error -like "*not found*" -or $errorResponse.error -like "*introuvable*") {
        Write-Success "Correct error message (session not found)"
        $PassedTests++
    } else {
        Write-ErrorUnexpected "Unexpected error message"
        $FailedTests++
    }
}

# =============================================================================
# FINAL SUMMARY
# =============================================================================
Write-Host "`n" -NoNewline
Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║                                                        ║" -ForegroundColor Magenta
Write-Host "║              ERROR TEST SUMMARY                        ║" -ForegroundColor Cyan
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
Write-Host "Tests skipped: " -NoNewline -ForegroundColor White
Write-Host "$($TotalTests - $TotalExecuted)" -ForegroundColor Yellow
Write-Host "Success rate: " -NoNewline -ForegroundColor White
Write-Host "$SuccessRate%" -ForegroundColor $(if($SuccessRate -eq 100){"Green"}elseif($SuccessRate -ge 80){"Yellow"}else{"Red"})

Write-Host ""

if ($FailedTests -eq 0) {
    Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host "  ✓ ALL ERROR CASES ARE HANDLED CORRECTLY!" -ForegroundColor Green
    Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Green
    exit 0
} else {
    Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Yellow
    Write-Host "  ⚠ SOME ERROR CASES ARE NOT HANDLED" -ForegroundColor Yellow
    Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "See details above to identify the issues." -ForegroundColor Yellow
    exit 1
}
