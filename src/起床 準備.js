// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: bell;
// 起床 準備.js — ショートカット「アラーム準備」から呼ぶ（Parameter は不要）
//   明日アラームを鳴らす日なら「ON」を出力し、鳴らさない日は何も出力しない。
//   ショートカット側は「Run Script に値があるか」で分岐するだけでよい（文字の入力が要らない）

const core = importModule('wake-lib/core')
const notify = importModule('wake-lib/notify')
const actions = importModule('wake-lib/actions')(core, notify)

const r = await actions.run('plan')
if (r === 'ON') Script.setShortcutOutput('ON')
if (config.runsInApp && !config.runsWithSiri) {
  const a = new Alert()
  a.title = r === 'ON' ? '⏰ アラームをオンにする日です' : '💤 アラームはオンにしません'
  a.message = 'ショートカット「アラーム準備」から実行すると、時計アプリのアラームが切り替わります'
  a.addAction('OK')
  await a.present()
}
Script.complete()
