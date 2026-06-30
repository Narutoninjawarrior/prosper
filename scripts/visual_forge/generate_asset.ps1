# generate_asset.ps1 — Image -> .glb via TripoSR
# Usage:  .\generate_asset.ps1 D:\Hearth\prosper2\scripts\visual_forge\inbox\wind-catcher.png
#         .\generate_asset.ps1   (uses newest file in inbox/)

param(
    [Parameter(Position = 0)]
    [string]$InputImagePath
)

$ErrorActionPreference = "Stop"

$ForgeRoot   = $PSScriptRoot
$ProsperRoot = Split-Path (Split-Path $ForgeRoot -Parent) -Parent
$TripoDir    = Join-Path $ForgeRoot "TripoSR"
$VenvPython  = Join-Path $ForgeRoot "venv\Scripts\python.exe"
$ModelsDir   = Join-Path $ProsperRoot "frontend\public\models"
$InboxDir    = Join-Path $ForgeRoot "inbox"

if (-not (Test-Path $VenvPython)) {
    throw "Visual Forge not installed. Run install_forge.ps1 first."
}
if (-not (Test-Path (Join-Path $TripoDir "run.py"))) {
    throw "TripoSR not found at $TripoDir. Run install_forge.ps1 first."
}

if (-not $InputImagePath) {
    $latest = Get-ChildItem $InboxDir -Include *.png,*.jpg,*.jpeg,*.webp -File -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    if (-not $latest) {
        throw "No input image. Pass a path or drop a PNG/JPG into $InboxDir"
    }
    $InputImagePath = $latest.FullName
    Write-Host "Using newest inbox image: $InputImagePath"
}

$InputImagePath = (Resolve-Path $InputImagePath).Path
if (-not (Test-Path $InputImagePath)) {
    throw "Input image not found: $InputImagePath"
}

if (-not (Test-Path $ModelsDir)) {
    New-Item -ItemType Directory -Path $ModelsDir -Force | Out-Null
}

$stem = [System.IO.Path]::GetFileNameWithoutExtension($InputImagePath)
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$OutDir = Join-Path $ModelsDir "${stem}_${stamp}"

Write-Host "=== Visual Forge generate ===" -ForegroundColor Cyan
Write-Host "Input  : $InputImagePath"
Write-Host "Output : $OutDir"

Push-Location $TripoDir
try {
    $device = "cuda:0"
    $cudaCheck = & $VenvPython -c "import torch; exit(0 if torch.cuda.is_available() else 1)"
    if ($LASTEXITCODE -ne 0) {
        $device = "cpu"
        Write-Host "CUDA unavailable — using CPU (slow)" -ForegroundColor Yellow
    }

    & $VenvPython run.py $InputImagePath `
        --output-dir $OutDir `
        --model-save-format glb `
        --device $device

    if ($LASTEXITCODE -ne 0) { throw "TripoSR run.py failed (exit $LASTEXITCODE)" }
} finally {
    Pop-Location
}

$glbs = Get-ChildItem $OutDir -Filter *.glb -Recurse -ErrorAction SilentlyContinue
if ($glbs) {
    Write-Host ""
    Write-Host "=== Done ===" -ForegroundColor Green
    foreach ($g in $glbs) { Write-Host "  GLB: $($g.FullName)" }
} else {
    Write-Host "Run finished — check $OutDir for outputs." -ForegroundColor Yellow
}
