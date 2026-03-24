/* ================================================================
   Config — Channel definitions with variable-length pipelines

   Each channel defines:
   - defaultStages: stage labels for new experiments
   - rateIdx: [numerator, denominator] indices for the key rate
   - keyIdx: index of the "key" stage shown in flow tabs (-1 = last)
   ================================================================ */

var K = 'gtm_v22';
var WE_KEY = 'gtm_weeks_v4';
var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

var CH = {
  // ── OUTBOUND ──
  li_outreach: {
    label: 'LinkedIn Outreach',
    color: 'oklch(48% 0.12 250)',
    metric: 'Reply Rate',
    mode: 'outbound',
    defaultStages: ['Connections sent', 'Replied', 'Signed up'],
    rateIdx: [1, 0],
    keyIdx: -1
  },
  lead_lists: {
    label: 'Lead Lists',
    color: 'oklch(50% 0.14 280)',
    metric: 'Reply Rate',
    mode: 'outbound',
    defaultStages: ['Posts found', 'Leads scraped', 'DMs sent', 'Replied', 'Signed up'],
    rateIdx: [3, 2],
    keyIdx: -1
  },
  warm_intros: {
    label: 'Warm Intros',
    color: 'oklch(50% 0.10 180)',
    metric: 'Meeting Rate',
    mode: 'outbound',
    defaultStages: ['Target accounts', 'Mutual connections', 'Intro asks', 'Meetings', 'Signed up'],
    rateIdx: [3, 2],
    keyIdx: -1
  },
  gifts: {
    label: 'Gift Outreach',
    color: 'oklch(55% 0.08 320)',
    metric: 'Response Rate',
    mode: 'outbound',
    defaultStages: ['AEs researched', 'Gifts sent', 'Responses', 'Meetings', 'Signed up'],
    rateIdx: [2, 1],
    keyIdx: -1
  },
  email: {
    label: 'Email',
    color: 'oklch(48% 0.10 155)',
    metric: 'Click-to-Signup',
    mode: 'outbound',
    defaultStages: ['Sent', 'Opened', 'Clicked', 'Signed up'],
    rateIdx: [2, 0],
    keyIdx: -1
  },
  events: {
    label: 'Events',
    color: 'oklch(55% 0.12 65)',
    metric: 'Conv-to-Signup',
    mode: 'outbound',
    defaultStages: ['Events attended', 'Conversations', 'Contacts', 'Signed up'],
    rateIdx: [3, 1],
    keyIdx: -1
  },

  // ── INBOUND ──
  li_content: {
    label: 'LinkedIn Posts',
    color: 'oklch(48% 0.12 250)',
    metric: 'Engagement Rate',
    mode: 'inbound',
    defaultStages: ['Posts published', 'Impressions', 'Engagements', 'Followers', 'Inbound DMs'],
    rateIdx: [2, 1],
    keyIdx: 3
  },
  twitter: {
    label: 'Twitter',
    color: 'oklch(52% 0.10 45)',
    metric: 'Engagement Rate',
    mode: 'inbound',
    defaultStages: ['Posts/Replies', 'Impressions', 'Engagements', 'Followers', 'Inbound DMs'],
    rateIdx: [2, 1],
    keyIdx: 3
  },
  reddit: {
    label: 'Reddit',
    color: 'oklch(52% 0.16 28)',
    metric: 'Upvote Rate',
    mode: 'inbound',
    defaultStages: ['Posts surfaced', 'Replies written', 'Upvotes', 'Profile visits', 'DMs received'],
    rateIdx: [2, 1],
    keyIdx: 2
  },
  content_seo: {
    label: 'Content / SEO',
    color: 'oklch(48% 0.08 30)',
    metric: 'Visit-to-Signup',
    mode: 'inbound',
    defaultStages: ['Pages published', 'Indexed', 'Site visits', 'Signed up'],
    rateIdx: [3, 2],
    keyIdx: -1
  },
  product: {
    label: 'Product',
    color: 'oklch(50% 0.015 55)',
    metric: 'Activation Rate',
    mode: 'inbound',
    defaultStages: ['Users targeted', 'Engaged', 'Activated'],
    rateIdx: [2, 0],
    keyIdx: -1
  }
};

/* --- Rate calc helpers (used by board + weeks) --- */
function expRate(e) {
  var ri = e.rateIdx || CH[e.ch].rateIdx;
  var s = e.stages;
  if (!s || !ri) return 0;
  var num = s[ri[0]] ? s[ri[0]].val : 0;
  var den = s[ri[1]] ? s[ri[1]].val : 0;
  return den > 0 ? num / den : 0;
}

function expRateStr(e) {
  var r = expRate(e);
  if (r === 0) return '—';
  return (r * 100).toFixed(1) + '%';
}

function expHasData(e) {
  if (!e.stages) return false;
  return e.stages.some(function(s) { return s.val > 0; });
}

function expKeyVal(e) {
  var info = CH[e.ch];
  if (!info || !e.stages) return 0;
  var idx = info.keyIdx === -1 ? e.stages.length - 1 : info.keyIdx;
  return e.stages[idx] ? e.stages[idx].val : 0;
}

function expTopVal(e) {
  return e.stages && e.stages[0] ? e.stages[0].val : 0;
}

function expBottomVal(e) {
  return e.stages && e.stages.length > 0 ? e.stages[e.stages.length - 1].val : 0;
}
