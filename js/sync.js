/* ================================================================
   Sync — Data source connections

   Each experiment can connect to a data source:
   - google_sheets: reads from a public Google Sheet
   - api: fetches from a JSON API endpoint
   - manual: user updates numbers by hand (default)

   Source config stored per experiment in localStorage.
   ================================================================ */

var SYNC_KEY = 'gtm_sources_v1';

function loadSources() {
  var s = localStorage.getItem(SYNC_KEY);
  return s ? JSON.parse(s) : {};
}

function saveSources(src) {
  localStorage.setItem(SYNC_KEY, JSON.stringify(src));
}

function getSource(expId) {
  var sources = loadSources();
  return sources[expId] || { type: 'manual' };
}

function setSource(expId, src) {
  var sources = loadSources();
  sources[expId] = src;
  saveSources(sources);
}

/* ================================================================
   Google Sheets fetch

   Public sheets can be read via:
   https://docs.google.com/spreadsheets/d/{ID}/gviz/tq?tqx=out:csv&sheet={SHEET}

   We parse the CSV to get column headers + latest row.
   ================================================================ */

function extractSheetId(url) {
  var match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

function fetchSheet(sheetId, sheetName, callback) {
  var url = 'https://docs.google.com/spreadsheets/d/' + sheetId +
    '/gviz/tq?tqx=out:csv' + (sheetName ? '&sheet=' + encodeURIComponent(sheetName) : '');

  var xhr = new XMLHttpRequest();
  xhr.open('GET', url);
  xhr.onload = function() {
    if (xhr.status === 200) {
      var rows = parseCSV(xhr.responseText);
      if (rows.length < 2) { callback(null, 'Sheet has no data rows'); return; }
      var headers = rows[0];
      var latest = rows[rows.length - 1];
      callback({ headers: headers, latest: latest, rowCount: rows.length - 1 }, null);
    } else {
      callback(null, 'Could not fetch sheet (is it public?)');
    }
  };
  xhr.onerror = function() { callback(null, 'Network error'); };
  xhr.send();
}

function parseCSV(text) {
  var rows = [];
  var current = [];
  var field = '';
  var inQuote = false;

  for (var i = 0; i < text.length; i++) {
    var c = text[i];
    if (inQuote) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { inQuote = false; }
      else { field += c; }
    } else {
      if (c === '"') { inQuote = true; }
      else if (c === ',') { current.push(field.trim()); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (field || current.length > 0) { current.push(field.trim()); rows.push(current); }
        current = []; field = '';
        if (c === '\r' && text[i + 1] === '\n') i++;
      } else { field += c; }
    }
  }
  if (field || current.length > 0) { current.push(field.trim()); rows.push(current); }
  return rows;
}

/* ================================================================
   Sync an experiment from its connected source
   ================================================================ */

