// wake-lib/dawn-widget.js
// ロック画面ウィジェット。設定のデザイン（朝・昼用と夜用）で描く。
// 地平線の上を太陽が進み（駅の発車標は停車駅の線路）、デザインの書体と言い回しで知らせる。
// 描画はファイルを読むだけ（通信・通知なし）。
//   長方形：1行目＝見出しと時刻（または残り時間のタイマー）、2行目＝地平線の絵、3行目＝次のこと
//   円形  ：地平線から昇る太陽（夜は三日月）と、短い文字
//   1行   ：短い文（1行の枠は iPhone 標準の文字になる）

const FORCE = { todo: 'day', day: 'day', waking: 'waking', morning: 'morning', night: 'night', presleep: 'presleep' }
const RECT_W = 156
const RECT_IMG_H = 20

module.exports = function (core, dawn) {

  // 今描いているデザイン（build のたびに設定から決める）
  let T = 'dawn'
  const W = () => dawn.theme(T).words
  const N = n => dawn.num(T, n)

  function text(stack, value, size, opts) {
    const o = opts || {}
    const t = stack.addText(String(value))
    t.font = o.system ? Font.semiboldSystemFont(size) : dawn.font(size, o.light, T)
    t.lineLimit = 1
    t.minimumScaleFactor = o.minScale || 0.7
    if (o.center) t.centerAlignText()
    if (o.opacity !== undefined) t.textOpacity = o.opacity
    return t
  }

  function timer(stack, date, size, center) {
    const d = stack.addDate(date)
    d.applyTimerStyle()
    d.font = dawn.font(size, false, T)
    d.lineLimit = 1
    d.minimumScaleFactor = 0.6
    if (center) d.centerAlignText()
    else d.rightAlignText()
    return d
  }

  function hstack(parent) {
    const s = parent.addStack()
    s.layoutHorizontally()
    s.centerAlignContent()
    return s
  }

  function centered(parent, fn) {
    const s = hstack(parent)
    s.addSpacer()
    fn(s)
    s.addSpacer()
    return s
  }

  // 1行目：左に見出し、右に時刻やタイマー
  // 見出しは小さく控えめに、右の値（時刻・タイマー）は大きく
  function headline(w, left, right) {
    const s = hstack(w)
    text(s, left, 11, { light: true, opacity: 0.75 })
    s.addSpacer()
    if (right instanceof Date) timer(s, right, 17)
    else if (right) text(s, right, 15)
    return s
  }

  function picture(parent, img, wPt, hPt) {
    const i = parent.addImage(img)
    i.imageSize = new Size(wPt, hPt)
    return i
  }

  function horizonRow(w, kind, p, stops, list) {
    w.addSpacer(3)
    const img = stops && dawn.theme(T).track ? dawn.track(RECT_W, RECT_IMG_H, stops, p) : dawn.horizon(RECT_W, RECT_IMG_H, kind, p, list)
    picture(w, img, RECT_W, RECT_IMG_H)
    w.addSpacer(3)
  }

  function circle(w, kind, p, under) {
    w.addAccessoryWidgetBackground = true
    w.addSpacer()
    centered(w, s => picture(s, dawn.rise(50, 28, kind, p), 50, 28))
    w.addSpacer(1)
    centered(w, s => under(s))
    w.addSpacer()
  }

  const clamp = x => Math.max(0, Math.min(1, x))

  // 今日・明日（それ以外は 10/12（月））
  function rel(day, now) {
    const diff = Math.round((core.startOfDay(day) - core.startOfDay(now)) / 86400000)
    return diff === 0 ? '今日' : diff === 1 ? '明日' : core.fmtDate(day)
  }

  // ---------- 時間帯ごと ----------

  function waking(data, now, f, w) {
    const cfg = data.config
    const idx = Math.max(0, core.stageAt(cfg, now))
    const first = core.at(now, cfg.stages[0].time)
    const last = core.at(now, cfg.stages[cfg.stages.length - 1].time)
    const p = clamp((now - first) / Math.max(60000, last - first))
    // 最後のアラームから5分以上たっても未チェックインなら、そのことを出す
    const after = now - last > 5 * 60000
    // 地平線の上の点＝それぞれのアラームの時刻（鳴ったものは塗る）
    const span = Math.max(60000, last - first)
    const list = cfg.stages.map(s => ({ at: (core.at(now, s.time) - first) / span, done: core.at(now, s.time) <= now }))
    if (f === 'accessoryInline') return text(w, (after ? '未チェックイン' : W().wake) + ' ・ ' + W().tap, 13, { system: true })
    if (f === 'accessoryCircular') return circle(w, 'sun', 0.05 + 0.25 * p, s => text(s, after ? '起きた？' : '段階' + N(idx + 1), 12, { center: true }))
    headline(w, after ? '未チェックイン' : W().wake, after ? core.shortTime(data.config.noon) + 'まで' : '段階' + N(idx + 1))
    horizonRow(w, 'dawn', p, 0, list)
    text(w, W().tap, 15, { minScale: 0.8 })
  }

  function morning(data, now, f, w) {
    const st = core.routineStatus(data, now)
    const dep = st.departure
    const s = core.sessionOf(data, now)
    const from = s && s.checkinAt ? new Date(s.checkinAt) : core.addMinutes(dep, -60)
    const p = clamp((now - from) / Math.max(60000, dep - from))
    const warn = st.lateMinutes ? N(st.lateMinutes) + '分' + W().late : ''
    if (f === 'accessoryInline') {
      return text(w, core.fmtTime(dep) + '発 ・ ' + (warn || (st.complete ? W().done : '次 ' + st.current.name)), 13, { system: true })
    }
    if (f === 'accessoryCircular') return circle(w, 'sun', p, c => timer(c, dep, 13, true))
    // 地平線の上の点＝ルーティンの予定の区切り（起床からの所要時間を積み上げた位置）。済んだ項目は塗る。
    // 太陽が点より先に進んでいれば、予定より遅れている
    const span = Math.max(60000, dep - from)
    let acc = 0
    const list = data.config.routine.map((r, i) => { acc += r.minutes; return { at: acc * 60000 / span, done: i < st.done } })
    headline(w, warn ? '⚠ ' + warn : W().depart, dep)
    horizonRow(w, 'sun', p, st.total + 1, list)
    if (st.complete) text(w, W().done + ' ・ ' + dawn.timeText(T, dep) + '発', 15, { minScale: 0.8 })
    else text(w, '次 ' + st.current.name + '　' + N(st.current.minutes) + '分', 15, { minScale: 0.8 })
  }

  function day(data, now, f, w, todos) {
    if (f === 'accessoryCircular') {
      const s = core.sessionOf(data, now)
      return circle(w, 'sun', 1, c => text(c, s ? s.score + '点' : '−', 13, { center: true }))
    }
    if (!todos.ok) return text(w, 'Todoを読み込めません', 13, { system: f === 'accessoryInline' })
    const items = todos.items
    if (f === 'accessoryInline') return text(w, W().today + ' 残り' + items.length + '件', 13, { system: true })
    headline(w, W().today, '残り' + items.length + '件')
    if (!items.length) return text(w, 'すべて済みました', 15)
    // 単色なので、期限切れは「！」で区別する
    for (const t of items.slice(0, 2)) {
      const due = core.fmtDue(t, now)
      text(w, (core.isOverdue(t, now) ? '！' : '・') + t.title + (due ? '　' + due : ''), 15, { minScale: 0.75 })
    }
  }

  function night(data, now, f, w, todos, ph) {
    const cfg = data.config
    let bed = ph.phase === 'night' ? core.addMinutes(ph.until, 30) : core.bedtimeAt(cfg, core.startOfDay(now))
    if (bed <= now) bed = core.addDays(bed, 1)
    const tomorrow = core.wakeDayAfter(now)
    const wake = core.isWakeDay(data, tomorrow)
    const label = rel(tomorrow, now)
    if (f === 'accessoryInline') return text(w, core.shortTime(cfg.bedtime) + ' 就寝 ・ ' + (wake ? label + ' ' + core.shortTime(core.wakeTime(cfg)) + ' 起床' : label + 'はアラームなし'), 13, { system: true })
    if (f === 'accessoryCircular') return circle(w, 'moon', 0, c => text(c, core.shortTime(cfg.bedtime), 13, { center: true }))
    headline(w, W().bed, bed)
    horizonRow(w, 'night', 0)
    text(w, wake ? label + ' ' + dawn.timeText(T, core.at(tomorrow, core.wakeTime(cfg))) + 'に起床' : label + 'はアラームなし', 15, { minScale: 0.8 })
  }

  function presleep(data, now, f, w) {
    const cfg = data.config
    const nw = core.nextWake(data, now)
    const target = core.wakeDayAfter(now)
    const soon = nw && core.startOfDay(nw.day).getTime() === target.getTime()
    const label = rel(target, now)
    const sleepMin = soon ? (nw.start - now) / 60000 : 0
    if (f === 'accessoryInline') return text(w, soon ? label + ' ' + core.shortTime(core.wakeTime(cfg)) + ' 起床' : label + 'はアラームなし', 13, { system: true })
    if (f === 'accessoryCircular') {
      return circle(w, 'moon', 0, c => text(c, soon ? Math.floor(sleepMin / 60) + '時間' : '休み', 12, { center: true }))
    }
    headline(w, label + 'の朝', soon ? core.shortTime(core.wakeTime(cfg)) : 'アラームなし')
    horizonRow(w, 'stars', 0)
    if (soon) text(w, '今眠ると ' + dawn.minutesText(T, sleepMin), 15, { minScale: 0.8 })
    else text(w, nw ? '次の起床 ' + core.fmtDate(nw.day) : 'ゆっくり眠れます', 15)
  }

  // ---------- 組み立て ----------

  async function build(data, family, now, param) {
    const f = family || 'accessoryRectangular'
    const forced = FORCE[String(param || '').trim().toLowerCase()]
    const ph = core.phaseAt(data, now)
    let phase = forced || ph.phase
    if (phase === 'morning' && !core.dayConfig(data.config, now).departure) phase = 'day'
    // 朝・昼と夜でデザインを変える
    T = dawn.themeFor(data.config, phase)

    const w = new ListWidget()
    // 太陽が動いて見えるよう、朝と起床中はこまめに更新を頼む（実際の間隔は iOS が決める）
    const often = phase === 'morning' || phase === 'waking' ? 5 : 15
    w.refreshAfterDate = new Date(Math.min(ph.until.getTime() + 1000, now.getTime() + often * 60000))
    const todoApp = 'scriptable:///run/' + encodeURIComponent('TODO')
    const canCheckin = core.canCheckin ? core.canCheckin(data, now) : false
    w.url = phase === 'waking' || canCheckin ? core.shortcutURL('起床チェックイン')
      : phase === 'day' ? todoApp
        : phase === 'morning' ? core.appURL({ action: 'next' }) : core.appURL({ view: 'home' })

    const needTodos = (phase === 'day' && f !== 'accessoryCircular') || false
    const todos = needTodos ? await core.loadTodos(data.config) : { ok: false, items: [] }
    const fn = { waking, morning, day, night, presleep }[phase]
    fn(data, now, f, w, todos, ph)
    return w
  }

  function buildError(message) {
    const w = new ListWidget()
    w.refreshAfterDate = new Date(Date.now() + 15 * 60000)
    text(w, '起床：エラー', 13, { system: true })
    const t = w.addText(message)
    t.font = Font.systemFont(11)
    t.lineLimit = 2
    return w
  }

  return { build, buildError }
}
