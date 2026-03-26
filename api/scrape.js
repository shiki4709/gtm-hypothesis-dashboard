const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const url = (body.url || '').trim();
  if (!url || !url.includes('linkedin.com')) return res.status(400).json({ error: 'Invalid LinkedIn URL' });

  const apifyToken = process.env.APIFY_TOKEN || '';
  if (!apifyToken) return res.status(400).json({ error: 'Apify not configured' });

  try {
    const result = await scrapeWithApify(url, apifyToken);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

async function scrapeWithApify(postUrl, token) {
  const actorId = 'scraping_solutions~linkedin-posts-engagers-likers-and-commenters-no-cookies';

  // Run the actor synchronously and get dataset items
  const apiUrl = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${token}`;

  // Convert post URL to feed/update format that Apify expects
  let apifyUrl = postUrl;
  const actMatch = postUrl.match(/activity[- ](\d+)/);
  const shareMatch = postUrl.match(/share[- ](\d+)/);
  if (actMatch) {
    apifyUrl = `https://www.linkedin.com/feed/update/urn:li:activity:${actMatch[1]}/`;
  } else if (shareMatch) {
    apifyUrl = `https://www.linkedin.com/feed/update/urn:li:share:${shareMatch[1]}/`;
  }

  const resp = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: apifyUrl,
    }),
    timeout: 120000,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Apify error: ${resp.status} ${errText.substring(0, 200)}`);
  }

  const rawText = await resp.text();
  let items;
  try {
    items = JSON.parse(rawText);
  } catch (e) {
    return { error: 'Failed to parse Apify response', raw: rawText.substring(0, 500) };
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return { leads: [], total: 0, fetched: 0, commenters: 0, likers: 0, debug: rawText.substring(0, 500) };
  }

  // Parse Apify output into our lead format
  const leads = [];
  const seen = new Set();
  let commentCount = 0;
  let likerCount = 0;

  for (const item of items) {
    // Apify fields: type, url_profile, name, subtitle, comment (if commenter)
    const profileUrl = item.url_profile || item.profileUrl || item.linkedinUrl || item.url || '';
    if (!profileUrl || seen.has(profileUrl)) continue;
    seen.add(profileUrl);

    const name = item.name || item.fullName || item.firstName || '';
    const headline = item.subtitle || item.headline || item.title || item.occupation || '';
    const comment = item.comment || item.commentText || item.text || '';
    const type = item.type || '';
    const company = extractCompany(headline);

    if (type === 'commenters' || comment) commentCount++;
    else likerCount++;

    leads.push({
      name: name,
      title: headline,
      company: company,
      linkedin_url: profileUrl,
      comment_text: comment,
      scraped_from: postUrl,
    });
  }

  // Sort: commenters first
  leads.sort((a, b) => {
    if (a.comment_text && !b.comment_text) return -1;
    if (!a.comment_text && b.comment_text) return 1;
    return 0;
  });

  return {
    leads: leads,
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
