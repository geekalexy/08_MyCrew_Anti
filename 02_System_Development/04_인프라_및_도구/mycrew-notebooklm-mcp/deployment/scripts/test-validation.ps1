#!/usr/bin/env pwsh
#Requires -Version 5.1

<#
.SYNOPSIS
    Zod schema validation testing script for NotebookLM MCP HTTP Server API

.DESCRIPTION
    Tests all Zod validation schemas to ensure proper input validation:
    - AskQuestionSchema
    - AddNotebookSchema
    - UpdateNotebookSchema
    - AutoDiscoverSchema
    - CleanupDataSchema
    - ShowBrowserSchema

.PARAMETER BaseUrl
    Base URL of the server (default: http://localhost:3000)

.EXAMPLE
    .\test-validation.ps1
    Runs all validation tests

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
    Write-Host "✗ Unexpected: $Message" -ForegroundColor Red
}

# Helper function to test validation
function Test-ValidationError {
    param(
        [string]$Endpoint,
        [string]$Method,
        [hashtable]$Body,
        [string]$ExpectedPattern,
        [string]$Description
    )

    try {
        $jsonBody = $Body | ConvertTo-Json -Depth 5
        $result = Invoke-RestMethod -Uri "$BaseUrl$Endpoint" -Method $Method -Body $jsonBody -ContentType "application/json" -TimeoutSec 10

        # If no HTTP exception, check for success: false
        if ($result.success -eq $false -and $result.error -like $ExpectedPattern) {
            Write-ErrorExpected "$($result.error.Substring(0, [Math]::Min(80, $result.error.Length)))..."
            return $true
        }
        Write-ErrorUnexpected "Should have returned validation error for: $Description"
        return $false
    } catch {
        $statusCode = $_.Exception.Response.StatusCode
        if ($statusCode -eq 400 -or $statusCode -eq 'BadRequest') {
            $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
            if ($errorResponse.error -like $ExpectedPattern) {
                Write-ErrorExpected "$($errorResponse.error.Substring(0, [Math]::Min(80, $errorResponse.error.Length)))..."
                return $true
            }
            Write-ErrorUnexpected "Error message doesn't match pattern: $($errorResponse.error)"
            return $false
        }
        Write-ErrorUnexpected "Unexpected HTTP status: $statusCode"
        return $false
    }
}

# Banner
Clear-Host
Write-Host "`n" -NoNewline
Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║                                                        ║" -ForegroundColor Magenta
Write-Host "║         ZOD VALIDATION TESTS - HTTP API                ║" -ForegroundColor Cyan
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

$TotalTests = 18
$PassedTests = 0
$FailedTests = 0

# =============================================================================
# ASK QUESTION SCHEMA TESTS
# =============================================================================

Write-TestHeader "POST /ask - Empty question string" 1 $TotalTests
if (Test-ValidationError -Endpoint "/ask" -Method "Post" -Body @{ question = "" } -ExpectedPattern "*question*empty*" -Description "empty question") {
    $PassedTests++
} else { $FailedTests++ }

Write-TestHeader "POST /ask - Question wrong type (number)" 2 $TotalTests
if (Test-ValidationError -Endpoint "/ask" -Method "Post" -Body @{ question = 123 } -ExpectedPattern "*question*" -Description "question as number") {
    $PassedTests++
} else { $FailedTests++ }

Write-TestHeader "POST /ask - Invalid notebook_url format" 3 $TotalTests
if (Test-ValidationError -Endpoint "/ask" -Method "Post" -Body @{ question = "test"; notebook_url = "not-a-url" } -ExpectedPattern "*url*" -Description "invalid URL") {
    $PassedTests++
} else { $FailedTests++ }

Write-TestHeader "POST /ask - show_browser wrong type (string)" 4 $TotalTests
if (Test-ValidationError -Endpoint "/ask" -Method "Post" -Body @{ question = "test"; show_browser = "yes" } -ExpectedPattern "*show_browser*" -Description "show_browser as string") {
    $PassedTests++
} else { $FailedTests++ }

# =============================================================================
# ADD NOTEBOOK SCHEMA TESTS
# =============================================================================

Write-TestHeader "POST /notebooks - Empty name" 5 $TotalTests
if (Test-ValidationError -Endpoint "/notebooks" -Method "Post" -Body @{
    url = "https://notebooklm.google.com/notebook/test"
    name = ""
    description = "Test"
    topics = @("test")
} -ExpectedPattern "*name*empty*" -Description "empty name") {
    $PassedTests++
} else { $FailedTests++ }

Write-TestHeader "POST /notebooks - Empty description" 6 $TotalTests
if (Test-ValidationError -Endpoint "/notebooks" -Method "Post" -Body @{
    url = "https://notebooklm.google.com/notebook/test"
    name = "Test"
    description = ""
    topics = @("test")
} -ExpectedPattern "*description*empty*" -Description "empty description") {
    $PassedTests++
} else { $FailedTests++ }

Write-TestHeader "POST /notebooks - Empty topics array" 7 $TotalTests
if (Test-ValidationError -Endpoint "/notebooks" -Method "Post" -Body @{
    url = "https://notebooklm.google.com/notebook/test"
    name = "Test"
    description = "Test description"
    topics = @()
} -ExpectedPattern "*topic*" -Description "empty topics array") {
    $PassedTests++
} else { $FailedTests++ }

