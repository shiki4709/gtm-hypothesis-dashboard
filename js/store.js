/* ================================================================
   Store — localStorage CRUD + shared utilities
   ================================================================ */

function load() {
  var s = localStorage.getItem(K);
  if (s) return JSON.parse(s);
  save(D);
  return D;
}

function save(d) {
  localStorage.setItem(K, JSON.stringify(d));
}

function flash() {
  var el = document.getElementById('saved');
  el.classList.add('show');
  setTimeout(function() { el.classList.remove('show'); }, 1200);
}

function loadWE() {
  var s = localStorage.getItem(WE_KEY);
  if (s) return JSON.parse(s);
  weSelectedIdx = WE_SEED.length - 1;
  saveWE(WE_SEED);
  return WE_SEED;
}

function saveWE(d) {
  localStorage.setItem(WE_KEY, JSON.stringify(d));
}

/* --- Formatting --- */
function formatNum(n) {
  if (n >= 10000) return (n / 1000).toFixed(0) + 'k';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toString();
}

function calcDelta(curr, prev) {
  if (prev === 0 && curr === 0) return { text: '—', cls: 'flat' };
  if (prev === 0) return { text: '+' + formatNum(curr), cls: 'up' };
  var pct = Math.round(((curr - prev) / prev) * 100);
  if (pct > 0) return { text: '+' + pct + '%', cls: 'up' };
  if (pct < 0) return { text: pct + '%', cls: 'down' };
  return { text: '0%', cls: 'flat' };
}

function calcCellDelta(curr, prev) {
  if (prev === undefined || prev === null) return { text: 'new', cls: 'new-exp' };
  var diff = curr - prev;
  if (diff === 0) return null;
  if (diff > 0) return { text: '+' + formatNum(diff), cls: 'up' };
  return { text: formatNum(diff), cls: 'down' };
}

function verdictCls(v) {
  if (!v || v === 'pending') return 'pending';
  if (v === 'Keep going') return 'keep';
  if (v === 'Change variables') return 'change';
  if (v === 'Close, iterate') return 'close';
  return 'stop';
}
