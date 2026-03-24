/* ================================================================
   Weeks — Week explorer with variable pipeline stages
   ================================================================ */

var weSelectedIdx = 0;
var weCompareIdx = -1;
var weCompareMode = false;

function weSelectWeek(idx) {
  if (weCompareMode) { if (idx === weSelectedIdx) return; weCompareIdx = idx; }
  else { weSelectedIdx = idx; weCompareIdx = -1; }
  render();
}

function weToggleCompare() {
  weCompareMode = !weCompareMode;
  if (!weCompareMode) weCompareIdx = -1;
  render();
}

function snapshotWeek() {
  var exps = load(), ws = loadWE();
  var allActive = exps.filter(function(e) { return !allStopped(e); });

  var outExps = allActive.filter(function(e) { return CH[e.ch] && CH[e.ch].mode === 'outbound'; });
  var inExps = allActive.filter(function(e) { return CH[e.ch] && CH[e.ch].mode === 'inbound'; });

  var now = new Date(), wNum = ws.length + 1;

  // Helper: aggregate best variation stats for snapshot
  function snapBest(e) {
    var best = bestVariation(e);
    return best || { stages: [], rateIdx: CH[e.ch].rateIdx };
  }

  var snap = {
    week: 'W' + wNum,
    date: MONTHS[now.getMonth()] + ' ' + now.getDate(),
    outbound: {
      sourced: outExps.reduce(function(s, e) { var b = snapBest(e); return s + (b.stages[0] ? b.stages[0].val : 0); }, 0),
      reached: outExps.reduce(function(s, e) { var b = snapBest(e); var ri = b.rateIdx || CH[e.ch].rateIdx; return s + (b.stages[ri[1]] ? b.stages[ri[1]].val : 0); }, 0),
      converted: outExps.reduce(function(s, e) { return s + expTotalBottom(e); }, 0),
      hours: 0
    },
    inbound: {
      reach: inExps.reduce(function(s, e) { var b = snapBest(e); return s + (b.stages[0] ? b.stages[0].val : 0); }, 0),
      engaged: inExps.reduce(function(s, e) { var b = snapBest(e); var ri = b.rateIdx || CH[e.ch].rateIdx; return s + (b.stages[ri[0]] ? b.stages[ri[0]].val : 0); }, 0),
      gained: inExps.reduce(function(s, e) { return s + expTotalBottom(e); }, 0),
      hours: 0
    },
    experiments: allActive.map(function(e) {
      var best = bestVariation(e);
      if (!best || !best.stages) return { id: e.id, name: e.name, ch: e.ch, stages: [], rateIdx: [1,0], stopped: false };
      return {
        id: e.id, name: e.name, ch: e.ch,
        stages: best.stages.map(function(s) { return { label: s.label, val: s.val }; }),
        rateIdx: best.rateIdx || (CH[e.ch] ? CH[e.ch].rateIdx : [1,0]),
        stopped: best.stopped || false
      };
    })
  };

  var existIdx = ws.findIndex(function(w) { return w.week === 'W' + wNum; });
  if (existIdx >= 0) ws[existIdx] = snap; else ws.push(snap);
  weSelectedIdx = ws.length - 1;
  saveWE(ws); flash(); render();
}

/* --- Experiment table for week view --- */
function buildExpTable(weekData, prevWeekData, mode) {
  var modeExps = (weekData.experiments || []).filter(function(e) { return CH[e.ch] && CH[e.ch].mode === mode; });
  if (modeExps.length === 0) return '<div class="we-empty">No experiments logged this week</div>';

  var prevMap = {};
  if (prevWeekData) (prevWeekData.experiments || []).forEach(function(e) { prevMap[e.id] = e; });

  var html = '<table class="we-exp-table"><thead><tr>' +
    '<th>Experiment</th><th>Top</th><th>Bottom</th><th>Rate</th><th>Verdict</th></tr></thead><tbody>';

  modeExps.forEach(function(e) {
    var prev = prevMap[e.id];
    var rate = expRateStr(e);
    var rateNum = expRate(e);
    var topV = expTopVal(e), botV = expBottomVal(e);
    var prevTop = prev ? expTopVal(prev) : null;
    var prevBot = prev ? expBottomVal(prev) : null;
    var dTop = prev ? calcCellDelta(topV, prevTop) : null;
    var dBot = prev ? calcCellDelta(botV, prevBot) : null;
    var isNew = !prev && prevWeekData;
    var info = CH[e.ch];

    html += '<tr>' +
      '<td><div class="we-exp-name">' + e.name + '</div><div class="we-exp-ch">' + (info ? info.label : e.ch) + '</div></td>' +
      '<td>' + formatNum(topV) + (dTop ? '<span class="we-cell-delta ' + dTop.cls + '">' + dTop.text + '</span>' : isNew ? '<span class="we-cell-delta up">new</span>' : '') + '</td>' +
      '<td>' + formatNum(botV) + (dBot ? '<span class="we-cell-delta ' + dBot.cls + '">' + dBot.text + '</span>' : '') + '</td>' +
      '<td>' + rate + '</td>' +
      '<td><span class="we-exp-verdict ' + verdictCls(e.verdict) + '">' + (e.verdict || '—') + '</span></td></tr>';
  });

  html += '</tbody></table>';
  return html;
}

