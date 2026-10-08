// wake-lib/log.js
// 動作の記録（WakeApp/debug-log.txt）。iPhone で何が起きたかを、iCloud 経由でパソコンから確かめるため。
// 新しい行を先頭に足し、最大200行。記録に失敗しても本来の処理は止めない

function write(msg) {
  try {
    const fm = FileManager.iCloud()
    const dir = fm.joinPath(fm.documentsDirectory(), 'WakeApp')
    if (!fm.fileExists(dir)) fm.createDirectory(dir, true)
    const p = fm.joinPath(dir, 'debug-log.txt')
    const old = fm.fileExists(p) && fm.isFileDownloaded(p) ? fm.readString(p).split('\n') : []
    const line = new Date().toLocaleString('ja-JP') + '  ' + String(msg).replace(/\n/g, ' / ')
    fm.writeString(p, [line].concat(old).slice(0, 200).join('\n'))
  } catch (e) { /* 記録できなくても続ける */ }
}

module.exports = { write }
