# Shutdown Script - NotebookLM MCP HTTP Server
# Version: 1.3.0

Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  NotebookLM MCP - HTTP Server Shutdown                  ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Find node processes listening on port 3000
$portInfo = netstat -ano | Select-String ":3000" | Select-String "LISTENING"

if (-not $portInfo) {
    Write-Host "ℹ️  No active server on port 3000" -ForegroundColor Yellow
    Write-Host ""
    exit 0
}

# Extract the PID
$pid = ($portInfo -split '\s+')[-1]

Write-Host "🔍 Process found: PID $pid" -ForegroundColor Yellow

# Verify it's actually node.exe
$process = Get-Process -Id $pid -ErrorAction SilentlyContinue
if (-not $process) {
    Write-Host "❌ Unable to find the process" -ForegroundColor Red
    exit 1
}

Write-Host "   Process: $($process.ProcessName)" -ForegroundColor Gray
Write-Host ""

# Ask for confirmation
$response = Read-Host "Do you want to stop this process? (Y/n)"
if ($response -eq "n" -or $response -eq "N") {
    Write-Host "❌ Cancelled" -ForegroundColor Yellow
    exit 0
}

# Stop the process
Write-Host "⏹️  Stopping server..." -ForegroundColor Yellow
try {
    Stop-Process -Id $pid -Force
    Start-Sleep -Seconds 1
    Write-Host "✅ Server stopped successfully!" -ForegroundColor Green
} catch {
    Write-Host "❌ Error during shutdown: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
