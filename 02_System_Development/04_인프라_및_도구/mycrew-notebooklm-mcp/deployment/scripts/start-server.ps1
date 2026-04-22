# Startup script - NotebookLM MCP HTTP Server
# Version: 1.3.0

Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  NotebookLM MCP - HTTP Server Startup                    ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check that we are in the correct directory
if (-not (Test-Path "..\..\package.json")) {
    Write-Host "❌ Error: This script must be run from deployment\scripts\" -ForegroundColor Red
    Write-Host "   Use: cd deployment\scripts then .\start-server.ps1" -ForegroundColor Yellow
    exit 1
}

# Return to project root
Push-Location ..\..\

# Check that the project is compiled
if (-not (Test-Path "dist\http-wrapper.js")) {
    Write-Host "❌ Project not compiled!" -ForegroundColor Red
    Write-Host "   Run first: npm run build" -ForegroundColor Yellow
    Pop-Location
    exit 1
}

# Check that authentication is configured
if (-not (Test-Path "Data\browser_state\state.json")) {
    Write-Host "⚠️  Authentication not configured!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   You must first configure Google authentication:" -ForegroundColor White
    Write-Host "   .\deployment\scripts\setup-auth.ps1" -ForegroundColor Gray
    Write-Host ""
    $response = Read-Host "   Do you want to continue anyway? (y/N)"
    if ($response -ne "y" -and $response -ne "Y") {
        Pop-Location
        exit 0
    }
}

# Check that port 3000 is available
$portInUse = netstat -ano | Select-String ":3000" | Select-String "LISTENING"
if ($portInUse) {
    Write-Host "⚠️  Port 3000 is already in use!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   A server may already be running." -ForegroundColor White
    Write-Host "   To stop it: .\deployment\scripts\stop-server.ps1" -ForegroundColor Gray
    Write-Host ""
    $response = Read-Host "   Do you want to continue anyway? (y/N)"
    if ($response -ne "y" -and $response -ne "Y") {
        Pop-Location
        exit 0
    }
}

Write-Host "🚀 Starting HTTP server..." -ForegroundColor Green
Write-Host ""
Write-Host "📊 Information:" -ForegroundColor Cyan
Write-Host "   URL:          http://0.0.0.0:3000" -ForegroundColor White
Write-Host "   Health check: http://localhost:3000/health" -ForegroundColor White
Write-Host "   API docs:     .\deployment\docs\03-API.md" -ForegroundColor White
Write-Host ""
Write-Host "⏹️  To stop: Press Ctrl+C" -ForegroundColor Yellow
Write-Host ""
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Gray
Write-Host ""

# Start the server
node dist\http-wrapper.js

# Return to initial directory
Pop-Location
