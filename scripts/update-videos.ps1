# FANZA 動画データをローカルで更新して GitHub に push するスクリプト
# 実行: PowerShell から  .\scripts\update-videos.ps1
#
# 処理の流れ:
#   1. git pull で GitHub Actions が更新したメタデータを取得
#   2. resolve-mp4.js で videoURL=null の動画を Puppeteer で解決
#   3. 変更があれば git commit & push

Set-StrictMode -Off
$ErrorActionPreference = 'Stop'

$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

Write-Host "[update] 最新のメタデータを取得中..." -ForegroundColor Cyan
git pull --rebase

Write-Host "[update] MP4 URL を解決中 (Puppeteer)..." -ForegroundColor Cyan
node scripts/resolve-mp4.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "[update] resolve-mp4.js が失敗しました" -ForegroundColor Red
    exit 1
}

$diff = git diff --name-only data/videos.json
if ($diff) {
    $date = Get-Date -Format 'yyyy-MM-dd'
    git add data/videos.json
    git commit -m "chore: resolve mp4 urls $date"
    git push
    Write-Host "[update] videos.json を更新してプッシュしました" -ForegroundColor Green
} else {
    Write-Host "[update] 変更なし。スキップします" -ForegroundColor Yellow
}
