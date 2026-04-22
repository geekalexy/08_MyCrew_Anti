# NotebookLM MCP HTTP Server - Delete Source Endpoints E2E Tests
# Tests the DELETE /content/sources endpoints
#
# Tests covered:
# 1. DELETE /content/sources/:id returns proper error for non-existent source
# 2. DELETE /content/sources with query param source_name validation
# 3. Both endpoints require either source_id or source_name
#
# Usage: powershell -ExecutionPolicy Bypass -File tests/e2e/test-delete-sources.ps1

param(
    [switch]$Verbose
)

$ErrorActionPreference = "Continue"
$BaseUrl = "http://localhost:3000"
$Passed = 0
$Failed = 0
$Results = @()

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

function Write-TestHeader {
    param([string]$Category)
    Write-Host "`n========================================" -ForegroundColor Yellow
    Write-Host "  $Category" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
}

function Write-Info {
    param([string]$Message)
    if ($Verbose) {
        Write-Host "    [INFO] $Message" -ForegroundColor Gray
    }
}

function Test-DeleteEndpoint {
    param(
        [string]$Name,
        [string]$Endpoint,
        [int]$ExpectedStatusCode,
        [string]$ExpectedErrorContains = "",
        [string]$Description = ""
    )

    Write-Host "  Testing: $Name..." -NoNewline
    if ($Description -and $Verbose) {
        Write-Info $Description
    }

    try {
        $response = Invoke-WebRequest -Uri "$BaseUrl$Endpoint" `
            -Method DELETE `
            -ContentType "application/json" `
            -TimeoutSec 30 `
            -ErrorAction Stop

        # If we expected an error but got success, that's a failure
        if ($ExpectedStatusCode -ne 200) {
            Write-Host " FAIL (expected HTTP $ExpectedStatusCode, got 200)" -ForegroundColor Red
            $script:Failed++
            return @{ Name = $Name; Status = "FAIL"; Error = "Expected HTTP $ExpectedStatusCode, got 200" }
        }

        Write-Host " PASS (HTTP 200)" -ForegroundColor Green
        $script:Passed++
        return @{ Name = $Name; Status = "PASS"; Details = "HTTP 200 as expected" }

    } catch {
        $statusCode = 0
        $errorMsg = ""

        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
            try {
                # Try to extract error body from exception message (PowerShell 5/7 compatible)
                $exMsg = $_.Exception.Message
                if ($exMsg -match '\{.*\}') {
                    $jsonMatch = [regex]::Match($exMsg, '\{.*\}')
                    if ($jsonMatch.Success) {
                        $errorJson = $jsonMatch.Value | ConvertFrom-Json
                        $errorMsg = $errorJson.error
                    }
                }

                # Fallback: try stream reader approach
                if (-not $errorMsg -and $_.Exception.Response.GetResponseStream) {
                    $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
                    $errorBody = $reader.ReadToEnd()
                    $reader.Close()
                    $errorJson = $errorBody | ConvertFrom-Json
                    $errorMsg = $errorJson.error
                }
            } catch {
                $errorMsg = "Could not parse error response"
            }
        }

        # Check if we got the expected status code
        if ($statusCode -eq $ExpectedStatusCode) {
            # If we also need to check error message content
            if ($ExpectedErrorContains -and $errorMsg -notlike "*$ExpectedErrorContains*") {
                Write-Host " FAIL (HTTP $statusCode but error message doesn't contain '$ExpectedErrorContains')" -ForegroundColor Red
                Write-Host "    Actual error: $errorMsg" -ForegroundColor Gray
                $script:Failed++
                return @{ Name = $Name; Status = "FAIL"; Error = "Error message mismatch: $errorMsg" }
            }

            Write-Host " PASS (HTTP $statusCode)" -ForegroundColor Green
            if ($errorMsg -and $Verbose) {
                Write-Host "    Error: $errorMsg" -ForegroundColor Gray
            }
            $script:Passed++
            return @{ Name = $Name; Status = "PASS"; Details = "HTTP $statusCode with correct error" }
        }

        # Unexpected status code
        Write-Host " FAIL (expected HTTP $ExpectedStatusCode, got $statusCode)" -ForegroundColor Red
        if ($errorMsg) {
            Write-Host "    Error: $errorMsg" -ForegroundColor Gray
        }
        $script:Failed++
        return @{ Name = $Name; Status = "FAIL"; Error = "Expected HTTP $ExpectedStatusCode, got $statusCode" }
    }
}

