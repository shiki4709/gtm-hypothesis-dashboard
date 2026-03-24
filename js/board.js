/* ================================================================
   Board — Goal-down view

   Goal → What's working → Needs data → Below benchmark
   No channel tabs. Just experiments grouped by health.
   ================================================================ */

var activeMode = 'outbound';
var activeView = 'experiments';
var activeFlow = null;

function setMode(m) { activeMode = m; render(); }
function setView(v) { activeView = v; render(); }

function render() {
  var exps = load();

  // Sprint label
  var sp = loadSprint();
  document.getElementById('sprint-label').textContent = sp.name + ' · ' + sp.start + ' – ' + sp.end + ', ' + sp.year;

  // Mode toggle
  var outCount = exps.filter(function(e) { return CH[e.ch] && CH[e.ch].mode === 'outbound' && e.verdict !== 'Stop'; }).length;
  var inCount = exps.filter(function(e) { return CH[e.ch] && CH[e.ch].mode === 'inbound' && e.verdict !== 'Stop'; }).length;
  document.getElementById('mode-toggle').innerHTML =
    '<button class="mode-pill ' + (activeMode === 'outbound' ? 'active' : '') + '" onclick="setMode(\'outbound\')">Out <span class="mode-pill-n">' + outCount + '</span></button>' +
    '<button class="mode-pill ' + (activeMode === 'inbound' ? 'active' : '') + '" onclick="setMode(\'inbound\')">In <span class="mode-pill-n">' + inCount + '</span></button>';

  // View tabs
  document.getElementById('view-tabs').innerHTML =
    '<button class="vtab ' + (activeView === 'experiments' ? 'active' : '') + '" onclick="setView(\'experiments\')">Experiments</button>' +
    '<button class="vtab ' + (activeView === 'weekly' ? 'active' : '') + '" onclick="setView(\'weekly\')">Compare</button>';

  document.getElementById('view-experiments').style.display = activeView === 'experiments' ? 'block' : 'none';
  document.getElementById('view-weekly').style.display = activeView === 'weekly' ? 'block' : 'none';

  if (activeView === 'experiments') {
    renderGoalView(exps);
  } else {
    if (typeof renderTimeSeries === 'function') renderTimeSeries();
  }
}

/* ================================================================
   Goal-down view
   ================================================================ */

function renderGoalView(exps) {
  var el = document.getElementById('view-experiments');
  var isOut = activeMode === 'outbound';
  var modeExps = exps.filter(function(e) { return CH[e.ch] && CH[e.ch].mode === activeMode && e.verdict !== 'Stop'; });
  var stoppedExps = exps.filter(function(e) { return CH[e.ch] && CH[e.ch].mode === activeMode && e.verdict === 'Stop'; });

  // Goal
  var total = modeExps.reduce(function(s, e) { return s + expBottomVal(e); }, 0);
  var nsTarget = isOut ? 15 : 30;
  var pct = Math.min(100, Math.round((total / nsTarget) * 100));
  var goalLabel = isOut ? 'signups' : 'audience gained';
  var color = pct >= 100 ? 'var(--hit)' : pct >= 60 ? 'var(--change)' : 'var(--accent)';

  var html = '<div class="goal">' +
    '<div class="goal-label">Goal: ' + nsTarget + ' ' + goalLabel + ' this sprint</div>' +
    '<div class="goal-row"><span class="goal-num">' + total + '</span><span class="goal-of"> / ' + nsTarget + '</span></div>' +
    '<div class="goal-bar"><div class="goal-fill" style="width:' + pct + '%;background:' + color + '"></div></div></div>';

  // Categorize
  var working = [];
  var needsData = [];
  var belowBm = [];
  var noVerdict = [];

  modeExps.forEach(function(e) {
    var hasData = expHasData(e);
    var rate = expRate(e);
    var bm = getBenchmark(e);

    if (!hasData) {
      needsData.push(e);
    } else if (rate >= bm.good) {
      working.push(e);
    } else if (rate >= bm.avg) {
      working.push(e); // at average = still working, just room to improve
    } else {
      belowBm.push(e);
    }
  });

  // Sort each group by bottom-of-funnel contribution (signups) desc
  function byContrib(a, b) { return expBottomVal(b) - expBottomVal(a); }
  working.sort(byContrib);
  belowBm.sort(byContrib);

  // Render groups
  if (working.length > 0) {
    html += '<div class="group">' +
      '<div class="group-head"><span class="group-title">Working</span><span class="group-count">' + working.length + '</span></div>';
    working.forEach(function(e) { html += renderExpRow(e); });
    html += '</div>';
  }

  if (needsData.length > 0) {
    html += '<div class="group">' +
      '<div class="group-head"><span class="group-title">Needs more data</span><span class="group-count group-count-muted">' + needsData.length + '</span></div>';
    needsData.forEach(function(e) { html += renderExpRow(e); });
    html += '</div>';
  }

  if (belowBm.length > 0) {
    html += '<div class="group">' +
      '<div class="group-head"><span class="group-title">Below benchmark</span><span class="group-count group-count-warn">' + belowBm.length + '</span></div>';
    belowBm.forEach(function(e) { html += renderExpRow(e); });
    html += '</div>';
  }

  // Add new
  html += '<div class="inline-add-trigger" onclick="openModal()"><span class="inline-add-icon">+</span> New experiment</div>';

  // Stopped
  if (stoppedExps.length > 0) {
    html += '<div class="stopped-toggle" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display===\'none\'?\'block\':\'none\'">Stopped · ' + stoppedExps.length + '</div>' +
      '<div style="display:none" class="stopped-list">';
    stoppedExps.forEach(function(e) {
      html += '<div class="exp-stopped"><span class="exp-stopped-name">' + e.name + '</span>' +
        '<button class="delete-btn-sm" onclick="deleteExp(' + e.id + ')">x</button></div>';
    });
    html += '</div>';
  }

  el.innerHTML = html;
}

