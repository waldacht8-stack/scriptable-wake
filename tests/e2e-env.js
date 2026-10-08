// 通しのテスト：Scriptable の環境をまねて、iPhone のスクリプトを最初から最後まで動かす
const out = []
let failures = 0, passes = 0
const log = (...a) => out.push(a.join(' '))
function ok(name, cond, detail) { if (cond) { passes++ } else { failures++; log('FAIL ' + name + (detail !== undefined ? '  → ' + JSON.stringify(detail) : '')) } }
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const PARAMS = ['module', 'importModule', 'args', 'config', 'Script', 'FileManager', 'Notification', 'ListWidget', 'Font', 'Color', 'Size', 'Rect', 'Point', 'Path', 'DrawContext', 'Timer', 'Calendar', 'CalendarEvent', 'UITable', 'UITableRow', 'Alert', 'Safari', 'console', 'SFSymbol', 'Request', 'Location', 'Pasteboard', 'WebView', 'Speech']

// ---------- 時計 ----------
const RealDate = Date
let NOW = 0
function setNow(y, mo, d, h, mi) { NOW = new RealDate(y, mo - 1, d, h, mi).getTime() }
class FakeDate extends RealDate { constructor(...a) { a.length ? super(...a) : super(NOW) } static now() { return NOW } }

// ---------- まねる部品 ----------
const FS = {}, DIRS = new Set(['/icloud'])
const fmObj = {
  documentsDirectory: () => '/icloud',
  joinPath: (a, b) => a.replace(/\/$/, '') + '/' + b,
  fileExists: p => p in FS || DIRS.has(p),
  isFileDownloaded: () => true,
  downloadFileFromiCloud: async () => {},
  readString: p => { if (!(p in FS)) throw new Error('no file ' + p); return FS[p] },
  writeString: (p, s) => { FS[p] = String(s) },
  createDirectory: p => { DIRS.add(p) },
  copy: (a, b) => { FS[b] = FS[a] },
  remove: p => { delete FS[p] },
}
const FileManager = { iCloud: () => fmObj, local: () => fmObj }

let PENDING = [], DELIVERED = []
class Notification {
  constructor() { this.actions = [] }
  addAction(t, u) { this.actions.push([t, u]) }
  setTriggerDate(d) { this.at = d }
  async schedule() { PENDING = PENDING.filter(n => n.identifier !== this.identifier || !this.identifier); if (this.at) PENDING.push(this); else DELIVERED.push(this) }
  static async allPending() { return PENDING.slice() }
  static async removePending(ids) { PENDING = PENDING.filter(n => ids.indexOf(n.identifier) < 0) }
}

let RUN = null // 実行ごとの結果
const Script = { setShortcutOutput: v => { RUN.output = v }, setWidget: w => { RUN.widget = w }, complete: () => { RUN.completed = true } }

let ALERTS = [] // 確認画面への答え：{ i: 押すボタンの番号, text: 入力する文字 }
class Alert {
  constructor() { this.actions = []; this.fields = [] }
  addAction(t) { this.actions.push(t) } addDestructiveAction(t) { this.actions.push(t) } addCancelAction(t) { this.cancel = t }
  addTextField(p, v) { this.fields.push(v) }
  async ask() { RUN.alerts.push(this.title); const a = ALERTS.shift(); this.answer = a; return a ? a.i : -1 }
  present() { return this.ask() } presentSheet() { return this.ask() } presentAlert() { return this.ask() }
  textFieldValue() { return this.answer && this.answer.text !== undefined ? this.answer.text : (this.fields[0] || '') }
}
const Safari = { open: u => { RUN.opened.push(u) } }
const Speech = { speak: async s => { RUN.spoken.push(s) } }
const Pasteboard = { pasteString: () => '' }
let HOLIDAYS = []
let FAIL_API = false
const Calendar = { forEvents: async () => [{ title: '日本の祝日' }] }
const CalendarEvent = { between: async (s) => { const k = s.getFullYear() + '-' + String(s.getMonth() + 1).padStart(2, '0') + '-' + String(s.getDate()).padStart(2, '0'); return HOLIDAYS.indexOf(k) >= 0 ? [{ title: 'スポーツの日', isAllDay: true }] : [] } }
const Location = { setAccuracyToThreeKilometers() {}, current: async () => ({ latitude: 35.68123, longitude: 139.76712 }), reverseGeocode: async () => [{ administrativeArea: '東京都', locality: '千代田区' }] }
class Request {
  constructor(u) { this.url = u; this.response = { statusCode: 200 } }
  async loadJSON() { RUN.requests.push(this.url); if (this.url.indexOf('forecast_days=2') >= 0) return { daily: { weather_code: [61, 1], temperature_2m_max: [21.6, 25], temperature_2m_min: [14.2, 16], precipitation_probability_max: [70, 10] } }; return { daily: { weather_code: [61], temperature_2m_max: [21.6], temperature_2m_min: [14.2], precipitation_probability_max: [70] } } }
  async loadString() {
    RUN.requests.push(this.url)
    if (this.url.indexOf('api.github.com') >= 0 && FAIL_API) { this.response.statusCode = 403; return '{"message":"rate limit"}' }
    if (this.url.indexOf('api.github.com') >= 0) return JSON.stringify({ sha: 'abc1234def', commit: { message: 'テスト版' } })
    if (this.url.split('?')[0].endsWith('manifest.json')) return MANIFEST
    const name = decodeURIComponent(this.url.split('/').pop().split('?')[0])
    if (SOURCES[name] !== undefined) return SOURCES[name]
    this.response.statusCode = 404; return ''
  }
}
function Timer() {}
Timer.prototype.schedule = function (fn) { this.t = setTimeout(fn, this.timeInterval || 0) }
Timer.prototype.invalidate = function () { clearTimeout(this.t) }

