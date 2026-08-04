/* conic2d.js — draws the conic of a given (A, b, c) and animates the change of
   coordinates the tirgul performs: at t = 0 the curve sits in its canonical
   position at the origin, at t = 1 it is back where the original equation puts
   it. The motion in between is a genuine rigid motion (rotation by t*theta plus
   t of the translation), because P is built with det = +1. */
(function (global) {
  "use strict";
  var L = global.LinAlg;

  var COL = {
    curve: "#c0392b",
    axis:  "#94a3b8",
    prin:  "#1f4e79",
    centre:"#16a34a",
    grid:  "#e2e8f0"
  };

  /* short tick label: 2, -1.5, 0.25 — never 1.0000000000000002 */
  function fmtNum(v) {
    var s = (Math.round(v * 1000) / 1000).toString();
    return s === "-0" ? "0" : s;
  }
  /* how far one may travel from p along dir before leaving the visible world
     box; used to park an axis label just inside the edge */
  function rayMax(p, dir, halfW, halfH) {
    var lim = Infinity, i, h = [halfW, halfH], s;
    for (i = 0; i < 2; i++) {
      if (Math.abs(dir[i]) < 1e-9) continue;
      s = ((dir[i] > 0 ? h[i] : -h[i]) - p[i]) / dir[i];
      if (s >= 0) lim = Math.min(lim, s);
    }
    return isFinite(lim) ? lim : 0;
  }

  function classify(can) {
    var l = can.lam, k = can.k, li = can.linIdx;
    if (li >= 0) return "parabola";
    var nz = l.filter(function (v) { return Math.abs(v) > 1e-9; });
    if (nz.length < 2) {                       // one zero eigenvalue, no linear term
      if (Math.abs(k) < 1e-12) return "line";
      return (k / nz[0] > 0) ? "parallel" : "empty";
    }
    var same = (l[0] > 0) === (l[1] > 0);
    if (Math.abs(k) < 1e-12) return same ? "point" : "crosslines";
    if (same) return (k / l[0] > 0) ? "ellipse" : "empty";
    return "hyperbola";
  }

  var NAME = {
    ellipse: "אליפסה", hyperbola: "היפרבולה", parabola: "פרבולה",
    crosslines: "זוג ישרים נחתכים", parallel: "זוג ישרים מקבילים",
    line: "ישר יחיד", point: "נקודה בודדת", empty: "קבוצה ריקה"
  };

  /* Curve as a list of polylines in canonical (U,V) coordinates. */
  function build(can, kind, R) {
    var l = can.lam, k = can.k, li = can.linIdx, mu = can.mu,
        out = [], i, N = 240, a, b, s, t, j, seg;

    if (kind === "ellipse") {
      a = Math.sqrt(k / l[0]); b = Math.sqrt(k / l[1]);
      seg = [];
      for (i = 0; i <= N; i++) { t = 2 * Math.PI * i / N; seg.push([a * Math.cos(t), b * Math.sin(t)]); }
      out.push(seg);
    } else if (kind === "hyperbola") {
      var pos = (k / l[0] > 0) ? 0 : 1, neg = 1 - pos;
      a = Math.sqrt(k / l[pos]); b = Math.sqrt(-k / l[neg]);
      var smax = Math.asinh(Math.max(2, 2.2 * R / Math.max(b, 1e-6)));
      for (j = 0; j < 2; j++) {
        seg = [];
        for (i = 0; i <= N; i++) {
          s = -smax + 2 * smax * i / N;
          var p = [];
          p[pos] = (j ? -1 : 1) * a * Math.cosh(s);
          p[neg] = b * Math.sinh(s);
          seg.push(p);
        }
        out.push(seg);
      }
    } else if (kind === "parabola") {
      var q = 1 - li;                            // the squared direction
      var umax = Math.sqrt(Math.abs(2.2 * R * mu / l[q])) || R;
      umax = Math.max(umax, 0.1);
      seg = [];
      for (i = 0; i <= N; i++) {
        var u = -umax + 2 * umax * i / N, p2 = [];
        p2[q] = u;
        p2[li] = l[q] * u * u / mu;
        seg.push(p2);
      }
      out.push(seg);
    } else if (kind === "crosslines") {
      var m = Math.sqrt(-l[0] / l[1]);
      out.push([[-R, -m * R], [R, m * R]]);
      out.push([[-R, m * R], [R, -m * R]]);
    } else if (kind === "parallel" || kind === "line") {
      var nzi = Math.abs(l[0]) > 1e-9 ? 0 : 1, oi = 1 - nzi,
          d = Math.sqrt(Math.max(0, k / l[nzi])), sgn;
      for (sgn = -1; sgn <= 1; sgn += 2) {
        var e1 = [], e2 = [];
        e1[nzi] = sgn * d; e1[oi] = -R;
        e2[nzi] = sgn * d; e2[oi] = R;
        out.push([e1, e2]);
        if (d < 1e-12) break;
      }
    } else if (kind === "point") {
      out.push([[0, 0]]);
    }
    return out;
  }

  function mount(cfg) {
    var can = L.canonical(cfg.A, cfg.b, cfg.c),
        kind = classify(can),
        P = can.P,
        theta = L.angle2(P),
        centre = L.matVec(P, can.u0),
        host = document.getElementById(cfg.mount || "app");

    /* View radius: big enough to show the centre, the curve's own size and the
       origin, and it never changes with t so the picture does not jump. */
    var sz = 2;
    if (kind === "ellipse" || kind === "hyperbola") {
      sz = Math.max(Math.abs(can.k / can.lam[0]), Math.abs(can.k / can.lam[1]));
      sz = Math.sqrt(sz);
    }
    var R = 1.9 * (Math.max(Math.abs(centre[0]), Math.abs(centre[1])) + Math.max(sz, 1.2));

    var polys = build(can, kind, R);

    host.innerHTML =
      '<div class="qv">' +
        (cfg.title ? '<p class="qv-title">' + cfg.title + '</p>' : '') +
        '<div class="qv-canvas-wrap"><canvas class="qv-canvas"></canvas></div>' +
        '<div class="qv-row">' +
          '<span class="qv-label">מיקום קנוני ← מקורי</span>' +
          '<input class="qv-slider" type="range" min="0" max="1000" value="1000">' +
          '<button class="qv-btn qv-play" type="button">הפעל</button>' +
        '</div>' +
        '<div class="qv-class">' + (NAME[kind] || kind) + '</div>' +
        '<div class="qv-dirs">' + L.dirsSkeleton(["U", "V"]) + '</div>' +
        '<div class="qv-legend">' +
          '<span><i class="qv-key" style="background:' + COL.curve + '"></i>העקומה</span>' +
          '<span><i class="qv-key" style="background:' + COL.prin + '"></i>הצירים הראשיים</span>' +
          '<span><i class="qv-key" style="background:' + COL.centre + '"></i>' + (kind === "parabola" ? "קדקוד" : "מרכז") + '</span>' +
          '<span><i class="qv-key" style="background:' + COL.axis + '"></i>הצירים המקוריים</span>' +
        '</div>' +
        '<div class="qv-hint">גררו את המחוון: משמאל העקומה בצורתה הקנונית סביב הראשית, ומימין במקומה לפי המשוואה הנתונה.</div>' +
      '</div>';

    var cv = host.querySelector("canvas"),
        ctx = cv.getContext("2d"),
        slider = host.querySelector(".qv-slider"),
        play = host.querySelector(".qv-play"),
        dEls = [host.querySelector(".qv-d0"), host.querySelector(".qv-d1")],
        dcEl = host.querySelector(".qv-dc"),
        timer = null;

    function place(p, t) {
      var Rt = L.rot2(t * theta),
          q = L.matVec(Rt, p);
      return [q[0] + t * centre[0], q[1] + t * centre[1]];
    }

    function draw() {
      var t = slider.value / 1000,
          dpr = global.devicePixelRatio || 1,
          w = cv.clientWidth || 520,
          h = Math.round(w * 0.72);
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      cv.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      var pad = 8,
          sc = Math.min((w - 2 * pad) / (2 * R), (h - 2 * pad) / (2 * R)),
          cx = w / 2, cy = h / 2;
      function X(p) { return cx + p[0] * sc; }
      function Y(p) { return cy - p[1] * sc; }

      /* grid */
      ctx.strokeStyle = COL.grid; ctx.lineWidth = 1;
      var step = Math.pow(10, Math.round(Math.log(R / 4) / Math.LN10));
      if (R / step > 12) step *= 2;
      for (var g = -Math.ceil(R / step) * step; g <= R; g += step) {
        ctx.beginPath(); ctx.moveTo(X([g, 0]), 0); ctx.lineTo(X([g, 0]), h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, Y([0, g])); ctx.lineTo(w, Y([0, g])); ctx.stroke();
      }
      /* original axes */
      ctx.strokeStyle = COL.axis; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();

      /* tick numbers, then the names of the original axes */
      ctx.direction = "ltr";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = COL.axis; ctx.font = "11px Arial, sans-serif";
      for (var g2 = -Math.ceil(R / step) * step; g2 <= R; g2 += step) {
        if (Math.abs(g2) < step / 2) continue;
        ctx.fillText(fmtNum(g2), X([g2, 0]), cy + 11);
        ctx.fillText(fmtNum(g2), cx - 14, Y([0, g2]));
      }
      ctx.fillStyle = "#475569"; ctx.font = "bold 13px Arial, sans-serif";
      ctx.fillText("x", w - 9, cy - 11);
      ctx.fillText("y", cx + 12, 10);

      /* principal axes, carried along by the motion */
      var c0 = [t * centre[0], t * centre[1]], Rt = L.rot2(t * theta);
      ctx.strokeStyle = COL.prin; ctx.lineWidth = 1.4; ctx.setLineDash([6, 5]);
      for (var d = 0; d < 2; d++) {
        var dir = [Rt[0][d], Rt[1][d]];
        ctx.beginPath();
        ctx.moveTo(X([c0[0] - dir[0] * R, c0[1] - dir[1] * R]), Y([c0[0] - dir[0] * R, c0[1] - dir[1] * R]));
        ctx.lineTo(X([c0[0] + dir[0] * R, c0[1] + dir[1] * R]), Y([c0[0] + dir[0] * R, c0[1] + dir[1] * R]));
        ctx.stroke();
      }
      ctx.setLineDash([]);

      /* names of the rotating principal axes */
      ctx.fillStyle = COL.prin; ctx.font = "bold 13px Arial, sans-serif";
      var halfW = (w / 2) / sc, halfH = (h / 2) / sc, LBL = ["U", "V"];
      for (var d2 = 0; d2 < 2; d2++) {
        var dr = [Rt[0][d2], Rt[1][d2]],
            sm = rayMax(c0, dr, halfW, halfH) * 0.9,
            lp = [c0[0] + dr[0] * sm, c0[1] + dr[1] * sm];
        ctx.fillText(LBL[d2], X(lp), Y(lp));
      }

      /* live readout: the directions as they are *right now*, so the numbers
         travel from the standard basis to the eigenbasis along with the picture */
      for (var dr2 = 0; dr2 < 2; dr2++) dEls[dr2].textContent = L.vecText(L.col(Rt, dr2));
      dcEl.textContent = L.vecText(c0);

      /* the curve */
      ctx.strokeStyle = COL.curve; ctx.lineWidth = 2.2;
      polys.forEach(function (seg) {
        if (seg.length === 1) return;
        ctx.beginPath();
        seg.forEach(function (p, i) {
          var q = place(p, t);
          if (i === 0) ctx.moveTo(X(q), Y(q)); else ctx.lineTo(X(q), Y(q));
        });
        ctx.stroke();
      });

      /* centre / vertex */
      ctx.fillStyle = COL.centre;
      ctx.beginPath(); ctx.arc(X(c0), Y(c0), 4.5, 0, 2 * Math.PI); ctx.fill();

      report();
    }

    var lastH = 0;
    function report() {
      var hgt = Math.ceil(document.documentElement.scrollHeight);
      if (hgt !== lastH && global.parent) {
        lastH = hgt;
        global.parent.postMessage({ type: "widget-height", height: hgt }, "*");
      }
    }

    slider.addEventListener("input", function () { stop(); draw(); });
    function stop() { if (timer) { clearInterval(timer); timer = null; play.textContent = "הפעל"; } }
    play.addEventListener("click", function () {
      if (timer) { stop(); return; }
      play.textContent = "עצור";
      if (+slider.value >= 1000) slider.value = 0;
      timer = setInterval(function () {
        var v = +slider.value + 12;
        if (v >= 1000) { v = 1000; stop(); }
        slider.value = v; draw();
      }, 16);
    });
    global.addEventListener("resize", draw);
    draw();
  }

  global.Conic2D = { mount: mount, classify: classify, build: build, NAME: NAME };
})(this);
