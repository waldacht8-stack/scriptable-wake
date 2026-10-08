// wake-lib/ui.js
// 画面（UITable と Alert）。ホーム・ルーティン・持ち物・記録・設定・動作確認。
// ctx = { core, notify, data } を受け取る（importModule の相対パス解決に依存しないため）

// ---------- 部品 ----------

// デザインごとの色と書体（ホーム画面・ロック画面と同じデザインに合わせる）
const STYLES = {
  dawn: { bg: '#FBEFE3', ink: '#2B2433', muted: '#6B5F70', accent: '#B4482E', card: '#F3E0CC', head: '#EFDCC8', warn: '#B4482E', font: ['HiraMinProN-W6', 'HiraMinProN-W3'] },
  kissa: { bg: '#EFE2CC', ink: '#3A2A1E', muted: '#7A6450', accent: '#B23A24', card: '#E3CFAF', head: '#E6D3B4', warn: '#B23A24', font: ['HiraMaruProN-W4', 'HiraMaruProN-W4'] },
  station: { bg: '#0B0B0C', ink: '#F5F5F5', muted: '#9A9A9A', accent: '#FFB300', card: '#1C1C21', head: '#141416', warn: '#FF6B5E', font: ['HiraginoSans-W6', 'HiraginoSans-W3'] },
  sora: { bg: '#FFFFFF', ink: '#1E2B3C', muted: '#62728A', accent: '#2F6FEB', card: '#EAF2FC', head: '#F2F7FD', warn: '#C2410C', font: ['HiraginoSans-W6', 'HiraginoSans-W3'] },
}
// 夜（夜・就寝前）の色。書体は同じで、色だけ夜にする
const STYLES_NIGHT = {
  dawn: { bg: '#11152A', ink: '#E9E6F2', muted: '#9B98B5', accent: '#F2B880', card: '#1B2040', head: '#161B36', warn: '#F2B880' },
  kissa: { bg: '#231914', ink: '#F1E4D0', muted: '#B9A48C', accent: '#E9A066', card: '#2E221B', head: '#2A1F18', warn: '#E9A066' },
  station: { bg: '#06080F', ink: '#F5F5F5', muted: '#9A9A9A', accent: '#FFB300', card: '#141A2A', head: '#0B0F1C', warn: '#FF6B5E' },
  sora: { bg: '#152034', ink: '#EAF0F8', muted: '#9FB0C8', accent: '#8FB8FF', card: '#1E2B44', head: '#1A263D', warn: '#FFC9A8' },
}
let S = STYLES.dawn
const C = {}

// 画面を開くたびに、設定のデザインを読み直す
function useTheme(ctx) {
  let name = 'dawn'
  let night = false
  try {
    // 朝・昼と夜でデザインを変える（ホーム画面・ロック画面と同じ）
    const cfg = ctx.data.config
    const ph = ctx.core.phaseAt(ctx.data, new Date()).phase
    night = ph === 'night' || ph === 'presleep'
    name = night ? (cfg.themeNight || cfg.theme) : cfg.theme
  } catch (e) { /* 決められなければ標準 */ }
  const base = STYLES[name] || STYLES.dawn
  S = night ? Object.assign({}, base, STYLES_NIGHT[name] || STYLES_NIGHT.dawn) : base
  C.accent = new Color(S.accent)
  C.warn = new Color(S.warn)
  C.sub = new Color(S.muted)
  C.card = new Color(S.card)
  C.ink = new Color(S.ink)
  C.bg = new Color(S.bg)
  C.head = new Color(S.head)
}
useTheme(null)

function fnt(size, bold) {
  try {
    return new Font(bold ? S.font[0] : S.font[1], size)
  } catch (e) {
    return bold ? Font.boldSystemFont(size) : Font.systemFont(size)
  }
}

function row(table, title, subtitle, opts) {
  const o = opts || {}
  const r = new UITableRow()
  r.height = o.height || (subtitle ? 60 : 44)
  r.isHeader = !!o.header
  r.dismissOnSelect = false
  r.backgroundColor = o.bg || (o.header ? C.head : C.bg)
  const c = r.addText(String(title), subtitle ? String(subtitle) : undefined)
  c.titleFont = o.big ? fnt(o.big, true) : o.small ? fnt(o.small, false) : o.header ? fnt(17, true) : fnt(17, false)
  c.titleColor = o.color || C.ink
  if (subtitle) {
    c.subtitleFont = fnt(o.subSize || 13, false)
    c.subtitleColor = C.sub
  }
  if (o.center) c.centerAligned()
  if (o.onSelect) r.onSelect = o.onSelect
  table.addRow(r)
  return r
}

