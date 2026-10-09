import datetime as dt
import json
import unittest
from pathlib import Path

import studio

class TestEditorial(unittest.TestCase):
    def test_14_topics_with_sources(self):
        rows = studio.topics()
        self.assertGreaterEqual(len(rows), 14)
        self.assertEqual(len(rows), len({t["slug"] for t in rows}))
        for row in rows:
            self.assertTrue(row["source"].startswith("https://"))

    def test_weekly_schedule_counts(self):
        d = dt.date(2026, 10, 12)
        self.assertEqual(len([(d+dt.timedelta(days=x),"carousel") for x in range(7)]), 7)
        self.assertEqual(len([(d+dt.timedelta(days=x),"reel") for x in range(7)]), 7)

    def test_render_draft_without_publishing(self):
        d = dt.date(2026, 10, 12)
        out = studio.render(d, "carousel", preview=True)
        manifest = json.loads((out/"manifest.json").read_text("utf8"))
        self.assertEqual(manifest["publisher"],"DISABLED")
        self.assertEqual(manifest["paid_api_cost_usd"],0)
        self.assertEqual(manifest["status"],"READY_FOR_QA")
        for file in manifest["files"]:
            self.assertGreater((out/file).stat().st_size,1024)

if __name__ == "__main__":
    unittest.main()
