# Run Phase A+B identity mapping (Windows / Cursor terminal)
Set-Location $PSScriptRoot\..

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Error "Python not found on PATH."
    exit 1
}

python -m pip install -q -r scripts\requirements-identity.txt
python scripts\identity_mapper.py @args
exit $LASTEXITCODE