// 絵だけの行（グラフなど）
function imageRow(table, img, height) {
  const r = new UITableRow()
  r.height = height
  r.backgroundColor = C.bg
  r.dismissOnSelect = false
  const c = r.addImage(img)
  c.centerAligned()
  table.addRow(r)
  return r
}

function space(table, h) {
  const r = new UITableRow()
  r.height = h || 12
  r.backgroundColor = C.bg
  table.addRow(r)
}
async function info(title, message) {
  const a = new Alert()
  a.title = title
  a.message = message || ''
  a.addAction('OK')
  await a.present()
}

async function askText(title, message, value, placeholder) {
  const a = new Alert()
  a.title = title
  if (message) a.message = message
  a.addTextField(placeholder || '', value === null || value === undefined ? '' : String(value))
  a.addAction('保存')
  a.addCancelAction('キャンセル')
  const i = await a.present()
  return i === 0 ? a.textFieldValue(0).trim() : null
}

async function askTime(core, title, value) {
  const v = await askText(title, '「7:00」のように入力', value ? core.shortTime(value) : '', '7:00')
  if (v === null) return null
  const t = core.normalizeTime(v)
  if (!t) await info('時刻として読めません', '「7:00」「23:30」のように入力してください')
  return t
}

async function askNumber(title, value) {
  const v = await askText(title, null, value, '数字')
  if (v === null || v === '') return null
  const n = Number(v.replace(/[０-９]/g, d => String.fromCharCode(d.charCodeAt(0) - 0xFEE0)))
  if (!Number.isFinite(n) || n < 0) {
    await info('数字を入力してください')
    return null
  }
  return Math.round(n)
}

async function choose(title, options, message) {
  const a = new Alert()
  a.title = title
  if (message) a.message = message
  for (const o of options) a.addAction(o)
  a.addCancelAction('キャンセル')
  return await a.presentSheet()
}

async function confirm(title, message, ok) {
  const a = new Alert()
  a.title = title
  if (message) a.message = message
  a.addDestructiveAction(ok || 'OK')
  a.addCancelAction('キャンセル')
  return (await a.present()) === 0
}

function openShortcut(core, name) {
  Safari.open(core.shortcutURL(name))
}

// 画面を作り直して表示し続ける
async function screen(build) {
  const t = new UITable()
  t.showSeparators = true
  const render = () => {
    t.removeAllRows()
    build(t, render)
    t.reload()
  }
  render()
  await t.present(false)
}

// ---------- ホーム ----------

