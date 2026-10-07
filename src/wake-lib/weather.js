// wake-lib/weather.js
// 今日の天気（F-17）。Open-Meteo（無料・API キー不要・非商用）から取得する。
// 取得はチェックインのとき（ショートカット経由）だけ。ウィジェットは保存済みの文を使い、通信しない

const API = 'https://api.open-meteo.com/v1/forecast'

// WMO の天気コード → 日本語
function codeText(c) {
  if (c === 0) return '快晴'
  if (c === 1) return '晴れ'
  if (c === 2) return '晴れ時々くもり'
  if (c === 3) return 'くもり'
  if (c === 45 || c === 48) return '霧'
  if (c >= 51 && c <= 57) return '霧雨'
  if (c >= 61 && c <= 67) return '雨'
  if (c >= 71 && c <= 77) return '雪'
  if (c >= 80 && c <= 82) return 'にわか雨'
  if (c === 85 || c === 86) return 'にわか雪'
  if (c >= 95) return '雷雨'
  return '不明'
}

// Open-Meteo の応答 → 「晴れ 22℃/15℃ 雨30%」。読めなければ null
function summarize(json) {
  const d = json && json.daily
  if (!d || !Array.isArray(d.weather_code) || !d.weather_code.length) return null
  const max = Math.round(d.temperature_2m_max[0])
  const min = Math.round(d.temperature_2m_min[0])
  const rain = d.precipitation_probability_max ? d.precipitation_probability_max[0] : null
  return codeText(d.weather_code[0]) + ' ' + max + '℃/' + min + '℃' + (rain === null || rain === undefined ? '' : ' 雨' + rain + '%') +
    (rain >= 50 ? '　☂ 傘を忘れずに' : '')
}

function url(loc) {
  return API + '?latitude=' + loc.lat + '&longitude=' + loc.lon +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FTokyo&forecast_days=1'
}

// 今日の天気の文。場所が未設定・通信できないときは null（チェックインは止めない）
async function today(cfg) {
  const loc = cfg.weatherLocation
  if (!loc || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lon)) return null
  try {
    const r = new Request(url(loc))
    r.timeoutInterval = 6
    return summarize(await r.loadJSON())
  } catch (e) {
    console.warn('天気を取得できませんでした: ' + e)
    return null
  }
}

module.exports = { today, summarize, codeText, url }
