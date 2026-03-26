# ana-lists

[English README](./README-en.md)

GitHub の `Stars` と公式 `Lists` をまとめて管理する個人用 CRM です。
任意の公開リポジトリの stargazer を調べたり、人にメモやタグを付けたり、starred repositories / Lists を取り込んで整理計画を作れます。

アプリ本体は [`app/`](./app) にあります。

## 主な機能

- 任意の公開リポジトリを追跡して stargazer を手動同期
- stargazer の検索・絞り込み・タグ・メモ・保存状態管理
- GitHub stars / Lists のインポート
- 現在の GitHub 状態とdesired stateの比較
- bulk queue による List 整理支援
- Cloudflare Workers + D1 + React/Vite 構成

## 技術スタック

- フロントエンド: React + Vite
- API: Cloudflare Workers
- DB: Cloudflare D1
- 認証: GitHub OAuth または self-only モード

## ローカル起動

ネイティブバイナリの依存があるため、`npm install` と実行は同じ環境で行ってください。

```bash
cd app
npm install
npx wrangler d1 migrations apply your-d1-database-name --local
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
cd .\app
npx wrangler d1 migrations apply your-d1-database-name --local
npm run dev
```

フロントだけ確認する場合:

```powershell
cd .\app
npm run dev:client
```

一般的な確認先:

- Worker API 込み: `http://localhost:8787`
- フロントのみ: `http://localhost:4173`

## ローカル環境変数

`app/.dev.vars` を使います。例:

```env
SELF_ONLY_GITHUB_LOGIN=dai
SESSION_SECRET=replace-me
APP_ORIGIN=http://localhost:8787
```

OAuth を使う場合は以下も追加します:

```env
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

## Cloudflare へのデプロイ

```bash
cd app
npm run build
npx wrangler deploy
```

リモート D1 マイグレーション:

```bash
cd app
npx wrangler d1 migrations apply your-d1-database-name --remote
```

## GitHub OAuth 設定

GitHub OAuth App の設定値:

- Homepage URL: `https://github-star-lists-crm.dai.workers.dev`
- Authorization callback URL: `https://github-star-lists-crm.dai.workers.dev/api/auth/github/callback`

Cloudflare 側で `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `SESSION_SECRET` を設定します。

## デプロイ先

- App URL: [https://github-star-lists-crm.dai.workers.dev](https://github-star-lists-crm.dai.workers.dev)

## 補足

- GitHub Lists への直接書き込みは v1 では未対応です
- import helper は GitHub ページ構造に依存するため、必要に応じてセレクターの調整が必要な場合があります

## 課金対策

Cloudflare D1 の予期せぬ課金を防ぐため、以下の制限を設けています:

- **Stargarrer同期**: リポジトリあたり最大 5,000 人まで
- **プロフィール取得**: 同期時 最大 500 人の詳細取得 (残りは最小限データで保存)
- **D1 batch操作**: バッチ挿入は 100 ステートメントずつ分割
- **クエリ制限**: リストクエリは 500〜10,000 行に制限し無制限読み込みを防止
- **DBインデックス**: 9個のインデックスを追加しフルテーブルスキャンらを軽減

個人利用で制限を上げたい場合、ソースコードの定数を調整してください:
- `src/server/github.ts` の `MAX_STARGZERS_PER_SYNC`
- `src/server/github.ts` の `PROFILE_FETCH_LIMIT`
- `src/server/store.ts` の `D1_BATCH_CHUNK_SIZE`