async function home(ctx) {
  useTheme(ctx)
  const { core, data } = ctx
  await screen((t, render) => {
    const now = new Date()
    const ph = core.phaseAt(data, now)
    const cfg = data.config
    row(t, '起床　' + core.fmtDate(now), core.PHASE_NAMES[ph.phase] + 'の時間帯', { header: true, height: 64 })
    for (const p of data.problems) row(t, '⚠ ' + p, null, { color: C.warn, height: 60 })

    if (ph.phase === 'waking') {
      const idx = core.stageAt(cfg, now)
      row(t, '⏰ 起きたらチェックイン', '段階' + (Math.max(0, idx) + 1) + 'が鳴っています', { big: 30, height: 110, center: true, bg: C.card })
      row(t, '☀️ チェックインする', '残りのアラームをオフにして記録します', {
        big: 22, height: 90, center: true,
        onSelect: () => openShortcut(core, '起床チェックイン'),
      })
    } else if (ph.phase === 'morning') {
      const st = core.routineStatus(data, now)
      const left = Math.max(0, Math.round((st.departure - now) / 60000))
      row(t, '🚪 出発まで ' + left + '分', core.fmtTime(st.departure) + ' 出発' + (st.lateMinutes ? '　⚠ ' + st.lateMinutes + '分遅れ' : ''), {
        big: 30, height: 100, center: true, bg: C.card, color: st.lateMinutes ? C.warn : null,
      })
      if (st.complete) {
        row(t, '✓ 出発準備OK', null, { big: 26, height: 90, center: true })
      } else {
        row(t, '✓ ' + st.current.name + ' 完了', '残り ' + st.restMinutes + '分（' + (st.done + 1) + '/' + st.total + '）', {
          big: 26, height: 110, center: true,
          onSelect: async () => { core.advanceRoutine(data, new Date(), 1); core.saveState(data); render() },
        })
      }
    } else {
      const nw = core.nextWake(data, now)
      const target = core.planTargetDay(cfg, now)
      const p = data.state.plan
      const prepared = p && p.date === core.dateKey(target)
      const head = nw
        ? '⏰ ' + core.dayLabel(nw.day, now) + ' ' + core.shortTime(core.wakeTime(cfg)) + ' 起床'
        : '⏰ 2週間以内の起床予定なし'
      const sub = nw ? core.alarmsText(cfg) : ''
      row(t, head, sub, { big: 24, height: 100, center: true, bg: C.card })
      row(t, prepared ? (p.wake ? '✓ アラーム準備済み' : '・アラームなし') : '▶ アラーム準備を実行', prepared ? p.reason : 'ショートカット「' + cfg.shortcutPlan + '」', {
        height: 64, onSelect: () => openShortcut(core, cfg.shortcutPlan),
      })
      const s = core.sessionOf(data, now)
      if (s) row(t, '今朝：' + (s.checkinAt ? core.fmtTime(new Date(s.checkinAt)) + ' ' : '') + core.stageLabel(cfg, s.wokeStage), s.score + '点', { height: 60 })
    }

    // 今日の天気・やること・自分ルール（チェックイン後）
    if (ph.phase === 'morning' || ph.phase === 'day') {
      const w = core.weatherFor(data, now)
      if (w) row(t, '🌤 ' + w, null, { height: 50 })
      for (const task of core.tasksFor(data, now)) row(t, '☐ ' + task, '今日やること', { height: 56 })
      if (cfg.ownRule && core.overslept(cfg, core.sessionOf(data, now))) row(t, '📌 ' + cfg.ownRule, '自分ルール（寝坊した朝）', { height: 60, color: C.warn })
    }
    // 明日やること（寝る前に入力）
    if (ph.phase === 'day' || ph.phase === 'night' || ph.phase === 'presleep') {
      const day = core.wakeDayAfter(now)
      const list = core.tasksFor(data, day)
      row(t, '📝 ' + core.dayLabel(day, now) + 'やること', list.length ? list.join('・') : '3つまで入力できます（チェックイン後に表示）', {
        height: 60, onSelect: async () => { await tasks(ctx, day); render() },
      })
    }

    space(t)
    row(t, '🧭 朝のルーティン', null, { onSelect: async () => { await routine(ctx); render() } })
    row(t, '🎒 持ち物チェック', null, { onSelect: async () => { await belongings(ctx); render() } })
    row(t, '📊 起床の記録', null, { onSelect: async () => { await records(ctx); render() } })
    const target = core.planTargetDay(cfg, now)
    const tk = core.dateKey(target)
    const skipped = data.state.skipDates.indexOf(tk) >= 0
    row(t, skipped ? '↩︎ ' + core.dayLabel(target, now) + 'のお休みを取り消す' : '💤 ' + core.dayLabel(target, now) + 'だけオフ', null, {
      onSelect: async () => {
        await toggleSkip(ctx, target)
        render()
      },
    })
    row(t, '⚙️ 設定', null, { onSelect: async () => { await settings(ctx); render() } })
    row(t, '🔧 動作確認', null, { onSelect: async () => { await diagnose(ctx); render() } })
  })
}

// 明日やること（F-18）：3つまで
async function tasks(ctx, day) {
  useTheme(ctx)
  const { core, data } = ctx
  await screen((t, render) => {
    const items = core.tasksFor(data, day)
    while (items.length < 3) items.push('')
    row(t, core.dayLabel(day, new Date()) + 'やること', 'チェックインしたあとに表示します', { header: true, height: 60 })
    items.forEach((x, i) => {
      row(t, (i + 1) + '. ' + (x || '（タップして入力）'), null, {
        height: 56, color: x ? null : C.sub,
        onSelect: async () => {
          const v = await askText('やること ' + (i + 1), '空にすると消えます', x, '例：ゴミ出し')
          if (v === null) return
          items[i] = v
          core.setTasks(data, day, items.filter(y => y))
          core.saveState(data)
          render()
        },
      })
    })
  })
}

