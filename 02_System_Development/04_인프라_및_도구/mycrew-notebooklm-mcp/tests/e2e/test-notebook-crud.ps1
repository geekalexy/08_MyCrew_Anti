# NotebookLM MCP HTTP Server - Notebook CRUD E2E Tests
# Tests POST /notebooks and DELETE /notebooks/:id with state restoration
# Usage: powershell -ExecutionPolicy Bypass -File tests/e2e/test-notebook-crud.ps1
#
# NOTE: POST /notebooks validates that the notebook URL is accessible.
# For E2E testing, we use an existing notebook URL from the library to test
# the endpoint mechanics without requiring a new real NotebookLM notebook.

param(
    [int]$Timeout = 30
)

$ErrorActionPreference = "Continue"
$BaseUrl = "http://localhost:3000"
$Passed = 0
$Failed = 0
$Results = @()

# Test notebook configuration - will be updated with real URL from existing notebook
$TestNotebookConfig = $null

function Write-TestHeader {
    param([string]$Title)
    Write-Host "`n========================================" -ForegroundColor Yellow
    Write-Host "  $Title" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
}

function Write-Step {
    param([string]$Message)
    Write-Host "  -> $Message" -ForegroundColor Gray
}

function Test-Result {
    param(
        [string]$Name,
        [bool]$Success,
        [string]$Details = ""
    )

    if ($Success) {
        Write-Host "  [PASS] $Name" -ForegroundColor Green
        if ($Details) { Write-Host "         $Details" -ForegroundColor DarkGray }
        $script:Passed++
        return @{ Name = $Name; Status = "PASS"; Details = $Details }
    } else {
        Write-Host "  [FAIL] $Name" -ForegroundColor Red
        if ($Details) { Write-Host "         $Details" -ForegroundColor Red }
        $script:Failed++
        return @{ Name = $Name; Status = "FAIL"; Details = $Details }
    }
}

# ============================================================================
# HEADER
# ============================================================================
Write-Host "`n"
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "  NotebookLM MCP - Notebook CRUD E2E Tests" -ForegroundColor Cyan
Write-Host "  Tests POST and DELETE /notebooks with state restoration" -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "`nStarted: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host "Base URL: $BaseUrl"

# ============================================================================
# PRE-FLIGHT: Check server health
# ============================================================================
Write-TestHeader "PRE-FLIGHT CHECKS"

