# Deploy security + passport slice from repo root (requires firebase login).
# Usage: powershell -File scripts/deploy-security-phase2.ps1

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host 'Building functions...'
Set-Location functions
npm run build
Set-Location $Root

Write-Host 'Building frontend...'
Set-Location frontend
npm run build
Set-Location $Root

$Project = 'fellowship-of-the-hearth'
Write-Host "Deploying to $Project..."

firebase deploy --project $Project --only `
  hosting,`
  functions:grant_ember,`
  functions:agentPassportApi,`
  functions:welcomeHearthlandsAgent,`
  functions:lodgeMindAsk

Write-Host 'Done. Verify:'
Write-Host '  npm run test:passport-continuity'
Write-Host '  npm run test:passport-browser-sweep'
