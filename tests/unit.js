// テスト用：Scriptable の API を最小限まねる
const out = []
const log = (...a) => out.push(a.join(' '))
let failures = 0
function eq(name, a, b) { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) failures++; log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : ' got=' + JSON.stringify(a) + ' want=' + JSON.stringify(b))) }
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const PARAMS = ['module', 'importModule', 'args', 'config', 'Script', 'FileManager', 'Notification', 'ListWidget', 'Font', 'Color', 'Size', 'Rect', 'Point', 'Path', 'DrawContext', 'Timer', 'Calendar', 'CalendarEvent', 'UITable', 'UITableRow', 'Alert', 'Safari', 'console', 'SFSymbol', 'Request', 'Location', 'Pasteboard', 'DrawContext2']
function compile(name, src) { try { return new AsyncFunction(...PARAMS, src) } catch (e) { failures++; log('SYNTAX ' + name + ': ' + e.message); return null } }
const texts = []
class Stack { constructor() { this.items = [] } addText(s) { texts.push(s); return { centerAlignText() {}, rightAlignText() {} } } addDate(d) { texts.push('[timer ' + d.toTimeString().slice(0, 5) + ']'); return { applyTimerStyle() {}, centerAlignText() {}, rightAlignText() {} } } addStack() { return new Stack() } addSpacer() {} addImage(i) { texts.push('[' + (i && i.symbol || 'img') + ']'); return {} } layoutHorizontally() {} layoutVertically() {} centerAlignContent() {} }
class ListWidget extends Stack {}
const Font = function () {}; Font.boldSystemFont = Font.systemFont = Font.semiboldSystemFont = () => ({})
const Color = function () {}; Color.white = () => ({}); Color.dynamic = () => ({})
function Size() {} function Rect() {} function Point() {}
function Path() { this.addLines = this.move = this.addLine = this.closeSubpath = () => {} }
function DrawContext() { this.setLineWidth = this.setStrokeColor = this.setFillColor = this.fillPath = this.strokeEllipse = this.addPath = this.strokePath = () => {}; this.getImage = () => ({}) }
const env = { args: {}, config: {}, Script: {}, FileManager: {}, Notification: {}, ListWidget, Font, Color, Size, Rect, Point, Path, DrawContext, Timer: function () {}, Calendar: {}, CalendarEvent: {}, UITable: function () {}, UITableRow: function () {}, Alert: function () {}, Safari: {}, console, SFSymbol: { named: n => ({ image: { symbol: n } }) }, Request: function () {}, Location: {}, Pasteboard: {} }
function load(name) {
  const f = compile(name, SOURCES[name]); if (!f) return null
  const module = { exports: {} }
  f(module, () => null, ...PARAMS.slice(2).map(k => env[k]))
  return module.exports
}
async function main() {
  // 構文チェック（全ファイル）
  for (const n in SOURCES) if (compile(n, SOURCES[n])) log('SYNTAX OK ' + n)
  const core = load('core.js'), widget = load('dawn-widget.js')(core, load('dawn.js'))
  const mk = () => ({ config: core.normalizeConfig(null), state: { plan: null, skipDates: [], routine: null, belongings: null }, sessions: [], problems: [] })
  const T = (h, m, d) => new Date(2026, 9, d || 8, h, m) // 2026-10-08 は木曜
  let data = mk()
  eq('05:00 就寝前', core.phaseAt(data, T(5, 0)).phase, 'presleep')
  eq('07:05 起床中', core.phaseAt(data, T(7, 5)).phase, 'waking')
  eq('07:05 次の切替=7:10', core.fmtTime(core.phaseAt(data, T(7, 5)).until), '7:10')
  eq('07:15 は2つ目(index1)', core.stageAt(data.config, T(7, 15)), 1)
  eq('06:40 自力', core.stageAt(data.config, T(6, 40)), -1)
  let r = core.checkin(data, T(21, 0, 7), '', 'nfc')
  eq('前夜21時のチェックインは時間外', r.result, 'closed')
  r = core.checkin(data, T(7, 4), 'x', 'barcode')
  eq('コード未登録→登録', r.result, 'register')
  data.config.checkinCode = '4901'
  eq('違うコード', core.checkin(data, T(7, 4), '9999', 'barcode').result, 'mismatch')
  r = core.checkin(data, T(7, 15), '4901', 'barcode')
  eq('7:15 チェックイン', [r.result, r.session.wokeStage, r.session.score], ['ok', 1, 85]); eq('表示は段階2', core.stageLabel(data.config, 1), '段階2（ふつう）'); eq('文', core.alarmsText(data.config), '7:00 起床・アラーム4つ（7:30まで）')
  eq('2回目は済み', core.checkin(data, T(7, 16), '4901', 'barcode').result, 'already')
  eq('07:20 朝', core.phaseAt(data, T(7, 20)).phase, 'morning')
  eq('08:00 昼間', core.phaseAt(data, T(8, 0)).phase, 'day')
  eq('19:00 夜', core.phaseAt(data, T(19, 0)).phase, 'night')
  eq('23:10 就寝前', core.phaseAt(data, T(23, 10)).phase, 'presleep')
  eq('23:10 次の切替=翌6:50', core.fmtDate(core.phaseAt(data, T(23, 10)).until) + core.fmtTime(core.phaseAt(data, T(23, 10)).until), '10/9（金）7:00')
  eq('金曜夜→土曜は起床なし→次は月曜', core.dateKey(core.nextWake(data, T(23, 10, 9)).day), '2026-10-12')
  // ルーティンと遅刻
  core.advanceRoutine(data, T(7, 10), 2)
  const st = core.routineStatus(data, T(7, 30))
  eq('ルーティン 2/5 残り30分', [st.done, st.restMinutes], [2, 30])
  eq('7:30 + 30分 → 15分遅れ', st.lateMinutes, 15)
  // 未チェックイン
  data = mk(); data.state.plan = { date: '2026-10-08', wake: true, reason: '' }
  eq('11:00 はまだ判定しない', core.settleMissed(data, T(11, 0)), 0)
  eq('12:00 で未チェックイン', core.settleMissed(data, T(12, 0)), 1)
  eq('12:30 は昼間', core.phaseAt(data, T(12, 30)).phase, 'day')
  eq('判定は1回だけ', core.settleMissed(data, T(13, 0)), 0)
  // 準備の対象日
  eq('20:00 の準備は明日', core.dateKey(core.planTargetDay(data.config, T(20, 0))), '2026-10-09')
  eq('02:00 の準備は今日', core.dateKey(core.planTargetDay(data.config, T(2, 0))), '2026-10-08')
  // 就寝が日付をまたぐ設定
  data = mk(); data.config.bedtime = '01:00'
  eq('就寝1:00 なら 0:10 は夜', core.phaseAt(data, T(0, 10)).phase, 'night')
  eq('就寝1:00 なら 0:40 は就寝前', core.phaseAt(data, T(0, 40)).phase, 'presleep')
  eq('就寝1:00 なら 23:50 は夜', core.phaseAt(data, T(23, 50)).phase, 'night')
  eq('wakeDayAfter 0:40 → 当日', core.dateKey(core.wakeDayAfter(T(0, 40))), '2026-10-08')
  eq('時刻入力 7:5', core.normalizeTime('7:05'), '07:05')
  eq('時刻入力 0705', core.normalizeTime('0705'), '07:05')
  eq('時刻入力 24:00', core.normalizeTime('24:00'), '00:00')
  data = mk(); data.config.bedtime = '00:00'
  eq('就寝0:00 なら 23:20 は夜', core.phaseAt(data, T(23, 20)).phase, 'night')
  eq('就寝0:00 なら 23:40 は就寝前', core.phaseAt(data, T(23, 40)).phase, 'presleep')
  eq('就寝0:00 なら 0:20 は就寝前', core.phaseAt(data, T(0, 20)).phase, 'presleep')
  // ウィジェット（全時間帯 × 全種類）
  data = mk(); data.config.checkinCode = '1'
  core.loadTodos = async () => ({ ok: true, items: [{ title: '記念日ご飯予約', due: '2026-10-07T15:00:00.000Z', allDay: true }, { title: '長い長い長い名前のTodoが続く場合', due: null }] })
  const cases = [['waking', T(7, 5)], ['morning', T(7, 20)], ['day', T(9, 0)], ['night', T(20, 0)], ['presleep', T(23, 10)]]
  for (const [name, now] of cases) {
    if (name === 'morning') core.checkin(data, T(7, 15), '1', 'barcode')
    for (const f of ['accessoryInline', 'accessoryRectangular', 'accessoryCircular']) {
      texts.length = 0
      try { const w = await widget.build(data, f, now, null); log('W ' + name + ' ' + f.replace('accessory', '') + ': ' + texts.join(' | ') + '  url=' + decodeURIComponent(w.url) + ' refresh=' + w.refreshAfterDate.toTimeString().slice(0, 5)) } catch (e) { failures++; log('FAIL widget ' + name + ' ' + f + ': ' + e.stack) }
    }
  }
  core.loadTodos = async () => ({ ok: false, items: [], error: 'x' })
  texts.length = 0; await widget.build(data, 'accessoryRectangular', T(9, 0), 'todo'); log('W todo読めない: ' + texts.join(' | '))
  await extra()
  await extra2()
  await extra3()
  await extra4()
  await extra5()
  log(failures ? 'FAILURES: ' + failures : 'ALL PASSED')
}
main().catch(e => log('CRASH ' + e.stack)).finally(() => { document.body.innerText = out.join('\n') })
const sent = []
function Notif() { this.addAction = () => {}; this.setTriggerDate = d => { this.at = d }; this.schedule = async () => { sent.push(this) } }
Notif.allPending = async () => []; Notif.removePending = async () => {}
env.Notification = Notif
async function extra() {
  const core = load('core.js'), notify = load('notify.js')
  const T = (h, m, d) => new Date(2026, 9, d || 8, h, m)
  const mk = () => ({ config: core.normalizeConfig(null), state: { plan: null, skipDates: [], weeklySent: null, watch: null }, sessions: [], problems: [] })
  let data = mk()
  sent.length = 0
  eq('木曜は振り返りなし', await notify.scheduleWeekly(core, data, T(20, 0)), false)
  eq('日曜20時→21時に予約', [await notify.scheduleWeekly(core, data, T(20, 0, 11)), sent[0] && sent[0].at.getHours()], [true, 21])
  eq('日曜21:30 予約済みなら送らない', await notify.scheduleWeekly(core, data, T(21, 30, 11)), false)
  data = mk(); sent.length = 0
  eq('日曜21:30 未送信ならすぐ送る', [await notify.scheduleWeekly(core, data, T(21, 30, 11)), sent[0] && sent[0].at], [true, undefined])
  data = mk(); sent.length = 0
}
async function extra2() {
  env.console = { log, warn: log, error: (...a) => log('ERR', ...a.map(x => x && x.stack ? x.stack : x)) }
  const core = load('core.js'), notify = load('notify.js')
  const actions = load('actions.js')(core, notify)
  let data
  core.loadAll = async () => data
  core.saveState = core.saveSessions = core.saveConfig = () => {}
  const RealDate = Date
  const at = (d, h, m) => { const t = new RealDate(2026, 9, d, h, m).getTime(); globalThis.Date = class extends RealDate { constructor(...a) { a.length ? super(...a) : super(t) } static now() { return t } } }
  data = { config: core.normalizeConfig(null), state: { plan: null, skipDates: [], weeklySent: null }, sessions: [], problems: [] }
  at(7, 20, 0); eq('水曜20時の準備→ON', await actions.run('plan'), 'ON')
  at(9, 20, 0); eq('金曜20時の準備（翌土曜）→OFF', await actions.run('plan'), 'OFF')
  at(8, 7, 15); eq('未登録コード→REGISTERED', await actions.run('checkin:4901'), 'REGISTERED')
  data.state.plan = { date: '2026-10-08', wake: true, reason: '' }; data.sessions = []
  eq('違うコード→NG', await actions.run('checkin:1234'), 'NG')
  sent.length = 0; eq('正しいコード→OK', await actions.run('checkin:4901'), 'OK'); log('通知' + sent.length + ': ' + sent.map(n => n.title).join(' || '))
  eq('空のコード→NG', (data.config.checkinCode = '', await actions.run('checkin:')), 'NG')
  data.sessions = []; at(8, 23, 0); eq('夜23時のタップ→NG', await actions.run('tap'), 'NG')
  at(8, 6, 30); eq('6:30 自力起床のタップ→OK', [await actions.run('tap'), data.sessions[0] && data.sessions[0].score, data.sessions[0] && data.sessions[0].method], ['OK', 100, 'widget'])
  data.sessions = []; eq('6:30 は受付中', core.canCheckin(data, new Date()), true)
  at(8, 4, 30); eq('4:30 は受付前', core.canCheckin(data, new Date()), false)
  globalThis.Date = RealDate
}
async function extra3() {
  const core = load('core.js'), notify = load('notify.js'), weather = load('weather.js')
  eq('天気の文', weather.summarize({ daily: { weather_code: [61], temperature_2m_max: [21.6], temperature_2m_min: [14.2], precipitation_probability_max: [70] } }), '雨 22℃/14℃ 雨70%　☂ 傘を忘れずに')
  eq('天気の文（晴れ）', weather.summarize({ daily: { weather_code: [1], temperature_2m_max: [25], temperature_2m_min: [16], precipitation_probability_max: [10] } }), '晴れ 25℃/16℃ 雨10%')
  eq('壊れた応答', weather.summarize({}), null)
  eq('場所なしは取らない', await weather.today(core.normalizeConfig(null)), null)
  const fakeWeather = { today: async () => '晴れ 25℃/16℃ 雨10%' }
  const actions = load('actions.js')(core, notify, fakeWeather)
  let data
  core.loadAll = async () => data
  core.saveState = core.saveSessions = core.saveConfig = () => {}
  const RealDate = Date
  const at = (d, h, m) => { const t = new RealDate(2026, 9, d, h, m).getTime(); globalThis.Date = class extends RealDate { constructor(...a) { a.length ? super(...a) : super(t) } static now() { return t } } }
  data = { config: core.normalizeConfig({ ownRule: '23時にスマホを置く' }), state: { plan: { date: '2026-10-08', wake: true, reason: '' }, skipDates: [], weeklySent: null }, sessions: [], problems: [] }
  core.setTasks(data, new RealDate(2026, 9, 8), ['ゴミ出し', '', '振込'])
  eq('やることは空を除く', core.tasksFor(data, new RealDate(2026, 9, 8)), ['ゴミ出し', '振込'])
  at(8, 7, 35); eq('7:35 チェックイン（段階4）', await actions.run('tap'), 'OK')
  log('知らせ: ' + actions.lastMessage().replace(/\n/g, ' / '))
  eq('天気を保存', core.weatherFor(data, new Date()), '晴れ 25℃/16℃ 雨10%')
  eq('寝坊ならルールを表示', actions.lastMessage().indexOf('自分ルール：23時にスマホを置く') >= 0, true)
  data.sessions = []; at(8, 7, 5); await actions.run('tap')
  eq('段階1ならルールなし', actions.lastMessage().indexOf('自分ルール') < 0, true)
  globalThis.Date = RealDate
}
async function extra4() {
  const core = load('core.js'), notify = load('notify.js')
  const actions = load('actions.js')(core, notify)
  let data
  core.loadAll = async () => data
  core.saveState = core.saveSessions = core.saveConfig = () => {}
  const RealDate = Date
  const at = (d, h, m) => { const t = new RealDate(2026, 9, d, h, m).getTime(); globalThis.Date = class extends RealDate { constructor(...a) { a.length ? super(...a) : super(t) } static now() { return t } } }
  data = { config: core.normalizeConfig(null), state: { plan: { date: '2026-10-09', wake: false, reason: '' }, skipDates: ['2026-10-09'], pendingOff: '2026-10-09' }, sessions: [], problems: [] }
  at(8, 21, 0); eq('明日だけオフ後のタップ→OK（アラームをオフ）', await actions.run('tap'), 'OK')
  eq('印は1回で消える', data.state.pendingOff, null)
  eq('記録は増えない', data.sessions.length, 0)
  eq('もう一度タップ→NG（夜は時間外）', await actions.run('tap'), 'NG')
  globalThis.Date = RealDate
}
async function extra5() {
  // ホーム画面のページ内 JavaScript が文法として正しいか（4デザイン × 時間帯）
  const core = load('core.js'), dawn = load('dawn.js')
  const stUi = { tasks: () => {}, toggleSkip: () => {}, readDebugLog: () => ['2026/10/8 2:01:30  起動: ボタン: settings', '2026/10/8 2:00:57  起動: ホーム画面を表示'] }
  const home = load('dawn-home.js')(core, dawn, stUi, {}, load('settings.js')(core, stUi, {}, dawn))
  core.loadTodos = async () => ({ ok: true, items: [{ title: 'テスト', due: null }] })
  const RealDate = Date
  for (const th of ['dawn', 'kissa', 'station', 'sora']) {
    for (const [h, m] of [[7, 5], [7, 20], [9, 0], [21, 0], [23, 50]]) {
      const t = new RealDate(2026, 9, 8, h, m).getTime(); globalThis.Date = class extends RealDate { constructor(...a) { a.length ? super(...a) : super(t) } static now() { return t } }
      const data = { config: core.normalizeConfig({ bedtime: '00:00', theme: th }), state: { plan: { date: '2026-10-08', wake: true, reason: '' }, skipDates: [], routine: { date: '2026-10-08', done: 1 } }, sessions: h >= 7 && m >= 20 || h > 7 ? [{ date: '2026-10-08', checkinAt: '2026-10-08T07:12:00+09:00', wokeStage: 1, score: 85, method: 'widget' }] : [], problems: [] }
      const html = home.page(await home.model(data, new Date()))
      const js = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('<' + '/script>'))
      try { new Function(js); } catch (e) { failures++; log('FAIL ページJS ' + th + ' ' + h + ':' + m + ' ' + e.message) }
    }
  }
  globalThis.Date = RealDate
  log('PASS ページJS 20通り')
}
