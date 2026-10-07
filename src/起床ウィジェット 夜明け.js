// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-purple; icon-glyph: sun;
// 起床ウィジェット 夜明け.js — ロック画面ウィジェット（デザイン案D「朝焼けの地平」）
//   ロック画面に追加して、このスクリプトを選ぶ。今の「起床ウィジェット」と同じ動きで、見た目だけが違う。
//   パラメータに todo / waking / morning / night / presleep を入れると、その表示に固定できる。
//   アプリから実行すると、3種類 × 時間帯の見た目を確認できる（プレビュー）。

const core = importModule('wake-lib/core')
const dawn = importModule('wake-lib/dawn')
const widget = importModule('wake-lib/dawn-widget')(core, dawn)

async function make(family, param) {
  try {
    const data = await core.loadAll()
    return await widget.build(data, family, new Date(), param)
  } catch (e) {
    console.error(e)
    return widget.buildError(e && e.message ? e.message : String(e))
  }
}

if (config.runsInWidget) {
  Script.setWidget(await make(config.widgetFamily, args.widgetParameter))
} else {
  const families = [['長方形', 'accessoryRectangular'], ['円形', 'accessoryCircular'], ['1行', 'accessoryInline']]
  const phases = [['いまの時間帯', null], ['起床中', 'waking'], ['朝（出発まで）', 'morning'], ['昼間（Todo）', 'todo'], ['夜', 'night'], ['就寝前', 'presleep']]
  const a = new Alert()
  a.title = '夜明けウィジェットのプレビュー'
  a.message = '種類を選んでください'
  for (const f of families) a.addAction(f[0])
  a.addCancelAction('閉じる')
  const i = await a.present()
  if (i >= 0) {
    const b = new Alert()
    b.title = '時間帯'
    for (const p of phases) b.addAction(p[0])
    b.addCancelAction('閉じる')
    const j = await b.presentSheet()
    if (j >= 0) {
      const family = families[i][1]
      const w = await make(family, phases[j][1])
      if (family === 'accessoryRectangular') await w.presentAccessoryRectangular()
      else if (family === 'accessoryCircular') await w.presentAccessoryCircular()
      else await w.presentAccessoryInline()
    }
  }
}
Script.complete()
