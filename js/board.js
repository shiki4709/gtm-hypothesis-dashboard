/* ================================================================
   Board — GTM Runner

   Single-page flow:
   1. Scrape (paste LinkedIn URL → get leads)
   2. Pipelines (each scrape becomes a tracked pipeline)
   ================================================================ */

var activeTab = window._activeTab || 'leads';

function render() {
  // Hide mode toggle — not needed
  document.getElementById('mode-toggle').innerHTML = '';

  // Hide all old views
  document.getElementById('view-home').style.display = 'none';
  document.getElementById('view-experiment').style.display = 'none';
  document.getElementById('view-integrations').style.display = 'none';
  document.getElementById('view-weekly').style.display = 'none';

  // Tab navigation
  var tabs = [
    { id: 'leads', label: 'Find Leads', view: 'view-scrape' },
    { id: 'x-engage', label: 'X Engage', view: 'view-x-engage' },
    { id: 'content', label: 'Content', view: 'view-content' },
  ];

  var tabHtml = '';
  tabs.forEach(function(t) {
    tabHtml += '<button class="vtab' + (activeTab === t.id ? ' active' : '') +
      '" onclick="switchTab(\'' + t.id + '\')">' + t.label + '</button>';
  });
  document.getElementById('view-tabs').innerHTML = tabHtml;

  // Show active view, hide others
  tabs.forEach(function(t) {
    document.getElementById(t.view).style.display = (activeTab === t.id) ? 'block' : 'none';
  });

  // Render active tab content
  if (activeTab === 'leads') renderRunner();
  else if (activeTab === 'x-engage') renderXEngage();
  else if (activeTab === 'content') renderContent();
}

function switchTab(tabId) {
  activeTab = tabId;
  window._activeTab = tabId;
  render();
}

/* ── Helpers ── */
function allStopped(e) { return e.variations.every(function(v) { return v.stopped; }); }
function bestVariation(e) {
  var active = e.variations.filter(function(v) { return !v.stopped; });
  if (active.length === 0) return e.variations[0];
  var best = active[0];
  active.forEach(function(v) { if (expRate(v) > expRate(best)) best = v; });
  return best;
}
function expTotalBottom(e) {
  return e.variations.reduce(function(s, v) {
    if (v.stopped) return s;
    return s + (v.stages[v.stages.length - 1] ? v.stages[v.stages.length - 1].val : 0);
  }, 0);
}

/* ================================================================
   HOME — List of experiments sorted by health
   ================================================================ */

function renderHome(exps) {
  var el = document.getElementById('view-home');
  var modeExps = exps.filter(function(e) { return CH[e.ch] && CH[e.ch].mode === activeMode && !allStopped(e); });

  if (modeExps.length === 0) {
    el.innerHTML = '<div class="home-empty">No workflows yet.<br>Click <strong>+ New</strong> to start.</div>';
    return;
  }

  // Sort: below benchmark first (needs attention), then needs data, then working
  modeExps.sort(function(a, b) {
    var sa = homeScore(a), sb = homeScore(b);
    if (sa !== sb) return sa - sb;
    return expTotalBottom(b) - expTotalBottom(a);
  });

  var html = '';
  modeExps.forEach(function(e) {
    var info = CH[e.ch];
    var best = bestVariation(e);
    var rate = expRateStr(best);
    var hasData = expHasData(best);
    var bm = getBenchmark(best, e.ch);
    var rateNum = expRate(best);
    var contrib = expTotalBottom(e);

    // Health
    var healthLabel = '', healthCls = '';
    if (!hasData) { healthLabel = 'No data'; healthCls = 'health-none'; }
    else if (rateNum >= bm.good) { healthLabel = 'Working'; healthCls = 'health-good'; }
    else if (rateNum >= bm.avg) { healthLabel = 'Average'; healthCls = 'health-ok'; }
    else { healthLabel = 'Below benchmark'; healthCls = 'health-low'; }

    // Progress
    var ri = best.rateIdx || info.rateIdx;
    var sample = best.stages[ri[1]] ? best.stages[ri[1]].val : 0;
    var minSample = bm ? bm.minSample : 50;
    var pct = Math.min(100, Math.round((sample / minSample) * 100));

    html += '<div class="home-card" onclick="openExp(' + e.id + ')">' +
      '<div class="home-card-top">' +
      '<div><div class="home-card-name">' + e.name + '</div>' +
      '<div class="home-card-sub">' + info.label + (e.tools ? ' · ' + e.tools : '') + '</div>' +
      (e.idea ? '<div class="home-card-idea">' + e.idea + '</div>' : '') + '</div>' +
      '<div class="home-card-right">' +
      '<div class="home-card-rate">' + rate + '</div>' +
      (contrib > 0 ? '<div class="home-card-contrib">' + contrib + ' signup' + (contrib !== 1 ? 's' : '') + '</div>' : '') +
      '</div></div>' +
      '<div class="home-card-bottom">' +
      '<span class="home-health ' + healthCls + '">' + healthLabel + '</span>' +
      '<div class="home-progress"><div class="home-progress-bar"><div class="home-progress-fill" style="width:' + pct + '%"></div></div>' +
      '<span class="home-progress-label">' + sample + '/' + minSample + '</span></div>' +
      '<span class="home-vars">' + e.variations.filter(function(v) { return !v.stopped; }).length + ' var</span>' +
      '<button class="home-btn" onclick="event.stopPropagation();deleteExp(' + e.id + ')">Remove</button>' +
      '</div></div>';
  });

  html += '<div class="home-add" onclick="openModal()">+ New workflow</div>';
  el.innerHTML = html;
}

