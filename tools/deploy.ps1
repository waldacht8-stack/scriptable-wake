# src/ の Scriptable スクリプトを iCloud Drive の Scriptable フォルダへコピーする
# 使い方: VS Code のターミナルで  .\tools\deploy.ps1
$ErrorActionPreference = 'Stop'

$src  = Join-Path $PSScriptRoot '..\src'
$dest = Join-Path $env:USERPROFILE 'iCloudDrive\iCloud~dk~simonbs~Scriptable'

if (-not (Test-Path $dest)) {
    throw "Scriptable の iCloud フォルダが見つかりません: $dest"
}

# 既存 Todo アプリのファイルは触らない（本アプリのファイルだけをコピー）
$files = Get-ChildItem $src -Recurse -File -Filter '*.js'
foreach ($f in $files) {
    $rel    = $f.FullName.Substring((Resolve-Path $src).Path.Length + 1)
    $target = Join-Path $dest $rel
    New-Item -ItemType Directory -Force (Split-Path $target) | Out-Null
    Copy-Item $f.FullName $target -Force
    Write-Host "コピー: $rel"
}
Write-Host "完了: $($files.Count) ファイル。iCloud の同期後に iPhone の Scriptable で確認してください。"

# GitHub 配信用の manifest.json に載っていないスクリプトがあれば知らせる（載せ忘れると「起床 Update」で配られない）
$manifest = Get-Content (Join-Path $src 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$listed = $manifest.files | ForEach-Object { $_.src }
foreach ($f in $files) {
    $rel = $f.FullName.Substring((Resolve-Path $src).Path.Length + 1) -replace '\\', '/'
    if ($listed -notcontains $rel) { Write-Warning "manifest.json に載っていません: $rel" }
}
