<#
.SYNOPSIS
    Test auto-login for a NotebookLM account

.DESCRIPTION
    This script tests the auto-login functionality for a specific account.
    It must be run from Windows (PowerShell), NOT from WSL.

.PARAMETER AccountId
    The account ID to test

.PARAMETER ShowBrowser
    Show the browser window during login

.EXAMPLE
    .\scripts\test-account.ps1 -AccountId "account-123"

.EXAMPLE
    .\scripts\test-account.ps1 -AccountId "account-123" -ShowBrowser
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$AccountId,

    [switch]$ShowBrowser
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  NotebookLM Account Login Test            " -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check we're on Windows (not WSL)
if ($env:WSL_DISTRO_NAME) {
    Write-Host "ERROR: This script must be run from Windows, not WSL!" -ForegroundColor Red
    Write-Host "Run from PowerShell on Windows." -ForegroundColor Yellow
    exit 1
}

Set-Location $ProjectDir

# Build arguments
$args = @("dist/cli/accounts.js", "test", $AccountId)
if ($ShowBrowser) {
    $args += "--show"
}

Write-Host "Testing account: $AccountId"
Write-Host "Show browser: $ShowBrowser"
Write-Host ""

# Run the test
& node.exe @args
