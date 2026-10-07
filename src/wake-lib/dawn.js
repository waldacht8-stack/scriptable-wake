// wake-lib/dawn.js
// デザイン案D「朝焼けの地平」の共通部品：明朝体、漢数字、地平線と太陽・月の絵。
// ロック画面は単色（明るさだけ）で表示されるので、絵は白と透明度だけで描く。

// ---------- デザイン（設定で切り替える） ----------
// 書体は iPhone に最初から入っているヒラギノ（明朝・丸ゴシック・角ゴシック）だけを使う
const THEMES = {
  dawn: {
    name: '朝焼けの地平', note: '明朝体・空と太陽', fonts: ['HiraMinProN-W6', 'HiraMinProN-W3'], kanji: true, track: false,
    words: { depart: '出発まで', late: '遅れそう', next: n => n + 'をすませた', done: '支度ができました', bed: '眠るまで', wake: '夜が明けました', tap: 'タップで起きる', today: '今日のこと' },
  },
  kissa: {
    name: '喫茶モーニング', note: '丸ゴシック・まったり', fonts: ['HiraMaruProN-W4', 'HiraMaruProN-W4'], kanji: true, track: false,
    words: { depart: 'お会計まで', late: '遅れそう', next: n => n + '、おわり', done: 'ごちそうさまでした', bed: 'おやすみまで', wake: 'おはようございます', tap: 'タップで起きる', today: '本日のおしながき' },
  },
  station: {
    name: '駅の発車標', note: '黒地に琥珀色・停車駅', fonts: ['HiraginoSans-W6', 'HiraginoSans-W3'], kanji: false, track: true,
    words: { depart: '発車まで', late: '遅れ見込み', next: n => n + 'を通過', done: 'まもなく発車', bed: '終電まで', wake: '始発の時間です', tap: 'タップで乗車', today: '本日の運行' },
  },
  sora: {
    name: '青空シンプル', note: 'ゴシック・明るい空色', fonts: ['HiraginoSans-W6', 'HiraginoSans-W3'], kanji: false, track: false,
    words: { depart: '出発まで', late: '遅れそう', next: n => n + ' 完了', done: '準備OK', bed: '就寝まで', wake: '起きる時間です', tap: 'タップでチェックイン', today: '今日のこと' },
  },
}

function theme(name) {
  return THEMES[name] || THEMES.dawn
}

// デザインの書体。使えなければ標準の文字
function font(size, light, themeName) {
  const f = theme(themeName).fonts
  try {
    return new Font(light ? f[1] : f[0], size)
  } catch (e) {
    return light ? Font.systemFont(size) : Font.boldSystemFont(size)
  }
}

// デザインに合わせた数字（明朝・丸ゴシックは漢数字、ほかは算用数字）
function num(themeName, n) {
  return theme(themeName).kanji ? kanji(n) : String(Math.round(n))
}

function minutesText(themeName, min) {
  if (theme(themeName).kanji) return kanjiMinutes(min)
  const m = Math.max(0, Math.round(min))
  return m < 60 ? m + '分' : Math.floor(m / 60) + '時間' + (m % 60 ? (m % 60) + '分' : '')
}

function timeText(themeName, d) {
  return theme(themeName).kanji ? kanjiTime(d) : d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0')
}

// ---------- 漢数字 ----------

const DIGITS = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九']

// 0〜99 を漢数字に（27 → 二十七）。100 以上は算用数字のまま
function kanji(n) {
  n = Math.round(n)
  if (n < 0 || n > 99) return String(n)
  if (n < 10) return DIGITS[n]
  const t = Math.floor(n / 10)
  const o = n % 10
  return (t === 1 ? '' : DIGITS[t]) + '十' + (o ? DIGITS[o] : '')
}

// 7:45 → 七時四十五分、7:00 → 七時
function kanjiTime(d) {
  return kanji(d.getHours()) + '時' + (d.getMinutes() ? kanji(d.getMinutes()) + '分' : '')
}

