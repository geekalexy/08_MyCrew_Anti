# NotebookLM MCP HTTP Server - Authentication Endpoints E2E Tests
# Tests authentication-related endpoints in a NON-DESTRUCTIVE way
#
# IMPORTANT: These tests verify endpoint EXISTENCE, not full execution!
# - We check that endpoints respond (not 404)
# - We do NOT actually de-authenticate or disrupt existing sessions
#
# Usage: powershell -ExecutionPolicy Bypass -File tests/e2e/test-auth-endpoints.ps1

param(
    [switch]$Verbose
)

$ErrorActionPreference = "Continue"
$BaseUrl = "http://localhost:3000"
$Passed = 0
$Failed = 0
$Skipped = 0
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

function Test-EndpointExists {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Endpoint,
        [hashtable]$Body = $null,
        [int]$TimeoutSec = 30,
        [int[]]$AcceptableCodes = @(200, 400, 500),  # Not 404!
        [string]$Description = ""
    )

    Write-Host "  Testing: $Name..." -NoNewline
    if ($Description) {
        Write-Info $Description
    }

    try {
        $params = @{
            Uri = "$BaseUrl$Endpoint"
            Method = $Method
            ContentType = "application/json"
            TimeoutSec = $TimeoutSec
        }

        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json -Depth 10)
        }

        $response = Invoke-RestMethod @params

        # Got a response - endpoint exists!
        if ($response.success -eq $true) {
            Write-Host " PASS (success: true)" -ForegroundColor Green
            $script:Passed++
            return @{ Name = $Name; Status = "PASS"; Details = "Endpoint responded successfully" }
        } else {
            # success: false but endpoint exists
            Write-Host " PASS (endpoint exists, success: false)" -ForegroundColor Green
            $script:Passed++
            return @{ Name = $Name; Status = "PASS"; Details = "Endpoint exists (returned error response)" }
        }
    } catch {
        $statusCode = 0
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }

        # Check if status code is acceptable (endpoint exists)
        if ($AcceptableCodes -contains $statusCode) {
            Write-Host " PASS (endpoint exists, HTTP $statusCode)" -ForegroundColor Green
            $script:Passed++
            return @{ Name = $Name; Status = "PASS"; Details = "HTTP $statusCode (acceptable)" }
        }

        # 404 = endpoint doesn't exist = FAIL
        if ($statusCode -eq 404) {
            Write-Host " FAIL (404 - endpoint not found)" -ForegroundColor Red
            $script:Failed++
            return @{ Name = $Name; Status = "FAIL"; Error = "Endpoint not found (404)" }
        }

        # Other errors
        Write-Host " ERROR ($($_.Exception.Message))" -ForegroundColor Red
        $script:Failed++
        return @{ Name = $Name; Status = "ERROR"; Error = $_.Exception.Message }
    }
}

# ============================================================================
# HEADER
# ============================================================================

Write-Host "`n"
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "   NotebookLM MCP - Authentication Endpoints E2E Tests" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "`nStarted: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host "Base URL: $BaseUrl"
Write-Host "`n[!] NON-DESTRUCTIVE MODE: Testing endpoint existence only" -ForegroundColor Yellow

# ============================================================================
# PRE-FLIGHT: CHECK SERVER HEALTH AND AUTH STATUS
# ============================================================================

Write-TestHeader "PRE-FLIGHT CHECKS"

Write-Host "  Checking server health..." -NoNewline
$isAuthenticated = $false
$serverReady = $false

