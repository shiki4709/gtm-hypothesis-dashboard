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
  titles: ['AE', 'Account Executive', 'SDR', 'Sales Development', 'BDR', 'Business Development', 'Sales Rep', 'Sales Manager', 'Head of Sales', 'VP Sales', 'VP of Sales', 'Sales Leader', 'Sales Director', 'Revenue', 'GTM', 'Growth'],
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
  // If served from localhost (Flask server), use same origin
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return '';
  }
  // Otherwise try localhost:5001 (server running separately)
  return 'http://localhost:5001';
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
        var leads = result.leads.map(function(l) {
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
        callback(null, scrape);
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
    // Server not running — fall back to demo mode
    runDemoScrape(postUrl, callback);
  };

  xhr.ontimeout = function() {
    callback('Scrape timed out. The post may have too many engagers.');
  };

  xhr.send(JSON.stringify({ url: postUrl }));
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
  var scrapes = loadScrapes();
  var icp = loadICP();

  var html = '';

  // ── Scrape input ──
  html += '<div class="scrape-input-section">' +
    '<div class="scrape-input-row">' +
    '<input type="text" class="scrape-url-input" id="scrape-url" ' +
    'placeholder="Paste a LinkedIn post URL..." ' +
    'onkeydown="if(event.key===\'Enter\')startScrape()">' +
    '<button class="scrape-go-btn" id="scrape-go" onclick="startScrape()">Scrape</button>' +
    '</div>' +
    '<div class="scrape-hint">' +
    '<span onclick="toggleICPConfig()" style="cursor:pointer;text-decoration:underline dotted;color:var(--text-3)">ICP: ' +
    icp.titles.slice(0, 4).join(', ') + (icp.titles.length > 4 ? '...' : '') + '</span></div>' +
    '</div>';

  // ICP config (hidden by default)
  html += '<div class="scrape-icp-body" id="icp-config" style="display:none;margin-bottom:var(--s-24)">' +
    '<div class="scrape-icp-field">' +
    '<label class="scrape-icp-label">Match titles containing:</label>' +
    '<input type="text" class="qa-input qa-input-sm" id="icp-titles" value="' + icp.titles.join(', ') + '" ' +
    'placeholder="AE, SDR, VP Sales..." onchange="saveICPFromInput()">' +
    '</div>' +
    '<div class="scrape-icp-field">' +
    '<label class="scrape-icp-label">Exclude titles containing:</label>' +
    '<input type="text" class="qa-input qa-input-sm" id="icp-exclude" value="' + icp.exclude.join(', ') + '" ' +
    'placeholder="Recruiter, Student..." onchange="saveICPFromInput()">' +
    '</div></div>';

  // ── Pipeline cards (one per scrape) ──
  if (scrapes.length > 0) {
    scrapes.forEach(function(sc, scIdx) {
      var matched = sc.leads.filter(function(l) { return l.icp_match; });
      var total = sc.leads.length;
      var ago = timeAgo(sc.date);
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
        '<div class="rc-meta">' + ago + ' · ' +
        Math.round((matched.length / Math.max(total, 1)) * 100) + '% match rate</div>' +
        '</div>' +
        '<div class="rc-hero-actions">' +
        '<button class="scrape-csv-btn" onclick="downloadScrapeCSV(' + scIdx + ',false)">All CSV</button>' +
        '<button class="scrape-csv-btn scrape-csv-icp" onclick="downloadScrapeCSV(' + scIdx + ',true)">ICP CSV</button>' +
        '<button class="scrape-remove-btn" onclick="removeScrape(' + sc.id + ')">Remove</button>' +
        '</div></div>';

      // ── Action bar: primary CTA ──
      if (matched.length > 0 && dmsSent === 0) {
        html += '<div class="rc-action">' +
          '<button class="runner-open-btn" onclick="openICPProfiles(' + scIdx + ')">Open top ' +
          Math.min(matched.length, 10) + ' profiles to message</button>' +
          '</div>';
      }

      // ── Pipeline: compact horizontal tracker ──
      html += '<div class="rc-pipeline">' +
        '<div class="rc-pipe-stage">' +
        '<span class="rc-pipe-val">' + total + '</span> scraped</div>' +
        '<span class="rc-pipe-arrow">→</span>' +
        '<div class="rc-pipe-stage rc-pipe-highlight">' +
        '<span class="rc-pipe-val">' + matched.length + '</span> ICP</div>' +
        '<span class="rc-pipe-arrow">→</span>' +
        '<div class="rc-pipe-stage">' +
        '<input type="number" class="rc-pipe-input" value="' + dmsSent + '" min="0" ' +
        'onfocus="this.select()" onchange="updatePipeline(' + sc.id + ',\'dmsSent\',this.value)"> messaged</div>' +
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
        // Count for summary
        var commentCount = sorted.filter(function(l) { return l.comment_text; }).length;
        var icpCount = matched.length;

        html += '<div class="rc-leads">';
        html += '<div class="rc-leads-title">' + sorted.length + ' engagers · ' + commentCount + ' commented · ' + icpCount + ' ICP</div>';

        // Show first 15, fold the rest
        var showLimit = 15;
        sorted.slice(0, showLimit).forEach(function(l) {
          html += renderLeadRow(l);
        });

        if (sorted.length > showLimit) {
          html += '<details class="runner-leads"><summary class="runner-leads-toggle">' +
            (sorted.length - showLimit) + ' more</summary>';
          sorted.slice(showLimit).forEach(function(l) {
            html += renderLeadRow(l);
          });
          html += '</details>';
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

function renderLeadRow(l) {
  var profileUrl = l.linkedin_url || '';
  var badges = '';
  if (l.icp_match) badges += '<span class="rc-lead-badge">ICP</span>';
  if (l.comment_text) badges += '<span class="rc-lead-badge rc-lead-badge-comment">commented</span>';
  var comment = l.comment_text ? '<div class="rc-lead-comment">"' + l.comment_text.substring(0, 150) + (l.comment_text.length > 150 ? '...' : '') + '"</div>' : '';
  var dimClass = (!l.icp_match && !l.comment_text) ? ' rc-lead-dim' : '';
  return '<div class="rc-lead' + dimClass + '">' +
    '<div class="rc-lead-info">' +
    '<a href="' + profileUrl + '" target="_blank" rel="noopener" class="rc-lead-name">' + l.name + ' ' + badges + '</a>' +
    '<div class="rc-lead-title">' + (l.title || 'No headline') + '</div>' +
    comment +
    '</div>' +
    '<a href="' + profileUrl + '" target="_blank" rel="noopener" class="runner-msg-btn">Message</a>' +
    '</div>';
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

function startScrape() {
  var input = document.getElementById('scrape-url');
  var url = input.value.trim();
  if (!url) return;

  // Basic LinkedIn URL validation
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
    input.value = '';

    if (err) {
      showToast(err);
    } else {
      var matched = scrape.leads.filter(function(l) { return l.icp_match; });
      showToast(scrape.leads.length + ' engagers found · ' + matched.length + ' ICP matches');
    }
    render();
  });
}

function removeScrape(id) {
  var scrapes = loadScrapes().filter(function(s) { return s.id !== id; });
  saveScrapes(scrapes);
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
