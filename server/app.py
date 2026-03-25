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
CORS(app)

COOKIES = None


def get_cookies():
    # Always reload from file to pick up fresh cookies
    try:
        return load_cookies("cookies.json")
    except FileNotFoundError:
        return None


@app.route("/api/scrape", methods=["POST"])
def scrape():
    cookies = get_cookies()
    if not cookies:
        return jsonify({"error": "No cookies.json found. Export your LinkedIn cookies first."}), 400

    data = request.get_json()
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
    # User's key takes priority, then server config
    api_key = data.get("api_key", "").strip()
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
        # Fresh draft
        prompt = f"""Write a short LinkedIn connection message (2-3 sentences max) from a GTM professional to {lead_name}.

Context:
- Their headline: {headline}
- They engaged with a post about: {post_title}
{"- They commented: " + '"' + comment + '"' if comment else "- They liked the post"}

Rules:
- Start with "Hi {first_name},"
- Reference the post or their comment specifically
- Be friendly and professional
- End with a soft CTA (connect, chat, share ideas)
- No emojis, no buzzwords, no "I'd love to pick your brain"
- Sound human, not automated
- Keep it under 300 characters"""

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
    print("GTM Runner starting on http://localhost:5001")
    print("Make sure cookies.json exists in the server/ directory")
    app.run(port=5001, debug=True)
