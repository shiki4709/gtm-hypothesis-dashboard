/* ================================================================
   Chat — AI-guided experiment creation

   Flow:
   1. User describes their idea
   2. AI breaks it into pipeline stages + suggests tools
   3. User reviews, edits if needed
   4. Creates the experiment
   ================================================================ */

var qaOpen = false;
var chatMessages = [];
var chatPending = null; // AI-generated experiment waiting to be confirmed

function openModal() {
  if (qaOpen) { closeModal(); return; }
  qaOpen = true;
  chatMessages = [];
  chatPending = null;

  document.getElementById('modal').classList.add('open');
  renderChat();

  setTimeout(function() {
    addBotMessage("What workflow do you want to test? Describe your idea and I'll help you figure out the steps.");
    var input = document.getElementById('chat-input');
    if (input) input.focus();
  }, 200);
}

function closeModal() {
  qaOpen = false;
  chatPending = null;
  document.getElementById('modal').classList.remove('open');
}

function renderChat() {
  document.querySelector('.chat').innerHTML =
    '<div class="chat-panel">' +
    '<div class="chat-top"><span class="chat-title">New Workflow</span>' +
    '<button class="chat-close" onclick="closeModal()">&times;</button></div>' +
    '<div class="chat-msgs" id="chat-msgs"></div>' +
    '<div class="chat-bottom" id="chat-bottom">' +
    '<input type="text" class="chat-input" id="chat-input" placeholder="Describe your idea..." ' +
    'onkeydown="if(event.key===\'Enter\')sendChat()">' +
    '<button class="chat-send" onclick="sendChat()">Send</button></div></div>';
}

function addBotMessage(text) {
  chatMessages.push({ role: 'bot', text: text });
  renderMessages();
}

function addUserMessage(text) {
  chatMessages.push({ role: 'user', text: text });
  renderMessages();
}

function renderMessages() {
  var el = document.getElementById('chat-msgs');
  if (!el) return;
  el.innerHTML = chatMessages.map(function(m) {
    return '<div class="chat-msg chat-msg-' + m.role + '">' + m.text + '</div>';
  }).join('');
  el.scrollTop = el.scrollHeight;
}

function sendChat() {
  var input = document.getElementById('chat-input');
  var text = input.value.trim();
  if (!text) return;
  input.value = '';
  addUserMessage(text);

  // If we have a pending experiment and user says something, treat as edit
  if (chatPending) {
    addBotMessage('Let me revise...');
    callAI(text, true);
    return;
  }

  // First message — ask AI to design the experiment
  addBotMessage('Thinking...');
  callAI(text, false);
}

function callAI(userText, isRevision) {
  var key = getAIKey();

  if (!key) {
    // No API key — use a simple template approach
    chatMessages.pop(); // remove "Thinking..."
    noAIFallback(userText);
    return;
  }

  var systemPrompt = 'You are a B2B SaaS GTM workflow designer for Nevara.\n\n' +
    'Design a runnable GTM workflow as a measurable pipeline.\n\n' +
    'Respond with ONLY JSON (no markdown):\n' +
    '{\n' +
    '  "name": "Short workflow name",\n' +
    '  "idea": "One line: what this does",\n' +
    '  "mode": "outbound or inbound",\n' +
    '  "tools": "Tool1 → Tool2",\n' +
    '  "stages": ["Step 1", "Step 2", ...],\n' +
    '  "methods": ["How step 1 is done with what tool/prompt", ...],\n' +
    '  "rateIdx": [numerator_idx, denominator_idx],\n' +
    '  "explanation": "2-3 sentences on the workflow"\n' +
    '}\n\n' +
    '4-7 stages from sourcing to conversion. Each measurable.\n' +
    'Methods: specific tool + prompt/criteria per step.\n' +
    'Outbound: DMs, email, events. Inbound: content, SEO, product.';

  var messages = [{ role: 'user', content: (isRevision ? 'Revise: ' : '') + userText }];

  var xhr = new XMLHttpRequest();
  xhr.open('POST', 'https://api.anthropic.com/v1/messages');
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.setRequestHeader('x-api-key', key);
  xhr.setRequestHeader('anthropic-version', '2023-06-01');
  xhr.setRequestHeader('anthropic-dangerous-direct-browser-access', 'true');

  xhr.onload = function() {
    chatMessages.pop(); // remove "Thinking..."
    if (xhr.status === 200) {
      try {
        var resp = JSON.parse(xhr.responseText);
        var text = resp.content[0].text;
        var json = JSON.parse(text.match(/\{[\s\S]*\}/)[0]);
        chatPending = json;
        showProposal(json);
      } catch (err) {
        addBotMessage('Sorry, I couldn\'t parse that. Try describing your idea differently.');
      }
    } else {
      addBotMessage('API error (' + xhr.status + '). Try again or describe more simply.');
    }
  };
  xhr.onerror = function() {
    chatMessages.pop();
    addBotMessage('Network error. Check your connection.');
  };

  xhr.send(JSON.stringify({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    system: systemPrompt,
    messages: messages
  }));
}

