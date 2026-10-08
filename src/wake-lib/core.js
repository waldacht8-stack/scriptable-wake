// wake-lib/core.js
// 共通処理：設定と記録の読み書き、日付と時間帯の判定、スコア計算、Todo の読み取り。
// 画面・通知・ウィジェットはこのモジュールだけを頼りに動く。

const DIR = 'WakeApp'
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土']
const PHASE_NAMES = { waking: '起床中', morning: '朝', day: '昼間', night: '夜', presleep: '就寝前' }

const DEFAULT_CONFIG = {
  stages: [
    { index: 0, name: 'そっと', clockLabel: '起床1', time: '07:00', score: 100 },
    { index: 1, name: 'ふつう', clockLabel: '起床2', time: '07:10', score: 85 },
    { index: 2, name: 'しっかり', clockLabel: '起床3', time: '07:20', score: 70 },
    { index: 3, name: '最終', clockLabel: '起床4', time: '07:30', score: 40 },
  ],
  days: {
    sun: { wake: false, departure: null },
    mon: { wake: true, departure: '07:45' },
    tue: { wake: true, departure: '07:45' },
    wed: { wake: true, departure: '07:45' },
    thu: { wake: true, departure: '07:45' },
    fri: { wake: true, departure: '07:45' },
    sat: { wake: false, departure: null },
  },
  bedtime: '23:30',
  daytimeEnd: '18:00',
  noon: '12:00',                // この時刻までにチェックインがなければ「未チェックイン」
  checkinOpensMinutes: 120,     // 段階0の何分前からチェックインを受け付けるか（夜の歯磨きで誤ってオフにしないため）
  belongingsMinutes: 5,         // 出発の何分前に持ち物の通知を出すか
  skipHolidays: true,
  holidayCalendars: ['日本の祝日', '祝日', 'Japanese Holidays', 'Holidays in Japan'],
  checkinCode: '',
  routine: [
    { name: 'カーテンを開ける', minutes: 1 },
    { name: '洗顔', minutes: 5 },
    { name: '朝食', minutes: 15 },
    { name: '着替え', minutes: 10 },
    { name: '歯磨き', minutes: 5 },
  ],
  belongings: ['鍵', '財布', '定期', 'スマホ'],
  todoFile: 'todo-data/todo-data.json',
  shortcutPlan: 'アラーム準備',
  weeklyDay: 0,                 // 週の振り返りを送る曜日（0＝日曜）
  weeklyTime: '21:00',
  ownRule: '',                  // 最終段階まで寝た朝に表示する自分ルール（F-20）
  theme: 'dawn',                // 朝・昼のデザイン（dawn / kissa / station / sora）
  themeNight: 'kissa',          // 夜（夜・就寝前）のデザイン
  weatherLocation: null,        // 天気の場所 { lat, lon, name }（F-17）。null なら天気を取らない
}

// ---------- 日付と時刻 ----------

function pad2(n) {
  return (n < 10 ? '0' : '') + n
}

function dateKey(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate())
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function addDays(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes(), d.getSeconds())
}

function addMinutes(d, n) {
  return new Date(d.getTime() + n * 60000)
}

function isTime(s) {
  return typeof s === 'string' && /^([01]?\d|2[0-3]):[0-5]\d$/.test(s)
}

// 「7:5」「0705」などの入力を "07:05" にそろえる。読めなければ null
function normalizeTime(s) {
  const t = String(s || '').trim().replace('：', ':')
  let m = t.match(/^(\d{1,2}):(\d{1,2})$/)
  if (!m) m = t.match(/^(\d{1,2})(\d{2})$/)
  if (!m) return null
  let h = Number(m[1])
  const min = Number(m[2])
  if (h === 24 && min === 0) h = 0 // 「24:00」は 0:00 として受け付ける
  if (h > 23 || min > 59) return null
  return pad2(h) + ':' + pad2(min)
}

// 日付 day の "HH:MM" の時刻
function at(day, hhmm) {
  const p = hhmm.split(':')
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), Number(p[0]), Number(p[1]))
}

function fmtTime(d) {
  return d.getHours() + ':' + pad2(d.getMinutes())
}

function fmtDate(d) {
  return (d.getMonth() + 1) + '/' + d.getDate() + '（' + DAY_NAMES[d.getDay()] + '）'
}

