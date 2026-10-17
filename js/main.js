/* Portfolio interactions. Replaces the Framer runtime: load/scroll reveals, hover + click
 * variants (replayed from js/interactions.json), nav behaviour, cursor, ticker, menus. */
(function () {
  "use strict";

  var script = document.currentScript;
  var BASE = script ? script.src.replace(/main\.js.*$/, "") : "js/";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var BREAKPOINTS = [
    ["1y5deqo", "(min-width: 1280px)"],
    ["1gqtqv1", "(min-width: 810px) and (max-width: 1279.98px)"],
    ["eh3b30", "(max-width: 809.98px)"],
    ["1gmdhm4", "(max-width: 809.98px)"],
    ["160pjv0", "(min-width: 810px) and (max-width: 1279.98px)"],
    ["egmbj8", "(min-width: 1280px)"],
  ];
  var APPEAR = {};
  var PATCHES = {};

  /* ---------------------------------------------------------------- appear / scroll reveal */
  function activeHashes() {
    return BREAKPOINTS.filter(function (b) { return window.matchMedia(b[1]).matches; }).map(function (b) { return b[0]; });
  }

  function transformOf(s) {
    return (
      (s.xPct ? "translateX(" + s.xPct + "%) " : "") +
      "translateX(" + (s.x || 0) + "px) translateY(" + (s.y || 0) + "px) scale(" + (s.scale == null ? 1 : s.scale) +
      ") rotate(" + (s.rotate || 0) + "deg)"
    );
  }

  function easing(t) {
    if (t && t.ease && t.ease.length === 4) return "cubic-bezier(" + t.ease.join(",") + ")";
    if (t && t.type === "spring") return "cubic-bezier(0.22, 1, 0.36, 1)";
    return "ease-out";
  }

  function play(el, from, to, t, extraDelay) {
    t = t || {};
    var dur = t.type === "spring" ? 0.9 : t.duration == null ? 0.6 : t.duration;
    var delay = (t.delay || 0) + (extraDelay || 0);
    var f = { opacity: from.opacity == null ? 0 : from.opacity, transform: transformOf(from) };
    var e = { opacity: to.opacity == null ? 1 : to.opacity, transform: transformOf(to) };
    if (from.filter) { f.filter = from.filter; e.filter = "blur(0px)"; }
    el.style.transition = "none";
    var anim = el.animate([f, e], { duration: dur * 1000, delay: delay * 1000, easing: easing(t), fill: "both" });
    anim.onfinish = function () {
      el.style.opacity = String(e.opacity);
      el.style.transform = e.transform;
      if (e.filter) el.style.filter = "none";
      try { anim.cancel(); } catch (err) {}
    };
  }

  function pageKey() {
    var p = location.pathname.replace(/\/index\.html$/, "/").replace(/\/$/, "");
    var m = p.match(/(work\/[^/]+|work|template)$/);
    return m ? m[1] + "/index.html" : /404(\.html)?$/.test(p) ? "404.html" : "index.html";
  }

  function runAppear() {
    var conf = APPEAR[pageKey()] || {};
    var hashes = activeHashes();
    document.querySelectorAll("[data-framer-appear-id]").forEach(function (el) {
      var def = conf[el.getAttribute("data-framer-appear-id")];
      if (!def) return;
      var pick = def["default"];
      for (var i = 0; i < hashes.length; i++) if (def[hashes[i]]) { pick = def[hashes[i]]; break; }
      if (!pick) return;
      el.setAttribute("data-appear-done", "1");
      if (reduce) { el.style.opacity = "1"; el.style.transform = "none"; return; }
      play(el, pick.initial, pick.animate, pick.animate && pick.animate.transition);
    });
  }

  var SCALE0 = /scale\(0(\.0+1)?\)/;

  function hiddenOnLoad(el) {
    if (el.hasAttribute("data-appear-done") || el.hasAttribute("data-framer-appear-id")) return false;
    var o = parseFloat(el.style.opacity);
    if (!isNaN(o) && o < 0.01) return true;
    return SCALE0.test(el.style.transform);
  }

  function runScrollReveal() {
    var els = Array.prototype.filter.call(document.querySelectorAll("[style*='opacity'], [style*='scale(0']"), hiddenOnLoad);
    if (reduce) {
      els.forEach(function (el) { el.style.opacity = "1"; el.style.transform = "none"; el.style.filter = "none"; });
      return;
    }
    var counters = new WeakMap();
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        io.unobserve(el);
        var parent = el.parentElement;
        var now = performance.now();
        var c = counters.get(parent);
        if (!c || now - c.t > 500) c = { n: 0, t: now };
        c.t = now;
        var n = c.n++;
        counters.set(parent, c);
        var blur = /blur\(/.test(el.style.filter);
        var y = (el.style.transform.match(/translateY\((-?[\d.]+)px/) || [0, 0])[1];
        var scaled = SCALE0.test(el.style.transform);
        var from = { opacity: 0, y: parseFloat(y) || (scaled ? 28 : 18), scale: scaled ? 0.94 : 1, filter: blur ? el.style.filter : "" };
        var xs = (el.style.transform.match(/translateX\((-?[\d.]+)%/) || [0, 0])[1];
        if (xs) from.xPct = parseFloat(xs);
        var delay = blur ? Math.min(n, 12) * 0.05 : Math.min(n, 5) * 0.08;
        play(el, from, { opacity: 1, y: 0, scale: 1, xPct: from.xPct }, { duration: blur ? 0.8 : 1, ease: [0.16, 1, 0.3, 1] }, delay);
      });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.08 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------------------------------------------------------------- hover / click variants */
  function elAt(root, path) {
    if (!path) return root;
    var parts = path.split("."), e = root;
    for (var i = 0; i < parts.length; i++) {
      e = e && e.children[parseInt(parts[i], 10)];
    }
    return e;
  }

  function mainRoot() { return document.getElementById("main"); }

  function pathTo(el) {
    var main = mainRoot(), p = [], e = el;
    while (e && e !== main) {
      var par = e.parentElement;
      if (!par) return null;
      p.unshift(Array.prototype.indexOf.call(par.children, e));
      e = par;
    }
    return p.join(".");
  }

  function applyState(root, list, on) {
    list.forEach(function (c) {
      var t = elAt(root, c.p);
      if (!t) return;
      if (on) {
        if (t.__orig === undefined) t.__orig = { c: t.getAttribute("class"), s: t.getAttribute("style") };
        if (c.c) t.setAttribute("class", c.c);
        if (c.tr || c.br) {
          t.style.transition = "transform .4s cubic-bezier(.22,1,.36,1), border-radius .4s cubic-bezier(.22,1,.36,1)";
          if (c.tr) t.style.transform = c.tr;
          if (c.br) t.style.borderRadius = c.br;
        }
      } else if (t.__orig !== undefined) {
        if (t.__orig.c === null) t.removeAttribute("class"); else t.setAttribute("class", t.__orig.c);
        if (c.tr || c.br) {
          t.style.transition = "transform .4s cubic-bezier(.22,1,.36,1), border-radius .4s cubic-bezier(.22,1,.36,1)";
          if (t.__orig.s === null) t.removeAttribute("style"); else t.setAttribute("style", t.__orig.s);
          t.style.transition = "transform .4s cubic-bezier(.22,1,.36,1), border-radius .4s cubic-bezier(.22,1,.36,1)";
        }
        t.__orig = undefined;
      }
    });
  }

  function bindVariants() {
    Object.keys(PATCHES).forEach(function (key) {
      var parts = key.split("|"), cls = parts[0], variant = parts[1], tag = parts[2];
      var patch = PATCHES[key];
      var sel = tag.toLowerCase() + "." + cls.replace(/[^\w-]/g, "");
      Array.prototype.forEach.call(document.querySelectorAll(sel), function (el) {
        if (variant && el.className.indexOf(variant) < 0) return;
        if (el.__bound) return;
        el.__bound = true;
        if (patch.hover && patch.hover.length) {
          el.addEventListener("pointerenter", function (e) { if (e.pointerType === "touch") return; applyState(el, patch.hover, true); });
          el.addEventListener("pointerleave", function () { applyState(el, patch.hover, false); });
        }
      });
    });
  }

  /* ---------------------------------------------------------------- hamburger (code navbar) */
  function initSimpleNavbar() {
    document.querySelectorAll("button[aria-label$='menu']").forEach(function (btn) {
      var lines = btn.firstElementChild ? btn.firstElementChild.children : [];
      var panel = btn.parentElement && btn.parentElement.nextElementSibling;
      var open = false;
      btn.addEventListener("click", function () {
        open = !open;
        btn.setAttribute("aria-expanded", String(open));
        btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
        if (lines[0]) { lines[0].style.top = open ? "5px" : "0px"; lines[0].style.transform = open ? "rotate(45deg)" : "rotate(0deg)"; }
        if (lines[1]) { lines[1].style.bottom = open ? "5px" : "0px"; lines[1].style.transform = open ? "rotate(-45deg)" : "rotate(0deg)"; }
        if (panel) { panel.style.maxHeight = open ? "320px" : "0px"; panel.style.opacity = open ? "1" : "0"; }
      });
      if (panel) {
        panel.querySelectorAll("a").forEach(function (a) {
          a.addEventListener("mouseenter", function () { a.style.background = "rgba(0,0,0,0.04)"; });
          a.addEventListener("mouseleave", function () { a.style.background = "transparent"; });
        });
      }
    });
  }

  /* ---------------------------------------------------------------- tech stack ticker */
  function initTicker() {
    document.querySelectorAll(".tech-ticker-row").forEach(function (row) {
      var track = row.firstElementChild;
      var items = track ? track.children.length : 7;
      var duration = Math.max(4, (items * 160) / 30) * 1000;
      var anim = row.animate([{ transform: "translateX(0%)" }, { transform: "translateX(-50%)" }], { duration: duration, iterations: Infinity, easing: "linear" });
      row.addEventListener("mouseenter", function () { anim.pause(); });
      row.addEventListener("mouseleave", function () { anim.play(); });
    });
  }

  /* ---------------------------------------------------------------- project card cursor */
  function initCursor() {
    var cards = Array.prototype.filter.call(document.querySelectorAll("a[href*='work/']"), function (a) {
      return a.querySelector("img") && a.textContent.length > 60;
    });
    if (!cards.length || window.matchMedia("(hover: none)").matches) return;
    var c = document.createElement("div");
    c.setAttribute("aria-hidden", "true");
    c.style.cssText = "position:fixed;top:0;left:0;z-index:13;pointer-events:none;width:200px;height:200px;opacity:0;transform:translate(-50%,-50%) scale(0);transition:opacity .25s ease;will-change:transform";
    c.innerHTML =
      '<div style="position:absolute;left:30px;top:26px;width:139px;height:139px;border-radius:50%;background:rgb(17,17,17)"></div>' +
      '<div style="position:absolute;left:51%;top:46%;transform:translate(-50%,-50%);color:#fff;font:400 16px/1.2 Inter,\'Inter Placeholder\',sans-serif;text-align:center;white-space:pre">View \nProject</div>';
    document.body.appendChild(c);
    var x = 0, y = 0, tx = 0, ty = 0, scale = 0, target = 0, raf = null;
    function tick() {
      x += (tx - x) * 0.25; y += (ty - y) * 0.25; scale += (target - scale) * 0.2;
      c.style.transform = "translate(-50%,-50%) translate(" + x + "px," + y + "px) scale(" + scale + ")";
      if (Math.abs(tx - x) > 0.1 || Math.abs(ty - y) > 0.1 || Math.abs(target - scale) > 0.005) raf = requestAnimationFrame(tick); else raf = null;
    }
    function kick() { if (!raf) raf = requestAnimationFrame(tick); }
    var zones = [], lastX = 0, lastY = 0;
    function hide() {
      target = 0; c.style.opacity = "0"; document.body.classList.remove("framer-cursor-none"); kick();
    }
    document.addEventListener("pointermove", function (e) { lastX = e.clientX; lastY = e.clientY; }, { passive: true });
    // content scrolling under a still pointer fires no pointerleave: re-check on scroll
    window.addEventListener("scroll", function () {
      if (target === 0) return;
      var el = document.elementFromPoint(lastX, lastY);
      if (!zones.some(function (z) { return el && z.contains(el); })) hide();
    }, { passive: true });
    cards.forEach(function (a) {
      var zone = a.querySelector("[data-framer-background-image-wrapper]");
      zone = zone ? zone.parentElement : a;
      zones.push(zone);
      zone.addEventListener("pointerenter", function (e) {
        tx = x = e.clientX; ty = y = e.clientY; target = 1; c.style.opacity = "1";
        document.body.classList.add("framer-cursor-none"); kick();
      });
      zone.addEventListener("pointermove", function (e) { tx = e.clientX; ty = e.clientY; kick(); });
      zone.addEventListener("pointerleave", hide);
    });
  }

  /* ---------------------------------------------------------------- before/after slider */
  function initSliders() {
    document.querySelectorAll("[role='slider'][aria-label*='slider']").forEach(function (box) {
      var kids = box.children; // after img, before wrapper, divider, handle
      var before = kids[1], divider = kids[2], handle = kids[3];
      var half = divider ? parseFloat(divider.style.width) / 2 || 1 : 1;
      var hs = handle ? parseFloat(handle.style.width) / 2 || 22 : 22;
      var pos = parseFloat(box.getAttribute("aria-valuenow")) || 50, dragging = false;
      function set(p) {
        pos = Math.max(0, Math.min(100, p));
        if (before) before.style.clipPath = "inset(0 " + (100 - pos) + "% 0 0)";
        if (divider) { divider.style.left = pos + "%"; divider.style.transform = "translateX(-" + half + "px)"; }
        if (handle) { handle.style.left = pos + "%"; handle.style.transform = "translate(-" + hs + "px, -" + hs + "px)"; }
        box.setAttribute("aria-valuenow", String(Math.round(pos)));
      }
      function fromX(x) { var r = box.getBoundingClientRect(); if (r.width) set(((x - r.left) / r.width) * 100); }
      box.addEventListener("pointerdown", function (e) { e.preventDefault(); dragging = true; try { box.setPointerCapture(e.pointerId); } catch (err) {} fromX(e.clientX); });
      box.addEventListener("pointermove", function (e) { if (dragging) fromX(e.clientX); });
      box.addEventListener("pointerup", function () { dragging = false; });
      box.addEventListener("pointercancel", function () { dragging = false; });
      box.addEventListener("keydown", function (e) {
        var step = e.shiftKey ? 10 : 2;
        if (e.key === "ArrowLeft") { e.preventDefault(); set(pos - step); }
        if (e.key === "ArrowRight") { e.preventDefault(); set(pos + step); }
        if (e.key === "Home") { e.preventDefault(); set(0); }
        if (e.key === "End") { e.preventDefault(); set(100); }
      });
    });
  }

  /* ---------------------------------------------------------------- videos: play while visible */
  function initVideos() {
    var vids = document.querySelectorAll("video");
    if (!vids.length) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var v = en.target;
        if (en.isIntersecting) { v.preload = "auto"; var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        else v.pause();
      });
    }, { threshold: 0.25 });
    vids.forEach(function (v) { v.muted = true; io.observe(v); });
  }

  /* ---------------------------------------------------------------- smooth scrolling */
  function initSmoothScroll() {
    var html = document.documentElement;
    var coarse = window.matchMedia("(pointer: coarse)").matches;
    var target = window.scrollY, cur = target, raf = null;
    var EASE = 0.11;

    function maxScroll() { return Math.max(0, html.scrollHeight - window.innerHeight); }
    function clamp(v) { return Math.max(0, Math.min(maxScroll(), v)); }
    function tick() {
      cur += (target - cur) * EASE;
      if (Math.abs(target - cur) < 0.4) { cur = target; window.scrollTo(0, cur); raf = null; return; }
      window.scrollTo(0, cur);
      raf = requestAnimationFrame(tick);
    }
    function goTo(y) {
      target = clamp(y);
      if (!raf) { cur = window.scrollY; raf = requestAnimationFrame(tick); }
    }

    if (reduce || coarse) {
      html.style.scrollBehavior = reduce ? "auto" : "smooth";
    } else {
      html.style.scrollBehavior = "auto";
      window.addEventListener("wheel", function (e) {
        if (e.ctrlKey || e.metaKey || e.defaultPrevented || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
        for (var el = e.target instanceof Element ? e.target : null; el && el !== document.body && el !== html; el = el.parentElement) {
          var oy = getComputedStyle(el).overflowY;
          if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight) return;
        }
        e.preventDefault();
        var dy = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY;
        if (!raf) target = window.scrollY;
        goTo(target + dy);
      }, { passive: false });
      window.addEventListener("scroll", function () { if (!raf) { target = cur = window.scrollY; } }, { passive: true });
      window.addEventListener("resize", function () { target = clamp(target); });
    }

    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("a[href*='#']");
      if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || a.target === "_blank") return;
      if (a.pathname.replace(/index\.html$/, "") !== location.pathname.replace(/index\.html$/, "") || !a.hash) return;
      var el = document.getElementById(decodeURIComponent(a.hash.slice(1)));
      if (!el) return;
      e.preventDefault();
      history.pushState(null, "", a.hash);
      if (reduce) { window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY); return; }
      if (coarse) { el.scrollIntoView({ behavior: "smooth" }); return; }
      goTo(el.getBoundingClientRect().top + window.scrollY);
    });
  }

  /* ---------------------------------------------------------------- mobile menu (hamburger variant) */
  function initMobileNav() {
    var BG = 'image-rendering:pixelated;flex-shrink:0;background-size:100% 100%;background-image:url("data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 167 223%22 overflow=%22visible%22><path d=%22M 0 29 C 0 12.984 12.984 0 29 0 C 59.566 0 107.432 0 137.999 0 C 154.016 0 167 12.984 167 29.001 C 167 71.756 167 151.244 167 193.998 C 167 210.015 154.015 223 137.998 223 C 107.432 223 59.566 223 29 223 C 12.984 223 0 210.016 0 194 C 0 151.245 0 71.755 0 29 Z%22 fill=%22rgb(255, 255, 255)%22></path></svg>");opacity:1';
    document.querySelectorAll("nav.framer-v-x1awxx").forEach(function (nav) {
      var hb = nav.querySelector(".framer-1yzicnz");
      var tpl = document.querySelector("a.framer-uC1Mt");
      if (!hb || !tpl) return;
      var lines = hb.children, open = false, panel = null;
      var hrefs = {};
      document.querySelectorAll("a.framer-uC1Mt").forEach(function (a) {
        var t = a.textContent.replace(/\s+/g, " ").trim();
        hrefs[t.slice(0, Math.ceil(t.length / 2)).trim()] = a.getAttribute("href");
      });
      var resume = document.querySelector("a[href*='drive.google.com']");
      var items = [
        ["framer-t2tiku-container", "transform:translateY(-50%);opacity:1", "About", hrefs["About"] || "./#about"],
        ["framer-gvhpkr-container", "opacity:1", "All Projects", hrefs["All Projects"] || "./work"],
        ["framer-1sayrwx-container", "opacity:1", "Resume", resume ? resume.getAttribute("href") : "#"],
      ];
      function build() {
        var p = document.createElement("div");
        p.className = "framer-o0sfs2";
        p.style.cssText = "opacity:0;transition:opacity .25s ease";
        var bg = document.createElement("div");
        bg.className = "framer-m682bc";
        bg.setAttribute("style", BG);
        p.appendChild(bg);
        items.forEach(function (it) {
          var c = document.createElement("div");
          c.className = it[0];
          c.setAttribute("style", it[1]);
          var a = tpl.cloneNode(true);
          a.setAttribute("href", it[3]);
          if (/^https?:/.test(it[3])) { a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener"); }
          Array.prototype.forEach.call(a.querySelectorAll("p"), function (pp) { pp.textContent = it[2]; });
          c.appendChild(a);
          p.appendChild(c);
        });
        return p;
      }
      hb.style.cursor = "pointer";
      hb.addEventListener("click", function () {
        open = !open;
        nav.className = open ? nav.className.replace("framer-v-x1awxx", "framer-v-lg2on1") : nav.className.replace("framer-v-lg2on1", "framer-v-x1awxx");
        var t = "transform .3s cubic-bezier(.22,1,.36,1), top .3s ease, bottom .3s ease";
        if (lines[0]) { lines[0].style.transition = t; lines[0].style.top = open ? "19px" : ""; lines[0].style.transform = open ? "rotate(45deg)" : ""; }
        if (lines[1]) { lines[1].style.transition = t; lines[1].style.bottom = open ? "19px" : ""; lines[1].style.transform = open ? "rotate(-45deg)" : ""; }
        if (open) {
          panel = build();
          nav.appendChild(panel);
          requestAnimationFrame(function () { requestAnimationFrame(function () { panel.style.opacity = "1"; }); });
          bindVariants();
        } else if (panel) {
          var gone = panel; panel = null; gone.style.opacity = "0";
          setTimeout(function () { gone.remove(); }, 260);
        }
      });
    });
  }

  /* ---------------------------------------------------------------- image fade-in on load */
  function initImageFade() {
    if (reduce) return;
    var st = document.createElement("style");
    st.textContent = ".reveal-ready img{transition:opacity .7s cubic-bezier(.22,1,.36,1)}.reveal-ready img:not(.is-loaded){opacity:0}";
    document.head.appendChild(st);
    document.documentElement.classList.add("reveal-ready");
    document.querySelectorAll("img").forEach(function (img) {
      if (img.complete && (img.naturalWidth || !img.getAttribute("src"))) { img.classList.add("is-loaded"); return; }
      var done = function () { img.classList.add("is-loaded"); };
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
    });
    // failsafe: never leave an image hidden if a load event is missed
    setTimeout(function () {
      document.querySelectorAll("img:not(.is-loaded)").forEach(function (img) {
        var r = img.getBoundingClientRect();
        if (img.complete || (r.top < window.innerHeight * 1.5 && r.bottom > -window.innerHeight)) img.classList.add("is-loaded");
      });
    }, 6000);
  }

  /* ---------------------------------------------------------------- count-up numbers */
  function initCountUp() {
    var els = document.querySelectorAll(".ab-num[data-count]");
    if (!els.length) return;
    function run(el) {
      var end = parseFloat(el.getAttribute("data-count")) || 0;
      if (reduce) { el.textContent = String(end); return; }
      var t0 = performance.now(), dur = 1300;
      function step(now) {
        var k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        el.textContent = String(Math.round(end * e));
        if (k < 1) requestAnimationFrame(step);
      }
      el.textContent = "0";
      requestAnimationFrame(step);
    }
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (x) { if (x.isIntersecting) { io.unobserve(x.target); run(x.target); } });
    }, { threshold: 0.6 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------------------------------------------------------------- creatives: stacked 3D carousel + lightbox */
  function initCreatives() {
    var stage = document.querySelector("#creatives .cr-stage");
    if (!stage) return;
    var cards = Array.prototype.slice.call(stage.querySelectorAll(".cr-card"));
    var n = cards.length;
    if (!n) return;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var q = function (s) { return document.querySelector("#creatives " + s); };
    var elIdx = q(".cr-idx"), elTot = q(".cr-tot"), elTtl = q(".cr-ttl"), elDsc = q(".cr-dsc");
    var elInfo = q(".cr-info"), elNum = q(".cr-num");
    var segs = Array.prototype.slice.call(document.querySelectorAll("#creatives .cr-s"));
    function pad(v) { return (v < 10 ? "0" : "") + v; }

    /* lightbox */
    var box = document.createElement("div");
    box.id = "cr-lightbox";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.innerHTML = "<img alt=''><p></p>";
    document.body.appendChild(box);
    var big = box.querySelector("img"), cap = box.querySelector("p");
    function closeBox() { box.classList.remove("open"); }
    function openBox(im) {
      big.src = im.currentSrc || im.src;
      big.alt = im.alt || "";
      cap.textContent = im.getAttribute("data-title") || "";
      box.classList.add("open");
    }
    box.addEventListener("click", closeBox);

    /* geometry: a gently curved ring, front card centred, cards keep their own proportions */
    var chh = 0, GAP = 36, RING = 1500, half = Math.floor(n / 2);
    var ratio = cards.map(function (c) {
      var im = c.querySelector("img");
      var w = parseFloat(im.getAttribute("width")) || 4, h = parseFloat(im.getAttribute("height")) || 3;
      return w / h;
    });
    var widths = [], layouts = [];
    function rank(i, c) {
      var k = (((i - c) % n) + n) % n;
      return k > n / 2 ? k - n : k;
    }
    function measure() {
      var sw = stage.clientWidth;
      chh = Math.min(stage.clientHeight * 0.78, sw * 0.7);
      widths = ratio.map(function (r) { return Math.min(chh * r, sw * (sw < 700 ? 0.7 : 0.46)); });
      GAP = sw < 700 ? 22 : 40;
      RING = sw < 700 ? 1100 : 1900;
      cards.forEach(function (el, i) {
        var h = widths[i] / ratio[i];
        el.style.width = widths[i] + "px";
        el.style.height = h + "px";
        el.style.marginLeft = -widths[i] / 2 + "px";
        el.style.marginTop = -h / 2 + "px";
      });
      /* arc position of every card for each possible front card */
      layouts = [];
      for (var c = 0; c < n; c++) {
        var byRank = [];
        for (var i = 0; i < n; i++) byRank.push({ i: i, k: rank(i, c) });
        byRank.sort(function (p, q) { return p.k - q.k; });
        var L = { s: [], op: [], b: [] };
        var zero = 0;
        byRank.forEach(function (e, idx) { if (e.k === 0) zero = idx; });
        L.s[byRank[zero].i] = 0;
        for (var a = zero + 1; a < byRank.length; a++) {
          var prev = byRank[a - 1], cur = byRank[a];
          L.s[cur.i] = L.s[prev.i] + widths[prev.i] / 2 + GAP + widths[cur.i] / 2;
        }
        for (var b = zero - 1; b >= 0; b--) {
          var nxt = byRank[b + 1], cu = byRank[b];
          L.s[cu.i] = L.s[nxt.i] - widths[nxt.i] / 2 - GAP - widths[cu.i] / 2;
        }
        byRank.forEach(function (e) {
          var ak = Math.abs(e.k);
          L.op[e.i] = ak <= 2 ? 1 : ak >= 4 ? 0 : (4 - ak) / 2;
          L.b[e.i] = Math.max(0.8, 1 - ak * 0.07);
        });
        layouts.push(L);
      }
    }

    var pos = 0, target = 0, raf = 0, shown = -1;
    function render() {
      var c0 = Math.round(pos), d = pos - c0, t = Math.abs(d), c1 = c0 + (d >= 0 ? 1 : -1);
      var A = layouts[((c0 % n) + n) % n], B = layouts[((c1 % n) + n) % n];
      for (var i = 0; i < n; i++) {
        var s = A.s[i] + (B.s[i] - A.s[i]) * t;
        var op = A.op[i] + (B.op[i] - A.op[i]) * t;
        var br = A.b[i] + (B.b[i] - A.b[i]) * t;
        var th = s / RING;
        if (th > 1) th = 1; else if (th < -1) th = -1;
        var x = RING * Math.sin(th), z = RING * (1 - Math.cos(th));
        var st = cards[i].style;
        st.transform = "translate3d(" + x + "px,0," + z + "px) rotateY(" + (-th * 57.2958) + "deg)";
        st.zIndex = 1000 - Math.round(Math.abs(s) / 40);
        st.setProperty("--o", op);
        st.filter = br < 0.999 ? "brightness(" + br + ")" : "none";
        st.visibility = op < 0.01 ? "hidden" : "visible";
      }
    }
    function caption() {
      var idx = ((Math.round(target) % n) + n) % n;
      if (idx === shown) return;
      var first = shown === -1;
      shown = idx;
      var im = cards[idx].querySelector("img");
      if (elIdx) elIdx.textContent = pad(idx + 1);
      if (elTot) elTot.textContent = "/ " + pad(n);
      if (elTtl) elTtl.textContent = im.getAttribute("data-title") || "";
      if (elDsc) elDsc.textContent = im.getAttribute("data-desc") || "";
      segs.forEach(function (s, k) { s.classList.toggle("on", k === idx); });
      if (!first && !reduce) {
        [elInfo, elNum].forEach(function (e) { if (!e) return; e.classList.remove("swap"); void e.offsetWidth; e.classList.add("swap"); });
      }
    }
    function tick() {
      var d = target - pos;
      if (reduce || Math.abs(d) < 0.0008) { pos = target; render(); raf = 0; return; }
      pos += d * 0.12;
      render();
      raf = requestAnimationFrame(tick);
    }
    function go(t) {
      target = t;
      caption();
      if (!raf) raf = requestAnimationFrame(tick);
    }
    function step(d) { go(Math.round(target) + d); }
    function goIndex(i) {
      var cur = Math.round(target), off = ((i - cur) % n + n) % n;
      if (off > n / 2) off -= n;
      go(cur + off);
    }

    /* load every illustration shortly before the section scrolls into view */
    if ("IntersectionObserver" in window) {
      var pre = new IntersectionObserver(function (en) {
        if (!en[0].isIntersecting) return;
        cards.forEach(function (c) { c.querySelector("img").loading = "eager"; });
        pre.disconnect();
      }, { rootMargin: "900px 0px" });
      pre.observe(stage);
    }

    measure(); render(); caption();
    window.addEventListener("resize", function () { measure(); render(); });

    /* drag / click */
    var down = null, dragging = false, startTarget = 0, lastX = 0, lastT = 0, vx = 0;
    stage.addEventListener("pointerdown", function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      down = { x: e.clientX, id: e.pointerId, el: e.target };
      dragging = false; startTarget = target; lastX = e.clientX; lastT = performance.now(); vx = 0;
    });
    stage.addEventListener("pointermove", function (e) {
      if (!down) return;
      var dx = e.clientX - down.x;
      if (!dragging && Math.abs(dx) > 6) {
        dragging = true;
        stage.classList.add("drag");
        try { stage.setPointerCapture(down.id); } catch (err) {}
      }
      if (dragging) {
        var now = performance.now();
        vx = (e.clientX - lastX) / Math.max(now - lastT, 1);
        lastX = e.clientX; lastT = now;
        go(startTarget - dx / (chh * 0.8));
      }
    });
    function release() {
      if (!down) return;
      var wasDrag = dragging, el = down.el;
      down = null; dragging = false;
      stage.classList.remove("drag");
      if (wasDrag) { go(Math.round(target - vx * 0.9)); return; }
      var li = el && el.closest ? el.closest(".cr-card") : null;
      if (!li) return;
      var idx = cards.indexOf(li);
      if (idx === ((Math.round(target) % n) + n) % n) openBox(li.querySelector("img"));
      else goIndex(idx);
    }
    stage.addEventListener("pointerup", release);
    stage.addEventListener("pointercancel", function () { down = null; dragging = false; stage.classList.remove("drag"); });

    /* sideways trackpad / wheel only, vertical scroll still moves the page */
    var wheelT = 0, wheelAcc = 0;
    stage.addEventListener("wheel", function (e) {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || Math.abs(e.deltaX) < 2) return;
      e.preventDefault();
      e.stopPropagation();
      wheelAcc += e.deltaX * 0.004;
      go(Math.round(target) + wheelAcc);
      clearTimeout(wheelT);
      wheelT = setTimeout(function () { wheelAcc = 0; go(Math.round(target)); }, 150);
    }, { passive: false });

    /* buttons, segments, keys */
    Array.prototype.forEach.call(document.querySelectorAll("#creatives .cr-btn"), function (b) {
      b.addEventListener("click", function () { step(parseInt(b.getAttribute("data-dir"), 10)); });
    });
    segs.forEach(function (s) { s.addEventListener("click", function () { goIndex(parseInt(s.getAttribute("data-i"), 10)); }); });
    stage.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
      else if (e.key === "Enter") { openBox(cards[((Math.round(target) % n) + n) % n].querySelector("img")); }
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeBox(); });

    /* slow continuous drift while visible and untouched */
    var inView = false, hover = false, lastT2 = 0;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en) { inView = en[0].isIntersecting; }, { threshold: 0.3 }).observe(stage);
    }
    stage.addEventListener("pointerenter", function () { hover = true; });
    stage.addEventListener("pointerleave", function () { hover = false; });
    stage.addEventListener("focusin", function () { hover = true; });
    stage.addEventListener("focusout", function () { hover = false; });
    function drift(ts) {
      var dt = lastT2 ? Math.min(ts - lastT2, 64) : 16;
      lastT2 = ts;
      if (inView && !hover && !down && !box.classList.contains("open") && !document.hidden) {
        target += dt * 0.0002;
        if (!raf) raf = requestAnimationFrame(tick);
      }
      requestAnimationFrame(drift);
    }
    if (!reduce) requestAnimationFrame(drift);
  }

  function init() {
    initImageFade();
    runAppear();
    runScrollReveal();
    bindVariants();
    initSimpleNavbar();
    initMobileNav();
    initTicker();
    initCursor();
    initSliders();
    initVideos();
    initSmoothScroll();
    initCountUp();
    initCreatives();
  }

  function getJSON(name) {
    return fetch(BASE + name).then(function (r) { return r.json(); }).catch(function () { return {}; });
  }

  Promise.all([getJSON("appear.json"), getJSON("interactions.json")]).then(function (r) {
    APPEAR = r[0]; PATCHES = r[1];
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
  });
})();
