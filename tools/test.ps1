# テストをまとめて流す（Google Chrome が必要。Node.js は不要）
#   .\tools\test.ps1            … 部品のテストと通しのテスト
#   .\tools\test.ps1 -Preview   … あわせて見た目の画像（ウィジェット・ホーム・パネル）を out\ に作る
param([switch]$Preview)
$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$tests = Join-Path $root 'tests'
$out = Join-Path $tests 'out'
New-Item -ItemType Directory -Force $out | Out-Null
$enc = New-Object Text.UTF8Encoding $false
$chrome = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $chrome) { throw 'Chrome（または Edge）が見つかりません' }

# src のスクリプトを1つにまとめてページに埋め込む
$map = [ordered]@{}
Get-ChildItem (Join-Path $root 'src') -Recurse -Filter *.js | ForEach-Object { $map[$_.Name] = [IO.File]::ReadAllText($_.FullName, [Text.Encoding]::UTF8) }
$sources = ($map | ConvertTo-Json -Compress -Depth 3) -replace '</', '<\/'
$manifest = [IO.File]::ReadAllText((Join-Path $root 'src\manifest.json'), $enc) | ConvertTo-Json -Compress
$read = { param($n) [IO.File]::ReadAllText((Join-Path $tests $n), $enc) }
$base = 'file:///' + ($out -replace '\\', '/')

function Run-Page($name, $html, $budget) {
  $p = Join-Path $out $name
  [IO.File]::WriteAllText($p, $html, $enc)
  $r = & $chrome --headless=new --disable-gpu --virtual-time-budget=$budget --dump-dom "$base/$name" 2>$null | Out-String
  return ($r -replace '<br>', "`n") -split "`n" | Where-Object { $_ -match 'FAIL|SYNTAX [^O]|CRASH|ALL PASSED|FAILURES' }
}

$ok = $true
Write-Host '--- 部品のテスト ---'
$res = Run-Page 'unit.html' ("<!doctype html><meta charset=utf-8><body></body><script>const SOURCES = $sources;`n" + (& $read 'unit.js') + '</script>') 10000
$res | ForEach-Object { Write-Host $_ }
if (-not ($res -match 'ALL PASSED')) { $ok = $false }

Write-Host '--- 通しのテスト ---'
$res = Run-Page 'e2e.html' ("<!doctype html><meta charset=utf-8><body></body><script>const SOURCES = $sources;`nconst MANIFEST = $manifest;`n" + (& $read 'e2e-env.js') + "`n" + (& $read 'e2e-scenarios.js') + '</script>') 120000
$res | ForEach-Object { Write-Host $_ }
if (-not ($res -match 'ALL PASSED')) { $ok = $false }

if ($Preview) {
  $fonts = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;700&family=Zen+Maru+Gothic:wght@400;700&family=Noto+Sans+JP:wght@400;700;800&display=swap">'
  $pv = & $read 'preview-widget.js'
  $phoneHead = '<!doctype html><meta charset="utf-8">' + $fonts + '<style>body{margin:0;background:#222}#root{display:flex;gap:16px;padding:16px}.phone{display:flex;flex-direction:column;gap:6px}.cap{color:#FFD9A0;font:12px sans-serif}iframe{border:0;border-radius:28px;background:#fff}</style><div id="root"></div>'
  $widgetHead = (& $read 'preview-head.html') -replace 'family=Shippori\+Mincho:wght@400;700', 'family=Shippori+Mincho:wght@400;700&family=Zen+Maru+Gothic:wght@400;700&family=Noto+Sans+JP:wght@400;700'
  [IO.File]::WriteAllText((Join-Path $out 'widget.html'), $widgetHead + "<script>const SOURCES = $sources;`n" + $pv + '</script>', $enc)
  [IO.File]::WriteAllText((Join-Path $out 'home.html'), $phoneHead + "<script>const SOURCES = $sources;`n" + ($pv -replace 'main\(\)\.catch', 'homeMain().catch') + "`n" + (& $read 'preview-home.js') + '</script>', $enc)
  [IO.File]::WriteAllText((Join-Path $out 'panel.html'), $phoneHead + "<script>const SOURCES = $sources;`n" + ($pv -replace 'main\(\)\.catch', 'panelMain().catch') + "`n" + (& $read 'preview-panel.js') + '</script>', $enc)
  foreach ($t in @('dawn', 'kissa', 'station', 'sora')) {
    foreach ($pg in @(@('widget', '980,780'), @('home', '1676,820'), @('panel', '1250,800'))) {
      $png = Join-Path $out ($pg[0] + '-' + $t + '.png')
      Start-Process -FilePath $chrome -ArgumentList @('--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-prefers-reduced-motion', '--virtual-time-budget=10000', "--window-size=$($pg[1])", "--screenshot=$png", "$base/$($pg[0]).html?t=$t") -Wait -WindowStyle Hidden
    }
  }
  Write-Host "見た目の画像: $out"
}

if ($ok) { Write-Host 'すべて合格' } else { Write-Host '不合格があります'; exit 1 }
