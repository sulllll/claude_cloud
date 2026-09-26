"""Fetch Google Trends top 10 (Korea) and stack the snapshot into history files.

Outputs (under site/data/):
  latest.json   - the most recent snapshot
  history.json  - every snapshot, newest first
  history.csv   - one row per keyword per snapshot (append-only)

If GOOGLE_SERVICE_ACCOUNT_JSON is set, the same rows are appended to the
Google Sheet given by SHEET_ID.
"""

import csv
import json
import os
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path

GEO = os.environ.get("TRENDS_GEO", "KR")
RSS_URL = f"https://trends.google.com/trending/rss?geo={GEO}"
TOP_N = 10
KST = timezone(timedelta(hours=9))

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "site" / "data"
CSV_HEADER = ["collected_at", "rank", "keyword", "traffic", "news_title", "news_url"]


def local(tag):
    """Strip the XML namespace so we don't depend on the exact ht: URI."""
    return tag.rsplit("}", 1)[-1]


def child_text(elem, name):
    for c in elem:
        if local(c.tag) == name:
            return (c.text or "").strip()
    return ""


def parse_rss(xml_bytes):
    root = ET.fromstring(xml_bytes)
    items = []
    for item in root.iter():
        if local(item.tag) != "item":
            continue
        news = next((c for c in item if local(c.tag) == "news_item"), None)
        keyword = child_text(item, "title")
        items.append({
            "rank": len(items) + 1,
            "keyword": keyword,
            "traffic": child_text(item, "approx_traffic"),
            "news_title": child_text(news, "news_item_title") if news is not None else "",
            "news_url": child_text(news, "news_item_url") if news is not None else "",
            "search_url": "https://www.google.com/search?q=" + urllib.request.quote(keyword),
        })
        if len(items) == TOP_N:
            break
    return items


def fetch():
    req = urllib.request.Request(RSS_URL, headers={"User-Agent": "Mozilla/5.0 (trends-bot)"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def save(snapshot):
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    (DATA_DIR / "latest.json").write_text(json.dumps(snapshot, ensure_ascii=False, indent=2), encoding="utf-8")

    history_path = DATA_DIR / "history.json"
    history = json.loads(history_path.read_text(encoding="utf-8")) if history_path.exists() else []
    history.insert(0, snapshot)
    history_path.write_text(json.dumps(history, ensure_ascii=False), encoding="utf-8")

    csv_path = DATA_DIR / "history.csv"
    new_file = not csv_path.exists()
    with csv_path.open("a", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        if new_file:
            w.writerow(CSV_HEADER)
        for it in snapshot["items"]:
            w.writerow([snapshot["collected_at"], it["rank"], it["keyword"], it["traffic"], it["news_title"], it["news_url"]])


def append_to_sheet(snapshot):
    creds = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
    sheet_id = os.environ.get("SHEET_ID")
    if not creds or not sheet_id:
        print("Google Sheet: secret not set, skipping")
        return
    import gspread  # installed by the workflow only when the secret exists

    gc = gspread.service_account_from_dict(json.loads(creds))
    ws = gc.open_by_key(sheet_id).sheet1
    if not ws.row_values(1):
        ws.append_row(CSV_HEADER)
    rows = [[snapshot["collected_at"], it["rank"], it["keyword"], it["traffic"], it["news_title"], it["news_url"]]
            for it in snapshot["items"]]
    ws.append_rows(rows, value_input_option="USER_ENTERED")
    print(f"Google Sheet: appended {len(rows)} rows")


def main():
    items = parse_rss(fetch())
    if not items:
        sys.exit("No trend items parsed from RSS")
    snapshot = {
        "collected_at": datetime.now(KST).strftime("%Y-%m-%d %H:%M"),
        "geo": GEO,
        "items": items,
    }
    save(snapshot)
    print(json.dumps(snapshot, ensure_ascii=False, indent=2))
    try:
        append_to_sheet(snapshot)
    except Exception as e:  # the site update must not be lost because of the sheet
        print(f"::warning::Google Sheet append failed: {e}")


if __name__ == "__main__":
    main()
