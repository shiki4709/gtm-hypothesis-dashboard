const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { keywords, timeframe } = req.body || {};
  if (!keywords || !keywords.trim()) return res.status(400).json({ error: 'No keywords provided' });

  // Try Brave Search API first (clean JSON), fall back to Google
  const braveKey = process.env.BRAVE_SEARCH_KEY || '';

  let freshness = '';
  if (timeframe === 'week') freshness = '&freshness=pw';
  else if (timeframe === 'month') freshness = '&freshness=pm';
  else if (timeframe === 'year') freshness = '&freshness=py';

  // Don't use site: — Brave API handles it poorly. Search broadly, filter results.
  const query = `linkedin post ${keywords.trim()}`;

  if (braveKey) {
    // Brave Search API — clean JSON, no scraping
    try {
      const apiUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=20${freshness}`;
      const resp = await fetch(apiUrl, {
        headers: { 'X-Subscription-Token': braveKey, 'Accept': 'application/json' },
        timeout: 10000,
      });
      if (resp.ok) {
        const data = await resp.json();
        const posts = parseBraveAPIResults(data);
        const totalResults = (data.web?.results || []).length;
        return res.json({ posts, query: keywords.trim(), source: 'brave-api', debug: { totalResults, hasWebResults: !!data.web, queryUsed: query } });
      } else {
        const errText = await resp.text();
        return res.json({ posts: [], query: keywords.trim(), source: 'brave-api', debug: { status: resp.status, error: errText.substring(0, 200) } });
      }
    } catch (e) {
      return res.json({ posts: [], query: keywords.trim(), source: 'brave-api', debug: { error: e.message } });
    }
  }

  // Fallback: scrape Brave Search HTML
  const searchUrl = `https://search.brave.com/search?q=${encodeURIComponent(query)}${freshness.replace('freshness', 'tf')}`;
  let html;
  try {
    const resp = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 15000,
    });
    html = await resp.text();
  } catch (e) {
    return res.status(500).json({ error: 'Search failed: ' + e.message });
  }

  const posts = parseBraveHTML(html);
  res.json({ posts, query: keywords.trim(), source: 'brave-scrape' });
};

function parseBraveAPIResults(data) {
  const results = data.web?.results || [];
  const seen = new Set();
  const posts = [];

  for (const r of results) {
    const url = r.url || '';
    if (!url.includes('linkedin.com/posts/')) continue;
    const clean = url.replace(/[?&](utm_\w+|trk|rcm)=[^&]*/g, '').replace(/[&?]$/, '');
    const actMatch = clean.match(/activity-(\d+)/);
    if (!actMatch || seen.has(actMatch[1])) continue;
    seen.add(actMatch[1]);

    const postMatch = clean.match(/linkedin\.com\/posts\/([^_]+)_(.+?)(?:-activity|-\d)/);
    const author = postMatch ? postMatch[1].replace(/-/g, ' ') : '';

    posts.push({
      url: clean,
      author,
      title: (r.title || '').substring(0, 120),
      snippet: (r.description || '').substring(0, 200),
      activity_id: actMatch[1],
    });
  }
  return posts;
}

function parseBraveHTML(html) {
  html = html.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

  const urlMatches = html.match(/linkedin\.com\/posts\/([^\s"<>]+activity-\d+[^\s"<>]*)/g) || [];
  const urls = urlMatches.map(u => 'https://www.' + u);

  const snippetMatches = html.match(/<p class="snippet-description[^"]*"[^>]*>([\s\S]*?)<\/p>/g) || [];
  const snippets = snippetMatches.map(s => s.replace(/<[^>]+>/g, '').trim());

  const titleMatches = html.match(/<span class="snippet-title"[^>]*>([\s\S]*?)<\/span>/g) || [];
  const titles = titleMatches.map(t => t.replace(/<[^>]+>/g, '').trim());

  const seen = new Set();
  const posts = [];
  let snippetIdx = 0;

  for (const url of urls) {
    const clean = url.replace(/[?&](utm_\w+|trk|rcm)=[^&]*/g, '').replace(/[&?]$/, '');
    const actMatch = clean.match(/activity-(\d+)/);
    if (!actMatch || seen.has(actMatch[1])) continue;
    seen.add(actMatch[1]);

    const snippet = snippetIdx < snippets.length ? snippets[snippetIdx++] : '';
    const postMatch = clean.match(/linkedin\.com\/posts\/([^_]+)_(.+?)(?:-activity|-\d)/);
    const author = postMatch ? postMatch[1].replace(/-/g, ' ') : '';
    const searchTitle = posts.length < titles.length ? titles[posts.length] : '';
    const title = searchTitle || (postMatch ? postMatch[2].replace(/-/g, ' ') : '');

    posts.push({
      url: clean,
      author,
      title: title.substring(0, 120),
      snippet: snippet.substring(0, 200),
      activity_id: actMatch[1],
    });
  }
  return posts;
}
