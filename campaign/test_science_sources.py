"""Offline structural tests; never claim that these validate factual accuracy."""
import unittest
import xml.etree.ElementTree as ET
from science_sources import assess_article, section_presence, license_name, search_url, API

JATS = b"""<article xmlns:xlink="http://www.w3.org/1999/xlink">
<front><article-meta><permissions><license xlink:href="https://creativecommons.org/licenses/by/4.0/"/></permissions></article-meta></front>
<body><sec><title>Materials and Methods</title><p>Test methods.</p></sec>
<sec><title>Results</title><p>Test result.</p></sec>
<sec><title>Limitations</title><p>Test limitations.</p></sec>
<sec><title>Conclusions</title><p>Test conclusions.</p></sec></body>
</article>"""

class SourcesTest(unittest.TestCase):
    def test_api_allowlist_and_query(self):
        url = search_url()
        self.assertTrue(url.startswith(API))
        self.assertIn("OPEN_ACCESS", url)
        self.assertIn("resultType=core", url)
    def test_section_detection(self):
        self.assertEqual(section_presence(ET.fromstring(JATS)), ["conclusions", "discussion", "methods", "results"])
    def test_license_is_in_metadata_but_does_not_approve_post(self):
        r = assess_article({"pmcid":"PMC123456","doi":"10.1000/test","title":"Example",
                            "isOpenAccess":"Y","inEPMC":"Y"}, JATS)
        self.assertTrue(r["full_text_readable"])
        self.assertEqual(r["full_text_license"],"https://creativecommons.org/licenses/by/4.0/")
        self.assertFalse(r["is_peer_reviewed"])
        self.assertFalse(r["publication_approved"])
        self.assertEqual(r["status"],"FULL_TEXT_FOUND_REVIEW_REQUIRED")
    def test_no_fulltext_is_blocked(self):
        r = assess_article({"pmcid":"PMC1","isOpenAccess":"Y"}, None)
        self.assertFalse(r["full_text_readable"])
        self.assertFalse(r["publication_approved"])

if __name__=="__main__":
    unittest.main()
