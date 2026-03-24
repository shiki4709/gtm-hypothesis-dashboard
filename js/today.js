/* ================================================================
   Review — Decision screen. Shows only when there's a call to make.
   No number entry. No daily ritual. Just decisions.

   Shows:
   - Experiments with enough data for a verdict
   - Experiments mid-change that need re-evaluation
   - Completed next steps that need a new plan
   - New experiments that need first data (points to Experiments tab)
   ================================================================ */

function getExpStatus(e) {
  var hasData = expHasData(e);
  var v = e.verdict || '';
  var hasNext = e.next && e.next.trim().length > 0;

  if (!hasData) return 'needs_data';
  if (!v) return 'needs_verdict';
  if (v === 'Change variables' || v === 'Close, iterate') return 'in_progress';
  if (v === 'Keep going' && hasNext) return 'has_next';
  return null; // running smoothly, nothing to review
}

function renderToday() {
  var el = document.getElementById('view-today');
  if (!el) return;

  var exps = load();
  var active = exps.filter(function(e) { return e.verdict !== 'Stop' && CH[e.ch] && CH[e.ch].mode === activeMode; });

  var items = active.filter(function(e) { return getExpStatus(e) !== null; });

  // No sorting — stable order. Items don't jump around.

  var runningCount = active.length - items.length;

  // Nothing to review
  if (items.length === 0) {
    el.innerHTML = '<div class="rv-clear">' +
      '<div class="rv-clear-title">Nothing to review</div>' +
      '<div class="rv-clear-sub">' + runningCount + ' experiment' + (runningCount !== 1 ? 's' : '') +
      ' running smoothly. Update numbers in the <strong>Experiments</strong> tab.</div></div>';
    return;
  }

  var html = '';

  items.forEach(function(e) {
    var status = getExpStatus(e);
    var info = CH[e.ch];
    var rate = expRateStr(e);

    html += '<div class="rv-item" id="rv-' + e.id + '">';

    // Header
    html += '<div class="rv-head"><div>' +
      '<div class="rv-name">' + e.name + '</div>' +
      '<div class="rv-meta">' + info.label + (rate !== '—' ? ' · ' + rate : '') + '</div></div>';

    if (status === 'needs_data')         html += '<span class="rv-tag rv-tag-grey">No data yet</span>';
    else if (status === 'needs_verdict') html += '<span class="rv-tag rv-tag-amber">Needs verdict</span>';
    else if (status === 'in_progress')   html += '<span class="rv-tag rv-tag-blue">' + e.verdict + '</span>';
    else if (status === 'has_next')      html += '<span class="rv-tag rv-tag-green">Step complete?</span>';
    html += '</div>';

    // ── NEEDS DATA: just point to Experiments tab ──
    if (status === 'needs_data') {
      html += '<div class="rv-body rv-body-light">' +
        'Go to <strong>Experiments</strong> tab to log numbers for this experiment.' +
        '</div>';
    }

    // ── NEEDS VERDICT: AI + buttons ──
    else if (status === 'needs_verdict') {
      var sg = suggestVerdict(e);
      html += '<div class="rv-body">';
      if (sg.verdict) {
        html += '<div class="rv-ai"><strong>' + sg.verdict + '</strong> — ' + sg.reason + '</div>';
      } else if (sg.reason) {
        html += '<div class="rv-ai rv-ai-wait">' + sg.reason + '</div>';
      }
      html += '<div class="rv-btns">' +
        ['Keep going', 'Change variables', 'Close, iterate', 'Stop'].map(function(v) {
          var cls = v === 'Keep going' ? 'green' : v === 'Change variables' ? 'amber' : v === 'Close, iterate' ? 'blue' : 'red';
          var star = sg.verdict === v ? ' *' : '';
          return '<button class="rv-btn rv-btn-' + cls + '" onclick="rvVerdict(' + e.id + ',\'' + v + '\')">' + v + star + '</button>';
        }).join('') + '</div>';
      html += '<div id="rv-prompt-' + e.id + '" style="display:none">' +
        '<input type="text" class="rv-inp" id="rv-inp-' + e.id + '" ' +
        'onkeydown="if(event.key===\'Enter\')rvSaveNext(' + e.id + ')">' +
        '<div class="rv-hint">Enter to save</div></div>';
      html += '</div>';
    }

    // ── IN PROGRESS: show what's being changed + re-evaluate ──
    else if (status === 'in_progress') {
      html += '<div class="rv-body">';
      if (e.next) html += '<div class="rv-what">' + e.next + '</div>';
      html += '<div class="rv-btns">' +
        '<button class="rv-btn rv-btn-outline" onclick="rvReeval(' + e.id + ')">Re-evaluate</button></div>';
      html += '</div>';
    }

    // ── HAS NEXT: show step + done ──
    else if (status === 'has_next') {
      html += '<div class="rv-body">' +
        '<div class="rv-what">' + e.next + '</div>' +
        '<div class="rv-btns">' +
        '<button class="rv-btn rv-btn-green" onclick="rvDone(' + e.id + ')">Done</button>' +
        '<button class="rv-btn rv-btn-outline" onclick="rvEditNext(' + e.id + ')">Edit</button></div>' +
        '<div id="rv-prompt-' + e.id + '" style="display:none">' +
        '<input type="text" class="rv-inp" id="rv-inp-' + e.id + '" placeholder="What\'s next? (blank = done)" ' +
        'onkeydown="if(event.key===\'Enter\')rvSaveNext(' + e.id + ')">' +
        '<div class="rv-hint">Enter to save</div></div></div>';
    }

    html += '</div>';
  });

  // Footer
  if (runningCount > 0) {
    html += '<div class="rv-footer">' + runningCount + ' more experiment' + (runningCount !== 1 ? 's' : '') +
      ' running — no action needed.</div>';
  }

  el.innerHTML = html;
}

