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

  // Start multiple offset batches for both commenters and likers
  // Each batch scrapes 18 pages (~100 results). We run offsets 0, 100, 200, 300, 400
  // to cover ~500 results per type (1000+ total)
  const batchSize = 18;
  const offsets = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900];

  const startRun = (type, start) =>
    fetch(startUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: apifyUrl, type, iterations: batchSize, start }),
    }).then(r => r.json());

  const allRuns = await Promise.all([
    ...offsets.map(s => startRun('commenters', s)),
    ...offsets.map(s => startRun('likers', s)),
  ]);

  // Collect all valid run IDs
  const runIds = [];
  for (const run of allRuns) {
    const ds = run.data?.defaultDatasetId;
    const id = run.data?.id;
    if (ds && id) runIds.push({ ds, id });
  }

  if (runIds.length === 0) {
    const rawErr = allRuns[0]?.error || '';
    const errMsg = typeof rawErr === 'string' ? rawErr : JSON.stringify(rawErr);
    throw new Error(errMsg || 'Apify failed to start any runs');
  }

  // Encode all run IDs as pollId string: ds1,id1,ds2,id2,...
  const pollId = runIds.map(r => r.ds + ',' + r.id).join('|');

  return {
    status: 'started',
    pollId,
    totalBatches: runIds.length,
  };
}

async function checkRuns(pollId, token) {
  // pollId format: "ds1,id1|ds2,id2|ds3,id3|..."
  const batches = pollId.split('|').map(b => {
    const [ds, id] = b.split(',');
    return { ds, id };
  });

  // Check if ALL runs finished
  let anyRunning = false;
  let succeededCount = 0;
  for (const batch of batches) {
    if (!batch.id) continue;
    try {
      const resp = await fetch(`https://api.apify.com/v2/actor-runs/${batch.id}?token=${token}`);
      if (resp.ok) {
        const runData = (await resp.json()).data;
        const s = runData?.status;
        if (s === 'SUCCEEDED') {
          succeededCount++;
        } else if (s === 'FAILED' || s === 'ABORTED') {
          // Skip failed batches, don't abort the whole scrape
          succeededCount++;
        } else {
          anyRunning = true;
        }
      }
    } catch (e) {
      anyRunning = true;
    }
  }

  if (anyRunning) {
    return { status: 'running', leads: [], fetched: 0, progress: succeededCount + '/' + batches.length };
  }

  // All done — fetch and merge results from all datasets
  let allItems = [];
  for (const batch of batches) {
    if (!batch.ds) continue;
    try {
      const r = await fetch(`https://api.apify.com/v2/datasets/${batch.ds}/items?token=${token}`);
      if (r.ok) {
        const items = await r.json();
        allItems = allItems.concat(items);
      }
    } catch (e) {
      console.error('Failed to fetch dataset ' + batch.ds + ':', e.message);
    }
  }

  // Deduplicate by profile URL, commenters get priority (they have comment text)
  const leads = [];
  const seen = new Set();
  let commentCount = 0, likerCount = 0;

  for (const item of allItems) {
    const profileUrl = item.url_profile || '';
    if (!profileUrl || seen.has(profileUrl)) continue;
    seen.add(profileUrl);
    const hasComment = !!(item.content);
    if (hasComment) commentCount++; else likerCount++;
    leads.push({
      name: item.name || '',
      title: item.subtitle || '',
      company: extractCompany(item.subtitle || ''),
      linkedin_url: profileUrl,
      comment_text: item.content || '',
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
