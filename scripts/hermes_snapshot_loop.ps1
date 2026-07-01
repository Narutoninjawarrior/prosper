while ($true) {
  Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Generating Hermes snapshot..."
  python scripts/hermes_snapshot.py
  Start-Sleep -Seconds 30
}
