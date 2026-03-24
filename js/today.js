/* ================================================================
   Today — Action items only.
   Every verdict creates a visible next state. Nothing vanishes.

   States:
   log_first  → No data. Open pipeline.
   make_call  → Has data, no verdict. Pick one.
   changing   → Verdict = "Change variables". Shows what + counters + Re-evaluate.
   iterating  → Verdict = "Close, iterate". Shows what + counters + Re-evaluate.
   has_next   → Verdict = "Keep going" + next step. Shows step + Done.
   (null)     → Running smoothly. Hidden from Today.
   ================================================================ */

var STATUS = {
  log_first: { label: 'Log first numbers', cls: 'st-log',      sort: 0 },
  make_call: { label: 'Needs a verdict',   cls: 'st-call',     sort: 1 },
  changing:  { label: 'Changing variables', cls: 'st-changing', sort: 2 },
  iterating: { label: 'Iterating',         cls: 'st-iterating',sort: 2 },
  has_next:  { label: 'Next step',         cls: 'st-next',     sort: 3 }
};

var VERDICT_PROMPTS = {
  'Keep going':       'What\'s the next step?',
  'Change variables': 'What are you changing?',
  'Close, iterate':   'What\'s the next iteration?'
};

function getExpStatus(e) {
  var hasData = expHasData(e);
  var hasVerdict = e.verdict && e.verdict !== 'pending' && e.verdict !== '';
  var hasNext = e.next && e.next.trim().length > 0;

  if (!hasData) return 'log_first';
  if (!hasVerdict) return 'make_call';

  // Active work states — these stay in Today
  if (e.verdict === 'Change variables' && hasNext) return 'changing';
  if (e.verdict === 'Close, iterate' && hasNext) return 'iterating';
  if (e.verdict === 'Keep going' && hasNext) return 'has_next';

  // Just made a call but no next step yet — needs one
  if (hasVerdict && !hasNext && e.verdict !== 'Keep going') return 'make_call';

  return null; // running, hidden
}

