# FANZA 動画データをローカルで更新して GitHub に push するスクリプト
# 実行: PowerShell から  .\scripts\update-videos.ps1
#
# 処理の流れ:
#   1. git pull で GitHub Actions が更新したメタデータを取得
#   2. resolve-mp4.js で videoURL=null の動画を Puppeteer で解決
#   3. 再生できる動画が増えたので検索ページと SEO 用ページを作り直す
#   4. 変更があれば git commit & push し、IndexNow で検索エンジンに通知

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
    Write-Host "[update] 検索ページ・SEO 用ページを生成中..." -ForegroundColor Cyan
    node scripts/build-search.js
    node scripts/build-pages.js
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[update] ページ生成に失敗しました" -ForegroundColor Red
        exit 1
    }

    $date = Get-Date -Format 'yyyy-MM-dd'
    git add -A data/videos.json search.html sitemap.xml video actress genre ranking new
    git commit -m "chore: resolve mp4 urls $date"
    git push
    # 新しく増えた・更新されたページを Bing などに通知する
    node scripts/indexnow.js HEAD~1
    Write-Host "[update] videos.json を更新してプッシュしました" -ForegroundColor Green
} else {
    Write-Host "[update] 変更なし。スキップします" -ForegroundColor Yellow
}
