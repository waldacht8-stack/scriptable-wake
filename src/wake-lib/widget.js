// wake-lib/widget.js
// ロック画面ウィジェット（1行・長方形・円形）。時間帯で表示を切り替える（要件書 6章）。
// ウィジェットは使える時間とメモリが少ないため、ここではファイルを読むだけにする。
// カレンダー・通知・通信には触らない（既存 Todo ウィジェットが表示されない原因の候補を避ける）。

const FORCE = { todo: 'day', day: 'day', waking: 'waking', morning: 'morning', night: 'night', presleep: 'presleep' }

function text(stack, value, size, opts) {
  const o = opts || {}
  const t = stack.addText(String(value))
  t.font = o.regular ? Font.systemFont(size) : Font.boldSystemFont(size)
  t.lineLimit = o.lines || 1
  t.minimumScaleFactor = o.minScale || 0.6
  if (o.center) t.centerAlignText()
  return t
}

function timer(stack, date, size) {
  const d = stack.addDate(date)
  d.applyTimerStyle()
  d.font = Font.boldSystemFont(size)
  d.lineLimit = 1
  d.minimumScaleFactor = 0.6
  return d
}

function hstack(parent) {
  const s = parent.addStack()
  s.layoutHorizontally()
  s.centerAlignContent()
  return s
}

// iPhone 標準のアイコン（SF Symbols）付きの1行。ロック画面は単色なので、絵文字より形がはっきり出る。
// アイコンが見つからない iOS では文字だけにする
function iconLine(parent, symbol, size) {
  const s = hstack(parent)
  s.spacing = 4
  const sym = SFSymbol.named(symbol)
  if (sym) {
    const img = s.addImage(sym.image)
    img.imageSize = new Size(size, size)
  }
  return s
}

// 円形用：中央寄せの1行
function centered(parent, value, size, regular) {
  const s = hstack(parent)
  s.addSpacer()
  text(s, value, size, { regular, center: true })
  s.addSpacer()
  return s
}

function relDay(core, day, now) {
  const diff = Math.round((core.startOfDay(day) - core.startOfDay(now)) / 86400000)
  return diff === 0 ? '今日' : diff === 1 ? '明日' : core.fmtDate(day)
}

// 出発までの輪（残りの割合）。ロック画面は単色なので明るさの差だけで描く
function ring(fraction) {
  const size = 120
  const lw = 10
  const ctx = new DrawContext()
  ctx.size = new Size(size, size)
  ctx.opaque = false
  ctx.respectScreenScale = true
  const r = (size - lw) / 2
  ctx.setLineWidth(lw)
  ctx.setStrokeColor(new Color('#FFFFFF', 0.25))
  ctx.strokeEllipse(new Rect(lw / 2, lw / 2, size - lw, size - lw))
  const f = Math.max(0, Math.min(1, fraction))
  if (f > 0) {
    const pts = []
    const steps = Math.max(2, Math.round(60 * f))
    for (let i = 0; i <= steps; i++) {
      const a = -Math.PI / 2 + 2 * Math.PI * f * (i / steps)
      pts.push(new Point(size / 2 + r * Math.cos(a), size / 2 + r * Math.sin(a)))
    }
    const p = new Path()
    p.addLines(pts)
    ctx.addPath(p)
    ctx.setStrokeColor(Color.white())
    ctx.strokePath()
  }
  return ctx.getImage()
}

// ---------- 時間帯ごとの内容 ----------

