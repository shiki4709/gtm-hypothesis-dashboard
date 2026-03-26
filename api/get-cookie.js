// This endpoint is called by the Hawki page to test if a cookie is still valid
const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { li_at } = req.body || {};
  if (!li_at) return res.json({ valid: false, error: 'No cookie' });

  try {
    // Test the cookie by hitting a simple LinkedIn API endpoint
    const resp = await fetch('https://www.linkedin.com/voyager/api/me', {
      headers: {
        'cookie': `li_at=${li_at}`,
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      redirect: 'manual',
    });

    if (resp.status === 200) {
      return res.json({ valid: true });
    }
    return res.json({ valid: false, error: 'Cookie expired' });
  } catch (e) {
    return res.json({ valid: false, error: e.message });
  }
};