// 明日だけオフ（F-15）とその取り消し
async function toggleSkip(ctx, target) {
  const { core, notify, data } = ctx
  const key = core.dateKey(target)
  const label = core.dayLabel(target, new Date())
  const i = data.state.skipDates.indexOf(key)
  if (i >= 0) {
    data.state.skipDates.splice(i, 1)
    if (data.state.plan && data.state.plan.date === key) data.state.plan = null
    if (data.state.pendingOff === key) data.state.pendingOff = null
    core.saveState(data)
    await notify.rescheduleBedtime(core, data, new Date())
    const go = await confirm(label + 'のお休みを取り消しました', 'アラームを鳴らすには、ショートカット「' + data.config.shortcutPlan + '」を実行してください。今すぐ開きますか？', '開く')
    if (go) openShortcut(core, data.config.shortcutPlan)
  } else {
    data.state.skipDates.push(key)
    const armed = data.state.plan && data.state.plan.date === key && data.state.plan.wake
    if (data.state.plan && data.state.plan.date === key) data.state.plan = { date: key, wake: false, reason: label + 'は「お休み」に設定されています' }
    core.saveState(data)
    await notify.rescheduleBedtime(core, data, new Date())
    if (armed) {
      // すでにアラームをオンにしてある：ショートカット「起床チェックイン」（アラームをオフにする）を流用する。
      // 「オフにしてよい」印を残しておくと、チェックインの時間外でもアラームをオフにして止まらずに終わる
      data.state.pendingOff = key
      core.saveState(data)
      await info(label + 'をお休みにしました', 'アラームがもうオンになっているので、このあと「起床チェックイン」が開いてアラームをオフにします')
      openShortcut(core, '起床チェックイン')
    } else {
      await info(label + 'をお休みにしました', '今夜のアラーム準備でアラームはオンになりません')
    }
  }
}

// ---------- ルーティン（F-09, F-11） ----------

async function routine(ctx) {
  useTheme(ctx)
  const { core, data } = ctx
  await screen((t, render) => {
    const now = new Date()
    const cfg = data.config
    const st = core.routineStatus(data, now)
    row(t, '朝のルーティン', st.departure ? core.fmtTime(st.departure) + ' 出発' : '今日は出発時刻なし', { header: true, height: 60 })
    if (st.lateMinutes) row(t, '⚠ このままだと ' + st.lateMinutes + '分遅れます', '残りの所要時間 ' + st.restMinutes + '分', { color: C.warn, height: 60 })
    if (!cfg.routine.length) row(t, '項目がありません（設定で追加）', null, { color: C.sub })
    if (st.complete && cfg.routine.length) {
      row(t, '✓ 出発準備OK', null, { big: 26, height: 90, center: true, bg: C.card })
    } else if (st.current) {
      row(t, '✓ ' + st.current.name + ' 完了', st.current.minutes + '分' + (st.next ? '　次：' + st.next.name : ''), {
        big: 26, height: 110, center: true, bg: C.card,
        onSelect: () => { core.advanceRoutine(data, new Date(), 1); core.saveState(data); render() },
      })
    }
    cfg.routine.forEach((r, i) => {
      const mark = i < st.done ? '✓' : i === st.done ? '▶' : '・'
      row(t, mark + ' ' + r.name, r.minutes + '分', {
        height: 54, color: i < st.done ? C.sub : null,
        // タップでそこまで完了／取り消し
        onSelect: () => {
          const target = i < st.done ? i : i + 1
          core.advanceRoutine(data, new Date(), target - st.done)
          core.saveState(data)
          render()
        },
      })
    })
    if (st.done > 0) row(t, '↩︎ 1つ戻す', null, { color: C.sub, onSelect: () => { core.advanceRoutine(data, new Date(), -1); core.saveState(data); render() } })
  })
}

// ---------- 持ち物（F-10） ----------

async function belongings(ctx) {
  useTheme(ctx)
  const { core, data } = ctx
  await screen((t, render) => {
    const key = core.dateKey(new Date())
    if (!data.state.belongings || data.state.belongings.date !== key) data.state.belongings = { date: key, checked: [] }
    const checked = data.state.belongings.checked
    const items = data.config.belongings
    const all = items.length && items.every(x => checked.indexOf(x) >= 0)
    row(t, '持ち物チェック', all ? '全部そろいました 👍' : 'タップして確認', { header: true, height: 60 })
    for (const name of items) {
      const on = checked.indexOf(name) >= 0
      row(t, (on ? '☑ ' : '☐ ') + name, null, {
        big: 24, height: 70, color: on ? C.sub : null,
        onSelect: () => {
          const i = checked.indexOf(name)
          if (i >= 0) checked.splice(i, 1)
          else checked.push(name)
          core.saveState(data)
          render()
        },
      })
    }
  })
}

