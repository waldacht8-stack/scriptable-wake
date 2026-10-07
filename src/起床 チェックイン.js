// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: sun;
// 起床 チェックイン.js — ショートカット「起床チェックイン」から呼ぶ（Parameter は不要）
//   ショートカットは「Run Script（起床 チェックイン）→ アラームをオフ ×4」と並べるだけ。
//   アラームが鳴っている時間帯に、ロック画面の起床ウィジェットをタップするとこのショートカットが動く。
//   チェックインできなかったとき（受付時間外・起床日でない・エラー）は、わざとエラーで止める
//   → ショートカットがそこで止まり、アラームはオフにならない（鳴る側に倒す）

const core = importModule('wake-lib/core')
const notify = importModule('wake-lib/notify')
const actions = importModule('wake-lib/actions')(core, notify)

const r = await actions.run('tap')
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
