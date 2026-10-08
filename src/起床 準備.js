// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: bell;
// 起床 準備.js — ショートカット「アラーム準備」から呼ぶ（Parameter は不要）
//   ショートカットは「Run Script（起床 準備）→ アラームをオン ×4」と並べるだけ（if文は使わない）。
//   明日アラームを鳴らさない日は、わざとエラーで止める → ショートカットがそこで止まり、アラームはオンにならない。
//   エラーの文（「明日は起床しない曜日です」など）がそのまま利用者への知らせになる。
//   スクリプト自体の不具合などで判断できないときは止めない（鳴る側に倒す）

// 動作の記録（読み込めなくても本来の処理は止めない）
let log = { write() {} }
try { log = importModule('wake-lib/log') } catch (e) { /* 記録なしで続ける */ }
const core = importModule('wake-lib/core')
const notify = importModule('wake-lib/notify')
const actions = importModule('wake-lib/actions')(core, notify)

const r = await actions.run('plan')
const msg = actions.lastMessage()
log.write('アラーム準備（' + (config.runsInApp ? 'アプリから' : 'ショートカットから') + '）: ' + r + ' ' + msg)
if (config.runsInApp && !config.runsWithSiri) {
  // Scriptable で直接実行したとき：判断だけ見せる
  const a = new Alert()
  a.title = r === 'ON' ? '⏰ アラームをオンにする日です' : '💤 アラームはオンにしません'
  a.message = msg + '\n\nショートカット「アラーム準備」から実行すると、時計アプリのアラームが切り替わります'
  a.addAction('OK')
  await a.present()
} else if (r !== 'ON') {
  throw new Error('アラームはオンにしません：' + msg)
} else {
  Script.setShortcutOutput('ON')
}
Script.complete()
