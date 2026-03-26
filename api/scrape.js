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

  if (pollId) {
    try { return res.json(await checkRuns(pollId, apifyToken)); }
    catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (!url || !url.includes('linkedin.com')) return res.status(400).json({ error: 'Invalid LinkedIn URL' });

  try { res.json(await startScrape(url, apifyToken)); }
  catch (e) { res.status(500).json({ error: e.message }); }
};

async function startScrape(postUrl, token) {
  const actorId = 'scraping_solutions~linkedin-posts-engagers-likers-and-commenters-no-cookies';
  const startUrl = `https://api.apify.com/v2/acts/${actorId}/runs?token=${token}`;

  let apifyUrl = postUrl;
  const actMatch = postUrl.match(/activity[- ](\d+)/);
  const shareMatch = postUrl.match(/share[- ](\d+)/);
  if (actMatch) apifyUrl = `https://www.linkedin.com/feed/update/urn:li:activity:${actMatch[1]}/`;
  else if (shareMatch) apifyUrl = `https://www.linkedin.com/feed/update/urn:li:share:${shareMatch[1]}/`;

  // Start both commenters and likers runs
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

  const commDs = commRun.data?.defaultDatasetId;
  const commId = commRun.data?.id;
  const likeDs = likeRun.data?.defaultDatasetId;
  const likeId = likeRun.data?.id;

  if (!commDs || !commId || !likeDs || !likeId) {
    const errMsg = commRun.error || likeRun.error || 'Apify failed to start. Check the post URL and try again.';
    throw new Error(errMsg);
  }

  return {
    status: 'started',
    pollId: [commDs, commId, likeDs, likeId].join(','),
  };
}

async function checkRuns(pollId, token) {
  const parts = pollId.split(',');
  const commDs = parts[0], commRunId = parts[1];
  const likeDs = parts[2], likeRunId = parts[3];

  // Check if both runs finished
  for (const rid of [commRunId, likeRunId]) {
    if (!rid) continue;
    try {
      const resp = await fetch(`https://api.apify.com/v2/actor-runs/${rid}?token=${token}`);
      if (resp.ok) {
        const runData = (await resp.json()).data;
        const s = runData?.status;
        if (s === 'FAILED' || s === 'ABORTED') {
          return { status: 'done', leads: [], total: 0, fetched: 0, error: 'Scrape run ' + s.toLowerCase() + ': ' + (runData?.statusMessage || 'unknown error') };
        }
        if (s !== 'SUCCEEDED') {
          return { status: 'running', leads: [], fetched: 0 };
        }
      }
    } catch (e) {
      // Network error checking run status — treat as still running
      return { status: 'running', leads: [], fetched: 0 };
    }
  }

  // Both done — fetch results
  let commItems = [], likeItems = [];
  try {
    const r = await fetch(`https://api.apify.com/v2/datasets/${commDs}/items?token=${token}`);
    if (r.ok) commItems = await r.json();
  } catch (e) {
    console.error('Failed to fetch commenters:', e.message);
  }
  try {
    const r = await fetch(`https://api.apify.com/v2/datasets/${likeDs}/items?token=${token}`);
    if (r.ok) likeItems = await r.json();
  } catch (e) {
    console.error('Failed to fetch likers:', e.message);
  }

  // Parse and merge — commenters first, then likers, deduplicated
  const leads = [];
  const seen = new Set();
  let commentCount = 0, likerCount = 0;

  // Commenters — use content field for comment text
  for (const item of commItems) {
    const profileUrl = item.url_profile || '';
    if (!profileUrl || seen.has(profileUrl)) continue;
    seen.add(profileUrl);
    commentCount++;
    leads.push({
      name: item.name || '',
      title: item.subtitle || '',
      company: extractCompany(item.subtitle || ''),
      linkedin_url: profileUrl,
      comment_text: item.content || '',
      scraped_from: '',
    });
  }

  // Likers — no comment text
  for (const item of likeItems) {
    const profileUrl = item.url_profile || '';
    if (!profileUrl || seen.has(profileUrl)) continue;
    seen.add(profileUrl);
    likerCount++;
    leads.push({
      name: item.name || '',
      title: item.subtitle || '',
      company: extractCompany(item.subtitle || ''),
      linkedin_url: profileUrl,
      comment_text: '',
      scraped_from: '',
    });
  }

  return {
    status: 'done',
    leads, total: leads.length, fetched: leads.length,
    commenters: commentCount, likers: likerCount,
  };
}

function extractCompany(headline) {
  if (!headline) return '';
  for (const sep of [' @ ', ' @', ' | ', ' at ']) {
    if (headline.includes(sep)) return headline.split(sep)[1].split('|')[0].trim();
  }
  return '';
}