function noAIFallback(text) {
  // Simple keyword matching without AI
  var lower = text.toLowerCase();
  var mode = 'outbound';
  var ch = 'li_outreach';
  var stages = ['Sourced', 'Contacted', 'Replied', 'Converted'];
  var tools = '';
  var name = text.split(' ').slice(0, 5).join(' ');

  if (lower.includes('linkedin') && (lower.includes('dm') || lower.includes('outreach') || lower.includes('connection'))) {
    ch = 'li_outreach'; stages = ['ICP filtered', 'Connections sent', 'Accepted', 'Replied', 'Signed up']; tools = 'Sales Nav → Dripify';
  } else if (lower.includes('scrape') || lower.includes('engager') || lower.includes('lead list') || lower.includes('phantom')) {
    ch = 'lead_lists'; stages = ['Posts found', 'Leads scraped', 'ICP filtered', 'DMs sent', 'Replied', 'Signed up']; tools = 'Phantom → Sheets';
  } else if (lower.includes('warm') || lower.includes('intro')) {
    ch = 'warm_intros'; stages = ['Target accounts', 'Mutual connections', 'Intro asks', 'Meetings', 'Signed up']; tools = 'LinkedIn';
  } else if (lower.includes('gift') || lower.includes('sendoso')) {
    ch = 'gifts'; stages = ['AEs contacted', 'Replied', 'Gifts sent', 'Meetings', 'Signed up']; tools = 'LinkedIn → Sendoso';
  } else if (lower.includes('email') || lower.includes('cold email')) {
    ch = 'email'; stages = ['Sent', 'Opened', 'Clicked', 'Signed up']; tools = 'Apollo';
  } else if (lower.includes('event') || lower.includes('coffee') || lower.includes('meetup')) {
    ch = 'events'; stages = ['Events attended', 'Conversations', 'Contacts', 'Signed up']; tools = 'Meetup';
  } else if (lower.includes('content') || lower.includes('post') || lower.includes('linkedin post')) {
    ch = 'li_content'; mode = 'inbound'; stages = ['Posts published', 'Impressions', 'Engagements', 'Followers', 'Inbound DMs']; tools = 'LinkedIn';
  } else if (lower.includes('seo')) {
    ch = 'content_seo'; mode = 'inbound'; stages = ['Pages published', 'Indexed', 'Site visits', 'Signed up']; tools = 'AI writer → WordPress';
  }

  var info = CH[ch];
  chatPending = {
    name: name,
    idea: text,
    mode: mode,
    tools: tools,
    stages: stages,
    rateIdx: info ? info.rateIdx : [stages.length - 2, stages.length - 3],
    explanation: 'Based on your description, I set up a ' + (mode === 'outbound' ? 'outbound' : 'inbound') + ' experiment with ' + stages.length + ' funnel stages. You can edit the steps before creating.',
    ch: ch
  };

  showProposal(chatPending);
}

