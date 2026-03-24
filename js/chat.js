/* ================================================================
   Quick Add — Inline + panel experiment creation
   ================================================================ */

/* --- Inline add --- */
function inlineAdd() {
  var existing = document.getElementById('inline-add-row');
  if (existing) { existing.querySelector('input').focus(); return; }
  var list = document.querySelector('.exp-list');
  if (!list) return;
  var row = document.createElement('div');
  row.id = 'inline-add-row'; row.className = 'inline-add';
  row.innerHTML = '<input type="text" class="inline-add-input" placeholder="Experiment name..." onkeydown="inlineAddKey(event)" autofocus>' +
    '<button class="inline-add-cancel" onclick="inlineAddCancel()">Esc</button>';
  list.appendChild(row);
  setTimeout(function() { row.querySelector('input').focus(); }, 50);
}

function inlineAddKey(e) {
  if (e.key === 'Enter') { var n = e.target.value.trim(); if (n) { createExperiment(n, activeFlow); } inlineAddCancel(); }
  if (e.key === 'Escape') inlineAddCancel();
}

function inlineAddCancel() { var r = document.getElementById('inline-add-row'); if (r) r.remove(); }

/* --- Quick-add panel --- */
var qaOpen = false;
var qaChannel = null;

function openModal() {
  qaOpen = !qaOpen;
  if (!qaOpen) { closeModal(); return; }

  var outChannels = Object.entries(CH).filter(function(p) { return p[1].mode === 'outbound'; });
  var inChannels = Object.entries(CH).filter(function(p) { return p[1].mode === 'inbound'; });
  qaChannel = activeFlow;

  document.getElementById('modal').classList.add('open');
  document.querySelector('.chat').innerHTML =
    '<div class="qa-panel"><div class="qa-header"><h2 class="qa-title">New Experiment</h2>' +
    '<button class="chat-close" onclick="closeModal()">&times;</button></div>' +
    '<div class="qa-body">' +
    '<div class="qa-field"><label class="qa-label">Name</label>' +
    '<input type="text" class="qa-input" id="qa-name" placeholder="What are you testing?" onkeydown="if(event.key===\'Enter\')qaSubmit()"></div>' +
    '<div class="qa-field"><label class="qa-label">Channel</label>' +
    '<div class="qa-mode-label">Outbound</div><div class="qa-chips">' +
    outChannels.map(function(p) {
      return '<button class="qa-chip ' + (p[0] === qaChannel ? 'active' : '') + '" onclick="qaPickChannel(\'' + p[0] + '\')" style="--chip-color:' + p[1].color + '">' +
        '<span class="qa-chip-dot" style="background:' + p[1].color + '"></span>' + p[1].label + '</button>';
    }).join('') + '</div>' +
    '<div class="qa-mode-label" style="margin-top:var(--s-8)">Inbound</div><div class="qa-chips">' +
    inChannels.map(function(p) {
      return '<button class="qa-chip ' + (p[0] === qaChannel ? 'active' : '') + '" onclick="qaPickChannel(\'' + p[0] + '\')" style="--chip-color:' + p[1].color + '">' +
        '<span class="qa-chip-dot" style="background:' + p[1].color + '"></span>' + p[1].label + '</button>';
    }).join('') + '</div></div>' +
    '<div class="qa-field"><label class="qa-label">Target</label>' +
    '<input type="text" class="qa-input qa-input-sm" id="qa-target" placeholder="e.g. >20% reply rate"></div>' +
    '<div class="qa-field"><label class="qa-label">Idea / Context</label>' +
    '<input type="text" class="qa-input qa-input-sm" id="qa-idea" placeholder="Brief description (optional)"></div>' +
    '<div class="qa-field"><label class="qa-label">Tools</label>' +
    '<input type="text" class="qa-input qa-input-sm" id="qa-tools" placeholder="e.g. Sales Nav → Dripify (optional)"></div>' +
    '</div><div class="qa-footer"><button class="qa-cancel" onclick="closeModal()">Cancel</button>' +
    '<button class="qa-submit" onclick="qaSubmit()">Add to Sprint</button></div></div>';

  setTimeout(function() { var n = document.getElementById('qa-name'); if (n) n.focus(); }, 100);
}

function closeModal() {
  qaOpen = false;
  document.getElementById('modal').classList.remove('open');
}

function qaPickChannel(ch) {
  qaChannel = ch;
  document.querySelectorAll('.qa-chip').forEach(function(c) { c.classList.remove('active'); });
  var t = document.querySelector('.qa-chip[onclick*="' + ch + '"]');
  if (t) t.classList.add('active');
}

