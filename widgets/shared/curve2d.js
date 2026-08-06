/* curve2d.js — an explorer for a plane curve given by t |-> (x(t), y(t)).
   Drag the slider to move along the curve; the widget shows the traced arc, the
   moving frame T, N, optionally the osculating circle, and a live readout of
   every quantity the chapter defines: speed, arc length, turning angle and
   curvature. Everything is computed numerically from the curve itself, so a
   widget can never disagree with the exercise it illustrates. */
(function (global) {
  "use strict";

  var COL = {
    curve: "#94a3b8",     // the whole curve, muted
    traced:"#c0392b",     // the part already traversed
    T:     "#1f4e79",
    N:     "#16a34a",
    osc:   "#9333ea",
    axis:  "#94a3b8",
    grid:  "#eef2f7",
    pt:    "#c0392b"
  };

  function fmt(v, d) {
    if (!isFinite(v)) return "—";
    var s = v.toFixed(d === undefined ? 3 : d);
    return s === "-0.000" || s === "-0.00" ? s.slice(1) : s;
  }

  function mount(cfg) {
    var f = cfg.f, t0 = cfg.tMin, t1 = cfg.tMax,
        N = cfg.samples || 900,
        host = document.getElementById(cfg.mount || "app"),
        show = cfg.show || {};

    /* ---- sample the curve and precompute the derived quantities ---- */
    var ts = [], P = [], i, h = (t1 - t0) / N;
    for (i = 0; i <= N; i++) { ts.push(t0 + i * h); P.push(f(ts[i])); }

    var eps = (t1 - t0) * 1e-5,
        eps2 = (t1 - t0) * 1e-3;   /* second differences divide by h^2 — needs a bigger step */
    function d1(t) {
      var a = f(t - eps), b = f(t + eps);
      return [(b[0] - a[0]) / (2 * eps), (b[1] - a[1]) / (2 * eps)];
    }
    function d2(t) {
      var a = f(t - eps2), m = f(t), b = f(t + eps2);
      return [(b[0] - 2 * m[0] + a[0]) / (eps2 * eps2), (b[1] - 2 * m[1] + a[1]) / (eps2 * eps2)];
    }
    function speed(t) { var v = d1(t); return Math.sqrt(v[0] * v[0] + v[1] * v[1]); }

    /* arc length by cumulative trapezoid over the sample grid */
    var S = [0];
    for (i = 1; i <= N; i++) S.push(S[i - 1] + (speed(ts[i - 1]) + speed(ts[i])) / 2 * h);
    function arcAt(t) {
      var u = (t - t0) / h, j = Math.max(0, Math.min(N - 1, Math.floor(u)));
      return S[j] + (S[j + 1] - S[j]) * (u - j);
    }

    /* turning angle, unwrapped so it varies continuously */
    var TH = [], prev = null;
    for (i = 0; i <= N; i++) {
      var v = d1(ts[i]), a = Math.atan2(v[1], v[0]);
      if (prev !== null) { while (a - prev > Math.PI) a -= 2 * Math.PI; while (prev - a > Math.PI) a += 2 * Math.PI; }
      TH.push(a); prev = a;
    }
    function thetaAt(t) {
      var u = (t - t0) / h, j = Math.max(0, Math.min(N - 1, Math.floor(u)));
      return TH[j] + (TH[j + 1] - TH[j]) * (u - j);
    }
    /* signed curvature k = dtheta/ds = (x'y'' - y'x'') / |gamma'|^3 */
    function curv(t) {
      var a = d1(t), b = d2(t), sp = Math.sqrt(a[0] * a[0] + a[1] * a[1]);
      return (a[0] * b[1] - a[1] * b[0]) / Math.pow(sp, 3);
    }

    /* ---- optional wider drawing range. Lets a widget show the whole curve while
       the slider, the arc length and every readout stay on [tMin, tMax] — the
       catenary is drawn on both arms, but its arc length is still measured from
       (0,1) rightwards, as the exercise asks. ---- */
    var Q = null;
    if (cfg.viewMin !== undefined || cfg.viewMax !== undefined) {
      var q0 = cfg.viewMin === undefined ? t0 : cfg.viewMin,
          q1 = cfg.viewMax === undefined ? t1 : cfg.viewMax,
          qh = (q1 - q0) / N;
      Q = [];
      for (i = 0; i <= N; i++) Q.push(f(q0 + i * qh));
    }

    /* ---- view box ---- */
    var B = Q || P,
        xs = B.map(function (p) { return p[0]; }), ys = B.map(function (p) { return p[1]; }),
        xa = Math.min.apply(null, xs), xb = Math.max.apply(null, xs),
        ya = Math.min.apply(null, ys), yb = Math.max.apply(null, ys),
        cx0 = (xa + xb) / 2, cy0 = (ya + yb) / 2,
        half = Math.max(xb - xa, yb - ya) / 2 * 1.35 || 1;
    if (cfg.pad) half *= cfg.pad;

    /* ---- markup ---- */
    var rows = [];
    (cfg.readout || ["pos", "speed", "s", "theta", "k"]).forEach(function (key) {
      rows.push('<span><b>' + ({
        pos: "$\\gamma(t)$", speed: "$\\lVert\\gamma'(t)\\rVert$", s: "$s(t)$",
        theta: "$\\theta(t)$", k: "$k(t)$", turn: "$\\Delta\\theta$"
      }[key] || key) + '</b>&nbsp;<span dir="ltr" class="qv-r-' + key + '"></span></span>');
    });

    host.innerHTML =
      '<div class="qv">' +
        (cfg.title ? '<p class="qv-title">' + cfg.title + '</p>' : '') +
        '<div class="qv-canvas-wrap"><canvas class="qv-canvas"></canvas></div>' +
        '<div class="qv-row">' +
          '<span class="qv-label">' + (cfg.paramLabel || "הפרמטר $t$") + '</span>' +
          '<input class="qv-slider" type="range" min="0" max="1000" value="0">' +
          '<span class="qv-badge qv-tval"></span>' +
          '<button class="qv-btn qv-play" type="button">הפעל</button>' +
        '</div>' +
        '<div class="qv-dirs">' + rows.join("") + '</div>' +
        '<div class="qv-legend">' +
          '<span><i class="qv-key" style="background:' + COL.traced + '"></i>הקשת שנסרקה</span>' +
          (show.tn === false ? "" :
            '<span><i class="qv-key" style="background:' + COL.T + '"></i>T</span>' +
            '<span><i class="qv-key" style="background:' + COL.N + '"></i>N</span>') +
          (show.osc ? '<span><i class="qv-key" style="background:' + COL.osc + '"></i>מעגל העקמומיות</span>' : "") +
        '</div>' +
        '<div class="qv-hint">' + (cfg.hint || "גררו את המחוון כדי לנוע לאורך העקומה.") + '</div>' +
      '</div>';

    if (global.MathRender) global.MathRender.typeset(host);

    var cv = host.querySelector("canvas"), ctx = cv.getContext("2d"),
        slider = host.querySelector(".qv-slider"),
        play = host.querySelector(".qv-play"),
        tval = host.querySelector(".qv-tval"),
        timer = null;

    function draw() {
      var frac = slider.value / 1000, t = t0 + frac * (t1 - t0),
          dpr = global.devicePixelRatio || 1,
          w = cv.clientWidth || 520, hgt = Math.round(w * (cfg.aspect || 0.68));
      cv.width = Math.round(w * dpr); cv.height = Math.round(hgt * dpr);
      cv.style.height = hgt + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, hgt);

      var sc = Math.min((w - 20) / (2 * half), (hgt - 20) / (2 * half)),
          ox = w / 2 - cx0 * sc, oy = hgt / 2 + cy0 * sc;
      function X(p) { return ox + p[0] * sc; }
      function Y(p) { return oy - p[1] * sc; }

      /* x and y are scaled by the SAME sc, so that N really looks perpendicular
         to T. One consequence: the canvas usually shows more than [c +- half] on
         the axis that is not the binding one. Grid lines and their numbers have
         to span what is actually on screen, or they stop short of the frame and
         the numbering appears not to reach the edge. */
      var xVis = (w / 2) / sc, yVis = (hgt / 2) / sc;

      /* grid + axes */
      var step = Math.pow(10, Math.round(Math.log(half / 2) / Math.LN10));
      if (Math.max(xVis, yVis) / step > 9) step *= 2;
      ctx.strokeStyle = COL.grid; ctx.lineWidth = 1;
      for (var g = Math.ceil((cx0 - xVis) / step) * step; g <= cx0 + xVis; g += step) {
        ctx.beginPath(); ctx.moveTo(X([g, 0]), 0); ctx.lineTo(X([g, 0]), hgt); ctx.stroke();
      }
      for (var g2 = Math.ceil((cy0 - yVis) / step) * step; g2 <= cy0 + yVis; g2 += step) {
        ctx.beginPath(); ctx.moveTo(0, Y([0, g2])); ctx.lineTo(w, Y([0, g2])); ctx.stroke();
      }
      ctx.strokeStyle = COL.axis; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(0, Y([0, 0])); ctx.lineTo(w, Y([0, 0])); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(X([0, 0]), 0); ctx.lineTo(X([0, 0]), hgt); ctx.stroke();
      ctx.direction = "ltr"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = "#475569"; ctx.font = "bold 12px Arial, sans-serif";
      ctx.fillText("x", w - 9, Y([0, 0]) - 10);
      ctx.fillText("y", X([0, 0]) + 11, 10);

      /* numbers on the grid lines. The axes can sit off-canvas (the circle of
         exercise 4 is centred at (1,-3)), so the label row/column is clamped to
         stay visible rather than following the axis out of frame. */
      var lstep = step * sc < 34 ? step * 2 : step,       // thin out when cramped
          dec = Math.max(0, -Math.floor(Math.log(lstep) / Math.LN10 + 1e-9)),
          tol = lstep * 1e-6,
          rowY = Math.min(Math.max(Y([0, 0]), 2), hgt - 15),
          colX = Math.min(Math.max(X([0, 0]), 26), w - 4);
      function num(v) {
        var s = v.toFixed(dec);
        return /^-0(\.0*)?$/.test(s) ? s.slice(1) : s;     // no "-0"
      }
      ctx.fillStyle = "#64748b"; ctx.font = "11px Arial, sans-serif";
      ctx.strokeStyle = COL.axis; ctx.lineWidth = 1;
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      for (var gx = Math.ceil((cx0 - xVis) / lstep) * lstep; gx <= cx0 + xVis; gx += lstep) {
        var px = X([gx, 0]);
        if (Math.abs(gx) < tol || px < 12 || px > w - 12) continue;
        ctx.beginPath(); ctx.moveTo(px, rowY - 3); ctx.lineTo(px, rowY + 3); ctx.stroke();
        ctx.fillText(num(gx), px, rowY + 5);
      }
      ctx.textAlign = "right"; ctx.textBaseline = "middle";
      for (var gy = Math.ceil((cy0 - yVis) / lstep) * lstep; gy <= cy0 + yVis; gy += lstep) {
        var py = Y([0, gy]);
        if (Math.abs(gy) < tol || py < 8 || py > hgt - 8) continue;
        ctx.beginPath(); ctx.moveTo(colX - 3, py); ctx.lineTo(colX + 3, py); ctx.stroke();
        ctx.fillText(num(gy), colX - 6, py);
      }
      ctx.textBaseline = "top";
      ctx.fillText("0", colX - 6, rowY + 5);               // origin, labelled once
      ctx.textAlign = "center"; ctx.textBaseline = "middle";   // restore for what follows

      /* the full curve, then the traced part on top */
      function stroke(arr, from, to, col, lw) {
        ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath();
        for (var j = from; j <= to; j++) {
          var p = arr[j];
          if (j === from) ctx.moveTo(X(p), Y(p)); else ctx.lineTo(X(p), Y(p));
        }
        ctx.stroke();
      }
      stroke(Q || P, 0, N, COL.curve, 1.6);   /* the whole curve, context range if given */
      var jt = Math.max(0, Math.min(N, Math.round((t - t0) / h)));
      if (jt > 0) stroke(P, 0, jt, COL.traced, 2.6);

      var p = f(t);

      /* osculating circle */
      if (show.osc) {
        var k = curv(t), v = d1(t), sp = Math.sqrt(v[0] * v[0] + v[1] * v[1]),
            Tv = [v[0] / sp, v[1] / sp], Nv = [-Tv[1], Tv[0]];
        if (Math.abs(k) > 1e-4 && Math.abs(1 / k) < half * 6) {
          var r = 1 / k, c = [p[0] + r * Nv[0], p[1] + r * Nv[1]];
          ctx.strokeStyle = COL.osc; ctx.lineWidth = 1.3; ctx.setLineDash([5, 4]);
          ctx.beginPath(); ctx.arc(X(c), Y(c), Math.abs(r) * sc, 0, 2 * Math.PI); ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = COL.osc;
          ctx.beginPath(); ctx.arc(X(c), Y(c), 3, 0, 2 * Math.PI); ctx.fill();
        }
      }

      /* the moving frame */
      if (show.tn !== false) {
        var vv = d1(t), s2 = Math.sqrt(vv[0] * vv[0] + vv[1] * vv[1]),
            Tu = [vv[0] / s2, vv[1] / s2], Nu = [-Tu[1], Tu[0]],
            L = half * 0.28;
        arrow(p, Tu, L, COL.T, "T");
        arrow(p, Nu, L, COL.N, "N");
      }
      function arrow(base, dir, len, col, lab) {
        var tip = [base[0] + dir[0] * len, base[1] + dir[1] * len];
        ctx.strokeStyle = col; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(X(base), Y(base)); ctx.lineTo(X(tip), Y(tip)); ctx.stroke();
        var ang = Math.atan2(-(Y(tip) - Y(base)), X(tip) - X(base));
        ctx.fillStyle = col; ctx.beginPath();
        ctx.moveTo(X(tip), Y(tip));
        ctx.lineTo(X(tip) - 8 * Math.cos(ang - 0.4), Y(tip) + 8 * Math.sin(ang - 0.4));
        ctx.lineTo(X(tip) - 8 * Math.cos(ang + 0.4), Y(tip) + 8 * Math.sin(ang + 0.4));
        ctx.closePath(); ctx.fill();
        ctx.font = "bold 12px Arial, sans-serif";
        ctx.fillText(lab, X(tip) + 10 * Math.cos(ang), Y(tip) - 10 * Math.sin(ang));
      }

      /* fixed marks (e.g. a self-intersection) */
      (cfg.marks || []).forEach(function (m) {
        var q = f(m.t);
        ctx.fillStyle = "#b45309";
        ctx.beginPath(); ctx.arc(X(q), Y(q), 4, 0, 2 * Math.PI); ctx.fill();
        if (m.label) {
          ctx.font = "11px Arial, sans-serif";
          ctx.fillText(m.label, X(q) + 22, Y(q) - 10);
        }
      });

      /* the moving point */
      ctx.fillStyle = COL.pt;
      ctx.beginPath(); ctx.arc(X(p), Y(p), 4.5, 0, 2 * Math.PI); ctx.fill();

      /* readout */
      tval.textContent = fmt(t, 2);
      set("pos", "= (" + fmt(p[0]) + ", " + fmt(p[1]) + ")");
      set("speed", "= " + fmt(speed(t)));
      set("s", "= " + fmt(arcAt(t)));
      set("theta", "= " + fmt(thetaAt(t)) + " rad");
      set("k", "= " + fmt(curv(t)));
      set("turn", "= " + fmt(thetaAt(t) - TH[0]) + " rad");
      function set(key, txt) {
        var el = host.querySelector(".qv-r-" + key);
        if (el) el.textContent = txt;
      }
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
    slider.addEventListener("input", function () { stop(); draw(); });
    play.addEventListener("click", function () {
      if (timer) { stop(); return; }
      play.textContent = "עצור";
      if (+slider.value >= 1000) slider.value = 0;
      timer = setInterval(function () {
        var v = +slider.value + 5;
        if (v >= 1000) { v = 1000; stop(); }
        slider.value = v; draw();
      }, 16);
    });
    global.addEventListener("resize", draw);
    draw();
  }

  global.Curve2D = { mount: mount };
})(this);
