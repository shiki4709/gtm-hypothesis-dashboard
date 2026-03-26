module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // White-label config via env vars — defaults to Hawki/Syval branding
  res.json({
    brandName: process.env.BRAND_NAME || 'Hawki',
    brandTagline: process.env.BRAND_TAGLINE || 'Find & engage your next leads',
    accentColor: process.env.BRAND_COLOR || '#2196F3',
    defaultICP: process.env.DEFAULT_ICP
      ? process.env.DEFAULT_ICP.split(',').map(s => s.trim())
      : null,
    defaultExclude: process.env.DEFAULT_EXCLUDE
      ? process.env.DEFAULT_EXCLUDE.split(',').map(s => s.trim())
      : null,
  });
};
