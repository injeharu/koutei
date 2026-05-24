# 工程表管理アプリ

建設現場の2週間工程表を作成・管理・印刷するElectronデスクトップアプリです。

## 機能

- **工程表の作成** — カレンダーで2週間の期間を選択して工程表を作成
- **日付自動入力** — 開始日から日付（〇/〇(曜日)）をグリッドに自動入力。日曜日は赤文字
- **リッチテキスト編集** — 太字・文字色・フォントサイズ・横/縦揃え対応
- **セル縦幅の自動拡張・縮小** — 内容が増えると行全体が自動で伸び、削除すると縮む
- **次の週を作成** — 現在の工程表から1週間スライドした新しい工程表を自動作成（右列の内容を左列に引き継ぎ）
- **自動保存** — 入力から1秒後にFirebase Firestoreへ自動保存
- **PDF出力 / 印刷** — A4縦向きでPDF出力・印刷プレビュー
- **モバイル閲覧** — スマートフォンのブラウザからリアルタイムで閲覧可能

## 技術スタック

| レイヤー | 技術 |
|---|---|
| デスクトップアプリ | Electron + React + Vite |
| データベース | Firebase Firestore（クラウド・自動保存） |
| モバイル閲覧 | Firebase Hosting |
| インストーラー | electron-builder（NSIS形式 .exe） |

## セットアップ

### 必要なもの

- Node.js 18以上
- Firebase プロジェクト（Firestore・Hosting有効化済み）

### インストール

```bash
git clone https://github.com/injeharu/koutei.git
cd koutei
npm install
```

### Firebase設定

`src/firebase.js` に自分のFirebaseプロジェクトの設定値を入力してください。

```js
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
}
```

### 開発サーバー起動

```bash
npm run dev
```

### Windowsインストーラー（.exe）のビルド

```bash
npm run build:win
```

`dist/工程表管理 Setup 1.0.0.exe` が生成されます。

### モバイル閲覧ページのデプロイ

```bash
npx firebase deploy --only hosting
```

## グリッド構成

デフォルトは7行×4列。列の構成は以下の通りです。

| c0 | c1 | c2 | c3 |
|---|---|---|---|
| 1週目の日付 | 1週目の工程内容 | 2週目の日付 | 2週目の工程内容 |

「次の週を作成」ボタンを押すと、c2/c3の内容がc0/c1に引き継がれ、c2/c3に新しい週の日付が入ります。

## ライセンス

MIT
