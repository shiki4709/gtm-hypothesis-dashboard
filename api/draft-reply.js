const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY || '';
  if (!apiKey) return res.status(400).json({ error: 'No API key configured' });

  const { tweet_text, author_name, author_handle } = req.body || {};
  if (!tweet_text) return res.status(400).json({ error: 'No tweet text provided' });

  const prompt = `Write a reply to this tweet by @${author_handle} (${author_name}):

"${tweet_text.substring(0, 500)}"

Rules:
- 1-2 sentences max, under 200 characters
- Add genuine value — share a related experience, data point, or perspective
- Don't just agree ("great point!") — add something new
- Don't be sycophantic — no "love this", "so true", "amazing insight"
- Don't pitch anything
- Sound like a thoughtful practitioner, not a bot
- Match the tone of the original tweet (casual if casual, technical if technical)
- Output ONLY the reply text, nothing else`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!resp.ok) return res.status(resp.status).json({ error: 'Claude API error: ' + resp.status });

    const result = await resp.json();
    const reply = result.content?.[0]?.text || '';
    res.json({ reply });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
