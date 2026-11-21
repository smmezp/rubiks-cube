/* =========================================================
   Cube3D — CSS 3D cube with animated layer turns.
   Renders a Cube sticker-state; animates any move by rotating
   the affected cubies, then commits the move to the model.
   ========================================================= */
(function (global) {
  'use strict';
  const { COLORS, FACE_NORMALS, clone, applyMove, parse } = global.Cube;

  const AXI = { x: 0, y: 1, z: 2 };
  const DEFS = {
    R: ['x', (v) => v === 1, -1], L: ['x', (v) => v === -1, 1], M: ['x', (v) => v === 0, 1],
    r: ['x', (v) => v >= 0, -1], l: ['x', (v) => v <= 0, 1], x: ['x', () => true, -1],
    U: ['y', (v) => v === 1, -1], D: ['y', (v) => v === -1, 1], E: ['y', (v) => v === 0, 1],
    u: ['y', (v) => v >= 0, -1], d: ['y', (v) => v <= 0, 1], y: ['y', () => true, -1],
    F: ['z', (v) => v === 1, -1], B: ['z', (v) => v === -1, 1], S: ['z', (v) => v === 0, -1],
    f: ['z', (v) => v >= 0, -1], b: ['z', (v) => v <= 0, 1], z: ['z', () => true, -1],
  };
  // CSS faces: [name, normal, transform]
  const CSS_FACES = [
    ['U', [0, 1, 0], 'rotateX(90deg)'],
    ['D', [0, -1, 0], 'rotateX(-90deg)'],
    ['F', [0, 0, 1], ''],
    ['B', [0, 0, -1], 'rotateY(180deg)'],
    ['R', [1, 0, 0], 'rotateY(90deg)'],
    ['L', [-1, 0, 0], 'rotateY(-90deg)'],
  ];

  class Cube3D {
    constructor(root, opts = {}) {
      this.root = root;
      this.size = opts.size || 56;
      this.state = opts.state ? clone(opts.state) : global.Cube.solved();
      this.colorFn = opts.colorFn || ((k) => COLORS[k.c]);
      this.rx = opts.rx ?? -28;
      this.ry = opts.ry ?? -36;
      this.busy = false;
      this.build();
      if (opts.drag !== false) this.enableDrag();
      this.paint();
    }

    build() {
      const s = this.size;
      this.root.classList.add('c3d-scene');
      this.root.style.setProperty('--cs', s + 'px');
      this.root.innerHTML = '';
      this.cube = document.createElement('div');
      this.cube.className = 'c3d-cube';
      this.root.appendChild(this.cube);
      this.cubies = [];
      for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
          for (let z = -1; z <= 1; z++) {
            const el = document.createElement('div');
            el.className = 'c3d-cubie';
            const base = `translate3d(${x * s}px, ${-y * s}px, ${z * s}px)`;
            el.style.transform = base;
            const faces = {};
            for (const [name, , tf] of CSS_FACES) {
              const f = document.createElement('div');
              f.className = 'c3d-face';
              f.style.transform = `${tf} translateZ(${s / 2}px)`;
              const st = document.createElement('i');
              f.appendChild(st);
              el.appendChild(f);
              faces[name] = st;
            }
            this.cube.appendChild(el);
            this.cubies.push({ el, pos: [x, y, z], base, faces });
          }
        }
      }
      this.applyView();
    }

    applyView() {
      this.cube.style.transform = `rotateX(${this.rx}deg) rotateY(${this.ry}deg)`;
    }

    enableDrag() {
      let sx = 0, sy = 0, rx = 0, ry = 0, down = false;
      const onDown = (e) => {
        down = true; sx = e.clientX; sy = e.clientY; rx = this.rx; ry = this.ry;
        this.root.setPointerCapture?.(e.pointerId);
        this.root.classList.add('dragging');
      };
      const onMove = (e) => {
        if (!down) return;
        this.ry = ry + (e.clientX - sx) * 0.5;
        this.rx = Math.max(-80, Math.min(80, rx - (e.clientY - sy) * 0.5));
        this.applyView();
      };
      const onUp = () => { down = false; this.root.classList.remove('dragging'); };
      this.root.addEventListener('pointerdown', onDown);
      this.root.addEventListener('pointermove', onMove);
      this.root.addEventListener('pointerup', onUp);
      this.root.addEventListener('pointercancel', onUp);
    }

    setState(st) {
      this.state = clone(st);
      this.paint();
    }

    paint() {
      const map = new Map();
      for (const k of this.state) map.set(k.p.join() + '|' + k.n.join(), k);
      for (const c of this.cubies) {
        for (const [name, n] of CSS_FACES) {
          const outer = (n[0] && c.pos[0] === n[0]) || (n[1] && c.pos[1] === n[1]) || (n[2] && c.pos[2] === n[2]);
          const st = c.faces[name];
          if (!outer) { st.style.background = 'transparent'; st.parentNode.classList.add('inner'); continue; }
          st.parentNode.classList.remove('inner');
          const k = map.get(c.pos.join() + '|' + n.join());
          st.style.background = k ? this.colorFn(k) : '#222';
        }
      }
    }

    /** Animate one move object {base, amount}. Resolves when done. */
    turn(mv, ms = 320) {
      return new Promise((resolve) => {
        const def = DEFS[mv.base];
        const [axis, pred, s0] = def;
        const ai = AXI[axis];
        const s = mv.amount === -1 ? -s0 : s0;
        const deg = (mv.amount === 2 ? 180 : 90) * s;
        // CSS rotation for model angle (see notes): x → -deg, y → +deg, z → -deg
        const cssDeg = axis === 'y' ? deg : -deg;
        const rot = axis === 'x' ? `rotateX(${cssDeg}deg)` : axis === 'y' ? `rotateY(${cssDeg}deg)` : `rotateZ(${cssDeg}deg)`;
        const moving = this.cubies.filter((c) => pred(c.pos[ai]));
        const dur = mv.amount === 2 ? ms * 1.35 : ms;
        if (ms <= 0) {
          applyMove(this.state, mv); this.paint(); resolve(); return;
        }
        // force layout before transition
        const rot0 = rot.replace(/\(.*\)/, '(0deg)');
        moving.forEach((c) => { c.el.style.transition = 'none'; c.el.style.transform = `${rot0} ${c.base}`; });
        void this.cube.offsetWidth;
        moving.forEach((c) => {
          c.el.style.transition = `transform ${dur}ms cubic-bezier(.45,.05,.25,1)`;
          c.el.style.transform = `${rot} ${c.base}`;
        });
        const finish = () => {
          applyMove(this.state, mv);
          moving.forEach((c) => { c.el.style.transition = 'none'; c.el.style.transform = c.base; });
          this.paint();
          resolve();
        };
        setTimeout(finish, dur + 20);
      });
    }

    async run(alg, ms) {
      const moves = typeof alg === 'string' ? parse(alg) : alg;
      for (const m of moves) await this.turn(m, ms);
    }
  }

  global.Cube3D = Cube3D;
})(window);
