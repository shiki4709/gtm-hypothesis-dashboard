/* ================================================================
   Benchmarks — AI-powered verdict suggestions

   Architecture:
   1. Channel defaults provide baseline benchmarks
   2. Each experiment can store custom benchmarks (overrides defaults)
   3. LLM generates benchmarks for new/novel experiments
   4. Verdict engine uses benchmarks + sample size to suggest calls

   Benchmark shape:
   {
     avg:        0.08,     // industry average for this rate metric
     good:       0.15,     // top quartile — "keep going" threshold
     great:      0.25,     // top 10%
     minSample:  50,       // min denominator before making a call
     variables:  [...],    // what to change if underperforming
     source:     'default' // 'default' | 'ai' | 'manual'
   }
   ================================================================ */

var BM_KEY = 'gtm_benchmarks_v1';
var AI_KEY_STORE = 'gtm_ai_key';

/* ── Channel default benchmarks ── */
/* Benchmarks sourced from HubSpot, Gong, Apollo, Outreach, LinkedIn Sales
   Solutions, Mailchimp, Ahrefs — 2025-2026 B2B SaaS data */
var CHANNEL_BENCHMARKS = {
  li_outreach: {
    avg: 0.10, good: 0.18, great: 0.25, minSample: 200,
    variables: ['DM template / opener', 'ICP filter criteria', 'Connection note personalization', 'Follow-up sequence timing', 'Profile headline & photo'],
    source: 'industry'
  },
  lead_lists: {
    avg: 0.17, good: 0.25, great: 0.35, minSample: 100,
    variables: ['Source post selection (topic relevance)', 'Speed of outreach after engagement (<24hrs)', 'DM referencing specific post they engaged with', 'Comment vs like filter', 'ICP filter after scrape'],
    source: 'industry'
  },
  warm_intros: {
    avg: 0.30, good: 0.45, great: 0.60, minSample: 30,
    variables: ['Who you ask (relationship strength)', 'Forwardable blurb quality', 'Target account selection', 'Reciprocity / incentive offered'],
    source: 'industry'
  },
  gifts: {
    avg: 0.35, good: 0.45, great: 0.60, minSample: 25,
    variables: ['Gift relevance to recipient', 'Gift value ($20-75 sweet spot)', 'Delivery platform (Sendoso/Postal)', 'Follow-up timing and copy', 'Whether gift ties to your product story'],
    source: 'industry'
  },
  email: {
    avg: 0.03, good: 0.06, great: 0.10, minSample: 500,
    variables: ['Subject line', 'Sender name / domain warm-up', 'Body copy / CTA', 'List segmentation', 'Send time', 'SPF/DKIM/DMARC deliverability'],
    source: 'industry'
  },
  events: {
    avg: 0.12, good: 0.20, great: 0.35, minSample: 20,
    variables: ['Event selection / audience fit', 'Conversation opener', 'Venue / format (dinner vs coffee vs happy hour)', 'Follow-up speed (<24hrs)', 'Collateral / branded items', 'Co-host with complementary vendor'],
    source: 'industry'
  },
  li_content: {
    avg: 0.02, good: 0.04, great: 0.06, minSample: 500,
    variables: ['Content format (carousel vs text vs video)', 'Hook / first line', 'Topic relevance to ICP pain', 'Post timing (Tue-Thu 8-10am)', 'CTA in comments', 'Engagement in first 30min'],
    source: 'industry'
  },
  content_seo: {
    avg: 0.02, good: 0.04, great: 0.07, minSample: 200,
    variables: ['Keyword targeting (competition + intent)', 'Content depth / quality', 'CTA placement', 'Internal linking', 'Page type (comparison/alternative pages convert highest)', 'Backlink strategy'],
    source: 'industry'
  },
  product: {
    avg: 0.05, good: 0.12, great: 0.20, minSample: 200,
    variables: ['User segment targeting', 'Trigger conditions (behavior vs time)', 'Channel (email/in-app/Slack)', 'Message copy and CTA', 'Frequency capping', 'Incentive (discount vs feature unlock)'],
    source: 'industry'
  }
};

