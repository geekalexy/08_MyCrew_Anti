#!/usr/bin/env pwsh
#Requires -Version 5.1

<#
.SYNOPSIS
    Test the Auto-Discovery endpoint

.DESCRIPTION
    Tests the POST /notebooks/auto-discover endpoint with various scenarios:
    - Valid NotebookLM URL
    - Invalid URL format
    - Missing URL field

.PARAMETER ServerUrl
    Base URL of the NotebookLM MCP HTTP server (default: http://localhost:3000)

.PARAMETER NotebookUrl
    Optional: NotebookLM notebook URL to test with

.PARAMETER TestAll
    Test all public notebooks (default: false)

.EXAMPLE
    .\test-auto-discovery.ps1
    # Tests with prompts for notebook URL

.EXAMPLE
    .\test-auto-discovery.ps1 -NotebookUrl "https://notebooklm.google.com/notebook/abc123"
    # Tests with specific notebook URL

.EXAMPLE
    .\test-auto-discovery.ps1 -TestAll
    # Tests with all 5 public notebooks
#>

param(
    [string]$ServerUrl = "http://localhost:3000",
    [string]$NotebookUrl = "",
    [switch]$TestAll = $false
)

# Public test notebooks
$PublicNotebooks = @(
    "https://notebooklm.google.com/notebook/0d5cd576-2583-4835-8848-a5b7b6a97cea",
    "https://notebooklm.google.com/notebook/505ee4b1-ad05-4673-a06b-1ec106c2b940",
    "https://notebooklm.google.com/notebook/a09e40ad-d41f-43af-a3ca-5fc82bd459e5",
    "https://notebooklm.google.com/notebook/19bde485-a9c1-4809-8884-e872b2b67b44",
    "https://notebooklm.google.com/notebook/19fdf6bd-1975-40a3-9801-c554130bc64a"
)

# Colors
function Write-Success { param([string]$Message) Write-Host "✅ $Message" -ForegroundColor Green }
function Write-Info { param([string]$Message) Write-Host "ℹ️  $Message" -ForegroundColor Cyan }
function Write-Warning-Custom { param([string]$Message) Write-Host "⚠️  $Message" -ForegroundColor Yellow }
function Write-Error-Custom { param([string]$Message) Write-Host "❌ $Message" -ForegroundColor Red }

# Banner
Write-Host "`n╔════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║                                                        ║" -ForegroundColor Magenta
Write-Host "║      AUTO-DISCOVERY ENDPOINT TESTS                     ║" -ForegroundColor Cyan
Write-Host "║                                                        ║" -ForegroundColor Magenta
Write-Host "╚════════════════════════════════════════════════════════╝`n" -ForegroundColor Magenta

Write-Info "Testing server: $ServerUrl"
Write-Host ""

# Check server is running
Write-Info "Checking if server is accessible..."
try {
    $health = Invoke-RestMethod -Uri "$ServerUrl/health" -Method GET -ErrorAction Stop
    Write-Success "Server is running"
} catch {
    Write-Error-Custom "Server is not accessible at $ServerUrl"
    Write-Info "Start the server with: npm run daemon:start"
    exit 1
}

Write-Host ""

# Test counter
$totalTests = 0
$passedTests = 0
$failedTests = 0

# ============================================================================
# Test 1: Missing URL field
# ============================================================================
$totalTests++
Write-Host "─────────────────────────────────────────────────────────" -ForegroundColor Gray
Write-Info "[Test 1/$totalTests] Missing URL field (should return 400)"
Write-Host "─────────────────────────────────────────────────────────" -ForegroundColor Gray

try {
    $body = @{} | ConvertTo-Json
    $response = Invoke-RestMethod -Uri "$ServerUrl/notebooks/auto-discover" -Method POST -Body $body -ContentType "application/json" -ErrorAction Stop
    Write-Error-Custom "Test failed: Should have returned 400 error"
    $failedTests++
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Write-Success "Correctly returned 400 Bad Request"
        $passedTests++
    } else {
        Write-Error-Custom "Wrong error code: $($_.Exception.Response.StatusCode)"
        $failedTests++
    }
}

Write-Host ""

# ============================================================================
# Test 2: Invalid URL format
# ============================================================================
$totalTests++
Write-Host "─────────────────────────────────────────────────────────" -ForegroundColor Gray
Write-Info "[Test 2/$totalTests] Invalid URL format (should return 400)"
Write-Host "─────────────────────────────────────────────────────────" -ForegroundColor Gray

try {
    $body = @{
        url = "https://example.com/not-a-notebooklm-url"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$ServerUrl/notebooks/auto-discover" -Method POST -Body $body -ContentType "application/json" -ErrorAction Stop
    Write-Error-Custom "Test failed: Should have returned 400 error"
    $failedTests++
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Write-Success "Correctly returned 400 Bad Request"
        $passedTests++
    } else {
        Write-Error-Custom "Wrong error code: $($_.Exception.Response.StatusCode)"
        $failedTests++
    }
}

Write-Host ""

# ============================================================================
# Test 3: Valid NotebookLM URL (requires real notebook)
# ============================================================================

# Determine which notebooks to test
$NotebooksToTest = @()

