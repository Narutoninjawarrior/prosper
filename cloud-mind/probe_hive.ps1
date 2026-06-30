# probe_hive.ps1 — Hearthlands Hive Local Probe
# Run from PowerShell: cd D:\Hearth\prosper2\cloud-mind && .\probe_hive.ps1
# -----------------------------------------------------------------------

Write-Host "`n=== STEP 1: LM Studio model list ===" -ForegroundColor Cyan
$modelsResponse = $null
try {
    $modelsResponse = curl.exe -s http://localhost:1234/v1/models | ConvertFrom-Json
    $modelsResponse | ConvertTo-Json -Depth 5
} catch {
    Write-Host "ERROR: LM Studio not reachable at localhost:1234" -ForegroundColor Red
    Write-Host "Start LM Studio and enable the local server before continuing." -ForegroundColor Yellow
    exit 1
}

Write-Host "`n=== STEP 2: Model IDs ===" -ForegroundColor Cyan
$modelIds = $modelsResponse.data | ForEach-Object { $_.id }
if (-not $modelIds) {
    Write-Host "No models loaded. Load a model in LM Studio first." -ForegroundColor Yellow
    exit 1
}
$modelIds | ForEach-Object { Write-Host "  $_" -ForegroundColor White }

# Pick first model as default — edit STEWARD_MODEL_ID / PLANNER_MODEL_ID below
# if you have specific Gemma / Qwen models loaded
$STEWARD_MODEL_ID  = $modelIds[0]
$PLANNER_MODEL_ID  = if ($modelIds.Count -gt 1) { $modelIds[1] } else { $modelIds[0] }

Write-Host "`nSteward (Gemma) model ID : $STEWARD_MODEL_ID"  -ForegroundColor Green
Write-Host "Planner  (Qwen) model ID : $PLANNER_MODEL_ID"   -ForegroundColor Blue

Write-Host "`n=== STEP 3: Direct Gemma completion test ===" -ForegroundColor Cyan
$stewardBody = @{
    model    = $STEWARD_MODEL_ID
    messages = @(
        @{ role = "system"; content = "You are the Hearth Steward. Speak in 2-3 sentences. No execution authority. Focus on community feeling and belonging." }
        @{ role = "user";   content = "What does the Fellowship need next?" }
    )
    temperature = 0.7
    max_tokens  = 200
} | ConvertTo-Json -Depth 5

try {
    $stewardResult = curl.exe -s -X POST http://localhost:1234/v1/chat/completions `
        -H "Content-Type: application/json" `
        -d $stewardBody | ConvertFrom-Json
    Write-Host "`nSteward response:" -ForegroundColor Green
    Write-Host $stewardResult.choices[0].message.content -ForegroundColor White
} catch {
    Write-Host "Gemma completion failed: $_" -ForegroundColor Red
}

Write-Host "`n=== STEP 4: Set Hive env vars ===" -ForegroundColor Cyan
$env:HIVE_STEWARD_URL    = "http://localhost:1234/v1/chat/completions"
$env:HIVE_STEWARD_MODEL  = $STEWARD_MODEL_ID
$env:HIVE_PLANNER_URL    = "http://localhost:1234/v1/chat/completions"
$env:HIVE_PLANNER_MODEL  = $PLANNER_MODEL_ID
$env:HIVE_AGGREGATOR_URL   = "http://localhost:1234/v1/chat/completions"
$env:HIVE_AGGREGATOR_MODEL = $PLANNER_MODEL_ID

Write-Host "HIVE_STEWARD_URL    = $env:HIVE_STEWARD_URL"
Write-Host "HIVE_STEWARD_MODEL  = $env:HIVE_STEWARD_MODEL"
Write-Host "HIVE_PLANNER_URL    = $env:HIVE_PLANNER_URL"
Write-Host "HIVE_PLANNER_MODEL  = $env:HIVE_PLANNER_MODEL"
Write-Host "HIVE_AGGREGATOR_URL = $env:HIVE_AGGREGATOR_URL"
Write-Host "HIVE_AGGREGATOR_MODEL = $env:HIVE_AGGREGATOR_MODEL"
Write-Host "(council_mode will be single-backend-fallback unless you set separate ports)" -ForegroundColor Yellow

Write-Host "`n=== STEP 5: Starting hive_local.py ===" -ForegroundColor Cyan
Write-Host "Starting uvicorn on port 8000. Ctrl+C to stop." -ForegroundColor Yellow
Write-Host "After it starts, open a second terminal and run:" -ForegroundColor Gray
Write-Host '  curl.exe http://localhost:8000/health' -ForegroundColor Gray
Write-Host '  # or open http://localhost:5173/os/hive in the browser if frontend is running' -ForegroundColor Gray
Write-Host ""

# Install deps if needed
pip install -q -r requirements.txt

# Start server (blocking — opens in this terminal)
uvicorn hive_local:app --host 0.0.0.0 --port 8000 --reload