function showProposal(p) {
  var stagesHTML = p.stages.map(function(s, i) {
    var isRate = (i === p.rateIdx[0] || i === p.rateIdx[1]);
    return '<span class="chat-stage' + (isRate ? ' chat-stage-key' : '') + '">' + s + '</span>';
  }).join('<span class="chat-arrow">→</span>');

  var html = '<div class="chat-proposal">' +
    '<div class="chat-prop-name">' + p.name + '</div>' +
    '<div class="chat-prop-idea">' + p.idea + '</div>' +
    '<div class="chat-prop-row"><span class="chat-prop-label">Mode</span>' + p.mode + '</div>' +
    (p.tools ? '<div class="chat-prop-row"><span class="chat-prop-label">Tools</span>' + p.tools + '</div>' : '') +
    '<div class="chat-prop-label" style="margin-top:var(--s-8)">Pipeline</div>' +
    '<div class="chat-pipe">' + stagesHTML + '</div>' +
    '<div class="chat-prop-explain">' + p.explanation + '</div>' +
    '<div class="chat-prop-actions">' +
    '<button class="chat-create-btn" onclick="createFromChat()">Create this workflow</button>' +
    '</div></div>';

  addBotMessage(html);

  // Change input placeholder
  var input = document.getElementById('chat-input');
  if (input) input.placeholder = 'Want to change something? Or click Create.';
}

function createFromChat() {
  if (!chatPending) return;
  var p = chatPending;

  // Find matching channel or default
  var ch = p.ch || findChannel(p.mode, p.stages);
  var info = CH[ch];

  var exps = load();
  var id = exps.reduce(function(m, e) { return Math.max(m, e.id); }, 0) + 1;
  var now = new Date();

  var stages = p.stages.map(function(label, i) {
    var stg = { label: label, val: 0 };
    if (p.methods && p.methods[i]) stg.method = p.methods[i];
    return stg;
  });

  exps.push({
    id: id, ch: ch, name: p.name,
    idea: p.idea || '', tools: p.tools || '',
    variations: [{
      id: id + 'a',
      name: 'Initial',
      stages: stages,
      rateIdx: p.rateIdx || (info ? info.rateIdx : [1, 0]),
      started: MONTHS[now.getMonth()] + ' ' + now.getDate(),
      stopped: false
    }]
  });

  save(exps); flash();
  if (info) activeMode = info.mode;
  closeModal();
  render();
  showToast('Created: ' + p.name);
}

function findChannel(mode, stages) {
  // Try to match based on mode
  var channels = Object.entries(CH).filter(function(p) { return p[1].mode === mode; });
  if (channels.length > 0) return channels[0][0];
  return Object.keys(CH)[0];
}

/* ================================================================
   Sprint editor + Settings (unchanged)
   ================================================================ */

function editSprint() {
  var sp = loadSprint();
  document.getElementById('modal').classList.add('open');
  qaOpen = true;
  document.querySelector('.chat').innerHTML =
    '<div class="qa-panel"><div class="qa-header"><h2 class="qa-title">Sprint Settings</h2>' +
    '<button class="chat-close" onclick="closeModal()">&times;</button></div>' +
    '<div class="qa-body">' +
    '<div class="qa-field"><label class="qa-label">Sprint Name</label>' +
    '<input type="text" class="qa-input qa-input-sm" id="sp-name" value="' + sp.name + '"></div>' +
    '<div class="qa-field"><label class="qa-label">Start Date</label>' +
    '<input type="text" class="qa-input qa-input-sm" id="sp-start" value="' + sp.start + '" placeholder="e.g. Mar 24"></div>' +
    '<div class="qa-field"><label class="qa-label">End Date</label>' +
    '<input type="text" class="qa-input qa-input-sm" id="sp-end" value="' + sp.end + '" placeholder="e.g. Apr 7"></div>' +
    '<div class="qa-field"><label class="qa-label">Year</label>' +
    '<input type="text" class="qa-input qa-input-sm" id="sp-year" value="' + sp.year + '"></div>' +
    '</div><div class="qa-footer"><button class="qa-cancel" onclick="closeModal()">Cancel</button>' +
    '<button class="qa-submit" onclick="saveSprint({name:document.getElementById(\'sp-name\').value,start:document.getElementById(\'sp-start\').value,end:document.getElementById(\'sp-end\').value,year:document.getElementById(\'sp-year\').value});closeModal();render()">Save</button></div></div>';
}

