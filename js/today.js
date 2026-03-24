/* ================================================================
   Today — Dead simple. One list. Items update in place.
   Click something → it saves → list re-renders. That's it.
   ================================================================ */

function getExpStatus(e) {
  var hasData = expHasData(e);
  var v = e.verdict || '';
  var hasNext = e.next && e.next.trim().length > 0;

  if (!hasData) return 'needs_data';
  if (!v) return 'needs_verdict';
  if (v === 'Change variables' || v === 'Close, iterate') return 'in_progress';
  if (v === 'Keep going' && hasNext) return 'has_next';
  if (v === 'Keep going') return 'all_good';
  return null;
}

function renderToday() {
  var el = document.getElementById('view-today');
  if (!el) return;

  var exps = load();
  var active = exps.filter(function(e) { return e.verdict !== 'Stop' && CH[e.ch] && CH[e.ch].mode === activeMode; });

  if (active.length === 0) {
    el.innerHTML = '<div class="td-empty">No active experiments. Switch modes or add one.</div>';
    return;
  }

  // Sort: needs_data first, then needs_verdict, then in_progress, then has_next, then all_good
  var order = { needs_data: 0, needs_verdict: 1, in_progress: 2, has_next: 3, all_good: 4 };
  active.sort(function(a, b) {
    var sa = order[getExpStatus(a)] || 5;
    var sb = order[getExpStatus(b)] || 5;
    return sa - sb;
  });

  var html = '';

  active.forEach(function(e) {
    var status = getExpStatus(e);
    var info = CH[e.ch];
    var rate = expRateStr(e);

    html += '<div class="td-item" id="td-' + e.id + '">';

    // Header: name + channel + rate
    html += '<div class="td-head">' +
      '<div><div class="td-name">' + e.name + '</div>' +
      '<div class="td-meta">' + info.label + (rate !== '—' ? ' · ' + rate : '') + '</div></div>';

    // Status label
    if (status === 'needs_data') {
      html += '<span class="td-tag td-tag-red">Needs data</span>';
    } else if (status === 'needs_verdict') {
      html += '<span class="td-tag td-tag-amber">Needs verdict</span>';
    } else if (status === 'in_progress') {
      html += '<span class="td-tag td-tag-blue">' + e.verdict + '</span>';
    } else if (status === 'has_next') {
      html += '<span class="td-tag td-tag-green">Next step</span>';
    } else {
      html += '<span class="td-tag td-tag-grey">Running</span>';
    }
    html += '</div>';

    // ── NEEDS DATA: show inline pipeline inputs ──
    if (status === 'needs_data') {
      html += '<div class="td-body"><div class="td-pipe-grid">';
      e.stages.forEach(function(stg, idx) {
        html += '<div class="td-pipe-cell">' +
          '<label class="td-pipe-lbl">' + stg.label + '</label>' +
          '<input type="number" class="td-pipe-inp" value="' + stg.val + '" min="0" ' +
          'onchange="tdStage(' + e.id + ',' + idx + ',this.value)"></div>';
      });
      html += '</div><button class="td-btn td-btn-primary" onclick="tdSaveData(' + e.id + ')">Save numbers</button></div>';
    }

    // ── NEEDS VERDICT: show AI suggestion + buttons ──
    else if (status === 'needs_verdict') {
      var sg = suggestVerdict(e);
      html += '<div class="td-body">';
      if (sg.verdict) {
        html += '<div class="td-ai">AI: <strong>' + sg.verdict + '</strong> — ' + sg.reason + '</div>';
      } else if (sg.reason) {
        html += '<div class="td-ai td-ai-wait">' + sg.reason + '</div>';
      }
      html += '<div class="td-btns">' +
        ['Keep going', 'Change variables', 'Close, iterate', 'Stop'].map(function(v) {
          var cls = v === 'Keep going' ? 'green' : v === 'Change variables' ? 'amber' : v === 'Close, iterate' ? 'blue' : 'red';
          var star = sg.verdict === v ? ' *' : '';
          return '<button class="td-btn td-btn-' + cls + '" onclick="tdVerdict(' + e.id + ',\'' + v + '\')">' + v + star + '</button>';
        }).join('') + '</div>';

      // If verdict was just set but no "next" written yet, show input
      html += '<div id="td-next-prompt-' + e.id + '" style="display:none">' +
        '<input type="text" class="td-text-inp" id="td-next-inp-' + e.id + '" placeholder="What are you changing / doing next?" ' +
        'onkeydown="if(event.key===\'Enter\')tdSaveNext(' + e.id + ')">' +
        '<div class="td-hint">Enter to save</div></div>';
      html += '</div>';
    }

    // ── IN PROGRESS: show what's being changed + numbers + re-evaluate ──
    else if (status === 'in_progress') {
      html += '<div class="td-body">';
      if (e.next) {
        html += '<div class="td-what">' + e.next + '</div>';
      }
      // Quick counters
      var ri = e.rateIdx || info.rateIdx;
      html += '<div class="td-nums">';
      e.stages.forEach(function(stg, idx) {
        if (stg.val > 0 || idx === ri[0] || idx === ri[1]) {
          html += '<div class="td-num" onclick="quickBump(' + e.id + ',' + idx + ',this)">' +
            '<div class="td-num-v">' + formatNum(stg.val) + '</div>' +
            '<div class="td-num-l">' + stg.label + '</div></div>';
        }
      });
      html += '</div>';
      html += '<button class="td-btn td-btn-outline" onclick="tdReeval(' + e.id + ')">Re-evaluate with new numbers</button>';
      html += '</div>';
    }

    // ── HAS NEXT STEP ──
    else if (status === 'has_next') {
      html += '<div class="td-body">' +
        '<div class="td-what">' + e.next + '</div>' +
        '<div class="td-btns">' +
        '<button class="td-btn td-btn-green" onclick="tdDone(' + e.id + ')">Done</button>' +
        '<button class="td-btn td-btn-outline" onclick="tdEditNext(' + e.id + ')">Edit</button></div>' +
        '<div id="td-next-prompt-' + e.id + '" style="display:none">' +
        '<input type="text" class="td-text-inp" id="td-next-inp-' + e.id + '" placeholder="What\'s next? (blank = done for now)" ' +
        'onkeydown="if(event.key===\'Enter\')tdSaveNext(' + e.id + ')">' +
        '<div class="td-hint">Enter to save. Blank = done.</div></div></div>';
    }

    // ── ALL GOOD: just show numbers, clickable ──
    else {
      html += '<div class="td-body"><div class="td-nums">';
      var ri = e.rateIdx || info.rateIdx;
      e.stages.forEach(function(stg, idx) {
        if (stg.val > 0 || idx === ri[0] || idx === ri[1]) {
          html += '<div class="td-num" onclick="quickBump(' + e.id + ',' + idx + ',this)">' +
            '<div class="td-num-v">' + formatNum(stg.val) + '</div>' +
            '<div class="td-num-l">' + stg.label + '</div></div>';
        }
      });
      html += '</div></div>';
    }

    html += '</div>';
  });

  el.innerHTML = html;
}

