/* ================================================================
   Config — Channel definitions with variable-length pipelines

   Each channel defines:
   - defaultStages: stage labels for new experiments
   - rateIdx: [numerator, denominator] indices for the key rate
   - keyIdx: index of the "key" stage shown in flow tabs (-1 = last)
   ================================================================ */

var K = 'gtm_v25';
var WE_KEY = 'gtm_weeks_v4';
var SPRINT_KEY = 'gtm_sprint';
var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function loadSprint() {
  var s = localStorage.getItem(SPRINT_KEY);
  return s ? JSON.parse(s) : { name: 'Sprint 1', start: 'Mar 24', end: 'Apr 7', year: '2026' };
}

function saveSprint(sp) {
  localStorage.setItem(SPRINT_KEY, JSON.stringify(sp));
}

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
    metric: 'Meeting Rate',
    mode: 'outbound',
    defaultStages: ['AEs contacted', 'Replied', 'Gifts sent', 'Meetings', 'Signed up'],
    rateIdx: [3, 2],
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

/* --- Tracking source hints per channel stage --- */
var TRACKING = {
  li_outreach: {
    'ICP filtered': 'Sales Nav → Saved Search → count results',
    'Connections sent': 'Sales Nav → Sent invitations this week (max 200/wk)',
    'Accepted': 'LinkedIn → My Network → count new connections',
    'In Dripify drip': 'Dripify dashboard → Active campaigns → leads in sequence',
    'Replied': 'Dripify → Campaign stats → Replied count, or LinkedIn inbox count',
    'Signed up': 'Nevara signup dashboard or CRM',
    'Referral posts found': 'LinkedIn Search: "calling on my network" → filter past week',
    'People identified': 'Count from search results / post comments',
    'DMs sent': 'LinkedIn → Messaging → count sent this period',
    'Influencers tracked': 'Your LinkedIn saved list of thought leaders',
    'AEs surfaced': 'Check post engagers on tracked influencer posts'
  },
  lead_lists: {
    'Posts found': 'LinkedIn Search → filter by topic/hashtag → count relevant posts',
    'Engagers scraped': 'Phantom Buster → LinkedIn Post Likers/Commenters → export CSV row count',
    'ICP filtered': 'Filter CSV by title/company → count matching rows',
    'DMs sent': 'LinkedIn messaging or Dripify → sent count',
    'Replied': 'LinkedIn inbox → count replies from this list',
    'Signed up': 'Nevara signup dashboard or CRM',
    'Speaker posts found': 'LinkedIn → search speaker names → count event-related posts',
    'Commenters scraped': 'Phantom Buster → extract commenters → CSV row count',
    'Competitor posts': 'LinkedIn → Gong/Outreach/Salesloft company pages → count recent posts'
  },
  warm_intros: {
    'Target accounts': 'Your target account list (CRM or spreadsheet)',
    'Mutual connections': 'LinkedIn → each target → check "shared connections"',
    'Intro asks sent': 'Count messages sent asking for intros',
    'Meetings booked': 'Calendar → count booked meetings from intros',
    'Signed up': 'Nevara signup dashboard or CRM'
  },
  gifts: {
    'AEs researched': 'Count LinkedIn profiles researched for gift ideas',
    'Gifts sent': 'Sendoso/Postal dashboard → sent count, or manual tracking',
    'Responses': 'Count thank-you replies or follow-up conversations',
    'Meetings': 'Calendar → meetings booked from gift recipients',
    'Signed up': 'Nevara signup dashboard or CRM'
  },
  email: {
    'Sent': 'Email tool (Apollo/Outreach/Mailchimp) → campaign sent count',
    'Opened': 'Email tool → open tracking',
    'Clicked': 'Email tool → click tracking',
    'Signed up': 'Nevara signup dashboard or CRM'
  },
  events: {
    'Events attended': 'Count events you went to',
    'Conversations': 'Estimate conversations had at each event',
    'Contacts': 'Count business cards / LinkedIn connections from events',
    'Signed up': 'Nevara signup dashboard or CRM'
  },
  li_content: {
    'Posts published': 'LinkedIn → Activity → Posts → count this period',
    'Impressions': 'LinkedIn → each post → view analytics → sum impressions',
    'Engagements': 'LinkedIn → post analytics → sum likes + comments + shares',
    'Followers gained': 'LinkedIn → Analytics → Followers → net new this period',
    'Inbound DMs': 'LinkedIn inbox → count unsolicited messages from non-connections',
    'Stories published': 'LinkedIn → Activity → count customer story posts'
  },
  content_seo: {
    'Pages published': 'CMS → count new pages published',
    'Indexed': 'Google Search Console → Coverage → Valid pages',
    'Site visits': 'Google Analytics → organic traffic',
    'Signed up': 'Nevara signup dashboard or CRM'
  },
  product: {
    'Churned identified': 'Product analytics → users inactive >30 days',
    'Re-engaged': 'Count users who received win-back email/message',
    'Returned': 'Product analytics → previously churned users who logged in',
    'Retained': 'Product analytics → returned users still active after 7 days',
    'Messages sent': 'Slack analytics or in-app messaging tool → sent count',
    'Opened': 'Messaging tool → open/read count',
    'Engaged': 'Messaging tool → click or action count',
    'Activated': 'Product analytics → users who completed key action',
    'Pages rewritten': 'Docs platform → count updated pages',
    'Page views': 'Docs analytics → total views',
    'Ticket reduction': 'Support tool → compare ticket count before/after'
  }
};

function getTrackingHint(exp, stageLabel) {
  var chTrack = TRACKING[exp.ch];
  if (chTrack && chTrack[stageLabel]) return chTrack[stageLabel];
  return 'Update this number manually';
}

/* --- Rate calc helpers (used by board + weeks) --- */
function expRate(e) {
  var ri = e.rateIdx || (e.ch && CH[e.ch] ? CH[e.ch].rateIdx : [1, 0]);
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
  var info = e.ch ? CH[e.ch] : null;
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