function openSettings() {
  var claudeKey = localStorage.getItem('hawki_claude_key') || '';
  var icp = loadICP();
  var masked = claudeKey ? claudeKey.slice(0, 12) + '...' + claudeKey.slice(-4) : '';

  qaOpen = true;
  document.getElementById('modal').classList.add('open');
  document.querySelector('.chat').innerHTML =
    '<div class="qa-panel"><div class="qa-header"><h2 class="qa-title">Settings</h2>' +
    '<button class="chat-close" onclick="closeModal()">&times;</button></div>' +
    '<div class="qa-body">' +

    // ICP Keywords
    '<div class="qa-field"><label class="qa-label">Target titles (ICP)</label>' +
    '<input type="text" class="qa-input qa-input-sm" id="settings-icp-titles" ' +
    'value="' + icp.titles.join(', ') + '" placeholder="AE, Account Executive, SDR...">' +
    '<div style="font-size:var(--fs-xs);color:var(--text-4);margin-top:var(--s-4)">People with these words in their headline get the ICP badge. Comma-separated.</div></div>' +

    '<div class="qa-field"><label class="qa-label">Exclude titles</label>' +
    '<input type="text" class="qa-input qa-input-sm" id="settings-icp-exclude" ' +
    'value="' + icp.exclude.join(', ') + '" placeholder="Recruiter, Student...">' +
    '<div style="font-size:var(--fs-xs);color:var(--text-4);margin-top:var(--s-4)">People with these words are always excluded from ICP.</div></div>' +

    // LinkedIn Session
    '<div class="qa-field"><label class="qa-label">LinkedIn Session</label>' +
    '<input type="password" class="qa-input qa-input-sm" id="settings-li-at" ' +
    'placeholder="Paste your li_at token..." value="' + (localStorage.getItem('hawki_li_at') || '') + '">' +
    '<div style="font-size:var(--fs-xs);color:var(--text-4);margin-top:var(--s-4)">' +
    (localStorage.getItem('hawki_li_at') ? 'Connected — sessions refresh every ~30 min' : 'Required. Go to LinkedIn → DevTools (Cmd+Option+I) → Application → Cookies → copy <b>li_at</b> value') +
    '</div></div>' +

    '</div><div class="qa-footer"><button class="qa-cancel" onclick="closeModal()">Cancel</button>' +
    '<button class="qa-submit" onclick="saveSettings()">Save</button></div></div>';
}

function saveSettings() {
  // Save ICP
  var titles = document.getElementById('settings-icp-titles').value.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
  var exclude = document.getElementById('settings-icp-exclude').value.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
  saveICP({ titles: titles, exclude: exclude });

  // Re-apply ICP to all stored scrapes
  var scrapes = loadScrapes();
  scrapes.forEach(function(sc) {
    sc.leads.forEach(function(l) {
      l.icp_match = matchesICP(l.title);
    });
  });
  saveScrapes(scrapes);

  // Save LinkedIn cookie and sync to server
  var liAt = document.getElementById('settings-li-at').value.trim();
  if (liAt) {
    localStorage.setItem('hawki_li_at', liAt);
    // Send to server so it can scrape
    var apiUrl = typeof getApiUrl === 'function' ? getApiUrl() : '';
    var xhr = new XMLHttpRequest();
    xhr.open('POST', apiUrl + '/api/update-cookies');
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(JSON.stringify({ li_at: liAt }));
  } else {
    localStorage.removeItem('hawki_li_at');
  }

  flash();
  closeModal();
  render();
}
