let THEME = new URLSearchParams(location.search).get('t') || 'dawn'
// ブラウザで Scriptable のウィジェット描画をまねて、見た目を確認する
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const PARAMS = ['module', 'importModule', 'args', 'config', 'Script', 'FileManager', 'Notification', 'ListWidget', 'Font', 'Color', 'Size', 'Rect', 'Point', 'Path', 'DrawContext', 'Timer', 'Calendar', 'CalendarEvent', 'UITable', 'UITableRow', 'Alert', 'Safari', 'console', 'SFSymbol', 'Request', 'Location', 'Pasteboard']
let NOW = Date.now()

class Font {
  constructor(name, size) { const fam = /Maru/.test(name) ? '"Zen Maru Gothic", sans-serif' : /Sans/.test(name) ? '"Noto Sans JP", sans-serif' : '"Shippori Mincho", serif'; this.css = (/W6/.test(name) ? '700 ' : '400 ') + size + 'px ' + fam }
  static systemFont(s) { return { css: '400 ' + s + 'px -apple-system, "Hiragino Sans", sans-serif' } }
  static boldSystemFont(s) { return { css: '700 ' + s + 'px -apple-system, "Hiragino Sans", sans-serif' } }
  static semiboldSystemFont(s) { return { css: '600 ' + s + 'px -apple-system, "Hiragino Sans", sans-serif' } }
}
class Color { constructor(hex, a) { this.hex = hex; this.a = a === undefined ? 1 : a } css() { const h = this.hex.replace('#', ''); return 'rgba(' + parseInt(h.slice(0, 2), 16) + ',' + parseInt(h.slice(2, 4), 16) + ',' + parseInt(h.slice(4, 6), 16) + ',' + this.a + ')' } static white() { return new Color('FFFFFF') } }
function Size(w, h) { this.width = w; this.height = h }
function Point(x, y) { this.x = x; this.y = y }
function Rect(x, y, w, h) { Object.assign(this, { x, y, w, h }) }
class Path { constructor() { this.ops = [] } move(p) { this.ops.push(['m', p]) } addLine(p) { this.ops.push(['l', p]) } addLines(ps) { ps.forEach((p, i) => this.ops.push([i ? 'l' : 'm', p])) } closeSubpath() { this.ops.push(['z']) } }
class DrawContext {
  set size(s) { this.c = document.createElement('canvas'); this.c.width = s.width * 3; this.c.height = s.height * 3; this.g = this.c.getContext('2d'); this.g.scale(3, 3); this.s = s }
  addPath(p) { this.p = p }
  trace() { const g = this.g; g.beginPath(); for (const o of this.p.ops) { if (o[0] === 'm') g.moveTo(o[1].x, o[1].y); else if (o[0] === 'l') g.lineTo(o[1].x, o[1].y); else g.closePath() } }
  setFillColor(c) { this.g.fillStyle = c.css() } setStrokeColor(c) { this.g.strokeStyle = c.css() } setLineWidth(w) { this.g.lineWidth = w }
  fillPath() { this.trace(); this.g.fill() } strokePath() { this.trace(); this.g.stroke() }
  getImage() { return { url: this.c.toDataURL(), size: this.s } }
}
class Stack {
  constructor(el) { this.el = el || document.createElement('div'); this.el.style.cssText = 'display:flex;flex-direction:column;min-width:0'; this.spacing = 0 }
  set spacing(v) { if (this.el) this.el.style.gap = v + 'px' }
  layoutHorizontally() { this.el.style.flexDirection = 'row' } layoutVertically() { this.el.style.flexDirection = 'column' }
  centerAlignContent() { this.el.style.alignItems = 'center' }
  addStack() { const s = new Stack(); this.el.appendChild(s.el); return s }
  addSpacer(n) { const d = document.createElement('div'); d.style.cssText = n === undefined ? 'flex:1' : 'flex:none;width:' + n + 'px;height:' + n + 'px'; this.el.appendChild(d) }
  addText(t) { return this.txt(t) }
  addDate(d) { const ms = Math.max(0, d - NOW); const m = Math.floor(ms / 60000); const s = Math.floor(ms / 1000) % 60; const h = Math.floor(m / 60); return this.txt(h ? h + ':' + String(m % 60).padStart(2, '0') + ':' + String(s).padStart(2, '0') : m + ':' + String(s).padStart(2, '0'), true) }
  txt(t, timer) { const e = document.createElement('div'); e.textContent = t; e.style.cssText = 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0'; this.el.appendChild(e); return { set font(f) { e.style.font = f.css }, set lineLimit(v) {}, set minimumScaleFactor(v) {}, set textOpacity(v) { e.style.opacity = v }, centerAlignText() { e.style.textAlign = 'center' }, rightAlignText() { e.style.textAlign = 'right' }, applyTimerStyle() {} } }
  addImage(img) { const e = document.createElement('img'); e.src = img.url; this.el.appendChild(e); return { set imageSize(s) { e.style.width = s.width + 'px'; e.style.height = s.height + 'px' } } }
}
class ListWidget extends Stack { set addAccessoryWidgetBackground(v) { if (v) this.el.style.background = 'rgba(255,255,255,.18)' } }
const env = { args: {}, config: {}, Script: {}, FileManager: {}, Notification: {}, ListWidget, Font, Color, Size, Rect, Point, Path, DrawContext, Timer: function () {}, Calendar: {}, CalendarEvent: {}, UITable: function () {}, UITableRow: function () {}, Alert: function () {}, Safari: {}, console, SFSymbol: { named: () => null }, Request: function () {}, Location: {}, Pasteboard: {} }
function load(name, ...extra) {
  const f = new AsyncFunction(...PARAMS, SOURCES[name])
  const module = { exports: {} }
  f(module, () => null, ...PARAMS.slice(2).map(k => env[k]))
  return module.exports
}

async function main() {
  const core = load('core.js'), dawn = load('dawn.js')
  const widget = load('dawn-widget.js')(core, dawn)
  core.loadTodos = async () => ({ ok: true, items: [{ title: '記念日ご飯予約', due: '2026-10-08T15:00:00.000Z', allDay: true, createdAt: '1' }, { title: 'claudecode max解約', due: '2026-10-31T15:00:00.000Z', allDay: true, createdAt: '2' }, { title: '牛乳を買う', due: null, createdAt: '3' }] })
  const RealDate = Date
  const at = (h, m, d) => { NOW = new RealDate(2026, 9, d || 8, h, m).getTime(); globalThis.Date = class extends RealDate { constructor(...a) { a.length ? super(...a) : super(NOW) } static now() { return NOW } } }
  const mk = () => ({ config: core.normalizeConfig({ bedtime: '00:00', theme: THEME }), state: { plan: { date: '2026-10-08', wake: true, reason: '' }, skipDates: [], routine: { date: '2026-10-08', done: 2 } }, sessions: [], problems: [] })
  const cases = [
    ['起床中 7:13（段階2）', 7, 13, d => d],
    ['8:40 未チェックイン', 8, 40, d => d],
    ['朝 7:20（7:12起床・2/5）', 7, 20, d => { d.sessions.push({ date: '2026-10-08', checkinAt: '2026-10-08T07:12:00+09:00', wokeStage: 1, score: 85, method: 'widget' }); return d }],
    ['朝 7:38（遅れそう）', 7, 38, d => { d.sessions.push({ date: '2026-10-08', checkinAt: '2026-10-08T07:12:00+09:00', wokeStage: 1, score: 85, method: 'widget' }); return d }],
    ['昼間 9:00', 9, 0, d => { d.sessions.push({ date: '2026-10-08', checkinAt: '2026-10-08T07:12:00+09:00', wokeStage: 1, score: 85, method: 'widget' }); return d }],
    ['夜 21:30', 21, 30, d => d],
    ['就寝前 23:40', 23, 40, d => d],
  ]
  const root = document.getElementById('root')
  for (const [label, h, m, prep] of cases) {
    at(h, m)
    const data = prep(mk())
    const box = document.createElement('div'); box.className = 'lock'
    box.innerHTML = '<div class="cap">' + label + '</div>'
    const inl = document.createElement('div'); inl.className = 'inline'
    const wi = await widget.build(data, 'accessoryInline', new Date(), null); inl.appendChild(wi.el)
    const clock = document.createElement('div'); clock.className = 'clock'; clock.textContent = h + ':' + String(m).padStart(2, '0')
    const row = document.createElement('div'); row.className = 'row'
    const r = document.createElement('div'); r.className = 'rect'; r.appendChild((await widget.build(data, 'accessoryRectangular', new Date(), null)).el)
    const c = document.createElement('div'); c.className = 'circ'; c.appendChild((await widget.build(data, 'accessoryCircular', new Date(), null)).el)
    row.append(r, c)
    box.append(inl, clock, row)
    root.appendChild(box)
  }
  globalThis.Date = RealDate
}
main().catch(e => { document.body.insertAdjacentText('afterbegin', 'CRASH ' + e.stack) })