function fmtDuration(ms) {
  const m = Math.max(0, Math.round(ms / 60000))
  const h = Math.floor(m / 60)
  return h ? h + '時間' + (m % 60 ? (m % 60) + '分' : '') : m + '分'
}

// "07:00" → "7:00"
function shortTime(hhmm) {
  return hhmm ? hhmm.replace(/^0(\d)/, '$1') : ''
}

// ---------- ファイル ----------

function fm() {
  return FileManager.iCloud()
}

function dir() {
  const f = fm()
  const d = f.joinPath(f.documentsDirectory(), DIR)
  if (!f.fileExists(d)) f.createDirectory(d, true)
  return d
}

function pathOf(name) {
  return fm().joinPath(dir(), name)
}

// iCloud からのダウンロードを待つ。iCloud が止まっていると無期限に待つので打ち切る
async function ensureDownloaded(path, ms) {
  const f = fm()
  if (!f.fileExists(path) || f.isFileDownloaded(path)) return
  await new Promise((resolve, reject) => {
    const t = new Timer()
    t.timeInterval = ms || 8000
    t.schedule(() => reject(new Error('iCloud からファイルを取得できません: ' + path.split('/').pop())))
    f.downloadFileFromiCloud(path).then(() => { t.invalidate(); resolve() }, e => { t.invalidate(); reject(e) })
  })
}

// JSON を読む。ない → { value: null }、壊れている → { value: null, broken: true }
async function readJSON(path) {
  const f = fm()
  if (!f.fileExists(path)) return { value: null }
  await ensureDownloaded(path)
  const text = f.readString(path)
  try {
    return { value: JSON.parse(text) }
  } catch (e) {
    return { value: null, broken: true, error: e.message }
  }
}

function writeJSON(name, value) {
  fm().writeString(pathOf(name), JSON.stringify(value, null, 1))
}

// ---------- 設定 ----------

function clone(x) {
  return JSON.parse(JSON.stringify(x))
}

// 読み込んだ設定を検証し、不正な値は初期値で埋める
function normalizeConfig(raw) {
  const d = clone(DEFAULT_CONFIG)
  const c = raw && typeof raw === 'object' ? raw : {}
  const out = Object.assign({}, d)
  if (Array.isArray(c.stages) && c.stages.length) {
    const stages = c.stages
      .filter(s => s && isTime(s.time))
      .map(s => ({
        name: String(s.name || ''),
        time: normalizeTime(s.time),
        score: Number.isFinite(s.score) ? s.score : 0,
        clockLabel: s.clockLabel ? String(s.clockLabel) : '',
      }))
      .sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0))
    if (stages.length) out.stages = stages
  }
  out.stages = out.stages.map((s, i) => ({
    index: i,
    name: s.name || '段階' + (i + 1),
    clockLabel: s.clockLabel || '起床' + (i + 1),
    time: s.time,
    score: s.score,
  }))
  if (c.days && typeof c.days === 'object') {
    for (const k of DAY_KEYS) {
      const v = c.days[k]
      if (!v || typeof v !== 'object') continue
      out.days[k] = { wake: v.wake === true, departure: isTime(v.departure) ? normalizeTime(v.departure) : null }
    }
  }
  for (const k of ['bedtime', 'daytimeEnd', 'noon']) if (isTime(c[k])) out[k] = normalizeTime(c[k])
  for (const k of ['checkinOpensMinutes', 'belongingsMinutes']) {
    if (Number.isInteger(c[k]) && c[k] >= 0 && c[k] <= 720) out[k] = c[k]
  }
  if (typeof c.skipHolidays === 'boolean') out.skipHolidays = c.skipHolidays
  if (Array.isArray(c.holidayCalendars)) out.holidayCalendars = c.holidayCalendars.map(String)
  if (typeof c.checkinCode === 'string') out.checkinCode = c.checkinCode.trim()
  if (Array.isArray(c.routine)) {
    out.routine = c.routine
      .filter(r => r && r.name)
      .map(r => ({ name: String(r.name), minutes: Number.isFinite(r.minutes) && r.minutes >= 0 ? r.minutes : 0 }))
  }
  if (Array.isArray(c.belongings)) out.belongings = c.belongings.map(String).filter(x => x)
  if (typeof c.todoFile === 'string' && c.todoFile) out.todoFile = c.todoFile
  if (typeof c.shortcutPlan === 'string' && c.shortcutPlan) out.shortcutPlan = c.shortcutPlan
  if (Number.isInteger(c.weeklyDay) && c.weeklyDay >= 0 && c.weeklyDay <= 6) out.weeklyDay = c.weeklyDay
  if (isTime(c.weeklyTime)) out.weeklyTime = normalizeTime(c.weeklyTime)
  if (typeof c.ownRule === 'string') out.ownRule = c.ownRule.trim()
  if (['dawn', 'kissa', 'station', 'sora'].indexOf(c.theme) >= 0) out.theme = c.theme
  if (['dawn', 'kissa', 'station', 'sora'].indexOf(c.themeNight) >= 0) out.themeNight = c.themeNight
  const w = c.weatherLocation
  if (w && Number.isFinite(w.lat) && Number.isFinite(w.lon)) out.weatherLocation = { lat: w.lat, lon: w.lon, name: String(w.name || '') }
  return out
}

