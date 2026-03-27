# ana-lists

[English README](./README-en.md)

GitHub の **Stars** と公式 **Lists** を整理・管理する、個人用 CRM ツールです。

リポジトリの stargazer を調べて保存し、ユーザーごとにタグやメモを付けて追跡できます。GitHub Stars / Lists をインポートして_CURRENT STATE_と_DESIRED STATE_を比較しながら、List 整理を計画・実行できます。

Cloudflare Workers + D1 上で動作し、**GitHub OAuth** または **self-only モード** に対応しています。

アプリ本体は [`app/`](./app) にあります。

## 機能

- 任意の公開リポジトリの stargazer を手動同期
- stargazer の検索・絞り込み（タグ、メモ、保存済みなどでフィルタ）
- GitHub Stars / Lists のインポート（ブックマークレットで GitHub ページから直接取得）
- スプレッドシート風エディターで List 割り当てを編集
- 現在の GitHub 状態とDesired State の差分表示
- Bulk Queue による List 整理ワークフロー

## できること

- GitHub Stars が増えすぎて整理しきれない
- 誰が Star していたかをあとで見返したい
- 気になるユーザーにメモやタグを付けて追跡したい
- GitHub Lists を整理する前に一覧・比較・計画をしたい
- 自分用の軽量 GitHub CRM がほしい

## 制限事項

- GitHub Lists への**直接書き込み**は v1 では未対応
- インポート処理は GitHub ページ構造に依存するため、セレクター調整が必要な場合あり

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | React 19 + Vite |
| API | Cloudflare Workers |
| DB | Cloudflare D1 |
| 認証 | GitHub OAuth / self-only モード |

## 最短セットアップ

### 1. `app/.dev.vars` を作成

```env
SELF_ONLY_GITHUB_LOGIN=your-github-username
SESSION_SECRET=replace-me
APP_ORIGIN=http://localhost:8787
```

GitHub OAuth を使う場合:
```env
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

### 2. 依存関係をインストール

```bash
cd app
npm install
```

### 3. D1 ローカルマイグレーションを適用

```bash
npx wrangler d1 migrations apply github-star-lists-crm --local
```

### 4. 開発サーバーを起動

```bash
npm run dev
```

フロントエンドの変更を継続的に反映:
```bash
npm run dev:live
```

### 5. ブラウザで確認

- Worker 込み: `http://localhost:8787`
- フロントのみ: `http://localhost:4173`

## Windows

PowerShell または cmd でそのまま実行できます。

```powershell
cd .\app
npm install
npx wrangler d1 migrations apply github-star-lists-crm --local
npm run dev
```

## Cloudflare へのデプロイ

```bash
cd app
npm run build
npx wrangler deploy
```

`main` ブランチへの push で自動デプロイ（要 `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID`）。

リモート D1 マイグレーション:
```bash
cd app
npx wrangler d1 migrations apply your-database-name --remote
```

## GitHub OAuth 設定

GitHub OAuth App の設定:

- Homepage URL: `https://your-worker.your-subdomain.workers.dev`
- Authorization callback URL: `https://your-worker.your-subdomain.workers.dev/api/auth/github/callback`

Cloudflare 側に以下を設定:

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `SESSION_SECRET`

## 課金対策

Cloudflare D1 の予期せぬ課金を防ぐため、以下の制限があります:

- stargazer 同期: リポジトリあたり最大 5,000 人
- プロフィール取得: 同期時最大 500 人の詳細を取得（他は最小限データ）
- D1 batch 操作: 100 ステートメントずつ分割
- クエリ制限: 500〜10,000 行に制限
- DB インデックス: 9 個追加でフルテーブルスキャン軽減

制限変更:
- `src/server/github.ts` の `MAX_STARGZERS_PER_SYNC`
- `src/server/github.ts` の `PROFILE_FETCH_LIMIT`
- `src/server/store.ts` の `D1_BATCH_CHUNK_SIZE`