// 分 → 「二十七分」「一時間十分」
function kanjiMinutes(min) {
  const m = Math.max(0, Math.round(min))
  if (m < 60) return kanji(m) + '分'
  const h = Math.floor(m / 60)
  return kanji(h) + '時間' + (m % 60 ? kanji(m % 60) + '分' : '')
}

// ---------- 絵 ----------

const WHITE = 'FFFFFF'

function ctxOf(w, h) {
  const c = new DrawContext()
  c.size = new Size(w, h)
  c.opaque = false
  c.respectScreenScale = true
  return c
}

function fillPolygon(c, pts, alpha) {
  const p = new Path()
  p.addLines(pts)
  p.closeSubpath()
  c.addPath(p)
  c.setFillColor(new Color(WHITE, alpha === undefined ? 1 : alpha))
  c.fillPath()
}

function line(c, x1, y1, x2, y2, width, alpha) {
  const p = new Path()
  p.move(new Point(x1, y1))
  p.addLine(new Point(x2, y2))
  c.addPath(p)
  c.setStrokeColor(new Color(WHITE, alpha))
  c.setLineWidth(width)
  c.strokePath()
}

function dashed(c, x1, x2, y, width, alpha) {
  const p = new Path()
  for (let x = x1; x < x2; x += 5) {
    p.move(new Point(x, y))
    p.addLine(new Point(Math.min(x + 2, x2), y))
  }
  c.addPath(p)
  c.setStrokeColor(new Color(WHITE, alpha))
  c.setLineWidth(width)
  c.strokePath()
}

// 地平線より上だけの太陽（中心 cx,cy・半径 r・地平線 y=base）
function sun(c, cx, cy, r, base) {
  const pts = []
  for (let i = 0; i <= 48; i++) {
    const a = Math.PI * 2 * i / 48
    pts.push(new Point(cx + r * Math.cos(a), Math.min(cy + r * Math.sin(a), base)))
  }
  fillPolygon(c, pts, 1)
}

// 太陽の光（地平線より上に出ている部分だけ）
function rays(c, cx, cy, r, base, count, len) {
  for (let i = 0; i < count; i++) {
    const a = Math.PI + Math.PI * (i + 1) / (count + 1) // 左上 → 真上 → 右上
    const x1 = cx + (r + 2) * Math.cos(a)
    const y1 = cy + (r + 2) * Math.sin(a)
    const x2 = cx + (r + 2 + len) * Math.cos(a)
    const y2 = cy + (r + 2 + len) * Math.sin(a)
    if (y2 < base - 1) line(c, x1, Math.min(y1, base - 1), x2, y2, 1.2, 0.85)
  }
}

// 三日月（中心 cx,cy・半径 r）。外の円から内の円を除いた形を多角形で描く
function moon(c, cx, cy, r) {
  const r2 = r * 0.82
  const ix = cx + r * 0.45
  const iy = cy - r * 0.32
  const d = Math.hypot(ix - cx, iy - cy)
  const dir = Math.atan2(iy - cy, ix - cx)
  const t0 = Math.acos((d * d + r * r - r2 * r2) / (2 * d * r))
  const t1 = Math.acos((d * d + r2 * r2 - r * r) / (2 * d * r2))
  const pts = []
  for (let i = 0; i <= 32; i++) {
    const a = dir + t0 + (2 * Math.PI - 2 * t0) * i / 32
    pts.push(new Point(cx + r * Math.cos(a), cy + r * Math.sin(a)))
  }
  for (let i = 0; i <= 32; i++) {
    const a = dir + Math.PI + t1 - 2 * t1 * i / 32
    pts.push(new Point(ix + r2 * Math.cos(a), iy + r2 * Math.sin(a)))
  }
  fillPolygon(c, pts, 1)
}

function star(c, x, y, r, alpha) {
  fillPolygon(c, [new Point(x, y - r), new Point(x + r * 0.35, y), new Point(x, y + r), new Point(x - r * 0.35, y)], alpha)
  fillPolygon(c, [new Point(x - r, y), new Point(x, y - r * 0.35), new Point(x + r, y), new Point(x, y + r * 0.35)], alpha)
}