if ($TestAll) {
    Write-Info "Testing ALL public notebooks (5 notebooks)"
    $NotebooksToTest = $PublicNotebooks
} elseif ($NotebookUrl) {
    Write-Info "Testing provided notebook URL"
    $NotebooksToTest = @($NotebookUrl)
} else {
    Write-Host ""
    Write-Info "To test auto-discovery, provide a valid NotebookLM URL."
    Write-Host "Format: https://notebooklm.google.com/notebook/[id]" -ForegroundColor White
    Write-Host ""
    Write-Host "Available public test notebooks:" -ForegroundColor White
    for ($i = 0; $i -lt $PublicNotebooks.Count; $i++) {
        Write-Host "  $($i + 1). $($PublicNotebooks[$i])" -ForegroundColor Gray
    }
    Write-Host ""
    $NotebookUrl = Read-Host "Enter NotebookLM URL (or press Enter to skip)"

    if ($NotebookUrl) {
        $NotebooksToTest = @($NotebookUrl)
    }
}

if ($NotebooksToTest.Count -eq 0) {
    Write-Warning-Custom "Skipping: No NotebookLM URL provided"
    Write-Info "Rerun with -NotebookUrl parameter or -TestAll to test this"
    Write-Host ""
} else {
    # Test each notebook
    foreach ($TestUrl in $NotebooksToTest) {
        $totalTests++
        $testNum = $totalTests

        Write-Host "─────────────────────────────────────────────────────────" -ForegroundColor Gray
        Write-Info "[Test $testNum] Valid NotebookLM URL auto-discovery"
        Write-Host "─────────────────────────────────────────────────────────" -ForegroundColor Gray
        Write-Info "Testing with: $TestUrl"
        Write-Warning-Custom "This may take 20-30 seconds (querying NotebookLM)..."
        Write-Host ""

        try {
            $body = @{
                url = $TestUrl
            } | ConvertTo-Json

            $response = Invoke-RestMethod -Uri "$ServerUrl/notebooks/auto-discover" -Method POST -Body $body -ContentType "application/json" -ErrorAction Stop

            if ($response.success) {
                Write-Success "Auto-discovery successful!"
                Write-Host ""
                Write-Info "Generated Metadata:"
                Write-Host "  Name: $($response.notebook.name)" -ForegroundColor White
                Write-Host "  Description: $($response.notebook.description)" -ForegroundColor White
                Write-Host "  Topics: $($response.notebook.topics -join ', ')" -ForegroundColor White
                Write-Host "  Auto-generated: $($response.notebook.auto_generated)" -ForegroundColor White
                Write-Host ""

                # Validate format
                $validations = @()

                # Check name format (kebab-case, 3 words max)
                if ($response.notebook.name -match '^[a-z0-9]+(-[a-z0-9]+){0,2}$') {
                    $validations += "✅ Name format valid (kebab-case)"
                } else {
                    $validations += "❌ Name format invalid: $($response.notebook.name)"
                }

                # Check description length (<= 150 chars)
                if ($response.notebook.description.Length -le 150) {
                    $validations += "✅ Description length valid ($($response.notebook.description.Length) chars)"
                } else {
                    $validations += "❌ Description too long: $($response.notebook.description.Length) chars"
                }

                # Check topics count (8-10)
                $topicCount = $response.notebook.topics.Count
                if ($topicCount -ge 8 -and $topicCount -le 10) {
                    $validations += "✅ Topics count valid ($topicCount)"
                } else {
                    $validations += "❌ Topics count invalid: $topicCount (must be 8-10)"
                }

                # Check auto_generated flag
                if ($response.notebook.auto_generated -eq $true) {
                    $validations += "✅ Auto-generated flag set"
                } else {
                    $validations += "❌ Auto-generated flag not set"
                }

                Write-Info "Validation Results:"
                foreach ($validation in $validations) {
                    Write-Host "  $validation"
                }

                if ($validations -match "❌") {
                    Write-Error-Custom "Metadata validation failed"
                    $failedTests++
                } else {
                    Write-Success "All metadata validations passed"
                    $passedTests++
                }
            } else {
                Write-Error-Custom "Auto-discovery failed: $($response.error)"
                $failedTests++
            }
        } catch {
            Write-Error-Custom "Request failed: $($_.Exception.Message)"
            if ($_.ErrorDetails.Message) {
                $errorObj = $_.ErrorDetails.Message | ConvertFrom-Json
                Write-Host "  Error: $($errorObj.error)" -ForegroundColor Red
            }
            $failedTests++
        }

        Write-Host ""
    }
}

Write-Host ""

# ============================================================================
# Summary
# ============================================================================
Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Gray
Write-Host "║                                                        ║" -ForegroundColor Gray
Write-Host "║                    TEST SUMMARY                        ║" -ForegroundColor Cyan
Write-Host "║                                                        ║" -ForegroundColor Gray
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Gray
Write-Host ""

Write-Host "Total tests: $totalTests" -ForegroundColor White
Write-Host "Passed: $passedTests" -ForegroundColor Green
Write-Host "Failed: $failedTests" -ForegroundColor $(if ($failedTests -gt 0) { "Red" } else { "Gray" })
Write-Host "Success rate: $([math]::Round(($passedTests / $totalTests) * 100, 1))%" -ForegroundColor White
Write-Host ""

if ($failedTests -gt 0) {
    Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Red
    Write-Host "║                                                        ║" -ForegroundColor Red
    Write-Host "║              ❌ SOME TESTS FAILED                       ║" -ForegroundColor Red
    Write-Host "║                                                        ║" -ForegroundColor Red
    Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Red
    exit 1
} else {
    Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║                                                        ║" -ForegroundColor Green
    Write-Host "║              ✅ ALL TESTS PASSED                        ║" -ForegroundColor Green
    Write-Host "║                                                        ║" -ForegroundColor Green
    Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Green
    exit 0
}
