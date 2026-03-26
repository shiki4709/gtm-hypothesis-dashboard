/* ================================================================
   Scrape — LinkedIn post engagement scraper

   Paste a LinkedIn post URL → scrape engagers → filter by ICP →
   download CSV for Dripify import.

   Uses PhantomBuster API when configured, otherwise demo mode
   with realistic mock data.
   ================================================================ */

var SCRAPE_KEY = 'gtm_scrape_v1';
var ICP_KEY = 'gtm_icp_v1';

/* --- ICP config --- */
var DEFAULT_ICP = {
  titles: ['AE', 'Account Executive', 'SDR', 'Sales Development', 'BDR', 'Business Development', 'Sales Rep', 'Sales Manager', 'Head of Sales', 'VP Sales', 'VP of Sales', 'Sales Leader', 'Sales Director', 'Revenue', 'GTM', 'Growth', 'Founder', 'Co-founder', 'CEO', 'CRO', 'Head of Growth'],
  exclude: ['Recruiter', 'Student', 'Intern']
};

function loadICP() {
  var s = localStorage.getItem(ICP_KEY);
  return s ? JSON.parse(s) : DEFAULT_ICP;
}

function saveICP(icp) {
  localStorage.setItem(ICP_KEY, JSON.stringify(icp));
}

function matchesICP(title) {
  if (!title) return false;
  var t = title.toLowerCase();
  var icp = loadICP();
  var excluded = icp.exclude.some(function(ex) { return t.indexOf(ex.toLowerCase()) >= 0; });
  if (excluded) return false;
  return icp.titles.some(function(kw) { return t.indexOf(kw.toLowerCase()) >= 0; });
}

/* --- Scrape history --- */
function loadScrapes() {
  var s = localStorage.getItem(SCRAPE_KEY);
  return s ? JSON.parse(s) : [];
}

function saveScrapes(d) {
  localStorage.setItem(SCRAPE_KEY, JSON.stringify(d));
}

/* --- Demo data --- */
function generateDemoLeads(postUrl) {
  var names = [
    { name: 'Sarah Chen', title: 'Account Executive', company: 'Datadog', comment: 'This is exactly what we needed for our outbound motion.' },
    { name: 'Marcus Johnson', title: 'SDR Manager', company: 'Gong', comment: 'Great framework! We use a similar approach for enterprise deals.' },
    { name: 'Priya Patel', title: 'Head of Growth', company: 'Notion', comment: 'Love this. Sharing with my team.' },
    { name: 'Jake Morrison', title: 'VP Sales', company: 'Outreach', comment: '' },
    { name: 'Emily Rodriguez', title: 'Revenue Operations', company: 'HubSpot', comment: 'The data on reply rates here is really compelling.' },
    { name: 'Alex Kim', title: 'BDR', company: 'Salesloft', comment: 'Just implemented this last week. Already seeing 2x reply rates.' },
    { name: 'David Nguyen', title: 'Product Marketing Manager', company: 'Intercom', comment: '' },
    { name: 'Rachel Foster', title: 'Account Executive', company: 'Snowflake', comment: 'Bookmarking this for Q2 planning.' },
    { name: 'Chris Taylor', title: 'Recruiter', company: 'Meta', comment: 'Would love to chat about this approach!' },
    { name: 'Lisa Wang', title: 'Sales Development Rep', company: 'MongoDB', comment: '' },
    { name: 'Tom Bradley', title: 'Student', company: 'UC Berkeley', comment: 'Really helpful for my thesis research.' },
    { name: 'Nina Kaur', title: 'GTM Lead', company: 'Stripe', comment: 'We tested something similar — conversion was 3x better than cold outbound.' },
    { name: 'Sam O\'Brien', title: 'Head of Sales', company: 'Figma', comment: '' },
    { name: 'Amanda Lee', title: 'Content Strategist', company: 'Canva', comment: 'The engagement metrics here are wild.' },
    { name: 'Ryan Cooper', title: 'AE', company: 'Cloudflare', comment: 'This changed how I think about outreach sequencing.' },
    { name: 'Diana Martinez', title: 'Growth Marketing', company: 'Vercel', comment: '' },
    { name: 'Ben Wilson', title: 'Sales Manager', company: 'Atlassian', comment: 'Any data on how this works for mid-market vs enterprise?' },
    { name: 'Olivia Park', title: 'Intern', company: 'Google', comment: 'Fascinating read!' },
    { name: 'Kevin Brooks', title: 'VP Revenue', company: 'Twilio', comment: '' },
    { name: 'Sophie Anderson', title: 'Account Executive', company: 'Zendesk', comment: 'We need to talk. DM me.' }
  ];

  return names.map(function(n, i) {
    return {
      name: n.name,
      title: n.title,
      company: n.company,
      linkedin_url: 'https://www.linkedin.com/in/' + n.name.toLowerCase().replace(/[^a-z ]/g, '').replace(/ /g, '-'),
      comment_text: n.comment,
      icp_match: matchesICP(n.title),
      scraped_from: postUrl
    };
  });
}

/* --- Run scrape --- */
function getApiUrl() {
  // Same origin — works on Vercel, localhost, and any deployment
  return '';
}

function runScrape(postUrl, callback) {
  // Try the real API first, fall back to demo mode
  var apiUrl = getApiUrl();
  var xhr = new XMLHttpRequest();
  xhr.open('POST', apiUrl + '/api/scrape');
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.timeout = 120000; // 120s timeout — large posts take time

  xhr.onload = function() {
    if (xhr.status === 200) {
      try {
        var result = JSON.parse(xhr.responseText);
        if (result.error) { callback(result.error); return; }

        // Async mode: scrape started, need to poll
        if (result.status === 'started' && result.pollId) {
          showToast('Scraping... this takes 15-30 seconds');
          pollForResults(postUrl, result.pollId, callback, 0);
          return;
        }

        // Direct results
        if (result.leads && result.leads.length) {
          finishScrape(postUrl, result.leads, callback);
        } else {
          callback('No leads found');
        }
      } catch (e) {
        callback('Failed to parse response: ' + e.message);
      }
    } else {
      try {
        var err = JSON.parse(xhr.responseText);
        callback(err.error || 'Server error');
      } catch (e) {
        callback('Server error: ' + xhr.status);
      }
    }
  };

  xhr.onerror = function() {
    callback('Could not reach server. Check your connection and try again.');
  };

  xhr.ontimeout = function() {
    callback('Scrape timed out');
  };

  xhr.send(JSON.stringify({ url: postUrl }));
}

