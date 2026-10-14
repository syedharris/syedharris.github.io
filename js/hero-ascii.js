/* Experiment: ASCII glyphs revolve around the hero portrait and the image restyles in a loop.
 * Self-contained: add <script src="js/hero-ascii.js" defer></script> to index.html to try it. */
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // loop of looks: image treatment + glyph set
  var STYLES = [
    { name: "photo",    glyphs: "#=+*✦◆→×", img: 1.0, ascii: 0.0, dots: 0.0 },
    { name: "ascii",    glyphs: "#%@&$8",                        img: 0.12, ascii: 1.0, dots: 0.0 },
    { name: "halftone", glyphs: "●○◐◑·", img: 0.08, ascii: 0.0, dots: 1.0 },
    { name: "code",     glyphs: "{}<>/;=01",                     img: 0.16, ascii: 1.0, dots: 0.0, ramp: "01{}<>/;" }
  ];
  var HOLD = 4200, FADE = 1100; // ms per look, ms crossfade

  function findHero() {
    var best = null;
    document.querySelectorAll("img").forEach(function (im) {
      if (!/jYae4EsRY4/.test(im.getAttribute("src") || "")) return;
      var r = im.getBoundingClientRect();
      if (r.width > 100 && r.height > 100) best = im;
    });
    return best;
  }

  function bgUrl(el) {
    return el.currentSrc || el.getAttribute("src");
  }

  function init() {
    var heroEl = findHero();
    if (!heroEl) return;
    var url = bgUrl(heroEl);
    var parent = document.getElementById("hero-section") || heroEl.parentElement.parentElement;
    if (getComputedStyle(parent).position === "static") parent.style.position = "relative";

    var cvs = document.createElement("canvas");
    cvs.setAttribute("aria-hidden", "true");
    cvs.style.cssText = "position:absolute;pointer-events:none;z-index:0";
    parent.appendChild(cvs);
    var ctx = cvs.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    var W = 0, H = 0, cx = 0, cy = 0, ix = 0, iy = 0, iw = 0, ih = 0;
    var cell = 8, grid = null, cols = 0, rows = 0;

    function layout() {
      var pr = parent.getBoundingClientRect(), r = heroEl.getBoundingClientRect();
      iw = r.width; ih = r.height;
      var padX = iw * 0.45, padY = ih * 0.12;
      W = iw + padX * 2; H = ih + padY * 2;
      var left = r.left - pr.left - padX, top = r.top - pr.top - padY;
      cvs.style.left = left + "px"; cvs.style.top = top + "px";
      cvs.style.width = W + "px"; cvs.style.height = H + "px";
      cvs.width = Math.round(W * dpr); cvs.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ix = padX; iy = padY; cx = ix + iw / 2; cy = iy + ih / 2;
      sample();
    }

    // sample the portrait into a coarse luminance/alpha grid
    var img = new Image();
    var ready = false;
    function sample() {
      if (!ready || !iw) return;
      cell = Math.max(6, Math.round(iw / 78));
      cols = Math.max(8, Math.floor(iw / cell));
      rows = Math.max(8, Math.floor(ih / cell));
      var off = document.createElement("canvas");
      off.width = cols; off.height = rows;
      var oc = off.getContext("2d");
      // emulate background-size/position (cover, centre) of the hero block
      var ir = img.width / img.height, br = cols / rows, dw, dh, dx, dy;
      if (ir > br) { dh = rows; dw = rows * ir; } else { dw = cols; dh = cols / ir; }
      dx = (cols - dw) / 2; dy = (rows - dh) / 2;
      oc.drawImage(img, dx, dy, dw, dh);
      try {
        var d = oc.getImageData(0, 0, cols, rows).data;
        grid = new Array(cols * rows);
        for (var i = 0; i < cols * rows; i++) {
          var a = d[i * 4 + 3] / 255;
          var l = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255;
          grid[i] = { a: a, l: l };
        }
      } catch (e) { grid = null; }
    }
    img.onload = function () { ready = true; sample(); };
    if (url) img.src = url;

    // orbiting glyphs
    var N = 38, orbit = [];
    for (var k = 0; k < N; k++) {
      orbit.push({
        th: Math.random() * Math.PI * 2,
        sp: (0.18 + Math.random() * 0.34) * (k % 2 ? 1 : -1) * 0.5,
        rx: 0.42 + Math.random() * 0.3, ry: 0.22 + Math.random() * 0.18,
        tilt: -0.35 + (Math.random() - 0.5) * 0.25,
        sz: 20 + Math.random() * 22, gi: k, ph: Math.random() * 6
      });
    }

    function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

    var t0 = performance.now(), last = t0, running = true;
    function weights(now) {
      var cycle = HOLD + FADE, n = STYLES.length;
      var t = (now - t0) % (cycle * n), idx = Math.floor(t / cycle), within = t - idx * cycle;
      var cur = STYLES[idx], nxt = STYLES[(idx + 1) % n], m = 0;
      if (within > HOLD) m = ease((within - HOLD) / FADE);
      return { cur: cur, nxt: nxt, m: m };
    }
    function mix(a, b, m) { return a + (b - a) * m; }

    function frame(now) {
      if (!running) return;
      var dt = Math.min(50, now - last) / 1000; last = now;
      ctx.clearRect(0, 0, W, H);
      var w = weights(now), c = w.cur, n = w.nxt, m = w.m;

      // image opacity follows the look
      heroEl.style.opacity = String(mix(c.img, n.img, m));

      // ascii + halftone layers drawn from the sampled grid
      if (grid) {
        var asciiA = mix(c.ascii, n.ascii, m), dotsA = mix(c.dots, n.dots, m);
        var ramp = (m > 0.5 ? n : c).ramp || " .:-=+*#%@";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.font = "600 " + Math.round(cell * 1.15) + 'px ui-monospace,"SF Mono",Menlo,Consolas,monospace';
        var wob = Math.sin(now / 900) * 0.5;
        for (var y = 0; y < rows; y++) {
          for (var x = 0; x < cols; x++) {
            var g = grid[y * cols + x];
            if (!g || g.a < 0.45) continue;
            var px = ix + (x + 0.5) * cell, py = iy + (y + 0.5) * cell;
            var dark = 1 - g.l; // darker areas get denser marks
            if (asciiA > 0.01) {
              var ci = Math.min(ramp.length - 1, Math.floor((0.25 + dark * 0.9 + wob * 0.04) * ramp.length));
              if (ci > 0 || ramp.charAt(0) !== " ") {
                ctx.fillStyle = "rgba(255,255,255," + (asciiA * (0.45 + 0.5 * dark)).toFixed(3) + ")";
                ctx.fillText(ramp.charAt(Math.max(0, ci)), px, py);
              }
            }
            if (dotsA > 0.01) {
              var rad = cell * 0.5 * (0.15 + 0.85 * (1 - g.l * 0.8));
              ctx.fillStyle = "rgba(255,255,255," + (dotsA * 0.92).toFixed(3) + ")";
              ctx.beginPath(); ctx.arc(px, py, rad * (0.9 + 0.1 * Math.sin(now / 500 + x * 0.3 + y * 0.2)), 0, 6.283); ctx.fill();
            }
          }
        }
      }

      // revolving glyphs; set swaps with the look
      var set = (m > 0.5 ? n : c).glyphs;
      for (var i = 0; i < orbit.length; i++) {
        var o = orbit[i];
        o.th += o.sp * dt;
        var ex = Math.cos(o.th) * o.rx * iw, ey = Math.sin(o.th) * o.ry * ih;
        var ct = Math.cos(o.tilt), st = Math.sin(o.tilt);
        var X = cx + ex * ct - ey * st, Y = cy + ex * st + ey * ct;
        var z = Math.sin(o.th); // -1 back .. 1 front
        var s = o.sz * (0.7 + 0.3 * (z + 1) / 2);
        var ch = set.charAt((o.gi + Math.floor(now / 1800)) % set.length);
        ctx.font = "700 " + Math.round(s) + 'px ui-monospace,"SF Mono",Menlo,Consolas,monospace';
        ctx.fillStyle = (i % 7 === 0 ? "rgba(246,70,23," : "rgba(255,255,255,") + (0.25 + 0.7 * (z + 1) / 2).toFixed(3) + ")";
        ctx.save(); ctx.translate(X, Y); ctx.rotate(o.th * 0.6 + o.ph); ctx.fillText(ch, 0, 0); ctx.restore();
      }
      requestAnimationFrame(frame);
    }

    layout();
    window.addEventListener("resize", layout);
    document.addEventListener("visibilitychange", function () {
      running = !document.hidden;
      if (running) { last = performance.now(); requestAnimationFrame(frame); }
    });
    if (reduce) { heroEl.style.opacity = "1"; return; }
    requestAnimationFrame(frame);
  }

  if (document.readyState === "complete") setTimeout(init, 300);
  else window.addEventListener("load", function () { setTimeout(init, 600); });
})();