/* ================================================================
   Single experiment row
   ================================================================ */

function renderExpRow(e) {
  var info = CH[e.ch];
  var rate = expRateStr(e);
  var rateNum = expRate(e);
  var hasData = expHasData(e);
  var bm = getBenchmark(e);
  var contrib = expBottomVal(e);
  var vCls = verdictCls(e.verdict);

  // Health dot
  var dot = '';
  if (hasData && bm) {
    if (rateNum >= bm.good)     dot = '<span class="dot-good">●</span>';
    else if (rateNum >= bm.avg) dot = '<span class="dot-ok">●</span>';
    else                        dot = '<span class="dot-low">●</span>';
  }

  // Sample size check
  var sampleNote = '';
  if (hasData && bm) {
    var ri = e.rateIdx || info.rateIdx;
    var sample = e.stages[ri[1]] ? e.stages[ri[1]].val : 0;
    if (sample < bm.minSample) {
      sampleNote = '<span class="exp-sample">need ' + (bm.minSample - sample) + ' more</span>';
    }
  }

  var html = '<div class="exp-card" id="exp-card-' + e.id + '">' +
    '<div class="exp-row-g" onclick="toggleExp(' + e.id + ')">' +
    '<div class="exp-main"><div>' + dot + '<span class="exp-name-g">' + e.name + '</span>' +
    '<div class="exp-sub">' +
    '<span class="exp-ch-label">' + info.label + '</span>' +
    (e.tools ? '<span class="exp-tools-label">' + e.tools + '</span>' : '') +
    '</div>' +
    (e.idea ? '<div class="exp-desc">' + e.idea + '</div>' : '') + '</div></div>' +
    '<div class="exp-nums">' +
    '<span class="exp-rate-g">' + rate + '</span>' +
    (contrib > 0 ? '<span class="exp-contrib">→ ' + contrib + ' ' + (CH[e.ch].mode === 'outbound' ? 'signup' + (contrib !== 1 ? 's' : '') : 'gained') + '</span>' : '') +
    sampleNote +
    '</div>' +
    '<div class="exp-verdict-g"><span class="verdict ' + vCls + '" onclick="event.stopPropagation();cycleVerdict(' + e.id + ')">' + (e.verdict || '—') + '</span></div>' +
    '</div>';

  // Expandable detail — 3 zones: source+pipeline → AI → actions
  html += '<div class="exp-expand-wrap" id="expand-' + e.id + '"><div class="exp-expand-inner"><div class="exp-detail">';

  // 0. DATA SOURCE bar
  var src = getSource(e.id);
  if (src.type !== 'manual') {
    var ago = src.lastSync ? Math.round((Date.now() - new Date(src.lastSync).getTime()) / 60000) : null;
    var agoText = ago !== null ? (ago < 60 ? ago + 'm ago' : Math.round(ago / 60) + 'h ago') : 'never';
    html += '<div class="exp-source">' +
      '<span class="exp-source-type">' + (src.type === 'google_sheets' ? 'Google Sheets' : 'API') + '</span>' +
      '<span class="exp-source-sync">Synced ' + agoText + '</span>' +
      '<button class="exp-source-btn" onclick="event.stopPropagation();syncAndRefresh(' + e.id + ')">Refresh</button>' +
      '<button class="exp-source-btn" onclick="event.stopPropagation();openConnect(' + e.id + ')">Settings</button></div>';
  } else {
    html += '<div class="exp-source exp-source-manual">' +
      '<span class="exp-source-type">Manual tracking</span>' +
      '<button class="exp-source-btn" onclick="event.stopPropagation();openConnect(' + e.id + ')">Connect data source</button></div>';
  }

  // 1. PIPELINE
  html += '<div class="pipe">';
  e.stages.forEach(function(stg, idx) {
    var isKey = e.rateIdx && (idx === e.rateIdx[0] || idx === e.rateIdx[1]);
    html += '<div class="pipe-stage' + (isKey ? ' pipe-stage-key' : '') + '" onclick="event.stopPropagation();editStage(' + e.id + ',' + idx + ',this)">' +
      '<div class="pipe-stage-val">' + formatNum(stg.val) + '</div>' +
      '<div class="pipe-stage-label">' + stg.label + '</div></div>';
  });
  html += '</div>';

  // 2. AI — one line of context
  if (hasData) {
    var sg = suggestVerdict(e);
    if (sg.verdict) {
      html += '<div class="exp-ai"><strong>' + sg.verdict + '</strong> — ' + sg.reason + '</div>';
    } else if (sg.reason) {
      html += '<div class="exp-ai exp-ai-wait">' + sg.reason + '</div>';
    }
  }

  // 3. ACTIONS — verdict + next step + delete
  html += '<div class="exp-actions">';

  html += '<div class="verdict-group">' +
    ['Keep going', 'Change variables', 'Close, iterate', 'Stop'].map(function(v) {
      var bc = v === 'Keep going' ? 'keep' : v === 'Change variables' ? 'change' : v === 'Close, iterate' ? 'close' : 'stop';
      return '<div class="vbtn v-' + bc + ' ' + (e.verdict === v ? 'active' : '') + '" onclick="event.stopPropagation();setVerdict(' + e.id + ',\'' + v + '\')">' + v + '</div>';
    }).join('') + '</div>';

  html += '<div class="detail-next-text" onclick="event.stopPropagation();editNext(' + e.id + ',this)">' +
    (e.next || '<span class="ph">Next step...</span>') + '</div>';

  html += '<button class="delete-btn" onclick="event.stopPropagation();deleteExp(' + e.id + ')">Delete</button>';

  html += '</div>';
  html += '</div></div></div></div>';
  return html;
}

