"""Wersje filmów z planu 30-dniowego z polskim lektorem dla TikToka -> public/tt/plan-dNN.mp4. Autor: MT"""
import json, os, re, sys, tempfile, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
from vo import voiceover

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
STORE = "https://ixivedtgqgryawxsxnqd.supabase.co/storage/v1/object/public/ig"
plan = json.load(open(os.path.join(ROOT, "public/ig/plan.json")))
out_dir = os.path.join(ROOT, "public/tt"); os.makedirs(out_dir, exist_ok=True)
only = set(int(x) for x in sys.argv[1:])
manifest = {}
for p in plan["posts"]:
    d = p["day"]
    if only and d not in only:
        continue
    if p["type"] == "reel":
        src = os.path.join(ROOT, "public", p["video_url"].split("jembezpiecznie.com/", 1)[1])
    else:
        src = tempfile.mktemp(suffix=".mp4")
        urllib.request.urlretrieve(f"{STORE}/tiktok/plan-d{d:02d}.mp4", src)
    cap = p["caption"]
    voice = "Puck" if "/app-" in (p.get("video_url") or "") else "Charon" if re.search(r"QASUPPORT|dział jakości|HACCP|audyt", cap, re.I) else "Kore"
    info = voiceover(src, cap, os.path.join(out_dir, f"plan-d{d:02d}.mp4"), voice)
    manifest[d] = info
    print(d, info["voice"], info["engine"], info["seconds"], info["script"][:90], flush=True)
json.dump(manifest, open(os.path.join(out_dir, "manifest.json"), "w"), ensure_ascii=False, indent=1)
