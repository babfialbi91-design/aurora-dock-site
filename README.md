# Aurora Dock — landing page

Live: **https://aurora-dock.babfialbi91.workers.dev**

Static landing page for the **Aurora Dock** theme (Seelen UI), served by a tiny
Cloudflare Worker. The worker only resolves the newest release and redirects;
no tokens, no secrets, no build step.

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
| `/api/latest` | `{ tag, published, files[] }` from the theme repo (cached 5 min) |
| `/download/aurora-dock.slu` | `302` → newest release asset |
| `/download/aurora-dock-wallpapers.zip` | `302` → newest wallpaper pack |

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
