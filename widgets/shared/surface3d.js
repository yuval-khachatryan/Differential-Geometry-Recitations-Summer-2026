/* surface3d.js — parametrised surface + drag-to-rotate, no dependencies.
   ---------------------------------------------------------------------------
   Chapter 6. Renders x(u,v) over a rectangle in the (u,v) plane, and can pick
   out the curves that the chapter talks about:

     * `uCurves` / `vCurves` — the coordinate curves. For a surface of revolution
       these ARE the meridians and parallels; for a ruled surface the v-curves
       ARE the rulings. One mechanism, three names in the text.
     * `tangent` — the tangent plane at a moving point, drawn together with the
       basis x_u, x_v that spans it.

   Hidden-surface removal is a painter's algorithm over the quads. That is exact
   enough here because every surface we draw is a graph over its (u,v) rectangle
   with no self-occlusion beyond what depth-sorting resolves; it costs nothing
   and avoids pulling in a 3-D library.

   One scale is used for both screen axes, as in space3d.js: the tangent basis
   must keep its angles, otherwise x_u and x_v stop looking like what they are.
   --------------------------------------------------------------------------- */
(function (global) {
  "use strict";

  var COL = {
    surf: "#bcd4ea", edge: "#7ba6cf",
    u: "#1f4e79", v: "#c0392b",
    tan: "#7c3aed", pt: "#0f172a", axis: "#94a3b8"
  };

  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function mul(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function norm(a) { return Math.sqrt(dot(a, a)); }
  function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }
  function fmt(v, d) {
    var s = (Math.abs(v) < 5e-4 ? 0 : v).toFixed(d === undefined ? 2 : d);
    return s === "-0.00" ? "0.00" : s;
  }

  function mount(cfg) {
    var host = document.getElementById(cfg.mount || "app"),
        u0 = cfg.uMin, u1 = cfg.uMax, v0 = cfg.vMin, v1 = cfg.vMax,
        NU = cfg.nu || 44, NV = cfg.nv || 30,
        par = cfg.param || null,
        pVal = par ? par.value : 0,
        yaw = cfg.yaw === undefined ? -0.95 : cfg.yaw,
        pitch = cfg.pitch === undefined ? 0.38 : cfg.pitch;

    function f(u, v) { return cfg.f(u, v, pVal); }

    var eps = 1e-5;
    function xu(u, v) { return mul(sub(f(u + eps, v), f(u - eps, v)), 1 / (2 * eps)); }
    function xv(u, v) { return mul(sub(f(u, v + eps), f(u, v - eps)), 1 / (2 * eps)); }

    var showTan = !!cfg.tangent,
        sweep = cfg.sweep || null;   /* {over:'u'|'v', label} — trace the surface out */

    host.innerHTML =
      '<div class="qv">' +
        '<p class="qv-title" dir="ltr">' + (cfg.title || "") + '</p>' +
        '<div class="qv-canvas-wrap"><canvas class="qv-canvas qv-grab"></canvas></div>' +
        (showTan ?
        '<div class="qv-row">' +
          '<span class="qv-label">' + (cfg.uLabel || "u") + '</span>' +
          '<input class="qv-slider qv-u" type="range" min="0" max="1000" value="380">' +
          '<span class="qv-badge qv-uval"></span>' +
        '</div>' +
        '<div class="qv-row">' +
          '<span class="qv-label">' + (cfg.vLabel || "v") + '</span>' +
          '<input class="qv-slider qv-v" type="range" min="0" max="1000" value="520">' +
          '<span class="qv-badge qv-vval"></span>' +
        '</div>' : "") +
        (sweep ?
        '<div class="qv-row">' +
          '<span class="qv-label">' + (sweep.label || "הזזת הישר") + '</span>' +
          '<input class="qv-slider qv-s" type="range" min="0" max="1000" value="1000">' +
          '<span class="qv-badge qv-sval"></span>' +
        '</div>' : "") +
        (par ?
        '<div class="qv-row">' +
          '<span class="qv-label">' + par.label + '</span>' +
          '<input class="qv-slider qv-p" type="range" min="0" max="1000" value="' +
            Math.round((par.value - par.min) / (par.max - par.min) * 1000) + '">' +
          '<span class="qv-badge qv-pval"></span>' +
        '</div>' : "") +
        (showTan ?
        '<div class="qv-dirs">' +
          '<span><b>g&#8321;&#8321;</b>&nbsp;<span dir="ltr" class="qv-r-g11"></span></span>' +
          '<span><b>g&#8321;&#8322;</b>&nbsp;<span dir="ltr" class="qv-r-g12"></span></span>' +
          '<span><b>g&#8322;&#8322;</b>&nbsp;<span dir="ltr" class="qv-r-g22"></span></span>' +
        '</div>' : "") +
        '<div class="qv-hint">' + (cfg.hint || "גררו את הציור כדי לסובב את המבט.") + '</div>' +
      '</div>';

    var cv = host.querySelector("canvas"), ctx = cv.getContext("2d"),
        sU = host.querySelector(".qv-u"), uval = host.querySelector(".qv-uval"),
        sV = host.querySelector(".qv-v"), vval = host.querySelector(".qv-vval"),
        sS = sweep ? host.querySelector(".qv-s") : null,
        sval = sweep ? host.querySelector(".qv-sval") : null,
        sP = par ? host.querySelector(".qv-p") : null,
        pval = par ? host.querySelector(".qv-pval") : null;

    function set(key, txt) {
      var el = host.querySelector(".qv-r-" + key);
      if (el) el.textContent = txt;
    }

    function project(p) {
      var ca = Math.cos(yaw), sa = Math.sin(yaw),
          cb = Math.cos(pitch), sb = Math.sin(pitch),
          x1 = p[0] * ca - p[1] * sa,
          y1 = p[0] * sa + p[1] * ca;
      return [x1, y1 * sb + p[2] * cb, y1 * cb - p[2] * sb];
    }

    function draw() {
      if (sP) pVal = par.min + (sP.value / 1000) * (par.max - par.min);
      var uSel = u0 + (showTan ? sU.value / 1000 : 0) * (u1 - u0),
          vSel = v0 + (showTan ? sV.value / 1000 : 0) * (v1 - v0);

      var dpr = global.devicePixelRatio || 1,
          w = cv.clientWidth || 520, hgt = Math.round(w * (cfg.aspect || 0.78));
      cv.width = Math.round(w * dpr); cv.height = Math.round(hgt * dpr);
      cv.style.height = hgt + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, hgt);
      ctx.direction = "ltr";
      ctx.lineJoin = "round";

      /* ---- how far the sweep has got ---- */
      var frac = sweep ? Math.max(0.001, sS.value / 1000) : 1,
          swU = sweep && sweep.over === "u", swV = sweep && sweep.over === "v",
          uEnd = swU ? u0 + frac * (u1 - u0) : u1,
          vEnd = swV ? v0 + frac * (v1 - v0) : v1;

      /* ---- sample the grid once; everything below reuses it ---- */
      var G = [], i, j, uu, vv;
      for (i = 0; i <= NU; i++) {
        G.push([]);
        uu = u0 + (i / NU) * (uEnd - u0);
        for (j = 0; j <= NV; j++) {
          vv = v0 + (j / NV) * (vEnd - v0);
          G[i].push(project(f(uu, vv)));
        }
      }

      /* ---- fit the view on the WHOLE surface, not just the swept part, so the
         picture does not rescale under the slider and the growth stays legible ---- */
      var xs = [], ys = [], q;
      for (i = 0; i <= NU; i += 2) for (j = 0; j <= NV; j += 2) {
        q = project(f(u0 + (i / NU) * (u1 - u0), v0 + (j / NV) * (v1 - v0)));
        xs.push(q[0]); ys.push(q[1]);
      }
      var xmin = Math.min.apply(null, xs), xmax = Math.max.apply(null, xs),
          ymin = Math.min.apply(null, ys), ymax = Math.max.apply(null, ys),
          pad = 1.12,
          sc = Math.min(w / ((xmax - xmin) * pad || 1), hgt / ((ymax - ymin) * pad || 1)),
          cx = w / 2 - sc * (xmin + xmax) / 2,
          cy = hgt / 2 + sc * (ymin + ymax) / 2;

      function S(q) { return [cx + sc * q[0], cy - sc * q[1]]; }

      /* ---- surface, painter's algorithm ---- */
      var quads = [];
      for (i = 0; i < NU; i++) for (j = 0; j < NV; j++) {
        var a = G[i][j], b = G[i + 1][j], c = G[i + 1][j + 1], d = G[i][j + 1];
        quads.push({ z: (a[2] + b[2] + c[2] + d[2]) / 4, p: [a, b, c, d] });
      }
      quads.sort(function (p, q) { return p.z - q.z; });
      ctx.lineWidth = 0.5;
      quads.forEach(function (Q) {
        ctx.beginPath();
        var s0 = S(Q.p[0]); ctx.moveTo(s0[0], s0[1]);
        for (var k = 1; k < 4; k++) { var sk = S(Q.p[k]); ctx.lineTo(sk[0], sk[1]); }
        ctx.closePath();
        ctx.fillStyle = COL.surf; ctx.fill();
        ctx.strokeStyle = COL.edge; ctx.stroke();
      });

      /* ---- highlighted coordinate curves ---- */
      function polyline(pts, col, lw) {
        ctx.beginPath();
        pts.forEach(function (q, k) {
          var s = S(q);
          if (k === 0) ctx.moveTo(s[0], s[1]); else ctx.lineTo(s[0], s[1]);
        });
        ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke();
      }

      /* under a sweep, only the curves already swept past are drawn */
      (cfg.vCurves || []).forEach(function (uAt) {
        if (swU && uAt > uEnd) return;
        var pts = [], k;
        for (k = 0; k <= NV; k++) pts.push(project(f(uAt, v0 + (k / NV) * (vEnd - v0))));
        polyline(pts, COL.v, 1.6);
      });
      (cfg.uCurves || []).forEach(function (vAt) {
        if (swV && vAt > vEnd) return;
        var pts = [], k;
        for (k = 0; k <= NU; k++) pts.push(project(f(u0 + (k / NU) * (uEnd - u0), vAt)));
        polyline(pts, COL.u, 1.6);
      });

      /* ---- the moving generator: the line (or profile curve) that sweeps the
         surface out. This is the whole point of the sweep mode, so it is drawn
         last, thick, and on top of everything else. ---- */
      if (sweep) {
        var gen = [], k, N = sweep.over === "u" ? NV : NU;
        for (k = 0; k <= N; k++) {
          gen.push(swU ? project(f(uEnd, v0 + (k / N) * (v1 - v0)))
                       : project(f(u0 + (k / N) * (u1 - u0), vEnd)));
        }
        /* a soft halo first so the generator reads against the shaded surface */
        polyline(gen, "rgba(255,255,255,0.85)", 6.0);
        polyline(gen, COL.tan, 3.2);

        /* the base point it is anchored at, i.e. alpha(u) for a ruled surface */
        if (sweep.base) {
          var bp = swU ? f(uEnd, sweep.base) : f(sweep.base, vEnd),
              sb = S(project(bp));
          ctx.beginPath(); ctx.arc(sb[0], sb[1], 4.5, 0, 2 * Math.PI);
          ctx.fillStyle = COL.pt; ctx.fill();
          /* and the path that base point has traced so far */
          var trail = [], m;
          for (m = 0; m <= 90; m++) {
            var tt = (m / 90);
            trail.push(swU ? project(f(u0 + tt * (uEnd - u0), sweep.base))
                           : project(f(sweep.base, v0 + tt * (vEnd - v0))));
          }
          polyline(trail, COL.pt, 1.8);
        }
        sval.textContent = fmt(swU ? uEnd : vEnd);
      }

      /* ---- tangent plane + the basis that spans it ---- */
      if (showTan) {
        var P = f(uSel, vSel), A = xu(uSel, vSel), B = xv(uSel, vSel),
            g11 = dot(A, A), g12 = dot(A, B), g22 = dot(B, B);

        /* patch of the tangent plane, drawn from the SAME two vectors so that
           what the reader sees really is span{x_u, x_v} and not a stand-in */
        var ea = mul(A, 1 / (norm(A) || 1)), eb0 = sub(B, mul(ea, dot(B, ea))),
            eb = mul(eb0, 1 / (norm(eb0) || 1)),
            R = cfg.tangent.size || 0.85;
        ctx.beginPath();
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (sg, k) {
          var q = S(project(add(P, add(mul(ea, R * sg[0]), mul(eb, R * sg[1])))));
          if (k === 0) ctx.moveTo(q[0], q[1]); else ctx.lineTo(q[0], q[1]);
        });
        ctx.closePath();
        ctx.fillStyle = "rgba(124,58,237,0.18)"; ctx.fill();
        ctx.strokeStyle = COL.tan; ctx.lineWidth = 1.4; ctx.stroke();

        function arrow(vec, col, lab) {
          var L = cfg.tangent.arrow || 0.7, tip = add(P, mul(vec, L / (norm(vec) || 1)));
          var s1 = S(project(P)), s2 = S(project(tip));
          ctx.beginPath(); ctx.moveTo(s1[0], s1[1]); ctx.lineTo(s2[0], s2[1]);
          ctx.strokeStyle = col; ctx.lineWidth = 2.4; ctx.stroke();
          var ang = Math.atan2(s2[1] - s1[1], s2[0] - s1[0]);
          ctx.beginPath();
          ctx.moveTo(s2[0], s2[1]);
          ctx.lineTo(s2[0] - 8 * Math.cos(ang - 0.4), s2[1] - 8 * Math.sin(ang - 0.4));
          ctx.lineTo(s2[0] - 8 * Math.cos(ang + 0.4), s2[1] - 8 * Math.sin(ang + 0.4));
          ctx.closePath(); ctx.fillStyle = col; ctx.fill();
          ctx.font = "12px ui-sans-serif, system-ui, sans-serif";
          ctx.fillText(lab, s2[0] + 6, s2[1] - 4);
        }
        arrow(A, COL.u, "x_u");
        arrow(B, COL.v, "x_v");

        var sp = S(project(P));
        ctx.beginPath(); ctx.arc(sp[0], sp[1], 4, 0, 2 * Math.PI);
        ctx.fillStyle = COL.pt; ctx.fill();

        uval.textContent = fmt(uSel);
        vval.textContent = fmt(vSel);
        set("g11", fmt(g11)); set("g12", fmt(g12)); set("g22", fmt(g22));
      }

      if (sP) pval.textContent = fmt(pVal);
      if (cfg.onDraw) cfg.onDraw(host, pVal);
    }

    /* ---- drag to rotate ---- */
    var dragging = false, lastX = 0, lastY = 0;
    function down(e) {
      dragging = true;
      var t = e.touches ? e.touches[0] : e;
      lastX = t.clientX; lastY = t.clientY;
      if (e.touches) e.preventDefault();
    }
    function move(e) {
      if (!dragging) return;
      var t = e.touches ? e.touches[0] : e;
      yaw += (t.clientX - lastX) * 0.008;
      pitch += (t.clientY - lastY) * 0.006;
      pitch = Math.max(-1.35, Math.min(1.35, pitch));
      lastX = t.clientX; lastY = t.clientY;
      draw();
      if (e.touches) e.preventDefault();
    }
    function up() { dragging = false; }

    cv.addEventListener("mousedown", down);
    global.addEventListener("mousemove", move);
    global.addEventListener("mouseup", up);
    cv.addEventListener("touchstart", down, { passive: false });
    cv.addEventListener("touchmove", move, { passive: false });
    global.addEventListener("touchend", up);

    [sU, sV, sP, sS].forEach(function (s) { if (s) s.addEventListener("input", draw); });
    global.addEventListener("resize", draw);

    draw();
    /* the iframe has no idea how tall it should be; tell the host page */
    function report() {
      var h = document.documentElement.scrollHeight;
      if (global.parent) global.parent.postMessage({ type: "widget-height", height: h }, "*");
    }
    global.addEventListener("load", report);
    setTimeout(report, 60);
  }

  global.Surface3D = { mount: mount };
})(window);
