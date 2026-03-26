const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const url = (body.url || '').trim();
  const pollId = body.runId || '';

  const apifyToken = process.env.APIFY_TOKEN || '';
  if (!apifyToken) return res.status(400).json({ error: 'Apify not configured' });

  // Poll for results
  if (pollId) {
    try {
      const result = await checkRun(pollId, apifyToken);
      return res.json(result);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // Start new scrape
  if (!url || !url.includes('linkedin.com')) return res.status(400).json({ error: 'Invalid LinkedIn URL' });

  try {
    const result = await startScrape(url, apifyToken);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

async function startScrape(postUrl, token) {
  const actorId = 'scraping_solutions~linkedin-posts-engagers-likers-and-commenters-no-cookies';
  const startUrl = `https://api.apify.com/v2/acts/${actorId}/runs?token=${token}`;

  // Convert URL format
  let apifyUrl = postUrl;
  const actMatch = postUrl.match(/activity[- ](\d+)/);
  const shareMatch = postUrl.match(/share[- ](\d+)/);
  if (actMatch) {
    apifyUrl = `https://www.linkedin.com/feed/update/urn:li:activity:${actMatch[1]}/`;
  } else if (shareMatch) {
    apifyUrl = `https://www.linkedin.com/feed/update/urn:li:share:${shareMatch[1]}/`;
  }

  // Single run — the "commenters" type actually returns both commenters AND likers
  const run = await fetch(startUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: apifyUrl, type: 'commenters', iterations: 18, start: 0 }),
  }).then(r => r.json());

  const runId = run.data?.id || '';
  const datasetId = run.data?.defaultDatasetId || '';

  return {
    status: 'started',
    pollId: `${datasetId}|${runId}`,
  };
}

async function checkRun(pollId, token) {
  const [datasetId, runId] = pollId.split('|');

  // Check if run is finished
  if (runId) {
    try {
      const resp = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${token}`);
      if (resp.ok) {
        const run = await resp.json();
        const status = run.data?.status;
        if (status !== 'SUCCEEDED' && status !== 'FAILED' && status !== 'ABORTED') {
          return { status: 'running', leads: [], fetched: 0 };
        }
      }
    } catch (e) {}
  }

  // Run finished — get items
  const resp = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}`);
  if (!resp.ok) return { leads: [], total: 0, fetched: 0, commenters: 0, likers: 0 };

  const items = await resp.json();
  if (!items || items.length === 0) return { leads: [], total: 0, fetched: 0, commenters: 0, likers: 0 };

  // Parse results
  const leads = [];
  const seen = new Set();
  let commentCount = 0;
  let likerCount = 0;

  for (const item of items) {
    const profileUrl = item.url_profile || '';
    if (!profileUrl || seen.has(profileUrl)) continue;
    seen.add(profileUrl);

    const name = item.name || '';
    const headline = item.subtitle || '';
    const commentText = item.content || '';
    const company = extractCompany(headline);

    // Has comment text = commenter, empty = liker
    if (commentText) commentCount++;
    else likerCount++;

    leads.push({
      name,
      title: headline,
      company,
      linkedin_url: profileUrl,
      comment_text: commentText,
      scraped_from: '',
    });
  }

  // Sort: commenters first
  leads.sort((a, b) => {
    if (a.comment_text && !b.comment_text) return -1;
    if (!a.comment_text && b.comment_text) return 1;
    return 0;
  });

  return {
    status: 'done',
    leads,
    total: leads.length,
    fetched: leads.length,
    commenters: commentCount,
    likers: likerCount,
  };
}

function extractCompany(headline) {
  if (!headline) return '';
  for (const sep of [' @ ', ' @', ' | ', ' at ']) {
    if (headline.includes(sep)) {
      return headline.split(sep)[1].split('|')[0].trim();
    }
  }
  return '';
}
