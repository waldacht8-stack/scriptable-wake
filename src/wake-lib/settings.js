// wake-lib/settings.js
// 設定パネル（ホーム画面の中）の中身と、各項目の変更。
//   model(data) → 画面に出す一覧（見出し・項目・押したときの操作名）
//   edit(ctx, key) → 小さな確認画面（Alert）で入力してもらい、設定を保存する
// 表の画面（UITable）はホーム画面（WebView）の上に開けないため、入力は Alert だけで行う。
// ui は入力用の部品（askText など）を借りるために渡す

module.exports = function (core, ui, notify, dawn) {

  const KEYS = core.DAY_KEYS
  const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
  const dayName = k => core.DAY_NAMES[KEYS.indexOf(k)] + '曜'

  function model(data) {
    const cfg = data.config
    const sec = (title, note, rows) => ({ title, note, rows })
    const row = (label, value, key) => ({ label, value: value === undefined || value === null ? '' : String(value), key })
    const sections = []
    if (data.configBroken) sections.push(sec('⚠ 設定ファイルが壊れていました', '初期設定で動いています。変更すると保存し直します', []))
    const TM = dawn.theme(cfg.theme)
    const TN = cfg.themeNight ? dawn.theme(cfg.themeNight) : null
    sections.push(sec('デザイン', '朝・昼・夜で色が変わります（書体や形は同じ）', [
      row(TM.name, TM.note, 'theme'),
      row('夜だけ別のデザイン', TN ? TN.name : 'なし（おすすめ）', 'themeNight'),
    ]))
    sections.push(sec('段階アラーム', '時計アプリのアラームも同じ時刻・ラベルにしてください',
      cfg.stages.map(s => row('段階' + (s.index + 1) + '　' + core.shortTime(s.time), s.name + '・' + s.score + '点・' + s.clockLabel, 'stage:' + s.index))
        .concat([row('＋ 段階を追加', '', 'stage:add')])))
    sections.push(sec('曜日', null, DAY_ORDER.map(k => {
      const d = cfg.days[k]
      return row(dayName(k), d.wake ? (d.departure ? '起床 ・ 出発 ' + core.shortTime(d.departure) : '起床 ・ 出発なし') : '起床しない', 'day:' + k)
    })))
    sections.push(sec('時刻', null, [
      row('就寝時刻', core.shortTime(cfg.bedtime) + '（30分前に知らせる）', 'time:bedtime'),
      row('昼間の終わり', core.shortTime(cfg.daytimeEnd), 'time:daytimeEnd'),
      row('チェックインの締め切り', core.shortTime(cfg.noon) + '（過ぎると0点）', 'time:noon'),
      row('チェックインの受付', '最初のアラームの' + cfg.checkinOpensMinutes + '分前から', 'opens'),
      row('祝日はアラームなし', cfg.skipHolidays ? 'オン' : 'オフ', 'holidays'),
    ]))
    sections.push(sec('朝のルーティン', '合計 ' + core.routineTotal(cfg) + '分',
      cfg.routine.map((r, i) => row((i + 1) + '. ' + r.name, r.minutes + '分', 'routine:' + i)).concat([row('＋ 項目を追加', '', 'routine:add')])))
    sections.push(sec('持ち物', '出発の' + cfg.belongingsMinutes + '分前に知らせる',
      cfg.belongings.map((b, i) => row(b, '', 'belong:' + i)).concat([row('＋ 持ち物を追加', '', 'belong:add'), row('知らせる時刻', '出発の' + cfg.belongingsMinutes + '分前', 'belongMin')])))
    sections.push(sec('朝のこと', null, [
      row('自分ルール', cfg.ownRule || '未設定（最終段階まで寝た朝に表示）', 'rule'),
      row('天気の場所', cfg.weatherLocation ? (cfg.weatherLocation.name || '登録済み') : '未設定（タップして現在地を登録）', 'weather'),
      row('週の振り返り', core.DAY_NAMES[cfg.weeklyDay] + '曜 ' + core.shortTime(cfg.weeklyTime) + 'に知らせる', 'weekly'),
    ]))
    sections.push(sec('その他', null, [
      row('Todoのデータ', cfg.todoFile, 'todo'),
      row('アラーム準備のショートカット名', cfg.shortcutPlan, 'shortcut'),
    ]))
    const log = ui.readDebugLog ? ui.readDebugLog(core, 8) : []
    sections.push(sec('動作確認', '今の時間帯：' + core.PHASE_NAMES[core.phaseAt(data, new Date()).phase] +
      ' ・ アラーム準備：' + (data.state.plan ? data.state.plan.date + (data.state.plan.wake ? ' オン' : ' オフ') : 'まだ'),
      log.map(l => row(l, '', null))))
    return sections
  }

  // ---------- 変更 ----------

  async function save(data) {
    data.config = core.normalizeConfig(data.config)
    core.saveConfig(data)
    data.problems = data.problems.filter(p => p.indexOf('config.json') < 0)
    try {
      await notify.rescheduleBedtime(core, data, new Date())
    } catch (e) { /* 通知の予約は次の実行でやり直される */ }
  }

  // 変更したら true（保存する）、やめたら false
  async function change(cfg, key) {
    const [kind, arg] = key.split(':')
    if (kind === 'theme' || kind === 'themeNight') {
      // 夜は「なし（朝・昼と同じ）」を先頭に
      const keys = (kind === 'themeNight' ? [''] : []).concat(Object.keys(dawn.THEMES))
      const label = k => k ? dawn.THEMES[k].name + '（' + dawn.THEMES[k].note + '）' : 'なし（朝・昼と同じデザインで、色だけ夜にする）'
      const i = await ui.choose(kind === 'theme' ? 'デザイン' : '夜だけ別のデザイン', keys.map(k => ((cfg[kind] || '') === k ? '✓ ' : '') + label(k)))
      if (i < 0) return false
      cfg[kind] = keys[i]
      return true
    }
    if (kind === 'stage') {
      if (arg === 'add') {
        const last = cfg.stages[cfg.stages.length - 1]
        const v = await ui.askTime(core, '追加する段階の時刻', core.fmtTime(core.addMinutes(core.at(new Date(), last.time), 10)))
        if (!v) return false
        cfg.stages.push({ name: '追加', time: v, score: Math.max(0, last.score - 20) })
        cfg.stages.forEach(x => { x.clockLabel = '' })
        return true
      }
      const s = cfg.stages[Number(arg)]
      if (!s) return false
      const n = s.index + 1
      const i = await ui.choose('段階' + n, ['時刻を変える', '名前を変える', '点数を変える', 'この段階を削除'])
      if (i === 0) { const v = await ui.askTime(core, '段階' + n + 'の時刻', s.time); if (!v) return false; s.time = v }
      else if (i === 1) { const v = await ui.askText('名前', null, s.name); if (!v) return false; s.name = v }
      else if (i === 2) { const v = await ui.askNumber('点数（0〜100）', s.score); if (v === null) return false; s.score = Math.min(100, v) }
      else if (i === 3) {
        if (cfg.stages.length <= 1) { await ui.info('段階は1つ以上必要です'); return false }
        if (!(await ui.confirm('段階' + n + 'を削除しますか？', '時計アプリの「' + s.clockLabel + '」とショートカットも合わせて直してください', '削除'))) return false
        cfg.stages.splice(s.index, 1)
        cfg.stages.forEach(x => { x.clockLabel = '' })
      } else return false
      return true
    }
    if (kind === 'day') {
      const name = dayName(arg)
      const d = cfg.days[arg]
      const i = await ui.choose(name, ['起床する・出発時刻あり', '起床する・出発なし', '起床しない'])
      if (i === 0) { const v = await ui.askTime(core, name + 'の出発時刻', d.departure || '07:45'); if (!v) return false; cfg.days[arg] = { wake: true, departure: v } }
      else if (i === 1) cfg.days[arg] = { wake: true, departure: null }
      else if (i === 2) cfg.days[arg] = { wake: false, departure: null }
      else return false
      return true
    }
    if (kind === 'time') {
      const label = { bedtime: '就寝時刻', daytimeEnd: '昼間の終わり', noon: 'チェックインの締め切り' }[arg]
      const v = await ui.askTime(core, label, cfg[arg])
      if (!v) return false
      cfg[arg] = v
      return true
    }
    if (kind === 'opens') { const v = await ui.askNumber('最初のアラームの何分前から受け付けるか', cfg.checkinOpensMinutes); if (v === null) return false; cfg.checkinOpensMinutes = Math.min(720, v); return true }
    if (kind === 'holidays') { cfg.skipHolidays = !cfg.skipHolidays; return true }
    if (kind === 'routine') {
      if (arg === 'add') {
        const name = await ui.askText('項目の名前', null, '', '例：洗顔')
        if (!name) return false
        const m = await ui.askNumber('所要時間（分）', 5)
        cfg.routine.push({ name, minutes: m === null ? 5 : m })
        return true
      }
      const idx = Number(arg)
      const r = cfg.routine[idx]
      if (!r) return false
      const k = await ui.choose(r.name, ['名前を変える', '所要時間を変える', '1つ上へ', '削除'])
      if (k === 0) { const v = await ui.askText('名前', null, r.name); if (!v) return false; r.name = v }
      else if (k === 1) { const v = await ui.askNumber('所要時間（分）', r.minutes); if (v === null) return false; r.minutes = v }
      else if (k === 2) { if (idx === 0) return false; cfg.routine.splice(idx - 1, 0, cfg.routine.splice(idx, 1)[0]) }
      else if (k === 3) cfg.routine.splice(idx, 1)
      else return false
      return true
    }
    if (kind === 'belong') {
      if (arg === 'add') { const v = await ui.askText('持ち物', null, ''); if (!v) return false; cfg.belongings.push(v); return true }
      const idx = Number(arg)
      const b = cfg.belongings[idx]
      if (b === undefined) return false
      const k = await ui.choose(b, ['名前を変える', '削除'])
      if (k === 0) { const v = await ui.askText('名前', null, b); if (!v) return false; cfg.belongings[idx] = v }
      else if (k === 1) cfg.belongings.splice(idx, 1)
      else return false
      return true
    }
    if (kind === 'belongMin') { const v = await ui.askNumber('出発の何分前に知らせるか', cfg.belongingsMinutes); if (v === null) return false; cfg.belongingsMinutes = Math.min(120, v); return true }
    if (kind === 'rule') {
      const v = await ui.askText('自分ルール', '最終段階まで寝てしまった朝に表示します。空にすると表示しません', cfg.ownRule, '例：今夜は23時にスマホを置く')
      if (v === null) return false
      cfg.ownRule = v
      return true
    }
    if (kind === 'weather') {
      const i = await ui.choose('天気の場所', cfg.weatherLocation ? ['いまいる場所に変える', '天気を使わない'] : ['いまいる場所を登録'], '天気は Open-Meteo（無料）から取ります')
      if (i < 0) return false
      if (cfg.weatherLocation && i === 1) { cfg.weatherLocation = null; return true }
      try {
        Location.setAccuracyToThreeKilometers()
        const p = await Location.current()
        let name = ''
        try {
          const g = await Location.reverseGeocode(p.latitude, p.longitude, 'ja_JP')
          if (g && g[0]) name = [g[0].administrativeArea, g[0].locality].filter(x => x).join(' ')
        } catch (e) { /* 地名が取れなくても場所は使える */ }
        // 天気には約1kmの精度で十分。細かい位置は保存しない
        cfg.weatherLocation = { lat: Math.round(p.latitude * 100) / 100, lon: Math.round(p.longitude * 100) / 100, name }
        return true
      } catch (e) {
        await ui.info('現在地を取得できません', '設定アプリ > Scriptable > 位置情報 を「このAppの使用中のみ許可」にしてください')
        return false
      }
    }
    if (kind === 'weekly') {
      const i = await ui.choose('週の振り返りの曜日', core.DAY_NAMES.map(d => d + '曜'))
      if (i < 0) return false
      const v = await ui.askTime(core, '時刻', cfg.weeklyTime)
      if (!v) return false
      cfg.weeklyDay = i
      cfg.weeklyTime = v
      return true
    }
    if (kind === 'todo') { const v = await ui.askText('Todoのデータファイル', 'Scriptable フォルダからの場所', cfg.todoFile); if (!v) return false; cfg.todoFile = v; return true }
    if (kind === 'shortcut') { const v = await ui.askText('ショートカットの名前', '就寝リマインドから開くショートカット', cfg.shortcutPlan); if (!v) return false; cfg.shortcutPlan = v; return true }
    return false
  }

  async function edit(ctx, key) {
    if (!key) return false
    const changed = await change(ctx.data.config, key)
    if (changed) await save(ctx.data)
    return changed
  }

  return { model, edit }
}