// 週ごとの平均点の棒グラフ（0〜100点）。記録のない週は点線の枠だけ
function weekChart(weeks) {
  const W = 340
  const H = 180
  const top = 22
  const bottom = 28
  const left = 30
  const c = new DrawContext()
  c.size = new Size(W, H)
  c.opaque = false
  c.respectScreenScale = true
  const plotH = H - top - bottom
  const y = v => top + plotH * (1 - v / 100)
  c.setFont(fnt(10, false))
  c.setTextColor(C.sub)
  for (const v of [0, 50, 100]) {
    const p = new Path()
    p.move(new Point(left, y(v)))
    p.addLine(new Point(W - 4, y(v)))
    c.addPath(p)
    c.setStrokeColor(new Color(S.muted, v === 0 ? 0.6 : 0.2))
    c.setLineWidth(v === 0 ? 1 : 0.5)
    c.strokePath()
    c.setTextAlignedRight()
    c.drawTextInRect(String(v), new Rect(0, y(v) - 7, left - 6, 14))
  }
  const slot = (W - 4 - left) / weeks.length
  const bw = Math.min(26, slot * 0.6)
  weeks.forEach((w, i) => {
    const x = left + slot * i + (slot - bw) / 2
    if (w.avg !== null) {
      c.setFillColor(new Color(S.accent, i === weeks.length - 1 ? 1 : 0.55))
      const h = Math.max(2, plotH * w.avg / 100)
      const p = new Path()
      p.addRoundedRect(new Rect(x, y(w.avg), bw, h), 4, 4)
      c.addPath(p)
      c.fillPath()
      c.setTextColor(C.ink)
      c.setTextAlignedCenter()
      c.setFont(fnt(10, i === weeks.length - 1))
      c.drawTextInRect(String(w.avg), new Rect(x - 8, y(w.avg) - 15, bw + 16, 13))
    }
    c.setFont(fnt(9, false))
    c.setTextColor(C.sub)
    c.setTextAlignedCenter()
    c.drawTextInRect(w.label, new Rect(left + slot * i, H - bottom + 6, slot, 12))
  })
  return c.getImage()
}

// ---------- 記録（F-12） ----------
async function records(ctx) {
  useTheme(ctx)
  const { core, data } = ctx
  await screen(t => {
    const now = new Date()
    const cfg = data.config
    const week = core.recentSessions(data, now, 7)
    const prev = core.recentSessions(data, core.addDays(now, -7), 7)
    const avg = core.average(week)
    const pavg = core.average(prev)
    row(t, '起床の記録', null, { header: true })
    row(t, '今週の平均 ' + (avg === null ? '−' : avg + '点'), '先週 ' + (pavg === null ? '−' : pavg + '点') + '・連続記録 ' + core.streak(data) + '日（最終段階まで寝なかった日）', {
      big: 22, height: 80, bg: C.card,
    })
    // 週ごとの推移（直近8週）
    row(t, '週ごとの平均（直近8週）', null, { header: true })
    const weeks = []
    for (let i = 7; i >= 0; i--) {
      const end = core.addDays(now, -7 * i)
      weeks.push({ label: (core.addDays(end, -6).getMonth() + 1) + '/' + core.addDays(end, -6).getDate(), avg: core.average(core.recentSessions(data, end, 7)) })
    }
    imageRow(t, weekChart(weeks), 190)
    row(t, '毎日の記録', null, { header: true })
    const list = data.sessions.slice(-60).reverse()
    if (!list.length) row(t, 'まだ記録がありません', null, { color: C.sub })
    for (const s of list) {
      const d = new Date(s.date + 'T00:00:00')
      const time = s.checkinAt ? core.fmtTime(new Date(s.checkinAt)) : '−'
      row(t, core.fmtDate(d) + '　' + time + '　' + s.score + '点', core.stageLabel(cfg, s.wokeStage) + (s.method === 'nfc' ? '・NFC' : s.method === 'barcode' ? '・バーコード' : '') + (s.late ? '・遅れぎみ' : ''), { height: 54 })
    }
  })
}

// ---------- 設定 ----------

