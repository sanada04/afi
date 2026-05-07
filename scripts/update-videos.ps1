# FANZA 動画データをローカルで更新して GitHub に push するスクリプト
# 実行: PowerShell から  .\scripts\update-videos.ps1

Set-StrictMode -Off
$ErrorActionPreference = 'Stop'

$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

Write-Host "[update] 動画データを取得中..." -ForegroundColor Cyan
node scripts/fetch-videos.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "[update] fetch スクリプトが失敗しました" -ForegroundColor Red
    exit 1
}

# 変更があればコミット & プッシュ
$diff = git diff --name-only data/videos.json
if ($diff) {
    $date = Get-Date -Format 'yyyy-MM-dd'
    git add data/videos.json
    git commit -m "chore: update videos $date"
    git push
    Write-Host "[update] videos.json を更新してプッシュしました" -ForegroundColor Green
} else {
    Write-Host "[update] 変更なし。スキップします" -ForegroundColor Yellow
}