// ---------- 読み込み ----------

// すべてのデータを読む。壊れたファイルがあっても初期値で動き、problems に理由を残す
async function loadAll() {
  const problems = []
  const read = async name => {
    try {
      const r = await readJSON(pathOf(name))
      if (r.broken) problems.push(name + ' が壊れています（' + r.error + '）。初期設定で動いています')
      return r
    } catch (e) {
      problems.push(name + ' を読めません（' + (e.message || e) + '）')
      return { value: null, unreadable: true }
    }
  }
  const c = await read('config.json')
  const s = await read('state.json')
  const h = await read('sessions.json')
  // 最初の版の初期値（6:50〜7:06、ラベル「起床-段階N」）のままなら、今の初期値（時計アプリの起床1〜4）に置き換える
  const old = c.value && Array.isArray(c.value.stages) && c.value.stages.map(x => x && x.time).join(',') === '06:50,07:00,07:03,07:06' &&
    c.value.stages.every((x, i) => x.clockLabel === '起床-段階' + i)
  if (old) c.value.stages = clone(DEFAULT_CONFIG.stages)
  const config = normalizeConfig(c.value)
  // 初回は初期設定を書き出す（利用者がファイルを見て直せるように）
  if ((c.value === null && !c.broken && !c.unreadable) || old) {
    try { writeJSON('config.json', config) } catch (e) { /* 書けなくても動作は続ける */ }
  }
  const state = Object.assign({ plan: null, skipDates: [], routine: null, belongings: null, weeklySent: null, tasks: null, weather: null, pendingOff: null }, s.value || {})
  if (!Array.isArray(state.skipDates)) state.skipDates = []
  const sessions = h.value && Array.isArray(h.value.sessions) ? h.value.sessions : []
  return {
    config,
    state,
    sessions,
    problems,
    configBroken: !!c.broken,
    // 壊れたファイルは上書きで消さない
    stateWritable: !s.broken && !s.unreadable,
    sessionsWritable: !h.broken && !h.unreadable,
  }
}

function backupBroken(name) {
  const f = fm()
  const p = pathOf(name)
  if (f.fileExists(p)) f.copy(p, p + '.broken-' + Date.now())
}

function saveConfig(data) {
  if (data.configBroken) {
    backupBroken('config.json')
    data.configBroken = false
  }
  writeJSON('config.json', data.config)
}

function saveState(data) {
  if (!data.stateWritable) {
    backupBroken('state.json')
    data.stateWritable = true
  }
  // 古い休み指定は消す
  const today = dateKey(new Date())
  data.state.skipDates = data.state.skipDates.filter(d => d >= today)
  writeJSON('state.json', data.state)
}

function saveSessions(data) {
  if (!data.sessionsWritable) {
    backupBroken('sessions.json')
    data.sessionsWritable = true
  }
  data.sessions.sort((a, b) => (a.date < b.date ? -1 : 1))
  if (data.sessions.length > 400) data.sessions = data.sessions.slice(-400)
  writeJSON('sessions.json', { version: 1, sessions: data.sessions })
}

// ---------- 起床日の判定 ----------

function dayConfig(cfg, d) {
  return cfg.days[DAY_KEYS[d.getDay()]] || { wake: false, departure: null }
}