function pollForResults(postUrl, pollId, callback, attempt) {
  if (attempt > 30) { callback('Scrape timed out after polling'); return; }

  setTimeout(function() {
    var apiUrl = getApiUrl();
    var xhr = new XMLHttpRequest();
    xhr.open('POST', apiUrl + '/api/scrape');
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.timeout = 10000;

    xhr.onload = function() {
      if (xhr.status === 200) {
        var result = JSON.parse(xhr.responseText);
        if (result.status === 'done' && result.leads && result.leads.length > 0) {
          finishScrape(postUrl, result.leads, callback);
        } else if (result.status === 'running') {
          showToast('Still scraping... (' + (attempt + 1) * 3 + 's)');
          pollForResults(postUrl, pollId, callback, attempt + 1);
        } else {
          // Done but no leads
          callback('No leads found for this post');
        }
      } else {
        pollForResults(postUrl, pollId, callback, attempt + 1);
      }
    };

    xhr.onerror = function() {
      pollForResults(postUrl, pollId, callback, attempt + 1);
    };

    xhr.send(JSON.stringify({ runId: pollId }));
  }, 3000);
}

function finishScrape(postUrl, rawLeads, callback) {
  var leads = rawLeads.map(function(l) {
    l.icp_match = matchesICP(l.title);
    l.scraped_from = postUrl;
    return l;
  });
  var scrape = {
    id: Date.now(),
    url: postUrl,
    date: new Date().toISOString(),
    leads: leads,
    mode: 'live'
  };
  var scrapes = loadScrapes();
  scrapes.unshift(scrape);
  saveScrapes(scrapes);
  var matched = leads.filter(function(l) { return l.icp_match; });
  showToast(leads.length + ' leads found · ' + matched.length + ' ICP matches');
  callback(null, scrape);
}

function runDemoScrape(postUrl, callback) {
  setTimeout(function() {
    var leads = generateDemoLeads(postUrl);
    var scrape = {
      id: Date.now(),
      url: postUrl,
      date: new Date().toISOString(),
      leads: leads,
      mode: 'demo'
    };
    var scrapes = loadScrapes();
    scrapes.unshift(scrape);
    saveScrapes(scrapes);
    callback(null, scrape);
  }, 1500);
}