function renderToday() {
  var el = document.getElementById('view-today');
  if (!el) return;

  var exps = load();
  var active = exps.filter(function(e) { return e.verdict !== 'Stop' && CH[e.ch]; });
  var modeActive = active.filter(function(e) { return CH[e.ch].mode === activeMode; });
  var actionItems = modeActive.filter(function(e) { return getExpStatus(e) !== null; });

  actionItems.sort(function(a, b) {
    var sa = STATUS[getExpStatus(a)].sort;
    var sb = STATUS[getExpStatus(b)].sort;
    if (sa !== sb) return sa - sb;
    return (b.hours || 0) - (a.hours || 0);
  });

  var nudges = modeActive.filter(function(e) {
    if (getExpStatus(e) !== null) return false;
    var sg = suggestVerdict(e);
    return sg.verdict && sg.verdict !== e.verdict && sg.confidence >= 70;
  });

  var totalCount = actionItems.length + nudges.length;

  if (totalCount === 0) {
    el.innerHTML = '<div class="section-head"><h2 class="section-title">Today</h2>' +
      '<span class="section-meta">All clear</span></div>' +
      '<div class="td-allclear">Nothing needs your attention. Update numbers in Experiments below as you work.</div>';
    return;
  }

  var html = '<div class="section-head"><h2 class="section-title">Today</h2>' +
    '<span class="section-meta">' + totalCount + ' item' + (totalCount !== 1 ? 's' : '') + '</span></div>';

  actionItems.forEach(function(e) {
    var info = CH[e.ch];
    var status = getExpStatus(e);
    var st = STATUS[status];
    var ri = e.rateIdx || info.rateIdx;

    html += '<div class="td-card ' + st.cls + '" id="td-card-' + e.id + '">';
    html += '<div class="td-top"><span class="td-status ' + st.cls + '">' + st.label + '</span>' +
      '<span class="td-ch" style="color:' + info.color + '">' + info.label + '</span></div>';
    html += '<div class="td-name">' + e.name + '</div>';

    // ── Log first numbers ──
    if (status === 'log_first') {
      html += '<div class="td-prompt">No data yet. Log your first numbers:</div>';
      // Show pipeline stages inline for quick entry
      html += '<div class="td-pipe-entry">';
      e.stages.forEach(function(stg, idx) {
        html += '<div class="td-pipe-field">' +
          '<label class="td-pipe-label">' + stg.label + '</label>' +
          '<input type="number" class="td-pipe-input" value="' + stg.val + '" min="0" ' +
          'data-exp="' + e.id + '" data-idx="' + idx + '" ' +
          'onchange="todayUpdateStage(' + e.id + ',' + idx + ',this.value)">' +
          '</div>';
      });
      html += '</div>' +
        '<div class="td-actions"><button class="td-done-btn" onclick="todaySaveFirst(' + e.id + ')">Save numbers</button></div>';

    // ── Needs a verdict ──
    } else if (status === 'make_call') {
      var sg = suggestVerdict(e);
      if (sg.verdict) {
        var sgCls = sg.verdict === 'Keep going' ? 'sg-keep' : sg.verdict === 'Change variables' ? 'sg-change' : 'sg-stop';
        html += '<div class="td-suggestion ' + sgCls + '">' +
          '<div class="td-sg-head"><span class="td-sg-label">AI suggests:</span> <strong>' + sg.verdict + '</strong>' +
          '<span class="td-sg-conf">' + sg.confidence + '% confidence</span></div>' +
          '<div class="td-sg-reason">' + sg.reason + '</div>';
        if (sg.variables && sg.variables.length > 0) {
          html += '<div class="td-sg-vars">Try changing: ' + sg.variables.join(', ') + '</div>';
        }
        html += '</div>';
      } else if (sg.reason) {
        html += '<div class="td-suggestion td-sg-wait"><div class="td-sg-reason">' + sg.reason + '</div></div>';
      }
      html += '<div class="td-verdict-row" id="td-verdict-' + e.id + '">' +
        ['Keep going', 'Change variables', 'Close, iterate', 'Stop'].map(function(v) {
          var bc = v === 'Keep going' ? 'keep' : v === 'Change variables' ? 'change' : v === 'Close, iterate' ? 'close' : 'stop';
          var isSuggested = sg.verdict === v;
          return '<button class="vbtn v-' + bc + (isSuggested ? ' vbtn-suggested' : '') + '" onclick="todayVerdict(' + e.id + ',\'' + v + '\')">' + v + (isSuggested ? ' *' : '') + '</button>';
        }).join('') + '</div>';
      html += '<div class="td-followup" id="td-followup-' + e.id + '" style="display:none"></div>';

    // ── Changing variables — active work state ──
    } else if (status === 'changing' || status === 'iterating') {
      var actionLabel = status === 'changing' ? 'Changing' : 'Next iteration';
      html += '<div class="td-change-what"><span class="td-change-label">' + actionLabel + ':</span> ' + e.next + '</div>';

      // Counters to update while working
      html += buildTodayCounters(e, ri);

      html += '<div class="td-actions">' +
        '<button class="td-action-btn" onclick="todayReeval(' + e.id + ')">Re-evaluate</button>' +
        '<button class="td-edit-btn" onclick="todayEditNext(' + e.id + ',this.closest(\'.td-card\').querySelector(\'.td-change-what\'))">Edit</button></div>';

    // ── Keep going — next step ──
    } else if (status === 'has_next') {
      html += '<div class="td-next-step">' + e.next + '</div>' +
        '<div class="td-actions" id="td-nextactions-' + e.id + '">' +
        '<button class="td-done-btn" onclick="todayDone(' + e.id + ')">Done</button>' +
        '<button class="td-edit-btn" onclick="todayEditNext(' + e.id + ',this.closest(\'.td-card\').querySelector(\'.td-next-step\'))">Edit</button></div>';
      html += '<div class="td-followup" id="td-followup-' + e.id + '" style="display:none"></div>';
    }

    html += '</div>';
  });

  // AI nudges
  nudges.forEach(function(e) {
    var info = CH[e.ch];
    var sg = suggestVerdict(e);
    var sgCls = sg.verdict === 'Keep going' ? 'sg-keep' : sg.verdict === 'Change variables' ? 'sg-change' : 'sg-stop';
    html += '<div class="td-card td-card-nudge">' +
      '<div class="td-top"><span class="td-status st-nudge">AI disagrees</span>' +
      '<span class="td-ch" style="color:' + info.color + '">' + info.label + '</span></div>' +
      '<div class="td-name">' + e.name + '</div>' +
      '<div class="td-sg-nudge ' + sgCls + '">Your verdict: <strong>' + e.verdict + '</strong>. AI thinks: <strong>' + sg.verdict + '</strong> — ' + sg.reason + '</div>' +
      '</div>';
  });

  el.innerHTML = html;
}

/* ── Counter builder (shared between changing/iterating) ── */
function buildTodayCounters(e, ri) {
  if (!expHasData(e)) return '';
  var numStage = e.stages[ri[0]];
  var denStage = e.stages[ri[1]];
  var lastStage = e.stages[e.stages.length - 1];
  var lastIdx = e.stages.length - 1;
  var rate = expRateStr(e);

  var html = '<div class="td-counters">';
  if (denStage) {
    html += '<div class="td-ctr" onclick="quickBump(' + e.id + ',' + ri[1] + ',this)">' +
      '<div class="td-ctr-val">' + formatNum(denStage.val) + '</div>' +
      '<div class="td-ctr-label">' + denStage.label + '</div></div>';
  }
  if (numStage && ri[0] !== ri[1]) {
    html += '<div class="td-ctr" onclick="quickBump(' + e.id + ',' + ri[0] + ',this)">' +
      '<div class="td-ctr-val">' + formatNum(numStage.val) + '</div>' +
      '<div class="td-ctr-label">' + numStage.label + '</div></div>';
  }
  if (lastStage && lastIdx !== ri[0] && lastIdx !== ri[1]) {
    html += '<div class="td-ctr td-ctr-key" onclick="quickBump(' + e.id + ',' + lastIdx + ',this)">' +
      '<div class="td-ctr-val">' + formatNum(lastStage.val) + '</div>' +
      '<div class="td-ctr-label">' + lastStage.label + '</div></div>';
  }
  html += '<div class="td-rate">' + rate + '</div></div>';
  return html;
}

