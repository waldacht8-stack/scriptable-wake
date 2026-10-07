// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: wifi;
// 起床 NFC.js — NFC タグのオートメーションから呼ぶ（Parameter は不要）
//   オートメーションは「Run Script（起床 NFC）→ アラームをオフ ×4」と並べるだけ。
//   チェックインできなかったときは、わざとエラーで止める（アラームはオフにならない）

const core = importModule('wake-lib/core')
const notify = importModule('wake-lib/notify')
const actions = importModule('wake-lib/actions')(core, notify)

const r = await actions.run('nfc')
if (r !== 'OK') throw new Error(actions.lastMessage() || 'チェックインできませんでした。アラームはそのままです')
Script.setShortcutOutput('OK')
Script.complete()
