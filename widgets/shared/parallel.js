/* parallel.js — the parallel curve gamma_lambda = gamma + lambda N.

   The curve is fixed. One slider moves lambda, the constant distance measured
   along the normal. Drawn alongside are a few of the normal segments that join
   gamma(t) to gamma_lambda(t), so that "constant distance along N" is visible
   rather than asserted.

   The slider range is deliberately kept below the threshold at which
   1 - lambda*k first vanishes, so gamma_lambda is regular throughout and the
   widget never has to discuss the degenerate case. The readout still reports
   min|1 - lambda*k|, which is the quantity the exercise's hypothesis is about,
   and it stays comfortably away from zero.

   Convention matches the chapter: N is T rotated by +90 degrees and k is the
   signed curvature, so positive lambda moves towards the concave side. */
(function (global) {
  "use strict";

  var COL = {
    curve: "#c0392b",      // gamma
    par:   "#9333ea",      // gamma_lambda
    join:  "#64748b",      // the normal segments
    N:     "#16a34a",
    axis:  "#94a3b8",
    grid:  "#eef2f7",
    axisLbl: "#475569"
  };

  function fmt(v, d) {
    if (!isFinite(v)) return "—";
    var s = v.toFixed(d === undefined ? 3 : d);
    return s === "-0.000" || s === "-0.00" ? s.slice(1) : s;
  }

  function mount(cfg) {
    var host = document.getElementById(cfg.mount || "app"),
        f = cfg.f, t0 = cfg.tMin, t1 = cfg.tMax, NS = 1000, h = (t1 - t0) / NS, i,
        lamMin = cfg.lamMin, lamMax = cfg.lamMax;

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

    /* sample gamma, N and k once: none of them depends on lambda */
    var P = [], NV = [], K = [];
    for (i = 0; i <= NS; i++) {
      var t = ts[i], a = d1(t), b = d2(t), sp = Math.sqrt(a[0] * a[0] + a[1] * a[1]);
      P.push(f(t));
      NV.push([-a[1] / sp, a[0] / sp]);
      K.push((a[0] * b[1] - a[1] * b[0]) / Math.pow(sp, 3));
    }
    function parallelAt(i, lam) {
      return [P[i][0] + lam * NV[i][0], P[i][1] + lam * NV[i][1]];
    }

    /* Frame the view on the two extreme values of lambda, so the picture does
       not jump about while the slider moves. */
    var xs = [], ys = [];
    for (i = 0; i <= NS; i += 2) {
      [lamMin, lamMax, 0].forEach(function (L) {
        var q = parallelAt(i, L); xs.push(q[0]); ys.push(q[1]);
      });
    }
    var xa = Math.min.apply(null, xs), xb = Math.max.apply(null, xs),
        ya = Math.min.apply(null, ys), yb = Math.max.apply(null, ys),
        cx = (xa + xb) / 2, cy = (ya + yb) / 2,
        half = Math.max(xb - xa, yb - ya) / 2 * 1.12 || 1;

    host.innerHTML =
      '<div class="qv">' +
        '<p class="qv-title" dir="ltr">' + (cfg.title || "") + '</p>' +
        '<div class="qv-canvas-wrap"><canvas class="qv-canvas"></canvas></div>' +
        '<div class="qv-row">' +
          '<span class="qv-label">המרחק</span>' +
          '<input class="qv-slider qv-lam" type="range" min="0" max="1000" value="' +
            Math.round((0.25 - lamMin) / (lamMax - lamMin) * 1000) + '">' +
          '<span class="qv-badge qv-lamval"></span>' +
        '</div>' +
        '<div class="qv-dirs">' +
          '<span><b>min |1 - &#955;k|</b>&nbsp;<span dir="ltr" class="qv-r-sig"></span></span>' +
        '</div>' +
        '<div class="qv-hint">' + (cfg.hint || "") + '</div>' +
      '</div>';

    var cv = host.querySelector("canvas"), ctx = cv.getContext("2d"),
        sL = host.querySelector(".qv-lam"), lamval = host.querySelector(".qv-lamval"),
        rsig = host.querySelector(".qv-r-sig");

    function draw() {
      var lam = lamMin + (sL.value / 1000) * (lamMax - lamMin);

      /* the quantity the exercise's hypothesis is about; the slider range keeps
         it away from zero, so there is no degenerate case to report */
      var sigMin = Infinity;
      for (var j = 0; j <= NS; j++) sigMin = Math.min(sigMin, Math.abs(1 - lam * K[j]));

      var dpr = global.devicePixelRatio || 1,
          w = cv.clientWidth || 520, hgt = Math.round(w * (cfg.aspect || 0.7));
      cv.width = Math.round(w * dpr); cv.height = Math.round(hgt * dpr);
      cv.style.height = hgt + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, hgt);
      ctx.direction = "ltr";
      ctx.lineJoin = "round";

      /* equal x/y scaling, or the constant distance would not look constant */
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

      /* the normal segments, first, so the curves sit on top of them */
      ctx.strokeStyle = COL.join; ctx.lineWidth = 1.2; ctx.setLineDash([3, 3]);
      for (var m = 0; m < 16; m++) {
        var idx = Math.round(m / 16 * NS), q0 = P[idx], q1 = parallelAt(idx, lam);
        ctx.beginPath(); ctx.moveTo(X(q0), Y(q0)); ctx.lineTo(X(q1), Y(q1)); ctx.stroke();
      }
      ctx.setLineDash([]);

      function poly(get, col, lw) {
        ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath();
        for (var j2 = 0; j2 <= NS; j2++) {
          var q = get(j2);
          if (j2 === 0) ctx.moveTo(X(q), Y(q)); else ctx.lineTo(X(q), Y(q));
        }
        ctx.stroke();
      }
      poly(function (j2) { return P[j2]; }, COL.curve, 2.6);
      poly(function (j2) { return parallelAt(j2, lam); }, COL.par, 2.4);

      /* N at one reference point, at its true length 1 */
      var ri = Math.round(NS * 0.12), base = P[ri], dir = NV[ri],
          tip = [base[0] + dir[0], base[1] + dir[1]];
      ctx.strokeStyle = COL.N; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(X(base), Y(base)); ctx.lineTo(X(tip), Y(tip)); ctx.stroke();
      var ang = Math.atan2(-(Y(tip) - Y(base)), X(tip) - X(base));
      ctx.fillStyle = COL.N; ctx.beginPath();
      ctx.moveTo(X(tip), Y(tip));
      ctx.lineTo(X(tip) - 8 * Math.cos(ang - 0.4), Y(tip) + 8 * Math.sin(ang - 0.4));
      ctx.lineTo(X(tip) - 8 * Math.cos(ang + 0.4), Y(tip) + 8 * Math.sin(ang + 0.4));
      ctx.closePath(); ctx.fill();
      ctx.font = "bold 12px Arial, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("N", X(tip) + 11 * Math.cos(ang), Y(tip) - 11 * Math.sin(ang));

      ctx.textAlign = "left";
      ctx.fillStyle = COL.curve; ctx.fillText("γ", X(P[0]) + 9, Y(P[0]));
      var e0 = parallelAt(0, lam);
      ctx.fillStyle = COL.par;
      ctx.fillText("γλ", X(e0) + 9, Y(e0));

      lamval.textContent = "λ = " + fmt(lam, 2);
      rsig.textContent = "= " + fmt(sigMin);
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

    sL.addEventListener("input", draw);
    global.addEventListener("resize", draw);
    draw();
  }

  global.ParallelCurve = { mount: mount };
})(this);
