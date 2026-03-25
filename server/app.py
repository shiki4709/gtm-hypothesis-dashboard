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
