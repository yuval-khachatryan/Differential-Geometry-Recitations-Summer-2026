/* linalg.js — the small amount of linear algebra the visualisers need.
   Deliberately mirrors the tirgul's own algorithm: the widgets are handed the
   raw (A, b, c) of the exercise and rediscover the canonical form themselves,
   so a figure can never drift out of step with the worked solution. */
(function (global) {
  "use strict";

  function zeros(n, m) {
    var r = [], i, j;
    for (i = 0; i < n; i++) { r.push([]); for (j = 0; j < m; j++) r[i].push(0); }
    return r;
  }
  function identity(n) {
    var I = zeros(n, n), i;
    for (i = 0; i < n; i++) I[i][i] = 1;
    return I;
  }
  function matVec(M, v) {
    var n = M.length, m = v.length, out = [], i, j, s;
    for (i = 0; i < n; i++) { s = 0; for (j = 0; j < m; j++) s += M[i][j] * v[j]; out.push(s); }
    return out;
  }
  function transpose(M) {
    var n = M.length, m = M[0].length, T = zeros(m, n), i, j;
    for (i = 0; i < n; i++) for (j = 0; j < m; j++) T[j][i] = M[i][j];
    return T;
  }
  function det(M) {
    var n = M.length;
    if (n === 2) return M[0][0] * M[1][1] - M[0][1] * M[1][0];
    return M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1])
         - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0])
         + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
  }

  /* Cyclic Jacobi rotation for real symmetric matrices. Returns eigenvalues and
     an orthonormal eigenbasis as the COLUMNS of `vectors` — i.e. exactly the P
     of the tirgul, satisfying P^t A P = diag(values). */
  function eigSym(Ain) {
    var n = Ain.length,
        A = Ain.map(function (r) { return r.slice(); }),
        V = identity(n),
        sweep, p, q, k, off, theta, sgn, t, c, s, akp, akq, apk, aqk, vkp, vkq;

    for (sweep = 0; sweep < 100; sweep++) {
      off = 0;
      for (p = 0; p < n; p++) for (q = p + 1; q < n; q++) off += A[p][q] * A[p][q];
      if (off < 1e-22) break;
      for (p = 0; p < n; p++) for (q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-18) continue;
        theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        sgn = theta >= 0 ? 1 : -1;
        t = sgn / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        c = 1 / Math.sqrt(t * t + 1);
        s = t * c;
        for (k = 0; k < n; k++) { akp = A[k][p]; akq = A[k][q]; A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq; }
        for (k = 0; k < n; k++) { apk = A[p][k]; aqk = A[q][k]; A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk; }
        for (k = 0; k < n; k++) { vkp = V[k][p]; vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
      }
    }
    return { values: A.map(function (r, i) { return r[i]; }), vectors: V };
  }

  /* Force det = +1 by flipping one column, so the change of basis is a pure
     rotation and can be animated continuously from the identity. Which column
     is flipped is irrelevant to the geometry: -q is an eigenvector whenever q
     is, and the widget derives the canonical form AFTER this adjustment. */
  function makeProper(V, values) {
    if (det(V) >= 0) return { vectors: V, values: values };
    var W = V.map(function (r) { return r.slice(); }), i, last = V.length - 1;
    for (i = 0; i < V.length; i++) W[i][last] = -W[i][last];
    return { vectors: W, values: values.slice() };
  }

  /* Rigid motion interpolation: R(t) rotates by t of the full angle, so t = 0
     is the canonical frame and t = 1 the original one. */
  function rot2(theta) {
    var c = Math.cos(theta), s = Math.sin(theta);
    return [[c, -s], [s, c]];
  }
  function angle2(P) { return Math.atan2(P[1][0], P[0][0]); }

  function axisAngle3(R) {
    var tr = R[0][0] + R[1][1] + R[2][2],
        cosA = Math.max(-1, Math.min(1, (tr - 1) / 2)),
        a = Math.acos(cosA),
        s = Math.sin(a), ax;
    if (Math.abs(s) < 1e-8) {
      if (a < 1e-8) return { axis: [0, 0, 1], angle: 0 };   // identity
      // angle = pi: axis from the largest diagonal entry of (R + I)/2
      var d = [(R[0][0] + 1) / 2, (R[1][1] + 1) / 2, (R[2][2] + 1) / 2],
          i = d[0] > d[1] ? (d[0] > d[2] ? 0 : 2) : (d[1] > d[2] ? 1 : 2);
      ax = [0, 0, 0];
      ax[i] = Math.sqrt(Math.max(0, d[i]));
      for (var j = 0; j < 3; j++) if (j !== i) ax[j] = (R[i][j] + R[j][i]) / (4 * ax[i]);
      return { axis: normalize3(ax), angle: Math.PI };
    }
    ax = [(R[2][1] - R[1][2]) / (2 * s), (R[0][2] - R[2][0]) / (2 * s), (R[1][0] - R[0][1]) / (2 * s)];
    return { axis: normalize3(ax), angle: a };
  }
  function normalize3(v) {
    var n = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1;
    return [v[0] / n, v[1] / n, v[2] / n];
  }
  /* Rodrigues */
  function rot3(axis, ang) {
    var x = axis[0], y = axis[1], z = axis[2],
        c = Math.cos(ang), s = Math.sin(ang), C = 1 - c;
    return [
      [c + x * x * C,     x * y * C - z * s, x * z * C + y * s],
      [y * x * C + z * s, c + y * y * C,     y * z * C - x * s],
      [z * x * C - y * s, z * y * C + x * s, c + z * z * C]
    ];
  }
  function rotX(a) { var c = Math.cos(a), s = Math.sin(a); return [[1, 0, 0], [0, c, -s], [0, s, c]]; }
  function rotY(a) { var c = Math.cos(a), s = Math.sin(a); return [[c, 0, s], [0, 1, 0], [-s, 0, c]]; }
  function matMul(A, B) {
    var n = A.length, m = B[0].length, p = B.length, C = zeros(n, m), i, j, k, s;
    for (i = 0; i < n; i++) for (j = 0; j < m; j++) { s = 0; for (k = 0; k < p; k++) s += A[i][k] * B[k][j]; C[i][j] = s; }
    return C;
  }

  /* Diagonalise, then complete the square in every direction with a nonzero
     eigenvalue. Returns the canonical data the plotters need:
       lam    - eigenvalues (in the order of P's columns)
       beta   - P^t b
       u0     - centre/vertex in the rotated frame
       k      - the constant that lands on the right-hand side
       linIdx - index of the direction that kept a linear term (-1 if none)
       mu     - its coefficient, i.e. equation is  sum lam_i U_i^2 = k + mu*U_linIdx */
  /* An m x m orthogonal matrix whose FIRST COLUMN is the given unit vector,
     the rest completed by Gram-Schmidt against the standard basis. */
  function orthoBasisFrom(u) {
    var m = u.length, cols = [u.slice()], k, i, j, w, d, nrm, Q = [], r;
    for (k = 0; k < m && cols.length < m; k++) {
      w = [];
      for (i = 0; i < m; i++) w.push(i === k ? 1 : 0);
      for (j = 0; j < cols.length; j++) {
        d = 0;
        for (i = 0; i < m; i++) d += cols[j][i] * w[i];
        for (i = 0; i < m; i++) w[i] -= d * cols[j][i];
      }
      nrm = 0;
      for (i = 0; i < m; i++) nrm += w[i] * w[i];
      nrm = Math.sqrt(nrm);
      if (nrm > 1e-8) {
        for (i = 0; i < m; i++) w[i] /= nrm;
        cols.push(w);
      }
    }
    for (r = 0; r < m; r++) { Q.push([]); for (j = 0; j < m; j++) Q[r].push(cols[j][r]); }
    return Q;
  }

  function canonical(A, b, c) {
    var raw = eigSym(A),
        e = makeProper(raw.vectors, raw.values),
        P = e.vectors, lam = e.values,
        beta = matVec(transpose(P), b),
        n = lam.length, u0 = [], k = -c, linIdx = -1, mu = 0, i, j, r,
        TOL = 1e-9;

    /* Gather the linear terms that live in ker A into ONE coordinate.
       More than one zero-eigenvalue direction may carry a linear term — say
       a*x^2 = b*y + c*z. Rotating INSIDE ker A collects them; it cannot touch
       the quadratic part, because A vanishes there. Without this the loop below
       would keep only the last such term and silently drop the others. */
    var z = [], hits = 0;
    for (i = 0; i < n; i++) if (Math.abs(lam[i]) <= TOL) z.push(i);
    for (i = 0; i < z.length; i++) if (Math.abs(beta[z[i]]) > TOL) hits++;
    if (z.length > 1 && hits > 1) {
      var m = z.length, v = [], rho = 0, Q, cols;
      for (i = 0; i < m; i++) { v.push(beta[z[i]]); rho += beta[z[i]] * beta[z[i]]; }
      rho = Math.sqrt(rho);
      for (i = 0; i < m; i++) v[i] /= rho;
      Q = orthoBasisFrom(v);
      /* keep the whole change of basis a rotation: flipping a later kernel
         column is free, since its linear coefficient is zero anyway */
      if (det(Q) < 0) for (i = 0; i < m; i++) Q[i][m - 1] = -Q[i][m - 1];
      cols = [];
      for (j = 0; j < m; j++) {
        cols.push([]);
        for (r = 0; r < n; r++) {
          var s = 0;
          for (i = 0; i < m; i++) s += Q[i][j] * P[r][z[i]];
          cols[j].push(s);
        }
      }
      for (j = 0; j < m; j++) for (r = 0; r < n; r++) P[r][z[j]] = cols[j][r];
      beta = matVec(transpose(P), b);      // recompute rather than track signs
    }

    for (i = 0; i < n; i++) {
      if (Math.abs(lam[i]) > 1e-9) {
        u0.push(-beta[i] / (2 * lam[i]));
        k += beta[i] * beta[i] / (4 * lam[i]);
      } else {
        u0.push(0);
        if (Math.abs(beta[i]) > 1e-9) { linIdx = i; mu = -beta[i]; }
      }
    }
    /* A leftover linear term can absorb the constant: shift that variable too. */
    if (linIdx >= 0 && Math.abs(k) > 1e-12) { u0[linIdx] = -k / mu; k = 0; }
    return { P: P, lam: lam, beta: beta, u0: u0, k: k, linIdx: linIdx, mu: mu };
  }

  /* ---- small formatting helpers shared by the two plotters ---- */
  function f3(v) {
    var s = (Math.round(v * 1000) / 1000).toFixed(3);
    return s === "-0.000" ? "0.000" : s;
  }
  function vecText(v) { return "= (" + v.map(f3).join(", ") + ")"; }
  /* short tick label: 2, -1.5, 0.25 — never 1.0000000000000002 */
  function fmtNum(v) {
    var s = (Math.round(v * 1000) / 1000).toString();
    return s === "-0" ? "0" : s;
  }
  function col(M, d) {
    var out = [], i;
    for (i = 0; i < M.length; i++) out.push(M[i][d]);
    return out;
  }
  /* Empty skeleton for the live readout; draw() fills the .qv-dN / .qv-dc spans
     every frame, so the numbers track the animation instead of showing only the
     final answer. */
  function dirsSkeleton(names) {
    var rows = names.map(function (nm, d) {
      return '<span><b>' + nm + '</b>&nbsp;<span dir="ltr" class="qv-d' + d + '"></span></span>';
    });
    rows.push('<span><b>ראשית</b>&nbsp;<span dir="ltr" class="qv-dc"></span></span>');
    return rows.join("");
  }

  global.LinAlg = {
    f3: f3, vecText: vecText, fmtNum: fmtNum, col: col, dirsSkeleton: dirsSkeleton,
    zeros: zeros, identity: identity, matVec: matVec, transpose: transpose,
    det: det, matMul: matMul, eigSym: eigSym, makeProper: makeProper,
    rot2: rot2, angle2: angle2, axisAngle3: axisAngle3, rot3: rot3,
    rotX: rotX, rotY: rotY, normalize3: normalize3, canonical: canonical
  };
})(this);
