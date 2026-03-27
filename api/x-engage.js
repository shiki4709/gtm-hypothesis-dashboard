const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.SOCIALDATA_API_KEY || '';
  if (!apiKey) return res.status(400).json({ error: 'SocialData API not configured' });

  const { accounts, topics } = req.body || {};
  if ((!accounts || !accounts.length) && (!topics || !topics.length)) {
    return res.status(400).json({ error: 'No accounts or topics provided' });
  }

  const allTweets = [];
  const seen = new Set();

  // Search by account
  for (const handle of (accounts || [])) {
    try {
      const query = `from:${handle}`;
      const resp = await fetch(
        `https://api.socialdata.tools/twitter/search?query=${encodeURIComponent(query)}&type=Latest`,
        { headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' }, timeout: 10000 }
      );
      if (resp.ok) {
        const data = await resp.json();
        const tweets = (data.tweets || []).slice(0, 3);
        for (const tw of tweets) {
          if (seen.has(tw.id_str)) continue;
          seen.add(tw.id_str);
          allTweets.push(parseTweet(tw));
        }
      }
    } catch (e) { /* skip failed account */ }
  }

  // Search by topic
  for (const topic of (topics || [])) {
    try {
      const query = `${topic} min_retweets:5 lang:en`;
      const resp = await fetch(
        `https://api.socialdata.tools/twitter/search?query=${encodeURIComponent(query)}&type=Latest`,
        { headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' }, timeout: 10000 }
      );
      if (resp.ok) {
        const data = await resp.json();
        const tweets = (data.tweets || []).filter(tw => !tw.full_text?.startsWith('RT @')).slice(0, 3);
        for (const tw of tweets) {
          if (seen.has(tw.id_str)) continue;
          seen.add(tw.id_str);
          allTweets.push(parseTweet(tw));
        }
      }
    } catch (e) { /* skip failed topic */ }
  }

  res.json({ tweets: allTweets });
};

function parseTweet(tw) {
  return {
    id: tw.id_str || '',
    text: tw.full_text || tw.text || '',
    username: tw.user?.screen_name || '',
    name: tw.user?.name || '',
    followers: tw.user?.followers_count || 0,
    likes: tw.favorite_count || 0,
    retweets: tw.retweet_count || 0,
    replies: tw.reply_count || 0,
  };
}
