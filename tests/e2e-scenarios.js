// 通しのシナリオ（2026/10/8〜）
function resetFS() { for (const k of Object.keys(FS)) delete FS[k]; PENDING = []; DELIVERED = []; ALERTS = []; WV_ACTIONS = []; HOLIDAYS = [] }
const S = id => 'shortcuts://run-shortcut?name=' + encodeURIComponent(id)

async function scenarios() {
  globalThis.Date = FakeDate
  let r

  // ---- 1. 夜のアラーム準備 → 朝のチェックイン ----
  resetFS()
  setNow(2026, 10, 8, 20, 0)
  r = await run('起床 準備.js')
  ok('準備(木20時): 明日は起床日 → ON', r.output === 'ON' && !r.error, [r.output, r.error && r.error.message])
  ok('準備: 予定を保存', state().plan && state().plan.date === '2026-10-09' && state().plan.wake === true, state().plan)
  ok('準備: 就寝リマインドを7日分予約', PENDING.filter(n => /^wake-bed-/.test(n.identifier)).length === 7, PENDING.map(n => n.identifier))
  ok('準備: 動作記録に残る', logLines()[0] && logLines()[0].indexOf('アラーム準備（ショートカットから）: ON') >= 0, logLines()[0])

  setNow(2026, 10, 9, 7, 12)
  r = await run('起床 チェックイン.js')
  ok('チェックイン(金7:12): OK', r.output === 'OK' && !r.error, [r.output, r.error && r.error.message])
  const s1 = sessions()[0] || {}
  ok('チェックイン: 段階2・85点で記録', sessions().length === 1 && s1.date === '2026-10-09' && s1.wokeStage === 1 && s1.score === 85, s1)
  ok('チェックイン: 持ち物の通知を7:40に予約', PENDING.some(n => /^wake-belong-/.test(n.identifier) && n.at.getHours() === 7 && n.at.getMinutes() === 40))
  ok('チェックイン: おはようの通知', DELIVERED.some(n => /おはよう/.test(n.title)))
  ok('チェックイン: 動作記録に残る', logLines()[0].indexOf('チェックイン（ショートカットから）: OK') >= 0, logLines()[0])

  setNow(2026, 10, 9, 7, 13)
  r = await run('起床 チェックイン.js')
  ok('2回目のチェックイン: OK（済み）で記録は増えない', r.output === 'OK' && sessions().length === 1)

  // ---- 2. 休みの日と時間外は止まる ----
  setNow(2026, 10, 9, 20, 0)
  r = await run('起床 準備.js')
  ok('準備(金20時): 土曜は止まる（エラー）', r.error && /起床しない曜日/.test(r.error.message) && r.output === undefined, r.error && r.error.message)

  setNow(2026, 10, 9, 23, 0)
  r = await run('起床 チェックイン.js')
  ok('夜に充電器を外す: 時間外で止まる', r.error && /時間外/.test(r.error.message) && sessions().length === 1, r.error && r.error.message)

  setNow(2026, 10, 11, 20, 0)
  HOLIDAYS = ['2026-10-12']
  r = await run('起床 準備.js')
  ok('準備(日20時): 月曜が祝日なら止まる', r.error && /祝日/.test(r.error.message), r.error && r.error.message)
  HOLIDAYS = []

  // ---- 3. 設定（ホーム画面の設定パネル）：天気の場所と自分ルール ----
  setNow(2026, 10, 12, 21, 0)
  WV_ACTIONS = ['set:weather', 'set:rule']
  ALERTS = [{ i: 0 }, { i: 0, text: '23時にスマホを置く' }]
  r = await run('起床.js', { app: true })
  ok('アプリ: ホーム画面が開く', r.webviews === 1 && !r.error, r.error && r.error.message)
  ok('設定: 天気の場所を登録（約1km単位）', cfg().weatherLocation && cfg().weatherLocation.lat === 35.68 && cfg().weatherLocation.name === '東京都 千代田区', cfg().weatherLocation)
  ok('設定: 自分ルール', cfg().ownRule === '23時にスマホを置く', cfg().ownRule)
  ok('アプリ: ボタンが記録に残る', logLines().some(l => l.indexOf('ボタン: set:weather') >= 0))

  setNow(2026, 10, 12, 21, 5)
  r = await run('起床 準備.js')
  ok('準備(月21時): 火曜 ON', r.output === 'ON', r.error && r.error.message)

  // ---- 4. 最終段階で起床：天気と自分ルールが出る ----
  setNow(2026, 10, 13, 7, 35)
  r = await run('起床 チェックイン.js')
  const s2 = sessions().find(s => s.date === '2026-10-13') || {}
  ok('チェックイン(火7:35): 段階4・40点', r.output === 'OK' && s2.wokeStage === 3 && s2.score === 40, s2)
  ok('チェックイン: 天気を取得', r.requests.some(u => u.indexOf('api.open-meteo.com') >= 0))
  const hello = DELIVERED.filter(n => /おはよう/.test(n.title)).pop() || {}
  ok('おはよう通知に天気', /天気：雨 22℃\/14℃ 雨70%/.test(hello.body || ''), hello.body)
  ok('おはよう通知に自分ルール（寝坊の朝）', /自分ルール：23時にスマホを置く/.test(hello.body || ''), hello.body)

  // ---- 5. 朝のホーム画面：ルーティン・持ち物・読み上げ ----
  setNow(2026, 10, 13, 7, 36)
  WV_ACTIONS = ['next', 'next', 'routine:0', 'routine:3', 'belong:1', 'speak', 'back']
  r = await run('起床.js', { app: true })
  ok('朝のホーム: エラーなし', !r.error && r.webviews === 1, r.error && r.error.message)
  ok('ルーティン: 操作の結果（3まで完了→1つ戻す＝3）', state().routine && state().routine.done === 3, state().routine)
  ok('持ち物: 財布をチェック', state().belongings && state().belongings.checked.join() === '財布', state().belongings)
  ok('読み上げ: 出発までと天気', r.spoken.length === 1 && /出発まで/.test(r.spoken[0]) && /最高22度、最低14度/.test(r.spoken[0]), r.spoken)
  ok('朝のホーム: 画面の中身が朝', r.lastModel && r.lastModel.phase === 'morning', r.lastModel && r.lastModel.phase)

  // ---- 6. 明日だけオフ（アラームがもうオン）→ チェックインのショートカットで自動オフ ----
  setNow(2026, 10, 13, 20, 0)
  await run('起床 準備.js')
  ok('準備(火20時): 水曜 ON', state().plan.date === '2026-10-14' && state().plan.wake)
  setNow(2026, 10, 13, 21, 0)
  WV_ACTIONS = ['skip']
  ALERTS = [{ i: 0 }]
  r = await run('起床.js', { app: true })
  ok('明日だけオフ: お休みに登録', state().skipDates.indexOf('2026-10-14') >= 0 && state().pendingOff === '2026-10-14', state())
  ok('明日だけオフ: チェックインのショートカットを開く', r.opened.indexOf(S('起床チェックイン')) >= 0, r.opened)
  setNow(2026, 10, 13, 21, 1)
  r = await run('起床 チェックイン.js')
  ok('明日だけオフ: ショートカットが OK（アラームをオフ）', r.output === 'OK' && state().pendingOff === null, [r.output, r.error && r.error.message])
  setNow(2026, 10, 14, 7, 10)
  r = await run('起床 チェックイン.js')
  ok('お休みの朝: チェックインは時間外で止まる', !!r.error)

  // ---- 6b. 平日：朝チェックイン → 夜にアラーム準備 → 夜に充電器を外しても翌朝のアラームは消えない ----
  setNow(2026, 10, 14, 23, 30)
  r = await run('起床 チェックイン.js')
  ok('お休みの日の夜に充電器: 止まる', !!r.error)
  // ---- 7. 明日やること ----
  setNow(2026, 10, 14, 21, 0)
  WV_ACTIONS = ['task:0', 'task:1']
  ALERTS = [{ i: 0, text: 'ゴミ出し' }, { i: 0, text: '振込' }]
  r = await run('起床.js', { app: true })
  ok('明日やること: 2つ保存', state().tasks && state().tasks.date === '2026-10-15' && state().tasks.items.join() === 'ゴミ出し,振込', state().tasks)
  setNow(2026, 10, 14, 21, 5)
  await run('起床 準備.js')
  setNow(2026, 10, 15, 7, 5)
  r = await run('起床 チェックイン.js')
  const hello2 = DELIVERED.filter(n => /おはよう/.test(n.title)).pop() || {}
  ok('おはよう通知に今日やること', /今日やること：ゴミ出し・振込/.test(hello2.body || ''), hello2.body)
  ok('段階1で起床ならルールは出ない', !/自分ルール/.test(hello2.body || ''))

  setNow(2026, 10, 15, 20, 0)
  r = await run('起床 準備.js')
  ok('木20時: 金曜 ON', r.output === 'ON')
  setNow(2026, 10, 15, 23, 0)
  r = await run('起床 チェックイン.js')
  ok('チェックイン済みの日の夜に充電器: 止まる（翌朝のアラームを消さない）', !!r.error && r.output === undefined, [r.output, r.error && r.error.message])
  setNow(2026, 10, 15, 11, 59)
  r = await run('起床 チェックイン.js')
  ok('チェックイン済みの日の受付時間内: OK（済み）', r.output === 'OK', [r.output, r.error && r.error.message])
  // ---- 8. 正午を過ぎたら未チェックイン（0点） ----
  setNow(2026, 10, 15, 20, 0)
  await run('起床 準備.js')
  setNow(2026, 10, 16, 12, 30)
  r = await run('起床.js', { app: true })
  const miss = sessions().find(s => s.date === '2026-10-16') || {}
  ok('正午過ぎ: 未チェックイン0点を記録', miss.method === 'missed' && miss.score === 0, miss)

  // ---- 9. 設定パネルのすべての項目 ----
  setNow(2026, 10, 16, 21, 0)
  WV_ACTIONS = ['set:time:bedtime', 'set:day:sat', 'set:stage:add', 'set:stage:4', 'set:routine:add', 'set:belong:add', 'set:holidays', 'set:weekly', 'set:opens', 'set:belongMin', 'set:routine:5', 'set:theme']
  ALERTS = [
    { i: 0, text: '24:00' }, // 就寝
    { i: 1 }, // 土曜：起床・出発なし
    { i: 0, text: '7:40' }, // 段階を追加
    { i: 3 }, { i: 0 }, // 段階5を削除（確認）
    { i: 0, text: '水を飲む' }, { i: 0, text: '2' }, // ルーティン追加
    { i: 0, text: '傘' }, // 持ち物追加
    { i: 0 }, { i: 0, text: '20:00' }, // 週の振り返り：日曜20時
    { i: 0, text: '90' }, // 受付開始
    { i: 0, text: '10' }, // 持ち物の通知
    { i: 2 }, // ルーティン6つ目を1つ上へ
    { i: 2 }, // デザイン：駅の発車標
  ]
  r = await run('起床.js', { app: true })
  const c = cfg()
  ok('設定: エラーなし', !r.error, r.error && r.error.message)
  ok('設定: 就寝 24:00 → 00:00', c.bedtime === '00:00', c.bedtime)
  ok('設定: 土曜は起床・出発なし', c.days.sat.wake === true && c.days.sat.departure === null, c.days.sat)
  ok('設定: 段階の追加と削除で4つに戻る', c.stages.length === 4 && c.stages[3].time === '07:30' && c.stages[3].clockLabel === '起床4', c.stages)
  ok('設定: ルーティン追加と並べ替え', c.routine.length === 6 && c.routine[4].name === '水を飲む' && c.routine[4].minutes === 2, c.routine)
  ok('設定: 持ち物追加', c.belongings.indexOf('傘') >= 0)
  ok('設定: 祝日オフ', c.skipHolidays === false)
  ok('設定: 週の振り返り 日曜20時', c.weeklyDay === 0 && c.weeklyTime === '20:00', [c.weeklyDay, c.weeklyTime])
  ok('設定: 受付90分・持ち物10分', c.checkinOpensMinutes === 90 && c.belongingsMinutes === 10)
  ok('設定: デザイン 駅の発車標', c.theme === 'station', c.theme)
  ok('設定: 画面もデザインが変わる', r.lastModel && r.lastModel.theme === 'station')

  // ---- 10. デザインのメニュー ----
  WV_ACTIONS = ['design']
  ALERTS = [{ i: 3 }]
  r = await run('起床.js', { app: true })
  ok('デザイン: 青空シンプル', cfg().theme === 'sora', cfg().theme)

  // ---- 11. ウィジェット：4デザイン × 時間帯 × 3種類 ----
  setNow(2026, 10, 18, 20, 0) // 日曜夜：月曜は起床日
  await run('起床 準備.js')
  let widgetErrors = []
  for (const th of ['dawn', 'kissa', 'station', 'sora']) {
    const cc = cfg(); cc.theme = th; FS[P('config.json')] = JSON.stringify(cc)
    for (const [d, h, m] of [[18, 23, 50], [19, 0, 30], [19, 6, 30], [19, 7, 5], [19, 7, 40], [19, 9, 0], [19, 19, 0], [19, 23, 50]]) {
      setNow(2026, 10, d, h, m)
      if (d === 19 && h === 7 && m === 40 && !sessions().find(s => s.date === '2026-10-19')) {
        setNow(2026, 10, 19, 7, 12); await run('起床 チェックイン.js'); setNow(2026, 10, 19, 7, 40)
      }
      for (const f of ['accessoryRectangular', 'accessoryCircular', 'accessoryInline']) {
        r = await run('起床ウィジェット.js', { widget: true, family: f })
        if (r.error || !r.widget) widgetErrors.push(th + ' ' + d + '日' + h + ':' + m + ' ' + f + ' ' + (r.error && r.error.message))
      }
    }
  }
  ok('ウィジェット: 96通りすべて描ける', widgetErrors.length === 0, widgetErrors.slice(0, 3))

  // ---- 12. ウィジェットをタップしてアプリで開いた場合 ----
  setNow(2026, 10, 20, 7, 3) // 火曜（月曜夜に準備していないが曜日で起床日）
  r = await run('起床ウィジェット.js', { app: true })
  ok('タップ(受付中): チェックインのショートカットを開く', r.opened.indexOf(S('起床チェックイン')) >= 0 && r.alerts.length === 0, r.opened)
  setNow(2026, 10, 20, 15, 0)
  ALERTS = []
  r = await run('起床ウィジェット.js', { app: true })
  ok('タップ(昼): プレビューを出す', r.opened.length === 0 && r.alerts.length === 1, r.alerts)

  // ---- 13. Siri・互換のパラメータ ----
  setNow(2026, 10, 20, 21, 0)
  r = await run('起床 次の起床.js')
  ok('次の起床: 読み上げる文', /^次の起床は 明日10\/21（水） 7時、アラーム4つです$/.test(r.output || ''), r.output)
  r = await run('起床.js', { param: 'plan' })
  ok('起床.js plan: ON', r.output === 'ON', r.output)
  r = await run('起床.js', { param: 'xyz' })
  ok('起床.js 不明なパラメータ: NG', r.output === 'NG', r.output)

  // ---- 14. 表の画面（通知から開く） ----
  for (const v of ['routine', 'belongings', 'records', 'settings']) {
    r = await run('起床.js', { app: true, query: { view: v } })
    ok('表の画面 ' + v + ': 組み立てられる', !r.error && r.tables.length >= 1, r.error && r.error.message)
  }

  // ---- 15. 更新スクリプト ----
  resetFS()
  ALERTS = [{ i: 0 }]
  FS['/icloud/起床 NFC.js'] = 'old'
  r = await run('起床 Update.js', { app: true })
  const files = JSON.parse(MANIFEST).files
  ok('更新: 配信リストのファイルをすべて書く', files.every(f => FS['/icloud/' + f.dest] === SOURCES[f.src.split('/').pop()]), files.filter(f => FS['/icloud/' + f.dest] !== SOURCES[f.src.split('/').pop()]).map(f => f.dest))
  ok('更新: 配信をやめたファイルを消す', !('/icloud/起床 NFC.js' in FS))
  ok('更新: 完了の画面', r.alerts[0] === '更新完了', r.alerts)

  // ---- 16. 壊れたファイル・古い設定・初回 ----
  resetFS()
  setNow(2026, 10, 21, 21, 0)
  r = await run('起床.js', { app: true })
  ok('初回: 設定ファイルを作る', !!cfg().stages && !r.error && r.webviews === 1)
  FS[P('config.json')] = '{壊れた'
  FS[P('state.json')] = '{壊れた'
  r = await run('起床.js', { app: true })
  ok('壊れたファイル: 画面は開く', !r.error && r.webviews === 1, r.error && r.error.message)
  r = await run('起床 準備.js')
  ok('壊れたファイル: アラーム準備は鳴る側（ON）', r.output === 'ON', [r.output, r.error && r.error.message])
  resetFS()
  FS[P('config.json')] = JSON.stringify({ stages: [0, 1, 2, 3].map(i => ({ index: i, name: 'x', clockLabel: '起床-段階' + i, time: ['06:50', '07:00', '07:03', '07:06'][i], score: 50 })) })
  await run('起床.js', { app: true })
  ok('古い初期設定: 起床1〜4（7:00〜7:30）に置き換え', cfg().stages.map(s => s.time).join() === '07:00,07:10,07:20,07:30', cfg().stages.map(s => s.time))

  globalThis.Date = RealDate
}

scenarios().catch(e => { failures++; log('CRASH ' + (e && e.stack)) }).finally(() => {
  log((failures ? 'FAILURES: ' + failures : 'ALL PASSED') + '（確認 ' + (passes + failures) + ' 件）')
  document.body.innerText = out.join('\n')
})
