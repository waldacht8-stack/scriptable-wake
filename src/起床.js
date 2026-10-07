// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: sun;
// 起床.js — 段階式目覚ましのメイン
//   アプリから実行 → ホーム画面（ルーティン・持ち物・記録・設定）
//   ショートカットから実行（パラメータで処理を切り替え。結果は「ショートカットの出力」に返す）
//     plan              → アラーム準備。出力 ON（オンにする）/ OFF（オンにしない）
//     tap               → 起床チェックイン（ウィジェットのタップから）。出力 OK（アラームをオフ）/ NG（そのまま）
//     checkin:コード    → バーコードでのチェックイン（今は使っていない）
//     nfc               → NFC タグでのチェックイン。出力は tap と同じ
//     next              → 次の起床（Siri 用）。出力 読み上げる文
//     skip・noon・weekly → 互換のため残してある。通常は不要
//       （明日だけオフはアプリの画面から、未チェックイン判定と週の振り返りは毎回の実行時に自動で行う）
//   ショートカットが必要なのは、時計アプリのアラーム操作だけ（Scriptable にその機能がないため）
//   ふだんは専用スクリプト（起床 準備・起床 チェックイン）をショートカットから呼ぶ
//   ※ 失敗したときは「アラームが鳴る側」に倒す（plan はエラーでも ON、checkin はエラーなら NG）

const core = importModule('wake-lib/core')
const notify = importModule('wake-lib/notify')
const actions = importModule('wake-lib/actions')(core, notify, importModule('wake-lib/weather'))
const { housekeeping, messageOf } = actions

// ---------- アプリ ----------

async function runApp() {
  const ui = importModule('wake-lib/ui')
  const data = await core.loadAll()
  const now = new Date()
  if (core.settleMissed(data, now)) core.saveSessions(data)
  if (!(await housekeeping(data, now))) data.problems.push('通知を予約できません（設定 > Scriptable で通知を許可してください）')
  const q = args.queryParameters || {}
  const ctx = { core, notify, data }
  // ウィジェットのタップ（朝）：今のルーティン項目を完了にしてから開く（太陽が1つ昇った画面になる）
  if (q.action === 'next') {
    const st = core.routineStatus(data, now)
    if (!st.complete) {
      core.advanceRoutine(data, now, 1)
      core.saveState(data)
    }
  }
  // 通知などから特定の画面を指定されたときは、その画面（表の画面）を開く
  const view = { routine: ui.routine, belongings: ui.belongings, records: ui.records, settings: ui.settings }[q.view]
  if (view) return await view(ctx)
  // ホーム画面：デザイン「朝焼けの地平」
  const home = importModule('wake-lib/dawn-home')(core, importModule('wake-lib/dawn'), ui, notify)
  await home.present(ctx)
}

// Run Script の「Parameter」に入れた値。「Texts」の欄に入れた場合も受け取る
const param = args.shortcutParameter || (args.plainTexts && args.plainTexts.length ? args.plainTexts[0] : null)
if (config.runsInWidget) {
  // 誤ってこのスクリプトをウィジェットに選んだとき
  const w = new ListWidget()
  w.addText('「起床ウィジェット」を選んでください')
  Script.setWidget(w)
} else if (param !== null && param !== undefined && String(param) !== '') {
  Script.setShortcutOutput(await actions.run(param))
} else if (!config.runsInApp || config.runsWithSiri) {
  Script.setShortcutOutput('NG')
} else {
  try {
    await runApp()
  } catch (e) {
    console.error(e)
    const a = new Alert()
    a.title = 'エラー'
    a.message = messageOf(e)
    a.addAction('OK')
    await a.present()
  }
}
Script.complete()
