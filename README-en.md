# ana-lists

[日本語 README](./README.md)

A personal CRM tool for organizing and managing GitHub **Stars** and official **Lists**.

Inspect and save stargazers of public repositories, attach tags and notes to users for tracking, and import your GitHub Stars / Lists to compare your current state with your desired state while planning and executing List organization.

Runs on Cloudflare Workers + D1 with **GitHub OAuth** or **self-only mode**.

The main application lives in [`app/`](./app).

## Features

- Track any public repository and manually sync its stargazers
- Search and filter stargazers (by tags, notes, saved state, etc.)
- Import GitHub Stars / Lists using a bookmarklet from GitHub pages
- Spreadsheet-style editor for assigning repositories to Lists
- Diff view comparing current GitHub state with Desired State
- Bulk Queue workflow for organized List management

## Good fit for

- GitHub Stars have grown too large to manage
- Reviewing who starred a repository later
- Tracking interesting GitHub users with notes and tags
- Planning GitHub Lists reorganization before doing manual cleanup
- Building a lightweight personal GitHub CRM

## Limitations

- Direct write-back to GitHub Lists is **not supported** in v1
- Import processing depends on GitHub page structure; selectors may need adjustment

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + Vite |
| API | Cloudflare Workers |
| Database | Cloudflare D1 |
| Auth | GitHub OAuth / self-only mode |

## Quick start

### 1. Create `app/.dev.vars`

```env
SELF_ONLY_GITHUB_LOGIN=your-github-username
SESSION_SECRET=replace-me
APP_ORIGIN=http://localhost:8787
```

For GitHub OAuth, also add:
```env
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

### 2. Install dependencies

```bash
cd app
npm install
```

### 3. Apply local D1 migrations

```bash
npx wrangler d1 migrations apply github-star-lists-crm --local
```

### 4. Start the dev server

```bash
npm run dev
```

For continuous frontend rebuilds:
```bash
npm run dev:live
```

### 5. Open in browser

- With Worker API: `http://localhost:8787`
- Frontend only: `http://localhost:4173`

## Windows

Run directly in PowerShell or cmd.

```powershell
cd .\app
npm install
npx wrangler d1 migrations apply github-star-lists-crm --local
npm run dev
```

## Deploying to Cloudflare

```bash
cd app
npm run build
npx wrangler deploy
```

Pushes to `main` auto-deploy when `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are configured.

Apply remote D1 migrations:
```bash
cd app
npx wrangler d1 migrations apply your-database-name --remote
```

## GitHub OAuth setup

GitHub OAuth App settings:

- Homepage URL: `https://your-worker.your-subdomain.workers.dev`
- Authorization callback URL: `https://your-worker.your-subdomain.workers.dev/api/auth/github/callback`

Configure in Cloudflare:

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `SESSION_SECRET`

## Cost control

Built-in limits to avoid unexpected Cloudflare D1 charges:

- Stargazer sync: max 5,000 users per repository
- Profile fetch: up to 500 detailed profiles per sync (rest are minimal)
- D1 batch operations: split into chunks of 100 statements
- Query limits: 500-10,000 rows capped
- 9 database indexes to reduce full table scans

To adjust limits:
- `MAX_STARGZERS_PER_SYNC` in `src/server/github.ts`
- `PROFILE_FETCH_LIMIT` in `src/server/github.ts`
- `D1_BATCH_CHUNK_SIZE` in `src/server/store.ts`
