# Aurora Dock — landing page

Live: **https://aurora-dock.babfialbi91.workers.dev**

Static landing page for the **Aurora Dock** theme (Seelen UI), served by a tiny
Cloudflare Worker. No build step — `public/` is shipped as-is, and the worker
only resolves releases and streams the asset. No tokens or secrets live in the
worker (the theme repo is public, read anonymously).

## What's on the page

- Dark **and** light mode (system-aware, saved in `localStorage`, `?theme=light|dark` for sharing).
- One download button: real progress (streamed, not simulated), file size from the API,
  then a "done + how to activate" toast. Clicking downloads the latest `.slu`.
- Interactive dock mockup — the icon wave follows the pointer, and four swatches
  swap the wallpaper behind it.
- **Real screenshots** (`shots/*.webp`, alpha-matted from the actual desktop) in a
  desktop rig with a dark/light switch — no mockups.
- **What's new** — the last three GitHub releases, notes cleaned to plain text,
  with a "new" chip on the hero when the latest release is under 7 days old.
- 12 wallpaper previews in WebP (click to open full size) + wallpaper pack download.
- Custom 404 page, skip-link, `og.jpg` (1200×630) for link previews.
- Terms, privacy ("no cookies, no tracking"), `Develop by: Qacem`.

```
public/                 served as-is
  index.html            markup (Arabic RTL)
  404.html              custom not-found page
  og.jpg                1200x630 social card
  assets/styles.css     glass / grain / monochrome design system
  assets/app.js         release lookup, download, rig switch, changelog, reveals
  previews/*.webp       13 wallpaper images (1600x900, ~125 KB total)
  shots/*.webp          real screenshots, alpha-matted dock
  _headers              security headers
src/index.js            Worker: /api/latest, /api/releases, /download/:file, else assets
wrangler.jsonc          Worker + static assets
.github/workflows/       auto-deploy on push
```

## Routes

| Route | What it does |
| --- | --- |
| `/` | the page |
| `/api/latest` | `{ tag, published, files[] }` from the theme repo (cached 15 min) |
| `/api/releases` | last 5 releases `{ tag, name, published, body, url, files }` (cached 15 min) |
| `/download/aurora-dock.slu` | newest `.slu`, streamed with `Content-Disposition: attachment` |
| `/download/aurora-dock-wallpapers.zip` | newest wallpaper pack |
| anything else | `404.html` (200-less 404 via `not_found_handling`) |

Only `.slu` / `.zip` names matching `[A-Za-z0-9._-]+` are accepted; anything else is 404.

## Develop

```powershell
npm install
npm run dev        # http://127.0.0.1:8787
```

## Deploy

Manual:

```powershell
npx wrangler login
npm run deploy
```

Automatic: `.github/workflows/deploy.yml` runs on every push to `main` (and on
`workflow_dispatch`). It needs two repository secrets:

| Secret | Where to get it |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens → *Edit Cloudflare Workers* template |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard URL (`dash.cloudflare.com/<account-id>`) |

Without the token the workflow logs a warning and skips the deploy instead of
failing. New **theme** releases do not need a redeploy: the page and the worker
read GitHub live (15 min cache).

## Notes

- A web page cannot launch a local file. The `.slu` downloads, then Seelen (or
  "open with") takes over — the toast explains that last click.
- No cookies, analytics or third-party scripts.

Develop by: **Qacem**
