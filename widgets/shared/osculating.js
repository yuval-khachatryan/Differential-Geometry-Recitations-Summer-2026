/* osculating.js — the idea of the osculating-circle proof, made interactive.

   The curve, the base point, T and N and the tangent line are all FIXED. One
   thing moves: the spacing d. For that spacing the widget draws

     - the two points gamma(t0 +- d),
     - from each of them the perpendicular to T (i.e. the line parallel to N)
       down to the tangent line, dotted,
     - the circle through those two points and the base point,
     - the segment from the base point to that circle's centre: the radius.

   Shrink d and the circle becomes the osculating circle; the radius segment
   straightens onto N and its length tends to 1/|k|.

   Everything is drawn in the (T, N) frame of the base point, so that T is
   horizontal and the picture is symmetric about the base point. In that frame the
   tangent line IS the x-axis, and the deviation of a nearby point from it is just
   that point's y-coordinate.

   Nothing is hardcoded: the two outer points are real points of the curve and the
   circle is the honest circumcircle, so the picture cannot quietly stop agreeing
   with the statement it illustrates.

   Sign convention matches the chapter: N is T rotated by +90 degrees and k is the
   signed curvature, so the centre sits at 1/k along N -- below the tangent line
   when k < 0 -- while the radius is 1/|k|. */
