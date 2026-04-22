<#
.SYNOPSIS
    Check NotebookLM MCP HTTP Server status

.DESCRIPTION
    Checks if the server is running and displays health information.
#>

param(
    [int]$Port = 3000
)

Write-Host "Checking NotebookLM MCP HTTP Server..." -ForegroundColor Cyan
Write-Host ""

# Check if something is listening on the port
$listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue

if ($listener) {
    $pid = $listener.OwningProcess | Select-Object -First 1
    $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue

    Write-Host "Server Status: RUNNING" -ForegroundColor Green
    Write-Host "  PID: $pid"
    Write-Host "  Process: $($proc.ProcessName)"
    Write-Host "  Port: $Port"
    Write-Host ""

    # Try to get health info
    try {
        $health = Invoke-RestMethod -Uri "http://localhost:$Port/health" -Method Get -TimeoutSec 5
        Write-Host "Health Check:" -ForegroundColor Cyan
        Write-Host "  Status: $($health.data.status)"
        Write-Host "  Authenticated: $($health.data.authenticated)"
        Write-Host "  Active Sessions: $($health.data.active_sessions)/$($health.data.max_sessions)"
        Write-Host "  Total Messages: $($health.data.total_messages)"
    }
    catch {
        Write-Host "Could not get health info: $_" -ForegroundColor Yellow
    }
} else {
    Write-Host "Server Status: NOT RUNNING" -ForegroundColor Red
    Write-Host ""
    Write-Host "To start the server:" -ForegroundColor Yellow
    Write-Host "  .\scripts\start-server.ps1" -ForegroundColor Yellow
}
