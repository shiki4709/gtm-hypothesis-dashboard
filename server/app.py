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
    """Search for LinkedIn posts by keyword using web search."""
    import re
    data = request.get_json()
    keywords = data.get("keywords", "").strip()
    if not keywords:
        return jsonify({"error": "No keywords provided"}), 400

    query = f"site:linkedin.com/posts/ {keywords}"
    search_url = f"https://search.brave.com/search?q={http_requests.utils.quote(query)}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html",
    }

    try:
        resp = http_requests.get(search_url, headers=headers, timeout=15)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    # Extract LinkedIn post URLs (Brave uses relative URLs without https://)
    raw_urls = re.findall(r'linkedin\.com/posts/([^\s"<>]+activity-\d+[^\s"<>]*)', resp.text)
    urls = [f"https://www.linkedin.com/posts/{u}" for u in raw_urls]

    # Dedupe and clean
    seen = set()
    posts = []
    for url in urls:
        # Clean URL - remove tracking params
        clean = re.sub(r'[?&](utm_\w+|trk|rcm)=[^&]*', '', url).rstrip('&?')
        # Extract activity ID
        activity_match = re.search(r'activity-(\d+)', clean)
        if not activity_match or activity_match.group(1) in seen:
            continue
        seen.add(activity_match.group(1))

        # Extract author and title from URL
        post_match = re.match(r'https://www\.linkedin\.com/posts/([^_]+)_(.+?)(?:-activity|-\d)', clean)
        author = post_match.group(1).replace('-', ' ') if post_match else ''
        title = post_match.group(2).replace('-', ' ') if post_match else ''

        posts.append({
            "url": clean,
            "author": author,
            "title": title,
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