function syncAndRefresh(id) {
  showToast('Syncing...');
  syncExperiment(id, function(err, msg) {
    showToast(err || msg);
    render();
  });
}

/* ── Editing ── */
function toggleExp(id) { document.getElementById('expand-' + id).classList.toggle('open'); }

function cycleVerdict(id) {
  var exps = load(), e = exps.find(function(x) { return x.id === id; });
  var opts = ['', 'Keep going', 'Change variables', 'Close, iterate', 'Stop'];
  e.verdict = opts[(opts.indexOf(e.verdict) + 1) % opts.length];
  save(exps); flash(); render();
}

function setVerdict(id, v) {
  var exps = load(); exps.find(function(x) { return x.id === id; }).verdict = v;
  save(exps); flash(); render();
}

function editName(id, el) {
  inlineEdit(el, load().find(function(x) { return x.id === id; }).name, function(val) {
    if (!val.trim()) return;
    var exps = load(); exps.find(function(x) { return x.id === id; }).name = val.trim();
    save(exps); flash(); render();
  }, { type: 'text', label: 'Experiment name' });
}

function deleteExp(id) {
  var exps = load(), e = exps.find(function(x) { return x.id === id; });
  if (!e || !confirm('Delete "' + e.name + '"?')) return;
  save(exps.filter(function(x) { return x.id !== id; })); flash(); render();
}

function editNext(id, el) {
  var exps = load(), e = exps.find(function(x) { return x.id === id; });
  var input = document.createElement('input'); input.type = 'text'; input.value = e.next || '';
  input.placeholder = 'What to do next...';
  el.innerHTML = ''; el.appendChild(input); input.focus();
  function c() { e.next = input.value; save(exps); flash(); render(); }
  input.addEventListener('blur', c);
  input.addEventListener('keydown', function(ev) { if (ev.key === 'Enter') c(); });
}
