<#
.SYNOPSIS
    Stop NotebookLM MCP HTTP Server on Windows

.DESCRIPTION
    Stops all node processes running the HTTP server on port 3000.
#>

param(
    [int]$Port = 3000
)

Write-Host "Stopping NotebookLM MCP HTTP Server..." -ForegroundColor Yellow

# Find and kill processes on the port
$processes = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique

if ($processes) {
    foreach ($pid in $processes) {
        $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Host "Stopping $($proc.ProcessName) (PID: $pid)..." -ForegroundColor Cyan
            Stop-Process -Id $pid -Force
        }
    }
    Write-Host "Server stopped." -ForegroundColor Green
} else {
    Write-Host "No server running on port $Port." -ForegroundColor Gray
}
