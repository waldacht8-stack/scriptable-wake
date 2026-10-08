// wake-lib/dawn-home.js
// ホーム画面：デザイン案D「朝焼けの地平」。Scriptable の WebView に HTML を表示する。
//   上半分が空。時間帯で空の色が変わり、朝はルーティンが1つ進むごとに太陽が昇る。
//   ボタンの操作は evaluateJavaScript（completion）で受け取り、画面は作り直さずに中身だけ差し替える
//   （太陽がふわっと昇るアニメーションを見せるため）。
//   設定・記録などの画面は、これまでの表（UITable）の画面をそのまま上に重ねて開く。

module.exports = function (core, dawn, ui, notify, settings) {

  const clamp = x => Math.max(0, Math.min(1, x))
  const rel = (day, now) => {
    const diff = Math.round((core.startOfDay(day) - core.startOfDay(now)) / 86400000)
    return diff === 0 ? '今日' : diff === 1 ? '明日' : core.fmtDate(day)
  }
  const optional = (fn, ...a) => (typeof fn === 'function' ? fn(...a) : null)

  // ---------- 画面に渡す中身 ----------

  async function model(data, now) {
    const cfg = data.config
    const ph = core.phaseAt(data, now)
    // 朝・昼と夜でデザインを変える
    const T = dawn.themeFor(cfg, ph.phase)
    const W = dawn.theme(T).words
    const N = n => dawn.num(T, n)
    const session = core.sessionOf(data, now)
    const m = {
      phase: ph.phase,
      theme: T,
      kanji: dawn.theme(T).kanji,
      date: core.fmtDate(now),
      label: '', big: '', sub: '',
      sun: 0, deadline: null,
      steps: [], lines: [], primary: null, secondary: [],
      menu: [['panel:routine', 'ルーティン'], ['panel:belongings', '持ち物'], ['panel:records', '記録'], ['design', 'デザイン'], [settings ? 'panel:settings' : 'settings', '設定']],
    }
    // 今日の天気：チェックインのときに取った分、なければ前の晩に取った分
    const wt = data.state.weatherTomorrow
    const weather = optional(core.weatherFor, data, now) || (wt && wt.date === core.dateKey(now) ? wt.text : null)
    const today = optional(core.tasksFor, data, now) || []

    if (ph.phase === 'waking') {
      const idx = Math.max(0, core.stageAt(cfg, now))
      const first = core.at(now, cfg.stages[0].time)
      const last = core.at(now, cfg.stages[cfg.stages.length - 1].time)
      m.label = W.wake
      m.big = 'おはよう'
      // 最後のアラームから5分以上たったら「鳴っています」ではなく、経過時間を出す
      const after = now - last > 5 * 60000
      m.sub = after ? '最後のアラームから' + dawn.minutesText(T, (now - last) / 60000) : '段階' + N(idx + 1) + 'が鳴っています'
      m.sun = 0.08 + 0.12 * clamp((now - first) / Math.max(60000, last - first))
      m.steps = cfg.stages.map(s => ({ name: core.shortTime(s.time), state: after || s.index < idx ? 'done' : s.index === idx ? 'now' : 'todo' }))
      m.lines.push(after ? 'まだチェックインしていません。' + core.shortTime(cfg.noon) + 'を過ぎると0点になります' : '起きたら下のボタンを押すと、残りのアラームが止まります')
      m.primary = ['checkin', '起きた']
    } else if (ph.phase === 'morning') {
      const st = core.routineStatus(data, now)
      m.label = st.lateMinutes ? 'このままだと' + N(st.lateMinutes) + '分遅れます' : W.depart
      m.big = dawn.minutesText(T, (st.departure - now) / 60000)
      m.sub = dawn.timeText(T, st.departure) + 'に出発'
      m.deadline = st.departure.getTime()
      m.late = st.lateMinutes > 0
      m.sun = st.total ? 0.15 + 0.85 * st.done / st.total : 1
      m.steps = cfg.routine.map((r, i) => ({ name: r.name, state: i < st.done ? 'done' : i === st.done ? 'now' : 'todo' }))
      if (session && session.checkinAt) m.lines.push(core.fmtTime(new Date(session.checkinAt)) + 'に目覚めました ・ ' + core.stageLabel(cfg, session.wokeStage).replace(/（.*）/, ''))
      if (weather) m.lines.push('天気　' + weather)
      if (today.length) m.lines.push('今日やること　' + today.join('・'))
      if (cfg.ownRule && optional(core.overslept, cfg, session)) m.lines.push('自分ルール　' + cfg.ownRule)
      m.primary = st.complete ? ['panel:belongings', '持ち物を確かめる'] : ['next', W.next(st.current.name)]
      if (st.done > 0) m.secondary.push(['back', 'ひとつ戻す'])
      m.secondary.push(['speak', '読み上げる'])
      m.speech = ['出発まで、あと' + Math.max(0, Math.round((st.departure - now) / 60000)) + '分です。',
        st.lateMinutes ? 'このままだと' + st.lateMinutes + '分遅れます。' : '',
        weather ? '今日の天気は、' + weather.replace(/ (-?\d+)℃\//, '、最高$1度、最低').replace(/℃/g, '度').replace(/雨(\d+)%/, '雨の確率').replace(/☂.*/, '') + '。' : '',
        today.length ? '今日やることは、' + today.join('、') + '。' : '',
        st.complete ? '支度はできています。' : '次は' + st.current.name + 'です。'].join('')
      if (st.complete) m.label = W.done
    } else if (ph.phase === 'day') {
      const todos = await core.loadTodos(cfg)
      m.label = W.today
      m.big = todos.ok ? (todos.items.length ? '残り' + N(Math.min(99, todos.items.length)) + '件' : 'すべて済み') : '今日'
      m.sub = session ? '今朝 ' + (session.checkinAt ? core.fmtTime(new Date(session.checkinAt)) + ' ・ ' : '') + session.score + '点' : ''
      m.sun = 1
      if (weather) m.lines.push('天気　' + weather)
      for (const t of today) m.lines.push('□ ' + t)
      if (todos.ok) for (const t of todos.items.slice(0, 4)) m.lines.push((core.isOverdue(t, now) ? '！' : '・') + t.title + (core.fmtDue(t, now) ? '　' + core.fmtDue(t, now) : ''))
      else m.lines.push('Todoを読み込めません')
      m.primary = ['todo', 'Todo を開く']
      m.secondary.push(['speak', '読み上げる'])
      m.speech = [weather ? '今日の天気は、' + weather.replace(/ (-?\d+)℃\//, '、最高$1度、最低').replace(/℃/g, '度').replace(/雨(\d+)%/, '雨の確率').replace(/☂.*/, '') + '。' : '',
        today.length ? '今日やることは、' + today.join('、') + '。' : '',
        todos.ok && todos.items.length ? 'Todoは' + todos.items.length + '件です。いちばん近いのは、' + todos.items[0].title + '。' : ''].join('') || '今日の予定はありません。'
    } else {
      // 夜・就寝前
      const tomorrow = core.wakeDayAfter(now)
      const wake = core.isWakeDay(data, tomorrow)
      const label = rel(tomorrow, now)
      const nw = core.nextWake(data, now)
      if (ph.phase === 'night') {
        let bed = core.addMinutes(ph.until, 30)
        m.label = W.bed
        m.big = dawn.minutesText(T, (bed - now) / 60000)
        m.deadline = bed.getTime()
      } else {
        m.label = wake ? '今眠ると' : 'おやすみなさい'
        m.big = wake && nw ? dawn.minutesText(T, (nw.start - now) / 60000) : label + 'はお休み'
      }
      m.sub = wake ? label + ' ' + dawn.timeText(T, core.at(tomorrow, core.wakeTime(cfg))) + 'に起床' : label + 'はアラームなし'
      const plan = data.state.plan
      const prepared = plan && plan.date === core.dateKey(core.planTargetDay(cfg, now))
      m.lines.push(prepared ? (plan.wake ? 'アラームは準備できています' : 'アラームはかけません（' + plan.reason + '）') : 'アラームの準備がまだです')
      if (wt && wt.date === core.dateKey(tomorrow)) m.lines.push(label + 'の天気　' + wt.text)
      if (wake) m.lines.push('アラーム' + N(cfg.stages.length) + 'つ　' + cfg.stages.map(s => core.shortTime(s.time)).join('・'))
      const next = optional(core.tasksFor, data, tomorrow) || []
      if (next.length) m.lines.push(label + 'やること　' + next.join('・'))
      m.primary = prepared ? (typeof core.setTasks === 'function' ? ['panel:tasks', label + 'やることを書く'] : null) : ['plan', 'アラームを準備する']
      const skipped = data.state.skipDates.indexOf(core.dateKey(tomorrow)) >= 0
      if (typeof ui.toggleSkip === 'function') m.secondary.push(['skip', skipped ? label + 'のお休みを取り消す' : label + 'だけお休みにする'])
    }
    // ---- パネル（ルーティン・持ち物・記録）の中身 ----
    const rs = core.routineStatus(data, now)
    m.routine = {
      head: rs.departure ? dawn.timeText(T, rs.departure) + 'に出発 ・ 残り' + dawn.minutesText(T, rs.restMinutes) : '今日は出発時刻なし',
      late: rs.lateMinutes ? 'このままだと' + N(rs.lateMinutes) + '分遅れます' : '',
      items: cfg.routine.map((r, i) => ({ name: r.name, min: N(r.minutes) + '分', state: i < rs.done ? 'done' : i === rs.done ? 'now' : 'todo' })),
    }
    const bkey = core.dateKey(now)
    const checked = data.state.belongings && data.state.belongings.date === bkey ? data.state.belongings.checked : []
    m.belongings = cfg.belongings.map(b => ({ name: b, on: checked.indexOf(b) >= 0 }))
    const week = core.recentSessions(data, now, 7)
    const weeks = []
    for (let i = 7; i >= 0; i--) {
      const end = core.addDays(now, -7 * i)
      const s0 = core.addDays(end, -6)
      weeks.push({ label: (s0.getMonth() + 1) + '/' + s0.getDate(), avg: core.average(core.recentSessions(data, end, 7)) })
    }
    m.records = {
      avg: core.average(week),
      streak: core.streak(data),
      weeks,
      days: data.sessions.slice(-14).reverse().map(s => ({
        date: core.fmtDate(new Date(s.date + 'T00:00:00')),
        time: s.checkinAt ? core.fmtTime(new Date(s.checkinAt)) : '−',
        stage: core.stageLabel(cfg, s.wokeStage).replace(/（.*）/, ''),
        score: s.score,
      })),
    }
    m.settings = settings ? settings.model(data) : null
    // 明日やること（3つまで）。寝る前に書いて、チェックイン後に表示する
    const tday = core.wakeDayAfter(now)
    const tl = optional(core.tasksFor, data, tday) || []
    m.tasks = { day: rel(tday, now), items: [0, 1, 2].map(i => tl[i] || '') }
    return m
  }

  // ---------- HTML ----------

  function page(m) {
    return `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>
:root{--ink:#2B2433;--paper:#FBEFE3;--muted:#6B5F70;--accent:#B4482E;--btn:#2B2433;--btnInk:#FBEFE3;--line:#2B2433;
--s1:#3B3F6E;--s2:#8E6A8F;--s3:#E9967A;--s4:#F7C890;--sun:#FFF4D6;--skyInk:#FBEFE3;--lateInk:#FFE0C2;--warn:#B4482E}
body.day{--s1:#4F7FB3;--s2:#7AA3CF;--s3:#A8C6E4;--s4:#D3E4F3;--sun:#FFFBEA;--paper:#F5F7FA;--ink:#1F2A3A;--muted:#5C6B80;--btn:#1F2A3A;--btnInk:#F5F7FA;--line:#1F2A3A;--accent:#B4482E}
body.night,body.presleep{--warn:#F2B880;--s1:#0E1228;--s2:#161C3A;--s3:#20284C;--s4:#2C355E;--sun:#F3EFD8;--paper:#11152A;--ink:#E9E6F2;--muted:#9B98B5;--btn:#E9E6F2;--btnInk:#11152A;--line:#E9E6F2;--accent:#F2B880}
body.waking{--s1:#1C1F45;--s2:#4B3F6B;--s3:#B26A72;--s4:#E9A27A}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;height:100%}
body{background:var(--paper);color:var(--ink);font-family:"Hiragino Mincho ProN","Shippori Mincho",serif;display:flex;flex-direction:column;transition:background .8s}
.sky{position:relative;height:46vh;min-height:300px;overflow:hidden;flex:none}
.band{position:absolute;left:0;right:0;transition:background .8s}
.b1{top:0;height:34%;background:var(--s1)}.b2{top:34%;height:22%;background:var(--s2)}.b3{top:56%;height:22%;background:var(--s3)}.b4{top:78%;height:22%;background:var(--s4)}
.sun{position:absolute;left:50%;width:120px;height:120px;margin-left:-60px;border-radius:50%;background:var(--sun);transition:top 2.2s cubic-bezier(.2,.7,.2,1),background .8s}
.moon{position:absolute;right:14%;top:58%;width:54px;height:54px;border-radius:50%;box-shadow:-14px 8px 0 0 var(--sun);transform:rotate(-20deg);opacity:0;transition:opacity .8s}
body.night .moon,body.presleep .moon{opacity:1}body.night .sun,body.presleep .sun{opacity:0}
.star{position:absolute;width:3px;height:3px;border-radius:50%;background:var(--sun);opacity:0;transition:opacity .8s}
body.night .star,body.presleep .star{opacity:.8}
.head{position:absolute;left:0;right:0;top:calc(env(safe-area-inset-top,0px) + 28px);text-align:center;color:var(--skyInk);padding:0 20px}
.date{font-size:13px;letter-spacing:.2em;opacity:.8}
.label{font-size:15px;letter-spacing:.24em;margin-top:14px}
.big{font-size:clamp(40px,13vw,60px);font-weight:700;line-height:1.15;margin-top:2px;letter-spacing:.04em;text-wrap:balance}
.sub{font-size:15px;letter-spacing:.12em;margin-top:6px;opacity:.95}
body.late .label{color:var(--lateInk);font-weight:700}
.horizon{height:2px;background:var(--line);flex:none}
.ground{flex:1;display:flex;flex-direction:column;gap:14px;padding:18px 22px calc(env(safe-area-inset-bottom,0px) + 16px);overflow:auto}
.steps{display:flex;justify-content:space-between;gap:4px;font-size:12px;color:var(--muted)}
.steps span{display:flex;flex-direction:column;align-items:center;gap:4px;flex:1;min-width:0;text-align:center}
.steps i{width:10px;height:10px;border-radius:50%;border:1.5px solid var(--muted)}
.steps .done i{background:var(--muted)}.steps .now{color:var(--accent);font-weight:700}.steps .now i{border-color:var(--accent);background:linear-gradient(90deg,var(--accent) 50%,transparent 50%)}
.lines{display:flex;flex-direction:column;gap:6px;font-size:15px;line-height:1.6;color:var(--ink)}
.lines div{border-bottom:1px solid color-mix(in srgb,var(--muted) 25%,transparent);padding-bottom:6px}
.spacer{flex:1}
button{font-family:inherit;border:0;cursor:pointer}
.primary{min-height:64px;border-radius:999px;background:var(--btn);color:var(--btnInk);font-size:20px;font-weight:700;letter-spacing:.08em;padding:0 20px}
.primary:active{transform:scale(.98)}
.secondary{display:flex;justify-content:center;gap:18px;flex-wrap:wrap}
.secondary button,.menu button{background:none;color:var(--muted);font-size:14px;padding:10px 6px;min-height:44px;text-decoration:underline;text-underline-offset:4px}
.menu{display:flex;justify-content:space-around;border-top:1px solid color-mix(in srgb,var(--muted) 30%,transparent);padding-top:6px}
.menu button{text-decoration:none;letter-spacing:.1em}
.panel{position:fixed;left:0;right:0;bottom:0;top:12vh;background:var(--paper);color:var(--ink);border-radius:22px 22px 0 0;box-shadow:0 -8px 30px rgba(0,0,0,.25);transform:translateY(105%);transition:transform .35s cubic-bezier(.2,.7,.2,1);display:flex;flex-direction:column;z-index:10}
.panel.open{transform:none}
.phead{display:flex;align-items:center;justify-content:space-between;padding:18px 22px 10px;border-bottom:1px solid color-mix(in srgb,var(--muted) 30%,transparent)}
.phead h2{margin:0;font-size:20px;letter-spacing:.12em}
.pclose{background:none;color:var(--muted);font-size:15px;min-height:44px;padding:0 6px}
.pbody{flex:1;overflow:auto;padding:12px 22px calc(env(safe-area-inset-bottom,0px) + 24px);display:flex;flex-direction:column;gap:8px}
.pnote{font-size:14px;color:var(--muted);margin:2px 0 6px}
.pnote.late{color:var(--warn);font-weight:700}
.item{display:flex;align-items:center;gap:14px;width:100%;min-height:56px;padding:0 16px;border-radius:16px;background:color-mix(in srgb,var(--muted) 10%,transparent);color:var(--ink);font-size:18px;text-align:left}
.item .mk{width:24px;height:24px;border-radius:50%;border:2px solid var(--muted);flex:none;display:flex;align-items:center;justify-content:center;font-size:14px}
.item.done{color:var(--muted)}.item.done .mk,.item.on .mk{background:var(--accent);border-color:var(--accent);color:var(--paper)}
.item.now{background:var(--btn);color:var(--btnInk)}.item.now .mk{border-color:var(--btnInk)}
.item .nm{flex:1}.item .mn{font-size:14px;opacity:.75}
.stat{display:flex;gap:10px}.stat div{flex:1;border-radius:16px;padding:12px 14px;background:color-mix(in srgb,var(--muted) 10%,transparent)}
.stat b{display:block;font-size:30px;line-height:1.2}.stat span{font-size:12px;color:var(--muted)}
.chart{width:100%;aspect-ratio:320/150;flex:none;margin:6px 0 4px}
.day{display:flex;justify-content:space-between;font-size:15px;padding:8px 2px;border-bottom:1px solid color-mix(in srgb,var(--muted) 20%,transparent)}
.day span:last-child{font-weight:700}
.sh{font-size:13px;color:var(--muted);letter-spacing:.12em;margin:16px 2px 2px;font-weight:700}
.sn{font-size:12px;color:var(--muted);margin:0 2px 4px}
.srow{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;min-height:52px;padding:8px 14px;border-radius:14px;background:color-mix(in srgb,var(--muted) 10%,transparent);color:var(--ink);font-size:16px;text-align:left}
.srow .v{color:var(--muted);font-size:13px;text-align:right;min-width:0;overflow:hidden;text-overflow:ellipsis}
.slog{font-size:11px;color:var(--muted);padding:2px 4px;word-break:break-all}
/* ---- デザイン（設定で切り替え）。phase のクラスより後に書いて上書きする ---- */
body.kissa{--warn:#B23A24;--s1:#5A3E2B;--s2:#86593D;--s3:#B98557;--s4:#E2BE8F;--sun:#FFF1D8;--skyInk:#FFF6E8;--paper:#EFE2CC;--ink:#3A2A1E;--muted:#7A6450;--btn:#3A2A1E;--btnInk:#FFF6E8;--line:#3A2A1E;--accent:#B23A24;--lateInk:#FFE0C2;font-family:"Hiragino Maru Gothic ProN","Zen Maru Gothic",sans-serif}
body.kissa.day{--s1:#8C6A4F;--s2:#B08D6C;--s3:#D2B48F;--s4:#EBD5B5}
body.kissa.night,body.kissa.presleep{--warn:#E9A066;--s1:#1E1511;--s2:#2B1F18;--s3:#3A2B21;--s4:#4A382B;--sun:#F6E7CC;--paper:#231914;--ink:#F1E4D0;--muted:#B9A48C;--btn:#F1E4D0;--btnInk:#231914;--line:#F1E4D0;--accent:#E9A066}
body.station{--warn:#FF6B5E;--s1:#0E0E12;--s2:#15151B;--s3:#1C1C24;--s4:#25252F;--sun:#FFB300;--skyInk:#FFB300;--paper:#0B0B0C;--ink:#F5F5F5;--muted:#8C8C8C;--btn:#FFB300;--btnInk:#0B0B0C;--line:#FFB300;--accent:#7CD86B;--lateInk:#FF6B5E;font-family:"Hiragino Sans","Noto Sans JP",sans-serif}
/* 駅の発車標：朝は暖かい黒、昼は明るめの灰、夜は青みの黒。琥珀色の文字は共通 */
body.station.waking,body.station.morning{--s1:#120E0C;--s2:#1A1410;--s3:#241B14;--s4:#30241A}
body.station.day{--s1:#1D2026;--s2:#252A33;--s3:#2F3541;--s4:#3B4250;--sun:#FFE08A;--paper:#14161A}
body.station.night,body.station.presleep{--s1:#04060C;--s2:#090D18;--s3:#0F1526;--s4:#161F37;--paper:#06080F}
body.station .big{font-weight:800;letter-spacing:.02em}
body.station .label,body.station .date{letter-spacing:.3em}
body.sora{--warn:#C2410C;--s1:#BFD9F2;--s2:#D3E5F7;--s3:#E4EFFA;--s4:#F2F7FD;--sun:#FFD25E;--skyInk:#1E2B3C;--paper:#FFFFFF;--ink:#1E2B3C;--muted:#62728A;--btn:#2F6FEB;--btnInk:#FFFFFF;--line:#9CB8D8;--accent:#2F6FEB;--lateInk:#C2410C;font-family:"Hiragino Sans","Noto Sans JP",sans-serif}
body.sora.waking,body.sora.morning{--s1:#C9D3EE;--s2:#E1D5EA;--s3:#F4DCD6;--s4:#FBEBDD;--sun:#FFC56B;--paper:#FFFBF7}
body.sora.night,body.sora.presleep{--warn:#FFC9A8;--s1:#1B2740;--s2:#22314F;--s3:#2B3C5E;--s4:#35476D;--sun:#F2F0E0;--skyInk:#EAF0F8;--paper:#152034;--ink:#EAF0F8;--muted:#9FB0C8;--btn:#EAF0F8;--btnInk:#152034;--line:#9FB0C8;--accent:#8FB8FF;--lateInk:#FFC9A8}
body.sora .big,body.kissa .big{font-weight:700;letter-spacing:.02em}
@media (prefers-reduced-motion: reduce){*{transition:none!important}}</style></head><body>
<div class="sky">
<div class="band b1"></div><div class="band b2"></div><div class="band b3"></div><div class="band b4"></div>
<div class="star" style="left:14%;top:18%"></div><div class="star" style="left:38%;top:10%"></div><div class="star" style="left:62%;top:30%"></div><div class="star" style="left:24%;top:44%"></div><div class="star" style="left:80%;top:52%"></div>
<div class="moon"></div><div class="sun" id="sun"></div>
<div class="head"><div class="date" id="date"></div><div class="label" id="label"></div><div class="big" id="big"></div><div class="sub" id="sub"></div></div>
</div>
<div class="horizon"></div>
<div class="ground">
<div class="steps" id="steps"></div>
<div class="lines" id="lines"></div>
<div class="spacer"></div>
<button class="primary" id="primary"></button>
<div class="secondary" id="secondary"></div>
<nav class="menu" id="menu"></nav>
</div>
<section class="panel" id="panel" aria-hidden="true"><div class="phead"><h2 id="ptitle"></h2><button type="button" class="pclose" onclick="closePanel()">閉じる</button></div><div class="pbody" id="pbody"></div></section>
<script>
var Q=[],CB=null,M=null;
function act(a){if(a.indexOf('panel:')===0){openPanel(a.slice(6));return}if(CB){var c=CB;CB=null;c(a)}else Q.push(a)}
function wait(cb){if(Q.length)cb(Q.shift());else CB=cb}
var D=['〇','一','二','三','四','五','六','七','八','九'];
function kanji(n){n=Math.round(n);if(n<0||n>99)return String(n);if(n<10)return D[n];var t=Math.floor(n/10),o=n%10;return(t===1?'':D[t])+'十'+(o?D[o]:'')}
function kmin(min){var m=Math.max(0,Math.round(min));if(m<60)return kanji(m)+'分';var h=Math.floor(m/60);return kanji(h)+'時間'+(m%60?kanji(m%60)+'分':'')}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function btn(a,cls){return '<button type="button"'+(cls?' class="'+cls+'"':'')+' onclick="act(\\''+a[0]+'\\')">'+esc(a[1])+'</button>'}
function dmin(min){var m=Math.max(0,Math.round(min));return m<60?m+'分':Math.floor(m/60)+'時間'+(m%60?(m%60)+'分':'')}
function tick(){if(!M||!M.deadline)return;var x=(M.deadline-Date.now())/60000;document.getElementById('big').textContent=M.kanji?kmin(x):dmin(x)}
var P=null;
function drawSettings(){var h='';(M.settings||[]).forEach(function(s){h+='<div class="sh">'+esc(s.title)+'</div>'+(s.note?'<div class="sn">'+esc(s.note)+'</div>':'');s.rows.forEach(function(r){if(r.key)h+='<button type="button" class="srow" onclick="act(\\''+'set:'+r.key+'\\')"><span>'+esc(r.label)+'</span><span class="v">'+esc(r.value)+'</span></button>';else h+='<div class="slog">'+esc(r.label)+'</div>'})});return h}
function openPanel(k){P=k;drawPanel();var p=document.getElementById('panel');p.classList.add('open');p.setAttribute('aria-hidden','false')}
function closePanel(){P=null;var p=document.getElementById('panel');p.classList.remove('open');p.setAttribute('aria-hidden','true')}
function chart(w){var W=320,H=150,t=18,b=24,l=26,ph=H-t-b,s=(W-l-4)/w.length,bw=Math.min(24,s*.6),o='<svg class="chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="週ごとの平均点">';[0,50,100].forEach(function(v){var y=t+ph*(1-v/100);o+='<line x1="'+l+'" x2="'+(W-4)+'" y1="'+y+'" y2="'+y+'" stroke="var(--muted)" stroke-opacity="'+(v?.25:.6)+'" stroke-width="'+(v?.5:1)+'"/><text x="'+(l-6)+'" y="'+(y+4)+'" font-size="10" text-anchor="end" fill="var(--muted)">'+v+'</text>'});w.forEach(function(k,i){var x=l+s*i+(s-bw)/2,last=i===w.length-1;if(k.avg!==null){var y=t+ph*(1-k.avg/100);o+='<rect x="'+x+'" y="'+y+'" width="'+bw+'" height="'+Math.max(2,ph*k.avg/100)+'" rx="4" fill="var(--accent)" fill-opacity="'+(last?1:.5)+'"/><text x="'+(x+bw/2)+'" y="'+(y-4)+'" font-size="10" text-anchor="middle" fill="var(--ink)"'+(last?' font-weight="700"':'')+'>'+k.avg+'</text>'}o+='<text x="'+(l+s*i+s/2)+'" y="'+(H-6)+'" font-size="9" text-anchor="middle" fill="var(--muted)">'+k.label+'</text>'});return o+'</svg>'}
function drawPanel(){if(!P||!M)return;var h='',T={routine:'朝のルーティン',belongings:'持ち物',records:'起床の記録',settings:'設定',tasks:(M.tasks?M.tasks.day:'')+'やること'}[P];if(P==='settings')h=drawSettings();if(P==='tasks'&&M.tasks){h+='<p class="pnote">3つまで。チェックインしたあとに表示します</p>';M.tasks.items.forEach(function(x,i){h+='<button type="button" class="item'+(x?' on':'')+'" onclick="act(\\'task:'+i+'\\')"><span class="mk">'+(i+1)+'</span><span class="nm">'+(x?esc(x):'タップして書く')+'</span></button>'})}
if(P==='routine'){var r=M.routine;h+='<p class="pnote">'+esc(r.head)+'</p>'+(r.late?'<p class="pnote late">'+esc(r.late)+'</p>':'');r.items.forEach(function(x,i){h+='<button type="button" class="item '+x.state+'" onclick="act(\\'routine:'+i+'\\')"><span class="mk">'+(x.state==='done'?'✓':'')+'</span><span class="nm">'+esc(x.name)+'</span><span class="mn">'+esc(x.min)+'</span></button>'});if(!r.items.length)h+='<p class="pnote">項目がありません（設定で追加）</p>'}
if(P==='belongings'){var all=M.belongings.length&&M.belongings.every(function(x){return x.on});h+='<p class="pnote">'+(all?'全部そろいました':'タップして確かめる')+'</p>';M.belongings.forEach(function(x,i){h+='<button type="button" class="item'+(x.on?' on':'')+'" onclick="act(\\'belong:'+i+'\\')"><span class="mk">'+(x.on?'✓':'')+'</span><span class="nm">'+esc(x.name)+'</span></button>'})}
if(P==='records'){var R=M.records;h+='<div class="stat"><div><span>今週の平均</span><b>'+(R.avg===null?'−':R.avg+'点')+'</b></div><div><span>連続記録</span><b>'+R.streak+'日</b></div></div>'+chart(R.weeks);if(!R.days.length)h+='<p class="pnote">まだ記録がありません</p>';R.days.forEach(function(d){h+='<div class="day"><span>'+esc(d.date)+'　'+esc(d.time)+'　'+esc(d.stage)+'</span><span>'+d.score+'点</span></div>'})}
document.getElementById('ptitle').textContent=T;document.getElementById('pbody').innerHTML=h}
function render(m){M=m;if(P)setTimeout(drawPanel,0);
document.body.className=m.phase+' '+m.theme+(m.late?' late':'');
document.getElementById('date').textContent=m.date;
document.getElementById('label').textContent=m.label;
document.getElementById('big').textContent=m.big;
document.getElementById('sub').textContent=m.sub;
var sky=document.querySelector('.sky').clientHeight;var p=Math.max(0,Math.min(1,m.sun));
var sunEl=document.getElementById('sun'),target=((sky-30)-p*((sky-30)-sky*0.5))+'px';if(!window.__risen){window.__risen=true;sunEl.style.top=(sky+10)+'px';setTimeout(function(){sunEl.style.top=target},80)}else sunEl.style.top=target;
document.getElementById('steps').innerHTML=m.steps.map(function(s){return '<span class="'+s.state+'"><i></i>'+esc(s.name)+'</span>'}).join('');
document.getElementById('steps').style.display=m.steps.length?'':'none';
document.getElementById('lines').innerHTML=m.lines.map(function(l){return '<div>'+esc(l)+'</div>'}).join('');
var pr=document.getElementById('primary');if(m.primary){pr.style.display='';pr.textContent=m.primary[1];pr.onclick=function(){act(m.primary[0])}}else pr.style.display='none';
document.getElementById('secondary').innerHTML=m.secondary.map(function(a){return btn(a)}).join('');
document.getElementById('menu').innerHTML=m.menu.map(function(a){return btn(a)}).join('');
}
render(${JSON.stringify(m)});
if(M&&M.openPanel)setTimeout(function(){openPanel(M.openPanel)},400);
setInterval(tick,20000);
</script></body></html>`
  }

  // ---------- 操作 ----------

  // デザインを選ぶ（ホーム画面とロック画面の両方が変わる）
  async function chooseTheme(data) {
    const cfg = data.config
    const keys = Object.keys(dawn.THEMES)
    const a = new Alert()
    a.title = 'デザイン'
    a.message = '朝・昼・夜で色が変わります（書体や形は同じ）'
    for (const k of keys) a.addAction((cfg.theme === k ? '✓ ' : '') + dawn.THEMES[k].name + '（' + dawn.THEMES[k].note + '）')
    a.addAction('夜だけ別のデザインにする…（いま：' + (cfg.themeNight ? dawn.theme(cfg.themeNight).name : 'なし') + '）')
    a.addCancelAction('キャンセル')
    const i = await a.presentSheet()
    if (i < 0) return
    if (i < keys.length) {
      cfg.theme = keys[i]
    } else {
      const nk = [''].concat(keys)
      const b = new Alert()
      b.title = '夜だけ別のデザイン'
      for (const k of nk) b.addAction(((cfg.themeNight || '') === k ? '✓ ' : '') + (k ? dawn.THEMES[k].name : 'なし（朝・昼と同じデザインで、色だけ夜にする）'))
      b.addCancelAction('キャンセル')
      const j = await b.presentSheet()
      if (j < 0) return
      cfg.themeNight = nk[j]
    }
    core.saveConfig(data)
  }

  const WAIT = 'wait(completion)'

  async function handle(ctx, a) {
    const { data } = ctx
    const now = new Date()
    if (a === 'next' || a === 'back') {
      core.advanceRoutine(data, now, a === 'next' ? 1 : -1)
      core.saveState(data)
    } else if (a.indexOf('routine:') === 0) {
      // ルーティンの項目をタップ：そこまで完了（完了済みならそこから取り消し）
      const i = Number(a.slice(8))
      const st = core.routineStatus(data, now)
      core.advanceRoutine(data, now, (i < st.done ? i : i + 1) - st.done)
      core.saveState(data)
    } else if (a.indexOf('belong:') === 0) {
      const name = data.config.belongings[Number(a.slice(7))]
      const key = core.dateKey(now)
      if (!data.state.belongings || data.state.belongings.date !== key) data.state.belongings = { date: key, checked: [] }
      const c = data.state.belongings.checked
      const j = c.indexOf(name)
      if (j >= 0) c.splice(j, 1)
      else if (name) c.push(name)
      core.saveState(data)
    } else if (a === 'checkin') {
      Safari.open(core.shortcutURL('起床チェックイン'))
    } else if (a === 'plan') {
      Safari.open(core.shortcutURL(data.config.shortcutPlan))
    } else if (a === 'todo') {
      Safari.open('scriptable:///run/' + encodeURIComponent('TODO'))
    } else if (a === 'tasks' && typeof ui.tasks === 'function') {
      await ui.tasks(ctx, core.wakeDayAfter(now))
    } else if (a === 'speak') {
      const mm = await model(data, now)
      if (mm.speech) await Speech.speak(mm.speech)
    } else if (a.indexOf('task:') === 0 && typeof core.setTasks === 'function') {
      const day = core.wakeDayAfter(now)
      const items = (core.tasksFor(data, day) || []).slice()
      while (items.length < 3) items.push('')
      const i = Number(a.slice(5))
      const v = await ui.askText('やること ' + (i + 1), '空にすると消えます', items[i], '例：ゴミ出し')
      if (v !== null) {
        items[i] = v
        core.setTasks(data, day, items.filter(x => x))
        core.saveState(data)
      }
    } else if (a.indexOf('set:') === 0 && settings) {
      await settings.edit(ctx, a.slice(4))
    } else if (a === 'design') {
      await chooseTheme(data)
    } else if (a === 'skip' && typeof ui.toggleSkip === 'function') {
      await ui.toggleSkip(ctx, core.planTargetDay(data.config, now))
    } else if (ui[a]) {
      await ui[a](ctx)
    }
  }

  function wait(ms) {
    return new Promise(resolve => {
      const t = new Timer()
      t.timeInterval = ms
      t.schedule(() => resolve(null))
    })
  }

  async function present(ctx) {
    const log = ctx.log || (() => {})
    const wv = new WebView()
    const first = await model(ctx.data, new Date())
    // 通知から開いたとき：指定のパネルを最初から開く
    if (['routine', 'belongings', 'records', 'settings', 'tasks'].indexOf(ctx.panel) >= 0) first.openPanel = ctx.panel
    const html = page(first)
    // 読み込みの完了が知らされないことがあっても、3秒で表示に進む
    await Promise.race([wv.loadHTML(html), wait(3000)])
    log('ホーム画面を表示')
    let closed = false
    const shown = wv.present(true).then(() => { closed = true })
    await wait(300)
    while (!closed) {
      let a = null
      try {
        a = await Promise.race([wv.evaluateJavaScript(WAIT, true), shown.then(() => null)])
      } catch (e) {
        // ボタンの受け取りができない場合も、画面は閉じるまで見られるようにする
        log('ボタンを受け取れません: ' + (e && e.message ? e.message : e))
        await shown
        break
      }
      if (closed || !a) break
      try {
        await handle(ctx, a)
      } catch (e) {
        log('ボタンの処理でエラー: ' + (e && e.message ? e.message : e))
      }
      if (closed) break
      await wv.evaluateJavaScript('render(' + JSON.stringify(await model(ctx.data, new Date())) + ')')
    }
  }
  return { model, page, present, handle }
}
