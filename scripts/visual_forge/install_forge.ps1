# install_forge.ps1 - Sovereign Visual Forge (TripoSR)
# Clones TripoSR, creates venv, installs PyTorch CUDA 11.8 + deps.
# Run from anywhere:  powershell -ExecutionPolicy Bypass -File D:\Hearth\prosper2\scripts\visual_forge\install_forge.ps1

$ErrorActionPreference = "Stop"

$ForgeRoot   = $PSScriptRoot
$ProsperRoot = Split-Path (Split-Path $ForgeRoot -Parent) -Parent
$TripoDir    = Join-Path $ForgeRoot "TripoSR"
$VenvDir     = Join-Path $ForgeRoot "venv"
$ModelsDir   = Join-Path $ProsperRoot "frontend\public\models"
$InboxDir    = Join-Path $ForgeRoot "inbox"

Write-Host "=== Hearthlands Visual Forge - install ===" -ForegroundColor Cyan
Write-Host "Forge root : $ForgeRoot"
Write-Host "Prosper    : $ProsperRoot"

function Require-Command($name) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        throw "$name not found on PATH. Install it and re-run."
    }
}

Require-Command git
Require-Command python

$pyVersion = python -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"
Write-Host "Python     : $pyVersion"

if (-not (Test-Path $ModelsDir)) {
    New-Item -ItemType Directory -Path $ModelsDir -Force | Out-Null
    Write-Host "Created    : $ModelsDir"
}
if (-not (Test-Path $InboxDir)) {
    New-Item -ItemType Directory -Path $InboxDir -Force | Out-Null
    Write-Host "Created    : $InboxDir (drop PNG/JPG here)"
}

if (Test-Path $TripoDir) {
    Write-Host "TripoSR repo already exists - pulling latest..." -ForegroundColor Yellow
    Push-Location $TripoDir
    git pull --ff-only 2>$null
    if ($LASTEXITCODE -ne 0) { Write-Host "git pull skipped (offline or no remote)" -ForegroundColor DarkYellow }
    Pop-Location
} else {
    Write-Host "Cloning TripoSR..."
    git clone --depth 1 https://github.com/VAST-AI-Research/TripoSR.git $TripoDir
}

if (-not (Test-Path $VenvDir)) {
    Write-Host "Creating venv..."
    python -m venv $VenvDir
}

$python = Join-Path $VenvDir "Scripts\python.exe"
$pip    = Join-Path $VenvDir "Scripts\pip.exe"

Write-Host "Upgrading pip + setuptools..."
& $python -m pip install --upgrade pip setuptools wheel

Write-Host "Installing PyTorch (CUDA 11.8)..."
& $pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118

Write-Host "Verifying CUDA visibility..."
$cudaOk = & $python -c "import torch; print('yes' if torch.cuda.is_available() else 'no')"
Write-Host "torch.cuda.is_available() = $cudaOk"
if ($cudaOk -eq "no") {
    Write-Host "WARNING: CUDA not visible - forge will run on CPU (slow). Check NVIDIA drivers." -ForegroundColor Yellow
}

Write-Host "Installing TripoSR requirements..."
& $pip install -r (Join-Path $TripoDir "requirements.txt")

Write-Host "Ensuring torchmcubes with CUDA..."
& $pip uninstall -y torchmcubes 2>$null
& $pip install "git+https://github.com/tatsy/torchmcubes.git"

Write-Host ""
Write-Host "=== Visual Forge ready ===" -ForegroundColor Green
Write-Host "Generate:  powershell -File `"$ForgeRoot\generate_asset.ps1`" `"$InboxDir\your-image.png`""
Write-Host "Models ->  $ModelsDir"