# ============================================================================
# HEADER
# ============================================================================

Write-Host "`n"
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "   NotebookLM MCP - Delete Source Endpoints E2E Tests" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "`nStarted: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host "Base URL: $BaseUrl"

# ============================================================================
# PRE-FLIGHT: CHECK SERVER HEALTH
# ============================================================================

Write-TestHeader "PRE-FLIGHT CHECKS"

Write-Host "  Checking server health..." -NoNewline
try {
    $health = Invoke-RestMethod -Uri "$BaseUrl/health" -TimeoutSec 10
    if ($health.success) {
        Write-Host " OK" -ForegroundColor Green
        Write-Host "    - Server version: $($health.data.version)" -ForegroundColor Gray
        Write-Host "    - Authenticated: $($health.data.authenticated)" -ForegroundColor $(if ($health.data.authenticated) { "Green" } else { "Yellow" })
    } else {
        Write-Host " ERROR (success: false)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host " FAILED" -ForegroundColor Red
    Write-Host "`n[ERROR] Server not responding at $BaseUrl" -ForegroundColor Red
    Write-Host "Make sure the server is running: npm run start:http" -ForegroundColor Yellow
    exit 1
}

# Check if DELETE endpoints are deployed by making a test request
# We use Invoke-RestMethod with specific error handling to detect HTML vs JSON responses
Write-Host "  Checking DELETE /content/sources endpoint exists..." -NoNewline
$endpointDeployed = $false

try {
    # Use Invoke-RestMethod which will throw on non-2xx responses
    # We expect either 400 (missing params) or a JSON error
    $testResponse = Invoke-RestMethod -Uri "$BaseUrl/content/sources" -Method DELETE -TimeoutSec 10 -ErrorAction Stop
    # If we get here with success, endpoint exists
    $endpointDeployed = $true
} catch {
    $statusCode = 0
    $errorMessage = $_.Exception.Message

    if ($_.Exception.Response) {
        $statusCode = [int]$_.Exception.Response.StatusCode
    }

    # Check error message for HTML indicators (Express default 404)
    if ($errorMessage -match "Cannot DELETE|<!DOCTYPE|<html" -or $statusCode -eq 404) {
        # This is likely Express's default "Cannot DELETE" response, meaning route doesn't exist
        Write-Host " NOT DEPLOYED" -ForegroundColor Red
        Write-Host "`n[ERROR] DELETE /content/sources endpoint is not deployed on the server." -ForegroundColor Red
        Write-Host "The server needs to be restarted with the latest code." -ForegroundColor Yellow
        Write-Host "Run: npm run build && npm run start:http" -ForegroundColor Yellow
        exit 1
    }

    # HTTP 400 with JSON error = endpoint exists and is properly rejecting invalid requests
    if ($statusCode -eq 400) {
        $endpointDeployed = $true
    }

    # HTTP 500 = endpoint exists but has an internal error
    if ($statusCode -eq 500) {
        $endpointDeployed = $true
    }
}

if ($endpointDeployed) {
    Write-Host " OK" -ForegroundColor Green
} else {
    Write-Host " NOT DEPLOYED" -ForegroundColor Red
    Write-Host "`n[ERROR] DELETE /content/sources endpoint is not deployed on the server." -ForegroundColor Red
    Write-Host "The server needs to be restarted with the latest code." -ForegroundColor Yellow
    Write-Host "Run: npm run build && npm run start:http" -ForegroundColor Yellow
    exit 1
}

# ============================================================================
# TEST 1: DELETE /content/sources/:id - Non-existent source
# ============================================================================

Write-TestHeader "DELETE /content/sources/:id - Non-existent Source"

# Test with a clearly fake source ID
$Results += Test-DeleteEndpoint `
    -Name "DELETE non-existent source by ID" `
    -Endpoint "/content/sources/fake-source-id-12345" `
    -ExpectedStatusCode 404 `
    -Description "Should return 404 for non-existent source ID"

# Test with another invalid ID format
$Results += Test-DeleteEndpoint `
    -Name "DELETE with UUID-like non-existent ID" `
    -Endpoint "/content/sources/00000000-0000-0000-0000-000000000000" `
    -ExpectedStatusCode 404 `
    -Description "Should return 404 for UUID-style non-existent source"

# ============================================================================
# TEST 2: DELETE /content/sources with query param - source_name validation
# ============================================================================

Write-TestHeader "DELETE /content/sources - Query Parameter Validation"

# Test with source_name that doesn't exist
$Results += Test-DeleteEndpoint `
    -Name "DELETE non-existent source by name" `
    -Endpoint "/content/sources?source_name=NonExistentSourceName12345" `
    -ExpectedStatusCode 404 `
    -Description "Should return 404 for non-existent source name"

# Test with source_id query param that doesn't exist
$Results += Test-DeleteEndpoint `
    -Name "DELETE non-existent source by source_id query param" `
    -Endpoint "/content/sources?source_id=fake-id-67890" `
    -ExpectedStatusCode 404 `
    -Description "Should return 404 for non-existent source_id in query"

# Test with both source_name and source_id (source_id takes precedence)
$Results += Test-DeleteEndpoint `
    -Name "DELETE with both source_name and source_id" `
    -Endpoint "/content/sources?source_id=fake-id-both&source_name=FakeSourceName" `
    -ExpectedStatusCode 404 `
    -Description "Should accept request with both params (source_id takes precedence)"

# ============================================================================
# TEST 3: Both endpoints require source_id or source_name
# ============================================================================

Write-TestHeader "Required Parameters Validation"

# Test DELETE /content/sources without any identifier
$Results += Test-DeleteEndpoint `
    -Name "DELETE /content/sources without params" `
    -Endpoint "/content/sources" `
    -ExpectedStatusCode 400 `
    -Description "Should return 400 when neither source_name nor source_id provided"

# Test with empty source_name
$Results += Test-DeleteEndpoint `
    -Name "DELETE with empty source_name" `
    -Endpoint "/content/sources?source_name=" `
    -ExpectedStatusCode 400 `
    -Description "Should return 400 for empty source_name"

# Test with only notebook_url (missing identifier)
$Results += Test-DeleteEndpoint `
    -Name "DELETE with only notebook_url (missing identifier)" `
    -Endpoint "/content/sources?notebook_url=https://notebooklm.google.com/notebook/test" `
    -ExpectedStatusCode 400 `
    -Description "Should return 400 when only notebook_url provided without source identifier"

# ============================================================================
# RESULTS SUMMARY
# ============================================================================

Write-Host "`n"
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "              DELETE SOURCE ENDPOINTS TEST RESULTS" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

$Total = $Passed + $Failed
$SuccessRate = if ($Total -gt 0) { [math]::Round(($Passed / $Total) * 100, 1) } else { 100 }

Write-Host "`n  Passed:  $Passed" -ForegroundColor Green
Write-Host "  Failed:  $Failed" -ForegroundColor $(if ($Failed -gt 0) { "Red" } else { "Gray" })
Write-Host "  Total:   $Total"
Write-Host "`n  Success Rate: $SuccessRate%" -ForegroundColor $(if ($SuccessRate -eq 100) { "Green" } elseif ($SuccessRate -ge 80) { "Yellow" } else { "Red" })

# Show test details
Write-Host "`n  Test Details:" -ForegroundColor Cyan
foreach ($result in $Results) {
    $statusColor = switch ($result.Status) {
        "PASS" { "Green" }
        "FAIL" { "Red" }
        "ERROR" { "Red" }
        default { "Gray" }
    }
    $statusIcon = switch ($result.Status) {
        "PASS" { "[OK]" }
        "FAIL" { "[X]" }
        "ERROR" { "[!]" }
        default { "[?]" }
    }
    Write-Host "    $statusIcon $($result.Name)" -ForegroundColor $statusColor
    if ($result.Error) {
        Write-Host "        Error: $($result.Error)" -ForegroundColor Red
    }
    if ($result.Details -and $Verbose) {
        Write-Host "        $($result.Details)" -ForegroundColor Gray
    }
}

if ($Failed -gt 0) {
    Write-Host "`n  [!] Failed Tests:" -ForegroundColor Red
    $Results | Where-Object { $_.Status -eq "FAIL" -or $_.Status -eq "ERROR" } | ForEach-Object {
        Write-Host "      - $($_.Name): $($_.Error)" -ForegroundColor Red
    }
}

Write-Host "`nCompleted: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

# Exit with appropriate code
if ($Failed -eq 0) {
    Write-Host "`n[SUCCESS] All delete source endpoint tests passed!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n[FAILURE] Some tests failed" -ForegroundColor Red
    exit 1
}
