const REPO = "babfialbi91-design/seelen-aurora-dock";
const API = `https://api.github.com/repos/${REPO}`;
const RELEASES_TTL = 300;
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

async function gh(env, path, accept) {
  if (!env.GH_TOKEN) {
    throw new Response("GitHub token is not configured", { status: 503 });
  }
  const res = await fetch(`${path.startsWith("http") ? path : API + path}`, {
    headers: {
      authorization: `Bearer ${env.GH_TOKEN}`,
      accept: accept || "application/vnd.github+json",
      "user-agent": "aurora-dock-site",
      "x-github-api-version": "2022-11-28",
    },
  });
  if (!res.ok) {
    throw new Response(`GitHub responded ${res.status}`, { status: 502 });
  }
  return res;
}

async function latestRelease(env, ctx) {
  const cache = caches.default;
  const key = new Request(`https://cache.local/latest-release`, { method: "GET" });
  const hit = await cache.match(key);
  if (hit) return hit.json();

  const res = await gh(env, "/releases/latest");
  const release = await res.json();
  const data = {
    tag: release.tag_name || "",
    published: release.published_at || "",
    notes: release.html_url || "",
    files: (release.assets || []).map((a) => ({
      name: a.name,
      size: a.size,
      url: a.url,
    })),
  };

  const cached = json(data, 200, { "cache-control": `public, max-age=${RELEASES_TTL}` });
  ctx.waitUntil(cache.put(key, cached.clone()));
  return data;
}

async function handleLatest(env, ctx) {
  try {
    return json(await latestRelease(env, ctx));
  } catch (err) {
    if (err instanceof Response) return err;
    return json({ error: "unreachable" }, 502);
  }
}

async function handleDownload(env, ctx, name) {
  if (!ASSET_RE.test(name) || !/\.(slu|zip)$/i.test(name)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const release = await latestRelease(env, ctx);
    const file = release.files.find((f) => f.name === name);
    if (!file) return new Response("Asset not in latest release", { status: 404 });

    const assetRes = await gh(env, file.url, "application/octet-stream");
    const headers = new Headers({
      "content-type": "application/octet-stream",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "public, max-age=300",
      "x-content-type-options": "nosniff",
    });
    const len = assetRes.headers.get("content-length");
    if (len) headers.set("content-length", len);

    return new Response(assetRes.body, { status: 200, headers });
  } catch (err) {
    if (err instanceof Response) return err;
    return new Response("Download failed", { status: 502 });
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405 });
    }

    if (url.pathname === "/api/latest") {
      return handleLatest(env, ctx);
    }

    if (url.pathname.startsWith("/download/")) {
      return handleDownload(env, ctx, decodeURIComponent(url.pathname.slice(10)));
    }

    return env.ASSETS.fetch(request);
  },
};
