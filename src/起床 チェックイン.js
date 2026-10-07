// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: barcode;
// 起床 チェックイン.js — ショートカット「起床チェックイン」から呼ぶ
//   ショートカットは「QR/バーコードをスキャン → Run Script（起床 チェックイン）→ アラームをオフ ×4」と並べるだけ。
//   Parameter には「QR/バーコード」を選ぶ。選べない場合は、スキャンのあとに「クリップボードにコピー」を
//   置けば、クリップボードから読む。
//   チェックインできなかったとき（コードが違う・時間外・最初のコード登録・エラー）は、わざとエラーで止める
//   → ショートカットがそこで止まり、アラームはオフにならない（鳴る側に倒す）

const core = importModule('wake-lib/core')
const notify = importModule('wake-lib/notify')
const actions = importModule('wake-lib/actions')(core, notify)

function readCode() {
  const raw = args.shortcutParameter || (args.plainTexts && args.plainTexts.length ? args.plainTexts[0] : '')
  let code = String(raw === null || raw === undefined ? '' : raw).trim()
  if (!code) {
    try { code = String(Pasteboard.pasteString() || '').trim() } catch (e) { code = '' }
  }
  return code
}

const r = await actions.run('checkin:' + readCode())
const msg = actions.lastMessage()
if (config.runsInApp && !config.runsWithSiri) {
  const a = new Alert()
  a.title = r === 'OK' ? '☀️ チェックインしました' : 'チェックインできません'
  a.message = msg + (r === 'OK' ? '\n\n※ Scriptable から直接実行したので、時計アプリのアラームはそのままです' : '')
  a.addAction('OK')
  await a.present()
} else if (r !== 'OK') {
  throw new Error(msg || 'チェックインできませんでした。アラームはそのままです')
} else {
  Script.setShortcutOutput('OK')
}
Script.complete()
