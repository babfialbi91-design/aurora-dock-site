(function () {
  "use strict";

  var ASSET = "aurora-dock.slu";
  var DOWNLOAD = "/download/" + ASSET;
  var RELEASE_API = "/api/latest";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- latest version ---------- */

  var pill = document.getElementById("version");

  function setVersion(text, live) {
    if (!pill) return;
    pill.textContent = text;
    if (live) pill.classList.add("is-live");
  }

  function cachedVersion() {
    try {
      var raw = localStorage.getItem("aurora-version");
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data.v || Date.now() - data.t > 3600e3) return null;
      return data.v;
    } catch (e) {
      return null;
    }
  }

  var cached = cachedVersion();
  if (cached) setVersion(cached, true);

  if ("fetch" in window) {
    var ctrl = "AbortController" in window ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 4000);

    fetch(RELEASE_API, {
      headers: { Accept: "application/json" },
      signal: ctrl ? ctrl.signal : undefined
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        clearTimeout(timer);
        if (!data || !data.tag) return;
        setVersion(data.tag, true);
        try {
          localStorage.setItem("aurora-version", JSON.stringify({ v: data.tag, t: Date.now() }));
        } catch (e) {}
      })
      .catch(function () { clearTimeout(timer); });
  }

  /* ---------- download ---------- */

  var toast = document.getElementById("toast");
  var toastTimer = 0;

  function showToast() {
    if (!toast) return;
    toast.classList.add("is-open");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("is-open"); }, 9000);
  }

  if (toast) {
    var x = toast.querySelector(".toast__x");
    if (x) x.addEventListener("click", function () { toast.classList.remove("is-open"); });
  }

  function download(button) {
    if (button.getAttribute("aria-busy") === "true") return;

    var label = button.querySelector(".btn__label");
    var original = label ? label.textContent : "";
    if (label) label.textContent = "جارٍ التنزيل…";
    button.setAttribute("aria-busy", "true");

    var a = document.createElement("a");
    a.href = DOWNLOAD;
    a.download = ASSET;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(function () {
      if (label) label.textContent = original;
      button.removeAttribute("aria-busy");
      showToast();
    }, 1400);
  }

  ["download", "download2"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener("click", function () { download(el); });
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
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width };
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
