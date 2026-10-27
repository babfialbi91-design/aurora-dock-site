(function () {
  "use strict";

  var ASSET = "aurora-dock.slu";
  var DOWNLOAD = "/download/" + ASSET;
  var RELEASE_API = "/api/latest";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var root = document.documentElement;

  /* ---------- theme ---------- */

  var toggle = document.getElementById("theme-toggle");
  var metaTheme = document.querySelector('meta[name="theme-color"]');

  function applyTheme(theme, save) {
    root.setAttribute("data-theme", theme);
    if (toggle) toggle.setAttribute("aria-pressed", theme === "light" ? "true" : "false");
    if (metaTheme) metaTheme.setAttribute("content", theme === "light" ? "#f3f3f0" : "#08090a");
    if (save) {
      try {
        localStorage.setItem("aurora-theme", theme);
      } catch (e) {}
    }
  }

  applyTheme(root.getAttribute("data-theme") === "light" ? "light" : "dark", false);

  if (toggle) {
    toggle.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      root.classList.add("theming");
      applyTheme(next, true);
      try {
        var u = new URL(location.href);
        if (u.searchParams.has("theme")) {
          u.searchParams.delete("theme");
          history.replaceState(null, "", u);
        }
      } catch (e) {}
      setTimeout(function () {
        root.classList.remove("theming");
      }, 520);
    });
  }

  /* ---------- latest release ---------- */

  var pill = document.getElementById("version");
  var metas = document.querySelectorAll(".btn__meta");

  function prettySize(bytes) {
    if (!bytes) return "";
    if (bytes > 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    return Math.round(bytes / 1024) + " KB";
  }

  function applyRelease(data) {
    if (!data) return;
    if (pill && data.tag) {
      pill.textContent = data.tag;
      pill.classList.add("is-live");
    }
    var file = (data.files || []).filter(function (f) {
      return f.name === ASSET;
    })[0];
    if (file && metas.length) {
      var txt = prettySize(file.size);
      Array.prototype.forEach.call(metas, function (m) {
        m.textContent = txt;
      });
    }
  }

  function cachedRelease() {
    try {
      var raw = localStorage.getItem("aurora-release");
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data.v || Date.now() - data.t > 3600e3) return null;
      return data.v;
    } catch (e) {
      return null;
    }
  }

  applyRelease(cachedRelease());

  if ("fetch" in window) {
    var ctrl = "AbortController" in window ? new AbortController() : null;
    var timer = setTimeout(function () {
      if (ctrl) ctrl.abort();
    }, 4000);

    fetch(RELEASE_API, { headers: { Accept: "application/json" }, signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (data) {
        clearTimeout(timer);
        if (!data || !data.tag) return;
        applyRelease(data);
        try {
          localStorage.setItem("aurora-release", JSON.stringify({ v: data, t: Date.now() }));
        } catch (e) {}
      })
      .catch(function () {
        clearTimeout(timer);
      });
  }

  /* ---------- toast ---------- */

  var toast = document.getElementById("toast");
  var toastTitle = toast && toast.querySelector("strong");
  var toastBody = toast && toast.querySelector("p");
  var toastTimer = 0;

  function showToast(title, body) {
    if (!toast) return;
    if (title && toastTitle) toastTitle.textContent = title;
    if (body && toastBody) toastBody.textContent = body;
    toast.classList.add("is-open");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove("is-open");
    }, 10000);
  }

  if (toast) {
    var close = toast.querySelector(".toast__x");
    if (close) close.addEventListener("click", function () { toast.classList.remove("is-open"); });
  }

  /* ---------- download with progress ---------- */

  var busy = false;

  function saveBlob(blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = ASSET;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
  }

  function startDownload(button) {
    if (busy) return;
    busy = true;

    var label = button.querySelector(".btn__label");
    var bar = button.querySelector(".btn__bar");
    var original = label ? label.textContent : "تحميل الثيم";

    button.setAttribute("aria-busy", "true");
    if (bar) {
      bar.classList.remove("is-done");
      bar.style.width = "0%";
    }
    if (label) label.textContent = "جارٍ التنزيل…";

    function reset(after) {
      setTimeout(function () {
        if (label) label.textContent = original;
        if (bar) {
          bar.classList.remove("is-done");
          bar.style.width = "0%";
        }
        button.removeAttribute("aria-busy");
        busy = false;
      }, after);
    }

    fetch(DOWNLOAD)
      .then(function (res) {
        if (!res.ok || !res.body) throw new Error("http " + res.status);
        var total = Number(res.headers.get("content-length")) || 0;
        var reader = res.body.getReader();
        var chunks = [];
        var got = 0;

        return (function read() {
          return reader.read().then(function (step) {
            if (step.done) return new Blob(chunks, { type: "application/octet-stream" });
            chunks.push(step.value);
            got += step.value.length;
            if (total) {
              var pct = Math.min(100, Math.round((got / total) * 100));
              if (bar) bar.style.width = pct + "%";
              if (label) label.textContent = "جارٍ التنزيل " + pct + "%";
            }
            return read();
          });
        })();
      })
      .then(function (blob) {
        saveBlob(blob);
        if (bar) {
          bar.style.width = "100%";
          bar.classList.add("is-done");
        }
        if (label) label.textContent = "تم ✓";
        showToast(
          "تم تنزيل الثيم",
          "افتح aurora-dock.slu من مجلد التنزيلات (وإن سألك Windows اختر Seelen UI)، أو اسحبه على نافذة Seelen — سيتفعّل تلقائياً."
        );
        reset(4200);
      })
      .catch(function () {
        location.href = DOWNLOAD;
        showToast(
          "بدأ التنزيل",
          "افتح الملف بعد اكتماله (وإن سألك Windows اختر Seelen UI)، أو اسحبه على نافذة Seelen."
        );
        reset(2200);
      });
  }

  ["download", "download2"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener("click", function () { startDownload(el); });
  });

  /* ---------- wallpaper preview switcher ---------- */

  var wall = document.querySelector(".screen__wall");
  var hint = document.getElementById("stage-hint");
  var HINT = hint ? hint.textContent : "";
  var swatches = Array.prototype.slice.call(document.querySelectorAll(".swatch"));
  var hintTimer = 0;

  swatches.forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (!wall || btn.getAttribute("aria-pressed") === "true") return;

      swatches.forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
      btn.setAttribute("aria-pressed", "true");

      var src = btn.getAttribute("data-wall");
      var name = btn.getAttribute("data-name");

      wall.style.opacity = "0";
      setTimeout(function () {
        var img = new Image();
        img.onload = function () {
          wall.src = src;
          wall.style.opacity = "1";
        };
        img.src = src;
      }, 160);

      if (hint) {
        hint.textContent = "معاينة: " + name;
        clearTimeout(hintTimer);
        hintTimer = setTimeout(function () { hint.textContent = HINT; }, 3200);
      }
    });
  });

  /* ---------- dock wave ---------- */

  var screen = document.querySelector(".screen");
  var tiles = Array.prototype.slice.call(document.querySelectorAll("#dock .tile"));

  if (screen && tiles.length && !reduce && window.matchMedia("(pointer: fine)").matches) {
    var centers = [];
    var frame = 0;
    var pointerX = null;

    function measure() {
      centers = tiles.map(function (t) {
        var r = t.getBoundingClientRect();
        return { x: r.left + r.width / 2, w: r.width };
      });
    }

    function draw() {
      frame = 0;
      tiles.forEach(function (t, i) {
        var c = centers[i];
        if (!c || pointerX === null) return;
        var d = Math.abs(pointerX - c.x) / (c.w * 1.75);
        var f = Math.exp(-d * d);
        var scale = 1 + f * 0.5;
        t.style.transform = "translateY(" + (-5 * f).toFixed(2) + "px) scale(" + scale.toFixed(3) + ")";
      });
    }

    screen.addEventListener("pointermove", function (e) {
      pointerX = e.clientX;
      if (!frame) frame = requestAnimationFrame(draw);
    });

    screen.addEventListener("pointerleave", function () {
      pointerX = null;
      tiles.forEach(function (t) { t.style.transform = ""; });
    });

    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    measure();
  }

  /* ---------- reveal ---------- */

  var targets = document.querySelectorAll(".section__head, .card, .strip, .closer");
  if ("IntersectionObserver" in window && !reduce) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    Array.prototype.forEach.call(targets, function (el, i) {
      el.classList.add("reveal");
      el.style.transitionDelay = Math.min(i % 4, 3) * 45 + "ms";
      io.observe(el);
    });
  }

  /* ---------- cursor glow ---------- */

  var glow = document.querySelector(".glow");
  if (glow && !reduce && window.matchMedia("(pointer: fine)").matches) {
    var g = 0;
    window.addEventListener("pointermove", function (e) {
      if (g) return;
      g = requestAnimationFrame(function () {
        glow.style.setProperty("--mx", e.clientX + "px");
        glow.style.setProperty("--my", e.clientY + "px");
        g = 0;
      });
    });
  }
})();
