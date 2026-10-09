"""Discover fresh official EFSA topics. Research leads are NOT validated factual claims."""
from __future__ import annotations
import datetime as dt
import hashlib
import html
import json
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

FEED = "https://www.efsa.europa.eu/en/press/rss"
OUT = Path(__file__).parent / "output" / "research_candidates.json"
ALLOW = {"efsa.europa.eu", "www.efsa.europa.eu"}
TOPIC_WORDS = ("food", "safety", "pesticid", "allergen", "bacter",
               "nutrition", "contamin", "listeria", "salmonella",
               "packaging", "microplastic", "consumer", "chemical", "risk",
               "additive", "healthy", "mycotoxin", "feed", "science")

def clean(s):
    return re.sub(r"\\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s or ""))).strip()

def allowed_url(s):
    try:
        u = urllib.parse.urlparse(s)
        return u.scheme == "https" and u.hostname in ALLOW
    except ValueError:
        return False

def parse_feed(payload):
    root = ET.fromstring(payload)
    result=[]
    for item in root.findall(".//item"):
        title = clean(item.findtext("title", ""))[:220]
        url = (item.findtext("link", "") or "").strip()
        pub = clean(item.findtext("pubDate",""))[:70]
        if title and allowed_url(url) and any(word in title.casefold() for word in TOPIC_WORDS):
            result.append({"title_original":title,"url":url,"published":pub,
                           "source":"EFSA","status":"DISCOVERED_NEEDS_FACT_CHECK",
                           "hash":hashlib.sha256(url.encode("utf8")).hexdigest()[:20]})
    ns="{http://www.w3.org/2005/Atom}"
    for item in root.findall(".//"+ns+"entry"):
        title=clean(item.findtext(ns+"title", ""))[:220]
        link=item.find(ns+"link")
        url=link.attrib.get("href","") if link is not None else ""
        pub=clean(item.findtext(ns+"published","") or item.findtext(ns+"updated",""))[:70]
        if title and allowed_url(url) and any(word in title.casefold() for word in TOPIC_WORDS):
            result.append({"title_original":title,"url":url,"published":pub,
                           "source":"EFSA","status":"DISCOVERED_NEEDS_FACT_CHECK",
                           "hash":hashlib.sha256(url.encode("utf8")).hexdigest()[:20]})
    return list({x["hash"]:x for x in result}.values())[:15]

def run():
    OUT.parent.mkdir(parents=True,exist_ok=True)
    result={"checked_at_utc":dt.datetime.now(dt.timezone.utc).isoformat(),
            "source":FEED,"status":"SOURCE_ERROR","candidates":[],"error":None,
            "warning":"A title/link is not verification; do not publish scientific claims from this output."}
    try:
        req=urllib.request.Request(FEED,headers={"User-Agent":"JemBezpiecznieResearch/1.0"})
        with urllib.request.urlopen(req,timeout=15) as resp:
            data=resp.read(1000001)
        if len(data)>1000000:
            raise ValueError("EFSA feed exceeded 1 MB")
        result["candidates"]=parse_feed(data)
        result["status"]="OK"
    except (OSError, ET.ParseError, ValueError) as ex:
        result["error"]=type(ex).__name__ + ": " + str(ex)[:180]
    OUT.write_text(json.dumps(result,ensure_ascii=False,indent=2),"utf8")
    print(json.dumps({"discovery":result["status"],"candidates":len(result["candidates"])},ensure_ascii=False))

if __name__ == "__main__":
    run()