function waking(core, data, now, family, w) {
  const cfg = data.config
  const idx = core.stageAt(cfg, now)
  const cur = cfg.stages[Math.max(0, idx)]
  const next = cfg.stages[idx + 1]
  if (family === 'accessoryInline') return text(w, '⏰ タップでチェックイン（段階' + (Math.max(0, idx) + 1) + '）', 13)
  if (family === 'accessoryCircular') {
    w.addAccessoryWidgetBackground = true
    w.addSpacer()
    centered(w, '段階', 10, true)
    centered(w, Math.max(0, idx) + 1, 26)
    w.addSpacer()
    return
  }
  text(iconLine(w, 'alarm.fill', 15), '段階' + (cur.index + 1) + '・' + cur.name, 15)
  text(w, next ? '次 ' + core.shortTime(next.time) + ' 段階' + (next.index + 1) : 'これが最終段階', 13, { regular: true })
  text(w, 'タップでチェックイン', 13)
}

function morning(core, data, now, family, w) {
  const st = core.routineStatus(data, now)
  const dep = st.departure
  const warn = st.lateMinutes ? '⚠ ' + st.lateMinutes + '分遅れ' : ''
  if (family === 'accessoryInline') {
    return text(w, '🚪 ' + core.fmtTime(dep) + ' 出発' + (warn ? '・' + warn : st.complete ? '・準備OK' : ''), 13)
  }
  if (family === 'accessoryCircular') {
    const s = core.sessionOf(data, now)
    const from = s && s.checkinAt ? new Date(s.checkinAt) : core.addMinutes(dep, -60)
    const total = Math.max(1, dep - from)
    w.backgroundImage = ring((dep - now) / total)
    w.addSpacer()
    centered(w, '出発', 9, true)
    const t = hstack(w)
    t.addSpacer()
    timer(t, dep, 13).centerAlignText()
    t.addSpacer()
    w.addSpacer()
    return
  }
  const l1 = iconLine(w, 'door.left.hand.open', 13)
  text(l1, '出発まで ', 13, { regular: true })
  timer(l1, dep, 16)
  if (st.complete) text(w, '✓ 出発準備OK', 14)
  else text(w, '次：' + st.current.name + '（' + st.current.minutes + '分）', 14)
  text(w, warn || (st.total ? 'ルーティン ' + st.done + '/' + st.total + (st.complete ? '' : '・残り' + st.restMinutes + '分') : ''), 13, { regular: !warn })
}

function day(core, data, now, family, w, todos) {
  if (family === 'accessoryCircular') {
    // 今朝のスコア
    w.addAccessoryWidgetBackground = true
    const s = core.sessionOf(data, now)
    w.addSpacer()
    centered(w, s ? s.score : '−', 24)
    centered(w, s ? '今朝の点' : '記録なし', 9, true)
    w.addSpacer()
    return
  }
  if (!todos.ok) return text(w, family === 'accessoryInline' ? '✅ Todoを読み込めません' : 'Todoを読み込めません', 13)
  const items = todos.items
  if (family === 'accessoryInline') return text(w, '✅ Todo 残り' + items.length + '件', 13)
  if (!items.length) {
    text(w, '✅ Todo', 13, { regular: true })
    text(w, '未完了はありません', 15)
    return
  }
  // 単色なので、期限切れは「!」、それ以外は「・」で区別する
  for (const t of items.slice(0, 3)) {
    const due = core.fmtDue(t, now)
    text(w, (core.isOverdue(t, now) ? '! ' : '・') + t.title + (due ? '  ' + due : ''), 14, { regular: !core.isOverdue(t, now), minScale: 0.8 })
  }
}

function night(core, data, now, family, w, todos, ph) {
  const cfg = data.config
  let bed = ph.phase === 'night' ? core.addMinutes(ph.until, 30) : core.bedtimeAt(cfg, core.startOfDay(now))
  if (bed <= now) bed = core.addDays(bed, 1)
  if (family === 'accessoryInline') return text(w, '🌙 ' + core.shortTime(cfg.bedtime) + ' 就寝', 13)
  if (family === 'accessoryCircular') {
    w.addAccessoryWidgetBackground = true
    w.addSpacer()
    centered(w, todos.ok ? todos.items.length : '?', 24)
    centered(w, 'Todo', 9, true)
    w.addSpacer()
    return
  }
  const l1 = iconLine(w, 'moon.zzz.fill', 13)
  text(l1, '就寝まで ', 13, { regular: true })
  timer(l1, bed, 16)
  const tomorrow = core.wakeDayAfter(now)
  const label = relDay(core, tomorrow, now)
  text(w, core.isWakeDay(data, tomorrow)
    ? label + ' ' + core.alarmsText(cfg)
    : label + 'はアラームなし', 14)
  const first = todos.ok ? core.firstTodoOn(todos.items, tomorrow) : null
  text(w, first ? label + '：' + first.title : todos.ok ? '明日の予定なし' : 'Todoを読み込めません', 13, { regular: true })
}

