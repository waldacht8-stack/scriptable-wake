// wake-lib/actions.js
// ショートカットから呼ばれる処理（アラーム準備・チェックインなど）。起床.js と、
// 文字入力なしで使える専用スクリプト（起床 準備.js・起床 チェックイン.js・起床 NFC.js）が共通で使う。
// core・notify は呼び出し側から渡す（importModule の相対パス解決に依存しないため）
//   使い方：const actions = importModule('wake-lib/actions')(core, notify, importModule('wake-lib/weather'))
//   （weather は省略可。省略すると天気を取らない）
//   ※ 失敗したときは「アラームが鳴る側」に倒す（plan はエラーでも ON、checkin はエラーなら NG）

module.exports = function (core, notify, weather) {

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


  // 直前の処理の結果の文（専用スクリプトがエラー文や画面に使う）
  let last = ''

  async function plan(data, now) {
    if (core.settleMissed(data, now)) core.saveSessions(data)
    const d = await core.decidePlan(data, now)
    data.state.plan = d
    core.saveState(data)
    await housekeeping(data, now)
    last = d.reason
    await notify.now(d.wake ? '⏰ アラームをオンにしました' : '💤 アラームはオンにしません', d.reason)
    return d.wake ? 'ON' : 'OFF'
  }

  // チェックイン後の知らせに足す行：天気（F-17）・今日やること（F-18）・自分ルール（F-20）。
  // どれが失敗してもチェックインは止めない
  async function morningExtras(data, now, session) {
    const cfg = data.config
    const lines = []
    try {
      if (weather) {
        const w = await weather.today(cfg)
        if (w) {
          data.state.weather = { date: core.dateKey(now), text: w }
          core.saveState(data)
          lines.push('天気：' + w)
        }
      }
    } catch (e) {
      console.warn('天気: ' + e)
    }
    const tasks = core.tasksFor(data, now)
    if (tasks.length) lines.push('今日やること：' + tasks.join('・'))
    if (cfg.ownRule && core.overslept(cfg, session)) lines.push('自分ルール：' + cfg.ownRule)
    return lines.length ? '\n' + lines.join('\n') : ''
  }

  async function doCheckin(data, now, code, method) {
    const r = core.checkin(data, now, code, method)
    if (r.result === 'register') {
      if (!code) {
        last = 'コードが読み取れませんでした。アラームはそのままです'
        await notify.now('チェックインできません', 'コードが読み取れませんでした。アラームはそのままです')
        return 'NG'
      }
      data.config.checkinCode = code
      core.saveConfig(data)
      last = 'コードを登録しました（' + code + '）。明日からこのコードでチェックインできます。アラームはそのままです'
      await notify.now('✅ コードを登録しました', code + '\n明日からこのコードでチェックインできます。アラームはそのままです')
      return 'REGISTERED'
    }
    if (r.result === 'mismatch' || r.result === 'closed') {
      last = r.message
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
      r.message += await morningExtras(data, now, r.session)
    }
    last = r.message
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
      if (cmd === 'tap') return await doCheckin(data, now, '', 'widget')
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
        last = 'エラー（' + messageOf(e) + '）。念のため' + (on ? 'アラームをオンにします' : '曜日の設定どおりオンにしません')
        await notify.now('起床：アラーム準備でエラー', messageOf(e) + '\n念のため' + (on ? 'アラームをオンにします' : '曜日の設定どおりオンにしません'))
        return on ? 'ON' : 'OFF'
      }
      last = 'エラー（' + messageOf(e) + '）。アラームはそのままです'
      await notify.now('起床：エラー', messageOf(e) + (cmd === 'checkin' || cmd === 'nfc' ? '\nアラームはそのままです' : ''))
      return 'NG'
    }
  }

  return { run: runShortcut, housekeeping, messageOf, lastMessage: () => last }
}