/* ── Actions — each one saves and re-renders ── */

function tdStage(id, idx, val) {
  var exps = load();
  exps.find(function(x) { return x.id === id; }).stages[idx].val = parseInt(val) || 0;
  save(exps);
}

function tdSaveData(id) {
  var exps = load();
  var e = exps.find(function(x) { return x.id === id; });
  if (!expHasData(e)) return;
  save(exps);
  showToast('Numbers saved');
  render();
}

function tdVerdict(id, v) {
  var exps = load();
  exps.find(function(x) { return x.id === id; }).verdict = v;
  save(exps);

  if (v === 'Stop') {
    showToast('Stopped');
    render();
    return;
  }

  if (v === 'Keep going') {
    showToast('Keep going');
    render();
    return;
  }

  // Change variables / Close iterate → show "what are you changing?" input
  showToast(v);
  var prompt = document.getElementById('td-next-prompt-' + id);
  if (prompt) {
    prompt.style.display = 'block';
    var inp = document.getElementById('td-next-inp-' + id);
    if (inp) {
      inp.placeholder = v === 'Change variables' ? 'What are you changing?' : 'What\'s the next iteration?';
      inp.focus();
    }
  }
}

function tdSaveNext(id) {
  var inp = document.getElementById('td-next-inp-' + id);
  var val = inp ? inp.value.trim() : '';
  var exps = load();
  exps.find(function(x) { return x.id === id; }).next = val;
  save(exps);
  showToast(val ? 'Saved' : 'Done');
  render();
}

function tdReeval(id) {
  var exps = load();
  var e = exps.find(function(x) { return x.id === id; });
  e.verdict = '';
  e.next = '';
  save(exps);
  showToast('Re-evaluating');
  render();
}

function tdDone(id) {
  // Show the "what's next?" input
  var prompt = document.getElementById('td-next-prompt-' + id);
  if (prompt) {
    prompt.style.display = 'block';
    var inp = document.getElementById('td-next-inp-' + id);
    if (inp) inp.focus();
  }
}

function tdEditNext(id) {
  var exps = load();
  var e = exps.find(function(x) { return x.id === id; });
  var prompt = document.getElementById('td-next-prompt-' + id);
  if (prompt) {
    prompt.style.display = 'block';
    var inp = document.getElementById('td-next-inp-' + id);
    if (inp) { inp.value = e.next || ''; inp.focus(); }
  }
}

function showToast(msg) {
  var el = document.getElementById('saved');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(function() { el.classList.remove('show'); el.textContent = 'Saved'; }, 1500);
}
