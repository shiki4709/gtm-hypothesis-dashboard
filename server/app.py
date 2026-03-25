"""
GTM Runner — serves both the dashboard frontend and the LinkedIn scraper API.

Run: python3 app.py
Then open http://localhost:5001
"""

import os
import json
import requests as http_requests
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from linkedin import scrape_post_likers, load_cookies

# Serve the dashboard from the parent directory
parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
app = Flask(__name__, static_folder=None)
CORS(app, resources={r"/api/*": {"origins": "*"}})

COOKIES = None


def get_cookies():
    # Try env var first (for deployed server), then file
    li_at = os.environ.get("LI_AT", "")
    jsessionid = os.environ.get("LI_JSESSIONID", "")
    if li_at:
        return {"li_at": li_at, "JSESSIONID": jsessionid}
    try:
        return load_cookies("cookies.json")
    except FileNotFoundError:
        return None


@app.route("/api/scrape", methods=["POST"])
def scrape():
    data = request.get_json()

    # User can send their own cookie from the frontend
    li_at = data.get("li_at", "")
    if li_at:
        cookies = {"li_at": li_at, "JSESSIONID": ""}
    else:
        cookies = get_cookies()

    if not cookies:
        return jsonify({"error": "No LinkedIn connection. Go to Settings and paste your li_at cookie."}), 400

    url = data.get("url", "").strip()
    if not url or "linkedin.com" not in url:
        return jsonify({"error": "Invalid LinkedIn URL"}), 400

    try:
        result = scrape_post_likers(url, cookies)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    if "error" in result:
        return jsonify(result), 400

    return jsonify(result)


@app.route("/api/find-posts", methods=["POST"])
def find_posts():
    """Search for LinkedIn posts by keyword using Brave Search."""
    import re
    from html import unescape

    data = request.get_json()
    keywords = data.get("keywords", "").strip()
    if not keywords:
        return jsonify({"error": "No keywords provided"}), 400

    timeframe = data.get("timeframe", "month")  # week, month, year
    time_filter = ""
    if timeframe == "week":
        time_filter = "&tf=pw"
    elif timeframe == "month":
        time_filter = "&tf=pm"
    elif timeframe == "year":
        time_filter = "&tf=py"

    query = f"site:linkedin.com/posts/ {keywords}"
    search_url = f"https://search.brave.com/search?q={http_requests.utils.quote(query)}{time_filter}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html",
    }

    try:
        resp = http_requests.get(search_url, headers=headers, timeout=15)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    decoded = unescape(resp.text)

    # Extract search result snippets — Brave wraps each result in a structure
    # with a URL, title, and description snippet
    raw_urls = re.findall(r'linkedin\.com/posts/([^\s"<>]+activity-\d+[^\s"<>]*)', decoded)
    urls = [f"https://www.linkedin.com/posts/{u}" for u in raw_urls]

    # Also extract snippets from Brave's result descriptions
    snippets = re.findall(r'<p class="snippet-description[^"]*"[^>]*>(.*?)</p>', decoded, re.DOTALL)
    # And result titles
    result_titles = re.findall(r'<span class="snippet-title"[^>]*>(.*?)</span>', decoded, re.DOTALL)

    # Dedupe and clean
    seen = set()
    posts = []
    snippet_idx = 0

    for url in urls:
        clean = re.sub(r'[?&](utm_\w+|trk|rcm)=[^&]*', '', url).rstrip('&?')
        activity_match = re.search(r'activity-(\d+)', clean)
        if not activity_match or activity_match.group(1) in seen:
            continue
        seen.add(activity_match.group(1))

        # Get snippet for this result
        snippet = ""
        if snippet_idx < len(snippets):
            snippet = re.sub(r'<[^>]+>', '', snippets[snippet_idx]).strip()
            snippet_idx += 1

        # Get title from search results
        search_title = ""
        if len(posts) < len(result_titles):
            search_title = re.sub(r'<[^>]+>', '', result_titles[len(posts)]).strip()

        # Extract author from URL
        post_match = re.match(r'https://www\.linkedin\.com/posts/([^_]+)_(.+?)(?:-activity|-\d)', clean)
        author = post_match.group(1).replace('-', ' ') if post_match else ''

        # Use search title if available, otherwise construct from URL
        title = search_title if search_title else (post_match.group(2).replace('-', ' ') if post_match else '')

        posts.append({
            "url": clean,
            "author": author,
            "title": title,
            "snippet": snippet[:200],
            "activity_id": activity_match.group(1),
        })

    return jsonify({"posts": posts, "query": keywords})


