// ホーム画面（WebView の HTML）を時間帯ごとに作って iframe で並べる
async function homeMain() {
  const core = load('core.js'), dawn = load('dawn.js')
  const home = load('dawn-home.js')(core, dawn, { tasks: () => {}, toggleSkip: () => {} }, {})
  core.loadTodos = async () => ({ ok: true, items: [{ title: '記念日ご飯予約', due: '2026-10-08T15:00:00.000Z', allDay: true }, { title: 'claudecode max解約', due: '2026-10-31T15:00:00.000Z', allDay: true }] })
  const RealDate = Date
  const at = (h, m) => { NOW = new RealDate(2026, 9, 8, h, m).getTime(); globalThis.Date = class extends RealDate { constructor(...a) { a.length ? super(...a) : super(NOW) } static now() { return NOW } } }
  const ses = { date: '2026-10-08', checkinAt: '2026-10-08T07:12:00+09:00', wokeStage: 1, score: 85, method: 'widget' }
  const mk = (done, withSes) => ({ config: core.normalizeConfig({ bedtime: '00:00', ownRule: '', theme: THEME }), state: { plan: { date: '2026-10-09', wake: true, reason: '' }, skipDates: [], routine: { date: '2026-10-08', done }, weather: { date: '2026-10-08', text: '晴れ 25℃/16℃ 雨10%' }, tasks: { date: '2026-10-08', items: ['ゴミ出し'] } }, sessions: withSes ? [ses] : [], problems: [] })
  const cases = [['起床中 7:13', 7, 13, mk(0, false)], ['朝 7:18（2/5）', 7, 18, mk(2, true)], ['昼間 9:00', 9, 0, mk(5, true)], ['夜 21:30', 21, 30, mk(5, true)]]
  const root = document.getElementById('root')
  for (const [label, h, m, data] of cases) {
    at(h, m)
    if (label.startsWith('起床')) data.state.plan = { date: '2026-10-08', wake: true, reason: '' }
    const html = home.page(await home.model(data, new Date()))
    const box = document.createElement('div'); box.className = 'phone'
    box.innerHTML = '<div class="cap">' + label + '</div>'
    const f = document.createElement('iframe'); f.srcdoc = html; f.width = 390; f.height = 760
    box.appendChild(f); root.appendChild(box)
  }
  globalThis.Date = RealDate
}
