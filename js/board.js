/* ================================================================
   Board — Goal-down view with experiment → variation hierarchy

   Experiment = the approach (Post Engager Lead Lists)
   Variation  = a specific variable test (Commenters only, Template A)
   ================================================================ */

var activeMode = 'outbound';
var activeView = 'experiments';
var expandedIds = {};

function setMode(m) { activeMode = m; render(); }
function setView(v) { activeView = v; render(); }

function render() {
  var exps = load();

  var sp = loadSprint();
  document.getElementById('sprint-label').textContent = sp.name + ' · ' + sp.start + ' – ' + sp.end + ', ' + sp.year;

  var outCount = exps.filter(function(e) { return CH[e.ch] && CH[e.ch].mode === 'outbound' && !allStopped(e); }).length;
  var inCount = exps.filter(function(e) { return CH[e.ch] && CH[e.ch].mode === 'inbound' && !allStopped(e); }).length;
  document.getElementById('mode-toggle').innerHTML =
    '<button class="mode-pill ' + (activeMode === 'outbound' ? 'active' : '') + '" onclick="setMode(\'outbound\')">Out <span class="mode-pill-n">' + outCount + '</span></button>' +
    '<button class="mode-pill ' + (activeMode === 'inbound' ? 'active' : '') + '" onclick="setMode(\'inbound\')">In <span class="mode-pill-n">' + inCount + '</span></button>';

  document.getElementById('view-tabs').innerHTML =
    '<button class="vtab ' + (activeView === 'experiments' ? 'active' : '') + '" onclick="setView(\'experiments\')">Experiments</button>' +
    '<button class="vtab ' + (activeView === 'weekly' ? 'active' : '') + '" onclick="setView(\'weekly\')">Compare</button>';

  document.getElementById('view-experiments').style.display = activeView === 'experiments' ? 'block' : 'none';
  document.getElementById('view-weekly').style.display = activeView === 'weekly' ? 'block' : 'none';

  if (activeView === 'experiments') renderGoalView(exps);
  else if (typeof renderTimeSeries === 'function') renderTimeSeries();
}

/* ── Helpers ── */
function allStopped(e) {
  return e.variations.every(function(v) { return v.verdict === 'Stop'; });
}

function bestVariation(e) {
  var active = e.variations.filter(function(v) { return v.verdict !== 'Stop'; });
  if (active.length === 0) return e.variations[0];
  var best = active[0];
  active.forEach(function(v) { if (expRate(v) > expRate(best)) best = v; });
  return best;
}

function expTotalBottom(e) {
  return e.variations.reduce(function(s, v) {
    if (v.verdict === 'Stop') return s;
    return s + (v.stages[v.stages.length - 1] ? v.stages[v.stages.length - 1].val : 0);
  }, 0);
}

/* ================================================================
   Goal-down view
   ================================================================ */

function renderGoalView(exps) {
  var el = document.getElementById('view-experiments');
  var isOut = activeMode === 'outbound';
  var modeExps = exps.filter(function(e) { return CH[e.ch] && CH[e.ch].mode === activeMode && !allStopped(e); });
  var stoppedExps = exps.filter(function(e) { return CH[e.ch] && CH[e.ch].mode === activeMode && allStopped(e); });

  // Goal
  var total = modeExps.reduce(function(s, e) { return s + expTotalBottom(e); }, 0);
  var nsTarget = isOut ? 15 : 30;
  var pct = Math.min(100, Math.round((total / nsTarget) * 100));
  var color = pct >= 100 ? 'var(--hit)' : pct >= 60 ? 'var(--change)' : 'var(--accent)';

  var html = '<div class="goal">' +
    '<div class="goal-label">' + (isOut ? 'Signups' : 'Audience gained') + ' this sprint</div>' +
    '<div class="goal-row"><span class="goal-num">' + total + '</span><span class="goal-of"> / ' + nsTarget + '</span></div>' +
    '<div class="goal-bar"><div class="goal-fill" style="width:' + pct + '%;background:' + color + '"></div></div></div>';

  // Categorize experiments by best variation health
  var working = [], needsData = [], belowBm = [];
  modeExps.forEach(function(e) {
    var best = bestVariation(e);
    var hasData = expHasData(best);
    var rate = expRate(best);
    var bm = getBenchmark(best, e.ch);
    if (!hasData) needsData.push(e);
    else if (rate >= bm.avg) working.push(e);
    else belowBm.push(e);
  });

  function byContrib(a, b) { return expTotalBottom(b) - expTotalBottom(a); }
  working.sort(byContrib);
  belowBm.sort(byContrib);

  if (working.length > 0) {
    html += '<div class="group"><div class="group-head"><span class="group-title">Working</span><span class="group-count">' + working.length + '</span></div>' +
      '<div class="group-desc">At or above industry average — keep going</div>';
    working.forEach(function(e) { html += renderExperiment(e); });
    html += '</div>';
  }
  if (needsData.length > 0) {
    html += '<div class="group"><div class="group-head"><span class="group-title">Needs more data</span><span class="group-count group-count-muted">' + needsData.length + '</span></div>' +
      '<div class="group-desc">Keep running until enough volume to judge</div>';
    needsData.forEach(function(e) { html += renderExperiment(e); });
    html += '</div>';
  }
  if (belowBm.length > 0) {
    html += '<div class="group"><div class="group-head"><span class="group-title">Below benchmark</span><span class="group-count group-count-warn">' + belowBm.length + '</span></div>' +
      '<div class="group-desc">Add a new variation to test different variables</div>';
    belowBm.forEach(function(e) { html += renderExperiment(e); });
    html += '</div>';
  }

  html += '<div class="inline-add-trigger" onclick="openModal()"><span class="inline-add-icon">+</span> New experiment</div>';

  if (stoppedExps.length > 0) {
    html += '<div class="stopped-toggle" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display===\'none\'?\'block\':\'none\'">Stopped · ' + stoppedExps.length + '</div>' +
      '<div style="display:none" class="stopped-list">';
    stoppedExps.forEach(function(e) {
      html += '<div class="exp-stopped"><span class="exp-stopped-name">' + e.name + '</span><button class="delete-btn-sm" onclick="deleteExp(' + e.id + ')">x</button></div>';
    });
    html += '</div>';
  }

  el.innerHTML = html;
  restoreExpanded();
}

