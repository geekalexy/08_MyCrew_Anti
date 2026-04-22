# Automatic installation script - NotebookLM MCP HTTP Server
# Version: 1.3.0
# Description: Installs all dependencies and compiles the project

Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  NotebookLM MCP - Automatic Installation                 ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
Write-Host "🔍 Checking Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    $npmVersion = npm --version
    Write-Host "✅ Node.js $nodeVersion found" -ForegroundColor Green
    Write-Host "✅ npm $npmVersion found" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js is not installed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "📥 Download Node.js from: https://nodejs.org/" -ForegroundColor Yellow
    Write-Host "   Install the LTS version and run this script again." -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Check that we're in the right directory
Write-Host "🔍 Checking directory..." -ForegroundColor Yellow
if (-not (Test-Path "package.json")) {
    Write-Host "❌ package.json file not found!" -ForegroundColor Red
    Write-Host "   Make sure you are in the project root directory." -ForegroundColor Yellow
    exit 1
}

$projectName = (Get-Content "package.json" -Raw | ConvertFrom-Json).name
Write-Host "✅ Project detected: $projectName" -ForegroundColor Green
Write-Host ""

# Install dependencies
Write-Host "📦 Installing npm dependencies..." -ForegroundColor Yellow
Write-Host "   (This may take 2-5 minutes)" -ForegroundColor Gray
Write-Host ""

npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Error during dependency installation" -ForegroundColor Red
    Write-Host "   Check your Internet connection and try again." -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "✅ Dependencies installed successfully!" -ForegroundColor Green
Write-Host ""

# TypeScript compilation
Write-Host "🔨 Compiling project..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Error during compilation" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Compilation successful!" -ForegroundColor Green
Write-Host ""

# Final checks
Write-Host "🔍 Final checks..." -ForegroundColor Yellow

$checks = @(
    @{File = "dist\http-wrapper.js"; Description = "HTTP Server"},
    @{File = "dist\index.js"; Description = "MCP Server"},
    @{File = "node_modules\express"; Description = "Express.js"}
)

$allOk = $true
foreach ($check in $checks) {
    if (Test-Path $check.File) {
        Write-Host "  ✅ $($check.Description)" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $($check.Description) - $($check.File) not found" -ForegroundColor Red
        $allOk = $false
    }
}

Write-Host ""

if ($allOk) {
    Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║  ✅ INSTALLATION COMPLETED SUCCESSFULLY!                 ║" -ForegroundColor Green
    Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Next steps:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1️⃣  Configure Google authentication (one time only):" -ForegroundColor White
    Write-Host "   .\deployment\scripts\setup-auth.ps1" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2️⃣  Start the server:" -ForegroundColor White
    Write-Host "   npm run start:http" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3️⃣  Test the server:" -ForegroundColor White
    Write-Host "   curl http://localhost:3000/health" -ForegroundColor Gray
    Write-Host ""
    Write-Host "📖 Complete documentation: .\deployment\docs\" -ForegroundColor Cyan
    Write-Host ""
} else {
    Write-Host "❌ Installation encountered problems" -ForegroundColor Red
    Write-Host "   See: .\deployment\docs\05-TROUBLESHOOTING.md" -ForegroundColor Yellow
    exit 1
}
