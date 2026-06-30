# Copy Firebase service account JSON to clipboard for Emergent env var paste.
# Run in PowerShell — does NOT print the secret to the console.
$path = "D:\Hearth\prosper2\secrets\firebase-service-account.json"
if (-not (Test-Path $path)) {
  Write-Error "Missing $path — download key from Firebase Console first."
  exit 1
}
Get-Content -Raw $path | Set-Clipboard
Write-Host "Copied FIREBASE_SERVICE_ACCOUNT JSON to clipboard."
Write-Host "In Emergent hearth-lodge → Environment Variables, paste as FIREBASE_SERVICE_ACCOUNT"
Write-Host "Also set: FIREBASE_PROJECT_ID = fellowship-of-the-hearth"
