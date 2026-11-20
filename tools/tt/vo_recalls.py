"""Dorabia polskiego lektora do filmików wycofań (tt_video) i wysyła je do Supabase. Uruchamiane w GitHub Actions. Autor: MT
Logowanie: token OIDC GitHub Actions (bez haseł i sekretów), sprawdzany w funkcji tiktok-autopost."""
import base64, json, os, sys, tempfile, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
from vo import voiceover

FN = "https://ixivedtgqgryawxsxnqd.supabase.co/functions/v1/tiktok-autopost"


def oidc():
    req = urllib.request.Request(os.environ["ACTIONS_ID_TOKEN_REQUEST_URL"] + "&audience=jb-tiktok-vo",
                                 headers={"Authorization": "Bearer " + os.environ["ACTIONS_ID_TOKEN_REQUEST_TOKEN"]})
    return json.load(urllib.request.urlopen(req))["value"]


def call(tok, body):
    req = urllib.request.Request(FN, data=json.dumps(body).encode(), method="POST",
                                 headers={"content-type": "application/json", "authorization": "Bearer " + tok})
    try:
        return json.load(urllib.request.urlopen(req, timeout=120))
    except urllib.error.HTTPError as e:
        return {"ok": False, "error": f"{e.code} {e.read()[:300]!r}"}


def script(it):
    parts = [f"Uwaga, wycofanie produktu. {it['title']}."]
    if it.get("todo"):
        parts.append(f"Co zrobić: {it['todo']}.")
    parts.append("Wszystkie ostrzeżenia znajdziesz na jem bezpiecznie kropka kom.")
    return " ".join(parts)


tok = oidc()
pending = call(tok, {"mode": "vo_pending"})
print("pending:", len(pending.get("items", [])), pending.get("error", ""))
for it in pending.get("items", []):
    with tempfile.TemporaryDirectory() as tmp:
        src, out = os.path.join(tmp, "in.mp4"), os.path.join(tmp, "out.mp4")
        urllib.request.urlretrieve(it["video"], src)
        info = voiceover(src, script(it), out, "Charon", max_extend=8)
        b64 = base64.b64encode(open(out, "rb").read()).decode()
        r = call(oidc(), {"mode": "vo_upload", "id": it["id"], "b64": b64})
        print(it["id"], info["engine"], info["seconds"], "s", r)
