/* ================================================================
   Content — Generate platform-native posts from source material
   ================================================================ */

var contentSource = '';
var contentResults = {};
var contentGenerating = false;

function renderContent() {
  var el = document.getElementById('view-content');
  var html = '';

  // Source input
  html += '<div class="scrape-input-section">';
  html += '<div class="post-finder-label">Source material</div>' +
    '<textarea class="qa-input content-source" id="content-source" rows="4" ' +
    'placeholder="Paste a URL, article text, notes, or any source material...">' +
    escapeHtml(contentSource) + '</textarea>';

  html += '<div style="margin-top:12px;display:flex;gap:8px;align-items:center">' +
    '<button class="scrape-go-btn" id="content-gen-btn" onclick="generateContent()" ' +
    (contentGenerating ? 'disabled style="opacity:0.5"' : '') + '>' +
    (contentGenerating ? 'Generating...' : 'Generate for LinkedIn + X') + '</button>' +
    '</div>';
  html += '</div>';

  // Results
  if (contentResults.linkedin || contentResults.x) {
    html += '<div class="content-results">';

    if (contentResults.linkedin) {
      html += '<div class="content-card">' +
        '<div class="content-card-header">' +
        '<span class="content-platform-label">LinkedIn</span>' +
        '<button class="scrape-csv-btn" onclick="copyContent(\'linkedin\')">Copy</button>' +
        '</div>' +
        '<textarea class="qa-input content-output" id="content-linkedin" rows="8">' +
        escapeHtml(contentResults.linkedin) + '</textarea>' +
        '</div>';
    }

    if (contentResults.x) {
      html += '<div class="content-card">' +
        '<div class="content-card-header">' +
        '<span class="content-platform-label">X Thread</span>' +
        '<button class="scrape-csv-btn" onclick="copyContent(\'x\')">Copy</button>' +
        '</div>' +
        '<textarea class="qa-input content-output" id="content-x" rows="8">' +
        escapeHtml(contentResults.x) + '</textarea>' +
        '</div>';
    }

    if (contentResults.coreInsight) {
      html += '<div style="margin-top:12px;font-size:13px;color:var(--text-3)">' +
        '<strong>Core insight:</strong> ' + escapeHtml(contentResults.coreInsight) + '</div>';
    }

    html += '</div>';
  }

  el.innerHTML = html;
}

function generateContent() {
  var textarea = document.getElementById('content-source');
  var source = textarea ? textarea.value.trim() : '';
  if (!source) { showToast('Paste some source material first'); return; }

  contentSource = source;
  contentGenerating = true;
  contentResults = {};
  render();

  var apiUrl = getApiUrl();
  var xhr = new XMLHttpRequest();
  xhr.open('POST', apiUrl + '/api/generate-content');
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.timeout = 30000;

  xhr.onload = function() {
    contentGenerating = false;
    if (xhr.status === 200) {
      try {
        var result = JSON.parse(xhr.responseText);
        contentResults = {
          linkedin: result.results?.linkedin || '',
          x: result.results?.x || '',
          coreInsight: result.coreInsight || '',
        };
        showToast('Content generated');
      } catch (e) {
        showToast('Failed to parse response');
      }
    } else {
      try {
        var err = JSON.parse(xhr.responseText);
        showToast(err.error || 'Generation failed');
      } catch (e) {
        showToast('Generation failed: ' + xhr.status);
      }
    }
    render();
  };

  xhr.onerror = function() { contentGenerating = false; showToast('Server unavailable'); render(); };
  xhr.ontimeout = function() { contentGenerating = false; showToast('Generation timed out — try shorter source'); render(); };

  xhr.send(JSON.stringify({
    source: source,
    platforms: ['linkedin', 'x'],
  }));
}

function copyContent(platform) {
  var textarea = document.getElementById('content-' + platform);
  if (!textarea) return;
  navigator.clipboard.writeText(textarea.value).then(function() {
    showToast(platform === 'linkedin' ? 'LinkedIn post copied' : 'X thread copied');
  }).catch(function() {
    prompt('Copy this:', textarea.value);
  });
}