// 祝日・お休み指定を除いた「曜日の決まり」だけでの判定
function isRuleWakeDay(cfg, d) {
  return dayConfig(cfg, d).wake
}

// 記録された予定（アラーム準備の結果）があればそれを優先する。祝日はアラーム準備のときだけ調べる
function isWakeDay(data, d) {
  const key = dateKey(d)
  if (data.state.skipDates.indexOf(key) >= 0) return false
  const p = data.state.plan
  if (p && p.date === key) return p.wake
  return isRuleWakeDay(data.config, d)
}

// 祝日カレンダーに予定があるか。調べられなければ「祝日ではない」とする（鳴る側に倒す）
async function holidayName(cfg, d) {
  try {
    const cals = (await Calendar.forEvents()).filter(c => cfg.holidayCalendars.indexOf(c.title) >= 0)
    if (!cals.length) return null
    const evs = await CalendarEvent.between(startOfDay(d), addDays(startOfDay(d), 1), cals)
    const ev = evs.find(e => e.isAllDay) || evs[0]
    return ev ? ev.title : null
  } catch (e) {
    console.warn('祝日を調べられませんでした: ' + e)
    return null
  }
}

// アラーム準備の対象日：段階0より前なら今日、それ以降は明日
function planTargetDay(cfg, now) {
  return now < at(now, cfg.stages[0].time) ? startOfDay(now) : addDays(startOfDay(now), 1)
}

// アラーム準備（S-01）の判断。{ date, wake, reason }
async function decidePlan(data, now) {
  const cfg = data.config
  const day = planTargetDay(cfg, now)
  const key = dateKey(day)
  const label = dayLabel(day, now)
  if (data.state.skipDates.indexOf(key) >= 0) return { date: key, wake: false, reason: label + 'は「お休み」に設定されています' }
  if (!isRuleWakeDay(cfg, day)) return { date: key, wake: false, reason: label + 'は起床しない曜日です' }
  if (cfg.skipHolidays) {
    const h = await holidayName(cfg, day)
    if (h) return { date: key, wake: false, reason: label + 'は祝日（' + h + '）です' }
  }
  return { date: key, wake: true, reason: label + ' ' + alarmsText(cfg) }
}

function dayLabel(day, now) {
  const diff = Math.round((startOfDay(day) - startOfDay(now)) / 86400000)
  return (diff === 0 ? '今日' : diff === 1 ? '明日' : '') + fmtDate(day)
}

// ---------- 記録とスコア ----------

function sessionOf(data, d) {
  const key = dateKey(d)
  return data.sessions.find(s => s.date === key) || null
}

function isCheckedIn(s) {
  return !!(s && s.method !== 'missed')
}

// チェックイン時刻までに鳴った最後の段階（-1 は段階0より前＝自力で起床）
function stageAt(cfg, time) {
  let idx = -1
  for (const s of cfg.stages) if (at(time, s.time) <= time) idx = s.index
  return idx
}

function scoreOf(cfg, stageIndex) {
  if (stageIndex < 0) return 100
  return cfg.stages[stageIndex].score
}

function stageLabel(cfg, idx) {
  if (idx === null || idx === undefined) return '未チェックイン'
  if (idx < 0) return '自力で起床'
  const s = cfg.stages[idx]
  return '段階' + (idx + 1) + (s ? '（' + s.name + '）' : '')
}

// ISO 8601（日本時間の +09:00 など端末のタイムゾーンつき）
function isoLocal(d) {
  const off = -d.getTimezoneOffset()
  const sign = off >= 0 ? '+' : '-'
  const a = Math.abs(off)
  return dateKey(d) + 'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds()) +
    sign + pad2(Math.floor(a / 60)) + ':' + pad2(a % 60)
}

// 「起床時刻」として見せる時刻（最初のアラーム）
function wakeTime(cfg) {
  return cfg.stages[0].time
}

// 「7:00 起床・アラーム4つ（7:30まで）」の後半
function alarmsText(cfg) {
  const last = cfg.stages[cfg.stages.length - 1]
  return shortTime(cfg.stages[0].time) + ' 起床・アラーム' + cfg.stages.length + 'つ' +
    (cfg.stages.length > 1 ? '（' + shortTime(last.time) + 'まで）' : '')
}

// ---------- 明日やること（F-18）・自分ルール（F-20）・天気（F-17） ----------

