# GitHydra

<p align="center">
  <img src="git-hydra-icon.png" alt="GitHydra icon" width="128" height="128">
</p>

<p align="center">
  <b>シンプルで軽快な Git GUI クライアント</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT">
  <img src="https://img.shields.io/badge/Tauri-2.0-24C8D8?logo=tauri" alt="Tauri">
  <img src="https://img.shields.io/badge/React-18.2.0-61DAFB?logo=react" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5.4.2-3178C6?logo=typescript" alt="TypeScript">
</p>

---

## 概要

**git-hydra** は、Tauri + React + TypeScript + Rust で構築されたシンプルな Git GUI クライアントです。
Rust の [git2](https://github.com/rust-lang/git2-rs) をバックエンドに利用し、GitKraken 風の直感的なインターフェースで、リポジトリの閲覧、コミット、ブランチ操作、差分確認、worktree 管理などの日常業務を快適に行えます。

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
- **worktree 対応**
  - worktree の一覧、作成、削除
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
| フレームワーク | Tauri v2 |
| バックエンド | Rust, git2 |
| フロントエンド | React 18, TypeScript |
| スタイリング | Tailwind CSS |
| ビルドツール | Vite |
| パッケージング | Tauri Bundler |
| E2E テスト | Playwright |

## 必要条件

- Node.js（LTS 推奨）
- npm
- Rust（Tauri ビルドに必要）
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

開発モードでは、Vite の HMR が有効になります。Tauri の Rust バックエンドと React フロントエンドが同時に起動します。

## ビルド

```bash
# プロダクションビルド
npm run build

# フロントエンドのみビルド
npm run build:fe
```

### パッケージング

```bash
# macOS 向け .app を作成
npm run build
```

ビルド結果は `src-tauri/target/release/bundle/macos/GitHydra.app` に出力されます。

## リリース版のダウンロード

[GitHub Releases](https://github.com/shotahirao/git-hydra/releases) から最新版をダウンロードできます。

### macOS でアプリが開けない場合

現在、GitHydra は Apple Developer ID によるコード署名を行っていないため、macOS の Gatekeeper によってブロックされることがあります。

以下のようなメッセージが表示された場合：

> 「GitHydra」は壊れているため開けません。ゴミ箱に入れる必要があります。

 ターミナルで以下のコマンドを実行し、アプリの検疫属性を解除してください：

```bash
sudo xattr -rd com.apple.quarantine /Applications/GitHydra.app
```

> 注: `Operation not permitted` と表示される場合は、**System Settings → Privacy & Security → Full Disk Access** から **Terminal** を許可してください。

または、以下の方法でも開けます：

1. アプリを右クリック → 「開く」を選択
2. System Settings → Privacy & Security →「GitHydra」の「とにかく開く」を許可

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
├── src-tauri/            # Tauri Rust バックエンド
│   ├── src/
│   │   ├── main.rs       # エントリーポイント
│   │   ├── lib.rs        # Tauri コマンド登録
│   │   ├── commands.rs   # フロントエンド向けコマンド
│   │   ├── git_service.rs # git2 による Git 操作
│   │   └── watcher.rs    # リポジトリ変更監視
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── icons/            # アプリアイコン
├── src/
│   ├── renderer/         # React によるフロントエンド
│   │   ├── App.tsx
│   │   ├── api/          # Tauri API ラッパー
│   │   ├── components/   # UI コンポーネント
│   │   └── types.ts
│   └── types/            # Git 関連の型定義
├── index.html
├── package.json
├── playwright.config.ts
├── tailwind.config.cjs
├── tsconfig.json
└── vite.config.ts
```

## ライセンス

[MIT](LICENSE)

---

<p align="center">Built with ❤️ by <a href="https://github.com/shotahirao">shotahirao</a></p>