function homeScore(e) {
  var best = bestVariation(e);
  if (!expHasData(best)) return 1; // needs data
  var bm = getBenchmark(best, e.ch);
  var rate = expRate(best);
  if (rate < bm.avg) return 0; // below benchmark — needs attention first
  return 2; // working
}

/* ================================================================
   EXPERIMENT PAGE — Full detail for one experiment
   ================================================================ */

function renderExperimentPage(exps) {
  var el = document.getElementById('view-experiment');
  var e = exps.find(function(x) { return x.id === openExpId; });
  if (!e) { goHome(); return; }
  var info = CH[e.ch];
  var bm = getBenchmark(bestVariation(e), e.ch);

  var html = '';

  // Header
  html += '<div class="exp-page-header">' +
    '<div class="exp-page-idea">' + (e.idea || '') + '</div>' +
    '<div class="exp-page-meta">' + info.label + (e.tools ? ' · ' + e.tools : '') + '</div>' +
    '</div>';

  // Variations
  e.variations.forEach(function(v) {
    var isStopped = v.stopped;
    var vRate = expRateStr(v);
    var hasData = expHasData(v);

    html += '<div class="var-section' + (isStopped ? ' var-section-stopped' : '') + '">';

    // Variation header
    html += '<div class="var-section-head">' +
      '<div class="var-section-info"><span class="var-section-name">' + v.name + (isStopped ? ' <span class="var-stopped-label">stopped</span>' : '') + '</span>' +
      '<span class="var-section-date">Started ' + (v.started || '—') + '</span></div>' +
      (vRate !== '—' ? '<span class="var-section-rate">' + vRate + '</span>' : '') +
      (!isStopped ? '<button class="var-stop-btn" onclick="stopVariation(' + e.id + ',\'' + v.id + '\')">Stop</button>' : '') +
      '</div>';

    if (isStopped) { html += '</div>'; return; }

    // Pipeline with conversions
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
      var isChanged = v.changedStep === sIdx;
      var hasConn = stg.source || stg.note || stg.owner;
      var hasMethod = stg.method;
      html += '<div class="pipe-stage' + (isKey ? ' pipe-stage-key' : '') + (isChanged ? ' pipe-stage-changed' : '') + (hasConn ? ' pipe-stage-noted' : '') + '">' +
        '<input type="number" class="pipe-input" value="' + stg.val + '" min="0" ' +
        'onfocus="this.select()" onchange="saveStage(' + e.id + ',\'' + v.id + '\',' + sIdx + ',this.value)">' +
        '<div class="pipe-stage-label" onclick="openStagePanel(' + e.id + ',\'' + v.id + '\',' + sIdx + ')">' +
        stg.label + '</div>' +
        (hasMethod ? '<div class="pipe-stage-method">' + stg.method + '</div>' : '') +
        '</div>';
    });
    html += '</div>';

    // AI insight
    if (hasData) {
      var sg = suggestVerdict(v, e.ch);
      if (sg.reason) html += '<div class="exp-ai">' + sg.reason + '</div>';
    }

    html += '</div>';
  });

  // Add variation
  html += '<div class="add-var-trigger" onclick="addVariation(' + e.id + ')"><span class="inline-add-icon">+</span> Change a variable</div>';

  // Delete
  html += '<div class="exp-page-footer"><button class="delete-btn" onclick="deleteExp(' + e.id + ')">Delete workflow</button></div>';

  el.innerHTML = html;
}