Write-TestHeader "POST /notebooks - URL not NotebookLM domain" 8 $TotalTests
if (Test-ValidationError -Endpoint "/notebooks" -Method "Post" -Body @{
    url = "https://google.com/notebook/test"
    name = "Test"
    description = "Test description"
    topics = @("test")
} -ExpectedPattern "*NotebookLM*" -Description "wrong domain") {
    $PassedTests++
} else { $FailedTests++ }

Write-TestHeader "POST /notebooks - Invalid URL format" 9 $TotalTests
if (Test-ValidationError -Endpoint "/notebooks" -Method "Post" -Body @{
    url = "not-a-valid-url"
    name = "Test"
    description = "Test description"
    topics = @("test")
} -ExpectedPattern "*url*" -Description "invalid URL format") {
    $PassedTests++
} else { $FailedTests++ }

Write-TestHeader "POST /notebooks - topics wrong type (string)" 10 $TotalTests
if (Test-ValidationError -Endpoint "/notebooks" -Method "Post" -Body @{
    url = "https://notebooklm.google.com/notebook/test"
    name = "Test"
    description = "Test description"
    topics = "single-topic"
} -ExpectedPattern "*topics*array*" -Description "topics as string") {
    $PassedTests++
} else { $FailedTests++ }

# =============================================================================
# UPDATE NOTEBOOK SCHEMA TESTS
# =============================================================================

Write-TestHeader "PUT /notebooks/:id - Empty name (when provided)" 11 $TotalTests
if (Test-ValidationError -Endpoint "/notebooks/test-id" -Method "Put" -Body @{ name = "" } -ExpectedPattern "*name*" -Description "empty name update") {
    $PassedTests++
} else { $FailedTests++ }

Write-TestHeader "PUT /notebooks/:id - Empty description (when provided)" 12 $TotalTests
if (Test-ValidationError -Endpoint "/notebooks/test-id" -Method "Put" -Body @{ description = "" } -ExpectedPattern "*description*" -Description "empty description update") {
    $PassedTests++
} else { $FailedTests++ }

# =============================================================================
# AUTO-DISCOVER SCHEMA TESTS
# =============================================================================

Write-TestHeader "POST /notebooks/auto-discover - Missing URL" 13 $TotalTests
if (Test-ValidationError -Endpoint "/notebooks/auto-discover" -Method "Post" -Body @{} -ExpectedPattern "*url*" -Description "missing URL") {
    $PassedTests++
} else { $FailedTests++ }

Write-TestHeader "POST /notebooks/auto-discover - Invalid URL" 14 $TotalTests
if (Test-ValidationError -Endpoint "/notebooks/auto-discover" -Method "Post" -Body @{ url = "not-a-url" } -ExpectedPattern "*url*" -Description "invalid URL") {
    $PassedTests++
} else { $FailedTests++ }

Write-TestHeader "POST /notebooks/auto-discover - Wrong domain" 15 $TotalTests
if (Test-ValidationError -Endpoint "/notebooks/auto-discover" -Method "Post" -Body @{ url = "https://example.com/notebook" } -ExpectedPattern "*NotebookLM*" -Description "wrong domain") {
    $PassedTests++
} else { $FailedTests++ }

# =============================================================================
# CLEANUP DATA SCHEMA TESTS
# =============================================================================

Write-TestHeader "POST /cleanup-data - Missing confirm" 16 $TotalTests
if (Test-ValidationError -Endpoint "/cleanup-data" -Method "Post" -Body @{} -ExpectedPattern "*confirm*" -Description "missing confirm") {
    $PassedTests++
} else { $FailedTests++ }

Write-TestHeader "POST /cleanup-data - confirm wrong type (string)" 17 $TotalTests
if (Test-ValidationError -Endpoint "/cleanup-data" -Method "Post" -Body @{ confirm = "yes" } -ExpectedPattern "*confirm*" -Description "confirm as string") {
    $PassedTests++
} else { $FailedTests++ }

Write-TestHeader "POST /cleanup-data - preserve_library wrong type" 18 $TotalTests
if (Test-ValidationError -Endpoint "/cleanup-data" -Method "Post" -Body @{ confirm = $true; preserve_library = "yes" } -ExpectedPattern "*preserve_library*" -Description "preserve_library as string") {
    $PassedTests++
} else { $FailedTests++ }

# =============================================================================
# FINAL SUMMARY
# =============================================================================
Write-Host "`n" -NoNewline
Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║                                                        ║" -ForegroundColor Magenta
Write-Host "║           VALIDATION TEST SUMMARY                      ║" -ForegroundColor Cyan
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
    Write-Host "  ✓ ALL VALIDATION SCHEMAS WORKING CORRECTLY!" -ForegroundColor Green
    Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Green
    exit 0
} else {
    Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Yellow
    Write-Host "  ⚠ SOME VALIDATION TESTS FAILED" -ForegroundColor Yellow
    Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "See details above to identify the issues." -ForegroundColor Yellow
    exit 1
}
