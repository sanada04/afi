# update-videos.ps1 を毎日自動実行する Windows タスクを登録するスクリプト
# 実行: PowerShell から  .\scripts\register-task.ps1
#
# - 毎日 11:00 に実行 (GitHub Actions のメタデータ更新 06:00 JST の後)
# - PC が起動していなかった場合は、次に起動したときに実行
# - ログは logs\update.log に出力
# - 解除: Unregister-ScheduledTask -TaskName afi-update-videos

$ErrorActionPreference = 'Stop'

$root     = Split-Path $PSScriptRoot -Parent
$taskName = 'afi-update-videos'
$logDir   = Join-Path $root 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$command = "powershell -NoProfile -ExecutionPolicy Bypass -File `"$root\scripts\update-videos.ps1`" > `"$logDir\update.log`" 2>&1"

$action   = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c $command" -WorkingDirectory $root
$trigger  = New-ScheduledTaskTrigger -Daily -At '11:00'
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 2)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings `
  -Description 'いまぬきっ！ 動画 MP4 URL を解決して GitHub に push' -Force | Out-Null

Write-Host "[task] '$taskName' を登録しました (毎日 11:00)" -ForegroundColor Green
