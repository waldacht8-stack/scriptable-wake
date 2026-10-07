// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: sun;
// 起床.js — 段階式目覚ましのメイン
//   アプリから実行 → ホーム画面（ルーティン・持ち物・記録・設定）
//   ショートカットから実行（パラメータで処理を切り替え。結果は「ショートカットの出力」に返す）
//     plan              → アラーム準備。出力 ON（オンにする）/ OFF（オンにしない）
//     checkin:コード    → 起床チェックイン。出力 OK（アラームをオフ）/ NG（そのまま）/ REGISTERED（コードを登録）
//     nfc               → NFC タグでのチェックイン。出力は checkin と同じ
//     next              → 次の起床（Siri 用）。出力 読み上げる文
//     skip・noon・weekly → 互換のため残してある。通常は不要
//       （明日だけオフはアプリの画面から、未チェックイン判定と週の振り返りは毎回の実行時に自動で行う）
//   ショートカットが必要なのは、時計アプリのアラーム操作とバーコードの読み取りだけ（Scriptable にその機能がないため）
//   ※ 失敗したときは「アラームが鳴る側」に倒す（plan はエラーでも ON、checkin はエラーなら NG）

const core = importModule('wake-lib/core')
const notify = importModule('wake-lib/notify')

function messageOf(e) {
  return e && e.message ? e.message : String(e)
}

// ---------- ショートカットからの処理 ----------

// 実行のたびに行う後片付け：就寝リマインドと週の振り返りの予約。失敗しても本来の処理は止めない
async function housekeeping(data, now) {
  try {
    await notify.rescheduleBedtime(core, data, now)
  } catch (e) {
    console.error('就寝リマインドを予約できませんでした: ' + e)
    return false
  }
  try {
    if (await notify.scheduleWeekly(core, data, now)) core.saveState(data)
  } catch (e) {
    console.error('週の振り返りを予約できませんでした: ' + e)
  }
  return true
}


async function plan(data, now) {
  if (core.settleMissed(data, now)) core.saveSessions(data)
  const d = await core.decidePlan(data, now)
  data.state.plan = d
  core.saveState(data)
  await housekeeping(data, now)
  await notify.now(d.wake ? '⏰ アラームをオンにしました' : '💤 アラームはオンにしません', d.reason)
  return d.wake ? 'ON' : 'OFF'
}

async function doCheckin(data, now, code, method) {
  const r = core.checkin(data, now, code, method)
  if (r.result === 'register') {
    if (!code) {
      await notify.now('チェックインできません', 'コードが読み取れませんでした。アラームはそのままです')
      return 'NG'
    }
    data.config.checkinCode = code
    core.saveConfig(data)
    await notify.now('✅ コードを登録しました', code + '\n明日からこのコードでチェックインできます。アラームはそのままです')
    return 'REGISTERED'
  }
  if (r.result === 'mismatch' || r.result === 'closed') {
    await notify.now('チェックインできません', r.message)
    return 'NG'
  }
  if (r.result === 'ok') {
    // 記録を先に保存し、保存できてから OK を返す（失敗すれば例外 → NG でアラームは残る）
    core.saveSessions(data)
    core.saveState(data)
    try {
      await notify.scheduleBelongings(core, data, now)
    } catch (e) {
      console.error('持ち物の通知を予約できませんでした: ' + e)
    }
    await housekeeping(data, now)
  }
  await notify.now('☀️ おはようございます', r.message, core.appURL({ view: 'home' }))
  return 'OK'
}

async function skip(data, now) {
  const day = core.planTargetDay(data.config, now)
  const key = core.dateKey(day)
  if (data.state.skipDates.indexOf(key) < 0) data.state.skipDates.push(key)
  const reason = core.dayLabel(day, now) + 'は「お休み」に設定されています'
  data.state.plan = { date: key, wake: false, reason }
  core.saveState(data)
  await notify.rescheduleBedtime(core, data, now)
  await notify.now('💤 ' + core.dayLabel(day, now) + 'はお休み', 'アラームをオフにします。取り消しは「起床」アプリのホーム画面から')
  return 'OFF'
}