async function settings(ctx) {
  useTheme(ctx)
  const { core, notify, data } = ctx
  const save = async () => {
    data.config = core.normalizeConfig(data.config)
    core.saveConfig(data)
    useTheme(ctx)
    data.problems = data.problems.filter(p => p.indexOf('config.json') < 0)
    await notify.rescheduleBedtime(core, data, new Date())
  }
  await screen((t, render) => {
    const cfg = data.config
    const edit = fn => async () => {
      if (await fn() !== false) await save()
      render()
    }
    row(t, '設定', '変更はすぐ保存されます', { header: true, height: 60 })
    if (data.configBroken) row(t, '⚠ 設定ファイルが壊れていたため初期設定で動いています', '変更すると壊れたファイルを退避して保存し直します', { color: C.warn, height: 70 })

    row(t, '段階アラーム', '時計アプリのアラームも同じ時刻・ラベルにしてください', { header: true, height: 60 })
    cfg.stages.forEach(s => {
      row(t, '段階' + (s.index + 1) + '　' + core.shortTime(s.time) + '　' + s.name, 'ラベル「' + s.clockLabel + '」・' + s.score + '点', {
        height: 56,
        onSelect: edit(async () => {
          const i = await choose('段階' + (s.index + 1), ['時刻を変える', '名前を変える', '点数を変える', 'この段階を削除'])
          if (i === 0) { const v = await askTime(core, '段階' + (s.index + 1) + 'の時刻', s.time); if (!v) return false; s.time = v }
          else if (i === 1) { const v = await askText('名前', null, s.name); if (!v) return false; s.name = v }
          else if (i === 2) { const v = await askNumber('点数（0〜100）', s.score); if (v === null) return false; s.score = Math.min(100, v) }
          else if (i === 3) {
            if (cfg.stages.length <= 1) { await info('段階は1つ以上必要です'); return false }
            if (!(await confirm('段階' + (s.index + 1) + 'を削除しますか？', '時計アプリの「' + s.clockLabel + '」とショートカットも合わせて直してください', '削除'))) return false
            cfg.stages.splice(s.index, 1)
            cfg.stages.forEach(x => { x.clockLabel = '' }) // 番号を振り直す
          } else return false
        }),
      })
    })
    row(t, '＋ 段階を追加', null, {
      color: C.accent,
      onSelect: edit(async () => {
        const last = cfg.stages[cfg.stages.length - 1]
        const v = await askTime(core, '追加する段階の時刻', core.fmtTime(core.addMinutes(core.at(new Date(), last.time), 3)))
        if (!v) return false
        cfg.stages.push({ name: '追加', time: v, score: Math.max(0, last.score - 20) })
        cfg.stages.forEach(x => { x.clockLabel = '' })
      }),
    })

    row(t, '曜日', null, { header: true })
    for (const k of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']) {
      const d = cfg.days[k]
      const name = core.DAY_NAMES[core.DAY_KEYS.indexOf(k)] + '曜'
      row(t, name + '　' + (d.wake ? '起床する' : '起床しない'), d.wake ? (d.departure ? '出発 ' + core.shortTime(d.departure) : '出発なし') : null, {
        height: d.wake ? 56 : 44,
        onSelect: edit(async () => {
          const i = await choose(name, ['起床する・出発時刻あり', '起床する・出発なし', '起床しない'])
          if (i === 0) { const v = await askTime(core, name + 'の出発時刻', d.departure || '07:45'); if (!v) return false; cfg.days[k] = { wake: true, departure: v } }
          else if (i === 1) cfg.days[k] = { wake: true, departure: null }
          else if (i === 2) cfg.days[k] = { wake: false, departure: null }
          else return false
        }),
      })
    }

    row(t, '時刻', null, { header: true })
    const timeRow = (label, key, sub) => row(t, label + '　' + core.shortTime(cfg[key]), sub, {
      height: sub ? 56 : 44,
      onSelect: edit(async () => { const v = await askTime(core, label, cfg[key]); if (!v) return false; cfg[key] = v }),
    })
    timeRow('就寝時刻', 'bedtime', 'この30分前に就寝リマインドが届きます')
    timeRow('昼間の終わり', 'daytimeEnd', 'ここから「夜」の表示になります')
    timeRow('チェックインの締め切り', 'noon', '過ぎると未チェックイン（0点）')
    row(t, '祝日はアラームなし　' + (cfg.skipHolidays ? 'オン' : 'オフ'), 'カレンダー「' + cfg.holidayCalendars[0] + '」などで判定', {
      height: 56, onSelect: edit(async () => { cfg.skipHolidays = !cfg.skipHolidays }),
    })

    row(t, 'チェックイン', null, { header: true })
    row(t, '受付開始　最初のアラームの' + cfg.checkinOpensMinutes + '分前から', '夜にタップしてもアラームはオフになりません', {
      height: 56, onSelect: edit(async () => { const v = await askNumber('最初のアラームの何分前から受け付けるか', cfg.checkinOpensMinutes); if (v === null) return false; cfg.checkinOpensMinutes = Math.min(720, v) }),
    })

    row(t, '朝のルーティン（合計' + core.routineTotal(cfg) + '分）', null, { header: true })
    cfg.routine.forEach((r, i) => {
      row(t, (i + 1) + '. ' + r.name, r.minutes + '分', {
        height: 50,
        onSelect: edit(async () => {
          const k = await choose(r.name, ['名前を変える', '所要時間を変える', '1つ上へ', '削除'])
          if (k === 0) { const v = await askText('名前', null, r.name); if (!v) return false; r.name = v }
          else if (k === 1) { const v = await askNumber('所要時間（分）', r.minutes); if (v === null) return false; r.minutes = v }
          else if (k === 2) { if (i === 0) return false; cfg.routine.splice(i - 1, 0, cfg.routine.splice(i, 1)[0]) }
          else if (k === 3) cfg.routine.splice(i, 1)
          else return false
        }),
      })
    })
    row(t, '＋ 項目を追加', null, {
      color: C.accent,
      onSelect: edit(async () => {
        const name = await askText('項目の名前', null, '', '例：洗顔')
        if (!name) return false
        const m = await askNumber('所要時間（分）', 5)
        cfg.routine.push({ name, minutes: m === null ? 5 : m })
      }),
    })

    row(t, '持ち物', null, { header: true })
    cfg.belongings.forEach((b, i) => {
      row(t, b, null, {
        onSelect: edit(async () => {
          const k = await choose(b, ['名前を変える', '削除'])
          if (k === 0) { const v = await askText('名前', null, b); if (!v) return false; cfg.belongings[i] = v }
          else if (k === 1) cfg.belongings.splice(i, 1)
          else return false
        }),
      })
    })
    row(t, '＋ 持ち物を追加', null, {
      color: C.accent,
      onSelect: edit(async () => { const v = await askText('持ち物', null, ''); if (!v) return false; cfg.belongings.push(v) }),
    })
    row(t, '通知　出発の' + cfg.belongingsMinutes + '分前', null, {
      onSelect: edit(async () => { const v = await askNumber('出発の何分前に通知するか', cfg.belongingsMinutes); if (v === null) return false; cfg.belongingsMinutes = Math.min(120, v) }),
    })

    row(t, 'デザイン', null, { header: true })
    const THEMES = [['dawn', '朝焼けの地平', '明朝体・空と太陽'], ['kissa', '喫茶モーニング', '丸ゴシック・まったり'], ['station', '駅の発車標', '黒地に琥珀色・停車駅'], ['sora', '青空シンプル', 'ゴシック・明るい空色']]
    const cur = THEMES.find(x => x[0] === cfg.theme) || THEMES[0]
    row(t, 'デザイン　' + cur[1], 'ホーム画面とロック画面の見た目（' + cur[2] + '）', {
      height: 56,
      onSelect: edit(async () => {
        const i = await choose('デザイン', THEMES.map(x => (x[0] === cfg.theme ? '✓ ' : '') + x[1] + '（' + x[2] + '）'))
        if (i < 0) return false
        cfg.theme = THEMES[i][0]
      }),
    })

    row(t, '寝坊した朝', null, { header: true })
    row(t, '自分ルール', cfg.ownRule || '未設定（最終段階まで寝た朝に表示します）', {
      height: 56, onSelect: edit(async () => { const v = await askText('自分ルール', '最終段階まで寝てしまった朝に表示します。空にすると表示しません', cfg.ownRule, '例：今夜は23時にスマホを置く'); if (v === null) return false; cfg.ownRule = v }),
    })

    row(t, '天気', null, { header: true })
    row(t, '天気の場所', cfg.weatherLocation ? (cfg.weatherLocation.name || '登録済み') + '（チェックインのときに今日の天気を知らせます）' : '未設定（タップして現在地を登録）', {
      height: 56,
      onSelect: edit(async () => {
        const i = await choose('天気の場所', cfg.weatherLocation ? ['いまいる場所に変える', '天気を使わない'] : ['いまいる場所を登録'], '天気は Open-Meteo（無料）から取ります')
        if (i < 0) return false
        if (cfg.weatherLocation && i === 1) { cfg.weatherLocation = null; return }
        try {
          Location.setAccuracyToThreeKilometers()
          const p = await Location.current()
          let name = ''
          try {
            const g = await Location.reverseGeocode(p.latitude, p.longitude, 'ja_JP')
            if (g && g[0]) name = [g[0].administrativeArea, g[0].locality].filter(x => x).join(' ')
          } catch (e) { /* 地名が取れなくても場所は使える */ }
          // 天気には3km程度の精度で十分。細かい位置は保存しない
          cfg.weatherLocation = { lat: Math.round(p.latitude * 100) / 100, lon: Math.round(p.longitude * 100) / 100, name }
        } catch (e) {
          await info('現在地を取得できません', '設定 > Scriptable > 位置情報 を「使用中のみ」にしてください')
          return false
        }
      }),
    })

    row(t, '週の振り返り', null, { header: true })
    row(t, core.DAY_NAMES[cfg.weeklyDay] + '曜 ' + core.shortTime(cfg.weeklyTime) + ' に通知', null, {
      onSelect: edit(async () => {
        const i = await choose('曜日', core.DAY_NAMES.map(d => d + '曜'))
        if (i < 0) return false
        const v = await askTime(core, '時刻', cfg.weeklyTime)
        if (!v) return false
        cfg.weeklyDay = i
        cfg.weeklyTime = v
      }),
    })

    row(t, 'その他', null, { header: true })
    row(t, 'Todoのデータ', cfg.todoFile, {
      height: 56, onSelect: edit(async () => { const v = await askText('Todoのデータファイル', 'Scriptable フォルダからの場所', cfg.todoFile); if (!v) return false; cfg.todoFile = v }),
    })
    row(t, 'アラーム準備のショートカット名', cfg.shortcutPlan, {
      height: 56, onSelect: edit(async () => { const v = await askText('ショートカットの名前', '就寝リマインドから開くショートカット', cfg.shortcutPlan); if (!v) return false; cfg.shortcutPlan = v }),
    })
    row(t, '🔧 動作確認', '今の判定・通知の予約・起動の記録を見る', {
      height: 56, onSelect: async () => { await diagnose(ctx); useTheme(ctx); render() },
    })
  })
}

