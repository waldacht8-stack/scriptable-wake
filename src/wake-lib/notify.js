// wake-lib/notify.js
// ローカル通知。予約は「このアプリの分を消して作り直す」方式で、ずれを残さない。
// core は呼び出し側から渡す（importModule の相対パス解決に依存しないため）

const PREFIX = 'wake-'

async function removeByPrefix(prefix) {
  const pending = await Notification.allPending()
  const ids = pending.map(n => n.identifier).filter(id => id && id.indexOf(prefix) === 0)
  if (ids.length) await Notification.removePending(ids)
}

async function schedule(id, title, body, date, openURL, actions) {
  const n = new Notification()
  n.identifier = id
  n.threadIdentifier = 'wake'
  n.title = title
  n.body = body
  if (openURL) n.openURL = openURL
  for (const a of actions || []) n.addAction(a[0], a[1])
  if (date) n.setTriggerDate(date)
  await n.schedule()
}

// 就寝リマインド（F-07）を今日から7日分予約し直す。
// アラーム準備（A-01）が動かなかった日でも通知は届き、そこからアラーム準備を実行できる（9章 信頼性）
async function rescheduleBedtime(core, data, now) {
  await removeByPrefix(PREFIX + 'bed-')
  const cfg = data.config
  let count = 0
  for (let i = 0; i < 7; i++) {
    const day = core.addDays(core.startOfDay(now), i)
    const when = core.presleepStart(cfg, day)
    if (when <= now) continue
    const wakeDay = core.wakeDayAfter(when)
    const wakeKey = core.dateKey(wakeDay)
    const prepared = data.state.plan && data.state.plan.date === wakeKey
    let body
    if (prepared && !data.state.plan.wake) {
      body = '明日はアラームなし（' + data.state.plan.reason + '）。'
    } else if (prepared || core.isWakeDay(data, wakeDay)) {
      body = '明日は ' + core.alarmsText(cfg) + '。'
      if (!prepared) body += '\nアラーム準備がまだです。この通知をタップして準備してください。'
    } else {
      body = '明日は起床しない曜日です。'
    }
    body += '\niPhone と Apple Watch の充電を忘れずに🔌'
    await schedule(PREFIX + 'bed-' + core.dateKey(day), '🌙 あと30分で就寝 ' + core.shortTime(cfg.bedtime), body, when,
      core.shortcutURL(cfg.shortcutPlan), [['アラーム準備を実行', core.shortcutURL(cfg.shortcutPlan)]])
    count++
  }
  return count
}

// 持ち物チェック（F-10）：出発の数分前
async function scheduleBelongings(core, data, now) {
  await removeByPrefix(PREFIX + 'belong-')
  const cfg = data.config
  const dep = core.dayConfig(cfg, now).departure
  if (!dep || !cfg.belongings.length) return false
  const when = core.addMinutes(core.at(now, dep), -cfg.belongingsMinutes)
  if (when <= now) return false
  await schedule(PREFIX + 'belong-' + core.dateKey(now), '🎒 出発' + cfg.belongingsMinutes + '分前：持ち物チェック',
    cfg.belongings.join('・'), when, core.appURL({ view: 'belongings' }))
  return true
}

// 週の振り返り（F-13）。ショートカットを使わず、アプリ・アラーム準備・チェックインの実行時に予約する。
// 振り返りの曜日なら、その日の指定時刻に予約（実行のたびに最新の内容で置き換える）。時刻を過ぎていればすぐ送る。
// 送った・予約した日は state.weeklySent に残す（保存は呼び出し側）
async function scheduleWeekly(core, data, now) {
  const cfg = data.config
  if (now.getDay() !== cfg.weeklyDay) return false
  const key = core.dateKey(now)
  const when = core.at(now, cfg.weeklyTime)
  if (now >= when && data.state.weeklySent === key) return false
  const body = weeklyBody(core, data, now)
  await schedule(PREFIX + 'weekly', '📊 今週の起床', body, now < when ? when : null, core.appURL({ view: 'records' }))
  data.state.weeklySent = key
  return true
}

function weeklyBody(core, data, now) {
  const list = core.recentSessions(data, now, 7)
  const ok = list.filter(core.isCheckedIn)
  const avgStage = ok.length ? (ok.reduce((n, s) => n + s.wokeStage + 1, 0) / ok.length).toFixed(1) : null
  const last = data.config.stages.length - 1
  const overslept = list.filter(s => !core.isCheckedIn(s) || s.wokeStage >= last).length
  const avg = core.average(list)
  return list.length
    ? '起床 ' + list.length + '日・平均 ' + avg + '点' + (avgStage !== null ? '・平均 段階' + avgStage : '') +
      '\n寝坊（最終段階・未チェックイン） ' + overslept + '回・連続記録 ' + core.streak(data) + '日'
    : '今週の起床記録はありません'
}

// その場で週の振り返りを送る（ショートカットの weekly 用。残してあるだけで、通常は scheduleWeekly で足りる）
async function weekly(core, data, now) {
  const body = weeklyBody(core, data, now)
  await schedule(PREFIX + 'weekly', '📊 今週の起床', body, null, core.appURL({ view: 'records' }))
  return body
}


async function now(title, body, openURL) {
  try {
    await schedule(PREFIX + 'msg-' + Date.now(), title, body, null, openURL)
  } catch (e) {
    console.error('通知できませんでした: ' + e)
  }
}

module.exports = { rescheduleBedtime, scheduleBelongings, scheduleWeekly, weekly, now }
