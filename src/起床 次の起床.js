// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: question-circle;
// 起床 次の起床.js — Siri 用。「次の起床は 明日10/9（金） 7時、アラーム4つです」のような文を返す（Parameter は不要）
//   ショートカット「次の起床は」は「Run Script（起床 次の起床）→ 結果を表示」と並べるだけ。
//   「Hey Siri、次の起床は」で、Siri が結果を読み上げる

const core = importModule('wake-lib/core')
const notify = importModule('wake-lib/notify')
const actions = importModule('wake-lib/actions')(core, notify)

const text = await actions.run('next')
if (config.runsInApp && !config.runsWithSiri) {
  const a = new Alert()
  a.title = '次の起床'
  a.message = text
  a.addAction('OK')
  await a.present()
} else {
  Script.setShortcutOutput(text)
}
Script.complete()
