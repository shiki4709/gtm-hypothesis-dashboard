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
  titles: ['AE', 'Account Executive', 'SDR', 'BDR', 'Sales Rep', 'Sales Manager', 'Head of Sales', 'VP Sales', 'Revenue', 'GTM', 'Growth'],
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
function runScrape(postUrl, callback) {
  var phantomKey = localStorage.getItem('gtm_phantom_key') || '';

  if (phantomKey) {
    // Real PhantomBuster API call
    scrapeWithPhantom(postUrl, phantomKey, callback);
  } else {
    // Demo mode with realistic delay
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
}

/* --- PhantomBuster integration (ready when API key is configured) --- */
function scrapeWithPhantom(postUrl, apiKey, callback) {
  // PhantomBuster API: launch a phantom and poll for results
  // This requires a "LinkedIn Post Commenters" phantom to be set up
  // in the PhantomBuster dashboard first.
  //
  // For now, fall back to demo mode with a note
  callback('PhantomBuster integration coming soon. Add your API key in Settings. Using demo data for now.');

  // When ready, the flow will be:
  // 1. POST to https://api.phantombuster.com/api/v2/agents/launch
  //    with the phantom agent ID and postUrl as argument
  // 2. Poll GET /api/v2/agents/fetch-output until status === 'finished'
  // 3. Parse the CSV/JSON output into our lead format
  // 4. Store and return results
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

      // Pipeline numbers — scraped and ICP are real, rest are editable
      var pipeline = sc.pipeline || {};
      var dmsSent = pipeline.dmsSent || 0;
      var replied = pipeline.replied || 0;
      var signedUp = pipeline.signedUp || 0;

      // Pipeline card
      html += '<div class="runner-card">';

      // Card header
      html += '<div class="runner-card-header">' +
        '<div class="runner-card-info">' +
        '<div class="runner-card-url" title="' + sc.url + '">' + truncateUrl(sc.url) + modeLabel + '</div>' +
        '<div class="runner-card-meta">' + ago + '</div></div>' +
        '<div class="scrape-result-actions">' +
        '<button class="scrape-csv-btn" onclick="downloadScrapeCSV(' + scIdx + ',true)">CSV</button>' +
        '<button class="scrape-remove-btn" onclick="removeScrape(' + sc.id + ')">Remove</button>' +
        '</div></div>';

      // Pipeline: Scraped → ICP → DMs → Replied → Signed Up
      html += '<div class="runner-pipe">';

      // Stage 1: Scraped (auto from scrape)
      html += renderPipeStage('Scraped', total, null, false);
      html += renderPipeArrow(total, matched.length);

      // Stage 2: ICP Matches (auto from filter)
      html += renderPipeStage('ICP Matches', matched.length, null, false);
      html += renderPipeArrow(matched.length, dmsSent);

      // Stage 3: DMs Sent (editable)
      html += renderPipeStage('DMs Sent', dmsSent, 'updatePipeline(' + sc.id + ',\'dmsSent\',this.value)', true);
      html += renderPipeArrow(dmsSent, replied);

      // Stage 4: Replied (editable)
      html += renderPipeStage('Replied', replied, 'updatePipeline(' + sc.id + ',\'replied\',this.value)', true);
      html += renderPipeArrow(replied, signedUp);

      // Stage 5: Signed Up (editable)
      html += renderPipeStage('Signed Up', signedUp, 'updatePipeline(' + sc.id + ',\'signedUp\',this.value)', true);

      html += '</div>';

      // Workflow guide — contextual next step
      html += renderWorkflowGuide(matched.length, dmsSent, replied, signedUp, scIdx);

      // Expandable lead table
      html += '<details class="runner-leads"><summary class="runner-leads-toggle">' +
        matched.length + ' ICP leads · ' + (total - matched.length) + ' others</summary>';
      html += '<table class="scrape-table"><thead><tr>' +
        '<th>Name</th><th>Title</th><th>Company</th><th>Comment</th>' +
        '</tr></thead><tbody>';

      var sorted = matched.concat(sc.leads.filter(function(l) { return !l.icp_match; }));
      sorted.forEach(function(l) {
        html += '<tr class="' + (l.icp_match ? 'scrape-row-match' : 'scrape-row-miss') + '">' +
          '<td><a href="' + l.linkedin_url + '" target="_blank" rel="noopener" class="scrape-name-link">' + l.name + '</a></td>' +
          '<td>' + (l.title || '<span class="scrape-empty">Private</span>') + '</td>' +
          '<td>' + (l.company || '<span class="scrape-empty">—</span>') + '</td>' +
          '<td class="scrape-comment">' + (l.comment_text || '<span class="scrape-empty">Liked</span>') + '</td>' +
          '</tr>';
      });
      html += '</tbody></table></details>';

      html += '</div>';
    });
  } else {
    html += '<div class="scrape-empty-state">Paste a LinkedIn post URL above to scrape engagers, filter by ICP, and track your outreach pipeline.</div>';
  }

  el.innerHTML = html;
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
      '<strong>Export & load into Dripify</strong>' +
      '<div class="runner-guide-detail">Click CSV above → Open <a href="https://dripify.io" target="_blank" rel="noopener">Dripify</a> → ' +
      'Create Campaign → Import CSV → Pick a message template → Start</div>' +
      '</div></div>' +
      '<div class="runner-guide-step">' +
      '<span class="runner-guide-num">2</span>' +
      '<div class="runner-guide-text">' +
      '<strong>Update DMs Sent</strong>' +
      '<div class="runner-guide-detail">Once Dripify starts sending, update the "DMs Sent" number above from your Dripify dashboard</div>' +
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
