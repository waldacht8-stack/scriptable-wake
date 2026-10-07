// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: wifi;
// 起床 NFC.js — NFC タグのオートメーションから呼ぶ（Parameter は不要）
//   チェックインが成功したときだけ「OK」を出力する。ショートカット側は「値があるか」で分岐する

const core = importModule('wake-lib/core')
const notify = importModule('wake-lib/notify')
const actions = importModule('wake-lib/actions')(core, notify)

const r = await actions.run('nfc')
if (r === 'OK') Script.setShortcutOutput('OK')
Script.complete()