Write-Step "Checking server health..."
try {
    $health = Invoke-RestMethod -Uri "$BaseUrl/health" -Method GET -TimeoutSec 10
    if ($health.success) {
        Write-Host "  [OK] Server is running (authenticated: $($health.data.authenticated))" -ForegroundColor Green
    } else {
        Write-Host "  [ERROR] Server not ready" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "  [ERROR] Server not responding at $BaseUrl" -ForegroundColor Red
    Write-Host "  Make sure to start the server: npm run start:http" -ForegroundColor Yellow
    exit 1
}

# ============================================================================
# PHASE 1: Save Initial State
# ============================================================================
Write-TestHeader "PHASE 1: Save Initial State"

Write-Step "Fetching current notebooks list..."
$InitialNotebooks = $null
$InitialNotebookIds = @()
$InitialCount = 0
$ExistingNotebookUrl = $null

try {
    $notebooksResponse = Invoke-RestMethod -Uri "$BaseUrl/notebooks" -Method GET -TimeoutSec $Timeout

    if ($notebooksResponse.success) {
        $InitialNotebooks = $notebooksResponse.data.notebooks
        $InitialCount = $InitialNotebooks.Count
        $InitialNotebookIds = $InitialNotebooks | ForEach-Object { $_.id }

        Write-Host "  [OK] Saved initial state: $InitialCount notebooks" -ForegroundColor Green

        # Show existing notebooks (first 5)
        if ($InitialCount -gt 0) {
            Write-Host "       Existing notebooks:" -ForegroundColor DarkGray
            $InitialNotebooks | Select-Object -First 5 | ForEach-Object {
                Write-Host "         - $($_.id): $($_.name)" -ForegroundColor DarkGray
            }
            if ($InitialCount -gt 5) {
                Write-Host "         ... and $($InitialCount - 5) more" -ForegroundColor DarkGray
            }

            # Get URL from first existing notebook for testing
            # (POST validates URL is accessible, so we use a known-good URL)
            $ExistingNotebookUrl = $InitialNotebooks[0].url
            Write-Host "       Using existing notebook URL for test: $($ExistingNotebookUrl.Substring(0, 60))..." -ForegroundColor DarkGray
        }
    } else {
        Write-Host "  [ERROR] Failed to fetch notebooks: $($notebooksResponse.error)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "  [ERROR] Failed to fetch notebooks: $_" -ForegroundColor Red
    exit 1
}

# Prepare test notebook config with real URL
if ($ExistingNotebookUrl) {
    $TestNotebookConfig = @{
        url = $ExistingNotebookUrl  # Use existing validated URL
        name = "E2E-Test-Notebook-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        description = "Temporary notebook created by E2E test suite - should be auto-deleted"
        topics = @("e2e-test", "automated", "temporary")
        tags = @("test", "cleanup")
        content_types = @("test-content")
        use_cases = @("testing")
    }
} else {
    Write-Host "  [ERROR] No existing notebooks found - cannot test POST without valid URL" -ForegroundColor Red
    Write-Host "         The POST /notebooks endpoint validates that the URL is accessible." -ForegroundColor Yellow
    Write-Host "         Please add at least one notebook manually first." -ForegroundColor Yellow
    exit 1
}

# ============================================================================
# PHASE 2: Test POST /notebooks (Create)
# ============================================================================
Write-TestHeader "PHASE 2: Test POST /notebooks"

$CreatedNotebookId = $null

Write-Step "Creating test notebook..."
Write-Host "       Name: $($TestNotebookConfig.name)" -ForegroundColor DarkGray
Write-Host "       URL: $($TestNotebookConfig.url)" -ForegroundColor DarkGray

try {
    $createResponse = Invoke-RestMethod -Uri "$BaseUrl/notebooks" -Method POST `
        -ContentType "application/json" `
        -Body ($TestNotebookConfig | ConvertTo-Json -Depth 10) `
        -TimeoutSec $Timeout

    if ($createResponse.success) {
        $CreatedNotebookId = $createResponse.data.notebook.id
        $Results += Test-Result -Name "POST /notebooks - Create notebook" -Success $true `
            -Details "Created notebook with ID: $CreatedNotebookId"

        # Verify the response contains expected fields
        $notebook = $createResponse.data.notebook
        $hasRequiredFields = $notebook.id -and $notebook.name -and $notebook.url -and $notebook.description

        $Results += Test-Result -Name "POST /notebooks - Response structure" -Success $hasRequiredFields `
            -Details "Has id, name, url, description: $hasRequiredFields"

        # Verify name matches
        $nameMatches = $notebook.name -eq $TestNotebookConfig.name
        $Results += Test-Result -Name "POST /notebooks - Name preserved" -Success $nameMatches `
            -Details "Expected: $($TestNotebookConfig.name), Got: $($notebook.name)"

    } else {
        $Results += Test-Result -Name "POST /notebooks - Create notebook" -Success $false `
            -Details "Error: $($createResponse.error)"
    }
} catch {
    $Results += Test-Result -Name "POST /notebooks - Create notebook" -Success $false `
        -Details "Exception: $_"
}

# ============================================================================
# PHASE 3: Verify notebook was created
# ============================================================================
Write-TestHeader "PHASE 3: Verify Creation"

if ($CreatedNotebookId) {
    Write-Step "Fetching notebook by ID: $CreatedNotebookId"

    try {
        $getResponse = Invoke-RestMethod -Uri "$BaseUrl/notebooks/$CreatedNotebookId" -Method GET -TimeoutSec $Timeout

        if ($getResponse.success) {
            $exists = $getResponse.data.notebook -ne $null
            $Results += Test-Result -Name "GET /notebooks/:id - Fetch created notebook" -Success $exists `
                -Details "Notebook found: $exists"
        } else {
            $Results += Test-Result -Name "GET /notebooks/:id - Fetch created notebook" -Success $false `
                -Details "Error: $($getResponse.error)"
        }
    } catch {
        $Results += Test-Result -Name "GET /notebooks/:id - Fetch created notebook" -Success $false `
            -Details "Exception: $_"
    }

    # Verify count increased
    Write-Step "Verifying notebook count increased..."
    try {
        $afterCreateResponse = Invoke-RestMethod -Uri "$BaseUrl/notebooks" -Method GET -TimeoutSec $Timeout
        $afterCreateCount = $afterCreateResponse.data.notebooks.Count
        $countIncreased = $afterCreateCount -eq ($InitialCount + 1)

        $Results += Test-Result -Name "Notebook count after creation" -Success $countIncreased `
            -Details "Before: $InitialCount, After: $afterCreateCount (expected: $($InitialCount + 1))"
    } catch {
        $Results += Test-Result -Name "Notebook count after creation" -Success $false `
            -Details "Exception: $_"
    }
} else {
    Write-Host "  [SKIP] Cannot verify creation - notebook was not created" -ForegroundColor Yellow
}

# ============================================================================
# PHASE 4: Test DELETE /notebooks/:id
# ============================================================================
Write-TestHeader "PHASE 4: Test DELETE /notebooks/:id"

if ($CreatedNotebookId) {
    Write-Step "Deleting test notebook: $CreatedNotebookId"

    try {
        $deleteResponse = Invoke-RestMethod -Uri "$BaseUrl/notebooks/$CreatedNotebookId" -Method DELETE -TimeoutSec $Timeout

        if ($deleteResponse.success) {
            $Results += Test-Result -Name "DELETE /notebooks/:id - Delete notebook" -Success $true `
                -Details "Successfully deleted notebook: $CreatedNotebookId"
        } else {
            $Results += Test-Result -Name "DELETE /notebooks/:id - Delete notebook" -Success $false `
                -Details "Error: $($deleteResponse.error)"
        }
    } catch {
        $Results += Test-Result -Name "DELETE /notebooks/:id - Delete notebook" -Success $false `
            -Details "Exception: $_"
    }

    # Verify notebook no longer exists
    Write-Step "Verifying notebook was deleted..."
    try {
        $verifyResponse = Invoke-RestMethod -Uri "$BaseUrl/notebooks/$CreatedNotebookId" -Method GET -TimeoutSec $Timeout

        # If we get here without error, check if notebook exists
        $stillExists = $verifyResponse.success -and $verifyResponse.data.notebook -ne $null
        $Results += Test-Result -Name "Verify notebook deleted" -Success (-not $stillExists) `
            -Details "Notebook still exists: $stillExists"
    } catch {
        # 404 or error means notebook was successfully deleted
        $Results += Test-Result -Name "Verify notebook deleted" -Success $true `
            -Details "Notebook correctly not found after deletion"
    }
} else {
    Write-Host "  [SKIP] Cannot test deletion - no notebook was created" -ForegroundColor Yellow
}

# ============================================================================
# PHASE 5: Test DELETE with non-existent ID
# ============================================================================
Write-TestHeader "PHASE 5: Edge Cases"

Write-Step "Testing DELETE with non-existent notebook ID..."
$fakeId = "non-existent-notebook-$(Get-Random)"

try {
    $deleteNonExistent = Invoke-RestMethod -Uri "$BaseUrl/notebooks/$fakeId" -Method DELETE -TimeoutSec $Timeout

    # Should fail gracefully or return success: false
    $handledGracefully = -not $deleteNonExistent.success
    $Results += Test-Result -Name "DELETE /notebooks/:id - Non-existent ID" -Success $handledGracefully `
        -Details "Handled gracefully: $handledGracefully"
} catch {
    # HTTP error is also acceptable behavior
    $statusCode = 0
    if ($_.Exception.Response) {
        $statusCode = [int]$_.Exception.Response.StatusCode
    }
    $Results += Test-Result -Name "DELETE /notebooks/:id - Non-existent ID" -Success ($statusCode -eq 404 -or $statusCode -eq 400) `
        -Details "HTTP Status: $statusCode"
}

# Test POST with missing required fields
Write-Step "Testing POST with missing required fields..."
try {
    $invalidNotebook = @{
        name = "Test"
        # Missing: url, description, topics
    }
    $invalidResponse = Invoke-RestMethod -Uri "$BaseUrl/notebooks" -Method POST `
        -ContentType "application/json" `
        -Body ($invalidNotebook | ConvertTo-Json) `
        -TimeoutSec $Timeout

    $rejectedInvalid = -not $invalidResponse.success
    $Results += Test-Result -Name "POST /notebooks - Missing fields rejected" -Success $rejectedInvalid `
        -Details "Invalid request rejected: $rejectedInvalid"
} catch {
    $statusCode = 0
    if ($_.Exception.Response) {
        $statusCode = [int]$_.Exception.Response.StatusCode
    }
    # 400 Bad Request is the expected response
    $Results += Test-Result -Name "POST /notebooks - Missing fields rejected" -Success ($statusCode -eq 400) `
        -Details "HTTP Status: $statusCode (expected 400)"
}

# ============================================================================
# PHASE 6: Verify State Restoration
# ============================================================================
Write-TestHeader "PHASE 6: Verify State Restoration"

Write-Step "Fetching final notebooks list..."
try {
    $finalResponse = Invoke-RestMethod -Uri "$BaseUrl/notebooks" -Method GET -TimeoutSec $Timeout

    if ($finalResponse.success) {
        $FinalNotebooks = $finalResponse.data.notebooks
        $FinalCount = $FinalNotebooks.Count
        $FinalNotebookIds = $FinalNotebooks | ForEach-Object { $_.id }

        # Compare counts
        $countRestored = $FinalCount -eq $InitialCount
        $Results += Test-Result -Name "State restoration - Notebook count" -Success $countRestored `
            -Details "Initial: $InitialCount, Final: $FinalCount"

        # Compare IDs (should be the same set)
        $idsMatch = $true
        foreach ($id in $InitialNotebookIds) {
            if ($id -notin $FinalNotebookIds) {
                $idsMatch = $false
                break
            }
        }
        foreach ($id in $FinalNotebookIds) {
            if ($id -notin $InitialNotebookIds) {
                $idsMatch = $false
                break
            }
        }

        $Results += Test-Result -Name "State restoration - Notebook IDs match" -Success $idsMatch `
            -Details "All original notebooks preserved: $idsMatch"

        # Verify test notebook is not in final list
        $testNotebookGone = $CreatedNotebookId -notin $FinalNotebookIds
        $Results += Test-Result -Name "State restoration - Test notebook cleaned up" -Success $testNotebookGone `
            -Details "Test notebook removed: $testNotebookGone"

    } else {
        $Results += Test-Result -Name "State restoration" -Success $false `
            -Details "Error: $($finalResponse.error)"
    }
} catch {
    $Results += Test-Result -Name "State restoration" -Success $false `
        -Details "Exception: $_"
}

# ============================================================================
# RESULTS SUMMARY
# ============================================================================
Write-Host "`n"
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "                   TEST RESULTS SUMMARY" -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan

$Total = $Passed + $Failed
$SuccessRate = if ($Total -gt 0) { [math]::Round(($Passed / $Total) * 100, 1) } else { 0 }

Write-Host "`n  Passed:  $Passed" -ForegroundColor Green
Write-Host "  Failed:  $Failed" -ForegroundColor $(if ($Failed -gt 0) { "Red" } else { "Gray" })
Write-Host "  Total:   $Total"
Write-Host "`n  Success Rate: $SuccessRate%" -ForegroundColor $(if ($SuccessRate -eq 100) { "Green" } elseif ($SuccessRate -ge 80) { "Yellow" } else { "Red" })

if ($Failed -gt 0) {
    Write-Host "`n  Failed Tests:" -ForegroundColor Red
    $Results | Where-Object { $_.Status -eq "FAIL" } | ForEach-Object {
        Write-Host "    - $($_.Name)" -ForegroundColor Red
        Write-Host "      $($_.Details)" -ForegroundColor DarkRed
    }
}

Write-Host "`nCompleted: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

# ============================================================================
# CLEANUP (Safety net - in case deletion failed)
# ============================================================================
if ($CreatedNotebookId -and ($CreatedNotebookId -in $FinalNotebookIds)) {
    Write-Host "`n[CLEANUP] Test notebook still exists, attempting cleanup..." -ForegroundColor Yellow
    try {
        Invoke-RestMethod -Uri "$BaseUrl/notebooks/$CreatedNotebookId" -Method DELETE -TimeoutSec $Timeout | Out-Null
        Write-Host "[CLEANUP] Successfully removed test notebook" -ForegroundColor Green
    } catch {
        Write-Host "[CLEANUP] Failed to remove test notebook: $_" -ForegroundColor Red
    }
}

# Exit code
if ($Failed -eq 0) {
    Write-Host "`n[SUCCESS] All notebook CRUD tests passed!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n[FAILURE] Some tests failed" -ForegroundColor Red
    exit 1
}
