const REPO = "babfialbi91-design/seelen-aurora-dock";
const API = `https://api.github.com/repos/${REPO}`;
const RELEASES_TTL = 900;
const ASSET_RE = /^[A-Za-z0-9._-]+$/;

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=60",
      ...extra,
    },
  });
}

async function latestRelease(ctx) {
  const cache = caches.default;
  const key = new Request("https://cache.local/latest-release-v2", { method: "GET" });
  const hit = await cache.match(key);
  if (hit) return hit.json();

  const res = await fetch(`${API}/releases/latest`, {
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": "aurora-dock-site",
    },
  });
  if (!res.ok) throw new Response(`GitHub responded ${res.status}`, { status: 502 });

  const release = await res.json();
  const data = {
    tag: release.tag_name || "",
    published: release.published_at || "",
    notes: release.html_url || "",
    files: (release.assets || []).map((a) => ({
      name: a.name,
      size: a.size,
      url: a.browser_download_url,
    })),
  };

  const cached = json(data, 200, { "cache-control": `public, max-age=${RELEASES_TTL}` });
  ctx.waitUntil(cache.put(key, cached.clone()));
  return data;
}

async function handleLatest(ctx) {
  try {
    return json(await latestRelease(ctx));
  } catch (err) {
    if (err instanceof Response) return err;
    return json({ error: "unreachable" }, 502);
  }
}

async function handleDownload(ctx, name) {
  if (!ASSET_RE.test(name) || !/\.(slu|zip)$/i.test(name)) {
    return new Response("Not found", { status: 404 });
  }

  let file;
  try {
    const release = await latestRelease(ctx);
    file = release.files.find((f) => f.name === name);
    if (!file) return new Response("Asset not in latest release", { status: 404 });
  } catch (err) {
    if (err instanceof Response) return err;
    return new Response("Download failed", { status: 502 });
  }

  const sources = [
    `https://github.com/${REPO}/releases/latest/download/${name}`,
    file.url,
  ];

  let asset = null;
  for (const src of sources) {
    if (!src) continue;
    try {
      const res = await fetch(src, { headers: { "user-agent": "aurora-dock-site" } });
      if (res.ok && res.body) {
        asset = res;
        break;
      }
    } catch (e) {
      /* try the next source */
    }
  }

  if (!asset) return new Response("Download failed", { status: 502 });

  const headers = new Headers({
    "content-type": "application/octet-stream",
    "content-disposition": `attachment; filename="${name}"`,
    "cache-control": "public, max-age=300",
    "x-content-type-options": "nosniff",
  });
  const len = asset.headers.get("content-length");
  if (len) headers.set("content-length", len);

  return new Response(asset.body, { status: 200, headers });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405 });
    }

    if (url.pathname === "/api/latest") {
      return handleLatest(ctx);
    }

    if (url.pathname.startsWith("/download/")) {
      return handleDownload(ctx, decodeURIComponent(url.pathname.slice(10)));
    }

    return env.ASSETS.fetch(request);
  },
};