/* ── Actions ── */

function rvVerdict(id, v) {
  var exps = load();
  exps.find(function(x) { return x.id === id; }).verdict = v;
  save(exps);

  if (v === 'Stop' || v === 'Keep going') {
    showToast(v === 'Stop' ? 'Stopped' : 'Keep going');
    render();
    return;
  }

  showToast(v);
  var prompt = document.getElementById('rv-prompt-' + id);
  if (prompt) {
    prompt.style.display = 'block';
    var inp = document.getElementById('rv-inp-' + id);
    if (inp) {
      inp.placeholder = v === 'Change variables' ? 'What are you changing?' : 'What\'s the next iteration?';
      inp.focus();
    }
  }
}

function rvSaveNext(id) {
  var inp = document.getElementById('rv-inp-' + id);
  var val = inp ? inp.value.trim() : '';
  var exps = load();
  exps.find(function(x) { return x.id === id; }).next = val;
  save(exps);
  showToast(val ? 'Saved' : 'Done');
  render();
}

function rvReeval(id) {
  var exps = load();
  var e = exps.find(function(x) { return x.id === id; });
  e.verdict = '';
  e.next = '';
  save(exps);
  showToast('Re-evaluating');
  render();
}

function rvDone(id) {
  var prompt = document.getElementById('rv-prompt-' + id);
  if (prompt) {
    prompt.style.display = 'block';
    var inp = document.getElementById('rv-inp-' + id);
    if (inp) inp.focus();
  }
}

function rvEditNext(id) {
  var exps = load();
  var e = exps.find(function(x) { return x.id === id; });
  var prompt = document.getElementById('rv-prompt-' + id);
  if (prompt) {
    prompt.style.display = 'block';
    var inp = document.getElementById('rv-inp-' + id);
    if (inp) { inp.value = e.next || ''; inp.focus(); }
  }
}

function showToast(msg) {
  var el = document.getElementById('saved');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(function() { el.classList.remove('show'); el.textContent = 'Saved'; }, 1500);
}
