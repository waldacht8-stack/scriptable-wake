# 起床アプリ開発（段階式目覚まし）

要件は [docs/要件書.md](docs/要件書.md) にある。実装前に必ず読み、「10.2 実機で検証する項目」から着手すること。

## 開発環境

- 開発は Windows の VS Code、実行は iPhone の Scriptable。Mac・Xcode は使わない
- ソースは `src/` に置き、`tools/deploy.ps1` で iCloud Drive の Scriptable フォルダへコピーする
  - コピー先：`%USERPROFILE%\iCloudDrive\iCloud~dk~simonbs~Scriptable`
  - iCloud の同期後、iPhone の Scriptable にスクリプトが現れる
- GitHub：https://github.com/waldacht8-stack/scriptable-wake（公開・`main`）。iPhone の `起床 Update.js` が最新コミットの `src/manifest.json` に載ったファイルを取得して上書きする
  - スクリプトを追加・削除したら `src/manifest.json` を更新する（`deploy.ps1` が載せ忘れを警告する）
  - 公開リポジトリなので、個人データ（チェックインのコードなど）をコミットしない
- 本アプリのファイル構成（既存 Todo アプリと同じ形）
  - `src/起床.js`：メイン（画面・ショートカットからの呼び出し口）
  - `src/起床ウィジェット.js`：ロック画面ウィジェット
  - `src/wake-lib/*.js`：共通モジュール（`importModule('wake-lib/xxx')` で読む）
  - データ：iCloud の Scriptable フォルダ内 `WakeApp/`（要件書 7 章）

## 既存 Todo アプリ（読み取り専用・変更禁止）

iCloud の Scriptable フォルダに既にある。中身を参考にしてよいが、ファイルは書き換えないこと。

- `TODO.js`、`TODO Update.js`、`todo-lib/`（model / store / sync / notify / ui / widget）
- データ：`todo-data/todo-data.json`（`version: 2`、`todos[]` に `id, title, done, due, allDay, note` など）
- `todo-lib/widget.js` は `accessoryCircular / accessoryRectangular / accessoryInline` の描画を既に持っている。それでもロック画面に表示できていない原因は未調査（要件書 6.3・10.2）

## 守ること

- 費用ゼロ。有料 API・API キーが必要なサービスは使わない
- Scriptable の API にない機能を前提にしない。不明点は推測で埋めず利用者に確認する
- 時計アプリのアラーム操作はショートカットでしかできない。ショートカットは日本語の手順書（画面のボタン名で）として渡す
- 利用者はプログラミングの専門家ではない。説明は平易な日本語で書く
