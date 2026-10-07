// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-purple; icon-glyph: sun;
// 起床 夜明け.js — ホーム画面（デザイン案D「朝焼けの地平」）の試作。
//   今の「起床」と同じデータを使い、見た目だけが違う。設定・記録などは今の画面が開く。
//   ウィジェットのタップ（?action=next）で開いたときは、ルーティンを1つ進めてから表示する。

const core = importModule('wake-lib/core')
const notify = importModule('wake-lib/notify')
const ui = importModule('wake-lib/ui')
const dawn = importModule('wake-lib/dawn')
const home = importModule('wake-lib/dawn-home')(core, dawn, ui, notify)

try {
  const data = await core.loadAll()
  const now = new Date()
  if (core.settleMissed(data, now)) core.saveSessions(data)
  try {
    await notify.rescheduleBedtime(core, data, now)
  } catch (e) {
    data.problems.push('通知を予約できません（設定 > Scriptable で通知を許可してください）')
  }
  const q = args.queryParameters || {}
  if (q.action === 'next' && !core.routineStatus(data, now).complete) {
    core.advanceRoutine(data, now, 1)
    core.saveState(data)
  }
  await home.present({ core, notify, data })
} catch (e) {
  console.error(e)
  const a = new Alert()
  a.title = 'エラー'
  a.message = e && e.message ? e.message : String(e)
  a.addAction('OK')
  await a.present()
}
Script.complete()
