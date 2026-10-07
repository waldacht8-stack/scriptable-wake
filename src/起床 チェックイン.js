// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: barcode;
// 起床 チェックイン.js — ショートカット「起床チェックイン」から呼ぶ
//   Parameter には「QR/バーコードをスキャン」の結果をそのまま選ぶ（文字の入力は要らない）。
//   チェックインが成功したときだけ「OK」を出力する。ショートカット側は「値があるか」で分岐し、
//   値があればアラームをオフにする。失敗・時間外・コード登録のときは何も出力しない（アラームは残る）

const core = importModule('wake-lib/core')
const notify = importModule('wake-lib/notify')
const actions = importModule('wake-lib/actions')(core, notify)

const raw = args.shortcutParameter || (args.plainTexts && args.plainTexts.length ? args.plainTexts[0] : '')
const code = String(raw === null || raw === undefined ? '' : raw).trim()
const r = await actions.run('checkin:' + code)
if (r === 'OK') Script.setShortcutOutput('OK')
Script.complete()