// ウィジェット
class Stack {
  constructor() { this.items = [] }
  addText(s) { RUN && RUN.texts.push(String(s)); return { centerAlignText() {}, rightAlignText() {} } }
  addDate(d) { RUN && RUN.texts.push('[timer]'); if (!(d instanceof RealDate) || isNaN(d)) throw new Error('timer に日時以外'); return { applyTimerStyle() {}, centerAlignText() {}, rightAlignText() {} } }
  addStack() { return new Stack() } addSpacer() {} addImage(i) { if (!i) throw new Error('画像が空'); return {} }
  layoutHorizontally() {} layoutVertically() {} centerAlignContent() {}
}
class ListWidget extends Stack { async presentAccessoryRectangular() {} async presentAccessoryCircular() {} async presentAccessoryInline() {} }
function Font(name, size) { this.name = name; this.size = size }
Font.boldSystemFont = Font.systemFont = Font.semiboldSystemFont = s => new Font('system', s)
function Color(hex, a) { if (!/^#?[0-9A-Fa-f]{6}$/.test(hex)) throw new Error('色の指定が不正: ' + hex); this.hex = hex; this.a = a }
Color.white = () => new Color('FFFFFF'); Color.dynamic = (a) => a
function Size(w, h) { this.width = w; this.height = h }
function Point(x, y) { if (!isFinite(x) || !isFinite(y)) throw new Error('点の座標が数でない'); this.x = x; this.y = y }
function Rect(x, y, w, h) { Object.assign(this, { x, y, w, h }) }
function Path() { this.n = 0 }
Path.prototype.move = Path.prototype.addLine = function () { this.n++ }
Path.prototype.addLines = function (p) { this.n += p.length } ; Path.prototype.closeSubpath = function () {}; Path.prototype.addRoundedRect = function () { this.n++ }
function DrawContext() {}
DrawContext.prototype = { set size(s) { this.s = s }, setLineWidth() {}, setStrokeColor() {}, setFillColor() {}, addPath() {}, strokePath() {}, fillPath() {}, strokeEllipse() {}, setFont() {}, setTextColor() {}, setTextAlignedRight() {}, setTextAlignedCenter() {}, drawTextInRect() {}, getImage() { return { img: true } } }
const SFSymbol = { named: n => ({ image: { symbol: n } }) }

// 表の画面：組み立てだけ行い、すぐ閉じる（ホーム画面の上には開けないことがあるのは実機で判明済み）
class UITable { constructor() { this.rows = [] } addRow(r) { this.rows.push(r) } removeAllRows() { this.rows = [] } reload() {} async present() { RUN.tables.push(this.rows.length) } }
class UITableRow { addText() { return { centerAligned() {} } } addImage() { return { centerAligned() {} } } }

// WebView：ボタン操作を順に返し、なくなったら閉じる
let WV_ACTIONS = []
class WebView {
  async loadHTML(h) { RUN.html = h; const js = h.slice(h.indexOf('<script>') + 8, h.lastIndexOf('<' + '/script>')); new Function(js) }
  present() { return new Promise(res => { this.close = res; RUN.webviews++ }) }
  async evaluateJavaScript(js, cb) {
    if (js.indexOf('wait(') === 0) {
      if (!WV_ACTIONS.length) { setTimeout(() => this.close(), 0); return new Promise(() => {}) }
      return WV_ACTIONS.shift()
    }
    if (js.indexOf('render(') === 0) { RUN.lastModel = JSON.parse(js.slice(7, -1)); return null }
    return null
  }
}

const consoleStub = { log() {}, warn() {}, error: (...a) => { RUN && RUN.console.push(a.map(x => x && x.message ? x.message : String(x)).join(' ')) } }

// ---------- スクリプトの実行 ----------
function compile(src) { return new AsyncFunction(...PARAMS, src) }
async function run(name, opt) {
  const o = opt || {}
  RUN = { output: undefined, widget: null, alerts: [], opened: [], spoken: [], requests: [], texts: [], tables: [], console: [], webviews: 0, error: null }
  const config = { runsInApp: !!o.app, runsInWidget: !!o.widget, runsWithSiri: !!o.siri, widgetFamily: o.family || null }
  const args = { shortcutParameter: o.param === undefined ? null : o.param, plainTexts: [], queryParameters: o.query || {}, widgetParameter: o.widgetParam || null }
  const cache = {}
  const env = { args, config, Script, FileManager, Notification, ListWidget, Font, Color, Size, Rect, Point, Path, DrawContext, Timer, Calendar, CalendarEvent, UITable, UITableRow, Alert, Safari, console: consoleStub, SFSymbol, Request, Location, Pasteboard, WebView, Speech }
  const importModule = p => {
    const n = p.split('/').pop() + '.js'
    if (cache[n]) return cache[n]
    if (SOURCES[n] === undefined) throw new Error('部品がありません: ' + p)
    const m = { exports: {} }
    compile(SOURCES[n])(m, importModule, ...PARAMS.slice(2).map(k => env[k]))
    cache[n] = m.exports
    return m.exports
  }
  try {
    await compile(SOURCES[name])({ exports: {} }, importModule, ...PARAMS.slice(2).map(k => env[k]))
  } catch (e) { RUN.error = e }
  return RUN
}

// データの読み書き
const P = n => '/icloud/WakeApp/' + n
const readJSON = n => FS[P(n)] ? JSON.parse(FS[P(n)]) : null
const sessions = () => (readJSON('sessions.json') || { sessions: [] }).sessions
const state = () => readJSON('state.json') || {}
const cfg = () => readJSON('config.json') || {}
const logLines = () => (FS[P('debug-log.txt')] || '').split('\n').filter(x => x)
