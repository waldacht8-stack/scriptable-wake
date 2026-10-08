// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: cloud-download-alt;
// 起床 Update.js — GitHub から最新のプログラムを取得して Scriptable フォルダに上書きする
//   データ（WakeApp/ の設定・記録）と既存 Todo アプリのファイルには触らない
//   最新版の確認（GitHub API）は回線によって回数制限にかかることがあるので、
//   失敗したらブランチ名で直接取りに行く（その場合はキャッシュを避ける印を付ける）
const REPO = 'waldacht8-stack/scriptable-wake'
const BRANCH = 'main'

function writeLog(msg) {
  try { importModule('wake-lib/log').write(msg) } catch (e) { /* 記録なしで続ける */ }
}

async function fetchText(url, json) {
  const r = new Request(url)
  r.timeoutInterval = 20
  r.headers = { 'User-Agent': 'scriptable-wake-updater', 'Accept': json ? 'application/vnd.github+json' : '*/*' }
  let body
  try {
    body = await r.loadString()
  } catch (e) {
    throw new Error('通信できませんでした（' + (e && e.message ? e.message : e) + '）。電波のよい場所でもう一度試してください')
  }
  const code = r.response ? r.response.statusCode : 0
  if (code !== 200) throw new Error(url.replace(/^https:\/\/[^/]+/, '') + ' → HTTP ' + code)
  return body
}

// 書き込んでよい場所か（本アプリのスクリプトだけ）
function allowed(dest) {
  return /^起床[^/]*\.js$/.test(dest) || /^wake-lib\/[^/]+\.js$/.test(dest)
}

// 最新版の番号。確認できなければ null（ブランチ名で取りに行く）
async function latestCommit() {
  try {
    return JSON.parse(await fetchText('https://api.github.com/repos/' + REPO + '/commits/' + BRANCH, true))
  } catch (e) {
    writeLog('起床 Update: 最新版の確認に失敗（' + e.message + '）。ブランチ名で取得します')
    return null
  }
}

async function main() {
  const commit = await latestCommit()
  // 番号が分かれば、その版を確実に取る。分からなければブランチ名＋キャッシュよけ
  const ref = commit ? commit.sha : BRANCH
  const bust = commit ? '' : '?t=' + Date.now()
  const base = 'https://raw.githubusercontent.com/' + REPO + '/' + ref + '/src/'
  const manifest = JSON.parse(await fetchText(base + 'manifest.json' + bust))
  const fm = FileManager.iCloud()
  const dir = fm.documentsDirectory()
  // 先に全部ダウンロードしてから書く（途中で失敗して古い版と新しい版が混ざらないように）
  const files = []
  for (const f of manifest.files) {
    if (!allowed(f.dest)) throw new Error('配信リストに書き込めない場所があります: ' + f.dest)
    files.push({ dest: f.dest, text: await fetchText(base + f.src.split('/').map(encodeURIComponent).join('/') + bust) })
  }
  for (const f of files) {
    const dest = fm.joinPath(dir, f.dest)
    const parent = dest.substring(0, dest.lastIndexOf('/'))
    if (!fm.fileExists(parent)) fm.createDirectory(parent, true)
    fm.writeString(dest, f.text)
  }
  const removed = []
  for (const name of manifest.remove || []) {
    if (!allowed(name)) continue
    const p = fm.joinPath(dir, name)
    if (fm.fileExists(p)) {
      fm.remove(p)
      removed.push(name)
    }
  }
  const version = commit ? '版: ' + commit.sha.slice(0, 7) + '\n' + (commit.commit.message || '').split('\n')[0] : '版: 最新（番号は確認できませんでした）'
  writeLog('起床 Update: 成功 ' + (commit ? commit.sha.slice(0, 7) : 'main') + ' ' + files.length + 'ファイル')
  return version + '\n\n' + files.length + 'ファイルを更新しました' +
    (removed.length ? '\n不要なスクリプトを削除: ' + removed.join('、') : '')
}

const a = new Alert()
try {
  a.title = '更新完了'
  a.message = await main()
} catch (e) {
  a.title = '更新失敗'
  a.message = (e && e.message ? e.message : String(e)) + '\n\n（iCloud の同期でも新しい版は届きます）'
  writeLog('起床 Update: 失敗 ' + a.message.replace(/\n/g, ' '))
}
a.addAction('OK')
await a.presentAlert()
Script.complete()