try {
    $health = Invoke-RestMethod -Uri "$BaseUrl/health" -TimeoutSec 10
    if ($health.success) {
        $isAuthenticated = $health.data.authenticated
        $serverReady = $true
        Write-Host " OK" -ForegroundColor Green
        Write-Host "    - Server version: $($health.data.version)" -ForegroundColor Gray
        Write-Host "    - Authenticated: $isAuthenticated" -ForegroundColor $(if ($isAuthenticated) { "Green" } else { "Yellow" })
        Write-Host "    - Active sessions: $($health.data.active_sessions)" -ForegroundColor Gray
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

# Store auth status for later tests
Write-Host "`n  [STATE] Current authentication status: " -NoNewline
if ($isAuthenticated) {
    Write-Host "AUTHENTICATED" -ForegroundColor Green
    Write-Host "           Tests will be EXTRA CAUTIOUS to preserve session" -ForegroundColor Yellow
} else {
    Write-Host "NOT AUTHENTICATED" -ForegroundColor Yellow
}

# ============================================================================
# TEST 1: /setup-auth ENDPOINT
# ============================================================================

Write-TestHeader "SETUP-AUTH ENDPOINT (/setup-auth)"

# Test that the endpoint exists
# We send show_browser: false to avoid opening a browser
# If already authenticated, it should return success with "already authenticated" message
$Results += Test-EndpointExists `
    -Name "POST /setup-auth (endpoint exists)" `
    -Method POST `
    -Endpoint "/setup-auth" `
    -Body @{ show_browser = $false } `
    -TimeoutSec 60 `
    -Description "Verify endpoint responds (may skip if already authenticated)"

# ============================================================================
# TEST 2: /de-auth ENDPOINT (SAFE CHECK ONLY!)
# ============================================================================

Write-TestHeader "DE-AUTH ENDPOINT (/de-auth)"

if ($isAuthenticated) {
    Write-Host "  [SKIP] POST /de-auth - Session is authenticated" -ForegroundColor Yellow
    Write-Host "         Skipping to preserve existing authentication!" -ForegroundColor Yellow
    $script:Skipped++
    $Results += @{ Name = "POST /de-auth"; Status = "SKIPPED"; Details = "Preserved authenticated session" }

    # Alternative: Test with OPTIONS or HEAD to verify endpoint exists without executing
    Write-Host "  Testing: OPTIONS /de-auth (safe check)..." -NoNewline
    try {
        # Try to get endpoint info without actually calling it
        # We use a GET request which should return 404 (method not allowed) if endpoint exists
        # or we try OPTIONS
        $response = Invoke-WebRequest -Uri "$BaseUrl/de-auth" -Method OPTIONS -TimeoutSec 10 -ErrorAction SilentlyContinue
        Write-Host " PASS (endpoint accessible)" -ForegroundColor Green
        $script:Passed++
        $Results += @{ Name = "OPTIONS /de-auth (safe check)"; Status = "PASS" }
    } catch {
        $statusCode = 0
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }
        # 405 Method Not Allowed = endpoint exists, just wrong method
        # 200 = OPTIONS supported
        if ($statusCode -eq 405 -or $statusCode -eq 200 -or $statusCode -eq 204) {
            Write-Host " PASS (endpoint exists, HTTP $statusCode)" -ForegroundColor Green
            $script:Passed++
            $Results += @{ Name = "OPTIONS /de-auth (safe check)"; Status = "PASS" }
        } elseif ($statusCode -eq 404) {
            Write-Host " FAIL (endpoint not found)" -ForegroundColor Red
            $script:Failed++
            $Results += @{ Name = "OPTIONS /de-auth (safe check)"; Status = "FAIL"; Error = "404" }
        } else {
            # Any other response means endpoint exists
            Write-Host " PASS (endpoint responded, HTTP $statusCode)" -ForegroundColor Green
            $script:Passed++
            $Results += @{ Name = "OPTIONS /de-auth (safe check)"; Status = "PASS" }
        }
    }
} else {
    # Not authenticated - safe to test de-auth endpoint
    # It should return success (already de-authenticated) or similar
    $Results += Test-EndpointExists `
        -Name "POST /de-auth (not authenticated)" `
        -Method POST `
        -Endpoint "/de-auth" `
        -TimeoutSec 30 `
        -Description "Safe to test - no active session"
}

# ============================================================================
# TEST 3: /re-auth ENDPOINT (SAFE CHECK ONLY!)
# ============================================================================

Write-TestHeader "RE-AUTH ENDPOINT (/re-auth)"

if ($isAuthenticated) {
    Write-Host "  [SKIP] POST /re-auth - Session is authenticated" -ForegroundColor Yellow
    Write-Host "         Skipping full execution to preserve session!" -ForegroundColor Yellow
    $script:Skipped++
    $Results += @{ Name = "POST /re-auth (full execution)"; Status = "SKIPPED"; Details = "Preserved authenticated session" }

    # Safe check: verify endpoint routing exists
    Write-Host "  Testing: Verify /re-auth route exists..." -NoNewline
    try {
        # Send a minimal request with show_browser: false
        # The endpoint should at least acknowledge the request structure
        # We set a very short timeout to prevent actual browser launch
        $params = @{
            Uri = "$BaseUrl/re-auth"
            Method = "OPTIONS"
            TimeoutSec = 5
        }
        $response = Invoke-WebRequest @params -ErrorAction SilentlyContinue
        Write-Host " PASS" -ForegroundColor Green
        $script:Passed++
        $Results += @{ Name = "OPTIONS /re-auth (route check)"; Status = "PASS" }
    } catch {
        $statusCode = 0
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }
        # Any response except 404 means endpoint exists
        if ($statusCode -ne 404) {
            Write-Host " PASS (endpoint exists, HTTP $statusCode)" -ForegroundColor Green
            $script:Passed++
            $Results += @{ Name = "OPTIONS /re-auth (route check)"; Status = "PASS" }
        } else {
            Write-Host " FAIL (404 - endpoint not found)" -ForegroundColor Red
            $script:Failed++
            $Results += @{ Name = "OPTIONS /re-auth (route check)"; Status = "FAIL"; Error = "404" }
        }
    }
} else {
    # Not authenticated - can test more freely
    # But re-auth without auth doesn't make sense, it will likely fail
    # Still, we check that the endpoint exists
    $Results += Test-EndpointExists `
        -Name "POST /re-auth (endpoint exists)" `
        -Method POST `
        -Endpoint "/re-auth" `
        -Body @{ show_browser = $false } `
        -TimeoutSec 30 `
        -AcceptableCodes @(200, 400, 500)  # All acceptable - endpoint exists
        -Description "Verify endpoint routing"
}

# ============================================================================
# TEST 4: VERIFY AUTH STATUS UNCHANGED
# ============================================================================

Write-TestHeader "POST-TEST VERIFICATION"

Write-Host "  Verifying authentication status unchanged..." -NoNewline
try {
    $healthAfter = Invoke-RestMethod -Uri "$BaseUrl/health" -TimeoutSec 10
    $isAuthenticatedAfter = $healthAfter.data.authenticated

    if ($isAuthenticated -eq $isAuthenticatedAfter) {
        Write-Host " PASS" -ForegroundColor Green
        Write-Host "    - Auth status before: $isAuthenticated" -ForegroundColor Gray
        Write-Host "    - Auth status after:  $isAuthenticatedAfter" -ForegroundColor Gray
        $script:Passed++
        $Results += @{ Name = "Auth state preserved"; Status = "PASS" }
    } else {
        Write-Host " FAIL (state changed!)" -ForegroundColor Red
        Write-Host "    - Auth status before: $isAuthenticated" -ForegroundColor Red
        Write-Host "    - Auth status after:  $isAuthenticatedAfter" -ForegroundColor Red
        $script:Failed++
        $Results += @{ Name = "Auth state preserved"; Status = "FAIL"; Error = "Authentication state changed during tests!" }
    }
} catch {
    Write-Host " ERROR" -ForegroundColor Red
    $script:Failed++
    $Results += @{ Name = "Auth state preserved"; Status = "ERROR"; Error = $_.Exception.Message }
}

# ============================================================================
# RESULTS SUMMARY
# ============================================================================

Write-Host "`n"
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "                  AUTH ENDPOINTS TEST RESULTS" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

$Total = $Passed + $Failed + $Skipped
$SuccessRate = if (($Total - $Skipped) -gt 0) { [math]::Round(($Passed / ($Total - $Skipped)) * 100, 1) } else { 100 }

Write-Host "`n  Passed:  $Passed" -ForegroundColor Green
Write-Host "  Failed:  $Failed" -ForegroundColor $(if ($Failed -gt 0) { "Red" } else { "Gray" })
Write-Host "  Skipped: $Skipped" -ForegroundColor $(if ($Skipped -gt 0) { "Yellow" } else { "Gray" })
Write-Host "  Total:   $Total"
Write-Host "`n  Success Rate: $SuccessRate% (excluding skipped)" -ForegroundColor $(if ($SuccessRate -eq 100) { "Green" } elseif ($SuccessRate -ge 80) { "Yellow" } else { "Red" })

# Show test details
Write-Host "`n  Test Details:" -ForegroundColor Cyan
foreach ($result in $Results) {
    $statusColor = switch ($result.Status) {
        "PASS" { "Green" }
        "FAIL" { "Red" }
        "SKIPPED" { "Yellow" }
        "ERROR" { "Red" }
        default { "Gray" }
    }
    $statusIcon = switch ($result.Status) {
        "PASS" { "[OK]" }
        "FAIL" { "[X]" }
        "SKIPPED" { "[~]" }
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

if ($Skipped -gt 0) {
    Write-Host "`n  [~] Skipped Tests (to preserve auth):" -ForegroundColor Yellow
    $Results | Where-Object { $_.Status -eq "SKIPPED" } | ForEach-Object {
        Write-Host "      - $($_.Name)" -ForegroundColor Yellow
    }
}

Write-Host "`nCompleted: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

# Exit with appropriate code
if ($Failed -eq 0) {
    Write-Host "`n[SUCCESS] All authentication endpoint tests passed!" -ForegroundColor Green
    Write-Host "          (Some tests may have been skipped to preserve auth state)" -ForegroundColor Gray
    exit 0
} else {
    Write-Host "`n[FAILURE] Some tests failed" -ForegroundColor Red
    exit 1
}