/* --- Summary cards --- */
function buildSummaryCards(data, mode, refData) {
  var html = '<div class="we-summary">';
  var fields;

  if (mode === 'outbound') {
    fields = [
      { key: 'sourced', label: 'Sourced' },
      { key: 'reached', label: 'Reached' },
      { key: 'converted', label: 'Converted' },
      { key: 'hours', label: 'Hours', suffix: 'h', raw: true }
    ];
  } else {
    fields = [
      { key: 'reach', label: 'Reach' },
      { key: 'engaged', label: 'Engaged' },
      { key: 'gained', label: 'Gained' },
      { key: 'hours', label: 'Hours', suffix: 'h', raw: true }
    ];
  }

  fields.forEach(function(f) {
    var val = data[f.key] || 0;
    var delta = '';
    if (refData && !f.raw && refData[f.key] !== undefined) {
      var d = calcDelta(val, refData[f.key]);
      delta = ' <span class="we-delta ' + d.cls + '">' + d.text + '</span>';
    }
    var display = f.raw ? val + (f.suffix || '') : formatNum(val);
    html += '<div class="we-sum-card"><div class="we-sum-val">' + display + delta + '</div><div class="we-sum-label">' + f.label + '</div></div>';
  });

  html += '</div>';
  return html;
}

/* --- Main render --- */
function renderTimeSeries() {
  var ws = loadWE(), el = document.getElementById('view-weekly');
  if (ws.length === 0) {
    el.innerHTML = '<div class="we-empty">No weekly snapshots yet.<div class="we-empty-sub">Click "Log this week" to capture your first snapshot.</div></div>';
    return;
  }

  if (weSelectedIdx >= ws.length) weSelectedIdx = ws.length - 1;
  var sel = ws[weSelectedIdx];
  var prev = weSelectedIdx > 0 ? ws[weSelectedIdx - 1] : null;
  var comp = weCompareIdx >= 0 && weCompareIdx < ws.length ? ws[weCompareIdx] : null;

  // Week strip
  var strip = '<div class="we-strip">';
  ws.forEach(function(w, i) {
    var cls = i === weSelectedIdx ? 'selected' : (i === weCompareIdx && weCompareMode) ? 'compare-selected' : '';
    var isOut = activeMode === 'outbound';
    var keyNum = isOut ? w.outbound.converted : w.inbound.gained;
    strip += '<div class="we-week-pill ' + cls + '" onclick="weSelectWeek(' + i + ')">' +
      '<div class="we-week-pill-label">' + w.week + '</div>' +
      '<div class="we-week-pill-num">' + keyNum + '</div>' +
      '<div class="we-week-pill-date">' + w.date + '</div></div>';
  });
  strip += '</div>';

  var html = '<div class="we-header">' +
    '<div class="we-title">' + (activeMode === 'outbound' ? 'Outbound' : 'Inbound') + ' — Week Explorer</div>' +
    '<div class="we-actions"><button class="we-compare-btn ' + (weCompareMode ? 'active' : '') + '" onclick="weToggleCompare()">' +
    (weCompareMode ? 'Exit compare' : 'Compare weeks') + '</button>' +
    '<button class="we-snap-btn" onclick="snapshotWeek()">Log this week</button></div></div>' + strip;

  var isOut = activeMode === 'outbound';

  if (weCompareMode && comp) {
    var selData = isOut ? sel.outbound : sel.inbound;
    var compData = isOut ? comp.outbound : comp.inbound;
    var selPrev = weSelectedIdx > 0 ? ws[weSelectedIdx - 1] : null;
    var compPrev = weCompareIdx > 0 ? ws[weCompareIdx - 1] : null;
    html += '<div class="we-compare-grid"><div>' +
      '<div class="we-compare-col-label"><span class="dot" style="background:var(--accent)"></span>' + sel.week + ' &middot; ' + sel.date + '</div>' +
      buildSummaryCards(selData, activeMode, null) + buildExpTable(sel, selPrev, activeMode) +
      '</div><div>' +
      '<div class="we-compare-col-label"><span class="dot" style="background:var(--inbound)"></span>' + comp.week + ' &middot; ' + comp.date + '</div>' +
      buildSummaryCards(compData, activeMode, selData) + buildExpTable(comp, compPrev, activeMode) +
      '</div></div>';
  } else {
    var data = isOut ? sel.outbound : sel.inbound;
    var prevData = prev ? (isOut ? prev.outbound : prev.inbound) : null;
    html += buildSummaryCards(data, activeMode, prevData) + buildExpTable(sel, prev, activeMode);
  }

  el.innerHTML = html;
}
