const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY || '';
  if (!apiKey) return res.status(400).json({ error: 'No API key configured' });

  const { source, platforms } = req.body || {};
  if (!source) return res.status(400).json({ error: 'No source material provided' });

  const requestedPlatforms = platforms || ['linkedin', 'x'];

  const platformInstructions = [];
  if (requestedPlatforms.includes('linkedin')) {
    platformInstructions.push(`[LINKEDIN]
Write a LinkedIn post. 150-250 words. Start with a hook that stops the scroll.
Use short paragraphs (1-2 sentences each). Add line breaks between paragraphs.
End with a question or call-to-action. Max 3 hashtags at the end.
Tone: confident practitioner sharing a real insight, not a thought leader performing.
[/LINKEDIN]`);
  }
  if (requestedPlatforms.includes('x')) {
    platformInstructions.push(`[X_THREAD]
Write an X thread of 4-6 tweets. Each tweet under 270 characters.
Format: one tweet per line, separated by ---
First tweet is the hook — make it standalone-shareable.
Last tweet is a summary or CTA.
No hashtags. No emojis. No numbering (1/, 2/).
Tone: sharp, opinionated, concise.
[/X_THREAD]`);
  }

  const prompt = `You are a content strategist. Given this source material, create platform-native content.

SOURCE MATERIAL:
${source.substring(0, 3000)}

First, extract the core insight in one sentence. Output it inside [CORE_INSIGHT]...[/CORE_INSIGHT] tags.

Then create content for each platform:
${platformInstructions.join('\n\n')}

Rules:
- Don't invent statistics or quotes not in the source
- Don't use corporate buzzwords (synergy, leverage, disrupt, game-changer)
- Write like a real person who actually does this work, not a content marketer
- Each platform's content should feel native to that platform
- Output ONLY the tagged sections, nothing else`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!resp.ok) return res.status(resp.status).json({ error: 'Claude API error: ' + resp.status });

    const result = await resp.json();
    const text = result.content?.[0]?.text || '';

    // Parse tagged sections
    const coreMatch = text.match(/\[CORE_INSIGHT\]([\s\S]*?)\[\/CORE_INSIGHT\]/);
    const linkedinMatch = text.match(/\[LINKEDIN\]([\s\S]*?)\[\/LINKEDIN\]/);
    const xMatch = text.match(/\[X_THREAD\]([\s\S]*?)\[\/X_THREAD\]/);

    res.json({
      coreInsight: coreMatch ? coreMatch[1].trim() : '',
      results: {
        linkedin: linkedinMatch ? linkedinMatch[1].trim() : '',
        x: xMatch ? xMatch[1].trim() : '',
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
