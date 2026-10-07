// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: bell;
// 起床ウィジェット.js — ロック画面ウィジェット（1行・長方形・円形）
//   ロック画面に追加して、このスクリプトを選ぶ。
//   パラメータに todo / waking / morning / night / presleep を入れると、その表示に固定できる。
//   アプリから実行すると、3種類の見た目を確認できる（プレビュー）。

const core = importModule('wake-lib/core')
const widget = importModule('wake-lib/widget')

function messageOf(e) {
  return e && e.message ? e.message : String(e)
}

async function make(family, param) {
  try {
    const data = await core.loadAll()
    return await widget.build(core, data, family, new Date(), param)
  } catch (e) {
    console.error(e)
    return widget.buildError(messageOf(e))
  }
}

if (config.runsInWidget) {
  Script.setWidget(await make(config.widgetFamily, args.widgetParameter))
} else {
  // プレビュー
  const a = new Alert()
  a.title = 'ウィジェットのプレビュー'
  a.message = '見たい種類を選んでください'
  const choices = [
    ['長方形', 'accessoryRectangular'],
    ['円形', 'accessoryCircular'],
    ['1行', 'accessoryInline'],
  ]
  for (const c of choices) a.addAction(c[0])
  a.addCancelAction('閉じる')
  const i = await a.present()
  if (i >= 0) {
    const family = choices[i][1]
    const w = await make(family, null)
    if (family === 'accessoryRectangular') await w.presentAccessoryRectangular()
    else if (family === 'accessoryCircular') await w.presentAccessoryCircular()
    else await w.presentAccessoryInline()
  }
}
Script.complete()
