/* ================================================================
   X Engage — Surface tweets from watched accounts/topics,
   draft AI replies
   ================================================================ */

var XWATCH_KEY = 'hawki_x_watch_v1';
var XTOPICS_KEY = 'hawki_x_topics_v1';
var xTweets = [];
var xSearching = false;

function loadXWatch() {
  var s = localStorage.getItem(XWATCH_KEY);
  return s ? JSON.parse(s) : [];
}

function saveXWatch(list) {
  localStorage.setItem(XWATCH_KEY, JSON.stringify(list));
}

function loadXTopics() {
  var s = localStorage.getItem(XTOPICS_KEY);
  return s ? JSON.parse(s) : [];
}

function saveXTopics(list) {
  localStorage.setItem(XTOPICS_KEY, JSON.stringify(list));
}

function renderXEngage() {
  var el = document.getElementById('view-x-engage');
  var accounts = loadXWatch();
  var topics = loadXTopics();

  var html = '';

  // Setup section
  html += '<div class="scrape-input-section">';

  // Add account
  html += '<div class="post-finder-label">Watch X accounts</div>' +
    '<div class="post-finder-row" style="margin-bottom:8px">' +
    '<input type="text" class="scrape-url-input" id="x-account-input" ' +
    'placeholder="@handle (e.g. @markroberge)" ' +
    'onkeydown="if(event.key===\'Enter\')addXAccount()">' +
    '<button class="scrape-go-btn" onclick="addXAccount()">Add</button>' +
    '</div>';

  // Show watched accounts as tags
  if (accounts.length > 0) {
    html += '<div class="x-tags">';
    accounts.forEach(function(a) {
      html += '<span class="x-tag">@' + escapeHtml(a) +
        ' <span class="x-tag-remove" onclick="removeXAccount(\'' + a.replace(/'/g, "\\'") + '\')">&times;</span></span>';
    });
    html += '</div>';
  }

  // Add topic
  html += '<div class="post-finder-label" style="margin-top:16px">Monitor topics</div>' +
    '<div class="post-finder-row" style="margin-bottom:8px">' +
    '<input type="text" class="scrape-url-input" id="x-topic-input" ' +
    'placeholder="Topic keyword (e.g. GTM, sales hiring)" ' +
    'onkeydown="if(event.key===\'Enter\')addXTopic()">' +
    '<button class="scrape-go-btn" onclick="addXTopic()">Add</button>' +
    '</div>';

  // Show topics as tags
  if (topics.length > 0) {
    html += '<div class="x-tags">';
    topics.forEach(function(t) {
      html += '<span class="x-tag">' + escapeHtml(t) +
        ' <span class="x-tag-remove" onclick="removeXTopic(\'' + t.replace(/'/g, "\\'") + '\')">&times;</span></span>';
    });
    html += '</div>';
  }

  // Search button
  if (accounts.length > 0 || topics.length > 0) {
    html += '<div style="margin-top:16px">' +
      '<button class="scrape-go-btn" id="x-search-btn" onclick="searchXTweets()" ' +
      (xSearching ? 'disabled style="opacity:0.5"' : '') + '>' +
      (xSearching ? 'Searching...' : 'Find tweets') + '</button></div>';
  }

  html += '</div>';

  // Results
  if (xTweets.length > 0) {
    html += '<div class="x-results">';
    xTweets.forEach(function(tw, idx) {
      html += '<div class="x-tweet-card">' +
        '<div class="x-tweet-header">' +
        '<strong>' + escapeHtml(tw.name || tw.username) + '</strong>' +
        ' <span class="x-tweet-handle">@' + escapeHtml(tw.username) + '</span>' +
        (tw.followers ? ' <span class="x-tweet-followers">' + formatNum(tw.followers) + ' followers</span>' : '') +
        '</div>' +
        '<div class="x-tweet-text">' + escapeHtml(tw.text || '').substring(0, 280) + '</div>' +
        '<div class="x-tweet-stats">' +
        (tw.likes ? tw.likes + ' likes' : '') +
        (tw.retweets ? ' · ' + tw.retweets + ' RTs' : '') +
        (tw.replies ? ' · ' + tw.replies + ' replies' : '') +
        '</div>' +
        '<div class="x-tweet-actions">' +
        '<a href="https://twitter.com/' + tw.username + '/status/' + tw.id + '" target="_blank" class="post-finder-link">View</a>' +
        '<button class="scrape-go-btn" style="font-size:12px;padding:6px 14px" onclick="draftXReply(' + idx + ')">Draft Reply</button>' +
        '</div>';

      // Draft area (shown after clicking Draft Reply)
      if (tw._draft !== undefined) {
        html += '<div class="x-draft-area">' +
          '<textarea class="qa-input" id="x-draft-' + idx + '" rows="3">' + escapeHtml(tw._draft) + '</textarea>' +
          '<div style="display:flex;gap:8px;margin-top:8px">' +
          '<button class="scrape-go-btn" style="font-size:12px;padding:6px 14px" onclick="copyXDraft(' + idx + ')">Copy</button>' +
          '<button class="scrape-csv-btn" style="font-size:12px" onclick="rewriteXDraft(' + idx + ')">Rewrite</button>' +
          '</div></div>';
      }

      html += '</div>';
    });
    html += '</div>';
  }

  el.innerHTML = html;
}

function addXAccount() {
  var input = document.getElementById('x-account-input');
  var handle = input.value.trim().replace(/^@/, '');
  if (!handle) return;
  var accounts = loadXWatch();
  if (accounts.indexOf(handle) >= 0) { showToast('Already watching @' + handle); return; }
  accounts.push(handle);
  saveXWatch(accounts);
  input.value = '';
  render();
}

function removeXAccount(handle) {
  var accounts = loadXWatch().filter(function(a) { return a !== handle; });
  saveXWatch(accounts);
  render();
}

function addXTopic() {
  var input = document.getElementById('x-topic-input');
  var topic = input.value.trim();
  if (!topic) return;
  var topics = loadXTopics();
  if (topics.indexOf(topic) >= 0) { showToast('Already monitoring "' + topic + '"'); return; }
  topics.push(topic);
  saveXTopics(topics);
  input.value = '';
  render();
}

function removeXTopic(topic) {
  var topics = loadXTopics().filter(function(t) { return t !== topic; });
  saveXTopics(topics);
  render();
}

function searchXTweets() {
  var accounts = loadXWatch();
  var topics = loadXTopics();
  if (accounts.length === 0 && topics.length === 0) return;

  xSearching = true;
  render();

  var apiUrl = getApiUrl();
  var xhr = new XMLHttpRequest();
  xhr.open('POST', apiUrl + '/api/x-engage');
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.timeout = 20000;

  xhr.onload = function() {
    xSearching = false;
    if (xhr.status === 200) {
      var result = JSON.parse(xhr.responseText);
      xTweets = result.tweets || [];
      showToast(xTweets.length + ' tweets found');
    } else {
      try {
        var err = JSON.parse(xhr.responseText);
        showToast(err.error || 'Search failed');
      } catch (e) {
        showToast('Search failed: ' + xhr.status);
      }
    }
    render();
  };

  xhr.onerror = function() { xSearching = false; showToast('Could not reach server'); render(); };
  xhr.ontimeout = function() { xSearching = false; showToast('Search timed out'); render(); };

  xhr.send(JSON.stringify({ accounts: accounts, topics: topics }));
}

function draftXReply(idx) {
  if (!xTweets[idx]) return;
  var tw = xTweets[idx];
  tw._draft = 'Drafting...';
  render();

  var apiUrl = getApiUrl();
  var xhr = new XMLHttpRequest();
  xhr.open('POST', apiUrl + '/api/draft-reply');
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.timeout = 15000;

  xhr.onload = function() {
    if (xhr.status === 200) {
      var result = JSON.parse(xhr.responseText);
      xTweets[idx]._draft = result.reply || 'Could not generate reply';
    } else {
      xTweets[idx]._draft = 'Draft failed — try again';
    }
    render();
  };

  xhr.onerror = function() { xTweets[idx]._draft = 'Server unavailable'; render(); };
  xhr.ontimeout = function() { xTweets[idx]._draft = 'Timed out'; render(); };

  xhr.send(JSON.stringify({
    tweet_text: tw.text,
    author_name: tw.name || tw.username,
    author_handle: tw.username,
  }));
}

function copyXDraft(idx) {
  var textarea = document.getElementById('x-draft-' + idx);
  if (!textarea) return;
  navigator.clipboard.writeText(textarea.value).then(function() {
    showToast('Reply copied');
  }).catch(function() {
    prompt('Copy this reply:', textarea.value);
  });
}

function rewriteXDraft(idx) {
  if (!xTweets[idx]) return;
  xTweets[idx]._draft = undefined;
  draftXReply(idx);
}

function formatNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}