function syncExperiment(expId, callback) {
  var src = getSource(expId);

  if (src.type === 'google_sheets') {
    var sheetId = extractSheetId(src.url);
    if (!sheetId) { callback('Invalid sheet URL'); return; }

    fetchSheet(sheetId, src.sheet || '', function(data, err) {
      if (err) { callback(err); return; }

      // Map sheet columns to experiment stages
      var exps = load();
      var e = exps.find(function(x) { return x.id === expId; });
      if (!e) { callback('Experiment not found'); return; }

      var matched = 0;
      e.stages.forEach(function(stg) {
        var colIdx = -1;
        data.headers.forEach(function(h, i) {
          if (h.toLowerCase().trim() === stg.label.toLowerCase().trim()) colIdx = i;
        });
        if (colIdx >= 0 && data.latest[colIdx] !== undefined) {
          stg.val = parseInt(data.latest[colIdx]) || 0;
          matched++;
        }
      });

      // Save sync timestamp
      src.lastSync = new Date().toISOString();
      src.lastRow = data.rowCount;
      src.matched = matched;
      src.total = e.stages.length;
      setSource(expId, src);

      save(exps);
      callback(null, matched + '/' + e.stages.length + ' stages synced');
    });

  } else if (src.type === 'api') {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', src.endpoint);
    if (src.apiKey) xhr.setRequestHeader('Authorization', 'Bearer ' + src.apiKey);
    xhr.onload = function() {
      if (xhr.status === 200) {
        try {
          var data = JSON.parse(xhr.responseText);
          var exps = load();
          var e = exps.find(function(x) { return x.id === expId; });
          if (!e) { callback('Experiment not found'); return; }

          var matched = 0;
          e.stages.forEach(function(stg) {
            var key = stg.label.toLowerCase().replace(/\s+/g, '_');
            if (data[key] !== undefined) { stg.val = parseInt(data[key]) || 0; matched++; }
            if (data[stg.label] !== undefined) { stg.val = parseInt(data[stg.label]) || 0; matched++; }
          });

          src.lastSync = new Date().toISOString();
          src.matched = matched;
          setSource(expId, src);
          save(exps);
          callback(null, matched + ' stages synced');
        } catch (err) { callback('Parse error: ' + err.message); }
      } else { callback('API error: ' + xhr.status); }
    };
    xhr.onerror = function() { callback('Network error'); };
    xhr.send();

  } else {
    callback(null, 'Manual — no sync needed');
  }
}

/* ================================================================
   Sync all connected experiments
   ================================================================ */

function syncAll(callback) {
  var sources = loadSources();
  var ids = Object.keys(sources).filter(function(id) { return sources[id].type !== 'manual'; });
  if (ids.length === 0) { callback(0); return; }

  var done = 0;
  ids.forEach(function(id) {
    syncExperiment(parseInt(id), function() {
      done++;
      if (done >= ids.length) callback(ids.length);
    });
  });
}

/* ================================================================
   UI: Connect data source modal for an experiment
   ================================================================ */

function openConnect(expId) {
  var e = load().find(function(x) { return x.id === expId; });
  var src = getSource(expId);
  if (!e) return;

  var sinceText = '';
  if (src.lastSync) {
    var ago = Math.round((Date.now() - new Date(src.lastSync).getTime()) / 60000);
    sinceText = ago < 60 ? ago + ' min ago' : Math.round(ago / 60) + 'h ago';
  }

  document.getElementById('modal').classList.add('open');
  document.querySelector('.chat').innerHTML =
    '<div class="qa-panel"><div class="qa-header"><h2 class="qa-title">Connect Data — ' + e.name + '</h2>' +
    '<button class="chat-close" onclick="closeModal()">&times;</button></div>' +
    '<div class="qa-body">' +

    // Source type
    '<div class="qa-field"><label class="qa-label">Data Source</label>' +
    '<div class="qa-chips">' +
    '<button class="qa-chip ' + (src.type === 'manual' ? 'active' : '') + '" onclick="connectType(' + expId + ',\'manual\')">Manual</button>' +
    '<button class="qa-chip ' + (src.type === 'google_sheets' ? 'active' : '') + '" onclick="connectType(' + expId + ',\'google_sheets\')">Google Sheets</button>' +
    '<button class="qa-chip ' + (src.type === 'api' ? 'active' : '') + '" onclick="connectType(' + expId + ',\'api\')">API Endpoint</button>' +
    '</div></div>' +

    // Config area (shown based on type)
    '<div id="connect-config">' + connectConfigHTML(expId, src) + '</div>' +

    // Status
    (sinceText ? '<div class="qa-field"><div class="qa-label">Last synced</div><div style="font-size:var(--fs-sm);color:var(--text-3)">' + sinceText +
    (src.matched !== undefined ? ' · ' + src.matched + '/' + src.total + ' stages matched' : '') + '</div></div>' : '') +

    '</div><div class="qa-footer">' +
    '<button class="qa-cancel" onclick="closeModal()">Close</button>' +
    '<button class="qa-submit" onclick="connectSave(' + expId + ')">Save & Sync</button></div></div>';
}

