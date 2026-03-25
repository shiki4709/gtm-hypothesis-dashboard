const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { api_key, name, headline, comment, post_title, instruction, current_draft } = req.body;

  // User's key > env var
  const apiKey = api_key || process.env.ANTHROPIC_API_KEY || '';
  if (!apiKey) return res.status(400).json({ error: 'No API key configured' });

  const firstName = name ? name.split(' ')[0] : '';
  let prompt;

  if (instruction && current_draft) {
    prompt = `Here is a LinkedIn message draft:\n\n"${current_draft}"\n\nThe user wants you to: ${instruction}\n\nContext about the recipient:\n- Name: ${name}\n- Headline: ${headline}\n${comment ? `- They commented: "${comment}"` : `- They liked a post about: ${post_title}`}\n\nRewrite the message following the user's instruction. Keep it under 300 characters. Output only the message, nothing else.`;
  } else {
    prompt = `Write a LinkedIn connection request to ${name}. Max 250 characters.

About them:
- Headline: ${headline}
- Post topic: ${post_title}
${comment ? `- Their comment: "${comment}"` : ''}

Here are REAL examples that get 60-78% acceptance rates. Pick a style that fits — DO NOT copy the same one every time. Vary your approach:

"Hey Sarah, since we're both in the GTM space, thought it'd be cool to connect."
"Hi Joe, your comment about collapsing silos, spot on. Would love to have you in my network."
"Hi Marcus, always good to connect with folks doing solid work at Gong."
"Hey Lisa, we're in the same world, would be great to connect."
"Hi David, your take on that GTM post matched what I've been seeing too. Let's connect."
"Hey Nina, noticed we're both deep in the sales ops world. Would be good to be connected."

Now write ONE message for ${firstName}. IMPORTANT — vary the structure, don't always use the same pattern. Rules:
- Max 2 sentences, under 250 characters
- Mention ONE thing you have in common (industry, post, comment, role)
- End with "would be great to connect" or "thought it'd be cool to connect" or similar
- Do NOT ask questions
- Do NOT pitch anything
- Do NOT use words: resonated, insightful, curious, fascinating, intrigued, align, synergy, leverage
- Do NOT use em dashes. Use commas or periods instead
- Sound like you typed this in 5 seconds on your phone
- Output ONLY the message text, nothing else`;
  }

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
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!resp.ok) return res.status(resp.status).json({ error: `Claude API error: ${resp.status}` });

    const result = await resp.json();
    const message = result.content?.[0]?.text || '';
    res.json({ message });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
