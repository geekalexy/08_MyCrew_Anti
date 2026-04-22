# MCP Proxy Launcher - Hidden Window
# Lance le stdio-http-proxy sans fenêtre visible

$scriptPath = Split-Path -Parent $PSScriptRoot
$proxyPath = Join-Path $scriptPath "dist\stdio-http-proxy.js"

$env:NBLM_HOST = "localhost"
$env:NBLM_PORT = "3000"

# Lance node avec la fenêtre cachée
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "node"
$psi.Arguments = $proxyPath
$psi.WorkingDirectory = $scriptPath
$psi.UseShellExecute = $false
$psi.RedirectStandardInput = $true
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.CreateNoWindow = $true

$process = [System.Diagnostics.Process]::Start($psi)

# Relay stdin/stdout pour le protocole MCP
$inputTask = [System.Threading.Tasks.Task]::Run({
    param($proc)
    try {
        [Console]::OpenStandardInput().CopyTo($proc.StandardInput.BaseStream)
    } catch {}
}, $process)

$process.StandardOutput.BaseStream.CopyTo([Console]::OpenStandardOutput())
