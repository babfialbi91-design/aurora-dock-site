# Aurora Dock — landing page

Live: **https://aurora-dock.babfialbi91.workers.dev**

Static landing page for the **Aurora Dock** theme (Seelen UI), served by a tiny
Cloudflare Worker. The theme repo stays **private**; the Worker reads it with a
read-only token and streams the newest release asset, so the download link never
goes stale and the source is never exposed.

```
public/                 served as-is (no build step)
  index.html            markup (Arabic RTL)
  assets/styles.css     glass / grain / monochrome design system
  assets/app.js         release lookup, download, dock wave, reveals
  previews/*.jpg        12 wallpaper previews (1600x900)
  _headers              security headers
src/index.js            Worker: /api/latest + /download/:file, else assets
wrangler.jsonc          Worker + static assets
```

## Routes

| Route | What it does |
| --- | --- |
| `/` | the page |
| `/api/latest` | `{ tag, published, files[] }` from the theme repo (cached 5 min) |
| `/download/aurora-dock.slu` | newest `.slu`, streamed with `Content-Disposition: attachment` |
| `/download/aurora-dock-wallpapers.zip` | newest wallpaper pack |

Only `.slu` / `.zip` names matching `[A-Za-z0-9._-]+` are proxied; anything else is 404.

## Develop

```powershell
npm install
# .dev.vars  ->  GH_TOKEN=<fine-grained PAT, read-only on the theme repo>
npm run dev        # http://127.0.0.1:8787
```

## Deploy

```powershell
npx wrangler login
npx wrangler secret put GH_TOKEN     # paste the token
npm run deploy
```

The token only needs **Contents: Read** and **Releases: Read** on
`babfialbi91-design/seelen-aurora-dock`.

## Notes

- A web page cannot launch a local file. The `.slu` downloads, then Seelen takes
  over on double-click (the toast explains that last step).
- No cookies, analytics or third-party scripts.

Develop by: **Qacem**
