# git-hydra

<p align="center">
  <img src="git-hydra-icon.png" alt="GitHydra icon" width="128" height="128">
</p>

<p align="center">
  <b>シンプルで軽快な Git GUI クライアント</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT">
  <img src="https://img.shields.io/badge/Electron-29.1.1-47848F?logo=electron" alt="Electron">
  <img src="https://img.shields.io/badge/React-18.2.0-61DAFB?logo=react" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5.4.2-3178C6?logo=typescript" alt="TypeScript">
</p>

---

## 概要

**git-hydra** は、Electron + React + TypeScript で構築されたシンプルな Git GUI クライアントです。
[simple-git](https://github.com/steveukx/git-js) をバックエンドに利用し、GitKraken 風の直感的なインターフェースで、リポジトリの閲覧、コミット、ブランチ操作、差分確認などの日常業務を快適に行えます。

## 主な機能

- **リポジトリの閲覧**
  - ローカルの Git リポジトリを開いて、コミット履歴やブランチ、作業ツリーの状態を確認
- **マルチタブ対応**
  - 複数のリポジトリをタブで同時に開くことが可能
  - 終了時のタブ状態を保存し、次回起動時に復元
- **コミットグラフ**
  - ブランチの分岐・マージを視覚的に表示
  - コミットを選択して詳細と差分を表示
- **ブランチ操作**
  - ブランチの一覧表示、チェックアウト、新規作成、削除、リネーム
  - マージ・リベース対応
- **ステージング & コミット**
  - GitKraken 風の Status パネルで、ステージ / アンステージ / コミットを実行
  - ファイルを選択して作業ディレクトリまたはステージの差分を確認
- **リモート操作**
  - プッシュ、プル、フェッチ
- **最近使ったリポジトリ**
  - 履歴から素早く再オープン

## 技術スタック

| レイヤー | 技術 |
| --- | --- |
| フレームワーク | Electron |
| フロントエンド | React 18, TypeScript |
| スタイリング | Tailwind CSS |
| ビルドツール | Vite（electron-vite） |
| Git 操作 | simple-git |
| パッケージング | electron-builder |
| E2E テスト | Playwright |

## 必要条件

- Node.js（LTS 推奨）
- npm
- ローカルにインストールされた Git

## インストール

```bash
# リポジトリをクローン
git clone https://github.com/shotahirao/git-hydra.git
cd git-hydra

# 依存関係をインストール
npm install
```

## 開発

```bash
# 開発サーバーを起動
npm run dev
```

開発モードでは、Vite の HMR が有効になります。Electron のメインプロセスとレンダラープロセスが同時に起動します。

## ビルド

```bash
# プロダクションビルド
npm run build

# ビルド結果を確認
npm run preview
```

### パッケージング

```bash
# 各プラットフォーム向けのインストーラーを作成
npx electron-builder
```

macOS 向けには `resources/icon.icns` を、アプリ一般には `resources/icon.png` を使用しています。

## テスト

```bash
# E2E テストを実行
npm run test:e2e

# UI モードで E2E テストを実行
npm run test:e2e:ui
```

Playwright を使用し、リポジトリのオープンやブランチ切り替え、スクロール動作などを E2E で検証しています。

## プロジェクト構造

```
git-hydra/
├── e2e/                  # Playwright E2E テスト
├── resources/            # アプリケーションアイコンなどのリソース
├── scripts/              # ビルド後のリソースコピーなどのスクリプト
├── src/
│   ├── main/             # Electron メインプロセス（Git 操作、設定管理）
│   │   ├── gitService.ts
│   │   └── configService.ts
│   ├── main.ts           # Electron アプリのエントリーポイント
│   ├── preload.ts        # コンテキストブリッジ（IPC インターフェース）
│   ├── renderer/         # React によるレンダラープロセス
│   │   ├── App.tsx
│   │   ├── components/   # UI コンポーネント
│   │   │   ├── BranchList.tsx
│   │   │   ├── CommitDetail.tsx
│   │   │   ├── CommitGraph.tsx
│   │   │   ├── RepoView.tsx
│   │   │   ├── StatusPanel.tsx
│   │   │   └── TabBar.tsx
│   │   └── types.ts
│   └── types/            # Git 関連の型定義
├── electron.vite.config.ts
├── index.html
├── package.json
├── playwright.config.ts
├── tailwind.config.cjs
└── tsconfig.json
```

## ライセンス

[MIT](LICENSE)

---

<p align="center">Built with ❤️ by <a href="https://github.com/shotahirao">shotahirao</a></p>
