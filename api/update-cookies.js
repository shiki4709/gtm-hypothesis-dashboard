module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // On Vercel, cookies are stored client-side (localStorage)
  // This endpoint just acknowledges the update
  res.json({ status: 'ok', note: 'Cookies stored client-side' });
};
