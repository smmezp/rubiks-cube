/* =========================================================
   Timer de speedcubing (página timer.html)

   Fluxo:  IDLE ──segura──▶ HOLD ──300 ms──▶ READY ──solta──▶ RUNNING
                    ▲  solta cedo │                                │ qualquer tecla / toque
                    └─────────────┘                                ▼
           IDLE ◀──────────── solta tudo ─────────────────────── STOPPED
   Com inspeção:  IDLE ──toca e solta──▶ INSPECT (15 s) ──segura──▶ HOLD …

   • Tecla repetida (auto-repeat) é ignorada.
   • A tecla/toque que para o timer nunca inicia outro: o estado STOPPED
     espera tudo ser solto antes de aceitar uma nova largada.
   • O tempo é medido com performance.now(); a tela só desenha.
   ========================================================= */
(function () {
  'use strict';
  const { Cube, Cube3D, I18N } = window;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // celular/tablet sem teclado: as dicas falam de tocar, não de "espaço"
  const touch = matchMedia('(hover: none) and (pointer: coarse)').matches;

  /* ---------- idioma ---------- */
  const STORAGE_LANG = 'medeiros-lang';
  let lang = document.documentElement.lang === 'pt-BR' ? 'pt' : 'en';
  const t = (k) => I18N[lang][k] ?? I18N.en[k] ?? k;
  function applyLanguage(next, persist = true) {
    lang = next === 'pt' ? 'pt' : 'en';
    document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en';
    if (persist) { try { localStorage.setItem(STORAGE_LANG, lang); } catch (e) { /* ok */ } }
    $$('[data-i18n]').forEach((el) => { el.innerHTML = t(el.dataset.i18n); });
    $$('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
    $$('[data-i18n-title]').forEach((el) => el.setAttribute('title', t(el.dataset.i18nTitle)));
    document.title = t('tm.title');
    $$('.lang-switch').forEach((g) => {
      const thumb = g.querySelector('.lang-thumb');
      if (thumb && g.dataset.langActive !== lang) { thumb.classList.remove('is-moving'); void thumb.offsetWidth; thumb.classList.add('is-moving'); }
      g.dataset.langActive = lang;
    });
    $$('[data-lang]').forEach((b) => { const on = b.dataset.lang === lang; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on)); });
    renderStats(); renderList(); showStatus();
  }

  /* ---------- dados ---------- */
  const KEY = 'cubo-times';
  let times = [];
  try { times = JSON.parse(localStorage.getItem(KEY) || '[]').filter((s) => s && typeof s.ms === 'number'); } catch (e) { times = []; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(times.slice(-1000))); } catch (e) { /* ok */ } };

  const value = (s) => (s.pen === 'DNF' ? Infinity : s.ms + (s.pen === '+2' ? 2000 : 0));
  function fmt(ms, digits = 2) {
    if (ms === Infinity) return 'DNF';
    if (ms == null || Number.isNaN(ms)) return '—';
    const f = Math.pow(10, digits);
    const total = Math.floor(ms / (1000 / f)) / f; // trunca (padrão WCA), não arredonda
    const m = Math.floor(total / 60);
    const s = (total - m * 60).toFixed(digits);
    return m ? `${m}:${s.padStart(digits + 3, '0')}` : s;
  }
  /** Média no estilo WCA: descarta 5% melhores/piores (mín. 1 de cada lado). */
  function avg(n) {
    if (times.length < n) return null;
    const vals = times.slice(-n).map(value).sort((a, b) => a - b);
    const cut = Math.max(1, Math.ceil(n * 0.05));
    const mid = vals.slice(cut, n - cut);
    return mid.some((v) => v === Infinity) ? Infinity : mid.reduce((a, b) => a + b, 0) / mid.length;
  }
  const valid = () => times.map(value).filter((v) => v !== Infinity);
  const best = () => { const v = valid(); return v.length ? Math.min(...v) : null; };
  const mean = () => { const v = valid(); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };

  /* ---------- elementos ---------- */
  const pad = $('#tm-pad');
  const timeEl = $('#tm-time');
  const statusEl = $('#tm-status');
  const lastBox = $('#tm-last');
  const inspectionEl = $('#tm-inspection');

  /* ---------- embaralhamento ---------- */
  let scr = '';
  let prevScr = '';
  let cube = null;
  // Embaralhamentos oficiais (WCA) são feitos com BRANCO em cima e VERDE na frente.
  // O motor usa amarelo em cima / azul na frente, então giramos o cubo inteiro (x2) antes.
  const WCA_START = () => Cube.apply(Cube.solved(), 'x2');
  const scrambled = (s) => Cube.apply(WCA_START(), s);
  function setScramble(s) {
    scr = s;
    $('#tm-scramble').innerHTML = s.split(' ').map((m) => `<span>${m.replace(/'/g, '’')}</span>`).join(' ');
    if (cube) cube.setState(scrambled(s)); // também cancela um "ver embaralhando" em andamento
    $('#tm-prev').disabled = !prevScr;
  }
  function nextScramble() { prevScr = scr; setScramble(Cube.scramble()); }

  /* ---------- máquina de estados ---------- */
  const HOLD_MS = 300;
  let phase = 'idle';
  let holdTimer = 0, raf = 0;
  let startAt = 0, inspectAt = 0, inspectPen = '';
  let downCount = 0; // teclas/toques pressionados (para o STOPPED esperar soltar tudo)
  let fromInspect = false;

  function setPhase(p) {
    phase = p;
    pad.dataset.phase = p;
    document.body.classList.toggle('is-timing', p === 'running' || p === 'ready' || p === 'hold' || p === 'inspect');
    showStatus();
  }
  function showStatus() {
    const msg = {
      idle: inspectionEl.checked ? t(touch ? 'tm.hintInspectTouch' : 'tm.hintInspect') : t(touch ? 'tm.hintTouch' : 'tm.hint'),
      hold: t('tm.holding'),
      ready: t('tm.release'),
      running: '',
      inspect: t(touch ? 'tm.inspectingTouch' : 'tm.inspecting'),
      stopped: '',
    }[phase] ?? '';
    statusEl.innerHTML = msg;
  }
  const draw = (txt) => { timeEl.textContent = txt; };

  function loopRun() {
    draw(fmt(performance.now() - startAt, 2));
    raf = requestAnimationFrame(loopRun);
  }
  function loopInspect() {
    const left = 15 - (performance.now() - inspectAt) / 1000;
    if (left > 0) { draw(String(Math.ceil(left))); inspectPen = ''; }
    else if (left > -2) { draw('+2'); inspectPen = '+2'; }
    else { draw('DNF'); inspectPen = 'DNF'; }
    pad.classList.toggle('warn', left <= 7 && left > 3);
    pad.classList.toggle('late', left <= 3);
    raf = requestAnimationFrame(loopInspect);
  }
  function stopLoops() { cancelAnimationFrame(raf); raf = 0; pad.classList.remove('warn', 'late'); }

  function onDown() {
    downCount++;
    switch (phase) {
      case 'running': finish(); break; // qualquer tecla/toque para
      case 'idle':
        lastBox.hidden = true;
        if (inspectionEl.checked) { setPhase('inspect-armed'); break; } // inspeção começa ao soltar
        startHold(false); break;
      case 'inspect': startHold(true); break;
      default: break; // hold/ready/stopped: ignora
    }
  }
  function onUp() {
    downCount = Math.max(0, downCount - 1);
    switch (phase) {
      case 'inspect-armed':
        setPhase('inspect'); inspectAt = performance.now(); inspectPen = ''; stopLoops(); loopInspect(); break;
      case 'hold': // soltou antes de ficar verde: volta
        clearTimeout(holdTimer);
        setPhase(fromInspect ? 'inspect' : 'idle');
        if (!fromInspect) drawLast();
        break;
      case 'ready': start(); break;
      case 'stopped': if (downCount === 0) setPhase('idle'); break;
      default: break;
    }
  }
  function startHold(insp) {
    fromInspect = insp;
    setPhase('hold');
    if (!insp) draw(fmt(0));
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => { if (phase === 'hold') setPhase('ready'); }, HOLD_MS);
  }
  function start() {
    stopLoops();
    setPhase('running');
    startAt = performance.now();
    loopRun();
  }
  function finish() {
    const ms = Math.round(performance.now() - startAt);
    stopLoops();
    const pen = inspectionEl.checked ? inspectPen : '';
    times.push({ ms, pen, scr, at: Date.now() });
    save();
    setPhase(downCount > 0 ? 'stopped' : 'idle');
    drawLast();
    lastBox.hidden = false;
    markLastPen();
    renderStats(); renderList();
    nextScramble();
  }
  function cancel() {
    clearTimeout(holdTimer); stopLoops();
    setPhase('idle'); drawLast();
  }
  function drawLast() { draw(times.length ? fmt(value(times[times.length - 1])) : fmt(0)); }

  /* ---------- entrada: teclado ---------- */
  const isField = (el) => el && (/^(input|textarea|select)$/i.test(el.tagName) && el.type !== 'checkbox');
  document.addEventListener('keydown', (e) => {
    if (isField(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape') { if (phase !== 'idle' && phase !== 'running') { e.preventDefault(); cancel(); } return; }
    if (phase === 'running') { e.preventDefault(); if (!e.repeat) onDown(); return; }
    if (e.code !== 'Space') return;
    e.preventDefault(); // não rola a página nem "clica" botões focados
    if (e.repeat) return;
    onDown();
  });
  document.addEventListener('keyup', (e) => {
    if (isField(e.target)) return;
    if (e.code === 'Space' || phase === 'stopped') {
      if (e.code === 'Space') e.preventDefault();
      onUp();
    }
  });
  // se a janela perde o foco segurando a tecla, não fica preso
  window.addEventListener('blur', () => { downCount = 0; if (phase === 'hold' || phase === 'ready' || phase === 'inspect-armed') cancel(); if (phase === 'stopped') setPhase('idle'); });

  /* ---------- entrada: toque / mouse ---------- */
  pad.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('button')) return;
    e.preventDefault();
    pad.setPointerCapture?.(e.pointerId);
    onDown();
  });
  pad.addEventListener('pointerup', (e) => { if (!e.target.closest('button')) onUp(); });
  pad.addEventListener('pointercancel', () => { downCount = 0; if (phase !== 'running') cancel(); });
  pad.addEventListener('contextmenu', (e) => e.preventDefault());
  // com o timer rodando, tocar em qualquer lugar da tela para
  document.addEventListener('pointerdown', (e) => {
    if (phase === 'running' && !pad.contains(e.target)) { e.preventDefault(); onDown(); }
  }, true);
  document.addEventListener('pointerup', (e) => {
    if (phase === 'stopped' && !pad.contains(e.target)) onUp();
  }, true);

  /* ---------- penalidade do último tempo ---------- */
  function markLastPen() {
    const last = times[times.length - 1];
    $$('.tm-pen', lastBox).forEach((b) => b.setAttribute('aria-pressed', String(!!last && b.dataset.pen === last.pen && b.dataset.pen !== 'del')));
  }
  lastBox.addEventListener('click', (e) => {
    const b = e.target.closest('.tm-pen');
    if (!b || !times.length) return;
    if (b.dataset.pen === 'del') { times.pop(); lastBox.hidden = true; }
    else times[times.length - 1].pen = b.dataset.pen;
    save(); drawLast(); markLastPen(); renderStats(); renderList();
    b.blur(); // espaço não deve "clicar" o botão de novo
  });

  /* ---------- estatísticas e lista ---------- */
  function renderStats() {
    $('#st-best').textContent = fmt(best());
    $('#st-ao5').textContent = fmt(avg(5));
    $('#st-ao12').textContent = fmt(avg(12));
    $('#st-ao100').textContent = fmt(avg(100));
    $('#st-mean').textContent = fmt(mean());
    $('#st-count').textContent = String(times.length);
  }
  function renderList() {
    const list = $('#tm-list');
    if (!times.length) { list.innerHTML = `<li class="tm-empty">${t('tm.empty')}</li>`; return; }
    const bestV = best();
    list.innerHTML = times.map((s, i) => ({ s, i })).reverse().slice(0, 200).map(({ s, i }) => `
      <li title="${s.scr || ''}">
        <span class="tl-n">${i + 1}</span>
        <span class="tl-time${s.pen ? ' pen' : ''}${value(s) === bestV ? ' best' : ''}">${fmt(value(s))}${s.pen === '+2' ? '<small>+2</small>' : ''}</span>
        <span class="tl-actions">
          <button type="button" data-act="+2" data-i="${i}" aria-pressed="${s.pen === '+2'}">+2</button>
          <button type="button" data-act="DNF" data-i="${i}" aria-pressed="${s.pen === 'DNF'}">DNF</button>
          <button type="button" data-act="del" data-i="${i}" aria-label="${t('tm.delete')}">×</button>
        </span>
      </li>`).join('');
  }
  $('#tm-list').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const i = +b.dataset.i;
    if (!times[i]) return;
    if (b.dataset.act === 'del') times.splice(i, 1);
    else times[i].pen = times[i].pen === b.dataset.act ? '' : b.dataset.act;
    save(); renderStats(); renderList(); markLastPen();
    if (phase === 'idle') drawLast();
    b.blur();
  });
  $('#tm-clear').addEventListener('click', (e) => {
    e.currentTarget.blur();
    if (!times.length || !confirm(t('tm.confirmClear'))) return;
    times = []; save(); renderStats(); renderList(); lastBox.hidden = true; draw(fmt(0));
  });

  /* ---------- botões ---------- */
  $('#tm-next').addEventListener('click', (e) => { e.currentTarget.blur(); nextScramble(); });
  $('#tm-prev').addEventListener('click', (e) => { e.currentTarget.blur(); if (prevScr) { const p = prevScr; prevScr = ''; setScramble(p); } });
  $('#tm-watch').addEventListener('click', async (e) => {
    const b = e.currentTarget; b.blur();
    if (!cube || cube.busy) return;
    if (reduceMotion) { cube.setState(scrambled(scr)); return; }
    cube.busy = true; b.disabled = true;
    cube.setState(WCA_START());
    await cube.run(scr, 140); // se o embaralhamento mudar no meio, para sozinho
    cube.busy = false; b.disabled = false;
  });
  try { inspectionEl.checked = localStorage.getItem('cubo-inspection') === '1'; } catch (e) { /* ok */ }
  inspectionEl.addEventListener('change', () => {
    try { localStorage.setItem('cubo-inspection', inspectionEl.checked ? '1' : '0'); } catch (e) { /* ok */ }
    inspectionEl.blur(); showStatus();
  });
  $$('[data-lang]').forEach((b) => b.addEventListener('click', () => { applyLanguage(b.dataset.lang); b.blur(); }));
  // outra aba mudou os tempos (ex.: duas abas abertas)
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY || phase !== 'idle') return;
    try { times = JSON.parse(e.newValue || '[]'); } catch (err) { times = []; }
    renderStats(); renderList(); drawLast();
  });

  /* ---------- início ---------- */
  // "Voltar ao guia" leva para o modo em que você estava: /rubiks-cube/ ou /rubiks-cube/cfop/
  try {
    if (localStorage.getItem('cubo-mode') === 'advanced') $$('[data-guide-link]').forEach((a) => a.setAttribute('href', 'cfop/'));
  } catch (e) { /* ok */ }
  cube = new Cube3D($('#tm-cube'), { size: 30, rx: -24, ry: -38 });
  $$('[data-current-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });
  setScramble(Cube.scramble());
  applyLanguage(lang, false);
  const ready = () => document.documentElement.classList.remove('is-loading');
  requestAnimationFrame(() => requestAnimationFrame(ready));
  setTimeout(ready, 700); // aba em segundo plano não roda rAF
  drawLast();
})();
