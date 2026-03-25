# ana-lists

[日本語 README](./README.md)

A private CRM for GitHub `Stars` and official GitHub `Lists`.  
It lets you explore stargazers for any public repository, keep private notes and tags on people, and import your starred repositories / Lists to plan bulk organization work.

The current application lives in [`app/`](./app).

## Features

- Track any public repository and manually sync stargazers
- Search and filter stargazers with tags, notes, and saved state
- Import GitHub stars / Lists into the workspace
- Compare current GitHub state with a desired state
- Generate a bulk queue for List organization work
- Built on Cloudflare Workers + D1 + React/Vite

## Stack

- Frontend: React + Vite
- API: Cloudflare Workers
- Database: Cloudflare D1
- Auth: GitHub OAuth or self-only mode

## Local preview

Because of native binary dependencies, run `npm install` and the dev commands in the same environment.

```bash
cd app
npm install
npx wrangler d1 migrations apply github-star-lists-crm --local
npm run dev
```

Frontend-only preview:

```bash
cd app
npm run dev:client
```

## Local environment

Use `app/.dev.vars`. Example:

```env
SELF_ONLY_GITHUB_LOGIN=dai
SESSION_SECRET=replace-me
APP_ORIGIN=http://localhost:8787
```

Add these for OAuth:

```env
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

## Deploy to Cloudflare

```bash
cd app
npm run build
npx wrangler deploy
```

Run remote D1 migrations:

```bash
cd app
npx wrangler d1 migrations apply github-star-lists-crm --remote
```

## GitHub OAuth settings

Use these values when creating the GitHub OAuth App:

- Homepage URL: `https://github-star-lists-crm.dai.workers.dev`
- Authorization callback URL: `https://github-star-lists-crm.dai.workers.dev/api/auth/github/callback`

On Cloudflare, configure `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `SESSION_SECRET`.

## Deployment

- App URL: [https://github-star-lists-crm.dai.workers.dev](https://github-star-lists-crm.dai.workers.dev)

## Notes

- Direct writeback to GitHub Lists is not implemented in v1
- The import helper depends on GitHub page structure and may need selector updates