// その日の「やること」（最大3つ）。寝る前に翌日分を入力する
function tasksFor(data, day) {
  const t = data.state.tasks
  return t && t.date === dateKey(day) && Array.isArray(t.items) ? t.items.filter(x => x) : []
}

function setTasks(data, day, items) {
  data.state.tasks = { date: dateKey(day), items: items.map(x => String(x || '').trim()).slice(0, 3) }
}

// 寝坊した朝か（最終段階まで寝た・未チェックイン）
function overslept(cfg, session) {
  if (!session) return false
  return !isCheckedIn(session) || session.wokeStage >= cfg.stages.length - 1
}

// 保存済みの今日の天気の文（なければ null）
function weatherFor(data, day) {
  const w = data.state.weather
  return w && w.date === dateKey(day) ? w.text : null
}

function routineTotal(cfg) {
  return cfg.routine.reduce((n, r) => n + r.minutes, 0)
}

// チェックイン（F-02, F-03）。記録は呼び出し側で保存する
// 戻り値 { result: 'ok' | 'already' | 'mismatch' | 'register' | 'closed', message, session }
function checkin(data, now, code, method) {
  const cfg = data.config
  const c = String(code || '').trim()
  if (method === 'barcode') {
    if (!cfg.checkinCode) return { result: 'register', message: '' }
    if (c !== cfg.checkinCode) return { result: 'mismatch', message: '登録したコードと違います。アラームはそのままです' }
  }
  const today = startOfDay(now)
  const existing = sessionOf(data, today)
  const opens = addMinutes(at(today, cfg.stages[0].time), -cfg.checkinOpensMinutes)
  const closes = at(today, cfg.noon)
  // チェックイン済みでも「OK（アラームをオフ）」を返すのは受付時間内だけ。
  // 夜に充電器を外したときなどに OK を返すと、20:00 にオンにした翌朝のアラームを消してしまうため
  if (isCheckedIn(existing) && now >= opens && now < closes) {
    return { result: 'already', message: '今日はチェックイン済みです（' + fmtTime(new Date(existing.checkinAt)) + '）', session: existing }
  }
  if (!isWakeDay(data, today) || now < opens || now >= closes || existing) {
    return {
      result: 'closed',
      message: 'いまはチェックインの時間外です（' + fmtTime(opens) + '〜' + fmtTime(closes) + '、起床日のみ）。アラームはそのままです',
    }
  }
  const idx = stageAt(cfg, now)
  const dep = dayConfig(cfg, today).departure
  const session = {
    date: dateKey(today),
    checkinAt: isoLocal(now),
    wokeStage: idx,
    score: scoreOf(cfg, idx),
    method: method,
    late: dep ? addMinutes(now, routineTotal(cfg)) > at(today, dep) : false,
  }
  data.sessions.push(session)
  data.state.routine = { date: session.date, done: 0 }
  data.state.belongings = { date: session.date, checked: [] }
  const msg = fmtTime(now) + ' 起床：' + stageLabel(cfg, idx) + '・' + session.score + '点' +
    (dep ? '\n出発は ' + shortTime(dep) + (session.late ? '（ルーティンを全部やると遅れそう）' : '') : '')
  return { result: 'ok', message: msg, session }
}

// 今チェックインを受け付けるか（起床日・未チェックイン・受付時間内）。ウィジェットのタップ先を決めるのに使う
function canCheckin(data, now) {
  const cfg = data.config
  const today = startOfDay(now)
  if (sessionOf(data, today) || !isWakeDay(data, today)) return false
  const opens = addMinutes(at(today, cfg.stages[0].time), -cfg.checkinOpensMinutes)
  return now >= opens && now < at(today, cfg.noon)
}

// 正午を過ぎても記録のない起床日を「未チェックイン（0点）」にする。追加した件数を返す
function settleMissed(data, now) {
  let added = 0
  for (let i = 3; i >= 0; i--) {
    const day = addDays(startOfDay(now), -i)
    if (now < at(day, data.config.noon)) continue
    if (sessionOf(data, day)) continue
    const p = data.state.plan
    // 「アラームを鳴らす」と判断した日だけを対象にする（祝日などを誤って0点にしない）
    if (!(p && p.date === dateKey(day) && p.wake)) continue
    if (data.state.skipDates.indexOf(dateKey(day)) >= 0) continue
    data.sessions.push({ date: dateKey(day), checkinAt: null, wokeStage: null, score: 0, method: 'missed', late: true })
    added++
  }
  return added
}