/* ================================================================
   Action chains
   ================================================================ */

function todayVerdict(id, verdict) {
  if (verdict === 'Stop') {
    var exps = load();
    exps.find(function(x) { return x.id === id; }).verdict = 'Stop';
    save(exps);
    todayFadeOut(id, 'Stopped');
    return;
  }

  // Save verdict
  var exps = load();
  exps.find(function(x) { return x.id === id; }).verdict = verdict;
  save(exps);

  // Hide verdict buttons, show "what's next?"
  var vRow = document.getElementById('td-verdict-' + id);
  if (vRow) vRow.style.display = 'none';

  var prompt = VERDICT_PROMPTS[verdict] || 'What\'s next?';
  var followup = document.getElementById('td-followup-' + id);
  if (followup) {
    followup.style.display = 'block';
    followup.innerHTML =
      '<div class="td-followup-label">' + verdict + ' — ' + prompt + '</div>' +
      '<input type="text" class="td-next-input" id="td-fi-' + id + '" placeholder="' + prompt + '" onkeydown="todayFollowupKey(' + id + ',event)">' +
      '<div class="td-followup-hint">Enter to save</div>';
    setTimeout(function() { var i = document.getElementById('td-fi-' + id); if (i) i.focus(); }, 50);
  }
}

function todayFollowupKey(id, e) {
  if (e.key === 'Enter') {
    var val = e.target.value.trim();
    if (!val) { e.target.style.borderColor = 'var(--accent)'; return; } // require input
    var exps = load();
    exps.find(function(x) { return x.id === id; }).next = val;
    save(exps);
    showToast(exps.find(function(x) { return x.id === id; }).verdict + ': ' + val);
    render(); // re-render — card reappears as "changing" or "has_next"
  }
  if (e.key === 'Escape') { render(); }
}

/* "Re-evaluate" — clear verdict so it goes back to "make_call" */
function todayReeval(id) {
  var exps = load();
  var e = exps.find(function(x) { return x.id === id; });
  e.verdict = '';
  e.next = '';
  save(exps);
  showToast('Re-evaluating: ' + e.name);
  render();
}

/* "Done" on a keep-going next step */
function todayDone(id) {
  var actEl = document.getElementById('td-nextactions-' + id);
  if (actEl) actEl.style.display = 'none';

  var followup = document.getElementById('td-followup-' + id);
  if (followup) {
    followup.style.display = 'block';
    followup.innerHTML =
      '<div class="td-followup-label">Done! What\'s next?</div>' +
      '<input type="text" class="td-next-input" id="td-fi-' + id + '" placeholder="Next step (or leave blank to finish)" onkeydown="todayDoneKey(' + id + ',event)">' +
      '<div class="td-followup-hint">Enter to save. Blank = all done for now.</div>';
    setTimeout(function() { var i = document.getElementById('td-fi-' + id); if (i) i.focus(); }, 50);
  }
}

function todayDoneKey(id, e) {
  if (e.key === 'Enter') {
    var val = e.target.value.trim();
    var exps = load();
    exps.find(function(x) { return x.id === id; }).next = val;
    save(exps);
    if (val) {
      showToast('Next: ' + val);
    } else {
      todayFadeOut(id, 'All done');
      return;
    }
    render();
  }
  if (e.key === 'Escape') { render(); }
}

/* ================================================================
   Fade out + toast
   ================================================================ */

function todayFadeOut(id, message) {
  var card = document.getElementById('td-card-' + id);
  if (card) {
    card.classList.add('td-card-out');
    setTimeout(function() { render(); }, 350);
  } else {
    render();
  }
  showToast(message);
}

function showToast(msg) {
  var el = document.getElementById('saved');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(function() { el.classList.remove('show'); el.textContent = 'Saved'; }, 2200);
}

/* ================================================================
   First numbers entry
   ================================================================ */

function todayUpdateStage(id, idx, val) {
  var exps = load();
  var e = exps.find(function(x) { return x.id === id; });
  e.stages[idx].val = parseInt(val) || 0;
  save(exps);
}

function todaySaveFirst(id) {
  var exps = load();
  var e = exps.find(function(x) { return x.id === id; });
  if (!expHasData(e)) {
    showToast('Enter at least one number');
    return;
  }
  save(exps);
  showToast('Numbers saved for ' + e.name);
  render(); // re-renders — card now shows as "make_call" since it has data but no verdict
}

/* ================================================================
   Edit next step inline
   ================================================================ */

function todayEditNext(id, el) {
  var exps = load();
  var e = exps.find(function(x) { return x.id === id; });
  var input = document.createElement('input');
  input.type = 'text'; input.value = e.next || '';
  input.className = 'td-next-input';
  input.placeholder = 'What to do next...';
  el.innerHTML = ''; el.appendChild(input); input.focus();
  function c() { e.next = input.value; save(exps); flash(); render(); }
  input.addEventListener('blur', c);
  input.addEventListener('keydown', function(ev) { if (ev.key === 'Enter') c(); });
}
