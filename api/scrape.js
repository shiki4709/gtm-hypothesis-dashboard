const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const url = (body.url || '').trim();
  const runId = body.runId || '';

  const apifyToken = process.env.APIFY_TOKEN || '';
  if (!apifyToken) return res.status(400).json({ error: 'Apify not configured' });

  // If runId provided, check status and get results
  if (runId) {
    try {
      const result = await checkRun(runId, apifyToken);
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

  // Convert URL format
  let apifyUrl = postUrl;
  const actMatch = postUrl.match(/activity[- ](\d+)/);
  const shareMatch = postUrl.match(/share[- ](\d+)/);
  if (actMatch) {
    apifyUrl = `https://www.linkedin.com/feed/update/urn:li:activity:${actMatch[1]}/`;
  } else if (shareMatch) {
    apifyUrl = `https://www.linkedin.com/feed/update/urn:li:share:${shareMatch[1]}/`;
  }

  // Start async runs for both commenters and likers
  const startUrl = `https://api.apify.com/v2/acts/${actorId}/runs?token=${token}`;

  const [commRun, likeRun] = await Promise.all([
    fetch(startUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: apifyUrl, type: 'commenters', iterations: 18, start: 0 }),
    }).then(r => r.json()),
    fetch(startUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: apifyUrl, type: 'likers', iterations: 18, start: 0 }),
    }).then(r => r.json()),
  ]);

  const commId = commRun.data?.id || '';
  const likeId = likeRun.data?.id || '';
  const commDs = commRun.data?.defaultDatasetId || '';
  const likeDs = likeRun.data?.defaultDatasetId || '';

  return {
    status: 'started',
    pollId: `${commDs},${likeDs}|${commId},${likeId}`,
    runs: [
      { id: commId, type: 'commenters', datasetId: commDs },
      { id: likeId, type: 'likers', datasetId: likeDs },
    ],
  };
}

async function checkRun(runId, token) {
  // runId format: "datasetId1,datasetId2|runId1,runId2"
  const parts = runId.split('|');
  const datasetIds = parts[0].split(',');
  const runIds = parts[1] ? parts[1].split(',') : [];

  // Check if all runs are finished
  let allFinished = true;
  for (const rid of runIds) {
    if (!rid) continue;
    try {
      const resp = await fetch(`https://api.apify.com/v2/actor-runs/${rid}?token=${token}`);
      if (resp.ok) {
        const run = await resp.json();
        const status = run.data?.status;
        if (status !== 'SUCCEEDED' && status !== 'FAILED' && status !== 'ABORTED') {
          allFinished = false;
        }
      }
    } catch (e) {}
  }

  if (!allFinished) {
    return { status: 'running', leads: [], fetched: 0 };
  }

  // All runs done — get items from datasets
  let items = [];
  for (const dsId of datasetIds) {
    if (!dsId) continue;
    const resp = await fetch(`https://api.apify.com/v2/datasets/${dsId}/items?token=${token}`);
    if (resp.ok) {
      const data = await resp.json();
      items = items.concat(data);
    }
  }

  // Parse results
  const leads = [];
  const seen = new Set();
  let commentCount = 0;
  let likerCount = 0;

  for (const item of items) {
    const profileUrl = item.url_profile || item.profileUrl || '';
    if (!profileUrl || seen.has(profileUrl)) continue;
    seen.add(profileUrl);

    const name = item.name || '';
    const headline = item.subtitle || item.headline || '';
    const comment = item.content || item.comment || '';
    const type = item.type || '';
    const company = extractCompany(headline);

    if (type === 'commenters' || comment) commentCount++;
    else likerCount++;

    leads.push({
      name, title: headline, company, linkedin_url: profileUrl,
      comment_text: comment, scraped_from: '',
    });
  }

  leads.sort((a, b) => {
    if (a.comment_text && !b.comment_text) return -1;
    if (!a.comment_text && b.comment_text) return 1;
    return 0;
  });

  return {
    status: items.length > 0 ? 'done' : 'running',
    leads, total: leads.length, fetched: leads.length,
    commenters: commentCount, likers: likerCount,
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
