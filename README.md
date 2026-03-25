# ana-lists

[English README](./README-en.md)

GitHub の `Star` と公式 `Lists` をまとめて扱うための Private CRM です。  
任意の公開リポジトリの stargazer を調べてメモやタグを付けたり、自分の starred repositories / Lists を取り込んで整理計画を作れます。

現在のアプリ本体は [`app/`](./app) にあります。

## 主な機能

- 任意の公開 repo を追跡して stargazer を手動同期
- stargazer の検索、絞り込み、タグ、メモ、保存状態の管理
- GitHub stars / Lists のインポート
- desired state ベースの差分表示
- bulk queue による List 整理支援
- Cloudflare Workers + D1 + React/Vite 構成

## 構成

- フロントエンド: React + Vite
- API: Cloudflare Workers
- DB: Cloudflare D1
- 認証: GitHub OAuth または self-only mode

## ローカル起動

依存のネイティブバイナリ都合で、`npm install` と実行は同じ環境で行ってください。

```bash
cd app
npm install
npx wrangler d1 migrations apply your−workers−name --local
npm run dev
```

フロントだけ確認する場合:

```bash
cd app
npm run dev:client
```

### Windows での起動

`cmd` または PowerShell でそのまま実行できます。

```powershell
cd C:\playground\app
npx wrangler d1 migrations apply your−workers−name −−local
npm run dev
```

フロントだけ確認する場合:

```powershell
cd C:\playground\app
npm run dev:client
```

通常の確認先:

- Worker API 込み: `http://localhost:8787`
- フロントのみ: `http://localhost:4173`

## ローカル環境変数

`app/.dev.vars` を使います。例:

```env
SELF_ONLY_GITHUB_LOGIN=your name
SESSION_SECRET=replace-me
APP_ORIGIN=http://localhost:8787
```

OAuth を使う場合は以下も追加します。

```env
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

## Cloudflare への反映

```bash
cd app
npm run build
npx wrangler deploy
```

DB migration:

```bash
cd app
npx wrangler d1 migrations apply your−workers−name  -remote
```

## GitHub OAuth 設定

GitHub OAuth App の設定値:

- Homepage URL: `https://your-workers-name.workers.dev`
- Authorization callback URL: `https://your-workers-name.workers.dev/api/auth/github/callback`

Cloudflare 側では `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `SESSION_SECRET` を設定します。

## デプロイ先

- App URL: [https://your-workers-name.workers.dev](https://your-workers-name.workers.dev)

## 補足

- GitHub Lists への直接書き込みは v1 では未対応です
- import helper は GitHub ページ構造に依存するため、必要に応じて調整が必要です