/* ================================================================
   Single experiment with variations
   ================================================================ */

function renderExperiment(e) {
  var info = CH[e.ch];
  var best = bestVariation(e);
  var bestRate = expRateStr(best);
  var contrib = expTotalBottom(e);
  var bm = getBenchmark(best, e.ch);
  var rateNum = expRate(best);
  var dot = '';
  if (expHasData(best) && bm) {
    if (rateNum >= bm.good) dot = '<span class="dot-good">●</span>';
    else if (rateNum >= bm.avg) dot = '<span class="dot-ok">●</span>';
    else dot = '<span class="dot-low">●</span>';
  }

  // Data progress — how close to enough data for a verdict
  var ri = best.rateIdx || info.rateIdx;
  var sample = best.stages[ri[1]] ? best.stages[ri[1]].val : 0;
  var minSample = bm ? bm.minSample : 50;
  var samplePct = Math.min(100, Math.round((sample / minSample) * 100));
  var hasEnough = sample >= minSample;

  // Time estimate
  var started = best.started || '—';
  var timeLabel = '';
  if (started !== '—' && !hasEnough && sample > 0) {
    // Estimate weeks remaining based on current accumulation rate
    var startDate = new Date(started + ', 2026');
    var weeksRunning = Math.max(1, Math.round((Date.now() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)));
    var ratePerWeek = sample / weeksRunning;
    if (ratePerWeek > 0) {
      var weeksLeft = Math.ceil((minSample - sample) / ratePerWeek);
      timeLabel = '~' + weeksLeft + ' more week' + (weeksLeft !== 1 ? 's' : '');
    }
  } else if (hasEnough) {
    timeLabel = 'ready for verdict';
  } else if (sample === 0) {
    timeLabel = 'not started';
  }

  var progressColor = hasEnough ? 'var(--hit)' : samplePct > 50 ? 'var(--change)' : 'var(--accent)';

  var html = '<div class="exp-card">' +
    '<div class="exp-row-g" onclick="toggleExp(' + e.id + ')">' +
    '<div class="exp-main"><div>' + dot + '<span class="exp-name-g">' + e.name + '</span>' +
    '<div class="exp-sub"><span class="exp-ch-label">' + info.label + '</span>' +
    (e.tools ? '<span class="exp-tools-label">' + e.tools + '</span>' : '') + '</div>' +
    (e.idea ? '<div class="exp-desc">' + e.idea + '</div>' : '') +
    // Data progress bar
    '<div class="exp-progress">' +
    '<div class="exp-progress-bar"><div class="exp-progress-fill" style="width:' + samplePct + '%;background:' + progressColor + '"></div></div>' +
    '<span class="exp-progress-label">' + formatNum(sample) + ' / ' + formatNum(minSample) + ' ' +
    (best.stages[ri[1]] ? best.stages[ri[1]].label.toLowerCase() : '') +
    (timeLabel ? ' · ' + timeLabel : '') + '</span></div>' +
    '</div></div>' +
    '<div class="exp-nums"><span class="exp-rate-g">' + bestRate + '</span>' +
    (contrib > 0 ? '<span class="exp-contrib">' + contrib + ' ' + (info.mode === 'outbound' ? 'signup' + (contrib !== 1 ? 's' : '') : 'gained') + '</span>' : '') +
    '</div></div>';

  // Expandable: variations list
  html += '<div class="exp-expand-wrap" id="expand-' + e.id + '"><div class="exp-expand-inner"><div class="exp-detail">';

  // Variations — show ALL including stopped (dimmed)
  e.variations.forEach(function(v, idx) {
    var isStopped = v.verdict === 'Stop';
    var vRate = expRateStr(v);
    var vRateNum = expRate(v);
    var hasData = expHasData(v);
    var vDot = '';
    if (hasData && bm) {
      if (vRateNum >= bm.good) vDot = '<span class="dot-good">●</span>';
      else if (vRateNum >= bm.avg) vDot = '<span class="dot-ok">●</span>';
      else vDot = '<span class="dot-low">●</span>';
    }
    var vCls = verdictCls(v.verdict);

    html += '<div class="var-card' + (isStopped ? ' var-stopped' : '') + '">' +
      '<div class="var-head">' +
      '<div class="var-name">' + vDot + v.name + (isStopped ? ' <span class="var-stopped-label">stopped</span>' : '') + '</div>' +
      (isStopped ? '' : '<button class="var-stop-btn" onclick="event.stopPropagation();stopVariation(' + e.id + ',\'' + v.id + '\')">Stop</button>') +
      '</div>';

    if (isStopped) { html += '</div>'; return; }

    // Pipeline — direct editable inputs with step conversions
    html += '<div class="pipe">';
    v.stages.forEach(function(stg, sIdx) {
      if (sIdx > 0) {
        var prev = v.stages[sIdx - 1].val;
        var conv = prev > 0 ? ((stg.val / prev) * 100) : 0;
        var convText = prev > 0 ? (conv >= 100 ? '×' + (stg.val / prev).toFixed(0) : conv.toFixed(0) + '%') : '—';
        var convCls = conv >= 50 ? 'pipe-conv-good' : conv >= 20 ? 'pipe-conv-ok' : 'pipe-conv-low';
        html += '<div class="pipe-arrow ' + convCls + '">' + convText + '</div>';
      }
      var isKey = v.rateIdx && (sIdx === v.rateIdx[0] || sIdx === v.rateIdx[1]);
      var stageId = 'stg-' + e.id + '-' + v.id + '-' + sIdx;
      var hasNote = stg.note || stg.source;
      html += '<div class="pipe-stage' + (isKey ? ' pipe-stage-key' : '') + (hasNote ? ' pipe-stage-noted' : '') + '">' +
        '<input type="number" class="pipe-input" value="' + stg.val + '" min="0" ' +
        'onfocus="this.select()" ' +
        'onchange="saveStage(' + e.id + ',\'' + v.id + '\',' + sIdx + ',this.value)" ' +
        'onclick="event.stopPropagation()">' +
        '<div class="pipe-stage-label" onclick="event.stopPropagation();toggleStagePanel(\'' + stageId + '\')">' + stg.label +
        (hasNote ? ' *' : '') + '</div>' +
        '<div class="stage-panel" id="' + stageId + '" style="display:none" onclick="event.stopPropagation()">' +
        '<input type="text" class="stage-note" placeholder="Note..." value="' + (stg.note || '').replace(/"/g, '&quot;') + '" ' +
        'onchange="saveStageNote(' + e.id + ',\'' + v.id + '\',' + sIdx + ',this.value)">' +
        '<input type="text" class="stage-source" placeholder="Link to source..." value="' + (stg.source || '').replace(/"/g, '&quot;') + '" ' +
        'onchange="saveStageSource(' + e.id + ',\'' + v.id + '\',' + sIdx + ',this.value)">' +
        (stg.source ? '<a class="stage-link" href="' + stg.source + '" target="_blank" onclick="event.stopPropagation()">Open source</a>' : '') +
        '</div></div>';
    });
    html += '</div>';

    // AI insight
    if (hasData) {
      var sg = suggestVerdict(v, e.ch);
      if (sg.verdict) html += '<div class="exp-ai">' + sg.reason + '</div>';
    }

    html += '</div>';
  });

  // Add variation button
  html += '<div class="add-var-trigger" onclick="event.stopPropagation();addVariation(' + e.id + ')"><span class="inline-add-icon">+</span> New variation</div>';

  html += '<div class="exp-bottom">' +
    '<button class="delete-btn" onclick="event.stopPropagation();deleteExp(' + e.id + ')">Delete</button></div>';

  html += '</div></div></div></div>';
  return html;
}

/* ================================================================
   Actions
   ================================================================ */

function toggleExp(id) {
  var el = document.getElementById('expand-' + id);
  if (el) el.classList.toggle('open');
  expandedIds[id] = el ? el.classList.contains('open') : false;
}

function restoreExpanded() {
  Object.keys(expandedIds).forEach(function(id) {
    if (expandedIds[id]) {
      var el = document.getElementById('expand-' + id);
      if (el) el.classList.add('open');
    }
  });
}

function stopVariation(expId, varId) {
  var exps = load();
  var e = exps.find(function(x) { return x.id === expId; });
  if (!e) return;
  var v = e.variations.find(function(x) { return x.id === varId; });
  if (!v) return;
  v.verdict = 'Stop';
  save(exps); flash(); render();
}

function saveStage(expId, varId, stgIdx, val) {
  var exps = load();
  var e = exps.find(function(x) { return x.id === expId; });
  if (!e) return;
  var v = e.variations.find(function(x) { return x.id === varId; });
  if (!v) return;
  v.stages[stgIdx].val = parseInt(val) || 0;
  save(exps);
  // Update rate display live without full re-render
  var card = document.querySelector('#expand-' + expId);
  if (card) {
    var rateEl = card.querySelector('.var-card:nth-child(' + (e.variations.indexOf(v) + 1) + ') .var-rate');
    if (rateEl) rateEl.textContent = expRateStr(v);
  }
}

function toggleStagePanel(stageId) {
  var el = document.getElementById(stageId);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function saveStageNote(expId, varId, stgIdx, val) {
  var exps = load();
  var e = exps.find(function(x) { return x.id === expId; });
  if (!e) return;
  var v = e.variations.find(function(x) { return x.id === varId; });
  if (!v) return;
  v.stages[stgIdx].note = val;
  save(exps);
}

function saveStageSource(expId, varId, stgIdx, val) {
  var exps = load();
  var e = exps.find(function(x) { return x.id === expId; });
  if (!e) return;
  var v = e.variations.find(function(x) { return x.id === varId; });
  if (!v) return;
  v.stages[stgIdx].source = val;
  save(exps);
}

function editVarStage(expId, varId, stgIdx, el) {
  var exps = load();
  var e = exps.find(function(x) { return x.id === expId; });
  var v = e.variations.find(function(x) { return x.id === varId; });
  var stg = v.stages[stgIdx];
  var hint = getTrackingHint(e, stg.label);

  inlineEdit(el, stg.val, function(val) {
    var exps2 = load();
    var e2 = exps2.find(function(x) { return x.id === expId; });
    var v2 = e2.variations.find(function(x) { return x.id === varId; });
    v2.stages[stgIdx].val = val;
    save(exps2); flash(); render();
  }, { label: stg.label, hint: hint });
}


function addVariation(expId) {
  var trigger = document.querySelector('#expand-' + expId + ' .add-var-trigger');
  if (!trigger || trigger.querySelector('.add-var-inline')) return;

  var wrap = document.createElement('div');
  wrap.className = 'add-var-inline';
  wrap.onclick = function(e) { e.stopPropagation(); };
  wrap.innerHTML = '<input type="text" class="add-var-input" placeholder="What are you changing?" autofocus>' +
    '<div class="add-var-actions"><button class="ie-cancel add-var-cancel-btn">Cancel</button><button class="ie-save add-var-save-btn">Add</button></div>';
  trigger.innerHTML = '';
  trigger.style.border = 'none';
  trigger.style.padding = '0';
  trigger.appendChild(wrap);

  var input = wrap.querySelector('input');
  setTimeout(function() { input.focus(); }, 30);

  function doAdd() {
    var name = input.value.trim();
    if (!name) { doCancel(); return; }
    var exps = load();
    var e = exps.find(function(x) { return x.id === expId; });
    var info = CH[e.ch];
    var count = e.variations.length + 1;
    var stages = (info ? info.defaultStages : ['Input', 'Output']).map(function(l) { return { label: l, val: 0 }; });
    e.variations.push({
      id: expId + '_v' + count,
      name: name,
      stages: stages,
      rateIdx: info ? info.rateIdx : [1, 0],
      started: MONTHS[new Date().getMonth()] + ' ' + new Date().getDate(),
      verdict: '',
      next: ''
    });
    save(exps); flash(); render();
  }

  function doCancel() { render(); }

  wrap.querySelector('.add-var-save-btn').onclick = function(e) { e.stopPropagation(); doAdd(); };
  wrap.querySelector('.add-var-cancel-btn').onclick = function(e) { e.stopPropagation(); doCancel(); };
  input.addEventListener('keydown', function(ev) {
    if (ev.key === 'Enter') doAdd();
    if (ev.key === 'Escape') doCancel();
  });
}

function deleteExp(id) {
  var exps = load(), e = exps.find(function(x) { return x.id === id; });
  if (!e || !confirm('Delete "' + e.name + '" and all its variations?')) return;
  save(exps.filter(function(x) { return x.id !== id; })); flash(); render();
}
