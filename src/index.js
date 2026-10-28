const REPO = "babfialbi91-design/seelen-aurora-dock";
const API = `https://api.github.com/repos/${REPO}`;
const AUTHORS = "aurora-dock-site";
const TTL = 900;
const ASSET_RE = /^[A-Za-z0-9._-]+$/;
const KNOWN = ["aurora-dock.slu", "aurora-dock-wallpapers.zip"];

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

const gh = (path, init = {}) =>
  fetch(path.startsWith("http") ? path : `${API}${path}`, {
    ...init,
    headers: { accept: "application/vnd.github+json", "user-agent": AUTHORS, ...(init.headers || {}) },
  });

async function viaApi() {
  const res = await gh("/releases/latest");
  if (!res.ok) throw new Error(`api ${res.status}`);

  const release = await res.json();
  return {
    tag: release.tag_name || "",
    published: release.published_at || "",
    notes: release.html_url || "",
    files: (release.assets || []).map((a) => ({
      name: a.name,
      size: a.size,
      url: a.browser_download_url,
    })),
  };
}

/**
 * Fallback that never touches api.github.com: the /releases/latest redirect
 * carries the tag, then each known asset is HEAD-ed for its size.
 * GitHub's anonymous API limit (60/h per IP) is shared by every Worker, so
 * this keeps the download path alive when the API says 403.
 */
async function viaRedirect() {
  const res = await fetch(`https://github.com/${REPO}/releases/latest`, {
    redirect: "manual",
    headers: { "user-agent": AUTHORS },
  });
  const location = res.headers.get("location") || "";
  const tag = (location.match(/\/tag\/([^/?#]+)/) || [])[1] || "";
  if (!tag) throw new Error("no tag");

  const files = [];
  const results = await Promise.allSettled(
    KNOWN.map(async (name) => {
      const url = `https://github.com/${REPO}/releases/download/${tag}/${name}`;
      const head = await fetch(url, { method: "HEAD", redirect: "follow", headers: { "user-agent": AUTHORS } });
      return head.ok ? { name, size: Number(head.headers.get("content-length")) || 0, url } : null;
    })
  );
  for (const r of results) if (r.status === "fulfilled" && r.value) files.push(r.value);
  if (!files.length) throw new Error("no assets");

  return { tag, published: "", notes: `https://github.com/${REPO}/releases/tag/${tag}`, files };
}

async function latestRelease(ctx) {
  const cache = caches.default;
  const key = new Request("https://cache.local/latest-release-v4", { method: "GET" });
  const hit = await cache.match(key);
  if (hit) return hit.json();

  let data = null;
  try {
    data = await viaApi();
  } catch (e) {
    data = await viaRedirect();
  }

  const cached = json(data, 200, { "cache-control": `public, max-age=${TTL}` });
  ctx.waitUntil(cache.put(key, cached.clone()));
  return data;
}

async function handleLatest(ctx) {
  try {
    return json(await latestRelease(ctx));
  } catch (err) {
    return json({ error: "unreachable" }, 502);
  }
}

async function latestReleases(ctx, count = 5) {
  const cache = caches.default;
  const key = new Request(`https://cache.local/releases-v5-${count}`, { method: "GET" });
  const hit = await cache.match(key);
  if (hit) return hit.json();

  const res = await gh(`/releases?per_page=${count}`);
  if (!res.ok) throw new Error(`GitHub responded ${res.status}`);

  const list = await res.json();
  const payload = {
    releases: (Array.isArray(list) ? list : []).map((r) => ({
      tag: r.tag_name || "",
      name: r.name || r.tag_name || "",
      published: r.published_at || "",
      body: (r.body || "").slice(0, 2000),
      url: r.html_url || "",
      prerelease: !!r.prerelease,
      files: (r.assets || []).map((a) => ({ name: a.name, size: a.size })),
    })),
  };

  const cached = json(payload, 200, { "cache-control": "public, max-age=21600" });
  ctx.waitUntil(cache.put(key, cached.clone()));
  return payload;
}

async function handleReleases(ctx) {
  try {
    return json(await latestReleases(ctx));
  } catch (err) {
    return json({ error: "unreachable" }, 502);
  }
}

async function handleDownload(ctx, name) {
  if (!ASSET_RE.test(name) || !/\.(slu|zip)$/i.test(name)) {
    return new Response("Not found", { status: 404 });
  }

  const sources = [`https://github.com/${REPO}/releases/latest/download/${name}`];

  // The API only adds a fallback URL; a 403 there must not break the download.
  try {
    const release = await latestRelease(ctx);
    const file = release.files.find((f) => f.name === name);
    if (file && file.url) sources.push(file.url);
  } catch (e) {
    /* direct URL is usually enough */
  }

  let asset = null;
  for (const src of sources) {
    try {
      const res = await fetch(src, { headers: { "user-agent": AUTHORS }, redirect: "follow" });
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

    if (url.pathname === "/api/latest") return handleLatest(ctx);
    if (url.pathname === "/api/releases") return handleReleases(ctx);

    if (url.pathname.startsWith("/download/")) {
      return handleDownload(ctx, decodeURIComponent(url.pathname.slice(10)));
    }

    return env.ASSETS.fetch(request);
  },
};
