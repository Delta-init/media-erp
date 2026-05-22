# start-tunnel.ps1 — Start ngrok tunnel for Instagram OAuth
# The static domain never changes — no need to update Meta Console each time.
# Usage: .\start-tunnel.ps1

$NGROK       = "$env:APPDATA\npm\ngrok.cmd"
$STATIC_URL  = "https://hate-overdraft-ranting.ngrok-free.dev"
$REDIRECT_URI = "$STATIC_URL/api/v1/connectors/instagram_login/callback"
$ENV_FILE    = "$PSScriptRoot\backend\.env"

Write-Host "Starting ngrok tunnel..." -ForegroundColor Cyan

# Check if ngrok is already running with this domain
try {
    $existing = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -TimeoutSec 3 -ErrorAction Stop
    $running  = $existing.tunnels | Where-Object { $_.public_url -like "*ngrok-free*" }
    if ($running) {
        Write-Host "ngrok already running: $($running.public_url)" -ForegroundColor Green
    }
} catch {
    # Not running — start it
    Start-Process -FilePath $NGROK -ArgumentList "http", "8000", "--url=$STATIC_URL" -WindowStyle Normal
    Start-Sleep -Seconds 5
}

# Verify tunnel works
try {
    $r = Invoke-WebRequest -Uri "$STATIC_URL/api/v1/health" -UseBasicParsing -TimeoutSec 8
    Write-Host "Tunnel LIVE: HTTP $($r.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "WARNING: Tunnel not responding yet. Wait a few seconds and try again." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Static Redirect URI (add to Meta Console once, never changes):" -ForegroundColor Magenta
Write-Host "  $REDIRECT_URI" -ForegroundColor Cyan
Write-Host ""
