# ana-lists

[日本語 README](./README.md)

ana-lists is a personal CRM tool for organizing and managing GitHub **Stars** and official **Lists** in one place.

You can inspect and save stargazers of public repositories, attach tags and notes to individual users, and import your own starred repositories / Lists to plan and manage your organization workflow.  
It also helps you compare the current state on GitHub with your desired state before you reorganize things.

The app runs on Cloudflare Workers + D1 and supports either **GitHub OAuth** or **self-only mode**.

The main application lives in [`app/`](./app).

## Features

- Track any public repository and manually sync its stargazers
- Search and filter stargazers
- Manage per-user tags, notes, and saved state
- Import GitHub stars / Lists
- Compare current GitHub state with desired state
- Organize Lists with a bulk queue workflow

## Good fit for

- People whose GitHub Stars have grown too large to manage comfortably
- Reviewing who starred a repository later
- Tracking interesting GitHub users with notes and tags
- Planning GitHub Lists organization before doing manual cleanup
- Building a lightweight personal GitHub CRM

## Not supported yet / Limitations

- Direct write-back to GitHub Lists is **not supported** in v1
- The import helper depends on GitHub page structure, so selectors may need adjustments if GitHub changes the UI

## Tech stack

- Frontend: React + Vite
- API: Cloudflare Workers
- Database: Cloudflare D1
- Auth: GitHub OAuth or self-only mode

## Quick start

This is the fastest way to run it locally.

### 1. Create `app/.dev.vars`

```env
SELF_ONLY_GITHUB_LOGIN=(your-github)username
SESSION_SECRET=replace-me
APP_ORIGIN=http://localhost:8787
```

If you want to use GitHub OAuth, also add:

```env
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

### 2. Install dependencies

Because some dependencies include native binaries, run `npm install` and the app in the **same environment**.

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

`npm run dev` builds the frontend once before starting `wrangler dev`.

If you want frontend changes to keep showing up while you edit, use:

```bash
npm run dev:live
```

### 5. Open it in your browser

- With Worker API: `http://localhost:8787`
- Frontend only: `http://localhost:4173`

## Local development

### Run the full app

```bash
cd app
npm install
npx wrangler d1 migrations apply github-star-lists-crm --local
npm run dev
```

For continuous frontend rebuilds while the Worker is running, use `npm run dev:live`.

### Run frontend only

```bash
cd app
npm run dev:client
```

## Running on Windows

You can run the commands directly in `cmd` or PowerShell.

### Run the full app

```powershell
cd .\app
npm install
npx wrangler d1 migrations apply github-star-lists-crm --local
npm run dev
```

For continuous frontend rebuilds while testing locally, use:

```powershell
npm run dev:live
```

### Run frontend only

```powershell
cd .\app
npm run dev:client
```

## Local environment variables

For local development, use `app/.dev.vars`.

Example:

```env
SELF_ONLY_GITHUB_LOGIN=(your-github)username
SESSION_SECRET=replace-me
APP_ORIGIN=http://localhost:8787
```

If using OAuth, also configure:

```env
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

## Codex local permissions note

The local Codex permission override lives in [`./.codex/settings.local.json`](./.codex/settings.local.json).

At the moment, only these Bash command families should be treated as pre-approved:

- `git pull:*`
- `gh repo:*`

Notes:

- `gh pr`, `gh issue`, `gh run`, and other `gh` namespaces are not implied by this setting
- PowerShell commands and any operation not listed here remain out of scope for this override

## Deploying to Cloudflare

```bash
cd app
npm run build
npx wrangler deploy
```

In GitHub Actions, pushes touching `app/**` run typecheck, tests, and build.
Pushes to `main` also deploy to Cloudflare Workers when these GitHub Secrets are configured:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Setup steps:

1. In the Cloudflare Dashboard, open `My Profile` -> `API Tokens`
2. Create a token using the `Edit Cloudflare Workers` template
3. Copy your Account ID from the Cloudflare account overview
4. In GitHub, open `Settings` -> `Secrets and variables` -> `Actions` and add:

   - `CLOUDFLARE_API_TOKEN`: the token created above
   - `CLOUDFLARE_ACCOUNT_ID`: your Cloudflare Account ID

Once those are set, pushes to `main` will activate the deploy job in `.github/workflows/cloudflare-build.yml`.

Apply remote D1 migrations:

```bash
cd app
npx wrangler d1 migrations apply your-d1-database-name --remote
```

## GitHub OAuth setup

Example values for a GitHub OAuth App:

- Homepage URL: `https://your-d1-database-name.<name>.workers.dev`
- Authorization callback URL: `https://your-d1-database-name.<name>.workers.dev/api/auth/github/callback`

On the Cloudflare side, configure:

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `SESSION_SECRET`

## Deployment URL

- App URL: [https://your-d1-database-name.<name>.workers.dev](https://your-d1-database-name.<name>.workers.dev)

## Glossary

- **stargazer**: a GitHub user who starred a target repository
- **Lists**: GitHub’s official list feature
- **desired state**: the final organization state you want to reach
- **bulk queue**: a queue used to process and organize items in batches

## Cost control

To avoid unexpected Cloudflare D1 charges, the app includes the following limits:

- **Stargazer sync**: up to 5,000 users per repository
- **Profile fetch**: fetch detailed profiles for up to 500 users during sync (the rest are stored with minimal data)
- **D1 batch operations**: inserts are split into chunks of 100 statements
- **Query limits**: list queries are capped between 500 and 10,000 rows to avoid unbounded reads
- **Database indexes**: 9 indexes are added to reduce full table scans

If you want to raise the limits for personal use, adjust these constants:

- `MAX_STARGZERS_PER_SYNC` in `src/server/github.ts`
- `PROFILE_FETCH_LIMIT` in `src/server/github.ts`
- `D1_BATCH_CHUNK_SIZE` in `src/server/store.ts`

## Notes

- This project is designed for personal workflows around GitHub Stars / Lists organization
- It is especially useful for investigating stargazers of public repositories and keeping personal notes / tags for later review
