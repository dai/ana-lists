# ana-lists

[English README](./README-en.md)

GitHub の **Stars** と公式 **Lists** をまとめて整理・管理する、個人用 CRM ツールです。

公開リポジトリの stargazer を調べて保存し、ユーザーごとにタグやメモを付けながら整理できます。  
また、自分の starred repositories / Lists を取り込み、現在の GitHub 上の状態と「こう整理したい」という desired state を比較しながら、整理作業を進められます。

Cloudflare Workers + D1 上で動作し、**GitHub OAuth** または **self-only モード** に対応しています。

アプリ本体は [`app/`](./app) にあります。

## 特徴

- 任意の公開リポジトリを追跡して stargazer を手動同期
- stargazer の検索・絞り込み
- ユーザーごとのタグ・メモ・保存状態の管理
- GitHub stars / Lists のインポート
- 現在の GitHub 状態と desired state の比較
- bulk queue による List 整理支援

## 向いている用途

- GitHub の Stars が増えて整理しきれなくなってきた
- 「誰が Star していたか」をあとで見返したい
- 気になるユーザーにメモやタグを付けて追跡したい
- GitHub Lists を手作業で整理する前に、一覧・比較・計画をしたい
- 自分用の軽量な GitHub CRM がほしい

## まだできないこと / 制限事項

- GitHub Lists への**直接書き込み**は v1 では未対応です
- import helper は GitHub のページ構造に依存するため、必要に応じてセレクターの調整が必要になる場合があります

## 技術スタック

- フロントエンド: React + Vite
- API: Cloudflare Workers
- DB: Cloudflare D1
- 認証: GitHub OAuth または self-only モード

## 最短セットアップ

ローカルで試す最短手順です。

### 1. `app/.dev.vars` を作成

```env
SELF_ONLY_GITHUB_LOGIN=(your-github)username
SESSION_SECRET=replace-me
APP_ORIGIN=http://localhost:8787
```

GitHub OAuth を使う場合は、さらに以下も追加します。

```env
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

### 2. 依存関係をインストール

ネイティブバイナリの依存があるため、`npm install` と実行は **同じ環境** で行ってください。

```bash
cd app
npm install
```

### 3. D1 のローカルマイグレーションを適用

```bash
npx wrangler d1 migrations apply github-star-lists-crm --local
```

### 4. 開発サーバーを起動

```bash
npm run dev
```

`npm run dev` は起動前にフロントエンドを一度 build してから `wrangler dev` を起動します。

フロントエンドの変更を継続的に反映したい場合は、以下を使ってください。

```bash
npm run dev:live
```

### 5. ブラウザで確認

- Worker API 込み: `http://localhost:8787`
- フロントのみ: `http://localhost:4173`

## ローカル起動

### アプリ全体を起動

```bash
cd app
npm install
npx wrangler d1 migrations apply github-star-lists-crm --local
npm run dev
```

変更を即時反映したい場合は `npm run dev:live` を使ってください。

### フロントエンドだけ確認する場合

```bash
cd app
npm run dev:client
```

## Windows での起動

`cmd` または PowerShell でそのまま実行できます。

### アプリ全体を起動

```powershell
cd .\app
npm install
npx wrangler d1 migrations apply github-star-lists-crm --local
npm run dev
```

フロントエンド変更を継続反映したい場合は、以下を使います。

```powershell
npm run dev:live
```

### フロントエンドだけ確認する場合

```powershell
cd .\app
npm run dev:client
```

## ローカル環境変数

ローカルでは `app/.dev.vars` を使います。

例:

```env
SELF_ONLY_GITHUB_LOGIN=(your-github)username
SESSION_SECRET=replace-me
APP_ORIGIN=http://localhost:8787
```

OAuth を使う場合は以下も設定します。

```env
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

## Codex ローカル権限メモ

Codex 用のローカル権限補足設定は [`./.codex/settings.local.json`](./.codex/settings.local.json) にあります。

現時点で許可済みとして扱うのは次の Bash コマンドだけです。

- `git pull:*`
- `gh repo:*`

注意:

- `gh pr`、`gh issue`、`gh run` など `gh repo` 以外の系統は、この設定だけでは許可済みとみなしません
- PowerShell 経由の別コマンドや、ここに書かれていない操作は対象外です

## Cloudflare へのデプロイ

```bash
cd app
npm run build
npx wrangler deploy
```

GitHub Actions では、`app/**` への push で build / test / typecheck が走ります。
さらに `main` ブランチへの push で、以下の GitHub Secrets が設定されていれば Cloudflare Workers へ自動 deploy します。

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

設定手順:

1. Cloudflare Dashboard の `My Profile` → `API Tokens` で token を作成
2. テンプレートは `Edit Cloudflare Workers` を使う
3. Account ID は Cloudflare Dashboard のアカウント概要から取得する
4. GitHub の `Settings` → `Secrets and variables` → `Actions` に以下を追加する

   - `CLOUDFLARE_API_TOKEN`: 上で作成した token
   - `CLOUDFLARE_ACCOUNT_ID`: Cloudflare の Account ID

この設定が入ると、`main` への push で `.github/workflows/cloudflare-build.yml` の deploy job が有効になります。

リモート D1 マイグレーション:

```bash
cd app
npx wrangler d1 migrations apply your-d1-database-name --remote
```

## GitHub OAuth 設定

GitHub OAuth App の設定例:

- Homepage URL: `https://your-d1-database-name.<name>.workers.dev`
- Authorization callback URL: `https://your-d1-database-name.<name>.workers.dev/api/auth/github/callback`

Cloudflare 側では、以下の環境変数を設定してください。

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `SESSION_SECRET`

## デプロイ先

- App URL: [https://your-d1-database-name.<name>.workers.dev](https://your-d1-database-name.<name>.workers.dev)

## 用語メモ

- **stargazer**: 対象リポジトリに Star を付けている GitHub ユーザー
- **Lists**: GitHub の公式リスト機能
- **desired state**: 自分が最終的に整理したい状態
- **bulk queue**: まとめて整理・処理するための作業キュー

## 課金対策

Cloudflare D1 の予期せぬ課金を防ぐため、以下の制限を設けています。

- **Stargazer 同期**: リポジトリあたり最大 5,000 人まで
- **プロフィール取得**: 同期時は最大 500 人の詳細を取得（残りは最小限データで保存）
- **D1 batch 操作**: バッチ挿入は 100 ステートメントずつ分割
- **クエリ制限**: リストクエリは 500〜10,000 行に制限し、無制限読み込みを防止
- **DB インデックス**: 9 個のインデックスを追加し、フルテーブルスキャンを軽減

個人利用で制限を上げたい場合は、以下の定数を調整してください。

- `src/server/github.ts` の `MAX_STARGZERS_PER_SYNC`
- `src/server/github.ts` の `PROFILE_FETCH_LIMIT`
- `src/server/store.ts` の `D1_BATCH_CHUNK_SIZE`

## 補足

- このプロジェクトは、GitHub の Stars / Lists を自分用に整理したいケースを想定しています
- 公開リポジトリの stargazer 調査や、あとで見返すためのタグ付け・メモ用途に向いています
