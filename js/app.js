/* =========================================================
   App — monta as seções, o seletor de método e o player.
   ========================================================= */
(function () {
  'use strict';
  const { Cube, Cube3D, ALGS } = window;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- idioma (padrão: inglês) ---------- */
  const { I18N } = window;
  const STORAGE_LANG = 'medeiros-lang';
  let lang = 'en';
  try { lang = localStorage.getItem(STORAGE_LANG) === 'pt' ? 'pt' : 'en'; } catch (e) { /* sem storage */ }
  const t = (k) => (I18N[lang][k] ?? I18N.en[k] ?? k);
  const D = () => I18N[lang];

  /* ---------- helpers ---------- */
  const inv = (alg) => Cube.invert(Cube.parse(alg)).map(Cube.moveToText).join(' ');
  const stateOf = (setup) => Cube.apply(Cube.solved(), setup || '');
  const zeros = (p) => p.filter((v) => v === 0).length;
  const MASK_GRAY = '#4b505d';
  const MASKS = {
    full: (k) => Cube.COLORS[k.c],
    cross: (k) => (zeros(k.home) === 2 || (k.home[1] === -1 && zeros(k.home) === 1) ? Cube.COLORS[k.c] : MASK_GRAY),
    layer1: (k) => (zeros(k.home) === 2 || k.home[1] === -1 ? Cube.COLORS[k.c] : MASK_GRAY),
    f2l: (k) => (k.home[1] <= 0 ? Cube.COLORS[k.c] : MASK_GRAY),
  };
  /** Pretty algorithm: wraps each move in a chip. */
  const algHTML = (alg) => alg.trim().split(/\s+/).map((m) => `<span class="mv">${m.replace(/'/g, '’')}</span>`).join('');

  function diagram(c) {
    const st = c.state;
    if (c.view === 'top') {
      const arrows = c.arrowsAlg ? Cube.pllArrows(st, c.arrowsAlg) : null;
      return Cube.isoLL(st, { mode: c.top || 'pll', arrows, label: c.title });
    }
    return Cube.isoSVG(st, { colorFn: MASKS[c.mask || 'full'], label: c.title });
  }

  /* ---------- dados do método básico ---------- */
  const A4 = "F U R U' R' F'";
  const S5 = "R U R' U R U2 R'";
  const A6 = "R' F R' B2 R F' R' B2 R2";
  const E1 = "F2 U M' U2 M U F2";
  const E2 = "F2 U' M' U2 M U' F2";
  const H = "M2 U M2 U2 M2 U M2";
  const Z = "M2 U M2 U M' U2 M2 U2 M'";

  const CROSS_TIPS = [
    { alg: 'R', note: 'Meio na camada do meio, branco virado para a frente.' },
    { alg: "F'", note: 'Meio na 2ª camada, do outro lado.' },
    { alg: 'R2', note: 'Meio branco embaixo: meia-volta traz para cima.' },
    { alg: "U2 L' U2", note: 'Tire o meio do caminho com U2 para não desmontar a cruz.' },
    { alg: "R U F' U'", note: 'Meio no lugar, porém invertido (branco para o lado).' },
    { alg: "R' U F' U'", note: 'Meio invertido na camada de baixo do lado direito.' },
  ].map((t) => ({ ...t, title: t.alg, setup: 'x2 ' + inv(t.alg), mask: 'cross', view: 'iso' }));

  const STEPS = [
    {
      title: 'Fazer uma cruz em uma face',
      text: 'Faça uma cruz branca na face de cima. Os centros dizem a cor da face; cada meio da cruz tem 2 cores e a <strong>outra cor precisa ficar alinhada com o centro da sua cor</strong>. Os cantos têm 3 cores e não entram na cruz. Este passo é intuitivo; as dicas abaixo ajudam nas situações mais comuns.',
      cases: CROSS_TIPS,
    },
    {
      title: 'Completar a 1ª camada',
      text: 'Vire o cubo: a cruz fica <strong>embaixo</strong>. Coloque o canto branco na camada de cima, logo acima do lugar dele, e aplique o caso certo.',
      cases: [
        { title: 'Caso 1', alg: "R U R'", note: 'Branco virado para a direita.' },
        { title: 'Caso 2', alg: "F' U' F", note: 'Branco virado para a frente.' },
        { title: 'Caso 3', alg: "R U2 R' U' R U R'", note: 'Branco virado para cima. Com R U2 R\' U\' você cai no caso 1.' },
      ].map((c) => ({ ...c, setup: inv(c.alg), mask: 'layer1', view: 'iso' })),
    },
    {
      title: 'Completar a 2ª camada',
      text: 'Com a 1ª camada embaixo, procure meios da 2ª camada na camada de cima (meios sem amarelo). Alinhe a cor da frente do meio com o centro e veja para qual lado ele precisa ir.',
      cases: [
        { title: 'Para a direita', alg: "U R U R' U' F' U' F", note: 'U R U R\' U\' e depois recoloque o canto com o caso 2 do passo 2.' },
        { title: 'Para a esquerda', alg: "U' L' U' L U F U F'", note: 'U\' L\' U\' L U e depois recoloque o canto de baixo.' },
      ].map((c) => ({ ...c, setup: inv(c.alg), mask: 'f2l', view: 'iso' })),
      extra: 'Se um meio da 2ª camada estiver no lugar dele mas invertido, ou se não houver nenhum meio da 2ª camada em cima, faça o algoritmo "para a direita" com qualquer meio amarelo: o meio preso sobe para a camada de cima e você cai num dos casos acima.',
    },
    {
      title: 'Orientar a cruz de cima',
      text: 'Agora o amarelo fica em cima. Ignore os cantos e olhe só os meios amarelos.',
      cases: [
        { title: 'Caso 1 · "L"', alg: A4, setup: inv(A4), note: 'Segure o "L" no canto de trás à esquerda.' },
        { title: 'Caso 2 · linha', alg: A4, setup: inv(A4) + ' ' + inv(A4), note: 'Linha na horizontal: faça o caso 1 e cairá no caso 1.' },
        { title: 'Caso 3 · ponto', alg: A4, setup: "F R U R' U' F' F R U R' U' F' U F R U R' U' F'", note: 'Faça o caso 1 e cairá no caso 2 (gire U para deixar a linha na horizontal).' },
      ].map((c) => ({ ...c, view: 'top', top: 'cross' })),
    },
    {
      title: 'Orientar os cantos de cima',
      text: 'Com a cruz amarela pronta, conte quantos cantos já têm o amarelo para cima.',
      cases: [
        { title: 'Caso 1 · um canto', alg: S5, setup: inv(S5), note: 'Canto certo em cima e à esquerda. Se ficar só um canto certo de novo, coloque-o à esquerda e repita.' },
        { title: 'Caso 2 · dois cantos', alg: S5, setup: inv("Rw U R' U' Rw' F R F'"), note: 'Canto com o amarelo na frente, à esquerda. Faça o caso 1 e cairá no caso 1.' },
        { title: 'Caso 3 · nenhum', alg: S5, setup: inv(S5) + ' ' + inv(S5), note: 'Canto com o amarelo para a esquerda, na frente. Faça o caso 1 e cairá no caso 1.' },
      ].map((c) => ({ ...c, view: 'top', top: 'oll' })),
    },
    {
      title: 'Permutar os cantos de cima',
      text: 'Procure dois cantos com a mesma cor na mesma lateral ("faróis"). Os cantos ficam certos entre si; pode ser preciso girar U no final para alinhar.',
      cases: [
        { title: 'Caso 1 · faróis', alg: A6, setup: inv(A6), arrowsAlg: A6, note: 'Dois cantos certos para trás.' },
        { title: 'Caso 2 · sem faróis', alg: A6, setup: inv(A6) + " U' " + inv(A6), note: 'Quaisquer cantos para trás: faça o caso 1 e cairá no caso 1.' },
      ].map((c) => ({ ...c, view: 'top', top: 'pll' })),
    },
    {
      title: 'Permutar os meios de cima',
      text: 'Último passo! Procure uma lateral completa (meio certo) e deixe-a para trás.',
      cases: [
        { title: 'Caso 1', alg: E1, setup: inv(E1), arrowsAlg: E1, note: 'Meio certo para trás; os outros três giram no sentido anti-horário.' },
        { title: 'Caso 2', alg: E2, setup: inv(E2), arrowsAlg: E2, note: 'Meio certo para trás; os outros três giram no sentido horário.' },
        { title: 'Caso 3 · troca em cruz', alg: E1, setup: inv(H), arrowsAlg: H, note: 'Nenhum meio certo: faça o caso 1 com qualquer meio para trás e cairá no caso 1 ou 2.' },
        { title: 'Caso 4 · troca vizinha', alg: E1, setup: inv(Z), arrowsAlg: Z, note: 'Faça o caso 1 com qualquer meio para trás e cairá no caso 1 ou 2.' },
      ].map((c) => ({ ...c, view: 'top', top: 'pll' })),
    },
  ];

  /* ---------- seletor de método ---------- */
  const THEME = { basic: '#ff4d00', advanced: '#0a1f44' };
  let mode = 'basic';
  function setMode(m, opts = {}) {
    mode = m;
    document.documentElement.dataset.mode = m;
    $$('.mode-switch button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === m)));
    $$('.mode-pane').forEach((p) => (p.hidden = p.dataset.pane !== m));
    $('meta[name="theme-color"]').setAttribute('content', THEME[m]);
    try { localStorage.setItem('cubo-mode', m); } catch (e) { /* sem storage */ }
    if (!opts.silent) {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
    heroes.forEach((h) => h.sync());
  }

  /** Troca Básico ⇄ Avançado com transição: desliza para a direita ao avançar e para a esquerda ao voltar. */
  let modeTarget = null; // modo para onde uma transição em andamento está indo
  let modeVT = null;
  let wantedMode = null;
  /* endereços: …/rubiks-cube/ = Básico, …/rubiks-cube/cfop/ = Avançado (CFOP) */
  const SITE_ROOT = new URL('./', document.baseURI).pathname; // "/rubiks-cube/" no GitHub Pages, "/" local
  const modeUrl = (m) => SITE_ROOT + (m === 'advanced' ? 'cfop/' : '');
  const modeFromPath = () => (/\/cfop\/?$/.test(location.pathname) ? 'advanced' : 'basic');

  function switchMode(m, opts = {}) {
    const current = modeTarget || mode;
    if (m === current) { if (!opts.fromHistory) window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }); return; }
    if (modeVT) modeVT.skipTransition(); // clique rápido: termina a anterior na hora
    wantedMode = m;
    // muda o endereço na hora do clique (o voltar do navegador volta para o modo anterior)
    if (!opts.fromHistory && location.pathname !== modeUrl(m)) history.pushState({ mode: m }, '', modeUrl(m));
    const root = document.documentElement;
    // qualquer transição (mesmo uma pulada que rode atrasada) aplica sempre o ÚLTIMO modo pedido
    const apply = () => {
      if (mode === wantedMode && root.dataset.mode === wantedMode) return;
      setMode(wantedMode, { silent: true });
      window.scrollTo(0, 0);
      heroes.forEach((h) => h.resize());
    };
    if (!document.startViewTransition || reduceMotion || document.hidden) { apply(); return; }
    modeTarget = m;
    root.dataset.nav = m === 'advanced' ? 'forward' : 'back';
    const vt = modeVT = document.startViewTransition(apply);
    // garantia: se o navegador não desenhar a transição logo (aba em segundo plano, aparelho lento), troca direto
    setTimeout(() => { if (mode !== wantedMode) { vt.skipTransition(); apply(); } }, 350);
    vt.ready.catch(() => {});
    if (vt.updateCallbackDone) vt.updateCallbackDone.catch(() => {});
    vt.finished.catch(() => {}).finally(() => {
      if (modeVT === vt) { modeVT = null; modeTarget = null; delete root.dataset.nav; }
    });
  }

  /* ---------- hero cubes ---------- */
  class HeroLoop {
    constructor(el, paneMode, script) {
      this.el = el; this.paneMode = paneMode; this.script = script; this.running = false;
      this.cube = new Cube3D(el, { size: this.sizeFor(), rx: -26, ry: -38 });
      window.addEventListener('resize', () => this.resize());
    }
    sizeFor() {
      const w = this.el.parentElement.clientWidth || 320;
      // limita também pela altura (celular deitado)
      return Math.round(Math.max(36, Math.min(78, w / 5.4, window.innerHeight / 7.5)));
    }
    resize() {
      const s = this.sizeFor();
      if (s === this.cube.size) return;
      const st = this.cube.state;
      this.cube.size = s; this.cube.build(); this.cube.state = st; this.cube.paint();
    }
    sync() {
      const active = mode === this.paneMode && !document.hidden && !player.open;
      this.active = active;
      if (active && !this.running && !reduceMotion) this.loop();
    }
    async loop() {
      this.running = true;
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      while (true) {
        for (const step of this.script) {
          if (!this.active) { this.running = false; return; }
          if (typeof step === 'number') await sleep(step);
          else await this.cube.run(step, 300);
        }
      }
    }
  }

  /* ---------- player ---------- */
  const player = {
    open: false, cube: null, moves: [], idx: 0, start: null, playing: false, busy: false,
    el: null,
    init() {
      this.el = $('#player');
      $('#player-close').addEventListener('click', () => this.close());
      this.el.addEventListener('click', (e) => { if (e.target === this.el) this.close(); });
      $('#pl-play').addEventListener('click', () => this.toggle());
      $('#pl-next').addEventListener('click', () => { this.pause(); this.next(); });
      $('#pl-prev').addEventListener('click', () => { this.pause(); this.prev(); });
      $('#pl-reset').addEventListener('click', () => this.reset());
      $('#pl-setup-play').addEventListener('click', () => this.playSetup());
      $('#pl-setup-copy').addEventListener('click', async (e) => {
        const b = e.currentTarget;
        try { await navigator.clipboard.writeText(this.setupText); b.textContent = t('x.copied'); }
        catch (err) { b.textContent = '✕'; }
        setTimeout(() => { b.textContent = t('x.copy'); }, 1400);
      });
      document.addEventListener('keydown', (e) => {
        if (!this.open) return;
        if (e.key === 'Escape') this.close();
        else if (e.key === ' ') { e.preventDefault(); this.toggle(); }
        else if (e.key === 'ArrowRight') { this.pause(); this.next(); }
        else if (e.key === 'ArrowLeft') { this.pause(); this.prev(); }
      });
    },
    speed() { return +$('#pl-speed').value; },
    show({ kicker, title, alg, state, note, setup }) {
      this.start = Cube.clone(state);
      this.moves = Cube.parse(alg);
      this.idx = 0;
      $('#player-kicker').textContent = kicker || '';
      $('#player-title').textContent = title || '';
      $('#player-note').innerHTML = note || '';
      $('#player-moves').innerHTML = this.moves.map((m, i) => `<button class="mv" data-i="${i}">${m.text.replace(/'/g, '’')}</button>`).join('');
      $$('#player-moves .mv').forEach((b) => b.addEventListener('click', () => this.jump(+b.dataset.i + 1)));
      // setup: como montar este caso a partir do cubo resolvido
      this.setupText = setup ? simplifyAlg(setup) : '';
      this.setupMoves = this.setupText ? Cube.parse(this.setupText) : [];
      $('#player-setup').hidden = !this.setupMoves.length;
      $('#player-setup-moves').innerHTML = this.setupMoves.map((m) => `<span class="mv">${Cube.moveToText(m).replace(/'/g, '’')}</span>`).join('');
      $('#pl-setup-copy').textContent = t('x.copy');
      this.el.hidden = false;
      this.open = true;
      document.body.classList.add('no-scroll');
      heroes.forEach((h) => h.sync());
      const host = $('#player-cube');
      const size = Math.round(Math.max(40, Math.min(64, (host.parentElement.clientWidth || 300) / 4.6)));
      if (!this.cube || this.cube.size !== size) this.cube = new Cube3D(host, { size, rx: -26, ry: -36, state: this.start });
      else { this.cube.rx = -26; this.cube.ry = -36; this.cube.applyView(); this.cube.setState(this.start); }
      this.mark();
      $('#player-close').focus();
      if (!reduceMotion) setTimeout(() => this.play(), 450);
    },
    close() {
      if (!this.open) return;
      this.pause();
      this.open = false;
      const done = () => {
        this.el.hidden = true;
        this.el.classList.remove('is-closing');
        document.body.classList.remove('no-scroll');
        heroes.forEach((h) => h.sync());
        if (this.returnFocus) this.returnFocus.focus({ preventScroll: true });
      };
      if (reduceMotion) { done(); return; }
      this.el.classList.add('is-closing'); // anima a saída antes de esconder
      setTimeout(done, 200);
    },
    /** cur = move being shown as "current" (the one turning now, or the last one done). */
    mark(cur = this.idx - 1) {
      $$('#player-moves .mv').forEach((b, i) => {
        b.classList.toggle('done', i < this.idx && i !== cur);
        b.classList.toggle('current', i === cur);
      });
      $('#pl-play').textContent = this.playing ? '❚❚' : this.idx >= this.moves.length ? '↺' : '▶';
      $('#pl-play').setAttribute('aria-label', this.playing ? t('pl.pause') : t('pl.play'));
    },
    async next() {
      if (this.busy || this.idx >= this.moves.length) return false;
      this.busy = true;
      this.mark(this.idx); // destaca a notação ANTES de girar
      await this.cube.turn(this.moves[this.idx], this.speed());
      this.idx++; this.busy = false; this.mark();
      return true;
    },
    async prev() {
      if (this.busy || this.idx <= 0) return;
      this.busy = true;
      const m = this.moves[this.idx - 1];
      this.mark(this.idx - 1);
      await this.cube.turn({ base: m.base, amount: m.amount === 2 ? 2 : -m.amount }, this.speed());
      this.idx--; this.busy = false; this.mark();
    },
    async jump(target) {
      this.pause();
      while (this.busy) await new Promise((r) => setTimeout(r, 30));
      if (target < this.idx) { this.cube.setState(this.start); this.idx = 0; }
      while (this.idx < target) { this.busy = true; await this.cube.turn(this.moves[this.idx], 0); this.idx++; this.busy = false; }
      this.mark();
    },
    async play() {
      if (this.playing || !this.open) return;
      if (this.idx >= this.moves.length) { this.cube.setState(this.start); this.idx = 0; this.mark(); await new Promise((r) => setTimeout(r, 350)); }
      this.playing = true; this.mark();
      while (this.playing && this.open && this.idx < this.moves.length) {
        await this.next();
        await new Promise((r) => setTimeout(r, this.speed() * 0.25));
      }
      this.playing = false; this.mark();
    },
    pause() { this.playing = false; this.mark(); },
    toggle() { this.playing ? this.pause() : this.play(); },
    reset() { this.pause(); if (this.busy) return; this.cube.setState(this.start); this.idx = 0; this.mark(); },

    /** Anima o setup: começa do cubo resolvido e chega no caso. Depois é só dar play na solução. */
    async playSetup() {
      if (!this.setupMoves.length) return;
      this.pause();
      while (this.busy) await new Promise((r) => setTimeout(r, 30));
      this.busy = true;
      const btn = $('#pl-setup-play');
      btn.disabled = true;
      const chips = $$('#player-setup-moves .mv');
      chips.forEach((c) => c.classList.remove('done', 'current'));
      this.cube.setState(Cube.solved());
      this.idx = 0; this.mark(-1);
      await new Promise((r) => setTimeout(r, 300));
      for (let i = 0; i < this.setupMoves.length; i++) {
        if (!this.open) break;
        chips.forEach((c, j) => { c.classList.toggle('current', j === i); c.classList.toggle('done', j < i); });
        await this.cube.turn(this.setupMoves[i], Math.max(120, this.speed() * 0.7));
      }
      chips.forEach((c) => c.classList.remove('current', 'done'));
      // garante o estado exato do caso (mesmo se algo interrompeu)
      this.cube.setState(this.start);
      this.idx = 0; this.busy = false; btn.disabled = false; this.mark();
    },
  };

  /** Junta movimentos repetidos da mesma camada: "U U" → "U2", "R R'" → (nada). */
  function simplifyAlg(alg) {
    const out = [];
    for (const m of Cube.parse(alg)) {
      const q = m.amount === -1 ? 3 : m.amount; // quartos de volta
      const last = out[out.length - 1];
      if (last && last.base === m.base) {
        last.q = (last.q + q) % 4;
        if (!last.q) out.pop();
      } else out.push({ base: m.base, q });
    }
    return out.map((m) => Cube.moveToText({ base: m.base, amount: m.q === 3 ? -1 : m.q })).join(' ');
  }

  /* ---------- renderers ---------- */
  function caseCard(c, { kicker, compact } = {}) {
    if (!c.state) c.state = stateOf(c.setup);
    const btn = document.createElement('button');
    btn.className = 'case-card' + (compact ? ' compact' : '');
    btn.type = 'button';
    btn.innerHTML = `
      <span class="case-fig">${diagram(c)}</span>
      <span class="case-body">
        <span class="case-title">${c.title}${c.tag ? `<em>${c.tag}</em>` : ''}</span>
        <span class="alg">${algHTML(c.alg)}</span>
        ${c.alt ? `<span class="alg alt"><small>${t('x.or')}</small>${algHTML(c.alt)}</span>` : ''}
        ${c.note ? `<span class="case-note">${c.note}</span>` : ''}
      </span>
      <span class="case-play" aria-hidden="true">▶</span>`;
    btn.setAttribute('aria-label', `${c.title}: ${c.alg}. ${t('x.watch')}`);
    btn.addEventListener('click', () => {
      player.returnFocus = btn;
      player.show({ kicker, title: c.title, alg: c.alg, state: c.state, note: c.playerNote || c.note || '', setup: c.setup });
    });
    return btn;
  }

  const NOTATION_BASIC = ['F', "F'", 'F2', 'R', "R'", 'R2', 'U', "U'", 'U2', 'L', "L'", 'B2', 'M', "M'", 'D'];
  const NOTATION_ADV = ['Rw', "Rw'", 'Lw', 'Dw', 'Fw', 'S', 'x', 'y', 'z'];
  function renderNotation(gridId, list, descs, kicker) {
    const grid = $(gridId);
    grid.innerHTML = '';
    for (const [i, m] of list.entries()) {
      const desc = descs[i];
      const c = { title: m, alg: m, setup: m, view: 'iso', mask: 'full' };
      c.state = stateOf(m);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'note-card';
      b.innerHTML = `<span class="case-fig">${diagram(c)}</span><span class="note-move">${m.replace(/'/g, '’')}</span><span class="note-desc">${desc}</span>`;
      b.addEventListener('click', () => {
        player.returnFocus = b;
        player.show({ kicker, title: `${t('x.move')} ${m.replace(/'/g, '’')}`, alg: m, state: Cube.solved(), note: desc });
      });
      grid.appendChild(b);
    }
  }

  function renderPieces() {
    const s = Cube.solved();
    const only = (pred) => (k) => (pred(k.home) ? Cube.COLORS[k.c] : '#d9d4d0');
    const figs = {
      center: only((h) => zeros(h) === 2 && (h[1] === 1 || h[2] === 1 || h[0] === 1)),
      edge: only((h) => zeros(h) === 1 && ((h[0] === 0 && h[1] === 1 && h[2] === 1) || (h[0] === 1 && h[1] === 1 && h[2] === 0) || (h[0] === 1 && h[1] === 0 && h[2] === 1))),
      corner: only((h) => h[0] === 1 && h[1] === 1 && h[2] === 1),
    };
    $$('.piece-fig').forEach((el) => { el.innerHTML = Cube.isoSVG(s, { colorFn: figs[el.dataset.fig], label: el.dataset.fig }); });
  }

  function renderSteps() {
    const list = $('#steps');
    list.innerHTML = '';
    STEPS.forEach((base, i) => {
      // junta os algoritmos (fixos) com os textos do idioma atual
      const tx = D().steps[i];
      const step = {
        ...base,
        title: tx.title,
        text: tx.text,
        extra: tx.extra,
        cases: base.cases.map((c, j) => (i === 0
          ? { ...c, note: D().crossTips[j] }
          : { ...c, title: tx.cases[j][0], note: tx.cases[j][1], state: c.state })),
      };
      const li = document.createElement('li');
      li.className = 'step';
      li.id = 'passo-' + (i + 1);
      li.innerHTML = `
        <div class="step-head">
          <span class="step-num">${i + 1}</span>
          <div>
            <p class="eyebrow">${t('x.step')} ${i + 1}</p>
            <h3>${step.title}</h3>
          </div>
        </div>
        <p class="step-text">${step.text}</p>
        <div class="case-grid"></div>
        ${step.extra ? `<p class="step-extra">${step.extra}</p>` : ''}`;
      const grid = $('.case-grid', li);
      step.cases.forEach((c, j) => {
        grid.appendChild(caseCard(c, { kicker: `${t('x.step')} ${i + 1} · ${step.title}`, compact: true }));
        base.cases[j].state = c.state; // guarda o estado calculado
      });
      list.appendChild(li);
    });
  }

  /* ---------- biblioteca CFOP ---------- */
  const LIB = {
    cross: {
      desc: () => t('l.crossDesc'),
      items: () => CROSS_TIPS.map((c, i) => ({ ...c, title: c.alg, note: D().crossTips[i] })),
    },
    f2l: {
      desc: () => t('l.f2lDesc'),
      items: () => ALGS.F2L.map((c) => ({ title: `${t('x.case')} ${c.n}`, alg: c.alg, alt: c.alt, setup: inv(c.alg), view: 'iso', mask: 'f2l', key: `${c.n} ${c.alg} ${c.alt || ''}` })),
    },
    oll: {
      desc: () => t('l.ollDesc'),
      items: () => ALGS.OLL.map((c) => ({ title: `OLL ${c.n}`, alg: c.alg, setup: inv(c.alg), view: 'top', top: 'oll', key: `${c.n} ${c.alg}` })),
    },
    pll: {
      desc: () => t('l.pllDesc'),
      items: () => ALGS.PLL.map((c) => {
        const tag = D().pllGroups[c.group] || c.group;
        return { title: `${c.n} · ${c.name}`, tag, alg: c.alg, setup: inv(c.alg), arrowsAlg: c.alg, view: 'top', top: 'pll', key: `${c.n} ${c.name} ${c.alg} ${tag}` };
      }),
    },
  };
  let libCache = {};
  let libTab = 'f2l';
  let libFilter = 'all'; // all | todo | done

  /* algoritmos marcados como aprendidos (salvos no navegador) */
  const LEARN_KEY = 'cubo-learned';
  let learned = new Set();
  try { learned = new Set(JSON.parse(localStorage.getItem(LEARN_KEY) || '[]')); } catch (e) { /* sem storage */ }
  const saveLearned = () => { try { localStorage.setItem(LEARN_KEY, JSON.stringify([...learned])); } catch (e) { /* ok */ } };

  function libEntry(c) {
    const card = caseCard(c, { kicker: 'CFOP · ' + libTab.toUpperCase() });
    if (libTab === 'cross') return { c, el: card };
    const id = `${libTab}-${c.key.split(' ')[0]}`;
    const wrap = document.createElement('div');
    wrap.className = 'case-wrap';
    const tog = document.createElement('button');
    tog.type = 'button';
    tog.className = 'learn-toggle';
    tog.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const sync = () => {
      const on = learned.has(id);
      wrap.classList.toggle('is-learned', on);
      tog.setAttribute('aria-pressed', String(on));
      tog.setAttribute('aria-label', `${c.title}: ${on ? t('lr.unmark') : t('lr.mark')}`);
      tog.title = on ? t('lr.unmark') : t('lr.mark');
    };
    tog.addEventListener('click', () => {
      learned.has(id) ? learned.delete(id) : learned.add(id);
      saveLearned(); sync(); renderProgress();
      if (libFilter !== 'all') renderLib();
    });
    sync();
    wrap.append(card, tog);
    return { c, el: wrap, id };
  }

  function renderProgress() {
    const box = $('#lib-progress');
    if (libTab === 'cross') { box.hidden = true; return; }
    box.hidden = false;
    const total = (ALGS[libTab.toUpperCase()] || []).length;
    const done = [...learned].filter((id) => id.startsWith(libTab + '-')).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    box.innerHTML = `
      <div class="lp-meter">
        <span class="lp-label"><strong>${done}</strong> / ${total} ${t('lr.progress')}</span>
        <span class="lp-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}"><i style="width:${pct}%"></i></span>
      </div>
      <div class="lp-filter" role="group">
        ${['all', 'todo', 'done'].map((f) => `<button type="button" data-filter="${f}" aria-pressed="${libFilter === f}">${t('lr.' + f)}</button>`).join('')}
      </div>`;
    $$('[data-filter]', box).forEach((b) => b.addEventListener('click', () => { libFilter = b.dataset.filter; renderLib({ animate: true }); }));
  }

  /** Indicador que desliza até a aba selecionada da biblioteca. */
  function moveLibThumb() {
    const tabs = $('.lib-tabs');
    if (!tabs || tabs.offsetParent === null) return;
    let thumb = $('.lib-thumb', tabs);
    if (!thumb) {
      thumb = document.createElement('span');
      thumb.className = 'lib-thumb';
      thumb.setAttribute('aria-hidden', 'true');
      tabs.prepend(thumb);
      requestAnimationFrame(() => tabs.classList.add('has-thumb'));
    }
    const sel = $(`button[data-lib="${libTab}"]`, tabs);
    thumb.style.width = sel.offsetWidth + 'px';
    thumb.style.transform = `translateX(${sel.offsetLeft - 5}px)`;
  }

  function renderLib(opts = {}) {
    const grid = $('#lib-grid');
    grid.innerHTML = '';
    $('#lib-desc').innerHTML = LIB[libTab].desc();
    if (!libCache[libTab]) libCache[libTab] = LIB[libTab].items().map(libEntry);
    const q = $('#lib-search').value.trim().toLowerCase().replace(/[’´]/g, "'");
    let shown = 0;
    for (const { c, el, id } of libCache[libTab]) {
      const hay = (c.key || c.title + ' ' + c.alg).toLowerCase();
      let ok = !q || (/^\d+$/.test(q) ? hay.split(' ')[0] === q || c.title.toLowerCase().endsWith(' ' + q) : hay.includes(q));
      if (ok && id && libFilter !== 'all') ok = libFilter === 'done' ? learned.has(id) : !learned.has(id);
      if (ok) { grid.appendChild(el); shown++; }
    }
    if (!shown) grid.innerHTML = `<p class="empty">${t('l.empty')}</p>`;
    $$('.lib-tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.lib === libTab)));
    renderProgress();
    moveLibThumb();
    if (opts.animate && !reduceMotion) {
      // cards entram em cascata (só os primeiros, o resto aparece junto)
      grid.classList.remove('is-entering');
      [...grid.children].forEach((el, i) => el.style.setProperty('--i', Math.min(i, 14)));
      void grid.offsetWidth;
      grid.classList.add('is-entering');
      clearTimeout(renderLib.timer);
      renderLib.timer = setTimeout(() => grid.classList.remove('is-entering'), 1100);
    }
  }

  /* ---------- troca de idioma (igual ao portfolio) ---------- */
  function applyLanguage(next, persist = true) {
    lang = next === 'pt' ? 'pt' : 'en';
    const root = document.documentElement;
    root.lang = lang === 'pt' ? 'pt-BR' : 'en';
    if (persist) { try { localStorage.setItem(STORAGE_LANG, lang); } catch (e) { /* sem storage */ } }
    $$('[data-i18n]').forEach((el) => { el.innerHTML = t(el.dataset.i18n); });
    $$('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
    $$('[data-i18n-title]').forEach((el) => el.setAttribute('title', t(el.dataset.i18nTitle)));
    $$('[data-i18n-ph]').forEach((el) => el.setAttribute('placeholder', t(el.dataset.i18nPh)));
    document.title = t('meta.title');
    $('meta[name="description"]').setAttribute('content', t('meta.desc'));
    $$('.lang-switch').forEach((group) => {
      const thumb = group.querySelector('.lang-thumb');
      if (thumb && group.dataset.langActive !== lang) {
        thumb.classList.remove('is-moving');
        void thumb.offsetWidth; // reinicia a animação de esticar
        thumb.classList.add('is-moving');
      }
      group.dataset.langActive = lang;
    });
    $$('[data-lang]').forEach((b) => {
      const active = b.dataset.lang === lang;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-pressed', String(active));
    });
    // conteúdo gerado
    renderNotation('#notation-grid', NOTATION_BASIC, D().notationBasic, t('x.notation'));
    renderNotation('#adv-notation-grid', NOTATION_ADV, D().notationAdv, t('x.notationCfop'));
    renderSteps();
    libCache = {};
    renderLib();
    if (player.el) player.mark();
    document.dispatchEvent(new CustomEvent('langchange', { detail: lang }));
  }

  /* o texto da página faz um fade cruzado; a bolinha do seletor desliza no CSS */
  function switchLanguage(next) {
    const target = next === 'pt' ? 'pt' : 'en';
    if (target === lang) return;
    const root = document.documentElement;
    if (!document.startViewTransition || reduceMotion) { applyLanguage(target); return; }
    root.dataset.nav = 'lang';
    const vt = document.startViewTransition(() => applyLanguage(target));
    // transição abortada (ex.: aba oculta): o texto já foi trocado, só silencia o aviso
    vt.ready.catch(() => {});
    if (vt.updateCallbackDone) vt.updateCallbackDone.catch(() => {});
    if (document.hidden) vt.skipTransition();
    vt.finished.catch(() => {}).finally(() => { delete root.dataset.nav; });
  }

  /* ---------- boot ---------- */
  let heroes = [];
  function boot() {
    player.init();
    renderPieces();
    applyLanguage(lang, false); // textos estáticos + seções geradas
    $$('[data-current-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });
    $$('[data-lang]').forEach((b) => b.addEventListener('click', () => switchLanguage(b.dataset.lang)));

    $$('.lib-tabs button').forEach((b) => b.addEventListener('click', () => {
      if (libTab === b.dataset.lib) return;
      libTab = b.dataset.lib; libFilter = 'all'; renderLib({ animate: true });
    }));
    $('#lib-search').addEventListener('input', () => renderLib());
    $$('.mode-switch button').forEach((b) => b.addEventListener('click', () => switchMode(b.dataset.mode)));
    $$('[data-go]').forEach((b) => b.addEventListener('click', () => switchMode(b.dataset.go)));
    setupScrollSpy();
    setupBackToTop();
    window.addEventListener('resize', moveLibThumb);
    document.fonts?.ready.then(moveLibThumb);

    const tperm = ALGS.PLL.find((p) => p.name === 'T').alg;
    heroes = [
      new HeroLoop($('#hero-basic'), 'basic', [900, "R U R' U'", "R U R' U'", "R U R' U'", 700, "R U R' U'", "R U R' U'", "R U R' U'", 1600]),
      new HeroLoop($('#hero-advanced'), 'advanced', [900, 'M2 E2 S2', 1600, 'M2 E2 S2', 900, tperm, 900, tperm, 1600]),
    ];
    document.addEventListener('visibilitychange', () => heroes.forEach((h) => h.sync()));

    // o modo vem do endereço (/ ou /cfop/); "index.html" some do endereço
    setMode(modeFromPath(), { silent: true });
    if (/\/index\.html$/.test(location.pathname)) history.replaceState(null, '', modeUrl(mode) + location.search);
    const startHash = location.hash.slice(1);
    cleanUrl();
    if (startHash && startHash !== 'avancado' && startHash !== 'basico') {
      requestAnimationFrame(() => document.getElementById(startHash)?.scrollIntoView());
    }
    setupAnchors();
    // voltar/avançar do navegador entre / e /cfop/
    window.addEventListener('popstate', () => switchMode(modeFromPath(), { fromHistory: true }));
    // vidro líquido só quando a barra da biblioteca está "grudada" no topo
    const toolbar = $('.lib-toolbar');
    const checkStuck = () => {
      if (toolbar.offsetParent === null) return; // modo escondido
      const stickTop = parseFloat(getComputedStyle(toolbar).top) || 0;
      toolbar.classList.toggle('is-stuck', toolbar.getBoundingClientRect().top <= stickTop + 1);
    };
    window.addEventListener('scroll', checkStuck, { passive: true });
    window.addEventListener('resize', checkStuck);
    $$('.mode-switch button').forEach((b) => b.addEventListener('click', () => requestAnimationFrame(() => { checkStuck(); moveLibThumb(); })));
    checkStuck();

    window.addEventListener('hashchange', () => {
      const h = location.hash;
      cleanUrl();
      if (h === '#avancado') switchMode('advanced');
      if (h === '#basico') switchMode('basic');
    });
  }

  /** Deixa a barra de endereço só com o caminho (…/rubiks-cube/), sem #. */
  function cleanUrl() {
    if (location.hash) history.replaceState(history.state, '', location.pathname + location.search);
  }

  /** Links internos (#passos, #biblioteca…) rolam até a seção sem mudar a URL. */
  function setupAnchors() {
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const id = a.getAttribute('href').slice(1);
      e.preventDefault();
      const target = id === 'topo' ? null : document.getElementById(id);
      if (target) target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      else window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }

  /* ---------- menu: destaca a seção que está na tela ---------- */
  function setupScrollSpy() {
    const links = $$('.topnav a[href^="#"]');
    const byId = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
    const visible = new Map();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => visible.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0));
      let bestId = null, bestR = 0;
      visible.forEach((r, id) => { if (r > bestR) { bestR = r; bestId = id; } });
      links.forEach((a) => a.classList.toggle('is-active', a === byId.get(bestId)));
    }, { rootMargin: '-80px 0px -45% 0px', threshold: [0, .15, .4, .7] });
    byId.forEach((a, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
  }

  /* ---------- botão voltar ao topo ---------- */
  function setupBackToTop() {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'to-top';
    b.dataset.i18nAria = 'x.toTop';
    b.setAttribute('aria-label', t('x.toTop'));
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    b.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));
    document.body.appendChild(b);
    const sync = () => b.classList.toggle('is-shown', window.scrollY > 900);
    window.addEventListener('scroll', sync, { passive: true });
    sync();
  }

  // scripts ficam no fim do <body>: o HTML acima já existe, então monta já (antes da 1ª pintura)
  boot();
  const ready = () => document.documentElement.classList.remove('is-loading');
  requestAnimationFrame(() => requestAnimationFrame(ready));
  setTimeout(ready, 700); // aba em segundo plano não roda rAF
})();