function presleep(core, data, now, family, w) {
  const cfg = data.config
  const nw = core.nextWake(data, now)
  const target = core.wakeDayAfter(now)
  const soon = nw && core.startOfDay(nw.day).getTime() === target.getTime()
  if (family === 'accessoryCircular') {
    // 今週の平均スコア
    w.addAccessoryWidgetBackground = true
    const avg = core.average(core.recentSessions(data, now, 7))
    w.addSpacer()
    centered(w, avg === null ? '−' : avg, 22)
    centered(w, '週平均', 9, true)
    w.addSpacer()
    return
  }
  const wakeAt = soon ? core.at(nw.day, core.wakeTime(cfg)) : null
  const head = soon ? '⏰ ' + relDay(core, nw.day, now) + ' ' + core.fmtTime(wakeAt) + ' 起床' : '⏰ ' + relDay(core, target, now) + 'はアラームなし'
  if (family === 'accessoryInline') return text(w, head, 13)
  text(iconLine(w, 'alarm', 15), head.replace('⏰ ', ''), 15)
  if (soon) {
    text(w, 'アラーム' + cfg.stages.length + 'つ（' + core.shortTime(cfg.stages[cfg.stages.length - 1].time) + 'まで）', 13, { regular: true })
    text(w, '今寝ると ' + core.fmtDuration(nw.start - now), 13, { regular: true })
  } else if (nw) {
    text(w, '次の起床 ' + core.fmtDate(nw.day) + ' ' + core.shortTime(core.wakeTime(cfg)), 13, { regular: true })
  }
}

// ---------- 組み立て ----------

async function build(core, data, family, now, param) {
  const f = family || 'accessoryRectangular'
  const forced = FORCE[String(param || '').trim().toLowerCase()]
  const ph = core.phaseAt(data, now)
  let phase = forced || ph.phase
  // 固定表示でも、朝・起床中の表示は条件がそろわないと描けないので昼間に戻す
  if (phase === 'morning' && !core.dayConfig(data.config, now).departure) phase = 'day'

  const w = new ListWidget()
  w.refreshAfterDate = new Date(Math.min(ph.until.getTime() + 1000, now.getTime() + 15 * 60000))
  // タップで開く画面
  const todoApp = 'scriptable:///run/' + encodeURIComponent('TODO')
  // 起床中（と、アラーム前に自分で起きたとき）はタップでチェックイン（ショートカットが残りのアラームをオフにする）
  w.url = phase === 'waking' || core.canCheckin(data, now) ? core.shortcutURL('起床チェックイン') : phase === 'day' ? todoApp : phase === 'morning' ? core.appURL({ action: 'next' }) : core.appURL({ view: 'home' })

  const needTodos = (phase === 'day' && f !== 'accessoryCircular') || phase === 'night'
  const todos = needTodos ? await core.loadTodos(data.config) : { ok: false, items: [] }

  const fn = { waking, morning, day, night, presleep }[phase]
  fn(core, data, now, f, w, todos, ph)
  return w
}

function buildError(message) {
  const w = new ListWidget()
  w.refreshAfterDate = new Date(Date.now() + 15 * 60000)
  text(w, '起床：エラー', 13)
  text(w, message, 11, { regular: true, lines: 2 })
  return w
}

module.exports = { build, buildError }
