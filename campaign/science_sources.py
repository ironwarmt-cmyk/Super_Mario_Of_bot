"""Discover peer-reviewed open-access original research. No automatic posting.

Records metadata and checks availability of full texts; scientific assertions
must still be independently reviewed against the full publication.
"""
import datetime as dt
import json
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

API = "https://www.ebi.ac.uk/europepmc/webservices/rest/"
OUT = Path(__file__).resolve().parent / "output" / "science_candidates.json"
QUERY = (
    '(TITLE_ABS:"food safety" OR TITLE_ABS:"foodborne pathogens" OR '
    'TITLE_ABS:"food contamination" OR TITLE_ABS:"food allergen" OR '
    'TITLE_ABS:"food microbiology") AND OPEN_ACCESS:Y AND IN_EPMC:Y '
    'AND (SRC:MED OR SRC:PMC) AND NOT PUB_TYPE:"preprint"'
)
SECTIONS = {"methods": ("methods", "materials and methods", "methodology", "study design"),
            "results": ("results", "findings"),
            "discussion": ("discussion", "limitations"),
            "conclusions": ("conclusions", "conclusion")}
MAX_RESULTS = 10
MAX_BYTES = 1_500_000
USER_AGENT = "JemBezpiecznieScienceReader/0.1 (+original-synthesis; no republishing)"

def request(url: str, size=MAX_BYTES):
    if not url.startswith(API):
        raise ValueError("Source not on allowlisted Europe PMC API")
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=20) as response:
        payload = response.read(size + 1)
    if len(payload) > size:
        raise ValueError("Source exceeded size limit")
    return payload

def search_url():
    query = urllib.parse.urlencode({"query": QUERY, "format": "json",
                                    "resultType": "core", "pageSize": "20",
                                    "sort": "FIRST_PDATE_D desc"})
    return API + "search?" + query

def xml_local(tag):
    return str(tag).split("}")[-1].lower()

def section_presence(root):
    found = set()
    for sec in root.iter():
        if xml_local(sec.tag) != "sec":
            continue
        for child in sec:
            if xml_local(child.tag) == "title":
                heading = " ".join(child.itertext()).strip().lower()
                for name, variants in SECTIONS.items():
                    if any(heading.startswith(v) for v in variants):
                        found.add(name)
                break
    return sorted(found)

def license_name(root):
    for el in root.iter():
        if xml_local(el.tag) == "license":
            return (el.attrib.get("{http://www.w3.org/1999/xlink}href")
                    or el.attrib.get("href")
                    or "unspecified-license")
    return "license-not-found"

def assess_article(entry, xml_payload=None):
    pmcid = entry.get("pmcid", "")
    doi = entry.get("doi", "")
    record = {
        "title": entry.get("title", ""),
        "authors": entry.get("authorString", ""),
        "journal": entry.get("journalTitle", ""),
        "publication_date": entry.get("firstPublicationDate", ""),
        "doi": doi,
        "pmcid": pmcid,
        "source_url": "https://europepmc.org/articles/" + pmcid if pmcid else "",
        "doi_url": "https://doi.org/" + urllib.parse.quote(doi, safe="/-._") if doi else None,
        "is_open_access": entry.get("isOpenAccess") == "Y",
        "is_peer_reviewed": False,  # Do not infer from presence in index
        "full_text_readable": False,
        "full_text_sections": [],
        "full_text_license": "unverified",
        "status": "NEEDS_FULL_TEXT_AND_FACT_QA",
        "publication_approved": False,
        "reason": "Full article, methods, results and limits require review"
    }
    if xml_payload:
        root = ET.fromstring(xml_payload)
        record["full_text_readable"] = True
        record["full_text_sections"] = section_presence(root)
        record["full_text_license"] = license_name(root)
        record["status"] = "FULL_TEXT_FOUND_REVIEW_REQUIRED"
        record["reason"] = "Full text located; scientific analysis and original Polish synthesis not yet verified"
    return record

def collect():
    response = json.loads(request(search_url()).decode("utf8"))
    items = response.get("resultList", {}).get("result", [])
    result = []
    seen = set()
    for entry in items:
        if len(result) >= MAX_RESULTS:
            break
        pmcid = entry.get("pmcid", "")
        if not re.fullmatch(r"PMC[0-9]+", pmcid or ""):
            continue
        if entry.get("isOpenAccess") != "Y" or entry.get("inEPMC") != "Y":
            continue
        key = entry.get("doi") or pmcid
        if key in seen:
            continue
        seen.add(key)
        try:
            fulltext = request(API + pmcid + "/fullTextXML")
            result.append(assess_article(entry, fulltext))
        except (OSError, ValueError, ET.ParseError):
            result.append(assess_article(entry))
    return {"source": "Europe PMC (EMBL-EBI)",
            "queried_at_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
            "searched": len(items), "candidates": result,
            "all_items_unapproved": True,
            "notice": "Index metadata and automatic section detection are NOT scientific fact checking."}

def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    try:
        output = collect()
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        output = {"candidates": [], "all_items_unapproved": True,
                  "source": "Europe PMC", "status": "SOURCE_FAILED",
                  "error": type(exc).__name__ + ": " + str(exc)[:200]}
    OUT.write_text(json.dumps(output, ensure_ascii=False, indent=2), "utf8")
    print(json.dumps({"count": len(output["candidates"]),
                      "all_items_unapproved": output["all_items_unapproved"],
                      "status": output.get("status", "DISCOVERED_FOR_REVIEW")}, ensure_ascii=False))
    if output.get("status") == "SOURCE_FAILED":
        sys.exit(1)

if __name__ == "__main__":
    main()