@app.route("/api/draft-message", methods=["POST"])
def draft_message():
    """Use Claude to draft a personalized outreach message."""
    data = request.get_json()
    # User's key takes priority, then env var, then config file
    api_key = data.get("api_key", "").strip()
    if not api_key:
        api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        try:
            with open("config.json", "r") as f:
                api_key = json.load(f).get("claude_api_key", "")
        except FileNotFoundError:
            pass
    if not api_key:
        return jsonify({"error": "No API key configured"}), 400

    lead_name = data.get("name", "")
    first_name = lead_name.split(" ")[0] if lead_name else ""
    headline = data.get("headline", "")
    comment = data.get("comment", "")
    post_title = data.get("post_title", "")
    instruction = data.get("instruction", "")
    current_draft = data.get("current_draft", "")

    if instruction and current_draft:
        # User wants to modify the existing draft
        prompt = f"""Here is a LinkedIn message draft:

"{current_draft}"

The user wants you to: {instruction}

Context about the recipient:
- Name: {lead_name}
- Headline: {headline}
{"- They commented: " + '"' + comment + '"' if comment else "- They liked a post about: " + post_title}

Rewrite the message following the user's instruction. Keep it under 300 characters. Output only the message, nothing else."""
    else:
        # Fresh draft — based on templates with 49-78% acceptance rates
        # Key insight: the best messages are SHORT, SIMPLE, and feel EFFORTLESS.
        # They don't try to be clever. They state one shared thing and move on.
        prompt = f"""Write a LinkedIn connection request to {lead_name}. Max 250 characters.

About them:
- Headline: {headline}
- Post topic: {post_title}
{"- Their comment: " + '"' + comment + '"' if comment else ""}

Here are REAL examples that get 60-78% acceptance rates. Pick a style that fits — DO NOT copy the same one every time. Vary your approach:

"Hey Sarah, since we're both in the GTM space, thought it'd be cool to connect."
"Hi Joe, your comment about collapsing silos, spot on. Would love to have you in my network."
"Hi Marcus, always good to connect with folks doing solid work at Gong."
"Hey Lisa, we're in the same world — would be great to connect."
"Hi David, your take on that GTM post matched what I've been seeing too. Let's connect."
"Hey Nina, noticed we're both deep in the sales ops world. Would be good to be connected."

Now write ONE message for {first_name}. IMPORTANT — vary the structure, don't always use the same pattern. Rules:
- Max 2 sentences, under 250 characters
- Mention ONE thing you have in common (industry, post, comment, role)
- End with "would be great to connect" or "thought it'd be cool to connect" or similar
- Do NOT ask questions
- Do NOT pitch anything
- Do NOT use words: resonated, insightful, curious, fascinating, intrigued, align, synergy, leverage
- Do NOT use em dashes (—). Use commas or periods instead
- Sound like you typed this in 5 seconds on your phone
- Output ONLY the message text, nothing else"""

    try:
        resp = http_requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-haiku-4-5-20251001",
                "max_tokens": 200,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=15,
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    if resp.status_code != 200:
        return jsonify({"error": f"Claude API error: {resp.status_code}"}), resp.status_code

    result = resp.json()
    message = result.get("content", [{}])[0].get("text", "")
    return jsonify({"message": message})


@app.route("/api/profile-info", methods=["POST"])
def profile_info():
    """Get basic profile info from a LinkedIn username."""
    cookies = get_cookies()
    if not cookies:
        return jsonify({"error": "No cookies"}), 400

    data = request.get_json()
    username = data.get("username", "").strip()
    if not username:
        return jsonify({"error": "No username"}), 400

    headers = {
        "accept": "application/vnd.linkedin.normalized+json+2.1",
        "csrf-token": cookies.get("JSESSIONID", "").strip('"'),
        "x-li-lang": "en_US",
        "x-restli-protocol-version": "2.0.0",
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    }

    try:
        url = f"https://www.linkedin.com/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity={username}"
        resp = http_requests.get(url, cookies=cookies, headers=headers, timeout=15, allow_redirects=False)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    if resp.status_code != 200:
        return jsonify({"error": "Could not fetch profile"}), 400

    result = resp.json()
    for item in result.get("included", []):
        if isinstance(item, dict) and item.get("firstName"):
            return jsonify({
                "name": f"{item.get('firstName', '')} {item.get('lastName', '')}",
                "headline": item.get("headline", ""),
            })

    return jsonify({"error": "Profile not found"}), 404


@app.route("/api/update-cookies", methods=["POST"])
def update_cookies():
    """Receive fresh LinkedIn cookies from the browser extension."""
    data = request.get_json()
    if not data or not data.get("li_at"):
        return jsonify({"error": "No li_at cookie"}), 400

    # Update cookies.json
    try:
        with open("cookies.json", "r") as f:
            existing = json.load(f)
    except FileNotFoundError:
        existing = {}

    existing.update(data)
    with open("cookies.json", "w") as f:
        json.dump(existing, f, indent=2)

    return jsonify({"status": "ok", "updated": len(data)})


@app.route("/api/status", methods=["GET"])
def status():
    cookies = get_cookies()
    return jsonify({
        "cookies_loaded": cookies is not None,
        "cookie_count": len(cookies) if cookies else 0,
    })


@app.route("/")
def index():
    return send_from_directory(parent_dir, "index.html")


@app.route("/<path:path>")
def static_files(path):
    # Don't serve paths starting with 'api'
    if path.startswith("api"):
        return jsonify({"error": "Not found"}), 404
    return send_from_directory(parent_dir, path)


if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5001))
    debug = os.environ.get("FLASK_DEBUG", "true").lower() == "true"
    print(f"Hawki starting on http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=debug)