function qaSubmit() {
  var name = document.getElementById('qa-name').value.trim();
  if (!name) { document.getElementById('qa-name').focus(); return; }
  var target = document.getElementById('qa-target').value.trim();
  var idea = document.getElementById('qa-idea').value.trim();
  var tools = document.getElementById('qa-tools').value.trim();
  createExperiment(name, qaChannel || activeFlow, target, null, idea, tools);
  closeModal();
}

/* --- Settings panel --- */
function openSettings() {
  var key = getAIKey();
  var masked = key ? key.slice(0, 8) + '...' + key.slice(-4) : '';

  document.getElementById('modal').classList.add('open');
  document.querySelector('.chat').innerHTML =
    '<div class="qa-panel"><div class="qa-header"><h2 class="qa-title">Settings</h2>' +
    '<button class="chat-close" onclick="closeModal()">&times;</button></div>' +
    '<div class="qa-body">' +
    '<div class="qa-field"><label class="qa-label">Anthropic API Key</label>' +
    '<input type="password" class="qa-input qa-input-sm" id="settings-key" placeholder="sk-ant-..." value="' + key + '">' +
    '<div style="font-size:var(--fs-xs);color:var(--text-4);margin-top:var(--s-4)">Used to generate AI benchmarks for experiments. Key is stored locally in your browser only.' +
    (masked ? ' Current: ' + masked : '') + '</div></div>' +
    '<div class="qa-field"><label class="qa-label">AI Benchmarks</label>' +
    '<div style="display:flex;gap:var(--s-8);flex-wrap:wrap">' +
    '<button class="td-action-btn" onclick="runGenAll()" id="gen-all-btn">Generate benchmarks for all experiments</button>' +
    '<button class="td-edit-btn" onclick="clearAllBenchmarks()">Reset to defaults</button></div>' +
    '<div style="font-size:var(--fs-xs);color:var(--text-4);margin-top:var(--s-4)" id="gen-status">Uses Claude Haiku to analyze each experiment and suggest appropriate benchmarks.</div></div>' +
    '</div><div class="qa-footer"><button class="qa-submit" onclick="saveSettings()">Save</button></div></div>';
}

function saveSettings() {
  var key = document.getElementById('settings-key').value.trim();
  setAIKey(key);
  flash();
  closeModal();
}

function runGenAll() {
  var btn = document.getElementById('gen-all-btn');
  var status = document.getElementById('gen-status');
  if (btn) btn.textContent = 'Generating...';
  if (status) status.textContent = 'Calling Claude Haiku for each experiment...';

  generateAllBenchmarks(function() {
    if (btn) btn.textContent = 'Done!';
    if (status) status.textContent = 'Benchmarks generated. Close settings to see suggestions.';
    render();
  });
}

function clearAllBenchmarks() {
  localStorage.removeItem(BM_KEY);
  flash();
  render();
  var status = document.getElementById('gen-status');
  if (status) status.textContent = 'Reset to channel defaults.';
}

/* --- Shared creation --- */
function createExperiment(name, ch, target, targetNum, idea, tools) {
  var exps = load();
  var id = exps.reduce(function(m, e) { return Math.max(m, e.id); }, 0) + 1;
  var now = new Date();
  var info = CH[ch];

  // Default target
  if (!target && info) {
    var defs = {
      li_outreach: '>20% reply rate', lead_lists: '>15% reply rate',
      warm_intros: '>40% meeting rate', gifts: '>35% response rate',
      email: '>30% click rate', events: '>10% conv-to-signup',
      li_content: '>3% engagement', twitter: '>2% engagement',
      reddit: '>10% upvote rate', content_seo: '>2% visit-to-signup',
      product: '>10% activation'
    };
    target = defs[ch] || 'TBD';
  }

  if (!targetNum) {
    var match = (target || '').match(/>?\s*(\d+(?:\.\d+)?)\s*%/);
    if (match) targetNum = parseFloat(match[1]) / 100;
  }

  // Build stages from channel defaults
  var stages = (info ? info.defaultStages : ['Input', 'Output', 'Result']).map(function(label) {
    return { label: label, val: 0 };
  });

  exps.push({
    id: id, ch: ch, name: name,
    started: MONTHS[now.getMonth()] + ' ' + now.getDate(),
    target: target || 'TBD', targetNum: targetNum || 0,
    idea: idea || '', tools: tools || '',
    stages: stages,
    rateIdx: info ? info.rateIdx : [1, 0],
    hours: 0, verdict: '', next: ''
  });

  save(exps); flash();
  if (info) activeMode = info.mode;
  activeFlow = ch;
  render();
}