function connectType(expId, type) {
  var src = getSource(expId);
  src.type = type;
  setSource(expId, src);
  openConnect(expId);
}

function connectConfigHTML(expId, src) {
  var e = load().find(function(x) { return x.id === expId; });
  var stageNames = e ? e.stages.map(function(s) { return s.label; }) : [];
  var headerRow = 'Date, ' + stageNames.join(', ');
  var exampleRow = 'YYYY-MM-DD, ' + stageNames.map(function() { return '0'; }).join(', ');

  var template = '<div class="connect-template">' +
    '<div class="connect-template-label">Your sheet needs these columns:</div>' +
    '<div class="connect-template-row" onclick="navigator.clipboard.writeText(this.textContent);showToast(\'Copied headers\')">' + headerRow + '</div>' +
    '<div class="connect-template-hint">Click to copy. Paste as the first row of your sheet.</div></div>';

  if (src.type === 'google_sheets') {
    return template +
      '<div class="qa-field"><label class="qa-label">Sheet URL</label>' +
      '<input type="text" class="qa-input qa-input-sm" id="connect-url" value="' + (src.url || '') + '" placeholder="https://docs.google.com/spreadsheets/d/..."></div>' +
      '<div class="qa-field"><label class="qa-label">Sheet Name (optional)</label>' +
      '<input type="text" class="qa-input qa-input-sm" id="connect-sheet" value="' + (src.sheet || '') + '" placeholder="Sheet1"></div>' +
      '<div style="font-size:var(--fs-xs);color:var(--text-4);margin-top:var(--s-4);line-height:var(--lh-body)">' +
      'Sheet must be public (Share → Anyone with the link). Dashboard reads the last row.</div>';
  }
  if (src.type === 'api') {
    var jsonExample = '{ ' + stageNames.map(function(n) { return '"' + n + '": 0'; }).join(', ') + ' }';
    return '<div class="qa-field"><label class="qa-label">API Endpoint</label>' +
      '<input type="text" class="qa-input qa-input-sm" id="connect-url" value="' + (src.endpoint || '') + '" placeholder="https://api.example.com/metrics"></div>' +
      '<div class="qa-field"><label class="qa-label">API Key (optional)</label>' +
      '<input type="text" class="qa-input qa-input-sm" id="connect-key" value="' + (src.apiKey || '') + '" placeholder="Bearer token"></div>' +
      '<div class="connect-template"><div class="connect-template-label">Expected JSON response:</div>' +
      '<div class="connect-template-row" style="font-size:var(--fs-xs)" onclick="navigator.clipboard.writeText(this.textContent);showToast(\'Copied\')">' + jsonExample + '</div></div>';
  }
  return '<div style="font-size:var(--fs-sm);color:var(--text-4);padding:var(--s-8) 0">Click pipeline numbers to update manually.</div>';
}

function connectSave(expId) {
  var src = getSource(expId);

  if (src.type === 'google_sheets') {
    var urlEl = document.getElementById('connect-url');
    var sheetEl = document.getElementById('connect-sheet');
    src.url = urlEl ? urlEl.value.trim() : '';
    src.sheet = sheetEl ? sheetEl.value.trim() : '';
  } else if (src.type === 'api') {
    var urlEl = document.getElementById('connect-url');
    var keyEl = document.getElementById('connect-key');
    src.endpoint = urlEl ? urlEl.value.trim() : '';
    src.apiKey = keyEl ? keyEl.value.trim() : '';
  }

  setSource(expId, src);

  if (src.type !== 'manual') {
    showToast('Syncing...');
    syncExperiment(expId, function(err, msg) {
      showToast(err || msg);
      closeModal();
      render();
    });
  } else {
    closeModal();
    render();
  }
}
