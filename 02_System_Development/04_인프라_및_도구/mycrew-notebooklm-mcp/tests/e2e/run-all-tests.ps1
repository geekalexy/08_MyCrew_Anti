# NotebookLM MCP HTTP Server - Complete E2E Test Suite
# Master runner that executes ALL test suites
# Usage: powershell -ExecutionPolicy Bypass -File tests/e2e/run-all-tests.ps1

param(
    [switch]$SkipBrowserTests,
    [switch]$SkipAudioTests,
    [switch]$SkipDestructiveTests,
    [int]$Timeout = 180
)

$ErrorActionPreference = "Continue"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$TotalPassed = 0
$TotalFailed = 0
$TotalSkipped = 0
$SuiteResults = @()

# Header
Write-Host "`n"
Write-Host "+---------------------------------------------------------+" -ForegroundColor Cyan
Write-Host "|   NotebookLM MCP HTTP Server - Complete E2E Test Suite  |" -ForegroundColor Cyan
Write-Host "|                      Version 1.4.2                      |" -ForegroundColor Cyan
Write-Host "+---------------------------------------------------------+" -ForegroundColor Cyan
Write-Host "`nStarted: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host "Test Directory: $ScriptDir"

# Check server health first
Write-Host "`nPre-flight check..." -NoNewline
try {
    $health = Invoke-RestMethod -Uri "http://localhost:3000/health" -TimeoutSec 10
    if ($health.success) {
        Write-Host " OK" -ForegroundColor Green
        Write-Host "  Server version: $($health.data.version)"
        Write-Host "  Authenticated: $($health.data.authenticated)"
    } else {
        Write-Host " FAILED" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host " ERROR - Server not responding" -ForegroundColor Red
    Write-Host "  Make sure the server is running: npm run start:http"
    exit 1
}

# Function to run a test suite
function Invoke-TestSuite {
    param(
        [string]$Name,
        [string]$Script,
        [string]$Description,
        [hashtable]$ExtraParams = @{}
    )

    Write-Host "`n"
    Write-Host "============================================================" -ForegroundColor Yellow
    Write-Host "  SUITE: $Name" -ForegroundColor Yellow
    Write-Host "  $Description" -ForegroundColor Gray
    Write-Host "============================================================" -ForegroundColor Yellow

    $scriptPath = Join-Path $ScriptDir $Script

    if (-not (Test-Path $scriptPath)) {
        Write-Host "  [SKIP] Script not found: $Script" -ForegroundColor Yellow
        return @{ Name = $Name; Status = "SKIPPED"; Reason = "Script not found" }
    }

    try {
        $params = @{}
        if ($SkipBrowserTests) { $params["SkipBrowserTests"] = $true }
        $params += $ExtraParams

        $startTime = Get-Date
        & $scriptPath @params
        $exitCode = $LASTEXITCODE
        $duration = (Get-Date) - $startTime

        if ($exitCode -eq 0) {
            Write-Host "`n  Suite Result: PASSED" -ForegroundColor Green
            Write-Host "  Duration: $($duration.TotalSeconds.ToString('F1'))s"
            return @{ Name = $Name; Status = "PASSED"; Duration = $duration.TotalSeconds }
        } else {
            Write-Host "`n  Suite Result: FAILED (exit code: $exitCode)" -ForegroundColor Red
            return @{ Name = $Name; Status = "FAILED"; ExitCode = $exitCode }
        }
    } catch {
        Write-Host "`n  Suite Result: ERROR - $_" -ForegroundColor Red
        return @{ Name = $Name; Status = "ERROR"; Error = $_.ToString() }
    }
}

# =============================================================================
# RUN ALL TEST SUITES
# =============================================================================

# Suite 1: Basic Endpoints
$SuiteResults += Invoke-TestSuite `
    -Name "Basic Endpoints" `
    -Script "run-e2e-tests.ps1" `
    -Description "Health, notebooks, sessions, ask, content (22 tests)"

# Suite 2: Notebook CRUD (with state restoration)
if (-not $SkipDestructiveTests) {
    $SuiteResults += Invoke-TestSuite `
        -Name "Notebook CRUD" `
        -Script "test-notebook-crud.ps1" `
        -Description "POST/DELETE notebooks with state restoration (12 tests)"
} else {
    Write-Host "`n  [SKIP] Notebook CRUD - Destructive tests skipped" -ForegroundColor Yellow
    $SuiteResults += @{ Name = "Notebook CRUD"; Status = "SKIPPED"; Reason = "Destructive tests disabled" }
}

# Suite 3: Authentication Endpoints
$SuiteResults += Invoke-TestSuite `
    -Name "Authentication Endpoints" `
    -Script "test-auth-endpoints.ps1" `
    -Description "setup-auth, de-auth, re-auth (non-destructive)"

# Suite 4: Advanced Content (YouTube + Audio)
if (-not $SkipAudioTests) {
    $audioParams = @{}
    if ($SkipBrowserTests) { $audioParams["SkipAudio"] = $true }

    $SuiteResults += Invoke-TestSuite `
        -Name "Advanced Content" `
        -Script "test-content-advanced.ps1" `
        -Description "YouTube sources, Audio generation (3 tests)" `
        -ExtraParams $audioParams
} else {
    Write-Host "`n  [SKIP] Advanced Content - Audio tests skipped" -ForegroundColor Yellow
    $SuiteResults += @{ Name = "Advanced Content"; Status = "SKIPPED"; Reason = "Audio tests disabled" }
}

# =============================================================================
# FINAL SUMMARY
# =============================================================================
Write-Host "`n"
Write-Host "+---------------------------------------------------------+" -ForegroundColor Cyan
Write-Host "|                  FINAL TEST SUMMARY                     |" -ForegroundColor Cyan
Write-Host "+---------------------------------------------------------+" -ForegroundColor Cyan

$passedSuites = ($SuiteResults | Where-Object { $_.Status -eq "PASSED" }).Count
$failedSuites = ($SuiteResults | Where-Object { $_.Status -eq "FAILED" -or $_.Status -eq "ERROR" }).Count
$skippedSuites = ($SuiteResults | Where-Object { $_.Status -eq "SKIPPED" }).Count

Write-Host "`nTest Suites:"
foreach ($suite in $SuiteResults) {
    $color = switch ($suite.Status) {
        "PASSED" { "Green" }
        "FAILED" { "Red" }
        "ERROR" { "Red" }
        "SKIPPED" { "Yellow" }
        default { "White" }
    }
    $duration = if ($suite.Duration) { " ($($suite.Duration.ToString('F1'))s)" } else { "" }
    Write-Host "  [$($suite.Status)] $($suite.Name)$duration" -ForegroundColor $color
}

Write-Host "`nSummary:"
Write-Host "  Passed:  $passedSuites" -ForegroundColor Green
Write-Host "  Failed:  $failedSuites" -ForegroundColor $(if ($failedSuites -gt 0) { "Red" } else { "Gray" })
Write-Host "  Skipped: $skippedSuites" -ForegroundColor $(if ($skippedSuites -gt 0) { "Yellow" } else { "Gray" })
Write-Host "  Total:   $($SuiteResults.Count)"

Write-Host "`nCompleted: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

# Exit with appropriate code
if ($failedSuites -eq 0) {
    Write-Host "`n[SUCCESS] All test suites passed!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n[FAILURE] Some test suites failed" -ForegroundColor Red
    exit 1
}
