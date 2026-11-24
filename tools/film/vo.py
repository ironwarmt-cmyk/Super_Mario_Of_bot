"""Lektor do filmu dla testerów-influencerów (tools/film/vo.json) przez /api/jb-tts. Każde zdanie osobno – dokładny podział na sceny.
Logowanie: token OIDC GitHub Actions. Wynik: tools/ads/out/<reklama>-<nr>.wav (artefakt). Autor: MT"""
import base64, json, os, sys, time, urllib.request

def oidc():
    req = urllib.request.Request(os.environ["ACTIONS_ID_TOKEN_REQUEST_URL"] + "&audience=jb-tiktok-vo",
                                 headers={"Authorization": "Bearer " + os.environ["ACTIONS_ID_TOKEN_REQUEST_TOKEN"]})
    return json.load(urllib.request.urlopen(req, timeout=30))["value"]

cfg = json.load(open(os.path.join(os.path.dirname(__file__), "vo.json"), encoding="utf-8"))
out = os.path.join(os.path.dirname(__file__), "out"); os.makedirs(out, exist_ok=True)
tok = oidc(); fails = 0; log = []
for ad in cfg["ads"]:
    for i, line in enumerate(ad["lines"], 1):
        body = json.dumps({"text": line, "voice": ad["voice"], "instructions": cfg["style"]}).encode()
        for attempt in range(3):
            try:
                req = urllib.request.Request("https://qasupport.jembezpiecznie.com/api/jb-tts", data=body, method="POST",
                                             headers={"Authorization": "Bearer " + tok, "Content-Type": "application/json"})
                d = json.load(urllib.request.urlopen(req, timeout=120))
                raw = base64.b64decode(d["audio"])
                ext = "wav" if raw[:4] == b"RIFF" else "pcm"
                open(os.path.join(out, f"{ad['id']}-{i}.{ext}"), "wb").write(raw)
                log.append(f"{ad['id']}-{i} {d.get('model')} {len(raw)}")
                break
            except Exception as e:
                err = getattr(e, "read", lambda: b"")().decode(errors="ignore")[:300]
                log.append(f"{ad['id']}-{i} błąd {e} {err}")
                time.sleep(8)
        else:
            fails += 1
open(os.path.join(out, "log.txt"), "w").write("\n".join(log))
print("\n".join(log))
sys.exit(1 if fails else 0)