/* ================================================================
   INTEGRATIONS — all stages grouped by manual vs connected
   ================================================================ */

function renderIntegrations(exps) {
  var el = document.getElementById('view-integrations');
  var modeExps = exps.filter(function(e) { return CH[e.ch] && CH[e.ch].mode === activeMode; });
  var manualStages = [], autoStages = [];

  modeExps.forEach(function(e) {
    e.variations.forEach(function(v) {
      if (v.stopped) return;
      v.stages.forEach(function(stg, sIdx) {
        var item = { exp: e, v: v, stg: stg, sIdx: sIdx };
        if (stg.connType && stg.connType !== 'manual') autoStages.push(item);
        else manualStages.push(item);
      });
    });
  });

  var total = manualStages.length + autoStages.length;
  var html = '<div class="integ-summary">' + autoStages.length + ' / ' + total + ' connected · ' + manualStages.length + ' manual</div>';

  function renderRow(item) {
    var stg = item.stg, e = item.exp, v = item.v, sIdx = item.sIdx;
    var connLabel = stg.connType === 'sheet' ? 'Sheet' : stg.connType === 'api' ? 'API' : stg.connType === 'webhook' ? 'Webhook' : 'Manual';
    var connCls = stg.connType && stg.connType !== 'manual' ? 'integ-conn-auto' : 'integ-conn-manual';
    return '<div class="integ-row">' +
      '<div class="integ-stage">' + stg.label + '</div>' +
      '<div class="integ-exp-label">' + e.name + '</div>' +
      '<div class="integ-val">' + formatNum(stg.val) + '</div>' +
      '<span class="integ-conn ' + connCls + '">' + connLabel + '</span>' +
      (stg.owner ? '<span class="integ-owner">' + stg.owner + '</span>' : '') +
      '<button class="integ-btn" onclick="openStagePanel(' + e.id + ',\'' + v.id + '\',' + sIdx + ')">Edit</button></div>';
  }

  if (manualStages.length > 0) {
    html += '<div class="integ-group"><div class="integ-group-title">Needs manual update</div>';
    manualStages.forEach(function(i) { html += renderRow(i); });
    html += '</div>';
  }
  if (autoStages.length > 0) {
    html += '<div class="integ-group"><div class="integ-group-title">Connected</div>';
    autoStages.forEach(function(i) { html += renderRow(i); });
    html += '</div>';
  }

  el.innerHTML = html;
}

/* ================================================================
   Stage panel (modal)
   ================================================================ */