/* ── Load/save per-experiment benchmarks ── */
function loadBenchmarks() {
  var s = localStorage.getItem(BM_KEY);
  return s ? JSON.parse(s) : {};
}

function saveBenchmarks(bm) {
  localStorage.setItem(BM_KEY, JSON.stringify(bm));
}

function getBenchmark(exp, ch) {
  var custom = loadBenchmarks();
  if (custom[exp.id]) return custom[exp.id];
  var channel = ch || exp.ch;
  if (channel && CHANNEL_BENCHMARKS[channel]) return CHANNEL_BENCHMARKS[channel];
  return { avg: 0.10, good: 0.20, great: 0.30, minSample: 30, variables: [], source: 'fallback' };
}

function setBenchmark(expId, bm) {
  var all = loadBenchmarks();
  all[expId] = bm;
  saveBenchmarks(all);
}

/* ── Verdict suggestion engine ── */
function suggestVerdict(exp, ch) {
  var bm = getBenchmark(exp, ch);
  var rate = expRate(exp);
  var hasData = expHasData(exp);

  if (!hasData) {
    return { verdict: null, confidence: 0, reason: 'No data yet. Run the experiment first.', suggestion: null };
  }

  // Get sample size (denominator of rate)
  var ri = exp.rateIdx || (ch && CH[ch] ? CH[ch].rateIdx : [1, 0]);
  var sample = exp.stages[ri[1]] ? exp.stages[ri[1]].val : 0;

  if (sample < bm.minSample) {
    var needed = bm.minSample - sample;
    return {
      verdict: null,
      confidence: 0,
      reason: 'Too early — need ' + needed + ' more ' + (exp.stages[ri[1]] ? exp.stages[ri[1]].label.toLowerCase() : 'samples') + ' before making a call. (Min: ' + bm.minSample + ')',
      suggestion: 'keep_running'
    };
  }

  // Enough data — make a call
  if (rate >= bm.good) {
    var pctAbove = Math.round(((rate - bm.good) / bm.good) * 100);
    return {
      verdict: 'Keep going',
      confidence: rate >= bm.great ? 95 : 80,
      reason: (rate * 100).toFixed(1) + '% is ' + (rate >= bm.great ? 'exceptional' : 'above') +
        ' — benchmark avg is ' + (bm.avg * 100).toFixed(0) + '%, good is ' + (bm.good * 100).toFixed(0) + '%.' +
        (rate >= bm.great ? ' Top 10% performance.' : ''),
      suggestion: 'keep'
    };
  }

  if (rate >= bm.avg) {
    return {
      verdict: 'Keep going',
      confidence: 60,
      reason: (rate * 100).toFixed(1) + '% is at industry average (' + (bm.avg * 100).toFixed(0) + '%). Room to improve — good is ' + (bm.good * 100).toFixed(0) + '%.',
      suggestion: 'keep_improve',
      variables: bm.variables.slice(0, 3)
    };
  }

  if (rate >= bm.avg * 0.5) {
    return {
      verdict: 'Change variables',
      confidence: 75,
      reason: (rate * 100).toFixed(1) + '% is below average (' + (bm.avg * 100).toFixed(0) + '%). Test 2-3 variable changes before giving up.',
      suggestion: 'change',
      variables: bm.variables.slice(0, 3)
    };
  }

  // Well below average — but check if there's enough volume to be sure
  if (sample < bm.minSample * 2) {
    return {
      verdict: 'Change variables',
      confidence: 60,
      reason: (rate * 100).toFixed(1) + '% is well below average (' + (bm.avg * 100).toFixed(0) + '%), but sample (' + sample + ') is still moderate. Try changing variables before stopping.',
      suggestion: 'change',
      variables: bm.variables.slice(0, 4)
    };
  }

  return {
    verdict: 'Stop',
    confidence: 75,
    reason: (rate * 100).toFixed(1) + '% is well below average (' + (bm.avg * 100).toFixed(0) + '%) with sufficient sample (' + sample + '). Consider stopping or fundamentally rethinking.',
    suggestion: 'stop',
    variables: bm.variables
  };
}

/* ── AI benchmark generation ── */
function getAIKey() {
  return localStorage.getItem(AI_KEY_STORE) || '';
}

