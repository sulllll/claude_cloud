import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import fetch_trends  # noqa: E402

ITEM = """
<item>
  <title>{kw}</title>
  <ht:approx_traffic>{traffic}</ht:approx_traffic>
  <pubDate>Sat, 26 Sep 2026 14:00:00 +0900</pubDate>
  <ht:news_item>
    <ht:news_item_title>{kw} 관련 뉴스</ht:news_item_title>
    <ht:news_item_url>https://example.com/{i}</ht:news_item_url>
    <ht:news_item_source>Example</ht:news_item_source>
  </ht:news_item>
</item>"""


def sample_rss(n):
    items = "".join(ITEM.format(kw=f"키워드{i}", traffic=f"{i * 1000}+", i=i) for i in range(1, n + 1))
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:ht="https://trends.google.com/trending/rss" version="2.0">
<channel><title>Daily Search Trends</title>{items}</channel></rss>""".encode()


class ParseTest(unittest.TestCase):
    def test_top10_only(self):
        items = fetch_trends.parse_rss(sample_rss(15))
        self.assertEqual(len(items), 10)
        self.assertEqual([it["rank"] for it in items], list(range(1, 11)))

    def test_fields(self):
        first = fetch_trends.parse_rss(sample_rss(3))[0]
        self.assertEqual(first["keyword"], "키워드1")
        self.assertEqual(first["traffic"], "1000+")
        self.assertEqual(first["news_title"], "키워드1 관련 뉴스")
        self.assertEqual(first["news_url"], "https://example.com/1")
        self.assertIn("q=%ED%82%A4", first["search_url"])

    def test_save_stacks_history(self):
        import json
        import tempfile

        with tempfile.TemporaryDirectory() as d:
            fetch_trends.DATA_DIR = Path(d)
            for t in ["2026-09-26 13:00", "2026-09-26 14:00"]:
                fetch_trends.save({"collected_at": t, "geo": "KR", "items": fetch_trends.parse_rss(sample_rss(10))})
            history = json.loads((Path(d) / "history.json").read_text(encoding="utf-8"))
            self.assertEqual([h["collected_at"] for h in history], ["2026-09-26 14:00", "2026-09-26 13:00"])
            rows = (Path(d) / "history.csv").read_text(encoding="utf-8").strip().splitlines()
            self.assertEqual(len(rows), 1 + 20)


if __name__ == "__main__":
    unittest.main()
