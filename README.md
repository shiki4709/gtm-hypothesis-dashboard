# Hawki

Find leads who engage with content in your space. Scrape LinkedIn post engagers, filter by ICP, draft personalized messages with AI.

Part of the **Syval** GTM agent suite:
- **Hawki** — find & engage leads (this tool)
- **Pingi** — monitor Twitter/Reddit for replies
- **Roari** — create content across channels

## How it works

1. **Find a post** — browse LinkedIn or use the search link to find posts your ICP engages with
2. **Paste the URL** — Hawki scrapes all likers and commenters (1,000+ per post)
3. **Filter by ICP** — toggle between ICP matches, commenters, and others
4. **Message them** — click Message, get an AI-drafted personalized message, edit it, copy to clipboard, open their profile
5. **Track results** — pipeline shows scraped → ICP → messaged → replied → signed up

## Quick start

```bash
# Clone
git clone https://github.com/shiki4709/hawki.git
cd hawki

# Install Python dependencies
cd server
pip install -r requirements.txt

# Set up your LinkedIn cookies (one-time)
# Go to linkedin.com → DevTools → Application → Cookies → copy li_at value
# Create server/cookies.json:
echo '{"li_at": "YOUR_LI_AT_COOKIE_VALUE", "JSESSIONID": "YOUR_JSESSIONID"}' > cookies.json

# Optional: add Claude API key for AI message drafting
echo '{"claude_api_key": "sk-ant-..."}' > config.json

# Run
python3 app.py
# Open http://localhost:5001
```

## Features

- **Real LinkedIn scraping** — uses LinkedIn's Voyager API, no browser automation, no PhantomBuster
- **Commenters + likers** — commenters shown first (higher intent) with their quoted text
- **ICP filtering** — configurable title keywords (AE, SDR, VP Sales, etc.)
- **4 toggle filters** — ICP+Commented, ICP, Commented, Others
- **AI message drafting** — Claude writes personalized messages referencing the post and their comment
- **Draft preview** — read, edit, rewrite before sending
- **Message tracking** — "sent" badges, undo, auto pipeline counts
- **CSV export** — all leads or ICP-only

## Architecture

```
Frontend (vanilla JS)          Backend (Python Flask)
├── index.html                 ├── server/app.py        — API routes
├── css/styles.css             ├── server/linkedin.py   — Voyager API scraper
├── js/scrape.js               ├── server/cookies.json  — LinkedIn session (gitignored)
├── js/board.js                └── server/config.json   — Claude API key (gitignored)
└── js/chat.js (settings)
```

## How scraping works

Hawki uses LinkedIn's internal Voyager API — the same API their web app uses. It sends requests with your session cookies to:
- **Reactions API** — gets all likers with names, headlines, profile URLs
- **Post page** — parses embedded JSON for commenters with their comment text

This is NOT browser automation. No Selenium, no Playwright, no risk of the detection that tools like ClawBot trigger. It's just HTTP requests.

**LinkedIn cookies expire frequently.** When scraping fails, re-export your `li_at` cookie from DevTools.

## Roadmap

- [ ] Supabase backend — user auth, per-user data
- [ ] Per-lead result tracking (replied, signed up)
- [ ] Deploy server (Render/Fly.io) so it works without local Python
- [ ] Connect Pingi for Twitter/Reddit channel
- [ ] Connect Roari for content creation
- [ ] Message templates per campaign
- [ ] Auto-refresh LinkedIn cookies via browser extension

## License

MIT