function openStagePanel(expId, varId, stgIdx) {
  var exps = load();
  var e = exps.find(function(x) { return x.id === expId; });
  if (!e) return;
  var v = e.variations.find(function(x) { return x.id === varId; });
  if (!v) return;
  var stg = v.stages[stgIdx];
  var hint = getTrackingHint(e, stg.label);
  var connType = stg.connType || 'manual';

  qaOpen = true;
  document.getElementById('modal').classList.add('open');
  document.querySelector('.chat').innerHTML =
    '<div class="qa-panel"><div class="qa-header"><h2 class="qa-title">' + stg.label + '</h2>' +
    '<button class="chat-close" onclick="closeModal()">&times;</button></div>' +
    '<div class="qa-body">' +
    '<div class="qa-field"><label class="qa-label">Connection</label>' +
    '<div class="qa-chips" id="stg-conn">' +
    ['manual','sheet','api','webhook'].map(function(t) {
      var label = t === 'manual' ? 'Manual' : t === 'sheet' ? 'Google Sheet' : t === 'api' ? 'API' : 'Webhook';
      return '<button class="qa-chip ' + (connType === t ? 'active' : '') + '" onclick="pickConn(this,\'' + t + '\')" data-type="' + t + '">' + label + '</button>';
    }).join('') + '</div></div>' +
    '<div class="qa-field"><div style="font-size:var(--fs-xs);color:var(--text-3);padding:var(--s-6);background:var(--bg-sub);border-radius:var(--radius-sm);border-left:2px solid var(--inbound)">' + hint + '</div></div>' +
    '<div class="qa-field"><label class="qa-label">Method / Prompt</label>' +
    '<input type="text" class="qa-input qa-input-sm" id="stg-method" value="' + (stg.method || '').replace(/"/g, '&quot;') + '" placeholder="How is this step done? e.g. LinkedIn Search → filter \'sales\' + past week"></div>' +

    '<div class="qa-field"><label class="qa-label">Source URL</label><input type="text" class="qa-input qa-input-sm" id="stg-source" value="' + (stg.source || '').replace(/"/g, '&quot;') + '" placeholder="https://..."></div>' +
    '<div class="qa-field"><label class="qa-label">Owner</label><input type="text" class="qa-input qa-input-sm" id="stg-owner" value="' + (stg.owner || '').replace(/"/g, '&quot;') + '" placeholder="Who updates this?"></div>' +
    '<div class="qa-field"><label class="qa-label">Note</label><input type="text" class="qa-input qa-input-sm" id="stg-note" value="' + (stg.note || '').replace(/"/g, '&quot;') + '" placeholder="Optional note"></div>' +
    '</div><div class="qa-footer"><button class="qa-cancel" onclick="closeModal()">Cancel</button>' +
    '<button class="qa-submit" onclick="saveStagePanel(' + expId + ',\'' + varId + '\',' + stgIdx + ')">Save</button></div></div>';
}

function pickConn(btn, type) {
  document.querySelectorAll('#stg-conn .qa-chip').forEach(function(c) { c.classList.remove('active'); });
  btn.classList.add('active');
}

function saveStagePanel(expId, varId, stgIdx) {
  var exps = load();
  var v = exps.find(function(x) { return x.id === expId; }).variations.find(function(x) { return x.id === varId; });
  var stg = v.stages[stgIdx];
  stg.method = document.getElementById('stg-method').value.trim();
  stg.note = document.getElementById('stg-note').value.trim();
  stg.source = document.getElementById('stg-source').value.trim();
  stg.owner = document.getElementById('stg-owner').value.trim();
  var activeChip = document.querySelector('#stg-conn .qa-chip.active');
  stg.connType = activeChip ? activeChip.dataset.type : 'manual';
  stg.lastUpdated = new Date().toLocaleDateString();
  save(exps); closeModal(); render();
}

/* ================================================================
   Actions
   ================================================================ */

function saveStage(expId, varId, stgIdx, val) {
  var exps = load();
  var e = exps.find(function(x) { return x.id === expId; });
  if (!e) return;
  var v = e.variations.find(function(x) { return x.id === varId; });
  if (!v) return;
  v.stages[stgIdx].val = parseInt(val) || 0;
  save(exps);
}

function stopVariation(expId, varId) {
  var exps = load();
  var e = exps.find(function(x) { return x.id === expId; });
  if (!e) return;
  var v = e.variations.find(function(x) { return x.id === varId; });
  if (!v) return;
  v.stopped = true;
  save(exps); flash(); render();
}

function addVariation(expId) {
  var exps = load();
  var e = exps.find(function(x) { return x.id === expId; });
  if (!e) return;
  var info = CH[e.ch];
  var best = bestVariation(e);
  var stages = best ? best.stages : [];

  // Build current setup summary
  var currentPipe = stages.map(function(stg, i) {
    var conv = '';
    if (i > 0) {
      var prev = stages[i - 1].val;
      conv = prev > 0 ? ((stg.val / prev) * 100).toFixed(0) + '%' : '—';
    }
    return (conv ? '<span class="var-conv">' + conv + ' →</span> ' : '') +
      '<span class="var-current-stage">' + stg.label + ': <strong>' + formatNum(stg.val) + '</strong></span>';
  }).join(' ');

  var currentRate = expRateStr(best);
  var sg = expHasData(best) ? suggestVerdict(best, e.ch) : null;

  qaOpen = true;
  document.getElementById('modal').classList.add('open');
  document.querySelector('.chat').innerHTML =
    '<div class="qa-panel"><div class="qa-header"><h2 class="qa-title">Change a variable</h2>' +
    '<button class="chat-close" onclick="closeModal()">&times;</button></div>' +
    '<div class="qa-body">' +

    // Current setup
    '<div class="var-current">' +
    '<div class="var-current-title">Current: ' + best.name + ' · ' + currentRate + '</div>' +
    '<div class="var-current-pipe">' + currentPipe + '</div>' +
    (sg && sg.reason ? '<div class="var-current-ai">' + sg.reason + '</div>' : '') +
    '</div>' +

    // Step picker
    '<div class="qa-field"><label class="qa-label">Which step are you changing?</label>' +
    '<div class="var-step-list">' +
    stages.map(function(stg, i) {
      var conv = '';
      if (i > 0) {
        var prev = stages[i - 1].val;
        if (prev > 0) conv = ((stg.val / prev) * 100).toFixed(0) + '%';
      }
      return '<button class="var-step-btn" onclick="pickVarStep(this,' + i + ')" data-idx="' + i + '">' +
        '<div class="var-step-top"><span class="var-step-name">' + stg.label + '</span>' +
        '<span class="var-step-conv">' + (conv || '') + '</span>' +
        '<span class="var-step-val">' + formatNum(stg.val) + '</span></div>' +
        (stg.method ? '<div class="var-step-method">' + stg.method + '</div>' : '') +
        '</button>';
    }).join('') + '</div></div>' +

    '<div class="qa-field" id="var-change-field" style="display:none">' +
    '<label class="qa-label">What are you changing about it?</label>' +
    '<input type="text" class="qa-input qa-input-sm" id="var-change-desc" placeholder="e.g. Comment on their post first, then DM" ' +
    'onkeydown="if(event.key===\'Enter\')confirmVariation(' + expId + ')">' +
    '</div></div>' +
    '<div class="qa-footer"><button class="qa-cancel" onclick="closeModal()">Cancel</button>' +
    '<button class="qa-submit" id="var-create-btn" style="opacity:0.4;pointer-events:none" onclick="confirmVariation(' + expId + ')">Create variation</button></div></div>';
}

var selectedVarStep = -1;

function pickVarStep(btn, idx) {
  selectedVarStep = idx;
  document.querySelectorAll('.var-step-btn').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  document.getElementById('var-change-field').style.display = 'block';
  document.getElementById('var-create-btn').style.opacity = '1';
  document.getElementById('var-create-btn').style.pointerEvents = 'auto';
  var input = document.getElementById('var-change-desc');
  if (input) input.focus();
}

function confirmVariation(expId) {
  var desc = document.getElementById('var-change-desc').value.trim();
  if (!desc || selectedVarStep < 0) return;

  var exps = load();
  var e = exps.find(function(x) { return x.id === expId; });
  if (!e) return;
  var info = CH[e.ch];
  var best = bestVariation(e);
  var stepLabel = best.stages[selectedVarStep].label;

  // Copy stages from best variation (start from same structure)
  var stages = best.stages.map(function(s) { return { label: s.label, val: 0 }; });

  e.variations.push({
    id: expId + '_v' + (e.variations.length + 1),
    name: stepLabel + ': ' + desc,
    changedStep: selectedVarStep,
    stages: stages,
    rateIdx: best.rateIdx || (info ? info.rateIdx : [1, 0]),
    started: MONTHS[new Date().getMonth()] + ' ' + new Date().getDate(),
    stopped: false
  });

  save(exps); flash();
  selectedVarStep = -1;
  closeModal();
  render();
}

function deleteExp(id) {
  var exps = load(), e = exps.find(function(x) { return x.id === id; });
  if (!e || !confirm('Delete "' + e.name + '"?')) return;
  save(exps.filter(function(x) { return x.id !== id; })); flash(); goHome();
}
