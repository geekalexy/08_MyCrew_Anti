#!/usr/bin/env pwsh
#Requires -Version 5.1

<#
.SYNOPSIS
    Quick test script - NotebookLM MCP HTTP Server

.DESCRIPTION
    Basic validation tests to verify that the server is working

.PARAMETER BaseUrl
    Server base URL (default: http://localhost:3000)

.EXAMPLE
    .\test-server.ps1
    Run tests on http://localhost:3000

.EXAMPLE
    .\test-server.ps1 -BaseUrl "http://localhost:8080"
    Run tests on a different port

.NOTES
    Version: 1.3.0
    Prerequisites: The server must be started
#>

param(
    [string]$BaseUrl = "http://localhost:3000"
)

Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  NotebookLM MCP - Quick Validation Tests                ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "Server being tested: $BaseUrl" -ForegroundColor Gray
Write-Host ""

$allPassed = $true

# Test 1: Health Check
Write-Host "Test 1: Health Check" -ForegroundColor Yellow
Write-Host "  GET $BaseUrl/health" -ForegroundColor Gray

try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/health" -Method Get -TimeoutSec 5
    if ($response.success -eq $true) {
        Write-Host "  ✅ PASS - Server operational" -ForegroundColor Green
        Write-Host "     Authenticated: $($response.data.authenticated)" -ForegroundColor Gray
        Write-Host "     Sessions: $($response.data.sessions)" -ForegroundColor Gray
        Write-Host "     Notebooks: $($response.data.library_notebooks)" -ForegroundColor Gray
    } else {
        Write-Host "  ❌ FAIL - success=false" -ForegroundColor Red
        $allPassed = $false
    }
} catch {
    Write-Host "  ❌ FAIL - $($_.Exception.Message)" -ForegroundColor Red
    $allPassed = $false
}

Write-Host ""

# Test 2: List Notebooks
Write-Host "Test 2: List Notebooks" -ForegroundColor Yellow
Write-Host "  GET $BaseUrl/notebooks" -ForegroundColor Gray

try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/notebooks" -Method Get -TimeoutSec 5
    if ($response.success -eq $true) {
        Write-Host "  ✅ PASS - Endpoint working" -ForegroundColor Green
        $count = $response.data.notebooks.Count
        Write-Host "     Notebooks found: $count" -ForegroundColor Gray
    } else {
        Write-Host "  ❌ FAIL - success=false" -ForegroundColor Red
        $allPassed = $false
    }
} catch {
    Write-Host "  ❌ FAIL - $($_.Exception.Message)" -ForegroundColor Red
    $allPassed = $false
}

Write-Host ""

# Test 3: Ask Question (optional - requires authentication and notebook)
Write-Host "Test 3: Ask Question (authentication + notebook required)" -ForegroundColor Yellow
Write-Host "  POST $BaseUrl/ask" -ForegroundColor Gray

# Get notebooks to use the first available one
try {
    $notebooks = Invoke-RestMethod -Uri "$BaseUrl/notebooks" -Method Get -TimeoutSec 5
    $firstNotebookId = if ($notebooks.data.notebooks.Count -gt 0) { $notebooks.data.notebooks[0].id } else { $null }
} catch {
    $firstNotebookId = $null
}

if ($firstNotebookId) {
    $body = @{
        question = "Connection test: just answer OK"
        notebook_id = $firstNotebookId
    } | ConvertTo-Json

    Write-Host "  Using notebook: $firstNotebookId" -ForegroundColor Gray

    try {
        $response = Invoke-RestMethod -Uri "$BaseUrl/ask" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 60
    if ($response.success -eq $true) {
        Write-Host "  ✅ PASS - Question processed" -ForegroundColor Green
        Write-Host "     Answer length: $($response.data.answer.Length) chars" -ForegroundColor Gray
        Write-Host "     Session ID: $($response.data.session_id)" -ForegroundColor Gray
    } else {
        Write-Host "  ⚠️  WARN - $($response.error)" -ForegroundColor Yellow
        Write-Host "     (Normal if not authenticated)" -ForegroundColor Gray
    }
    } catch {
        Write-Host "  ⚠️  WARN - $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host "     (Normal if authentication not configured)" -ForegroundColor Gray
    }
} else {
    Write-Host "  ⚠️  SKIP - No notebook configured" -ForegroundColor Yellow
    Write-Host "     To test: add a notebook with POST /notebooks" -ForegroundColor Gray
}

Write-Host ""
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Gray
Write-Host ""

if ($allPassed) {
    Write-Host "✅ ALL TESTS PASSED!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📖 Next steps:" -ForegroundColor Cyan
    Write-Host "   - Check the API documentation: .\deployment\docs\03-API.md" -ForegroundColor White
    Write-Host "   - Integrate with n8n: .\deployment\docs\04-N8N-INTEGRATION.md" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "❌ SOME TESTS FAILED" -ForegroundColor Red
    Write-Host ""
    Write-Host "📖 Check the troubleshooting guide:" -ForegroundColor Yellow
    Write-Host "   .\deployment\docs\05-TROUBLESHOOTING.md" -ForegroundColor White
    Write-Host ""
    exit 1
}
