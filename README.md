# Aurora Dock — landing page

Static, dependency-free landing page for the **Aurora Dock** theme (Seelen UI).

- One download button → pulls the newest `aurora-dock.slu` from the theme repo's
  latest GitHub Release (`/releases/latest/download/aurora-dock.slu`), so the
  link never goes stale.
- Version badge reads the latest tag (cached 1h, silent fallback).
- No accounts, cookies, analytics or third-party scripts.

```
public/
  index.html        markup (Arabic RTL)
  assets/styles.css design system: glass, grain, monochrome
  assets/app.js     release lookup, download, dock wave, reveals
  favicon.svg
  _headers          security headers (Cloudflare)
wrangler.jsonc      Workers static assets
```

## Develop

```powershell
npm install
npm run dev        # http://localhost:8787
```

## Deploy

```powershell
npx wrangler login
npm run deploy     # https://aurora-dock.<subdomain>.workers.dev
```

No build step: `public/` is served as-is.

## Notes

- The `.slu` is downloaded by the browser; opening it hands the file to Seelen,
  which installs and activates the theme. A page cannot launch local files on
  its own, so the toast explains the last click.
- Related repo: [seelen-aurora-dock](https://github.com/babfialbi91-design/seelen-aurora-dock).

Develop by: **Qacem**
