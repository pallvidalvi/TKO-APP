#!/usr/bin/env powershell
# TKO App - GitHub Build Setup Script

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "TKO Ground Zero - Free APK Build Setup" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Check if git is installed
Write-Host "Checking prerequisites..." -ForegroundColor Yellow

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Git is not installed. Please install from https://git-scm.com" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Git is installed" -ForegroundColor Green

# Initialize git repository
if (-not (Test-Path .git)) {
    Write-Host ""
    Write-Host "Initializing Git repository..." -ForegroundColor Yellow
    git init
    git config user.name "TKO Developer"
    git config user.email "developer@tko.local"
    Write-Host "✅ Git initialized" -ForegroundColor Green
} else {
    Write-Host "✅ Git repository already exists" -ForegroundColor Green
}

# Add all files
Write-Host ""
Write-Host "Adding files to git..." -ForegroundColor Yellow
git add .
Write-Host "✅ Files added" -ForegroundColor Green

# Create initial commit
Write-Host ""
Write-Host "Creating initial commit..." -ForegroundColor Yellow
git commit -m "TKO Ground Zero - Ready for GitHub build" -q
Write-Host "✅ Commit created" -ForegroundColor Green

# Set main branch
git branch -M main 2>$null

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Go to https://github.com/new" -ForegroundColor White
Write-Host "2. Create a NEW repository called: TKO-APP" -ForegroundColor White
Write-Host "   ⚠️  DO NOT initialize with README" -ForegroundColor Red
Write-Host "3. Copy the 'push an existing repository' commands" -ForegroundColor White
Write-Host ""
Write-Host "4. Run these commands:" -ForegroundColor Cyan
Write-Host '   git remote add origin https://github.com/YOUR_USERNAME/TKO-APP.git' -ForegroundColor White
Write-Host "   git push -u origin main" -ForegroundColor White
Write-Host ""
Write-Host "5. Go to your GitHub repository and click Actions" -ForegroundColor White
Write-Host "6. Wait for the Build to complete (5-10 minutes)" -ForegroundColor White
Write-Host "7. Download the APK from Artifacts" -ForegroundColor White
Write-Host ""
Write-Host "❓ Questions?" -ForegroundColor Yellow
Write-Host "Read: FREE_APK_BUILD.md or QUICK_APK_BUILD.md" -ForegroundColor White
Write-Host ""
