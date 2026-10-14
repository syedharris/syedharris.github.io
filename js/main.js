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
    cards.forEach(function (a) {
      var zone = a.querySelector("[data-framer-background-image-wrapper]");
      zone = zone ? zone.parentElement : a;
      zone.addEventListener("pointerenter", function (e) {
        tx = x = e.clientX; ty = y = e.clientY; target = 1; c.style.opacity = "1";
        document.body.classList.add("framer-cursor-none"); kick();
      });
      zone.addEventListener("pointermove", function (e) { tx = e.clientX; ty = e.clientY; kick(); });
      zone.addEventListener("pointerleave", function () {
        target = 0; c.style.opacity = "0"; document.body.classList.remove("framer-cursor-none"); kick();
      });
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
