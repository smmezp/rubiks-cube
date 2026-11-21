/* =========================================================
   Timer de speedcubing (página /timer/)

   Fluxo:  IDLE ──segura──▶ HOLD ──300 ms──▶ READY ──solta──▶ RUNNING
                    ▲  solta cedo │                                │ qualquer tecla / toque
                    └─────────────┘                                ▼
           IDLE ◀──────────── solta tudo ─────────────────────── STOPPED
   Com inspeção:  IDLE ──toca e solta──▶ INSPECT (15 s) ──segura──▶ HOLD …

   • Tecla repetida (auto-repeat) é ignorada.
   • A tecla/toque que para o timer nunca inicia outro: o estado STOPPED
     espera tudo ser solto antes de aceitar uma nova largada.
   • O tempo é medido com performance.now(); a tela só desenha.

   Extras: sessões, recordes (melhor single/ao5/ao12/ao100) com aviso de PB,
   gráfico de evolução, detalhes de cada tempo, exportar CSV e atalhos.
   ========================================================= */
(function () {
  'use strict';
  const { Cube, Cube3D, I18N } = window;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // celular/tablet sem teclado: as dicas falam de tocar, não de "espaço"
  const touch = matchMedia('(hover: none) and (pointer: coarse)').matches;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

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
    renderAll(); showStatus();
  }

  /* =========================================================
     Dados: sessões { current, list: [{ id, name, times: [{ms, pen, scr, at}] }] }
     (migra os tempos antigos de "cubo-times" para a primeira sessão)
     ========================================================= */
  const KEY = 'cubo-sessions';
  const OLD_KEY = 'cubo-times';
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  let db = null;
  function load() {
    try { db = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { db = null; }
    if (!db || !Array.isArray(db.list) || !db.list.length) {
      let old = [];
      try { old = JSON.parse(localStorage.getItem(OLD_KEY) || '[]'); } catch (e) { old = []; }
      db = { current: null, list: [{ id: uid(), name: '', times: Array.isArray(old) ? old : [] }] };
      db.current = db.list[0].id;
    }
    db.list.forEach((s) => { s.times = (s.times || []).filter((x) => x && typeof x.ms === 'number'); });
    if (!db.list.some((s) => s.id === db.current)) db.current = db.list[0].id;
  }
  const session = () => db.list.find((s) => s.id === db.current);
  const sessionName = (s, i) => s.name || `${t('tm.sessionName')} ${i + 1}`;
  let times = [];
  function useSession(id) { db.current = id; times = session().times; save(); }
  function save() {
    session().times = times.slice(-2000);
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* sem storage */ }
  }

  /* ---------- números ---------- */
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
  /** Média no estilo WCA de uma janela: descarta 5% melhores/piores (mín. 1 de cada lado). */
  function avgOf(list) {
    const n = list.length;
    const vals = list.map(value).sort((a, b) => a - b);
    const cut = Math.max(1, Math.ceil(n * 0.05));
    const mid = vals.slice(cut, n - cut);
    return mid.some((v) => v === Infinity) ? Infinity : mid.reduce((a, b) => a + b, 0) / mid.length;
  }
  /** ao-N terminando em cada resolução (null antes de ter N tempos). */
  function rolling(n) {
    return times.map((_, i) => (i + 1 < n ? null : avgOf(times.slice(i + 1 - n, i + 1))));
  }
  const minOf = (arr) => { const v = arr.filter((x) => x != null && x !== Infinity); return v.length ? Math.min(...v) : null; };
  const valid = () => times.map(value).filter((v) => v !== Infinity);
  const best = () => minOf(times.map(value));
  const mean = () => { const v = valid(); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };

  /* ---------- elementos ---------- */
  const pad = $('#tm-pad');
  const timeEl = $('#tm-time');
  const statusEl = $('#tm-status');
  const lastBox = $('#tm-last');
  const pbEl = $('#tm-pb');
  const inspectionEl = $('#tm-inspection');
  const hideEl = $('#tm-hide');

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
    // "esconder o tempo": mostra só "Resolvendo…" até parar
    draw(hideEl.checked ? t('tm.solving') : fmt(performance.now() - startAt, 2));
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
        lastBox.hidden = true; hidePB();
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
    const before = records();
    times.push({ ms, pen, scr, at: Date.now() });
    save();
    setPhase(downCount > 0 ? 'stopped' : 'idle');
    drawLast();
    lastBox.hidden = false;
    markLastPen();
    renderAll();
    checkPB(before);
    nextScramble();
  }
  function cancel() {
    clearTimeout(holdTimer); stopLoops();
    setPhase('idle'); drawLast();
  }
  function drawLast() { draw(times.length ? fmt(value(times[times.length - 1])) : fmt(0)); }

  /* ---------- recordes (PB) ---------- */
  function records() {
    return { single: best(), ao5: minOf(rolling(5)), ao12: minOf(rolling(12)) };
  }
  let pbTimer = 0;
  function hidePB() { pbEl.hidden = true; pad.classList.remove('is-pb'); }
  function checkPB(before) {
    const now = records();
    const last = times[times.length - 1];
    const hits = [];
    // só conta como recorde se já existia um antes (o 1º tempo não é "PB")
    if (before.single != null && value(last) < before.single) hits.push(t('tm.pbSingle'));
    if (before.ao5 != null && now.ao5 != null && now.ao5 < before.ao5) hits.push('ao5');
    if (before.ao12 != null && now.ao12 != null && now.ao12 < before.ao12) hits.push('ao12');
    if (!hits.length) return;
    pbEl.textContent = `${t('tm.pb')} ${hits.join(' · ')}`;
    pbEl.hidden = false;
    pad.classList.remove('is-pb'); void pad.offsetWidth; pad.classList.add('is-pb');
    clearTimeout(pbTimer);
    pbTimer = setTimeout(hidePB, 6000);
  }

  /* ---------- entrada: teclado ---------- */
  const isField = (el) => el && (/^(input|textarea|select)$/i.test(el.tagName) && el.type !== 'checkbox');
  const dialogOpen = () => $('#tm-detail').open;
  document.addEventListener('keydown', (e) => {
    if (isField(e.target) || e.ctrlKey || e.metaKey || e.altKey || dialogOpen()) return;
    if (e.key === 'Escape') { if (phase !== 'idle' && phase !== 'running') { e.preventDefault(); cancel(); } return; }
    if (phase === 'running') { e.preventDefault(); if (!e.repeat) onDown(); return; }
    // atalhos com o timer parado
    if (phase === 'idle' && !e.repeat) {
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); nextScramble(); return; }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (times.length && confirm(t('tm.confirmDeleteLast'))) { times.pop(); save(); lastBox.hidden = true; hidePB(); renderAll(); drawLast(); }
        e.preventDefault(); return;
      }
    }
    if (e.code !== 'Space') return;
    e.preventDefault(); // não rola a página nem "clica" botões focados
    if (e.repeat) return;
    onDown();
  });
  document.addEventListener('keyup', (e) => {
    if (isField(e.target) || dialogOpen()) return;
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
    if (b.dataset.pen === 'del') { times.pop(); lastBox.hidden = true; hidePB(); }
    else times[times.length - 1].pen = b.dataset.pen;
    save(); drawLast(); markLastPen(); renderAll();
    b.blur(); // espaço não deve "clicar" o botão de novo
  });

  /* =========================================================
     Desenho: estatísticas, lista, sessões, gráfico
     ========================================================= */
  function renderAll() { renderSessions(); renderStats(); renderList(); renderChart(); }

  function renderStats() {
    const cur = (n) => (times.length >= n ? avgOf(times.slice(-n)) : null);
    $('#st-last').textContent = times.length ? fmt(value(times[times.length - 1])) : '—';
    $('#st-best').textContent = fmt(best());
    $('#st-ao5').textContent = fmt(cur(5));
    $('#st-ao12').textContent = fmt(cur(12));
    $('#st-ao100').textContent = fmt(cur(100));
    $('#st-bao5').textContent = fmt(minOf(rolling(5)));
    $('#st-bao12').textContent = fmt(minOf(rolling(12)));
    $('#st-bao100').textContent = fmt(minOf(rolling(100)));
    $('#st-mean').textContent = fmt(mean());
    $('#st-count').textContent = String(times.length);
  }

  function renderList() {
    const list = $('#tm-list');
    if (!times.length) { list.innerHTML = `<li class="tm-empty">${t('tm.empty')}</li>`; return; }
    const bestV = best();
    list.innerHTML = times.map((s, i) => ({ s, i })).reverse().slice(0, 300).map(({ s, i }) => `
      <li>
        <button type="button" class="tl-open" data-open="${i}" aria-label="${t('tm.details')} #${i + 1}">
          <span class="tl-n">${i + 1}</span>
          <span class="tl-time${s.pen ? ' pen' : ''}${value(s) === bestV ? ' best' : ''}">${fmt(value(s))}${s.pen === '+2' ? '<small>+2</small>' : ''}</span>
        </button>
        <span class="tl-actions">
          <button type="button" data-act="+2" data-i="${i}" aria-pressed="${s.pen === '+2'}">+2</button>
          <button type="button" data-act="DNF" data-i="${i}" aria-pressed="${s.pen === 'DNF'}">DNF</button>
          <button type="button" data-act="del" data-i="${i}" aria-label="${t('tm.delete')}">×</button>
        </span>
      </li>`).join('');
  }
  $('#tm-list').addEventListener('click', (e) => {
    const open = e.target.closest('[data-open]');
    if (open) { openDetail(+open.dataset.open); return; }
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const i = +b.dataset.i;
    if (!times[i]) return;
    if (b.dataset.act === 'del') times.splice(i, 1);
    else times[i].pen = times[i].pen === b.dataset.act ? '' : b.dataset.act;
    save(); renderAll(); markLastPen();
    if (phase === 'idle') drawLast();
    b.blur();
  });

  /* ---------- sessões ---------- */
  function renderSessions() {
    const sel = $('#tm-session');
    sel.innerHTML = db.list.map((s, i) => `<option value="${s.id}"${s.id === db.current ? ' selected' : ''}>${esc(sessionName(s, i))} (${s.times.length})</option>`).join('');
    $('#tm-session-delete').disabled = db.list.length < 2;
  }
  $('#tm-session').addEventListener('change', (e) => {
    useSession(e.target.value); lastBox.hidden = true; hidePB(); renderAll(); drawLast(); e.target.blur();
  });
  $('#tm-session-new').addEventListener('click', (e) => {
    e.currentTarget.blur();
    const name = prompt(t('tm.promptName'), `${t('tm.sessionName')} ${db.list.length + 1}`);
    if (name === null) return;
    const s = { id: uid(), name: name.trim().slice(0, 40), times: [] };
    db.list.push(s);
    useSession(s.id); lastBox.hidden = true; hidePB(); renderAll(); drawLast();
  });
  $('#tm-session-rename').addEventListener('click', (e) => {
    e.currentTarget.blur();
    const i = db.list.findIndex((s) => s.id === db.current);
    const name = prompt(t('tm.promptName'), sessionName(db.list[i], i));
    if (name === null) return;
    db.list[i].name = name.trim().slice(0, 40);
    save(); renderSessions();
  });
  $('#tm-session-delete').addEventListener('click', (e) => {
    e.currentTarget.blur();
    if (db.list.length < 2) return;
    const i = db.list.findIndex((s) => s.id === db.current);
    if (!confirm(t('tm.confirmDeleteSession').replace('{name}', sessionName(db.list[i], i)))) return;
    db.list.splice(i, 1);
    useSession(db.list[Math.max(0, i - 1)].id); lastBox.hidden = true; hidePB(); renderAll(); drawLast();
  });

  /* ---------- exportar (CSV) ---------- */
  $('#tm-export').addEventListener('click', (e) => {
    e.currentTarget.blur();
    if (!times.length) return;
    const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
    const rows = [['#', 'time', 'penalty', 'ms', 'scramble', 'date'].join(',')]
      .concat(times.map((s, i) => [i + 1, fmt(value(s)), s.pen || '', s.ms, q(s.scr || ''), new Date(s.at).toISOString()].join(',')));
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    const i = db.list.findIndex((s) => s.id === db.current);
    a.href = URL.createObjectURL(blob);
    a.download = `rubiks-times-${sessionName(db.list[i], i).replace(/[^\w-]+/g, '-').toLowerCase()}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  $('#tm-clear').addEventListener('click', (e) => {
    e.currentTarget.blur();
    if (!times.length || !confirm(t('tm.confirmClear'))) return;
    times.length = 0; save(); renderAll(); lastBox.hidden = true; hidePB(); draw(fmt(0));
  });

  /* ---------- detalhes de um tempo ---------- */
  const dlg = $('#tm-detail');
  let detailIdx = -1;
  function openDetail(i) {
    const s = times[i];
    if (!s) return;
    detailIdx = i;
    $('#tm-detail-title').textContent = `${t('tm.solve')} #${i + 1}`;
    $('#tm-detail-time').innerHTML = `${fmt(value(s))}${s.pen === '+2' ? ' <small>(+2)</small>' : ''}`;
    $('#tm-detail-date').textContent = s.at ? new Date(s.at).toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
    $('#tm-detail-ao5').textContent = i >= 4 ? fmt(avgOf(times.slice(i - 4, i + 1))) : '—';
    $('#tm-detail-scr').textContent = (s.scr || '—').replace(/'/g, '’');
    $$('[data-dpen]', dlg).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.dpen === (s.pen || ''))));
    $('#tm-detail-copy').textContent = t('tm.copyScramble');
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  }
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) { dlg.close(); return; } // clique fora fecha
    const p = e.target.closest('[data-dpen]');
    if (p && times[detailIdx]) {
      times[detailIdx].pen = p.dataset.dpen;
      save(); renderAll(); markLastPen(); if (phase === 'idle') drawLast();
      openDetail(detailIdx);
    }
  });
  $('#tm-detail-copy').addEventListener('click', async (e) => {
    const b = e.currentTarget;
    try { await navigator.clipboard.writeText(times[detailIdx]?.scr || ''); b.textContent = t('x.copied'); }
    catch (err) { b.textContent = '✕'; }
    setTimeout(() => { b.textContent = t('tm.copyScramble'); }, 1400);
  });
  $('#tm-detail-del').addEventListener('click', () => {
    if (!times[detailIdx]) return;
    times.splice(detailIdx, 1);
    save(); renderAll(); if (phase === 'idle') drawLast();
    dlg.close();
  });

  /* ---------- gráfico de evolução (singles + ao5) ---------- */
  const SVGNS = 'http://www.w3.org/2000/svg';
  function renderChart() {
    const host = $('#tm-chart');
    const N = 100; // últimas 100 resoluções
    const from = Math.max(0, times.length - N);
    const pts = times.slice(from).map((s, k) => ({ i: from + k, v: value(s) }));
    const ao5 = rolling(5).slice(from);
    const okVals = pts.map((p) => p.v).concat(ao5).filter((v) => v != null && v !== Infinity);
    if (times.length < 2 || okVals.length < 2) {
      host.innerHTML = `<p class="tm-chart-empty">${t('tm.chartEmpty')}</p>`;
      return;
    }
    const W = Math.max(280, host.clientWidth || 600), H = 200;
    const m = { l: 46, r: 12, t: 12, b: 24 };
    let lo = Math.min(...okVals), hi = Math.max(...okVals);
    const padV = Math.max(300, (hi - lo) * 0.12);
    lo = Math.max(0, lo - padV); hi += padV;
    const x = (k) => m.l + (pts.length === 1 ? 0 : (k / (pts.length - 1)) * (W - m.l - m.r));
    const y = (v) => m.t + (1 - (v - lo) / (hi - lo)) * (H - m.t - m.b);
    // 4 linhas de grade com valores "redondos"
    const step = niceStep((hi - lo) / 4);
    const ticks = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
    let svg = `<svg class="tm-chart-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(t('tm.progress'))}">`;
    ticks.forEach((v) => {
      svg += `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/>`;
      svg += `<text class="tick" x="${m.l - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${fmt(v, step < 1000 ? 1 : 0)}</text>`;
    });
    svg += `<text class="tick" x="${m.l}" y="${H - 6}">#${from + 1}</text>`;
    svg += `<text class="tick" x="${W - m.r}" y="${H - 6}" text-anchor="end">#${times.length}</text>`;
    // linha da ao5 (quebra onde não existe / DNF)
    let d = '';
    let pen = false;
    ao5.forEach((v, k) => {
      if (v == null || v === Infinity) { pen = false; return; }
      d += `${pen ? 'L' : 'M'}${x(k).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    if (d) svg += `<path class="ln-ao5" d="${d}"/>`;
    // pontos dos singles (DNF não aparece)
    pts.forEach((p, k) => {
      if (p.v === Infinity) return;
      svg += `<circle class="dot-single" cx="${x(k).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="4.5"/>`;
    });
    // camada de hover
    svg += `<line class="cross" id="tm-cross" x1="0" x2="0" y1="${m.t}" y2="${H - m.b}" visibility="hidden"/>`;
    svg += `<rect class="hit" x="${m.l}" y="0" width="${W - m.l - m.r}" height="${H}" fill="transparent"/>`;
    svg += '</svg><div class="tm-tip" id="tm-tip" hidden></div>';
    host.innerHTML = svg;

    const svgEl = host.querySelector('svg');
    const tip = $('#tm-tip');
    const cross = $('#tm-cross');
    const onMove = (ev) => {
      const r = svgEl.getBoundingClientRect();
      const px = ((ev.clientX - r.left) / r.width) * W;
      const k = Math.max(0, Math.min(pts.length - 1, Math.round(((px - m.l) / (W - m.l - m.r)) * (pts.length - 1))));
      const cx = x(k);
      cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('visibility', 'visible');
      const p = pts[k];
      tip.innerHTML = `<b>#${p.i + 1}</b><span><i class="lg-single"></i>${fmt(p.v)}</span><span><i class="lg-ao5"></i>ao5 ${fmt(ao5[k])}</span>`;
      tip.hidden = false;
      const left = (cx / W) * r.width;
      tip.style.left = `${Math.min(Math.max(left, 60), r.width - 60)}px`;
    };
    const onLeave = () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); };
    svgEl.addEventListener('pointermove', onMove);
    svgEl.addEventListener('pointerleave', onLeave);
    svgEl.addEventListener('click', (ev) => { // clicar num ponto abre os detalhes
      const r = svgEl.getBoundingClientRect();
      const px = ((ev.clientX - r.left) / r.width) * W;
      const k = Math.max(0, Math.min(pts.length - 1, Math.round(((px - m.l) / (W - m.l - m.r)) * (pts.length - 1))));
      openDetail(pts[k].i);
    });
  }
  function niceStep(raw) {
    const steps = [100, 200, 500, 1000, 2000, 5000, 10000, 15000, 30000, 60000, 120000, 300000];
    return steps.find((s) => s >= raw) || 600000;
  }
  let resizeT = 0;
  window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(renderChart, 150); });

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
  const bindSwitch = (el, key, after) => {
    try { el.checked = localStorage.getItem(key) === '1'; } catch (e) { /* ok */ }
    el.addEventListener('change', () => {
      try { localStorage.setItem(key, el.checked ? '1' : '0'); } catch (e) { /* ok */ }
      el.blur(); if (after) after();
    });
  };
  bindSwitch(inspectionEl, 'cubo-inspection', showStatus);
  bindSwitch(hideEl, 'cubo-hide-time');
  $$('[data-lang]').forEach((b) => b.addEventListener('click', () => { applyLanguage(b.dataset.lang); b.blur(); }));
  // outra aba mudou os tempos (ex.: duas abas abertas)
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY || phase !== 'idle') return;
    load(); times = session().times; renderAll(); drawLast();
  });

  /* ---------- início ---------- */
  // "Voltar ao guia" leva para o modo em que você estava: /rubiks-cube/ ou /rubiks-cube/cfop/
  try {
    if (localStorage.getItem('cubo-mode') === 'advanced') $$('[data-guide-link]').forEach((a) => a.setAttribute('href', 'cfop/'));
  } catch (e) { /* ok */ }
  load();
  times = session().times;
  save(); // grava já no formato novo de sessões
  cube = new Cube3D($('#tm-cube'), { size: 30, rx: -24, ry: -38 });
  $$('[data-current-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });
  setScramble(Cube.scramble());
  applyLanguage(lang, false);
  const ready = () => document.documentElement.classList.remove('is-loading');
  requestAnimationFrame(() => requestAnimationFrame(ready));
  setTimeout(ready, 700); // aba em segundo plano não roda rAF
  drawLast();
})();
