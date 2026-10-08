async function panelMain() {
  const core = load('core.js'), dawn = load('dawn.js')
  const stUi = { tasks: () => {}, toggleSkip: () => {}, readDebugLog: () => ['2026/10/8 2:01:30  起動: ボタン: settings', '2026/10/8 2:00:57  起動: ホーム画面を表示'] }
  const home = load('dawn-home.js')(core, dawn, stUi, {}, load('settings.js')(core, stUi, {}, dawn))
  core.loadTodos = async () => ({ ok: true, items: [] })
  const RealDate = Date
  NOW = new RealDate(2026, 9, 8, 7, 18).getTime(); globalThis.Date = class extends RealDate { constructor(...a) { a.length ? super(...a) : super(NOW) } static now() { return NOW } }
  const sessions = []
  const scores = [[0, 85], [1, 70], [2, 100], [5, 40], [6, 85], [7, 85], [8, 70], [9, 0], [12, 85], [13, 100], [14, 70], [15, 85], [16, 85], [19, 70], [20, 85], [21, 100]]
  for (const [ago, sc] of scores) { const d = core.addDays(new Date(), -ago); sessions.push({ date: core.dateKey(d), checkinAt: sc ? core.dateKey(d) + 'T07:1' + (ago % 10) + ':00+09:00' : null, wokeStage: sc === 100 ? -1 : sc === 85 ? 0 : sc === 70 ? 1 : sc === 40 ? 3 : null, score: sc, method: sc ? 'widget' : 'missed' }) }
  sessions.sort((a, b) => a.date < b.date ? -1 : 1)
  const data = { config: core.normalizeConfig({ bedtime: '00:00', theme: THEME, themeNight: THEME }), state: { plan: null, skipDates: [], tasks: { date: '2026-10-09', items: ['ゴミ出し', '資料を印刷'] }, routine: { date: '2026-10-08', done: 2 }, belongings: { date: '2026-10-08', checked: ['鍵', '財布'] } }, sessions, problems: [] }
  const html = home.page(await home.model(data, new Date()))
  const root = document.getElementById('root')
  for (const p of ['tasks', 'belongings', 'settings']) {
    const f = document.createElement('iframe'); f.srcdoc = html; f.width = 390; f.height = 760
    f.onload = () => setTimeout(() => f.contentWindow.openPanel(p), 50)
    root.appendChild(f)
  }
  globalThis.Date = RealDate
}