// 直近 days 日の記録
function recentSessions(data, now, days) {
  const from = dateKey(addDays(startOfDay(now), -(days - 1)))
  return data.sessions.filter(s => s.date >= from && s.date <= dateKey(now))
}

function average(list) {
  if (!list.length) return null
  return Math.round(list.reduce((n, s) => n + s.score, 0) / list.length)
}

// 最終段階まで寝なかった日の連続記録（新しい順に数える）
function streak(data) {
  const last = data.config.stages.length - 1
  let n = 0
  for (let i = data.sessions.length - 1; i >= 0; i--) {
    const s = data.sessions[i]
    if (!isCheckedIn(s) || s.wokeStage >= last) break
    n++
  }
  return n
}

// ---------- ルーティン ----------

function routineStatus(data, now) {
  const cfg = data.config
  const key = dateKey(now)
  const r = data.state.routine && data.state.routine.date === key ? data.state.routine : { date: key, done: 0 }
  const done = Math.min(r.done, cfg.routine.length)
  const rest = cfg.routine.slice(done)
  const restMinutes = rest.reduce((n, x) => n + x.minutes, 0)
  const dep = dayConfig(cfg, now).departure
  const depTime = dep ? at(now, dep) : null
  const finishAt = addMinutes(now, restMinutes)
  const lateMinutes = depTime ? Math.ceil((finishAt - depTime) / 60000) : 0
  return {
    done,
    total: cfg.routine.length,
    current: rest[0] || null,
    next: rest[1] || null,
    restMinutes,
    complete: done >= cfg.routine.length,
    departure: depTime,
    lateMinutes: lateMinutes > 0 ? lateMinutes : 0,
  }
}

function advanceRoutine(data, now, delta) {
  const key = dateKey(now)
  const r = data.state.routine && data.state.routine.date === key ? data.state.routine : { date: key, done: 0 }
  r.done = Math.max(0, Math.min(data.config.routine.length, r.done + delta))
  data.state.routine = r
}

// ---------- 時間帯（6.1） ----------

// 就寝リマインドの時刻（就寝の30分前）。就寝が正午より前なら日付をまたいだものとする
function presleepStart(cfg, day) {
  let b = at(day, cfg.bedtime)
  if (cfg.bedtime < '12:00') b = addDays(b, 1)
  return addMinutes(b, -30)
}

function bedtimeAt(cfg, day) {
  const b = at(day, cfg.bedtime)
  return cfg.bedtime < '12:00' ? addDays(b, 1) : b
}

// 就寝前の時刻 t から見た「明日」（就寝が日付をまたいでも、次の朝の日付になる）
function wakeDayAfter(t) {
  return startOfDay(addMinutes(t, 12 * 60))
}

// 次の起床（今日の段階0がまだ先なら今日）。なければ null（2週間先まで探す）
function nextWake(data, now) {
  for (let i = 0; i < 14; i++) {
    const day = addDays(startOfDay(now), i)
    const s0 = at(day, data.config.stages[0].time)
    if (s0 <= now) continue
    if (isWakeDay(data, day)) return { day, start: s0 }
  }
  return null
}

// 今の時間帯と、次に切り替わる時刻
function phaseAt(data, now) {
  const cfg = data.config
  const today = startOfDay(now)
  const s0 = at(today, cfg.stages[0].time)
  const noon = at(today, cfg.noon)
  const session = sessionOf(data, today)
  const wakeToday = isWakeDay(data, today)
  const dep = dayConfig(cfg, today).departure
  const depTime = dep ? at(today, dep) : null
  const dayEnd = at(today, cfg.daytimeEnd)
  const pre = presleepStart(cfg, today)

  if (now < s0 && !isCheckedIn(session)) {
    // 前の晩の続き。就寝が日付をまたぐ設定なら、まだ「夜」のこともある
    const yPre = presleepStart(cfg, addDays(today, -1))
    if (now < yPre) return { phase: 'night', until: yPre }
    return { phase: 'presleep', until: s0 }
  }
  if (wakeToday && !session && now < noon) {
    const next = cfg.stages.map(s => at(today, s.time)).find(t => t > now)
    return { phase: 'waking', until: next || noon }
  }
  if (isCheckedIn(session) && depTime && now < depTime) return { phase: 'morning', until: depTime }
  if (now < dayEnd) return { phase: 'day', until: dayEnd }
  if (now < pre) return { phase: 'night', until: pre }
  const nw = nextWake(data, now)
  const tomorrowS0 = at(addDays(today, 1), cfg.stages[0].time)
  return { phase: 'presleep', until: nw && nw.start < tomorrowS0 ? nw.start : tomorrowS0 }
}

