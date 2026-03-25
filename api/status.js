module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({ cookies_loaded: true, cookie_count: 0, note: 'Cookies are client-side on Vercel' });
};
