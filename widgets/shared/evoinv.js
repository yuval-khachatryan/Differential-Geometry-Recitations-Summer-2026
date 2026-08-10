/* evoinv.js — the evolute and the involute, traced as a point runs along a curve.

   Two modes, one slider each. The curve is fixed; only the moving point moves.

   mode "evolute"   E(t) = gamma(t) + (1/k(t)) N(t)
       At the moving point the widget draws N, the osculating circle, and its
       centre. The centre is the point of the evolute, so the evolute is drawn
       behind it as the locus those centres sweep out.

   mode "involute"  I(s) = gamma(s) - s T(s)
       The string picture. From the moving point a straight segment runs along
       the tangent, of length equal to the arc already unwound; its free end is
       the point of the involute, and the involute is drawn behind it.

   Everything is computed from the curve itself -- arc length by cumulative
   trapezoid, curvature from divided differences -- so neither trace is a
   hardcoded formula that could drift from the curve it claims to belong to.

   Convention matches the chapter: N is T rotated by +90 degrees, k is the signed
   curvature, so the centre sits at 1/k along N and flips side when k < 0. */
(function (global) {
  "use strict";

  var COL = {
    curve: "#c0392b",      // the curve itself
    trace: "#9333ea",      // the evolute / the involute
    osc:   "#0d9488",      // the osculating circle
    string:"#b45309",      // the taut string, involute mode
    wound: "#b45309",      // the part of the curve already unwound
    T:     "#1f4e79",
    N:     "#16a34a",
    axis:  "#94a3b8",
    grid:  "#eef2f7",
    pt:    "#0f172a"
  };

  function fmt(v, d) {
    if (!isFinite(v)) return "—";
    var s = v.toFixed(d === undefined ? 3 : d);
    return s === "-0.000" || s === "-0.00" ? s.slice(1) : s;
  }

  function mount(cfg) {
    var host = document.getElementById(cfg.mount || "app"),
        f = cfg.f, t0 = cfg.tMin, t1 = cfg.tMax, NS = 1400, h = (t1 - t0) / NS, i,
        evolute = cfg.mode !== "involute";

    var ts = [], eps = (t1 - t0) * 1e-5, eps2 = (t1 - t0) * 1e-3;
    for (i = 0; i <= NS; i++) ts.push(t0 + i * h);
    function d1(t) {
      var a = f(t - eps), b = f(t + eps);
      return [(b[0] - a[0]) / (2 * eps), (b[1] - a[1]) / (2 * eps)];
    }
    function d2(t) {
      var a = f(t - eps2), m = f(t), b = f(t + eps2);
      return [(b[0] - 2 * m[0] + a[0]) / (eps2 * eps2), (b[1] - 2 * m[1] + a[1]) / (eps2 * eps2)];
    }
    function speed(t) { var v = d1(t); return Math.sqrt(v[0] * v[0] + v[1] * v[1]); }
    function frameAt(t) {
      var v = d1(t), sp = Math.sqrt(v[0] * v[0] + v[1] * v[1]), Tv = [v[0] / sp, v[1] / sp];
      return { T: Tv, N: [-Tv[1], Tv[0]] };
    }
    function curv(t) {
      var a = d1(t), b = d2(t), sp = Math.sqrt(a[0] * a[0] + a[1] * a[1]);
      return (a[0] * b[1] - a[1] * b[0]) / Math.pow(sp, 3);
    }

    var S = [0];
    for (i = 1; i <= NS; i++) S.push(S[i - 1] + (speed(ts[i - 1]) + speed(ts[i])) / 2 * h);
    function arcRaw(t) {
      var u = (t - t0) / h, j = Math.max(0, Math.min(NS - 1, Math.floor(u)));
      return S[j] + (S[j + 1] - S[j]) * (u - j);
    }
    /* Arc length is measured from cfg.sFrom, not from the left end of the range.
       That lets the involute be built from a point in the MIDDLE of the curve, so
       both branches appear and the cusp between them is on screen. */
    var sOrigin = cfg.sFrom === undefined ? t0 : cfg.sFrom,
        sBase = arcRaw(sOrigin),
        jOrigin = Math.max(0, Math.min(NS, Math.round((sOrigin - t0) / h)));
    function arcAt(t) { return arcRaw(t) - sBase; }

    /* The point of the trace belonging to the parameter t.
       lam is the initial length of string already hanging free at t = tMin;
       lam = 0 is the classical involute that starts on the curve itself. */
    var lam0Max = cfg.lam0Max || 0, lam0 = 0;
    function target(t, lam) {
      var fr = frameAt(t), p = f(t);
      if (evolute) {
        var k = curv(t);
        if (!isFinite(k) || Math.abs(k) < 1e-9) return null;
        return [p[0] + fr.N[0] / k, p[1] + fr.N[1] / k];
      }
      var s = arcAt(t) + lam;
      return [p[0] - s * fr.T[0], p[1] - s * fr.T[1]];
    }

    var P = [], TR = [];
    for (i = 0; i <= NS; i++) P.push(f(ts[i]));
    function rebuild() {
      TR = [];
      for (var j = 0; j <= NS; j++) TR.push(target(ts[j], lam0));
    }
    rebuild();

    /* Frame the view on the LARGEST trace, so that moving the initial-length
       slider does not make the picture jump about. */
    var xs = [], ys = [];
    P.forEach(function (p) { xs.push(p[0]); ys.push(p[1]); });
    for (i = 0; i <= NS; i += 4) {
      var w0 = target(ts[i], lam0Max);
      if (w0) { xs.push(w0[0]); ys.push(w0[1]); }
    }
    var xa = Math.min.apply(null, xs), xb = Math.max.apply(null, xs),
        ya = Math.min.apply(null, ys), yb = Math.max.apply(null, ys),
        cx = (xa + xb) / 2, cy = (ya + yb) / 2,
        half = Math.max(xb - xa, yb - ya) / 2 * 1.15 || 1;

    var traceLabel = evolute ? "האוולוט" : "האינוולוטה";
    host.innerHTML =
      '<div class="qv">' +
        '<p class="qv-title" dir="ltr">' + (cfg.title || "") + '</p>' +
        '<div class="qv-canvas-wrap"><canvas class="qv-canvas"></canvas></div>' +
        '<div class="qv-row">' +
          '<span class="qv-label">' + (cfg.paramLabel || "הפרמטר") + '</span>' +
          '<input class="qv-slider qv-t" type="range" min="0" max="1000" value="260">' +
          '<span class="qv-badge qv-tval"></span>' +
          '<button class="qv-btn qv-play" type="button">הפעל</button>' +
        '</div>' +
        (lam0Max > 0 ?
        '<div class="qv-row">' +
          '<span class="qv-label">אורך התחלתי</span>' +
          '<input class="qv-slider qv-l" type="range" min="0" max="1000" value="0">' +
          '<span class="qv-badge qv-lval"></span>' +
        '</div>' : "") +
        '<div class="qv-dirs">' +
          (evolute ? '<span><b>k</b>&nbsp;<span dir="ltr" class="qv-r-k"></span></span>' +
                     '<span><b>E</b>&nbsp;<span dir="ltr" class="qv-r-tg"></span></span>'
                   : '<span><b>s</b>&nbsp;<span dir="ltr" class="qv-r-s"></span></span>' +
                     '<span><b>I</b>&nbsp;<span dir="ltr" class="qv-r-tg"></span></span>') +
        '</div>' +
        '<div class="qv-hint">' + (cfg.hint || "") + '</div>' +
      '</div>';

    var cv = host.querySelector("canvas"), ctx = cv.getContext("2d"),
        sT = host.querySelector(".qv-t"), tval = host.querySelector(".qv-tval"),
        sL = host.querySelector(".qv-l"), lval = host.querySelector(".qv-lval"),
        play = host.querySelector(".qv-play"), timer = null;

    function set(key, txt) {
      var el = host.querySelector(".qv-r-" + key);
      if (el) el.textContent = txt;
    }

    function draw() {
      var frac = sT.value / 1000, t = t0 + frac * (t1 - t0),
          jt = Math.max(0, Math.min(NS, Math.round((t - t0) / h))),
          p = f(t), fr = frameAt(t), tg = target(t, lam0), k = curv(t), s = arcAt(t) + lam0;

      var dpr = global.devicePixelRatio || 1,
          w = cv.clientWidth || 520, hgt = Math.round(w * (cfg.aspect || 0.74));
      cv.width = Math.round(w * dpr); cv.height = Math.round(hgt * dpr);
      cv.style.height = hgt + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, hgt);
      ctx.direction = "ltr";
      ctx.lineJoin = "round";

      /* equal x/y scaling: N is on screen, so angles must be honest */
      var sc = Math.min((w - 20) / (2 * half), (hgt - 20) / (2 * half)),
          ox = w / 2 - cx * sc, oy = hgt / 2 + cy * sc;
      function X(q) { return ox + q[0] * sc; }
      function Y(q) { return oy - q[1] * sc; }

      var xVis = (w / 2) / sc, yVis = (hgt / 2) / sc,
          step = Math.pow(10, Math.round(Math.log(half / 2) / Math.LN10));
      if (Math.max(xVis, yVis) / step > 9) step *= 2;
      ctx.strokeStyle = COL.grid; ctx.lineWidth = 1;
      for (var g = Math.ceil((cx - xVis) / step) * step; g <= cx + xVis; g += step) {
        ctx.beginPath(); ctx.moveTo(X([g, 0]), 0); ctx.lineTo(X([g, 0]), hgt); ctx.stroke();
      }
      for (var g2 = Math.ceil((cy - yVis) / step) * step; g2 <= cy + yVis; g2 += step) {
        ctx.beginPath(); ctx.moveTo(0, Y([0, g2])); ctx.lineTo(w, Y([0, g2])); ctx.stroke();
      }
      ctx.strokeStyle = COL.axis; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(0, Y([0, 0])); ctx.lineTo(w, Y([0, 0])); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(X([0, 0]), 0); ctx.lineTo(X([0, 0]), hgt); ctx.stroke();

      function poly(pts, from, to, col, lw, dash) {
        ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.setLineDash(dash || []);
        ctx.beginPath();
        var started = false;
        for (var j = from; j <= to; j++) {
          var q = pts[j];
          if (!q) { started = false; continue; }
          if (!started) { ctx.moveTo(X(q), Y(q)); started = true; } else ctx.lineTo(X(q), Y(q));
        }
        ctx.stroke(); ctx.setLineDash([]);
      }
      function seg(a, b, col, lw, dash) {
        ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.setLineDash(dash || []);
        ctx.beginPath(); ctx.moveTo(X(a), Y(a)); ctx.lineTo(X(b), Y(b)); ctx.stroke();
        ctx.setLineDash([]);
      }

      /* the whole curve */
      poly(P, 0, NS, COL.curve, 2.4);

      /* in involute mode, the stretch already unwound: between the point where
         the string is anchored and the current point, on whichever side */
      if (!evolute) poly(P, Math.min(jOrigin, jt), Math.max(jOrigin, jt), COL.wound, 3.2);

      /* the trace, drawn only as far as the moving point has got */
      if (jt > 0) poly(TR, 0, jt, COL.trace, 2.4);

      if (evolute) {
        /* the osculating circle at the moving point, and its centre */
        if (tg && Math.abs(1 / k) < half * 8) {
          ctx.strokeStyle = COL.osc; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
          ctx.beginPath(); ctx.arc(X(tg), Y(tg), Math.abs(1 / k) * sc, 0, 2 * Math.PI); ctx.stroke();
          ctx.setLineDash([]);
          seg(p, tg, COL.osc, 1.6, [6, 4]);
        }
      } else {
        /* the taut string: from the point, along the tangent, of length s */
        if (tg) seg(p, tg, COL.string, 2.2);
      }

      /* T and N at the moving point, at their true length 1 */
      function arrow(dir, col, lab) {
        var tip = [p[0] + dir[0], p[1] + dir[1]];
        ctx.strokeStyle = col; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(X(p), Y(p)); ctx.lineTo(X(tip), Y(tip)); ctx.stroke();
        var ang = Math.atan2(-(Y(tip) - Y(p)), X(tip) - X(p));
        ctx.fillStyle = col; ctx.beginPath();
        ctx.moveTo(X(tip), Y(tip));
        ctx.lineTo(X(tip) - 8 * Math.cos(ang - 0.4), Y(tip) + 8 * Math.sin(ang - 0.4));
        ctx.lineTo(X(tip) - 8 * Math.cos(ang + 0.4), Y(tip) + 8 * Math.sin(ang + 0.4));
        ctx.closePath(); ctx.fill();
        ctx.font = "bold 12px Arial, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(lab, X(tip) + 11 * Math.cos(ang), Y(tip) - 11 * Math.sin(ang));
      }
      if (evolute) arrow(fr.N, COL.N, "N"); else arrow(fr.T, COL.T, "T");

      /* the moving point, and the point of the trace it produces */
      ctx.font = "11px Arial, sans-serif";
      ctx.textAlign = "left"; ctx.textBaseline = "middle";
      if (tg) {
        ctx.fillStyle = COL.trace;
        ctx.beginPath(); ctx.arc(X(tg), Y(tg), 5, 0, 2 * Math.PI); ctx.fill();
        ctx.fillText(evolute ? "E" : "I", X(tg) + 9, Y(tg) - 8);
      }
      ctx.fillStyle = COL.pt;
      ctx.beginPath(); ctx.arc(X(p), Y(p), 5, 0, 2 * Math.PI); ctx.fill();
      ctx.fillStyle = "#475569";
      ctx.fillText("γ", X(p) + 9, Y(p) + 10);

      tval.textContent = fmt(t, 2);
      if (lval) lval.textContent = "\u03bb\u2080 = " + fmt(lam0, 2);
      if (evolute) set("k", "= " + fmt(k)); else set("s", "= " + fmt(s));
      set("tg", tg ? "= (" + fmt(tg[0]) + ", " + fmt(tg[1]) + ")" : "= —");
      report();
    }

    var lastH = 0;
    function report() {
      var hh = Math.ceil(document.documentElement.scrollHeight);
      if (hh !== lastH && global.parent) {
        lastH = hh;
        global.parent.postMessage({ type: "widget-height", height: hh }, "*");
      }
    }

    function stop() { if (timer) { clearInterval(timer); timer = null; play.textContent = "הפעל"; } }
    sT.addEventListener("input", function () { stop(); draw(); });
    if (sL) sL.addEventListener("input", function () {
      lam0 = sL.value / 1000 * lam0Max; rebuild(); draw();
    });
    play.addEventListener("click", function () {
      if (timer) { stop(); return; }
      play.textContent = "עצור";
      if (+sT.value >= 1000) sT.value = 0;
      timer = setInterval(function () {
        var v = +sT.value + 4;
        if (v >= 1000) { v = 1000; stop(); }
        sT.value = v; draw();
      }, 16);
    });
    global.addEventListener("resize", draw);
    draw();
  }

  global.EvoInv = { mount: mount };
})(this);
