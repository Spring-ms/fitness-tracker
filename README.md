# Fitness Tracker

A static, no-build fitness tracker: workouts, body weight, and calories, all
stored in your browser's `localStorage` (no backend, no account, no sync
across devices/browsers).

## Run locally

No build step needed. Serve the folder with any static file server, e.g.:

```bash
python -m http.server 8000
```

Then open http://localhost:8000.

## Deploy to Cloudflare Pages

**Option A — direct upload (no GitHub, no CLI):**

1. Go to the Cloudflare dashboard → Workers & Pages → Create → Pages → Upload assets.
2. Upload this whole folder (`index.html`, `css/`, `js/`).
3. Cloudflare gives you a `*.pages.dev` URL immediately.

**Option B — connect a GitHub repo (auto-deploys on push):**

1. Push this folder to a GitHub repo.
2. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git.
3. Build settings: no build command, output directory `/` (project root).

**Option C — Wrangler CLI** (requires Node.js installed):

```bash
npm install -g wrangler
wrangler pages deploy .
```

## Data & privacy

All entries live only in your browser's localStorage under keys prefixed
`ft_`. Clearing site data/cookies for the deployed site will erase your
history. There is currently no export/import or multi-device sync.
