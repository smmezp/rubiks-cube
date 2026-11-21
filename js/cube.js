/* =========================================================
   Cube engine — sticker model, move parser and SVG renderers
   Coordinates: x → R, y → U, z → F. Each sticker has a position
   (cubie coords in {-1,0,1}) and a normal (the face it points to).
   ========================================================= */
(function (global) {
  'use strict';

  const COLORS = {
    U: '#ffd500', // amarelo
    D: '#ffffff', // branco
    F: '#0b5cff', // azul
    B: '#00a650', // verde
    R: '#e4002b', // vermelho
    L: '#ff7a00', // laranja
  };
  const GRAY = '#3a3f4b';
  const FACE_NORMALS = {
    U: [0, 1, 0], D: [0, -1, 0], F: [0, 0, 1],
    B: [0, 0, -1], R: [1, 0, 0], L: [-1, 0, 0],
  };

  function faceOfNormal(n) {
    for (const k in FACE_NORMALS) {
      const v = FACE_NORMALS[k];
      if (v[0] === n[0] && v[1] === n[1] && v[2] === n[2]) return k;
    }
    return null;
  }

  /* ---------- solved state ---------- */
  function solved() {
    const st = [];
    let id = 0;
    for (const f in FACE_NORMALS) {
      const n = FACE_NORMALS[f];
      for (let a = -1; a <= 1; a++) {
        for (let b = -1; b <= 1; b++) {
          let p;
          if (n[0]) p = [n[0], a, b];
          else if (n[1]) p = [a, n[1], b];
          else p = [a, b, n[2]];
          st.push({ id: id++, c: f, p: p.slice(), n: n.slice(), home: p.slice() });
        }
      }
    }
    return st;
  }
  function clone(st) {
    return st.map((s) => ({ id: s.id, c: s.c, p: s.p.slice(), n: s.n.slice(), home: s.home }));
  }

  /* ---------- moves ---------- */
  // [axis index, layer predicate, base sign (s) for a clockwise quarter]
  const AX = { x: 0, y: 1, z: 2 };
  const MOVE_DEFS = {
    R: ['x', (v) => v === 1, -1], L: ['x', (v) => v === -1, 1], M: ['x', (v) => v === 0, 1],
    r: ['x', (v) => v >= 0, -1], l: ['x', (v) => v <= 0, 1], x: ['x', () => true, -1],
    U: ['y', (v) => v === 1, -1], D: ['y', (v) => v === -1, 1], E: ['y', (v) => v === 0, 1],
    u: ['y', (v) => v >= 0, -1], d: ['y', (v) => v <= 0, 1], y: ['y', () => true, -1],
    F: ['z', (v) => v === 1, -1], B: ['z', (v) => v === -1, 1], S: ['z', (v) => v === 0, -1],
    f: ['z', (v) => v >= 0, -1], b: ['z', (v) => v <= 0, 1], z: ['z', () => true, -1],
  };

  function rotVec(v, axis, s) {
    const [x, y, z] = v;
    if (axis === 'x') return [x, -s * z, s * y];
    if (axis === 'y') return [s * z, y, -s * x];
    return [-s * y, s * x, z];
  }

  /** Parse "R U R' Rw2 Dw x'" into [{base, amount}] (amount 1, 2 or -1). */
  function parse(alg) {
    if (!alg) return [];
    const clean = alg.replace(/[’´`]/g, "'").replace(/[()\[\]]/g, ' ');
    const tokens = clean.trim().split(/\s+/).filter(Boolean);
    return tokens.map((t) => {
      const m = t.match(/^([RLUDFBMESxyzrludfb])(w?)(2|3)?('?)(2)?$/);
      if (!m) throw new Error('Movimento inválido: ' + t);
      let base = m[1];
      if (m[2]) base = base.toLowerCase();
      let amount = m[3] === '2' || m[5] === '2' ? 2 : m[3] === '3' ? -1 : 1;
      if (m[4]) amount = amount === 2 ? 2 : -amount;
      return { base, amount, text: t };
    });
  }

  function moveToText(mv) {
    let b = mv.base;
    if ('rludfb'.includes(b)) b = b.toUpperCase() + 'w';
    return b + (mv.amount === 2 ? '2' : mv.amount === -1 ? "'" : '');
  }

  function applyMove(st, mv) {
    const def = MOVE_DEFS[mv.base];
    const [axis, pred, s0] = def;
    const ai = AX[axis];
    const turns = mv.amount === 2 ? 2 : 1;
    const s = mv.amount === -1 ? -s0 : s0;
    for (const k of st) {
      if (!pred(k.p[ai])) continue;
      for (let t = 0; t < turns; t++) {
        k.p = rotVec(k.p, axis, s);
        k.n = rotVec(k.n, axis, s);
      }
    }
    return st;
  }

  function apply(st, alg) {
    const moves = typeof alg === 'string' ? parse(alg) : alg;
    for (const m of moves) applyMove(st, m);
    return st;
  }

  function invert(moves) {
    return moves.slice().reverse().map((m) => ({ base: m.base, amount: m.amount === 2 ? 2 : -m.amount }));
  }

  /* ---------- queries ---------- */
  function stickerAt(st, face, p) {
    const n = FACE_NORMALS[face];
    return st.find((k) => k.n[0] === n[0] && k.n[1] === n[1] && k.n[2] === n[2] &&
      k.p[0] === p[0] && k.p[1] === p[1] && k.p[2] === p[2]);
  }
  function centerColor(st, face) {
    const n = FACE_NORMALS[face];
    return stickerAt(st, face, n).c;
  }
  /** Is the sticker in the place matching its face's center? */
  function stickerOk(st, k) {
    const f = faceOfNormal(k.n);
    return centerColor(st, f) === k.c;
  }
  function isSolved(st) {
    return st.every((k) => stickerOk(st, k));
  }
  /** Rotate the whole cube so U/F centers become standard (yellow up, blue front). */
  function normalize(st) {
    const rots = ['', 'x', 'x2', "x'", 'z', "z'"];
    const ys = ['', 'y', 'y2', "y'"];
    for (const r of rots) {
      for (const y of ys) {
        const t = apply(clone(st), (r + ' ' + y).trim());
        if (centerColor(t, 'U') === 'U' && centerColor(t, 'F') === 'F') return t;
      }
    }
    return st;
  }

  /** Grid helpers: for each face, the 9 sticker positions in reading order
      (top-left → bottom-right, as seen looking at that face). */
  function facePositions(face) {
    const out = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const a = c - 1, b = 1 - r; // a: left→right, b: top→bottom
        let p;
        switch (face) {
          case 'U': p = [a, 1, b === 1 ? -1 : b === -1 ? 1 : 0]; break; // back row first
          case 'D': p = [a, -1, b === 1 ? 1 : b === -1 ? -1 : 0]; break;
          case 'F': p = [a, b, 1]; break;
          case 'B': p = [-a, b, -1]; break;
          case 'R': p = [1, b, -a]; break;
          case 'L': p = [-1, b, a]; break;
        }
        out.push(p);
      }
    }
    return out;
  }

  function faceColors(st, face) {
    return facePositions(face).map((p) => stickerAt(st, face, p));
  }

  /* =========================================================
     SVG renderers
     ========================================================= */
  const ISO = { c: Math.cos(Math.PI / 6), s: 0.5 };
  function proj(x, y, z, scale) {
    // view from (+1,+1,+1): screen x right, screen y down
    return [(x - z) * ISO.c * scale, (-y + (x + z) * ISO.s) * scale];
  }

  /**
   * Isometric cube (U, F, R visible).
   * colorFn(sticker) → css color (default: real colors)
   */
  function isoSVG(st, opts = {}) {
    const colorFn = opts.colorFn || ((k) => COLORS[k.c]);
    const S = 30;
    const faces = ['U', 'F', 'R'];
    let polys = '';
    // body
    const body = [
      [[-1.5, 1.5, -1.5], [1.5, 1.5, -1.5], [1.5, 1.5, 1.5], [-1.5, 1.5, 1.5]],
      [[-1.5, 1.5, 1.5], [1.5, 1.5, 1.5], [1.5, -1.5, 1.5], [-1.5, -1.5, 1.5]],
      [[1.5, 1.5, 1.5], [1.5, 1.5, -1.5], [1.5, -1.5, -1.5], [1.5, -1.5, 1.5]],
    ];
    for (const quad of body) {
      polys += `<polygon points="${quad.map((q) => proj(q[0], q[1], q[2], S).map((v) => v.toFixed(2)).join(',')).join(' ')}" fill="#14161c" stroke="#14161c" stroke-width="3" stroke-linejoin="round"/>`;
    }
    for (const f of faces) {
      const n = FACE_NORMALS[f];
      for (const k of st) {
        if (k.n[0] !== n[0] || k.n[1] !== n[1] || k.n[2] !== n[2]) continue;
        const ctr = [k.p[0] + n[0] * 0.5, k.p[1] + n[1] * 0.5, k.p[2] + n[2] * 0.5];
        // two in-plane axes
        const ax = n[0] ? [[0, 1, 0], [0, 0, 1]] : n[1] ? [[1, 0, 0], [0, 0, 1]] : [[1, 0, 0], [0, 1, 0]];
        const h = 0.43;
        const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => {
          const P = [0, 1, 2].map((i) => ctr[i] + (ax[0][i] * u + ax[1][i] * v) * h);
          return proj(P[0], P[1], P[2], S);
        });
        polys += `<polygon points="${corners.map((c) => c.map((v) => v.toFixed(2)).join(',')).join(' ')}" fill="${colorFn(k)}" stroke="rgba(0,0,0,.25)" stroke-width=".6" stroke-linejoin="round"/>`;
      }
    }
    const pts = [];
    for (const q of body.flat()) pts.push(proj(q[0], q[1], q[2], S));
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const minX = Math.min(...xs) - 4, maxX = Math.max(...xs) + 4;
    const minY = Math.min(...ys) - 4, maxY = Math.max(...ys) + 4;
    return `<svg class="cube-svg iso" viewBox="${minX.toFixed(1)} ${minY.toFixed(1)} ${(maxX - minX).toFixed(1)} ${(maxY - minY).toFixed(1)}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${opts.label || 'Cubo'}">${polys}</svg>`;
  }

  /**
   * Top (last-layer) view: U face + the side stickers of the U layer.
   * mode 'oll' → yellow vs gray ; 'pll' → full colors + arrows
   */
  function topSVG(st, opts = {}) {
    const mode = opts.mode || 'pll';
    const C = 30, G = 3, side = 10;
    const off = side + G * 2;
    const total = off * 2 + C * 3 + G * 2;
    const col = (k) => {
      if (!k) return GRAY;
      if (mode === 'oll') return k.c === 'U' ? COLORS.U : GRAY;
      if (mode === 'cross') return k.c === 'U' && (k.p[0] === 0 || k.p[2] === 0) ? COLORS.U : GRAY;
      return COLORS[k.c];
    };
    let out = `<rect x="${off - G}" y="${off - G}" width="${C * 3 + G * 4}" height="${C * 3 + G * 4}" rx="7" fill="#14161c"/>`;
    const U = faceColors(st, 'U');
    U.forEach((k, i) => {
      const r = Math.floor(i / 3), c = i % 3;
      out += `<rect x="${off + c * (C + G)}" y="${off + r * (C + G)}" width="${C}" height="${C}" rx="4.5" fill="${col(k)}"/>`;
    });
    // side strips: back (top), front (bottom), left, right — stickers of y=1 layer
    const strip = (face, pos, place) => {
      const k = stickerAt(st, face, pos);
      out += `<rect x="${place[0]}" y="${place[1]}" width="${place[2]}" height="${place[3]}" rx="2.5" fill="${col(k)}"/>`;
    };
    for (let i = 0; i < 3; i++) {
      const a = i - 1;
      const t = off + i * (C + G);
      strip('B', [a, 1, -1], [t, G, C, side]);
      strip('F', [a, 1, 1], [t, total - side - G, C, side]);
      strip('L', [-1, 1, a], [G, t, side, C]);
      strip('R', [1, 1, a], [total - side - G, t, side, C]);
    }
    if (mode === 'pll' && opts.arrows) {
      out += arrowsSVG(opts.arrows, off, C, G);
    }
    return `<svg class="cube-svg top" viewBox="0 0 ${total} ${total}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${opts.label || 'Última camada'}">${out}</svg>`;
  }

  let arrowSeq = 0;
  function arrowsSVG(pairs, off, C, G) {
    const cen = (p) => [off + (p[0] + 1) * (C + G) + C / 2, off + (p[2] + 1) * (C + G) + C / 2];
    const mid = "ah" + (++arrowSeq);
    let s = `<defs><marker id="${mid}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4.2" markerHeight="4.2" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#111"/></marker></defs>`;
    for (const { from: a, to: b, both } of pairs) {
      const A = cen(a), Bp = cen(b);
      const dx = Bp[0] - A[0], dy = Bp[1] - A[1];
      const L = Math.hypot(dx, dy);
      const sh = 9 / L;
      const x1 = A[0] + dx * sh, y1 = A[1] + dy * sh, x2 = Bp[0] - dx * sh, y2 = Bp[1] - dy * sh;
      s += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#111" stroke-width="2.3" stroke-linecap="round" marker-end="url(#${mid})"${both ? ` marker-start="url(#${mid})"` : ''}/>`;
    }
    return s;
  }

  /** For a PLL case state, compute arrows (piece moves) of the U layer.
      Returns array of [fromPos, toPos] for pieces that move. */
  function pllArrows(caseState, alg) {
    const after = apply(clone(caseState), alg);
    // track each U-face sticker (by id) from its case position to its solved position,
    // ignoring a final U adjustment (AUF): pick the one that moves the fewest pieces.
    let moves = null;
    for (const auf of ['', 'U', 'U2', "U'"]) {
      const norm = normalize(apply(clone(after), auf));
      const m = new Map();
      for (const k of caseState) {
        if (k.n[1] !== 1) continue;
        if (k.p[0] === 0 && k.p[2] === 0) continue;
        const k2 = norm.find((q) => q.id === k.id);
        if (k.p[0] === k2.p[0] && k.p[2] === k2.p[2]) continue;
        m.set(k.p.join(), { from: k.p, to: k2.p });
      }
      if (!moves || m.size < moves.size) moves = m;
    }
    const out = [];
    const done = new Set();
    for (const [key, m] of moves) {
      if (done.has(key)) continue;
      const back = moves.get(m.to.join());
      if (back && back.to.join() === key) {
        done.add(m.to.join());
        out.push({ from: m.from, to: m.to, both: true });
      } else out.push({ from: m.from, to: m.to, both: false });
      done.add(key);
    }
    return out;
  }

  /**
   * Last-layer case in the same 3D (isometric) style as F2L:
   * U layer colored by mode, lower layers gray, plus "ghost" strips
   * showing the U-row stickers of the hidden L and B faces, and optional arrows.
   * mode: 'oll' (yellow vs gray) | 'cross' (yellow edges only) | 'pll' (real colors)
   */
  function isoLL(st, opts = {}) {
    const mode = opts.mode || 'pll';
    const S = 30, H = 0.43, D = 1.08;
    const LOWER = '#3a3f4b';
    const col = (k) => {
      if (k.p[1] !== 1) return LOWER;
      if (mode === 'oll') return k.c === 'U' ? COLORS.U : GRAY;
      if (mode === 'cross') return k.c === 'U' && (k.p[0] === 0 || k.p[2] === 0) ? COLORS.U : GRAY;
      return COLORS[k.c];
    };
    const poly = (pts, fill, extra = '') =>
      `<polygon points="${pts.map((c) => c.map((v) => v.toFixed(2)).join(',')).join(' ')}" fill="${fill}" stroke-linejoin="round" ${extra}/>`;
    const quad = (ctr, ax) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => {
      const P = [0, 1, 2].map((i) => ctr[i] + (ax[0][i] * u + ax[1][i] * v) * H);
      return proj(P[0], P[1], P[2], S);
    });
    const allPts = [];
    let back = '', front = '';
    // ghost strips (L and B faces, top row)
    for (const k of st) {
      if (k.p[1] !== 1) continue;
      let ctr, ax;
      if (k.n[0] === -1) { ctr = [-1.5 - D, k.p[1], k.p[2]]; ax = [[0, 1, 0], [0, 0, 1]]; }
      else if (k.n[2] === -1) { ctr = [k.p[0], k.p[1], -1.5 - D]; ax = [[1, 0, 0], [0, 1, 0]]; }
      else continue;
      const q = quad(ctr, ax);
      allPts.push(...q);
      back += poly(q, col(k), 'stroke="rgba(0,0,0,.35)" stroke-width=".8"');
    }
    // body + U/F/R stickers
    const body = [
      [[-1.5, 1.5, -1.5], [1.5, 1.5, -1.5], [1.5, 1.5, 1.5], [-1.5, 1.5, 1.5]],
      [[-1.5, 1.5, 1.5], [1.5, 1.5, 1.5], [1.5, -1.5, 1.5], [-1.5, -1.5, 1.5]],
      [[1.5, 1.5, 1.5], [1.5, 1.5, -1.5], [1.5, -1.5, -1.5], [1.5, -1.5, 1.5]],
    ];
    for (const b of body) {
      const q = b.map((p) => proj(p[0], p[1], p[2], S));
      allPts.push(...q);
      front += poly(q, '#14161c', 'stroke="#14161c" stroke-width="3"');
    }
    for (const f of ['U', 'F', 'R']) {
      const n = FACE_NORMALS[f];
      const ax = n[0] ? [[0, 1, 0], [0, 0, 1]] : n[1] ? [[1, 0, 0], [0, 0, 1]] : [[1, 0, 0], [0, 1, 0]];
      for (const k of st) {
        if (k.n[0] !== n[0] || k.n[1] !== n[1] || k.n[2] !== n[2]) continue;
        const ctr = [k.p[0] + n[0] * 0.5, k.p[1] + n[1] * 0.5, k.p[2] + n[2] * 0.5];
        front += poly(quad(ctr, ax), col(k), 'stroke="rgba(0,0,0,.25)" stroke-width=".6"');
      }
    }
    // arrows on the U face
    if (opts.arrows && opts.arrows.length) {
      const mid = 'ah' + (++arrowSeq);
      front += `<defs><marker id="${mid}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#111"/></marker></defs>`;
      for (const { from: a, to: b, both } of opts.arrows) {
        const A = proj(a[0], 1.5, a[2], S), B = proj(b[0], 1.5, b[2], S);
        const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy), sh = 8 / L;
        front += `<line x1="${(A[0] + dx * sh).toFixed(1)}" y1="${(A[1] + dy * sh).toFixed(1)}" x2="${(B[0] - dx * sh).toFixed(1)}" y2="${(B[1] - dy * sh).toFixed(1)}" stroke="#111" stroke-width="2.2" stroke-linecap="round" marker-end="url(#${mid})"${both ? ` marker-start="url(#${mid})"` : ''}/>`;
      }
    }
    const xs = allPts.map((p) => p[0]), ys = allPts.map((p) => p[1]);
    const minX = Math.min(...xs) - 4, maxX = Math.max(...xs) + 4;
    const minY = Math.min(...ys) - 4, maxY = Math.max(...ys) + 4;
    return `<svg class="cube-svg iso ll" viewBox="${minX.toFixed(1)} ${minY.toFixed(1)} ${(maxX - minX).toFixed(1)} ${(maxY - minY).toFixed(1)}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${opts.label || 'Última camada'}">${back}${front}</svg>`;
  }

  /**
   * Random-move scramble (WCA style notation, 20–22 moves):
   * never the same face twice in a row, and never three moves on the same axis.
   */
  function scramble(len = 21) {
    const faces = ['R', 'L', 'U', 'D', 'F', 'B'];
    const axis = { R: 0, L: 0, U: 1, D: 1, F: 2, B: 2 };
    const sfx = ['', "'", '2'];
    const out = [];
    while (out.length < len) {
      const f = faces[Math.floor(Math.random() * 6)];
      const a = out[out.length - 1], b = out[out.length - 2];
      if (a && a[0] === f) continue;
      if (a && b && axis[a[0]] === axis[f] && axis[b[0]] === axis[f]) continue;
      out.push(f + sfx[Math.floor(Math.random() * 3)]);
    }
    return out.join(' ');
  }

  global.Cube = {
    scramble,
    COLORS, GRAY, FACE_NORMALS, solved, clone, parse, apply, applyMove, invert,
    moveToText, normalize, isSolved, stickerOk, centerColor, stickerAt, faceColors,
    facePositions, faceOfNormal, isoSVG, isoLL, topSVG, pllArrows,
  };
})(typeof window !== 'undefined' ? window : globalThis);