function setAIKey(key) {
  localStorage.setItem(AI_KEY_STORE, key);
}

function generateBenchmarkAI(exp, callback) {
  var key = getAIKey();
  if (!key) {
    callback(null, 'No API key set. Click settings to add your Anthropic API key.');
    return;
  }

  var info = CH[exp.ch] || {};
  var stageLabels = exp.stages.map(function(s) { return s.label; }).join(' → ');
  var ri = exp.rateIdx || info.rateIdx || [1, 0];
  var rateMetric = (exp.stages[ri[0]] ? exp.stages[ri[0]].label : 'numerator') +
    ' / ' + (exp.stages[ri[1]] ? exp.stages[ri[1]].label : 'denominator');

  var prompt = 'You are a B2B SaaS GTM benchmarking expert. Generate benchmark metrics for this experiment.\n\n' +
    'Experiment: ' + exp.name + '\n' +
    'Channel: ' + (info.label || exp.ch) + '\n' +
    'Mode: ' + (info.mode || 'outbound') + '\n' +
    'Pipeline: ' + stageLabels + '\n' +
    'Rate metric: ' + rateMetric + '\n' +
    'Idea: ' + (exp.idea || 'N/A') + '\n' +
    'Target: ' + (exp.target || 'N/A') + '\n\n' +
    'Respond with ONLY a JSON object (no markdown, no explanation):\n' +
    '{\n' +
    '  "avg": <industry average rate as decimal, e.g. 0.08>,\n' +
    '  "good": <top quartile rate>,\n' +
    '  "great": <top 10% rate>,\n' +
    '  "minSample": <minimum denominator sample size before making verdict>,\n' +
    '  "variables": [<3-5 specific variables to change if underperforming>],\n' +
    '  "reasoning": "<1 sentence explaining these benchmarks>"\n' +
    '}';

  var xhr = new XMLHttpRequest();
  xhr.open('POST', 'https://api.anthropic.com/v1/messages');
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.setRequestHeader('x-api-key', key);
  xhr.setRequestHeader('anthropic-version', '2023-06-01');
  xhr.setRequestHeader('anthropic-dangerous-direct-browser-access', 'true');

  xhr.onload = function() {
    if (xhr.status === 200) {
      try {
        var resp = JSON.parse(xhr.responseText);
        var text = resp.content[0].text;
        // Extract JSON from response (handle markdown wrapping)
        var jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          var bm = JSON.parse(jsonMatch[0]);
          bm.source = 'ai';
          callback(bm, null);
        } else {
          callback(null, 'Could not parse AI response');
        }
      } catch (err) {
        callback(null, 'Parse error: ' + err.message);
      }
    } else {
      try {
        var errResp = JSON.parse(xhr.responseText);
        callback(null, 'API error: ' + (errResp.error ? errResp.error.message : xhr.status));
      } catch (e) {
        callback(null, 'API error: ' + xhr.status);
      }
    }
  };

  xhr.onerror = function() {
    callback(null, 'Network error — check your connection');
  };

  xhr.send(JSON.stringify({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }]
  }));
}

/* ── Generate benchmarks for all experiments without custom ones ── */
function generateAllBenchmarks(callback) {
  var exps = load();
  var custom = loadBenchmarks();
  var needsGen = exps.filter(function(e) {
    if (custom[e.id]) return false;
    if (!e.variations || e.variations.length === 0) return false;
    var best = e.variations.find(function(v) { return !v.stopped; }) || e.variations[0];
    return expHasData(best);
  });

  if (needsGen.length === 0) {
    if (callback) callback();
    return;
  }

  var done = 0;
  needsGen.forEach(function(e) {
    var best = e.variations.find(function(v) { return !v.stopped; }) || e.variations[0];
    if (!best || !best.stages) { done++; if (done >= needsGen.length && callback) callback(); return; }
    var forAI = { id: e.id, name: e.name, ch: e.ch, idea: e.idea, stages: best.stages, rateIdx: best.rateIdx };
    generateBenchmarkAI(forAI, function(bm, err) {
      if (bm) setBenchmark(e.id, bm);
      done++;
      if (done >= needsGen.length && callback) callback();
    });
  });
}
