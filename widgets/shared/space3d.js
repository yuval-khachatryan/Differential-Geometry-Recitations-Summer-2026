/* space3d.js — a space curve with its moving frame {T, N, B}.

   Drag the canvas to rotate the view. One slider moves the point along the curve;
   a second, optional slider changes a parameter of the curve itself, which is how
   the helix is made to flatten into a circle and its torsion to vanish.

   Everything is computed from the curve by divided differences -- T, N, B, the
   curvature and the torsion all come out of gamma', gamma'' and gamma''' -- so the
   readouts cannot drift from the curve being drawn. In particular {T, N, B} is
   built as T, then B from gamma' x gamma'', then N = B x T, which is orthonormal
   by construction rather than by hope.

   Projection is orthographic: rotate by yaw about z, then by pitch, and drop the
   depth coordinate. Equal scale on both screen axes, so the three frame vectors
   keep their right angles on screen. */
(function (global) {
  "use strict";

  var COL = {
    curve: "#c0392b",
    T:     "#1f4e79",
    N:     "#16a34a",
    B:     "#9333ea",
    axis:  "#94a3b8",
    grid:  "#eef2f7",
    pt:    "#0f172a"
  };

  function fmt(v, d) {
    if (!isFinite(v)) return "—";
    var s = v.toFixed(d === undefined ? 3 : d);
    return s === "-0.000" || s === "-0.00" ? s.slice(1) : s;
  }

  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function mul(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function norm(a) { return Math.sqrt(dot(a, a)); }
  function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0]];
  }

  function mount(cfg) {
    var host = document.getElementById(cfg.mount || "app"),
        t0 = cfg.tMin, t1 = cfg.tMax, NS = cfg.samples || 900,
        h = (t1 - t0) / NS,
        par = cfg.param || null,
        pVal = par ? par.value : 0,
        yaw = cfg.yaw === undefined ? -0.95 : cfg.yaw,
        pitch = cfg.pitch === undefined ? 0.42 : cfg.pitch;

    function f(t) { return cfg.f(t, pVal); }

    var eps = (t1 - t0) * 1e-4;
    function d1(t) { return mul(sub(f(t + eps), f(t - eps)), 1 / (2 * eps)); }
    function d2(t) {
      return mul(add(sub(f(t + eps), mul(f(t), 2)), f(t - eps)), 1 / (eps * eps));
    }
    function d3(t) {
      /* central second difference of the first derivative */
      return mul(sub(d2(t + eps), d2(t - eps)), 1 / (2 * eps));
    }

    /* T, N, B, k, tau at t; null where the curvature degenerates */
    function frameAt(t) {
      var a = d1(t), b = d2(t), c = d3(t),
          sp = norm(a), cr = cross(a, b), ncr = norm(cr);
      if (!(sp > 1e-9) || !(ncr > 1e-9)) return null;
      var T = mul(a, 1 / sp), B = mul(cr, 1 / ncr), N = cross(B, T);
      return { T: T, N: N, B: B, k: ncr / (sp * sp * sp), tau: dot(cr, c) / (ncr * ncr) };
    }

    host.innerHTML =
      '<div class="qv">' +
        '<p class="qv-title" dir="ltr">' + (cfg.title || "") + '</p>' +
        '<div class="qv-canvas-wrap"><canvas class="qv-canvas qv-grab"></canvas></div>' +
        '<div class="qv-row">' +
          '<span class="qv-label">' + (cfg.paramLabel || "הפרמטר") + '</span>' +
          '<input class="qv-slider qv-t" type="range" min="0" max="1000" value="320">' +
          '<span class="qv-badge qv-tval"></span>' +
        '</div>' +
        (par ?
        '<div class="qv-row">' +
          '<span class="qv-label">' + par.label + '</span>' +
          '<input class="qv-slider qv-p" type="range" min="0" max="1000" value="' +
            Math.round((par.value - par.min) / (par.max - par.min) * 1000) + '">' +
          '<span class="qv-badge qv-pval"></span>' +
        '</div>' : "") +
        '<div class="qv-dirs">' +
          '<span><b>k</b>&nbsp;<span dir="ltr" class="qv-r-k"></span></span>' +
          '<span><b>&#964;</b>&nbsp;<span dir="ltr" class="qv-r-tau"></span></span>' +
          '<span><b>&#964;/k</b>&nbsp;<span dir="ltr" class="qv-r-ratio"></span></span>' +
        '</div>' +
        '<div class="qv-hint">' + (cfg.hint || "גררו את הציור כדי לסובב את המבט.") + '</div>' +
      '</div>';

    var cv = host.querySelector("canvas"), ctx = cv.getContext("2d"),
        sT = host.querySelector(".qv-t"), tval = host.querySelector(".qv-tval"),
        sP = par ? host.querySelector(".qv-p") : null,
        pval = par ? host.querySelector(".qv-pval") : null;

    function set(key, txt) {
      var el = host.querySelector(".qv-r-" + key);
      if (el) el.textContent = txt;
    }

    /* ---- projection ---- */
    function project(p) {
      var ca = Math.cos(yaw), sa = Math.sin(yaw),
          cb = Math.cos(pitch), sb = Math.sin(pitch),
          x1 = p[0] * ca - p[1] * sa,
          y1 = p[0] * sa + p[1] * ca;
      return [x1, y1 * sb + p[2] * cb, y1 * cb - p[2] * sb];   /* x, y, depth */
    }

    function draw() {
      var t = t0 + (sT.value / 1000) * (t1 - t0);
      if (sP) pVal = par.min + (sP.value / 1000) * (par.max - par.min);

      /* sample the curve for the current parameter value */
      var P = [], i;
      for (i = 0; i <= NS; i++) P.push(f(t0 + i * h));

      var dpr = global.devicePixelRatio || 1,
          w = cv.clientWidth || 520, hgt = Math.round(w * (cfg.aspect || 0.82));
      cv.width = Math.round(w * dpr); cv.height = Math.round(hgt * dpr);
      cv.style.height = hgt + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, hgt);
      ctx.direction = "ltr";
      ctx.lineJoin = "round";

      /* frame the view on the projected curve, with one scale for both screen
         axes so that right angles between T, N and B survive the projection */
      var xs = [], ys = [], q;
      for (i = 0; i <= NS; i += 3) { q = project(P[i]); xs.push(q[0]); ys.push(q[1]); }
      if (cfg.sphere) { xs.push(-cfg.sphere, cfg.sphere); ys.push(-cfg.sphere, cfg.sphere); }
      if (cfg.plane) {
        /* the plane patch must be inside the frame too, or it would be clipped
           to a sliver and read as a stray line */
        var pn = cfg.plane.normal, ps = cfg.plane.size || 2,
            po = cfg.plane.point || [0, 0, 0],
            pa = Math.abs(pn[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0],
            pe1 = cross(pn, pa); pe1 = mul(pe1, 1 / norm(pe1));
        var pe2 = cross(pn, pe1); pe2 = mul(pe2, 1 / norm(pe2));
        [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(function (sgn) {
          var corner = add(add(po, mul(pe1, ps * sgn[0])), mul(pe2, ps * sgn[1])),
              pq = project(corner);
          xs.push(pq[0]); ys.push(pq[1]);
        });
      }
      var xa = Math.min.apply(null, xs), xb = Math.max.apply(null, xs),
          ya = Math.min.apply(null, ys), yb = Math.max.apply(null, ys),
          cx = (xa + xb) / 2, cy = (ya + yb) / 2,
          halfX = (xb - xa) / 2 * 1.35 || 1, halfY = (yb - ya) / 2 * 1.35 || 1,
          sc = Math.min((w - 24) / (2 * halfX), (hgt - 24) / (2 * halfY)),
          ox = w / 2 - cx * sc, oy = hgt / 2 + cy * sc;
      function X(p3) { return ox + project(p3)[0] * sc; }
      function Y(p3) { return oy - project(p3)[1] * sc; }

      /* the coordinate axes */
      var ext = Math.max(halfX, halfY) * 0.85;
      ctx.lineWidth = 1.2; ctx.strokeStyle = COL.axis;
      ctx.font = "bold 12px Arial, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      [[[ext, 0, 0], "x"], [[0, ext, 0], "y"], [[0, 0, ext], "z"]].forEach(function (ax) {
        ctx.beginPath();
        ctx.moveTo(X([0, 0, 0]), Y([0, 0, 0]));
        ctx.lineTo(X(ax[0]), Y(ax[0]));
        ctx.stroke();
        ctx.fillStyle = "#64748b";
        ctx.fillText(ax[1], X(ax[0]) + 9, Y(ax[0]) - 6);
      });

      /* an optional plane, for curves that lie in one: drawn as a grid so that
         its orientation is readable, and so that B being perpendicular to it is
         something you can see rather than something you are told */
      if (cfg.plane) {
        var pl = cfg.plane, nn = pl.normal, sz = pl.size || 2, o = pl.point || [0, 0, 0],
            aux = Math.abs(nn[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0],
            e1 = cross(nn, aux); e1 = mul(e1, 1 / norm(e1));
        var e2 = cross(nn, e1); e2 = mul(e2, 1 / norm(e2));
        ctx.strokeStyle = "#9ecfc9"; ctx.lineWidth = 0.7;
        var G = 8, gi, u1, u2;
        for (gi = -G; gi <= G; gi++) {
          u1 = add(add(o, mul(e1, sz * gi / G)), mul(e2, -sz));
          u2 = add(add(o, mul(e1, sz * gi / G)), mul(e2, sz));
          ctx.beginPath(); ctx.moveTo(X(u1), Y(u1)); ctx.lineTo(X(u2), Y(u2)); ctx.stroke();
          u1 = add(add(o, mul(e2, sz * gi / G)), mul(e1, -sz));
          u2 = add(add(o, mul(e2, sz * gi / G)), mul(e1, sz));
          ctx.beginPath(); ctx.moveTo(X(u1), Y(u1)); ctx.lineTo(X(u2), Y(u2)); ctx.stroke();
        }
      }

      /* an optional wireframe sphere, for curves that live on one */
      if (cfg.sphere) {
        var R = cfg.sphere, m, n, ring;
        ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = 0.7;
        for (m = 1; m < 8; m++) {                 /* latitudes */
          var ph = Math.PI * m / 8, rr = R * Math.sin(ph), zz = R * Math.cos(ph);
          ctx.beginPath();
          for (n = 0; n <= 64; n++) {
            ring = [rr * Math.cos(2 * Math.PI * n / 64), rr * Math.sin(2 * Math.PI * n / 64), zz];
            if (n === 0) ctx.moveTo(X(ring), Y(ring)); else ctx.lineTo(X(ring), Y(ring));
          }
          ctx.stroke();
        }
        for (m = 0; m < 8; m++) {                 /* meridians */
          var al = Math.PI * m / 8;
          ctx.beginPath();
          for (n = 0; n <= 64; n++) {
            var ph2 = 2 * Math.PI * n / 64;
            ring = [R * Math.sin(ph2) * Math.cos(al), R * Math.sin(ph2) * Math.sin(al),
                    R * Math.cos(ph2)];
            if (n === 0) ctx.moveTo(X(ring), Y(ring)); else ctx.lineTo(X(ring), Y(ring));
          }
          ctx.stroke();
        }
      }

      /* the curve */
      ctx.strokeStyle = COL.curve; ctx.lineWidth = 2.4;
      ctx.beginPath();
      for (i = 0; i <= NS; i++) {
        if (i === 0) ctx.moveTo(X(P[i]), Y(P[i])); else ctx.lineTo(X(P[i]), Y(P[i]));
      }
      ctx.stroke();

      /* the moving frame */
      var fr = frameAt(t), p = f(t), L = Math.max(halfX, halfY) * 0.34;
      if (fr) {
        [[fr.T, COL.T, "T"], [fr.N, COL.N, "N"], [fr.B, COL.B, "B"]].forEach(function (v) {
          var tip = add(p, mul(v[0], L));
          ctx.strokeStyle = v[1]; ctx.lineWidth = 2.2;
          ctx.beginPath(); ctx.moveTo(X(p), Y(p)); ctx.lineTo(X(tip), Y(tip)); ctx.stroke();
          var ang = Math.atan2(-(Y(tip) - Y(p)), X(tip) - X(p));
          ctx.fillStyle = v[1]; ctx.beginPath();
          ctx.moveTo(X(tip), Y(tip));
          ctx.lineTo(X(tip) - 9 * Math.cos(ang - 0.4), Y(tip) + 9 * Math.sin(ang - 0.4));
          ctx.lineTo(X(tip) - 9 * Math.cos(ang + 0.4), Y(tip) + 9 * Math.sin(ang + 0.4));
          ctx.closePath(); ctx.fill();
          ctx.font = "bold 12px Arial, sans-serif";
          ctx.fillText(v[2], X(tip) + 12 * Math.cos(ang), Y(tip) - 12 * Math.sin(ang));
        });
      }
      ctx.fillStyle = COL.pt;
      ctx.beginPath(); ctx.arc(X(p), Y(p), 5, 0, 2 * Math.PI); ctx.fill();

      tval.textContent = fmt(t, 2);
      if (pval) pval.textContent = par.label + " = " + fmt(pVal, 2);
      set("k", fr ? "= " + fmt(fr.k) : "= —");
      set("tau", fr ? "= " + fmt(fr.tau) : "= —");
      set("ratio", fr && Math.abs(fr.k) > 1e-9 ? "= " + fmt(fr.tau / fr.k) : "= —");
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

    /* ---- drag to rotate ---- */
    var dragging = false, lastX = 0, lastY = 0;
    function down(e) {
      dragging = true;
      var p = e.touches ? e.touches[0] : e;
      lastX = p.clientX; lastY = p.clientY;
      cv.classList.add("qv-grabbing");
    }
    function move(e) {
      if (!dragging) return;
      var p = e.touches ? e.touches[0] : e;
      yaw += (p.clientX - lastX) * 0.011;
      pitch += (p.clientY - lastY) * 0.008;
      pitch = Math.max(-1.45, Math.min(1.45, pitch));
      lastX = p.clientX; lastY = p.clientY;
      if (e.cancelable) e.preventDefault();
      draw();
    }
    function up() { dragging = false; cv.classList.remove("qv-grabbing"); }

    cv.addEventListener("mousedown", down);
    global.addEventListener("mousemove", move);
    global.addEventListener("mouseup", up);
    cv.addEventListener("touchstart", down, { passive: true });
    cv.addEventListener("touchmove", move, { passive: false });
    global.addEventListener("touchend", up);

    sT.addEventListener("input", draw);
    if (sP) sP.addEventListener("input", draw);
    global.addEventListener("resize", draw);
    draw();
  }

  global.Space3D = { mount: mount };
})(this);
