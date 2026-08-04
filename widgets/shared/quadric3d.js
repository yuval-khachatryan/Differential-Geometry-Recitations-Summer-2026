/* quadric3d.js — the ℝ³ counterpart of conic2d.js. Same idea: the widget is
   handed the raw (A, b, c), runs the tirgul's algorithm itself, builds a
   wireframe of the resulting surface in canonical coordinates, and moves it
   into place with a genuine rigid motion. Drag the picture to rotate the view. */
(function (global) {
  "use strict";
  var L = global.LinAlg;

  var COL = {
    mesh:  "rgba(31,78,121,0.55)",
    mesh2: "rgba(192,57,43,0.55)",
    axis:  "#94a3b8",
    prin:  "#1f4e79",
    centre:"#16a34a"
  };

  function classify(can) {
    var l = can.lam, k = can.k, li = can.linIdx,
        nz = l.filter(function (v) { return Math.abs(v) > 1e-9; }),
        pos = l.filter(function (v) { return v > 1e-9; }).length,
        neg = l.filter(function (v) { return v < -1e-9; }).length;

    if (nz.length === 3) {
      if (Math.abs(k) < 1e-12) return (pos === 3 || neg === 3) ? "point" : "cone";
      if (pos === 3) return k > 0 ? "ellipsoid" : "empty";
      if (neg === 3) return k < 0 ? "ellipsoid" : "empty";
      /* two of one sign, one of the other */
      var majSign = pos === 2 ? 1 : -1;
      return (k * majSign > 0) ? "hyper1" : "hyper2";
    }
    if (nz.length === 2 && li >= 0) return (pos === 2 || neg === 2) ? "paraboloid" : "hypparaboloid";
    if (nz.length === 2) return "cylinder";
    if (nz.length === 1) {
      /* only reachable once the linear terms in ker A have been gathered */
      if (li >= 0) return "parcylinder";
      if (Math.abs(k) < 1e-12) return "plane";
      return (k / nz[0] > 0) ? "planes" : "empty";
    }
    return "other";
  }

  var NAME = {
    ellipsoid: "אליפסואיד", hyper1: "היפרבולואיד חד-יריעתי",
    hyper2: "היפרבולואיד דו-יריעתי", cone: "חרוט אליפטי",
    paraboloid: "פרבולואיד אליפטי", hypparaboloid: "פרבולואיד היפרבולי",
    cylinder: "גליל", parcylinder: "גליל פרבולי",
    planes: "זוג מישורים מקבילים", plane: "מישור יחיד",
    point: "נקודה בודדת", empty: "קבוצה ריקה", other: "מקרה מנוון"
  };

  /* Wireframe as a list of polylines in canonical (U,V,W) coordinates. */
  function build(can, kind, R) {
    var l = can.lam, k = can.k, li = can.linIdx, mu = can.mu,
        out = [], NU = 24, NV = 40, i, j, s, th, seg;

    function order() {                       // indices: two "like" axes, one "odd"
      var pos = [], neg = [], zer = [], i2;
      for (i2 = 0; i2 < 3; i2++) {
        if (Math.abs(l[i2]) < 1e-9) zer.push(i2);
        else if (l[i2] > 0) pos.push(i2); else neg.push(i2);
      }
      return { pos: pos, neg: neg, zer: zer };
    }
    var o = order();

    function pt(ia, va, ib, vb, ic, vc) { var p = []; p[ia] = va; p[ib] = vb; p[ic] = vc; return p; }

    if (kind === "ellipsoid") {
      var a = [Math.sqrt(k / l[0]), Math.sqrt(k / l[1]), Math.sqrt(k / l[2])];
      for (i = 1; i < NU; i++) {             // parallels
        var ph = Math.PI * i / NU; seg = [];
        for (j = 0; j <= NV; j++) {
          th = 2 * Math.PI * j / NV;
          seg.push([a[0] * Math.sin(ph) * Math.cos(th), a[1] * Math.sin(ph) * Math.sin(th), a[2] * Math.cos(ph)]);
        }
        out.push(seg);
      }
      for (j = 0; j < NV; j += 2) {          // meridians
        th = 2 * Math.PI * j / NV; seg = [];
        for (i = 0; i <= NU; i++) {
          var ph2 = Math.PI * i / NU;
          seg.push([a[0] * Math.sin(ph2) * Math.cos(th), a[1] * Math.sin(ph2) * Math.sin(th), a[2] * Math.cos(ph2)]);
        }
        out.push(seg);
      }
    } else if (kind === "hyper1" || kind === "hyper2" || kind === "cone") {
      /* the "odd" axis is the one whose sign differs from the other two */
      var odd = (o.pos.length === 1) ? o.pos[0] : o.neg[0],
          rest = [0, 1, 2].filter(function (x) { return x !== odd; }),
          sheets, smax = 1.6, aa, bb, cc;

      if (kind === "cone") {
        /* sum over rest: l_r U_r^2 = -l_odd U_odd^2  -> radius grows linearly */
        aa = Math.sqrt(Math.abs(l[odd] / l[rest[0]]));
        bb = Math.sqrt(Math.abs(l[odd] / l[rest[1]]));
        var H = R * 0.75;
        for (i = -NU; i <= NU; i += 2) {     // rings
          var hh = H * i / NU; seg = [];
          for (j = 0; j <= NV; j++) {
            th = 2 * Math.PI * j / NV;
            seg.push(pt(rest[0], aa * hh * Math.cos(th), rest[1], bb * hh * Math.sin(th), odd, hh));
          }
          out.push(seg);
        }
        for (j = 0; j < NV; j += 3) {        // rulings
          th = 2 * Math.PI * j / NV;
          out.push([
            pt(rest[0], -aa * H * Math.cos(th), rest[1], -bb * H * Math.sin(th), odd, -H),
            pt(rest[0], aa * H * Math.cos(th), rest[1], bb * H * Math.sin(th), odd, H)
          ]);
        }
      } else if (kind === "hyper1") {
        aa = Math.sqrt(k / l[rest[0]]); bb = Math.sqrt(k / l[rest[1]]); cc = Math.sqrt(-k / l[odd]);
        for (i = -NU; i <= NU; i += 2) {
          s = smax * i / NU; seg = [];
          for (j = 0; j <= NV; j++) {
            th = 2 * Math.PI * j / NV;
            seg.push(pt(rest[0], aa * Math.cosh(s) * Math.cos(th), rest[1], bb * Math.cosh(s) * Math.sin(th), odd, cc * Math.sinh(s)));
          }
          out.push(seg);
        }
        for (j = 0; j < NV; j += 3) {
          th = 2 * Math.PI * j / NV; seg = [];
          for (i = -NU; i <= NU; i++) {
            s = smax * i / NU;
            seg.push(pt(rest[0], aa * Math.cosh(s) * Math.cos(th), rest[1], bb * Math.cosh(s) * Math.sin(th), odd, cc * Math.sinh(s)));
          }
          out.push(seg);
        }
      } else {                               // hyper2: two sheets along `odd`
        aa = Math.sqrt(-k / l[rest[0]]); bb = Math.sqrt(-k / l[rest[1]]); cc = Math.sqrt(k / l[odd]);
        for (sheets = -1; sheets <= 1; sheets += 2) {
          for (i = 0; i <= NU; i += 2) {
            s = smax * i / NU; seg = [];
            for (j = 0; j <= NV; j++) {
              th = 2 * Math.PI * j / NV;
              seg.push(pt(rest[0], aa * Math.sinh(s) * Math.cos(th), rest[1], bb * Math.sinh(s) * Math.sin(th), odd, sheets * cc * Math.cosh(s)));
            }
            out.push(seg);
          }
        }
      }
    } else if (kind === "paraboloid" || kind === "hypparaboloid") {
      var zi = li, ri = [0, 1, 2].filter(function (x) { return x !== zi; }),
          Hm = R * 0.8;
      /* l[r0] U^2 + l[r1] V^2 = mu * W  */
      if (kind === "paraboloid") {
        var A0 = Math.abs(mu / l[ri[0]]), A1 = Math.abs(mu / l[ri[1]]),
            rmax = Math.sqrt(Hm);
        for (i = 1; i <= NU; i += 1) {
          var rr = rmax * i / NU; seg = [];
          for (j = 0; j <= NV; j++) {
            th = 2 * Math.PI * j / NV;
            var U = Math.sqrt(A0) * rr * Math.cos(th), V = Math.sqrt(A1) * rr * Math.sin(th);
            seg.push(pt(ri[0], U, ri[1], V, zi, (l[ri[0]] * U * U + l[ri[1]] * V * V) / mu));
          }
          out.push(seg);
        }
        for (j = 0; j < NV; j += 3) {
          th = 2 * Math.PI * j / NV; seg = [];
          for (i = 0; i <= NU; i++) {
            var rr2 = rmax * i / NU,
                U2 = Math.sqrt(A0) * rr2 * Math.cos(th), V2 = Math.sqrt(A1) * rr2 * Math.sin(th);
            seg.push(pt(ri[0], U2, ri[1], V2, zi, (l[ri[0]] * U2 * U2 + l[ri[1]] * V2 * V2) / mu));
          }
          out.push(seg);
        }
      } else {
        var ext = Math.sqrt(Hm);
        for (i = 0; i <= NU; i += 1) {
          var uu = -ext + 2 * ext * i / NU; seg = [];
          for (j = 0; j <= NU; j++) {
            var vv = -ext + 2 * ext * j / NU;
            seg.push(pt(ri[0], uu, ri[1], vv, zi, (l[ri[0]] * uu * uu + l[ri[1]] * vv * vv) / mu));
          }
          out.push(seg);
        }
        for (j = 0; j <= NU; j += 1) {
          var vv2 = -ext + 2 * ext * j / NU; seg = [];
          for (i = 0; i <= NU; i++) {
            var uu2 = -ext + 2 * ext * i / NU;
            seg.push(pt(ri[0], uu2, ri[1], vv2, zi, (l[ri[0]] * uu2 * uu2 + l[ri[1]] * vv2 * vv2) / mu));
          }
          out.push(seg);
        }
      }
    } else if (kind === "parcylinder") {
      /* l[q] U_q^2 = mu * U_li , free along the remaining kernel direction */
      var qi = -1, fi = -1;
      for (i = 0; i < 3; i++) {
        if (Math.abs(l[i]) > 1e-9) qi = i;
        else if (i !== li) fi = i;
      }
      var umx = Math.sqrt(Math.abs(2.2 * R * mu / l[qi])) || R, Hp = R * 0.8;
      for (i = -3; i <= 3; i++) {                 // parabola cross-sections
        var fv = Hp * i / 3; seg = [];
        for (j = 0; j <= NV; j++) {
          var uu = -umx + 2 * umx * j / NV, pp = [];
          pp[qi] = uu; pp[li] = l[qi] * uu * uu / mu; pp[fi] = fv;
          seg.push(pp);
        }
        out.push(seg);
      }
      for (j = 0; j <= 10; j++) {                 // rulings
        var ur = -umx + 2 * umx * j / 10, r1 = [], r2 = [];
        r1[qi] = ur; r1[li] = l[qi] * ur * ur / mu; r1[fi] = -Hp;
        r2[qi] = ur; r2[li] = l[qi] * ur * ur / mu; r2[fi] = Hp;
        out.push([r1, r2]);
      }
    } else if (kind === "planes" || kind === "plane") {
      var pi2 = -1;
      for (i = 0; i < 3; i++) if (Math.abs(l[i]) > 1e-9) pi2 = i;
      var rs = [0, 1, 2].filter(function (x) { return x !== pi2; }),
          dd = Math.sqrt(Math.max(0, k / l[pi2])), Hq = R * 0.8, sg;
      for (sg = -1; sg <= 1; sg += 2) {
        for (i = -3; i <= 3; i++) {
          var g1 = [], g2 = [], h1 = [], h2 = [];
          g1[pi2] = sg * dd; g1[rs[0]] = Hq * i / 3; g1[rs[1]] = -Hq;
          g2[pi2] = sg * dd; g2[rs[0]] = Hq * i / 3; g2[rs[1]] = Hq;
          h1[pi2] = sg * dd; h1[rs[1]] = Hq * i / 3; h1[rs[0]] = -Hq;
          h2[pi2] = sg * dd; h2[rs[1]] = Hq * i / 3; h2[rs[0]] = Hq;
          out.push([g1, g2]); out.push([h1, h2]);
        }
        if (dd < 1e-12) break;                    // a single plane, not a pair
      }
    } else if (kind === "cylinder") {
      var czi = o.zer[0], cri = [0, 1, 2].filter(function (x) { return x !== czi; }),
          ca = Math.sqrt(Math.abs(k / l[cri[0]])), cb = Math.sqrt(Math.abs(k / l[cri[1]])),
          Hc = R * 0.8;
      for (i = -4; i <= 4; i++) {
        seg = [];
        for (j = 0; j <= NV; j++) {
          th = 2 * Math.PI * j / NV;
          seg.push(pt(cri[0], ca * Math.cos(th), cri[1], cb * Math.sin(th), czi, Hc * i / 4));
        }
        out.push(seg);
      }
    }
    return out;
  }

  function mount(cfg) {
    var can = L.canonical(cfg.A, cfg.b, cfg.c),
        kind = classify(can),
        P = can.P,
        aa = L.axisAngle3(P),
        centre = L.matVec(P, can.u0),
        host = document.getElementById(cfg.mount || "app");

    var reach = 0, i;
    for (i = 0; i < 3; i++) {
      if (Math.abs(can.lam[i]) > 1e-9 && Math.abs(can.k) > 1e-12)
        reach = Math.max(reach, Math.sqrt(Math.abs(can.k / can.lam[i])));
    }
    var R = 1.7 * (Math.max(Math.abs(centre[0]), Math.abs(centre[1]), Math.abs(centre[2])) + Math.max(reach, 1.4));
    var polys = build(can, kind, R);

    host.innerHTML =
      '<div class="qv">' +
        (cfg.title ? '<p class="qv-title">' + cfg.title + '</p>' : '') +
        '<div class="qv-canvas-wrap"><canvas class="qv-canvas qv-grab"></canvas></div>' +
        '<div class="qv-row">' +
          '<span class="qv-label">מיקום קנוני ← מקורי</span>' +
          '<input class="qv-slider" type="range" min="0" max="1000" value="1000">' +
          '<button class="qv-btn qv-play" type="button">הפעל</button>' +
        '</div>' +
        '<div class="qv-class">' + (NAME[kind] || kind) + '</div>' +
        '<div class="qv-dirs">' + L.dirsSkeleton(["U", "V", "W"]) + '</div>' +
        '<div class="qv-legend">' +
          '<span><i class="qv-key" style="background:#1f4e79"></i>המשטח</span>' +
          '<span><i class="qv-key" style="background:' + COL.centre + '"></i>' + (kind === "paraboloid" || kind === "cone" ? "קדקוד" : "מרכז") + '</span>' +
          '<span><i class="qv-key" style="background:' + COL.axis + '"></i>הצירים המקוריים</span>' +
        '</div>' +
        '<div class="qv-hint">גררו את הציור כדי לסובב את נקודת המבט; גררו את המחוון כדי להזיז את המשטח בין הצורה הקנונית למקומה המקורי.</div>' +
      '</div>';

    var cv = host.querySelector("canvas"),
        ctx = cv.getContext("2d"),
        slider = host.querySelector(".qv-slider"),
        play = host.querySelector(".qv-play"),
        dEls = [host.querySelector(".qv-d0"), host.querySelector(".qv-d1"), host.querySelector(".qv-d2")],
        dcEl = host.querySelector(".qv-dc"),
        yaw = -0.6, pitch = 0.45, timer = null;

    function place(p, t) {
      var Rt = L.rot3(aa.axis, t * aa.angle),
          q = L.matVec(Rt, p);
      return [q[0] + t * centre[0], q[1] + t * centre[1], q[2] + t * centre[2]];
    }
    function view() { return L.matMul(L.rotX(pitch), L.rotY(yaw)); }

    function draw() {
      var t = slider.value / 1000,
          dpr = global.devicePixelRatio || 1,
          w = cv.clientWidth || 520,
          h = Math.round(w * 0.78),
          V = view();
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      cv.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      var pad = 10,
          sc = Math.min((w - 2 * pad) / (2.3 * R), (h - 2 * pad) / (2.3 * R)),
          cx = w / 2, cy = h / 2;
      function proj(p) {
        var q = L.matVec(V, p);
        return [cx + q[0] * sc, cy - q[1] * sc];    // orthographic; q[2] is depth
      }

      /* original axes, with their names at the positive ends */
      ctx.strokeStyle = COL.axis; ctx.lineWidth = 1.3;
      ctx.direction = "ltr";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      [[R, 0, 0], [0, R, 0], [0, 0, R]].forEach(function (e, ei) {
        var a1 = proj([-e[0], -e[1], -e[2]]), a2 = proj(e);
        ctx.beginPath(); ctx.moveTo(a1[0], a1[1]); ctx.lineTo(a2[0], a2[1]); ctx.stroke();
        var lp = proj([e[0] * 1.07, e[1] * 1.07, e[2] * 1.07]);
        ctx.fillStyle = "#475569"; ctx.font = "bold 13px Arial, sans-serif";
        ctx.fillText("xyz".charAt(ei), lp[0], lp[1]);
      });

      /* notches at regular positions along x, y and z. Each is a small cross in
         the two directions perpendicular to its axis, so it stays legible from
         whatever angle the view has been dragged to. */
      var tstep = Math.pow(10, Math.round(Math.log(R / 4) / Math.LN10));
      if (R / tstep > 12) tstep *= 2;
      var nlen = R * 0.022, ax, gv, o2, base, n1, n2, s1, s2;
      ctx.strokeStyle = COL.axis; ctx.lineWidth = 1.1;
      ctx.fillStyle = COL.axis; ctx.font = "10px Arial, sans-serif";

      /* Put the number on whichever perpendicular direction currently points
         most steeply DOWN on screen, so labels sit under the axis from any
         viewing angle instead of landing on top of the mesh. */
      function labelOffset(p) {
        var best = null, bestDy = -Infinity, o3, probe, sp = proj(p), sq;
        for (o3 = 0; o3 < 3; o3++) {
          probe = p.slice(); probe[o3] += nlen * 3.2;
          sq = proj(probe);
          if (sq[1] - sp[1] > bestDy) { bestDy = sq[1] - sp[1]; best = sq; }
          probe = p.slice(); probe[o3] -= nlen * 3.2;
          sq = proj(probe);
          if (sq[1] - sp[1] > bestDy) { bestDy = sq[1] - sp[1]; best = sq; }
        }
        return best;
      }

      for (ax = 0; ax < 3; ax++) {
        for (gv = -Math.floor(R / tstep) * tstep; gv <= R; gv += tstep) {
          if (Math.abs(gv) < tstep / 2) continue;
          base = [0, 0, 0]; base[ax] = gv;
          for (o2 = 0; o2 < 3; o2++) {
            if (o2 === ax) continue;
            n1 = base.slice(); n2 = base.slice();
            n1[o2] = -nlen; n2[o2] = nlen;
            s1 = proj(n1); s2 = proj(n2);
            ctx.beginPath(); ctx.moveTo(s1[0], s1[1]); ctx.lineTo(s2[0], s2[1]); ctx.stroke();
          }
          var lo = labelOffset(base);
          ctx.fillText(L.fmtNum(gv), lo[0], lo[1]);
        }
      }
      /* a single 0 at the origin — one per axis would just overprint */
      var z0 = labelOffset([0, 0, 0]);
      ctx.fillText("0", z0[0], z0[1]);

      /* the surface */
      ctx.lineWidth = 1.1;
      ctx.strokeStyle = COL.mesh;
      polys.forEach(function (seg) {
        ctx.beginPath();
        seg.forEach(function (p, i2) {
          var s2 = proj(place(p, t));
          if (i2 === 0) ctx.moveTo(s2[0], s2[1]); else ctx.lineTo(s2[0], s2[1]);
        });
        ctx.stroke();
      });

      /* principal directions through the moving centre */
      var c0 = [t * centre[0], t * centre[1], t * centre[2]],
          Rt = L.rot3(aa.axis, t * aa.angle);
      ctx.strokeStyle = COL.prin; ctx.lineWidth = 1.5; ctx.setLineDash([6, 5]);
      for (var d = 0; d < 3; d++) {
        var dir = [Rt[0][d], Rt[1][d], Rt[2][d]],
            p1 = proj([c0[0] - dir[0] * R * 0.55, c0[1] - dir[1] * R * 0.55, c0[2] - dir[2] * R * 0.55]),
            p2 = proj([c0[0] + dir[0] * R * 0.55, c0[1] + dir[1] * R * 0.55, c0[2] + dir[2] * R * 0.55]);
        ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke();
      }
      ctx.setLineDash([]);

      /* names of the rotating principal axes */
      ctx.fillStyle = COL.prin; ctx.font = "bold 13px Arial, sans-serif";
      for (var d3 = 0; d3 < 3; d3++) {
        var dr = [Rt[0][d3], Rt[1][d3], Rt[2][d3]], f = R * 0.62,
            lp3 = proj([c0[0] + dr[0] * f, c0[1] + dr[1] * f, c0[2] + dr[2] * f]);
        ctx.fillText("UVW".charAt(d3), lp3[0], lp3[1]);
      }

      /* live readout: the directions as they are *right now*, so the numbers
         travel from the standard basis to the eigenbasis along with the picture */
      for (var dr3 = 0; dr3 < 3; dr3++) dEls[dr3].textContent = L.vecText(L.col(Rt, dr3));
      dcEl.textContent = L.vecText(c0);

      /* dashed drop-lines locating the shifted origin against the x, y, z axes */
      ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      [[[c0[0], c0[1], c0[2]], [c0[0], c0[1], 0]],
       [[c0[0], c0[1], 0], [c0[0], 0, 0]],
       [[c0[0], c0[1], 0], [0, c0[1], 0]]].forEach(function (sg) {
        var q1 = proj(sg[0]), q2 = proj(sg[1]);
        ctx.beginPath(); ctx.moveTo(q1[0], q1[1]); ctx.lineTo(q2[0], q2[1]); ctx.stroke();
      });
      ctx.setLineDash([]);

      var cp = proj(c0);
      ctx.fillStyle = COL.centre;
      ctx.beginPath(); ctx.arc(cp[0], cp[1], 4.5, 0, 2 * Math.PI); ctx.fill();

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

    /* drag to rotate */
    var dragging = false, lx = 0, ly = 0;
    function down(e) {
      dragging = true; cv.classList.add("qv-grabbing");
      var p = e.touches ? e.touches[0] : e; lx = p.clientX; ly = p.clientY;
    }
    function move(e) {
      if (!dragging) return;
      var p = e.touches ? e.touches[0] : e;
      yaw += (p.clientX - lx) * 0.01;
      pitch += (p.clientY - ly) * 0.01;
      pitch = Math.max(-1.4, Math.min(1.4, pitch));
      lx = p.clientX; ly = p.clientY;
      if (e.cancelable) e.preventDefault();
      draw();
    }
    function up() { dragging = false; cv.classList.remove("qv-grabbing"); }
    cv.addEventListener("mousedown", down);
    global.addEventListener("mousemove", move);
    global.addEventListener("mouseup", up);
    cv.addEventListener("touchstart", down, { passive: true });
    cv.addEventListener("touchmove", move, { passive: false });
    cv.addEventListener("touchend", up);

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

  global.Quadric3D = { mount: mount, classify: classify, build: build, NAME: NAME };
})(this);