// ---------- Todo（既存アプリのデータを読み取り専用で使う） ----------

function compareDue(a, b) {
  const x = a.due ? new Date(a.due).getTime() : Infinity
  const y = b.due ? new Date(b.due).getTime() : Infinity
  if (x !== y) return x < y ? -1 : 1
  const ca = a.createdAt || ''
  const cb = b.createdAt || ''
  return ca < cb ? -1 : ca > cb ? 1 : 0
}

// { ok, items, error }。書き込みは一切しない
async function loadTodos(cfg) {
  try {
    const f = fm()
    const p = f.joinPath(f.documentsDirectory(), cfg.todoFile)
    const r = await readJSON(p)
    if (!r.value) return { ok: false, items: [], error: r.broken ? 'Todoのデータが壊れています' : 'Todoのデータがありません' }
    const todos = Array.isArray(r.value.todos) ? r.value.todos : []
    const items = todos.filter(t => t && !t.done && t.title).sort(compareDue)
    return { ok: true, items }
  } catch (e) {
    return { ok: false, items: [], error: 'Todoを読み込めません' }
  }
}

// Todo の期限表示（既存アプリと同じ書き方）
function fmtDue(t, now) {
  if (!t.due) return ''
  const d = new Date(t.due)
  const diff = Math.round((startOfDay(d) - startOfDay(now)) / 86400000)
  let day
  if (diff === 0) day = '今日'
  else if (diff === -1) day = '昨日'
  else if (diff === 1) day = '明日'
  else day = (d.getMonth() + 1) + '/' + d.getDate()
  if (t.allDay) return diff === 0 ? '今日' : day
  return diff === 0 ? fmtTime(d) : day + ' ' + fmtTime(d)
}

// 期限切れか（終日は日付が過ぎたら）
function isOverdue(t, now) {
  if (!t.due) return false
  const d = new Date(t.due)
  return t.allDay ? startOfDay(d) < startOfDay(now) : d < now
}

// 指定日の最初の予定・Todo（Todo アプリがカレンダーから取り込んだ予定も含む）
function firstTodoOn(items, day) {
  const from = startOfDay(day)
  const to = addDays(from, 1)
  return items.find(t => t.due && new Date(t.due) >= from && new Date(t.due) < to) || null
}

// ---------- URL ----------

// 本体スクリプト（起床.js）を開く URL。ウィジェットや通知から使う
function appURL(params) {
  const q = Object.keys(params || {}).map(k => k + '=' + encodeURIComponent(params[k])).join('&')
  return 'scriptable:///run/' + encodeURIComponent('起床') + (q ? '?' + q : '')
}

function shortcutURL(name) {
  return 'shortcuts://run-shortcut?name=' + encodeURIComponent(name)
}

module.exports = {
  DAY_KEYS, DAY_NAMES, PHASE_NAMES, DEFAULT_CONFIG,
  pad2, dateKey, startOfDay, addDays, addMinutes, at, isTime, normalizeTime, fmtTime, fmtDate, fmtDuration, shortTime, isoLocal, dayLabel,
  loadAll, saveConfig, saveState, saveSessions, normalizeConfig, pathOf,
  dayConfig, isRuleWakeDay, isWakeDay, planTargetDay, decidePlan, holidayName,
  sessionOf, isCheckedIn, stageAt, scoreOf, stageLabel, checkin, canCheckin, settleMissed, recentSessions, average, streak, routineTotal, wakeTime, alarmsText,
  tasksFor, setTasks, overslept, weatherFor,
  routineStatus, advanceRoutine,
  presleepStart, bedtimeAt, wakeDayAfter, nextWake, phaseAt,
  loadTodos, fmtDue, isOverdue, firstTodoOn,
  appURL, shortcutURL,
}