// 長方形ウィジェット用の地平線（幅 w・高さ h）。
//   kind 'sun'  ：半分の太陽が p（0〜1）の位置まで進む。通った道は実線、これからは点線
//   kind 'dawn' ：太陽が地平線から少しだけ顔を出す（p＝顔の出かた 0〜1）
//   kind 'night'：太陽は沈み、右上に三日月
//   kind 'stars'：三日月と星（就寝前）
function horizon(w, h, kind, p) {
  const c = ctxOf(w, h)
  const base = h - 2
  const r = Math.min(h - 7, 9)
  const q = Math.max(0, Math.min(1, p || 0))
  line(c, 0.5, base - 3, 0.5, base, 1, 0.8)
  line(c, w - 0.5, base - 3, w - 0.5, base, 1, 0.8)
  if (kind === 'sun') {
    const x = r + 1 + q * (w - 2 * r - 2)
    line(c, 0, base, x, base, 1.6, 0.95)
    dashed(c, x, w, base, 1.2, 0.5)
    sun(c, x, base, r, base)
    rays(c, x, base, r, base, 5, 3)
  } else if (kind === 'dawn') {
    line(c, 0, base, w, base, 1.6, 0.95)
    const x = r + 12
    const cy = base + r * (0.5 - 0.45 * q)
    sun(c, x, cy, r, base)
    rays(c, x, cy, r, base, 3, 2.5)
  } else {
    dashed(c, 0, w, base, 1.2, 0.55)
    moon(c, w - r - 4, r + 1, r * 0.8)
    if (kind === 'stars') {
      star(c, w * 0.18, h * 0.35, 2.2, 0.9)
      star(c, w * 0.42, h * 0.18, 1.6, 0.7)
      star(c, w * 0.64, h * 0.45, 1.9, 0.8)
    }
  }
  return c.getImage()
}

// 円形ウィジェット用：地平線から太陽が p（0〜1）だけ昇る。kind 'moon' なら三日月
function rise(w, h, kind, p) {
  const c = ctxOf(w, h)
  const base = h - 3
  const r = Math.min(w / 4.2, h / 2.6)
  const q = Math.max(0, Math.min(1, p || 0))
  if (kind === 'moon') {
    dashed(c, 2, w - 2, base, 1.2, 0.6)
    moon(c, w / 2, base - r - 3, r * 0.95)
    star(c, w * 0.18, base - r * 1.6, 1.8, 0.8)
    return c.getImage()
  }
  line(c, 1, base, w - 1, base, 1.6, 0.95)
  // p=0 で頭だけ、p=1 で地平線から少し浮く
  const cy = base + r * 0.7 - q * (r * 1.7 + 2)
  sun(c, w / 2, cy, r, base)
  if (q > 0.35) rays(c, w / 2, cy, r, base, 5, 3)
  return c.getImage()
}

// 駅の発車標デザイン用：停車駅（stops 個）の並んだ線路と、今いる位置の電車（p＝0〜1）
function track(w, h, stops, p) {
  const c = ctxOf(w, h)
  const y = h / 2 + 2
  const q = Math.max(0, Math.min(1, p || 0))
  const n = Math.max(2, stops)
  const x0 = 5
  const x1 = w - 5
  const x = x0 + q * (x1 - x0)
  line(c, x0, y, x, y, 2.4, 0.95)
  dashed(c, x, x1, y, 1.4, 0.55)
  for (let i = 0; i < n; i++) {
    const sx = x0 + (x1 - x0) * i / (n - 1)
    const passed = sx <= x + 0.5
    const pts = []
    for (let k = 0; k <= 20; k++) pts.push(new Point(sx + 3.2 * Math.cos(Math.PI * 2 * k / 20), y + 3.2 * Math.sin(Math.PI * 2 * k / 20)))
    fillPolygon(c, pts, passed ? 1 : 0.35)
  }
  // 電車（今いる位置の上の小さな三角）
  fillPolygon(c, [new Point(x - 4, y - 9), new Point(x + 4, y - 9), new Point(x, y - 4)], 1)
  return c.getImage()
}

module.exports = { THEMES, theme, font, num, minutesText, timeText, kanji, kanjiTime, kanjiMinutes, horizon, rise, track }