/* --- CSV export --- */
function leadsToCSV(leads) {
  var headers = ['Name', 'Title', 'Company', 'LinkedIn URL', 'Comment', 'ICP Match', 'Source Post'];
  var rows = [headers.join(',')];

  leads.forEach(function(l) {
    rows.push([
      '"' + (l.name || '').replace(/"/g, '""') + '"',
      '"' + (l.title || '').replace(/"/g, '""') + '"',
      '"' + (l.company || '').replace(/"/g, '""') + '"',
      '"' + (l.linkedin_url || '').replace(/"/g, '""') + '"',
      '"' + (l.comment_text || '').replace(/"/g, '""') + '"',
      l.icp_match ? 'Yes' : 'No',
      '"' + (l.scraped_from || '').replace(/"/g, '""') + '"'
    ].join(','));
  });

  return rows.join('\n');
}

function downloadCSV(leads, filename) {
  var csv = leadsToCSV(leads);
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename || 'scraped-leads-' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/* ================================================================
   Runner View — Scrape + Pipeline in one flow
   ================================================================ */

function renderRunner() {
  var el = document.getElementById('view-scrape');

  // ── Onboarding (show when no ICP set — first time user) ──
  if (!localStorage.getItem(ICP_KEY)) {
    showUseCasePicker();
    return;
  }

  var scrapes = loadScrapes();
  var icp = loadICP();

  var html = '';

  // (No connection status needed — Apify handles scraping without cookies)

  // ── Scrape input ──
  html += '<div class="scrape-input-section">' +
    '<div class="scrape-input-row">' +
    '<input type="text" class="scrape-url-input" id="scrape-url" ' +
    'placeholder="Paste a LinkedIn post URL..." ' +
    'onkeydown="if(event.key===\'Enter\')startScrape()">' +
    '<button class="scrape-go-btn" id="scrape-go" onclick="startScrape()">Scrape</button>' +
    '</div>' +
    '<div class="scrape-hint-row">' +
    '<a href="https://www.linkedin.com/search/results/content/?keywords=GTM&sortBy=%22date_posted%22" target="_blank" rel="noopener" class="scrape-find-link">Search LinkedIn for posts</a>' +
    ' · <span onclick="openSettings()" style="cursor:pointer;color:var(--text-3);text-decoration:underline dotted">Settings</span>' +
    '</div>' +
    '<div class="scrape-icp-bar" onclick="openSettings()">' +
    '<span class="scrape-icp-label-text">ICP:</span> ' +
    '<span class="scrape-icp-keywords">' + icp.titles.join(', ') + '</span>' +
    (icp.exclude.length > 0 ? ' <span class="scrape-icp-exclude">Exclude: ' + icp.exclude.join(', ') + '</span>' : '') +
    '<span class="scrape-icp-edit">Edit</span>' +
    '</div>' +
    '</div>';

  // ── Watch List ──
  var watchList = loadWatchList();
  html += '<div class="rc-watch">';
  html += '<div class="rc-watch-header">' +
    '<span class="rc-watch-title">Influencer Watch List</span>' +
    '<div class="rc-watch-add">' +
    '<input type="text" class="rc-watch-input" id="watch-input" ' +
    'placeholder="Paste a LinkedIn profile URL..." ' +
    'onkeydown="if(event.key===\'Enter\')addToWatchList()">' +
    '<button class="scrape-find-btn" onclick="addToWatchList()">Add</button>' +
    '</div></div>';

  if (watchList.length > 0) {
    html += '<div class="rc-watch-hint">' +
      '<button class="rc-watch-check-btn" onclick="checkAllInfluencers()">Check all for new posts</button>' +
      'Opens each profile\'s posts in a new tab. Copy any post URL and paste above to scrape.' +
      '</div>';
    watchList.forEach(function(w, wIdx) {
      // Count how many posts from this influencer we've already scraped
      var scrapedPosts = scrapes.filter(function(sc) {
        return sc.url && sc.url.indexOf(w.username) >= 0;
      });
      var lastScraped = scrapedPosts.length > 0 ? timeAgo(scrapedPosts[0].date) : '';

      html += '<div class="rc-watch-item">' +
        '<div class="rc-watch-info">' +
        '<div class="rc-watch-top">' +
        '<a href="' + w.url + '" target="_blank" rel="noopener" class="rc-watch-name">' + w.name + '</a>' +
        '<span class="rc-watch-num">#' + (wIdx + 1) + '</span>' +
        '</div>' +
        (w.headline ? '<div class="rc-watch-headline">' + w.headline.substring(0, 80) + '</div>' : '') +
        (w.oneliner ? '<div class="rc-watch-oneliner">' + w.oneliner + '</div>' : '') +
        '<span class="rc-watch-stats">' +
        (scrapedPosts.length > 0 ? scrapedPosts.length + ' scraped · last ' + lastScraped : 'Not scraped yet') +
        '</span>' +
        '</div>' +
        '<div class="rc-watch-actions">' +
        '<a href="' + w.url + '/recent-activity/all/" target="_blank" rel="noopener" class="rc-watch-view">Posts</a>' +
        '<button class="scrape-remove-btn" onclick="removeFromWatchList(\'' + w.username + '\')">Remove</button>' +
        '</div></div>';
    });
  } else {
    html += '<div class="rc-watch-hint">Add influencers to monitor. When they post, scrape the engagers to find your ICP.</div>';
  }
  html += '</div>';

  // (ICP + API key config moved to Settings modal — gear icon)

  // ── Pipeline cards (one per scrape) ──
  if (scrapes.length > 0) {
    scrapes.forEach(function(sc, scIdx) {
      var matched = sc.leads.filter(function(l) { return l.icp_match; });
      var total = sc.leads.length;
      var ago = timeAgo(sc.date);
      var dateStr = new Date(sc.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      var messagedCount = sc.leads.filter(function(l) { return isMessaged(l.linkedin_url); }).length;
      var modeLabel = sc.mode === 'demo' ? ' <span class="scrape-demo-badge">Demo</span>' : '';

      var pipeline = sc.pipeline || {};
      var dmsSent = pipeline.dmsSent || 0;
      var replied = pipeline.replied || 0;
      var signedUp = pipeline.signedUp || 0;

      // Extract a readable post title from URL
      var postTitle = extractPostTitle(sc.url);

      html += '<div class="runner-card">';

      // ── Hero section: two numbers + context ──
      html += '<div class="rc-hero">' +
        '<div class="rc-hero-nums">' +
        '<div class="rc-num-block">' +
        '<div class="rc-big-num">' + total + '</div>' +
        '<div class="rc-big-label">engagers</div>' +
        '</div>' +
        '<div class="rc-num-block rc-num-accent">' +
        '<div class="rc-big-num">' + matched.length + '</div>' +
        '<div class="rc-big-label">ICP matches</div>' +
        '</div>' +
        '</div>' +
        '<div class="rc-hero-right">' +
        '<div class="rc-title">' + postTitle + modeLabel + '</div>' +
        '<div class="rc-meta">Scraped ' + dateStr +
        (messagedCount > 0 ? ' · ' + messagedCount + ' messaged' : '') +
        ' · ' + Math.round((matched.length / Math.max(total, 1)) * 100) + '% ICP</div>' +
        '</div>' +
        '<div class="rc-hero-actions">' +
        '<button class="scrape-csv-btn" onclick="downloadScrapeCSV(' + scIdx + ',false)">All CSV</button>' +
        '<button class="scrape-csv-btn scrape-csv-icp" onclick="downloadScrapeCSV(' + scIdx + ',true)">ICP CSV</button>' +
        '<button class="scrape-remove-btn" onclick="removeScrape(' + sc.id + ')">Remove</button>' +
        '</div></div>';

      // (Message buttons are on each lead row)

      // ── Pipeline: compact horizontal tracker ──
      html += '<div class="rc-pipeline">' +
        '<div class="rc-pipe-stage">' +
        '<span class="rc-pipe-val">' + total + '</span> scraped</div>' +
        '<span class="rc-pipe-arrow">→</span>' +
        '<div class="rc-pipe-stage rc-pipe-highlight">' +
        '<span class="rc-pipe-val">' + matched.length + '</span> ICP</div>' +
        '<span class="rc-pipe-arrow">→</span>' +
        '<div class="rc-pipe-stage">' +
        '<span class="rc-pipe-val">' + dmsSent + '</span> messaged</div>' +
        '<span class="rc-pipe-arrow">→</span>' +
        '<div class="rc-pipe-stage">' +
        '<input type="number" class="rc-pipe-input" value="' + replied + '" min="0" ' +
        'onfocus="this.select()" onchange="updatePipeline(' + sc.id + ',\'replied\',this.value)"> replied</div>' +
        '<span class="rc-pipe-arrow">→</span>' +
        '<div class="rc-pipe-stage">' +
        '<input type="number" class="rc-pipe-input" value="' + signedUp + '" min="0" ' +
        'onfocus="this.select()" onchange="updatePipeline(' + sc.id + ',\'signedUp\',this.value)"> signed up</div>' +
        '</div>';

      // ── Lead list: ICP matches shown directly, others collapsed ──
      // Sort all leads by engagement quality:
      // 1. ICP + commented, 2. Commented (not ICP), 3. ICP + liked, 4. Liked (not ICP)
      var sorted = sc.leads.slice().sort(function(a, b) {
        var scoreA = (a.comment_text ? 2 : 0) + (a.icp_match ? 1 : 0);
        var scoreB = (b.comment_text ? 2 : 0) + (b.icp_match ? 1 : 0);
        return scoreB - scoreA;
      });

      // Show top leads (commenters + ICP likers) directly
      var topLeads = sorted.filter(function(l) { return l.comment_text || l.icp_match; });
      var restLeads = sorted.filter(function(l) { return !l.comment_text && !l.icp_match; });

      // All leads in one list, sorted by quality, folded after first batch
      if (sorted.length > 0) {
        var commentCount = sorted.filter(function(l) { return l.comment_text; }).length;
        var icpCount = matched.length;

        // Split into 4 groups
        var grpBoth = sorted.filter(function(l) { return l.icp_match && l.comment_text; });
        var grpICP = sorted.filter(function(l) { return l.icp_match && !l.comment_text; });
        var grpComment = sorted.filter(function(l) { return !l.icp_match && l.comment_text; });
        var grpOther = sorted.filter(function(l) { return !l.icp_match && !l.comment_text; });

        var filters = getLeadFilters(sc.id);

        html += '<div class="rc-leads">';

        // 4 toggle buttons
        html += '<div class="rc-filter-bar">' +
          '<button class="rc-filter-toggle rc-ft-both ' + (filters.both ? 'active' : '') + '" onclick="toggleLeadFilter(' + sc.id + ',\'both\')">' +
          '<span class="rc-filter-count">' + grpBoth.length + '</span> ICP + Commented</button>' +
          '<button class="rc-filter-toggle rc-ft-icp ' + (filters.icp ? 'active' : '') + '" onclick="toggleLeadFilter(' + sc.id + ',\'icp\')">' +
          '<span class="rc-filter-count">' + grpICP.length + '</span> ICP</button>' +
          '<button class="rc-filter-toggle rc-ft-comment ' + (filters.commented ? 'active' : '') + '" onclick="toggleLeadFilter(' + sc.id + ',\'commented\')">' +
          '<span class="rc-filter-count">' + grpComment.length + '</span> Commented</button>' +
          '<button class="rc-filter-toggle rc-ft-other ' + (filters.other ? 'active' : '') + '" onclick="toggleLeadFilter(' + sc.id + ',\'other\')">' +
          '<span class="rc-filter-count">' + grpOther.length + '</span> Others</button>' +
          '</div>';

        // If no filters active, show best group by default
        var anyActive = filters.both || filters.icp || filters.commented || filters.other;

        function renderGroup(label, leads, showLimit) {
          var h = '<div class="rc-group-label">' + label + ' (' + leads.length + ')</div>';
          leads.slice(0, showLimit).forEach(function(l) { h += renderLeadRow(l); });
          if (leads.length > showLimit) {
            h += '<details class="runner-leads"><summary class="runner-leads-toggle">' +
              (leads.length - showLimit) + ' more ' + label.toLowerCase() + '</summary>';
            leads.slice(showLimit).forEach(function(l) { h += renderLeadRow(l); });
            h += '</details>';
          }
          return h;
        }

        if (!anyActive) {
          if (grpBoth.length > 0) html += renderGroup('ICP + Commented', grpBoth, 15);
          if (grpICP.length > 0) html += renderGroup('ICP Likers', grpICP, 10);
        } else {
          if (filters.both && grpBoth.length > 0) html += renderGroup('ICP + Commented', grpBoth, 15);
          if (filters.icp && grpICP.length > 0) html += renderGroup('ICP Likers', grpICP, 15);
          if (filters.commented && grpComment.length > 0) html += renderGroup('Commenters', grpComment, 15);
          if (filters.other && grpOther.length > 0) html += renderGroup('Other Likers', grpOther, 15);
        }
        html += '</div>';
      }

      // (all leads shown in the sorted list above)

      html += '</div>';
    });
  } else {
    html += '<div class="scrape-empty-state">' +
      '<div class="scrape-empty-icon">↑</div>' +
      'Paste a LinkedIn post URL above to find leads who engage with content in your space</div>';
  }

  el.innerHTML = html;
}

function extractPostTitle(url) {
  // Turn linkedin.com/posts/rmeadows_most-gtm-playbooks... into "most gtm playbooks..."
  var match = url.match(/posts\/[^_]+_([^-]+(?:-[^-]+){0,6})/);
  if (match) {
    return match[1].replace(/-/g, ' ').replace(/activity.*/, '').trim();
  }
  // Fallback: show truncated URL
  return truncateUrl(url);
}

/* --- Pipeline rendering helpers --- */

function renderPipeStage(label, val, onchange, editable) {
  if (editable) {
    return '<div class="runner-stage">' +
      '<input type="number" class="runner-stage-val" value="' + val + '" min="0" ' +
      'onfocus="this.select()" onchange="' + onchange + '">' +
      '<div class="runner-stage-label">' + label + '</div></div>';
  }
  return '<div class="runner-stage">' +
    '<div class="runner-stage-val runner-stage-auto">' + val + '</div>' +
    '<div class="runner-stage-label">' + label + '</div></div>';
}

function renderPipeArrow(from, to) {
  var conv = from > 0 ? ((to / from) * 100) : 0;
  var text = from > 0 ? conv.toFixed(0) + '%' : '—';
  var cls = conv >= 50 ? 'pipe-conv-good' : conv >= 20 ? 'pipe-conv-ok' : 'pipe-conv-low';
  return '<div class="runner-arrow ' + cls + '">' + text + '</div>';
}

/* --- Message tracking --- */
var MSG_KEY = 'gtm_messaged_v1';

function loadMessaged() {
  var s = localStorage.getItem(MSG_KEY);
  return s ? JSON.parse(s) : {};
}

function saveMessaged(d) {
  localStorage.setItem(MSG_KEY, JSON.stringify(d));
}

function markMessaged(profileUrl) {
  var d = loadMessaged();
  d[profileUrl] = new Date().toISOString();
  saveMessaged(d);
  // Auto-update pipeline DMs Sent count
  autoUpdatePipelineCounts();
  render();
}

function autoUpdatePipelineCounts() {
  var messaged = loadMessaged();
  var scrapes = loadScrapes();
  scrapes.forEach(function(sc) {
    var count = sc.leads.filter(function(l) { return messaged[l.linkedin_url]; }).length;
    if (!sc.pipeline) sc.pipeline = {};
    sc.pipeline.dmsSent = count;
  });
  saveScrapes(scrapes);
}

function unmarkMessaged(profileUrl) {
  var d = loadMessaged();
  delete d[profileUrl];
  saveMessaged(d);
  autoUpdatePipelineCounts();
  render();
}

function isMessaged(profileUrl) {
  return !!loadMessaged()[profileUrl];
}

/* --- Influencer Watch List --- */
var WATCH_KEY = 'hawki_watchlist_v1';

function loadWatchList() {
  var s = localStorage.getItem(WATCH_KEY);
  return s ? JSON.parse(s) : [];
}

function saveWatchList(d) {
  localStorage.setItem(WATCH_KEY, JSON.stringify(d));
}

function addToWatchList() {
  var input = document.getElementById('watch-input');
  var url = input.value.trim();
  if (!url || url.indexOf('linkedin.com/in/') < 0) {
    showToast('Paste a LinkedIn profile URL');
    return;
  }

  // Extract username from URL
  var match = url.match(/linkedin\.com\/in\/([^/?]+)/);
  var username = match ? match[1] : '';
  if (!username) return;

  var list = loadWatchList();
  if (list.some(function(w) { return w.username === username; })) {
    showToast('Already watching');
    return;
  }

  // Fetch their profile info
  var apiUrl = getApiUrl();
  var xhr = new XMLHttpRequest();
  xhr.open('POST', apiUrl + '/api/profile-info');
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.timeout = 15000;

  xhr.onload = function() {
    var name = username.replace(/-/g, ' ');
    var headline = '';
    if (xhr.status === 200) {
      var result = JSON.parse(xhr.responseText);
      name = result.name || name;
      headline = result.headline || '';
    }

    var entry = {
      username: username,
      name: name,
      headline: headline,
      oneliner: '',
      url: 'https://www.linkedin.com/in/' + username,
      added: new Date().toISOString(),
    };
    list.unshift(entry);
    saveWatchList(list);
    input.value = '';
    showToast('#' + list.length + ' ' + name + ' added');
    render();

    // Generate one-liner with AI in background
    if (headline) {
      var apiUrl = getApiUrl();
      var xhr2 = new XMLHttpRequest();
      xhr2.open('POST', apiUrl + '/api/draft-message');
      xhr2.setRequestHeader('Content-Type', 'application/json');
      xhr2.timeout = 10000;
      xhr2.onload = function() {
        if (xhr2.status === 200) {
          var result = JSON.parse(xhr2.responseText);
          var updated = loadWatchList();
          var found = updated.find(function(w) { return w.username === username; });
          if (found) {
            found.oneliner = result.message;
            saveWatchList(updated);
            render();
          }
        }
      };
      xhr2.send(JSON.stringify({
        name: name,
        headline: headline,
        comment: '',
        post_title: '',
        instruction: 'Write a 5-8 word description of who this person is based on their headline. No quotes, no greeting, just a brief label. Examples: "GTM thought leader, ex-HubSpot CRO", "Enterprise sales leader at Dynatrace", "AI startup founder and investor". Output only the description.',
        current_draft: headline,
      }));
    }
  };

  xhr.onerror = function() {
    list.unshift({
      username: username,
      name: username.replace(/-/g, ' '),
      headline: '',
      oneliner: '',
      url: 'https://www.linkedin.com/in/' + username,
      added: new Date().toISOString(),
    });
    saveWatchList(list);
    input.value = '';
    render();
  };

  xhr.send(JSON.stringify({ username: username }));
}

function checkAllInfluencers() {
  var list = loadWatchList();
  list.forEach(function(w, i) {
    setTimeout(function() {
      window.open(w.url + '/recent-activity/all/', '_blank');
    }, i * 600);
  });
  showToast('Opening ' + list.length + ' profiles...');
}

function removeFromWatchList(username) {
  var list = loadWatchList().filter(function(w) { return w.username !== username; });
  saveWatchList(list);
  render();
}

/* --- Lead filters (per scrape) --- */
var leadFilters = {};

function getLeadFilters(scrapeId) {
  return leadFilters[scrapeId] || { both: false, icp: false, commented: false, other: false };
}

function toggleLeadFilter(scrapeId, type) {
  if (!leadFilters[scrapeId]) leadFilters[scrapeId] = { both: false, icp: false, commented: false, other: false };
  leadFilters[scrapeId][type] = !leadFilters[scrapeId][type];
  render();
}

function renderLeadRow(l) {
  var profileUrl = l.linkedin_url || '';
  var messaged = isMessaged(profileUrl);
  var badges = '';
  if (l.icp_match) badges += '<span class="rc-lead-badge">ICP</span>';
  if (l.comment_text) badges += '<span class="rc-lead-badge rc-lead-badge-comment">commented</span>';
  if (messaged) badges += '<span class="rc-lead-badge rc-lead-badge-sent">sent</span>';
  var comment = l.comment_text ? '<div class="rc-lead-comment">"' + l.comment_text.substring(0, 150) + (l.comment_text.length > 150 ? '...' : '') + '"</div>' : '';
  var dimClass = (!l.icp_match && !l.comment_text) ? ' rc-lead-dim' : '';
  var sentClass = messaged ? ' rc-lead-sent' : '';

  var firstName = l.name.split(' ')[0];
  var postTitle = extractPostTitle(l.scraped_from || '');

  var btn = '';
  if (messaged) {
    btn = '<button class="runner-undo-btn" onclick="event.stopPropagation();unmarkMessaged(\'' + profileUrl.replace(/'/g, "\\'") + '\')">Undo</button>';
  } else {
    btn = '<button class="runner-msg-btn" onclick="event.stopPropagation();messageAndTrack(\'' + profileUrl.replace(/'/g, "\\'") + '\',\'' + firstName.replace(/'/g, "\\'") + '\',\'' + (l.comment_text || '').substring(0, 80).replace(/'/g, "\\'").replace(/\n/g, ' ') + '\',\'' + postTitle.replace(/'/g, "\\'") + '\')">Draft DM</button>';
  }

  return '<div class="rc-lead' + dimClass + sentClass + '">' +
    '<div class="rc-lead-info">' +
    '<a href="' + profileUrl + '" target="_blank" rel="noopener" class="rc-lead-name">' + l.name + ' ' + badges + '</a>' +
    '<div class="rc-lead-title">' + (l.title || 'No headline') + '</div>' +
    comment +
    '</div>' +
    btn +
    '</div>';
}

function messageAndTrack(profileUrl, firstName, commentText, postTitle) {
  // Get the full lead data
  var scrapes = loadScrapes();
  var lead = null;
  scrapes.forEach(function(sc) {
    sc.leads.forEach(function(l) {
      if (l.linkedin_url === profileUrl) lead = l;
    });
  });

  var apiKey = localStorage.getItem('hawki_claude_key') || '';

  // Show draft modal
  showDraftModal(profileUrl, lead, commentText, postTitle, apiKey);
}

function showDraftModal(profileUrl, lead, commentText, postTitle, apiKey) {
  var firstName = lead ? lead.name.split(' ')[0] : '';
  var fullName = lead ? lead.name : firstName;
  var headline = lead ? lead.title : '';

  qaOpen = true;
  document.getElementById('modal').classList.add('open');
  document.querySelector('.chat').innerHTML =
    '<div class="qa-panel"><div class="qa-header">' +
    '<h2 class="qa-title">Message ' + fullName + '</h2>' +
    '<button class="chat-close" onclick="closeModal()">&times;</button></div>' +
    '<div class="qa-body">' +
    '<div class="draft-lead-info">' +
    '<div class="draft-lead-name">' + fullName + '</div>' +
    '<div class="draft-lead-headline">' + (headline || '') + '</div>' +
    (commentText ? '<div class="draft-lead-comment">"' + commentText + '"</div>' : '') +
    '</div>' +
    '<div class="qa-field">' +
    '<textarea class="qa-input draft-textarea" id="draft-message" rows="5" placeholder="Drafting...">' +
    templateDraft(firstName, commentText, postTitle) + '</textarea>' +
    '</div>' +
    '<div class="draft-actions">' +
    '<input type="text" class="draft-instruct-input" id="draft-instruction" ' +
    'placeholder="e.g. make it shorter, mention their company, more casual..." ' +
    'onkeydown="if(event.key===\'Enter\')regenerateDraft(\'' + profileUrl.replace(/'/g, "\\'") + '\',\'' + fullName.replace(/'/g, "\\'") + '\',\'' + (headline || '').replace(/'/g, "\\'").replace(/\n/g, ' ') + '\',\'' + (commentText || '').substring(0, 100).replace(/'/g, "\\'").replace(/\n/g, ' ') + '\',\'' + postTitle.replace(/'/g, "\\'") + '\')">' +
    '<button class="draft-ai-btn" id="draft-ai-btn" onclick="regenerateDraft(\'' + profileUrl.replace(/'/g, "\\'") + '\',\'' + fullName.replace(/'/g, "\\'") + '\',\'' + (headline || '').replace(/'/g, "\\'").replace(/\n/g, ' ') + '\',\'' + (commentText || '').substring(0, 100).replace(/'/g, "\\'").replace(/\n/g, ' ') + '\',\'' + postTitle.replace(/'/g, "\\'") + '\')">Rewrite</button>' +
    '</div>' +
    '</div>' +
    '<div class="qa-footer">' +
    '<button class="qa-cancel" onclick="closeModal()">Cancel</button>' +
    '<button class="qa-submit" onclick="sendDraft(\'' + profileUrl.replace(/'/g, "\\'") + '\')">Copy & Open Profile</button>' +
    '</div></div>';

  // Auto-draft with AI if server is available
  regenerateDraft(profileUrl, fullName, headline || '', (commentText || '').substring(0, 100), postTitle);
}

function regenerateDraft(profileUrl, name, headline, comment, postTitle) {
  var btn = document.getElementById('draft-ai-btn');
  var textarea = document.getElementById('draft-message');
  if (!btn || !textarea) return;

  btn.textContent = 'Drafting...';
  btn.disabled = true;

  var apiKey = localStorage.getItem('hawki_claude_key') || '';
  var apiUrl = getApiUrl();
  var xhr = new XMLHttpRequest();
  xhr.open('POST', apiUrl + '/api/draft-message');
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.timeout = 15000;

  xhr.onload = function() {
    btn.textContent = 'Rewrite with AI';
    btn.disabled = false;
    if (xhr.status === 200) {
      try {
        var result = JSON.parse(xhr.responseText);
        if (result.message) textarea.value = result.message;
      } catch (e) {}
    } else {
      try {
        var err = JSON.parse(xhr.responseText);
        showToast(err.error || 'AI drafting failed');
      } catch (e) {
        showToast('AI drafting failed — check API key in Settings');
      }
    }
  };

  xhr.onerror = function() {
    btn.textContent = 'Rewrite with AI';
    btn.disabled = false;
    showToast('AI drafting unavailable — using template');
  };

  xhr.ontimeout = function() {
    btn.textContent = 'Rewrite with AI';
    btn.disabled = false;
    showToast('AI draft timed out — using template');
  };

  var instruction = '';
  var instrEl = document.getElementById('draft-instruction');
  if (instrEl) instruction = instrEl.value.trim();

  var currentDraft = textarea ? textarea.value : '';

  xhr.send(JSON.stringify({
    api_key: apiKey,
    name: name,
    headline: headline,
    comment: comment,
    post_title: postTitle,
    instruction: instruction,
    current_draft: instruction ? currentDraft : '',
  }));
}

function sendDraft(profileUrl) {
  var textarea = document.getElementById('draft-message');
  var msg = textarea ? textarea.value : '';

  navigator.clipboard.writeText(msg).then(function() {
    showToast('Message copied — paste it in LinkedIn');
  }).catch(function() {
    prompt('Copy this message:', msg);
  });

  markMessaged(profileUrl);
  window.open(profileUrl, '_blank');
  closeModal();
}

function templateDraft(firstName, commentText, postTitle) {
  if (commentText) {
    return 'Hi ' + firstName + ', saw your comment on the "' + postTitle + '" post — "' + commentText.substring(0, 80) + '". Would love to connect and chat about this.';
  }
  return 'Hi ' + firstName + ', noticed you engaged with the "' + postTitle + '" post. Thought we might have a lot to share around this topic — would love to connect.';
}

function renderWorkflowGuide(icpCount, dmsSent, replied, signedUp, scIdx) {
  // Show the right next step based on pipeline state
  if (icpCount === 0) {
    return '<div class="runner-guide">' +
      '<div class="runner-guide-step">No ICP matches. Try adjusting your ICP keywords above.</div></div>';
  }

  if (dmsSent === 0) {
    return '<div class="runner-guide">' +
      '<div class="runner-guide-step">' +
      '<span class="runner-guide-num">1</span>' +
      '<div class="runner-guide-text">' +
      '<strong>Open ICP profiles & message them</strong>' +
      '<div class="runner-guide-detail">Expand the leads below → click "Open top ICP profiles" → each profile opens in a new tab → send a personal message referencing the post they engaged with</div>' +
      '</div></div>' +
      '<div class="runner-guide-step">' +
      '<span class="runner-guide-num">2</span>' +
      '<div class="runner-guide-text">' +
      '<strong>Update DMs Sent</strong>' +
      '<div class="runner-guide-detail">After messaging, update the "DMs Sent" number above to track your pipeline</div>' +
      '</div></div></div>';
  }

  if (replied === 0) {
    return '<div class="runner-guide">' +
      '<div class="runner-guide-step">' +
      '<span class="runner-guide-num">→</span>' +
      '<div class="runner-guide-text">' +
      '<strong>Waiting for replies</strong>' +
      '<div class="runner-guide-detail">' + dmsSent + ' DMs sent. Check Dripify for reply count and update the "Replied" number above.</div>' +
      '</div></div></div>';
  }

  if (signedUp === 0) {
    return '<div class="runner-guide">' +
      '<div class="runner-guide-step">' +
      '<span class="runner-guide-num">→</span>' +
      '<div class="runner-guide-text">' +
      '<strong>' + replied + ' replies — convert them</strong>' +
      '<div class="runner-guide-detail">Reply personally to warm leads. Track signups in your CRM and update "Signed Up" above.</div>' +
      '</div></div></div>';
  }

  // Pipeline complete
  var convRate = dmsSent > 0 ? ((signedUp / dmsSent) * 100).toFixed(1) : '0';
  return '<div class="runner-guide runner-guide-done">' +
    '<div class="runner-guide-step">' +
    '<span class="runner-guide-num">✓</span>' +
    '<div class="runner-guide-text">' +
    '<strong>' + signedUp + ' signup' + (signedUp !== 1 ? 's' : '') + ' from this batch</strong>' +
    '<div class="runner-guide-detail">' + convRate + '% conversion from DM to signup. Scrape another post to keep the pipeline fed.</div>' +
    '</div></div></div>';
}

function openICPProfiles(scIdx) {
  var scrapes = loadScrapes();
  if (!scrapes[scIdx]) return;
  var matched = scrapes[scIdx].leads.filter(function(l) { return l.icp_match && l.linkedin_url; });
  var toOpen = matched.slice(0, 10);
  toOpen.forEach(function(l, i) {
    setTimeout(function() {
      window.open(l.linkedin_url, '_blank');
    }, i * 800); // Stagger by 800ms to avoid popup blocker
  });
  showToast('Opening ' + toOpen.length + ' profiles...');
}

function updatePipeline(scrapeId, field, val) {
  var scrapes = loadScrapes();
  var sc = scrapes.find(function(s) { return s.id === scrapeId; });
  if (!sc) return;
  if (!sc.pipeline) sc.pipeline = {};
  sc.pipeline[field] = parseInt(val) || 0;
  saveScrapes(scrapes);
  flash();
}

/* --- Actions --- */

function downloadScrapeCSV(idx, icpOnly) {
  var scrapes = loadScrapes();
  if (!scrapes[idx]) return;
  var leads = scrapes[idx].leads;
  if (icpOnly) {
    leads = leads.filter(function(l) { return l.icp_match; });
  }
  downloadCSV(leads, icpOnly ? 'icp-leads.csv' : 'scraped-leads.csv');
}

/* --- Find posts --- */
var foundPosts = [];

function getFoundPosts() { return foundPosts; }

function clearFoundPosts() { foundPosts = []; render(); }

function findPosts() {
  var input = document.getElementById('find-keywords');
  var keywords = input.value.trim();
  if (!keywords) return;

  var btn = document.getElementById('find-go');
  btn.textContent = 'Searching...';
  btn.disabled = true;

  var apiUrl = getApiUrl();
  var xhr = new XMLHttpRequest();
  xhr.open('POST', apiUrl + '/api/find-posts');
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.timeout = 20000;

  xhr.onload = function() {
    btn.textContent = 'Find Posts';
    btn.disabled = false;
    if (xhr.status === 200) {
      var result = JSON.parse(xhr.responseText);
      foundPosts = result.posts || [];
      showToast(foundPosts.length + ' posts found');
      render();
    } else {
      showToast('Search failed');
    }
  };

  xhr.onerror = function() {
    btn.textContent = 'Find Posts';
    btn.disabled = false;
    showToast('Server not running');
  };

  xhr.ontimeout = function() {
    btn.textContent = 'Find Posts';
    btn.disabled = false;
    showToast('Search timed out');
  };

  var timeframe = document.getElementById('find-timeframe').value;
  xhr.send(JSON.stringify({ keywords: keywords, timeframe: timeframe }));
}

function scrapeFoundPost(url) {
  document.getElementById('scrape-url').value = url;
  startScrape();
}

function startScrape() {
  var input = document.getElementById('scrape-url');
  var url = input.value.trim();
  if (!url) return;

  if (url.indexOf('linkedin.com') < 0) {
    showToast('Please paste a LinkedIn URL');
    return;
  }

  var btn = document.getElementById('scrape-go');
  btn.textContent = 'Scraping...';
  btn.disabled = true;
  btn.style.opacity = '0.5';

  runScrape(url, function(err, scrape) {
    btn.textContent = 'Scrape';
    btn.disabled = false;
    btn.style.opacity = '1';

    if (err) {
      showToast(err);
    } else {
      input.value = '';
      var matched = scrape.leads.filter(function(l) { return l.icp_match; });
      showToast(scrape.leads.length + ' engagers found · ' + matched.length + ' ICP matches');
    }
    render();
  });
}

function showCookieExpired() {
  qaOpen = true;
  document.getElementById('modal').classList.add('open');
  document.querySelector('.chat').innerHTML =
    '<div class="qa-panel"><div class="qa-header"><h2 class="qa-title">Session expired</h2>' +
    '<button class="chat-close" onclick="closeModal()">&times;</button></div>' +
    '<div class="qa-body">' +
    '<div style="font-size:var(--fs-sm);color:var(--text-2);margin-bottom:var(--s-16);line-height:1.6">' +
    'LinkedIn sessions refresh every ~30 minutes. Quick reconnect:' +
    '<br><br>' +
    '<a href="https://www.linkedin.com" target="_blank" style="color:var(--inbound);font-weight:600">Open LinkedIn</a> → ' +
    '<kbd>Cmd+Option+I</kbd> → <strong>Application</strong> → <strong>Cookies</strong> → <strong>li_at</strong> → copy value' +
    '</div>' +
    '<div style="display:flex;gap:var(--s-8)">' +
    '<input type="password" class="qa-input qa-input-sm" id="refresh-cookie" placeholder="Paste li_at cookie..." style="flex:1" ' +
    'onkeydown="if(event.key===\'Enter\')refreshCookie()">' +
    '<button class="qa-submit" onclick="refreshCookie()" style="flex-shrink:0">Reconnect</button>' +
    '</div>' +
    '</div></div>';
}

function refreshCookie() {
  var cookie = document.getElementById('refresh-cookie').value.trim();
  if (!cookie) { showToast('Paste your li_at cookie'); return; }
  localStorage.setItem('hawki_li_at', cookie);
  localStorage.setItem('hawki_conn_state', 'unknown');
  closeModal();
  showToast('Reconnected! Checking...');
  checkCookieStatus();
}

function removeScrape(id) {
  var scrapes = loadScrapes().filter(function(s) { return s.id !== id; });
  saveScrapes(scrapes);
  render();
}

function toggleSettings() {
  var el = document.getElementById('hawki-settings');
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function saveClaudeKey() {
  var key = document.getElementById('hawki-api-key').value.trim();
  if (key) {
    localStorage.setItem('hawki_claude_key', key);
    showToast('API key saved — AI drafts enabled');
  } else {
    localStorage.removeItem('hawki_claude_key');
    showToast('API key removed — using templates');
  }
  render();
}

function checkCookieStatus() {
  var liAt = localStorage.getItem('hawki_li_at');
  if (!liAt) { showToast('No cookie set'); return; }

  localStorage.setItem('hawki_conn_state', 'unknown');
  render();

  var apiUrl = getApiUrl();
  var xhr = new XMLHttpRequest();
  xhr.open('POST', apiUrl + '/api/get-cookie');
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.timeout = 10000;

  xhr.onload = function() {
    if (xhr.status === 200) {
      var result = JSON.parse(xhr.responseText);
      if (result.valid) {
        localStorage.setItem('hawki_conn_state', 'valid');
      } else {
        localStorage.setItem('hawki_conn_state', 'expired');
      }
    } else {
      localStorage.setItem('hawki_conn_state', 'expired');
    }
    render();
  };

  xhr.onerror = function() {
    localStorage.setItem('hawki_conn_state', 'expired');
    render();
  };

  xhr.send(JSON.stringify({ li_at: liAt }));
}

// (Cookie auto-check removed — Apify handles scraping without cookies)

function saveOnboardCookie() {
  var cookie = document.getElementById('onboard-cookie').value.trim();
  if (!cookie) { showToast('Paste your li_at cookie'); return; }
  localStorage.setItem('hawki_li_at', cookie);
  // Show use case picker
  showUseCasePicker();
}

function showUseCasePicker() {
  var el = document.getElementById('view-scrape');
  el.innerHTML = '<div class="onboard">' +
    '<div class="onboard-title">Welcome to Hawki</div>' +
    '<div class="onboard-desc">Who are you looking for? Enter the job titles you want to find.</div>' +

    '<div class="onboard-steps" style="border:none;padding:0">' +
    '<div class="scrape-icp-field" style="margin-bottom:var(--s-16)">' +
    '<label class="scrape-icp-label" style="font-weight:600;color:var(--text)">Target titles</label>' +
    '<input type="text" class="qa-input qa-input-sm" id="setup-titles" ' +
    'value="AE, Account Executive, SDR, Sales Development, BDR, Sales Rep, Sales Manager, Head of Sales, VP Sales, Sales Director, Revenue, GTM, Growth, Founder, CEO, CRO" ' +
    'placeholder="e.g. Account Executive, VP Sales, Founder...">' +
    '<div style="font-size:11px;color:var(--text-4);margin-top:4px">Comma-separated. People with these words in their headline will be highlighted.</div>' +
    '</div>' +
    '<div class="scrape-icp-field" style="margin-bottom:var(--s-16)">' +
    '<label class="scrape-icp-label" style="font-weight:600;color:var(--text)">Exclude titles (optional)</label>' +
    '<input type="text" class="qa-input qa-input-sm" id="setup-exclude" value="Student, Intern" ' +
    'placeholder="e.g. Student, Intern, Recruiter...">' +
    '</div>' +
    '</div>' +

    '<div class="onboard-input">' +
    '<button class="scrape-go-btn" onclick="saveSetup()" style="width:100%">Start finding leads</button>' +
    '</div>' +
    '</div>';
}

var USE_CASE_KEYWORDS = {
  sales: {
    titles: ['AE', 'Account Executive', 'SDR', 'Sales Development', 'BDR', 'Business Development', 'Sales Rep', 'Sales Manager', 'Head of Sales', 'VP Sales', 'VP of Sales', 'Sales Leader', 'Sales Director', 'Revenue', 'GTM', 'Growth'],
    exclude: ['Recruiter', 'Student', 'Intern']
  },
  recruiting: {
    titles: ['Software Engineer', 'Frontend', 'Backend', 'Full Stack', 'Designer', 'Product Designer', 'UX', 'Data Scientist', 'Machine Learning', 'DevOps', 'Engineering Manager'],
    exclude: ['Recruiter', 'Student', 'Intern']
  },
  jobs: {
    titles: ['Hiring Manager', 'Recruiter', 'Talent', 'Head of', 'VP', 'Director', 'Founder', 'Co-founder', 'CEO', 'CTO', 'COO', 'HR', 'People'],
    exclude: ['Student', 'Intern']
  },
  networking: {
    titles: ['Founder', 'CEO', 'CTO', 'VP', 'Director', 'Head of', 'Lead', 'Manager', 'Senior', 'Principal'],
    exclude: ['Student', 'Intern']
  }
};

function saveSetup() {
  var titles = document.getElementById('setup-titles').value.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
  if (titles.length === 0) { showToast('Enter at least one title'); return; }
  var exclude = document.getElementById('setup-exclude').value.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
  saveICP({ titles: titles, exclude: exclude });
  showToast('Ready! Paste a LinkedIn post URL to start.');
  render();
}

function applyUseCase(type) {
  var icp = USE_CASE_KEYWORDS[type];
  showICPReview(icp, type);
}

function applyCustomICP() {
  var input = document.getElementById('custom-icp').value.trim();
  if (!input) { showToast('Enter some keywords'); return; }
  var titles = input.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
  showICPReview({ titles: titles, exclude: ['Student', 'Intern'] }, 'custom');
}

function showICPReview(icp, type) {
  var el = document.getElementById('view-scrape');
  var labels = { sales: 'B2B Sales', recruiting: 'Recruiting', jobs: 'Job Hunting', networking: 'Networking', custom: 'Custom' };

  el.innerHTML = '<div class="onboard">' +
    '<div class="onboard-title">Your ICP filter</div>' +
    '<div class="onboard-desc">People with these words in their headline will be highlighted as matches. Edit if needed.</div>' +

    '<div class="onboard-steps" style="border:none;padding:0">' +
    '<div class="scrape-icp-field" style="margin-bottom:var(--s-16)">' +
    '<label class="scrape-icp-label" style="font-weight:600;color:var(--text)">Target titles</label>' +
    '<input type="text" class="qa-input qa-input-sm" id="review-titles" value="' + icp.titles.join(', ') + '">' +
    '</div>' +
    '<div class="scrape-icp-field" style="margin-bottom:var(--s-16)">' +
    '<label class="scrape-icp-label" style="font-weight:600;color:var(--text)">Exclude titles</label>' +
    '<input type="text" class="qa-input qa-input-sm" id="review-exclude" value="' + icp.exclude.join(', ') + '">' +
    '</div>' +
    '</div>' +

    '<div class="onboard-input">' +
    '<button class="scrape-go-btn" onclick="confirmICP()" style="width:100%">Start finding leads</button>' +
    '</div>' +
    '</div>';
}

function confirmICP() {
  var titles = document.getElementById('review-titles').value.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
  var exclude = document.getElementById('review-exclude').value.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
  saveICP({ titles: titles, exclude: exclude });
  showToast('Ready! Paste a LinkedIn post URL to start.');
  render();
}

function toggleICPConfig() {
  var el = document.getElementById('icp-config');
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function saveICPFromInput() {
  var titlesEl = document.getElementById('icp-titles');
  var excludeEl = document.getElementById('icp-exclude');
  var icp = {
    titles: titlesEl.value.split(',').map(function(s) { return s.trim(); }).filter(Boolean),
    exclude: excludeEl.value.split(',').map(function(s) { return s.trim(); }).filter(Boolean)
  };
  saveICP(icp);

  // Re-apply ICP to all stored scrapes
  var scrapes = loadScrapes();
  scrapes.forEach(function(sc) {
    sc.leads.forEach(function(l) {
      l.icp_match = matchesICP(l.title);
    });
  });
  saveScrapes(scrapes);
  showToast('ICP filter updated');
}

/* --- Helpers --- */
function truncateUrl(url) {
  if (url.length > 80) return url.substring(0, 77) + '...';
  return url;
}

function timeAgo(dateStr) {
  var now = Date.now();
  var then = new Date(dateStr).getTime();
  var mins = Math.round((now - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  var hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  var days = Math.round(hrs / 24);
  return days + 'd ago';
}
