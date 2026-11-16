# Deploys Signal's sync worker to your own free Cloudflare account, then prints the URL and key
# to paste into Signal → Settings → Sync.   Run:  powershell -ExecutionPolicy Bypass -File tools\deploy-sync.ps1
# The first run opens a browser so you can sign in to Cloudflare (or make a free account).
# 'Continue', not 'Stop': Windows PowerShell treats any warning wrangler prints to stderr as a fatal error.
$ErrorActionPreference = 'Continue'
$worker = Join-Path $PSScriptRoot '..\worker'
Set-Location $worker
$wr = @('--yes', 'wrangler@4')

Write-Host "`n1/4  Checking your Cloudflare sign-in..." -ForegroundColor Cyan
npx @wr whoami 2>&1 | Out-String | Tee-Object -Variable who | Out-Null
if ($who -match 'not authenticated|You are not logged in') { npx @wr login }

$toml = Get-Content wrangler.toml -Raw
if ($toml -match 'REPLACE_WITH_KV_ID') {
  Write-Host "2/4  Creating the storage (KV namespace)..." -ForegroundColor Cyan
  $out = npx @wr kv namespace create SIGNAL 2>&1 | Out-String
  if ($out -notmatch '"?id"?\s*[=:]\s*"([0-9a-f]{32})"') { Write-Host $out; throw 'Could not read the KV namespace id from wrangler.' }
  $toml = $toml -replace 'REPLACE_WITH_KV_ID', $Matches[1]
  [IO.File]::WriteAllText((Join-Path $worker 'wrangler.toml'), $toml)
} else { Write-Host "2/4  Storage already set up." -ForegroundColor Cyan }

Write-Host "3/4  Deploying the worker..." -ForegroundColor Cyan
$dep = npx @wr deploy 2>&1 | Out-String
Write-Host $dep
$url = [regex]::Match($dep, 'https://[a-z0-9.-]+\.workers\.dev').Value
if ($dep -match 'register a\s+workers\.dev subdomain') {
  Write-Host "`nCloudflare needs a one-time workers.dev subdomain first:" -ForegroundColor Yellow
  Write-Host "  dash.cloudflare.com -> Workers & Pages -> pick a subdomain, then run this script again."
  exit 1
}
if (-not $url) { Write-Host 'Deploy finished but no workers.dev URL was printed. Check the output above.' -ForegroundColor Red; exit 1 }

Write-Host "4/4  Setting a fresh secret key..." -ForegroundColor Cyan
$bytes = New-Object byte[] 24
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$key = ([BitConverter]::ToString($bytes) -replace '-', '').ToLower()
$key | npx @wr secret put SYNC_KEY | Out-Null

Write-Host "`nDone. In Signal → Settings → Sync, enter:" -ForegroundColor Green
Write-Host "  Worker URL:  $url"
Write-Host "  Key:         $key"
Write-Host "`nKeep the key private: anyone with it can read and change your Signal data." -ForegroundColor Yellow
