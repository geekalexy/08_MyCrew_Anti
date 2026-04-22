#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Configure Google authentication for NotebookLM MCP Server

.DESCRIPTION
    This script:
    1. Checks if authentication already exists
    2. Asks for confirmation to reset if necessary
    3. Launches the interactive authentication process
    4. Verifies that files are properly created

.EXAMPLE
    .\setup-auth.ps1
#>

# Colors
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Info { Write-Host $args -ForegroundColor Cyan }
function Write-Warning { Write-Host $args -ForegroundColor Yellow }
function Write-Error { Write-Host $args -ForegroundColor Red }

Write-Info ""
Write-Info "=========================================="
Write-Info "  NotebookLM MCP - Authentication Setup"
Write-Info "=========================================="
Write-Info ""

# Check that we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Error "❌ Error: package.json not found"
    Write-Error "   Run this script from the project root:"
    Write-Error "   cd D:\notebooklm-http"
    Write-Error "   .\deployment\scripts\setup-auth.ps1"
    exit 1
}

# Check that the build exists
if (-not (Test-Path "dist\index.js")) {
    Write-Error "❌ Error: The project is not compiled"
    Write-Error "   Run first: npm run build"
    exit 1
}

# Authentication data path
# IMPORTANT: env-paths uses LOCALAPPDATA for .data, not APPDATA!
$authDataDir = "$env:LOCALAPPDATA\notebooklm-mcp\Data"
$chromeProfileDir = "$authDataDir\chrome_profile"
$browserStateDir = "$authDataDir\browser_state"
$stateFile = "$browserStateDir\state.json"
$cookiesFile = "$chromeProfileDir\Default\Network\Cookies"

Write-Info "📁 Checking authentication files..."
Write-Info "   Path: $authDataDir"
Write-Info ""

# Check if authentication already exists
$authExists = $false
if (Test-Path $stateFile) {
    $authExists = $true
    Write-Warning "⚠️  Existing authentication detected!"
    Write-Info ""
    Write-Info "   Files found:"

    if (Test-Path $cookiesFile) {
        $cookiesSize = (Get-Item $cookiesFile).Length / 1KB
        Write-Info "   ✅ Cookies: $([math]::Round($cookiesSize, 2)) KB"
    }

    if (Test-Path $stateFile) {
        $stateSize = (Get-Item $stateFile).Length / 1KB
        Write-Info "   ✅ State: $([math]::Round($stateSize, 2)) KB"
    }

    Write-Info ""
    Write-Warning "   Do you want to RESET the authentication?"
    Write-Info "   (This will delete the current files)"
    Write-Info ""

    $response = Read-Host "   Continue? (Y/N)"

    if ($response -notmatch '^[OoYy]') {
        Write-Info ""
        Write-Info "✅ Cancelled. Existing authentication preserved."
        exit 0
    }

    Write-Info ""
    Write-Warning "🗑️  Deleting existing files..."

    try {
        if (Test-Path $authDataDir) {
            Remove-Item -Path $authDataDir -Recurse -Force
            Write-Success "   ✅ Files deleted"
        }
    } catch {
        Write-Error "❌ Error during deletion: $_"
        exit 1
    }
} else {
    Write-Success "✅ No authentication files found"
    Write-Info "   First authentication setup"
    Write-Info ""
}

Write-Info ""
Write-Info "🚀 Starting interactive authentication..."
Write-Info ""
Write-Info "📋 Instructions:"
Write-Info "   1. Chrome will open (visible window)"
Write-Info "   2. Log in to your Google account"
Write-Info "   3. Go to https://notebooklm.google.com"
Write-Info "   4. Wait for the page to load completely"
Write-Info "   5. Close Chrome manually (red X)"
Write-Info ""
Write-Warning "⏳ Press Enter when you're ready..."
Read-Host

Write-Info ""
Write-Info "🌐 Opening Chrome for authentication..."
Write-Info ""
Write-Info "⏳ Please wait while Chrome opens..."
Write-Info "   1. Chrome will open in VISIBLE mode"
Write-Info "   2. Log in to Google"
Write-Info "   3. Go to notebooklm.google.com"
Write-Info "   4. Close Chrome when you're done"
Write-Info ""

# Create temporary MCP command file
$mcpCommand = '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"setup_auth","arguments":{"show_browser":true}}}'
$tempFile = [System.IO.Path]::GetTempFileName()
$mcpCommand | Out-File -FilePath $tempFile -Encoding utf8 -NoNewline

try {
    # Launch MCP server with setup_auth command
    # NOTE: We use Get-Content | node to send the command via stdin
    # This allows Chrome to display properly
    Write-Info "Starting authentication process..."
    Write-Info ""

    Get-Content $tempFile | node dist/index.js

    Write-Info ""
    Write-Success "✅ Authentication process completed!"

} catch {
    Write-Error "❌ Error during authentication: $_"
    exit 1
} finally {
    # Clean up temporary file
    if (Test-Path $tempFile) {
        Remove-Item $tempFile -ErrorAction SilentlyContinue
    }
}

Write-Info ""
Write-Info "🔍 Verifying created files..."
Write-Info ""

# Wait a bit for files to be written
Start-Sleep -Seconds 2

$allOk = $true

# Check state.json
if (Test-Path $stateFile) {
    $stateSize = (Get-Item $stateFile).Length / 1KB
    Write-Success "   ✅ state.json created ($([math]::Round($stateSize, 2)) KB)"
} else {
    Write-Error "   ❌ state.json missing!"
    $allOk = $false
}

# Check Cookies
if (Test-Path $cookiesFile) {
    $cookiesSize = (Get-Item $cookiesFile).Length / 1KB
    if ($cookiesSize -gt 10) {
        Write-Success "   ✅ Cookies created ($([math]::Round($cookiesSize, 2)) KB)"
    } else {
        Write-Warning "   ⚠️  Cookies too small ($([math]::Round($cookiesSize, 2)) KB) - expected >10 KB"
        Write-Warning "      Authentication might not be complete"
        $allOk = $false
    }
} else {
    Write-Error "   ❌ Cookies missing!"
    $allOk = $false
}

Write-Info ""
Write-Info "📁 Full file path:"
Write-Info "   $authDataDir"
Write-Info ""

if ($allOk) {
    Write-Success "=========================================="
    Write-Success "  ✅ Authentication configured successfully!"
    Write-Success "=========================================="
    Write-Info ""
    Write-Info "💡 Google session valid for ~399 days"
    Write-Info ""
    Write-Info "🚀 Next step:"
    Write-Info "   .\deployment\scripts\start-server.ps1"
    Write-Info ""
    exit 0
} else {
    Write-Error ""
    Write-Error "=========================================="
    Write-Error "  ❌ Problem with authentication"
    Write-Error "=========================================="
    Write-Info ""
    Write-Info "🔧 Possible solutions:"
    Write-Info "   1. Rerun: .\deployment\scripts\setup-auth.ps1"
    Write-Info "   2. Verify that Chrome has closed properly"
    Write-Info "   3. Consult: .\deployment\docs\05-TROUBLESHOOTING.md"
    Write-Info ""
    exit 1
}