(function (global) {
  "use strict";

  var COL = {
    curve:  "#c0392b",     // the curve itself, the main object on screen
    near:   "#0f172a",     // the two points at +-d
    tangent:"#334155",     // the tangent line: the x-axis of this frame
    T:      "#1f4e79",
    N:      "#16a34a",
    perp:   "#64748b",     // the perpendiculars to T: construction lines
    circ:   "#0d9488",     // the circle: teal, so it cannot be read as the curve
    radius: "#9333ea",     // base point -> centre
    axis:   "#94a3b8",
    grid:   "#eef2f7",
    pt:     "#0f172a"
  };

  function fmt(v, d) {
    if (!isFinite(v)) return "—";
    var s = v.toFixed(d === undefined ? 3 : d);
    return s === "-0.000" || s === "-0.00" ? s.slice(1) : s;
  }

  /* Circle through three points, or null when they are (nearly) collinear —
     which is exactly the k = 0 case the definition excludes. */
  function circum(A, B, C) {
    var d = 2 * (A[0] * (B[1] - C[1]) + B[0] * (C[1] - A[1]) + C[0] * (A[1] - B[1]));
    if (Math.abs(d) < 1e-12) return null;
    var a2 = A[0] * A[0] + A[1] * A[1],
        b2 = B[0] * B[0] + B[1] * B[1],
        c2 = C[0] * C[0] + C[1] * C[1],
        ux = (a2 * (B[1] - C[1]) + b2 * (C[1] - A[1]) + c2 * (A[1] - B[1])) / d,
        uy = (a2 * (C[0] - B[0]) + b2 * (A[0] - C[0]) + c2 * (B[0] - A[0])) / d;
    return { c: [ux, uy], r: Math.sqrt((ux - A[0]) * (ux - A[0]) + (uy - A[1]) * (uy - A[1])) };
  }

  function mount(cfg) {
    var host = document.getElementById(cfg.mount || "app"),
        f = cfg.f, t0 = cfg.tMin, t1 = cfg.tMax, NS = 1200, h = (t1 - t0) / NS, i;

    /* ---- sample once: the curve never changes ---- */
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
    var S = [0];
    for (i = 1; i <= NS; i++) S.push(S[i - 1] + (speed(ts[i - 1]) + speed(ts[i])) / 2 * h);
    function arcAt(t) {
      var u = (t - t0) / h, j = Math.max(0, Math.min(NS - 1, Math.floor(u)));
      return S[j] + (S[j + 1] - S[j]) * (u - j);
    }
    function tAt(s) {
      if (s <= 0) return t0;
      if (s >= S[NS]) return t1;
      var lo = 0, hi = NS, mid;
      while (hi - lo > 1) { mid = (lo + hi) >> 1; if (S[mid] <= s) lo = mid; else hi = mid; }
      var seg = S[lo + 1] - S[lo];
      return ts[lo] + (seg > 0 ? (s - S[lo]) / seg * h : 0);
    }

    /* ---- the frozen data: base point, its frame, its curvature ---- */
    var tB = cfg.t0,
        Pb = f(tB),
        v0 = d1(tB), sp0 = Math.sqrt(v0[0] * v0[0] + v0[1] * v0[1]),
        Tv = [v0[0] / sp0, v0[1] / sp0], Nv = [-Tv[1], Tv[0]],
        a1 = d1(tB), a2 = d2(tB),
        kB = (a1[0] * a2[1] - a1[1] * a2[0]) / Math.pow(sp0, 3),
        rLim = 1 / Math.abs(kB),
        sB = arcAt(tB),
        dMax = Math.min(cfg.dMax || Infinity, sB, S[NS] - sB) * 0.98,
        dMin = dMax * 0.01;

    /* world point -> (T, N) coordinates of the base point */
    function q(p) {
      var ux = p[0] - Pb[0], uy = p[1] - Pb[1];
      return [ux * Tv[0] + uy * Tv[1], ux * Nv[0] + uy * Nv[1]];
    }
    var QC = [];
    for (i = 0; i <= NS; i++) QC.push(q(f(ts[i])));

    host.innerHTML =
      '<div class="qv">' +
        '<p class="qv-title" dir="ltr">' + (cfg.title || "") + '</p>' +
        '<div class="qv-canvas-wrap"><canvas class="qv-canvas"></canvas></div>' +
        '<div class="qv-row">' +
          '<span class="qv-label">המרווח</span>' +
          '<input class="qv-slider qv-d" type="range" min="0" max="1000" value="1000">' +
          '<span class="qv-badge qv-dval"></span>' +
          '<button class="qv-btn qv-play" type="button">הקטן את המרווח</button>' +
        '</div>' +
        '<div class="qv-dirs">' +
          '<span><b>R</b>&nbsp;<span dir="ltr" class="qv-r-R"></span></span>' +
          '<span><b>1/|k|</b>&nbsp;<span dir="ltr" class="qv-r-lim"></span></span>' +
        '</div>' +
        '<div class="qv-hint">' + (cfg.hint ||
          "העקומה, הנקודה, הישר המשיק והוקטורים T ו-N קבועים; רק המרווח משתנה.") +
        '</div>' +
      '</div>';

    var cv = host.querySelector("canvas"), ctx = cv.getContext("2d"),
        sD = host.querySelector(".qv-d"), dval = host.querySelector(".qv-dval"),
        play = host.querySelector(".qv-play"), timer = null;

    function set(key, txt) {
      var el = host.querySelector(".qv-r-" + key);
      if (el) el.textContent = txt;
    }

    /* The view is fixed too, framed on the limit circle, so that the moving
       circle is seen to settle instead of the frame chasing it. */
    var cx = 0, cy = (kB > 0 ? 1 : -1) * rLim / 2, half = rLim * 1.3;

    function draw() {
      var frac = sD.value / 1000,
          /* quadratic, so the interesting small spacings get half the travel */
          del = dMin + (dMax - dMin) * frac * frac,
          zm = q(f(tAt(sB - del))), zp = q(f(tAt(sB + del))), z0 = [0, 0],
          three = circum(zm, z0, zp);

      var dpr = global.devicePixelRatio || 1,
          w = cv.clientWidth || 520, hgt = Math.round(w * (cfg.aspect || 0.72));
      cv.width = Math.round(w * dpr); cv.height = Math.round(hgt * dpr);
      cv.style.height = hgt + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, hgt);
      ctx.direction = "ltr";
      ctx.lineJoin = "round";

      /* equal x/y scaling, or N would stop looking perpendicular to T */
      var sc = Math.min((w - 20) / (2 * half), (hgt - 20) / (2 * half)),
          ox = w / 2 - cx * sc, oy = hgt / 2 + cy * sc;
      function X(p) { return ox + p[0] * sc; }
      function Y(p) { return oy - p[1] * sc; }

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
      ctx.strokeStyle = COL.axis; ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(X([0, 0]), 0); ctx.lineTo(X([0, 0]), hgt); ctx.stroke();
      /* the tangent line, drawn rather than left to the grid */
      ctx.strokeStyle = COL.tangent; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, Y([0, 0])); ctx.lineTo(w, Y([0, 0])); ctx.stroke();

      function poly(pts, col, lw, dash) {
        ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.setLineDash(dash || []);
        ctx.beginPath();
        for (var j = 0; j < pts.length; j++) {
          if (j === 0) ctx.moveTo(X(pts[j]), Y(pts[j])); else ctx.lineTo(X(pts[j]), Y(pts[j]));
        }
        ctx.stroke(); ctx.setLineDash([]);
      }
      function seg(a, b, col, lw, dash) {
        ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.setLineDash(dash || []);
        ctx.beginPath(); ctx.moveTo(X(a), Y(a)); ctx.lineTo(X(b), Y(b)); ctx.stroke();
        ctx.setLineDash([]);
      }

      /* the curve, drawn as the main object it is */
      poly(QC, COL.curve, 2.6);

      /* the circle through the three points */
      if (three && isFinite(three.r) && three.r * sc < 1e5) {
        ctx.strokeStyle = COL.circ; ctx.lineWidth = 1.9;
        ctx.beginPath(); ctx.arc(X(three.c), Y(three.c), three.r * sc, 0, 2 * Math.PI); ctx.stroke();
      }

      /* from each outer point, the perpendicular to T (the line parallel to N) */
      seg(zp, [zp[0], 0], COL.perp, 1.8, [4, 3]);
      seg(zm, [zm[0], 0], COL.perp, 1.8, [4, 3]);

      /* the radius: base point -> centre of that circle */
      if (three) {
        seg(z0, three.c, COL.radius, 2, [7, 4]);
        ctx.fillStyle = COL.radius;
        ctx.beginPath(); ctx.arc(X(three.c), Y(three.c), 4.5, 0, 2 * Math.PI); ctx.fill();
        ctx.font = "bold 12px Arial, sans-serif";
        ctx.textAlign = "left"; ctx.textBaseline = "middle";
        ctx.fillText("R", (X(z0) + X(three.c)) / 2 + 8, (Y(z0) + Y(three.c)) / 2);
      }

      /* T and N: fixed, and here they are the axes */
      function arrow(dir, len, col, lab, lx, ly) {
        var tip = [dir[0] * len, dir[1] * len];
        ctx.strokeStyle = col; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(X([0, 0]), Y([0, 0])); ctx.lineTo(X(tip), Y(tip)); ctx.stroke();
        var ang = Math.atan2(-(Y(tip) - Y([0, 0])), X(tip) - X([0, 0]));
        ctx.fillStyle = col; ctx.beginPath();
        ctx.moveTo(X(tip), Y(tip));
        ctx.lineTo(X(tip) - 8 * Math.cos(ang - 0.4), Y(tip) + 8 * Math.sin(ang - 0.4));
        ctx.lineTo(X(tip) - 8 * Math.cos(ang + 0.4), Y(tip) + 8 * Math.sin(ang + 0.4));
        ctx.closePath(); ctx.fill();
        ctx.font = "bold 12px Arial, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(lab, X(tip) + lx, Y(tip) + ly);
      }
      /* drawn at their true length 1, not scaled to the view */
      arrow([1, 0], 1, COL.T, "T", 6, kB > 0 ? 13 : -13);
      arrow([0, 1], 1, COL.N, "N", -13, 0);

      /* the two outer points, labelled */
      ctx.font = "11px Arial, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      [[zm, "-d"], [zp, "+d"]].forEach(function (pair) {
        ctx.fillStyle = COL.near;
        ctx.beginPath(); ctx.arc(X(pair[0]), Y(pair[0]), 4.5, 0, 2 * Math.PI); ctx.fill();
        ctx.fillStyle = "#475569";
        ctx.fillText(pair[1], X(pair[0]) + (pair[1][0] === "-" ? -15 : 15), Y(pair[0]));
      });
      ctx.fillStyle = COL.pt;
      ctx.beginPath(); ctx.arc(X(z0), Y(z0), 5.5, 0, 2 * Math.PI); ctx.fill();

      dval.textContent = "d = " + fmt(del, 3);
      set("R", three ? "= " + fmt(three.r) : "= —");
      set("lim", "= " + fmt(rLim));
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

    function stop() { if (timer) { clearInterval(timer); timer = null; play.textContent = "הקטן את המרווח"; } }
    sD.addEventListener("input", function () { stop(); draw(); });
    play.addEventListener("click", function () {
      if (timer) { stop(); return; }
      play.textContent = "עצור";
      if (+sD.value <= 0) sD.value = 1000;
      timer = setInterval(function () {
        var v = +sD.value - 4;
        if (v <= 0) { v = 0; stop(); }
        sD.value = v; draw();
      }, 16);
    });
    global.addEventListener("resize", draw);
    draw();
  }

  global.Osculating = { mount: mount };
})(this);
