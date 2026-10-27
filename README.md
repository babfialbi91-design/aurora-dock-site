# Aurora Dock — landing page

Live: **https://aurora-dock.babfialbi91.workers.dev**

Static landing page for the **Aurora Dock** theme (Seelen UI), served by a tiny
Cloudflare Worker. No tokens, no secrets, no build step — `public/` is shipped
as-is and the worker only resolves the newest release and streams the asset.

## What's on the page

- Dark **and** light mode (system-aware, saved in `localStorage`, `?theme=light|dark` for sharing).
- One download button: real progress (streamed, not simulated), file size from the API,
  then a "done + how to activate" toast. Clicking downloads the latest `.slu`.
- Interactive dock mockup — the icon wave follows the pointer, and four swatches
  swap the wallpaper behind it.
- 12 wallpaper previews (click to open full size) + wallpaper pack download.
- Terms, privacy ("no cookies, no tracking"), `Develop by: Qacem`.

```
public/                 served as-is
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
| `/api/latest` | `{ tag, published, files[] }` from the theme repo (cached 15 min) |
| `/download/aurora-dock.slu` | newest `.slu`, streamed with `Content-Disposition: attachment` |
| `/download/aurora-dock-wallpapers.zip` | newest wallpaper pack |

Only `.slu` / `.zip` names matching `[A-Za-z0-9._-]+` are accepted; anything else is 404.

## Develop

```powershell
npm install
npm run dev        # http://127.0.0.1:8787
```

## Deploy

```powershell
npx wrangler login
npm run deploy
```

## Notes

- A web page cannot launch a local file. The `.slu` downloads, then Seelen (or
  "open with") takes over — the toast explains that last click.
- No cookies, analytics or third-party scripts.

Develop by: **Qacem**
