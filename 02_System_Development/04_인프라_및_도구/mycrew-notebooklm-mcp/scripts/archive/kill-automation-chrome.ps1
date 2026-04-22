# Kill only Chrome processes that belong to NotebookLM automation
# Does NOT kill user's personal Chrome

Write-Host "Finding automation Chrome processes..." -ForegroundColor Cyan

$automationChromes = @()

Get-Process chrome -ErrorAction SilentlyContinue | ForEach-Object {
    $process = $_
    try {
        $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId=$($process.Id)" -ErrorAction SilentlyContinue).CommandLine
        if ($cmdLine -like "*notebooklm-mcp*") {
            $automationChromes += $process
            Write-Host "  Found automation Chrome: PID $($process.Id)" -ForegroundColor Yellow
        }
    } catch {
        # Ignore access denied errors
    }
}

if ($automationChromes.Count -eq 0) {
    Write-Host "No automation Chrome processes found." -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "Killing $($automationChromes.Count) automation Chrome processes..." -ForegroundColor Red
    foreach ($chrome in $automationChromes) {
        try {
            Stop-Process -Id $chrome.Id -Force -ErrorAction SilentlyContinue
            Write-Host "  Killed PID $($chrome.Id)" -ForegroundColor Green
        } catch {
            Write-Host "  Failed to kill PID $($chrome.Id): $_" -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "Done. Your personal Chrome is untouched." -ForegroundColor Green
