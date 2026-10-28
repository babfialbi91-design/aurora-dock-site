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

function decodeEntities(s) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function htmlToText(html) {
  return html
    .replace(/<\/(p|li|h[1-6]|div|blockquote)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

/**
 * Fallback for the release list that never touches api.github.com.
 * GitHub publishes a releases Atom feed with the same titles, dates and
 * bodies; it is served as a normal web page, so it is not rate limited the
 * way the anonymous API is.
 */
async function releasesViaAtom(count) {
  const res = await fetch(`https://github.com/${REPO}/releases.atom`, {
    headers: { "user-agent": AUTHORS, accept: "application/atom+xml" },
  });
  if (!res.ok) throw new Error(`atom ${res.status}`);

  const xml = await res.text();
  const entries = xml.split("<entry>").slice(1);

  return entries
    .map((entry) => {
      const link = (entry.match(/<link[^>]+href="([^"]+)"/) || [])[1] || "";
      const tag = (link.match(/\/tag\/([^/?#"]+)$/) || [])[1] || "";
      const title = (entry.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1] || "";
      const updated = (entry.match(/<updated>([\s\S]*?)<\/updated>/) || [])[1] || "";
      const content = (entry.match(/<content[^>]*>([\s\S]*?)<\/content>/) || [])[1] || "";

      return {
        tag,
        name: decodeEntities(title).trim(),
        published: updated,
        body: htmlToText(decodeEntities(content)).slice(0, 2000),
        url: link || `https://github.com/${REPO}/releases/tag/${tag}`,
        prerelease: false,
        files: [],
      };
    })
    .filter((r) => r.tag)
    .slice(0, count);
}

async function latestReleases(ctx, count = 5) {
  const cache = caches.default;
  const key = new Request(`https://cache.local/releases-v5-${count}`, { method: "GET" });
  const hit = await cache.match(key);
  if (hit) return hit.json();

  let releases;
  let usedFallback = false;
  try {
    const res = await gh(`/releases?per_page=${count}`);
    if (!res.ok) throw new Error(`GitHub responded ${res.status}`);

    const list = await res.json();
    releases = (Array.isArray(list) ? list : []).map((r) => ({
      tag: r.tag_name || "",
      name: r.name || r.tag_name || "",
      published: r.published_at || "",
      body: (r.body || "").slice(0, 2000),
      url: r.html_url || "",
      prerelease: !!r.prerelease,
      files: (r.assets || []).map((a) => ({ name: a.name, size: a.size })),
    }));
  } catch (err) {
    usedFallback = true;
    releases = await releasesViaAtom(count);
  }

  const payload = { releases };

  // The Atom feed has no asset sizes; come back to the API sooner.
  const ttl = usedFallback ? 1800 : 21600;
  const cached = json(payload, 200, { "cache-control": `public, max-age=${ttl}` });
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
