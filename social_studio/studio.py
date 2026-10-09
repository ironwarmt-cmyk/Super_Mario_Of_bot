"""Jem Bezpiecznie: offline free draft studio. No paid APIs or publishing."""
import argparse
import datetime as dt
import json
import subprocess
from pathlib import Path
from zoneinfo import ZoneInfo

from PIL import Image, ImageDraw, ImageFont

BASE = Path(__file__).resolve().parent
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

def f(size, bold=False):
    return ImageFont.truetype(BOLD if bold else FONT, size)

def topics():
    ts = json.loads((BASE / "topics.json").read_text("utf8"))
    assert len(ts) >= 14 and len({x["slug"] for x in ts}) == len(ts)
    assert all(x["source"].startswith("https://") for x in ts)
    return ts

def get(date):
    ts = topics()
    return ts[(date.toordinal() - 1) % len(ts)]

def wrap(draw, txt, font, width):
    result = []
    buf = ""
    for word in txt.split():
        candidate = (buf + " " + word).strip()
        if draw.textbbox((0, 0), candidate, font=font)[2] <= width:
            buf = candidate
        else:
            if buf:
                result.append(buf)
            buf = word
    if buf:
        result.append(buf)
    return result

def card(t, size, page):
    w, h = size
    s = w / 1080
    I = Image.new("RGB", (w, h), (7, 25, 40))
    d = ImageDraw.Draw(I)
    for y in range(h):
        z = y / h
        d.line((0, y, w, y), fill=(int(7 + 9*z), int(25 + 26*z), int(40 + 34*z)))
    px = lambda n: round(n*s)
    d.rounded_rectangle((px(60), px(54), px(520), px(146)), radius=px(28), fill="#133D4B")
    d.text((px(80), px(80)), "JEM BEZPIECZNIE", font=f(px(33), True), fill="#B8FA68")
    d.text((px(62), px(210)), "WIEDZA  •  JAKOŚĆ  •  BEZPIECZEŃSTWO", font=f(px(22)), fill="#B7CDD8")
    labels = ["CO WARTO WIEDZIEĆ?", "CO MÓWIĄ ZASADY?", "JAK TO WYKORZYSTAĆ?"]
    texts = [t["title"], t["fact"], t["tip"]]
    d.text((px(62), px(328)), labels[page], font=f(px(34), True), fill="#B8FA68")
    heading_font = f(px(69 if page != 1 else 54), True)
    for n, ln in enumerate(wrap(d, texts[page], heading_font, w-px(124))[:8]):
        d.text((px(63), px(435 + (88 if page != 1 else 73)*n)), ln,
               font=heading_font, fill="white")
    d.arc((px(420), int(h*.55), px(1150), int(h*.55)+px(680)),
          10, 310, fill="#4E9CAE", width=px(11))
    d.arc((px(520), int(h*.58), px(1080), int(h*.58)+px(510)),
          30, 335, fill="#B8FA68", width=px(7))
    y = h-px(410)
    d.rounded_rectangle((px(62), y, w-px(62), y+px(140)),
                        radius=px(32), fill="#124454")
    footer = t["hook"] if page == 0 else "Więcej wiedzy w aplikacji Jem Bezpiecznie"
    for n, ln in enumerate(wrap(d, footer, f(px(31)), w-px(166))[:3]):
        d.text((px(82), y+px(26+42*n)), ln, font=f(px(31)), fill="#D1E1E9")
    d.line((px(62), h-px(145), w-px(62), h-px(145)), fill="#5A94A0", width=px(3))
    d.text((px(64), h-px(127)), "@jem_bezpiecznie",
           font=f(px(32), True), fill="white")
    d.text((px(64), h-px(74)), f"{page+1}/3  •  Źródło w opisie",
           font=f(px(25)), fill="#C0D0D9")
    return I

def render(date, kind, preview=False):
    config = json.loads((BASE / "config.json").read_text("utf8"))
    if config["publishing_enabled"] or config["max_paid_api_spend_usd"] != 0:
        raise RuntimeError("Paid API or publishing must remain disabled during pilot")
    t = get(date)
    folder = BASE / "output" / f"{date.isoformat()}-{kind}"
    folder.mkdir(parents=True, exist_ok=True)
    if kind == "carousel":
        size = (360, 450) if preview else (1080, 1350)
        for n in range(3):
            card(t, size, n).save(folder / f"carousel_{n+1}.jpg", quality=90)
        artifacts = [f"carousel_{n+1}.jpg" for n in range(3)]
    elif kind == "reel":
        size = (360, 640) if preview else (1080, 1920)
        for n in range(3):
            card(t, size, n).save(folder / f"slide_{n+1}.png")
        cmd = ["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y"]
        for n in range(3):
            cmd += ["-loop", "1", "-framerate", "25", "-t", "6",
                    "-i", str(folder / f"slide_{n+1}.png")]
        filters = ";".join(
            f"[{n}:v]fps=25,format=yuv420p,setpts=PTS-STARTPTS[v{n}]"
            for n in range(3)
        ) + ";[v0][v1][v2]concat=n=3:v=1:a=0[v]"
        subprocess.run(cmd+["-filter_complex", filters, "-map", "[v]",
                 "-c:v", "libx264", "-preset", "ultrafast", "-crf", "26",
                 "-movflags", "+faststart", str(folder / "reel.mp4")],
                 check=True, timeout=300)
        artifacts = ["reel.mp4"]
    else:
        raise ValueError(kind)
    caption = (f"{t['hook']}\n\n{t['fact']}\n\n{t['tip']}\n\n"
               f"Źródło: {t['source']}\n\n"
               f"Poznaj aplikację: {config['app_url']}\n\n"
               "#JemBezpiecznie #FoodSafety #BezpieczeństwoŻywności")
    manifest = {
        "date": date.isoformat(),
        "topic": t["slug"], "kind": kind, "files": artifacts,
        "caption": caption, "source_url": t["source"],
        "status": "READY_FOR_QA", "publisher": "DISABLED",
        "source_check": "editorially_curated_reference_not_live_article_verification",
        "video_quality": "3_card_template_no_neural_voice",
        "paid_api_cost_usd": 0
    }
    (folder / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), "utf8"
    )
    print(json.dumps({
        "ok": True, "material": kind, "topic": t["slug"],
        "file_count": len(artifacts), "publishing": "DISABLED",
        "paid_cost_usd": 0
    }, ensure_ascii=False))
    return folder

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--kind", required=True, choices=["carousel", "reel"])
    p.add_argument("--date")
    p.add_argument("--preview", action="store_true")
    a = p.parse_args()
    date = dt.date.fromisoformat(a.date) if a.date else dt.datetime.now(
        ZoneInfo("Europe/Warsaw")
    ).date()
    render(date, a.kind, a.preview)

if __name__ == "__main__":
    main()