// ---------- 動作確認 ----------

async function diagnose(ctx) {
  useTheme(ctx)
  const { core, data } = ctx
  const now = new Date()
  const ph = core.phaseAt(data, now)
  const todos = await core.loadTodos(data.config)
  const pending = await Notification.allPending()
  const mine = pending.filter(n => (n.identifier || '').indexOf('wake-') === 0)
  const plan = await core.decidePlan(data, now)
  await screen(t => {
    row(t, '動作確認', null, { header: true })
    row(t, '今の時間帯：' + core.PHASE_NAMES[ph.phase], '次の切り替わり ' + core.fmtDate(ph.until) + ' ' + core.fmtTime(ph.until), { height: 56 })
    row(t, 'アラーム準備を今実行すると：' + (plan.wake ? 'オン' : 'オフ'), plan.reason, { height: 56 })
    row(t, '記録されたアラーム準備', data.state.plan ? data.state.plan.date + '：' + (data.state.plan.wake ? 'オン' : 'オフ') : 'まだありません', { height: 56 })
    row(t, 'Todo：' + (todos.ok ? '読めました（未完了' + todos.items.length + '件）' : todos.error), data.config.todoFile, { height: 56 })
    row(t, '予約中の通知：' + mine.length + '件', mine.slice(0, 3).map(n => n.title).join(' / '), { height: 56 })
    row(t, 'データの場所', core.pathOf(''), { height: 56, subSize: 11 })
    for (const p of data.problems) row(t, '⚠ ' + p, null, { color: C.warn, height: 60 })
    row(t, '起動の記録（新しい順）', '画面が出ないときなどの原因調べ用', { header: true, height: 56 })
    const lines = readDebugLog(core, 15)
    if (!lines.length) row(t, 'まだ記録はありません', null, { color: C.sub })
    for (const l of lines) row(t, l, null, { height: 44, small: 11 })
  })
}

// WakeApp/debug-log.txt の新しい行から n 行
function readDebugLog(core, n) {
  try {
    const fm = FileManager.iCloud()
    const p = core.pathOf('debug-log.txt')
    if (!fm.fileExists(p) || !fm.isFileDownloaded(p)) return []
    return fm.readString(p).split('\n').filter(x => x).slice(0, n)
  } catch (e) {
    return []
  }
}

module.exports = { home, routine, belongings, records, settings, diagnose, info, tasks, toggleSkip, weekChart, useTheme, askText, askTime, askNumber, choose, confirm, readDebugLog }