function nextText(data, now) {
  const nw = core.nextWake(data, now)
  if (!nw) return '2週間以内に起床の予定はありません'
  const cfg = data.config
  const t = core.at(nw.day, core.wakeTime(cfg))
  return '次の起床は ' + core.dayLabel(nw.day, now) + ' ' + t.getHours() + '時' + (t.getMinutes() ? t.getMinutes() + '分' : '') +
    '、アラーム' + cfg.stages.length + 'つです'
}

async function runShortcut(param) {
  const now = new Date()
  const p = String(param || '').trim()
  const cmd = p.split(':')[0].toLowerCase()
  let data = null
  try {
    data = await core.loadAll()
    if (cmd === 'plan') return await plan(data, now)
    if (cmd === 'checkin') return await doCheckin(data, now, p.slice(p.indexOf(':') + 1).trim(), 'barcode')
    if (cmd === 'nfc') return await doCheckin(data, now, '', 'nfc')
    if (cmd === 'skip') return await skip(data, now)
    if (cmd === 'noon') {
      const n = core.settleMissed(data, now)
      if (n) core.saveSessions(data)
      return 'OK'
    }
    if (cmd === 'weekly') return await notify.weekly(core, data, now)
    if (cmd === 'next') return nextText(data, now)
    await notify.now('起床：パラメータが違います', '「' + p + '」は使えません。plan / checkin:コード / nfc / next のどれかです')
    return 'NG'
  } catch (e) {
    console.error(e)
    // 鳴る側に倒す：準備の失敗はオン、チェックインの失敗はアラームを残す
    if (cmd === 'plan') {
      let on = true
      try { on = data ? core.isRuleWakeDay(data.config, core.planTargetDay(data.config, now)) : true } catch (e2) { on = true }
      await notify.now('起床：アラーム準備でエラー', messageOf(e) + '\n念のため' + (on ? 'アラームをオンにします' : '曜日の設定どおりオンにしません'))
      return on ? 'ON' : 'OFF'
    }
    await notify.now('起床：エラー', messageOf(e) + (cmd === 'checkin' || cmd === 'nfc' ? '\nアラームはそのままです' : ''))
    return 'NG'
  }
}

// ---------- アプリ ----------

async function runApp() {
  const ui = importModule('wake-lib/ui')
  const data = await core.loadAll()
  const now = new Date()
  if (core.settleMissed(data, now)) core.saveSessions(data)
  if (!(await housekeeping(data, now))) data.problems.push('通知を予約できません（設定 > Scriptable で通知を許可してください）')
  const q = args.queryParameters || {}
  const ctx = { core, notify, data }
  // ウィジェットのタップ（朝）：今のルーティン項目を完了にしてから開く
  if (q.action === 'next') {
    const st = core.routineStatus(data, now)
    if (!st.complete) {
      core.advanceRoutine(data, now, 1)
      core.saveState(data)
    }
    return await ui.routine(ctx)
  }
  const view = { routine: ui.routine, belongings: ui.belongings, records: ui.records, settings: ui.settings }[q.view]
  if (view) return await view(ctx)
  await ui.home(ctx)
}

// Run Script の「Parameter」に入れた値。「Texts」の欄に入れた場合も受け取る
const param = args.shortcutParameter || (args.plainTexts && args.plainTexts.length ? args.plainTexts[0] : null)
if (config.runsInWidget) {
  // 誤ってこのスクリプトをウィジェットに選んだとき
  const w = new ListWidget()
  w.addText('「起床ウィジェット」を選んでください')
  Script.setWidget(w)
} else if (param !== null && param !== undefined && String(param) !== '') {
  Script.setShortcutOutput(await runShortcut(param))
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
