/* reparam.js — one point, two addresses.

   A single point on the circle, shown together with the two parameter values
   that name it, one on each of two parameter intervals. Drag either handle and
   everything else follows, which is what a reparametrization is: a dictionary
   between two ways of addressing the same point.

   The sweep buttons are the part worth watching. Sweeping the natural parameter
   at a constant rate moves the point around the circle at a constant rate, and
   the other handle visibly speeds up and slows down. Sweeping the other
   parameter at a constant rate does the opposite: its handle is steady and the
   point on the circle accelerates.

   Each parametrization is supplied as a pair of mutually inverse maps between
   its parameter and the angle, so nothing here is specific to the circle beyond
   drawing it. */
(function (global) {
  "use strict";

  var COL = {
    circle: "#94a3b8",
    grid:   "#eef2f7",
    A:      "#1f4e79",
    B:      "#c0392b",
    pt:     "#0f172a",
    rail:   "#334155",
    tick:   "#cbd5e1"
  };

  function fmt(v, d) {
    var s = v.toFixed(d === undefined ? 3 : d);
    return /^-0(\.0*)?$/.test(s) ? s.slice(1) : s;
  }

  function mount(cfg) {
    var host = document.getElementById(cfg.mount || "app"),
        A = cfg.A, B = cfg.B,          /* {label, min, max, toAngle, fromAngle, speed} */
        TAU = 2 * Math.PI,
        angle = cfg.start === undefined ? 0.9 : cfg.start,
        drag = null, timer = null, sweeping = null;

    function row(lab, cls) {
      return '<div><span class="qv-rl">' + lab + '</span>' +
             '<span class="qv-rv ' + cls + '"></span></div>';
    }

    host.innerHTML =
      '<div class="qv">' +
        (cfg.title ? '<p class="qv-title">' + cfg.title + '</p>' : '') +
        '<canvas class="qv-canvas"></canvas>' +
        '<div class="qv-row">' +
          '<button class="qv-btn qv-sweep-a" type="button">' + (cfg.sweepA || 'סרוק לפי הפרמטר הראשון') + '</button>' +
          '<button class="qv-btn qv-sweep-b" type="button">' + (cfg.sweepB || 'סרוק לפי הפרמטר השני') + '</button>' +
          '<button class="qv-btn qv-stop" type="button">עצור</button>' +
        '</div>' +
        /* One quantity per line, value in a box. Everything here is symbols, no
           Hebrew, so the whole block runs left to right. */
        '<div class="qv-readout">' +
          row(B.label, 'qv-vB') +
          row(A.label, 'qv-vA') +
          row(A.tag + '(' + A.label + ') = ' + B.tag + '(' + B.label + ')', 'qv-pt') +
          row('|' + A.tag + "'(" + A.label + ')|', 'qv-sA') +
          row('|' + B.tag + "'(" + B.label + ')|', 'qv-sB') +
        '</div>' +
        '<div class="qv-hint">' + (cfg.hint || '') + '</div>' +
      '</div>';

    var cv = host.querySelector('canvas'), ctx = cv.getContext('2d'),
        out = {
          vA: host.querySelector('.qv-vA'), vB: host.querySelector('.qv-vB'),
          pt: host.querySelector('.qv-pt'),
          sA: host.querySelector('.qv-sA'), sB: host.querySelector('.qv-sB')
        };

    /* ---- geometry of the drawing, recomputed each frame so it survives resize ---- */
    var G = {};
    function layout(w) {
      var R = Math.min(w * 0.24, 118);
      G.R = R;
      G.cx = w / 2;
      G.cy = R + 22;
      G.x0 = 46;
      G.x1 = w - 46;
      G.yA = G.cy + R + 58;
      G.yB = G.yA + 52;
      G.h = G.yB + 40;
    }
    function railX(p, P) { return G.x0 + (G.x1 - G.x0) * (p - P.min) / (P.max - P.min); }
    function railP(x, P) {
      var f = (x - G.x0) / (G.x1 - G.x0);
      return P.min + Math.max(0, Math.min(1, f)) * (P.max - P.min);
    }

    function draw() {
      var dpr = global.devicePixelRatio || 1, w = cv.clientWidth || 520;
      layout(w);
      cv.width = Math.round(w * dpr); cv.height = Math.round(G.h * dpr);
      cv.style.height = G.h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, G.h);
      ctx.direction = 'ltr'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

      var px = G.cx + G.R * Math.cos(angle), py = G.cy - G.R * Math.sin(angle);

      ctx.strokeStyle = COL.circle; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.arc(G.cx, G.cy, G.R, 0, TAU); ctx.stroke();

      /* the two rails, with equally spaced ticks so the distortion is visible */
      [[A, G.yA, COL.A], [B, G.yB, COL.B]].forEach(function (r) {
        var P = r[0], y = r[1], col = r[2], i, x;
        ctx.strokeStyle = COL.tick; ctx.lineWidth = 1;
        for (i = 0; i <= 12; i++) {
          x = G.x0 + (G.x1 - G.x0) * i / 12;
          ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x, y + 5); ctx.stroke();
        }
        ctx.strokeStyle = COL.rail; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(G.x0, y); ctx.lineTo(G.x1, y); ctx.stroke();

        ctx.fillStyle = '#475569'; ctx.font = '11px Arial, sans-serif';
        ctx.fillText(P.loLabel, G.x0, y + 19);
        ctx.fillText(P.hiLabel, G.x1, y + 19);

        /* which curve this rail belongs to; the formulas live in the chapter text */
        ctx.fillStyle = col; ctx.font = 'bold 15px Arial, sans-serif';
        ctx.fillText(P.tag, G.x0 - 26, y);

        var p = P.fromAngle(angle), hx = railX(p, P);
        ctx.strokeStyle = col; ctx.lineWidth = 1.4; ctx.globalAlpha = 0.55;
        ctx.beginPath(); ctx.moveTo(hx, y); ctx.lineTo(px, py); ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(hx, y, 7, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(hx, y, 7, 0, TAU); ctx.stroke();
      });

      ctx.fillStyle = COL.pt;
      ctx.beginPath(); ctx.arc(px, py, 6, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(px, py, 6, 0, TAU); ctx.stroke();

      var pa = A.fromAngle(angle), pb = B.fromAngle(angle);
      out.vA.textContent = fmt(pa);
      out.vB.textContent = fmt(pb);
      out.pt.textContent = '(' + fmt(Math.cos(angle)) + ', ' + fmt(Math.sin(angle)) + ')';
      out.sA.textContent = fmt(A.speed(pa));
      out.sB.textContent = fmt(B.speed(pb));
    }

    /* ---- dragging: pick whichever rail the pointer is nearer ---- */
    function pos(ev) {
      var r = cv.getBoundingClientRect();
      return [ev.clientX - r.left, ev.clientY - r.top];
    }
    function pick(y) {
      if (Math.abs(y - G.yA) < 26) return A;
      if (Math.abs(y - G.yB) < 26) return B;
      return null;
    }
    function apply(P, x) {
      var p = railP(x, P), a = P.toAngle(p);
      angle = ((a % TAU) + TAU) % TAU;
      draw();
    }
    cv.addEventListener('pointerdown', function (ev) {
      var q = pos(ev), P = pick(q[1]);
      if (!P) return;
      stop(); drag = P; cv.setPointerCapture(ev.pointerId); apply(P, q[0]);
    });
    cv.addEventListener('pointermove', function (ev) {
      if (!drag) return;
      apply(drag, pos(ev)[0]);
    });
    ['pointerup', 'pointercancel'].forEach(function (e) {
      cv.addEventListener(e, function () { drag = null; });
    });

    /* ---- constant-rate sweeps ---- */
    function stop() {
      if (timer) { global.clearInterval(timer); timer = null; }
      sweeping = null;
    }
    function sweep(P) {
      stop();
      sweeping = P;
      var p = P.min, step = (P.max - P.min) / 260;
      timer = global.setInterval(function () {
        p += step;
        if (p > P.max) p = P.min;
        var a = P.toAngle(p);
        angle = ((a % TAU) + TAU) % TAU;
        draw();
      }, 16);
    }
    host.querySelector('.qv-sweep-a').addEventListener('click', function () { sweep(A); });
    host.querySelector('.qv-sweep-b').addEventListener('click', function () { sweep(B); });
    host.querySelector('.qv-stop').addEventListener('click', stop);
    global.addEventListener('resize', draw);

    if (global.MathRender) global.MathRender.typeset(host);
    draw();
  }

  global.Reparam = { mount: mount };
})(this);
