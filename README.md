# Fitness Tracker

Log workouts, body weight, and calories. Users create an account and their data
is saved server-side, so it's there whenever they log back in from any device.

**Stack:** static front end in `public/` + a Cloudflare Worker (`src/worker.js`)
serving a JSON API, with users and entries stored in Cloudflare D1 (SQLite).
Passwords are hashed with PBKDF2-SHA256 (per-user salt); sessions are HMAC-signed
httpOnly cookies.

## Run locally

No Cloudflare login needed — `wrangler dev` uses a local D1 database.

```bash
npm install
cp .dev.vars.example .dev.vars   # then put a long random string in JWT_SECRET
npm run db:local                 # create tables in the local D1
npm run dev                      # http://localhost:8123 (use --port 8123)
```

## Deploy to Cloudflare

Authenticate wrangler with either `npx wrangler login` or an API token
(Account > D1 > Edit, Account > Workers Scripts > Edit):

```bash
export CLOUDFLARE_API_TOKEN="..."      # zsh/bash
```

Then:

```bash
npx wrangler d1 create fitness-db      # copy the printed database_id into wrangler.toml
npm run db:remote                      # create tables in the remote D1
npx wrangler secret put JWT_SECRET     # paste a long random string
npm run deploy
```

`.dev.vars` and any API token must never be committed.

## Notes

- Existing entries saved in a browser's `localStorage` (from before accounts)
  are offered for import into the account on first login.
- Login attempts aren't rate-limited in code; add a Cloudflare rate-limiting
  rule for `/api/login` and `/api/signup` in the dashboard.
- The site is an installable PWA; API responses are never cached by the service worker.
