const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const url = (body.url || '').trim();
  const li_at = body.li_at || '';
  if (!url || !url.includes('linkedin.com')) return res.status(400).json({ error: 'Invalid LinkedIn URL', received: url });
  if (!li_at) return res.status(400).json({ error: 'No LinkedIn connection. Go to Settings and paste your li_at cookie.' });

  try {
    const result = await scrapePost(url, li_at);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

async function scrapePost(postUrl, liAt) {
  const cookies = { li_at: liAt };
  const headers = buildHeaders(cookies);

  // Extract activity ID from URL — try multiple patterns
  const actMatch = postUrl.match(/activity[- :_](\d{15,25})/);
  const ugcMatch = postUrl.match(/ugcPost[- :_](\d{15,25})/);
  const anyNumMatch = postUrl.match(/(\d{19,20})/);
  const postId = actMatch ? actMatch[1] : (ugcMatch ? ugcMatch[1] : (anyNumMatch ? anyNumMatch[1] : null));
  if (!postId) return { error: 'Could not find post ID from URL: ' + postUrl.substring(0, 100) };

  // Try both URN types
  let data = null, urnType = null;
  for (const ut of ['activity', 'ugcPost']) {
    const url = `https://www.linkedin.com/voyager/api/graphql?includeWebMetadata=true&variables=(count:10,start:0,threadUrn:urn%3Ali%3A${ut}%3A${postId})&queryId=voyagerSocialDashReactions.cab051ffdf47c41130cdd414e0097402`;
    const resp = await voyagerFetch(url, cookies, headers);
    if (resp) {
      try {
        const reactions = resp.data.data.socialDashReactionsByReactionType;
        if (reactions && reactions.paging) {
          data = resp;
          urnType = ut;
          break;
        }
      } catch (e) { continue; }
    }
  }

  if (!data) return { error: 'Failed to fetch likers. Cookie may be expired.' };

  const total = data.data.data.socialDashReactionsByReactionType.paging.total;

  // Fetch all likers in batches of 100
  const leads = [];
  const pages = Math.ceil(total / 100);

  for (let i = 0; i < Math.min(pages, 30); i++) {
    const url = `https://www.linkedin.com/voyager/api/graphql?includeWebMetadata=true&variables=(count:100,start:${i * 100},threadUrn:urn%3Ali%3A${urnType}%3A${postId})&queryId=voyagerSocialDashReactions.cab051ffdf47c41130cdd414e0097402`;
    const batch = await voyagerFetch(url, cookies, headers);
    if (!batch) continue;

    for (const elem of (batch.included || [])) {
      if (!elem || !elem.actorUrn) continue;
      const lockup = elem.reactorLockup;
      if (!lockup) continue;

      const name = lockup.title ? lockup.title.text || '' : '';
      let headline = '';
      if (lockup.subtitle) {
        headline = typeof lockup.subtitle === 'string' ? lockup.subtitle : (lockup.subtitle.text || '');
      }
      const profileUrl = lockup.navigationUrl || '';

      let company = '';
      if (headline) {
        for (const sep of [' @ ', ' @', ' | ', ' at ']) {
          if (headline.includes(sep)) {
            company = headline.split(sep)[1].split('|')[0].trim();
            break;
          }
        }
      }

      leads.push({ name, title: headline, company, linkedin_url: profileUrl, comment_text: '', scraped_from: postUrl });
    }
  }

  // Scrape commenters from post page
  const commenters = await scrapeCommenters(postUrl, postId, cookies, headers);

  // Merge: commenters first, then likers, deduplicated
  const seen = new Set();
  const merged = [];
  for (const c of commenters) {
    if (c.linkedin_url && !seen.has(c.linkedin_url)) {
      seen.add(c.linkedin_url);
      merged.push(c);
    }
  }
  for (const l of leads) {
    if (l.linkedin_url && !seen.has(l.linkedin_url)) {
      seen.add(l.linkedin_url);
      merged.push(l);
    }
  }

  return { leads: merged, total: total + commenters.length, fetched: merged.length, commenters: commenters.length, likers: leads.length };
}

async function scrapeCommenters(postUrl, postId, cookies, headers) {
  try {
    const url = `https://www.linkedin.com/feed/update/urn:li:activity:${postId}`;
    const resp = await fetch(url, { headers: { ...headers, 'cookie': `li_at=${cookies.li_at}` }, redirect: 'manual' });
    if (resp.status !== 200) return [];

    let text = await resp.text();
    // Unescape HTML entities
    text = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'");

    const codeBlocks = text.match(/<code[^>]*>([\s\S]*?)<\/code>/g) || [];
    const commenters = [];
    const seenUrls = new Set();

    for (const block of codeBlocks) {
      const jsonStr = block.replace(/<\/?code[^>]*>/g, '');
      try {
        const data = JSON.parse(jsonStr);
        if (!data || !data.included) continue;
        for (const item of data.included) {
          if (!item || !item.entityUrn || !item.entityUrn.includes('fsd_comment') || !item.commenter) continue;
          const c = item.commenter;
          const name = c.title ? c.title.text || '' : '';
          let headline = c.subtitle || '';
          if (typeof headline === 'object') headline = headline.text || '';
          const navUrl = c.navigationUrl || '';
          let commentText = item.commentary ? item.commentary.text || '' : '';

          if (!name || seenUrls.has(navUrl)) continue;
          seenUrls.add(navUrl);

          let company = '';
          if (headline) {
            for (const sep of [' @ ', ' @', ' | ', ' at ']) {
              if (headline.includes(sep)) {
                company = headline.split(sep)[1].split('|')[0].trim();
                break;
              }
            }
          }

          commenters.push({ name, title: headline, company, linkedin_url: navUrl, comment_text: commentText, scraped_from: postUrl });
        }
      } catch (e) { continue; }
    }
    return commenters;
  } catch (e) {
    return [];
  }
}

function buildHeaders(cookies) {
  const csrf = (cookies.JSESSIONID || '').replace(/"/g, '');
  return {
    'accept': 'application/vnd.linkedin.normalized+json+2.1',
    'accept-language': 'en-US,en;q=0.9',
    'csrf-token': csrf,
    'x-li-lang': 'en_US',
    'x-restli-protocol-version': '2.0.0',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'cookie': `li_at=${cookies.li_at}`,
  };
}

async function voyagerFetch(url, cookies, headers) {
  try {
    const resp = await fetch(url, { headers, redirect: 'manual' });
    if (resp.status === 200) return await resp.json();
    return null;
  } catch (e) {
    return null;
  }
}
