"""Prepare original Quality 30-day campaign media. Draft-only, no publishing."""
import argparse, datetime as dt, io, json, pathlib, zipfile
from PIL import Image
ROOT="QUALITY_30_DNI_7R_7P/"
BEGIN=dt.date(2026,10,12)
END=dt.date(2026,11,10)
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--zip",required=True)
    p.add_argument("--date",required=True)
    p.add_argument("--kind",choices=["post","reel"],required=True)
    p.add_argument("--output",default="quality-output")
    a=p.parse_args()
    date=dt.date.fromisoformat(a.date)
    if not BEGIN<=date<=END:
        raise SystemExit("BLOCKED: outside the campaign")
    with zipfile.ZipFile(a.zip) as z:
        schedule=json.loads(z.read(ROOT+"teksty/harmonogram_60_publikacji.json"))
        days=schedule["days"]
        assert len(days)==30,"Expected exactly 30 days"
        item=days[(date-BEGIN).days]
        assert item["data"]==a.date,"Date mismatch"
        assert item["post_godzina"]=="12:30" and item["rolka_godzina"]=="19:00"
        num=int(item["dzien"])
        dst=pathlib.Path(a.output)/a.date/a.kind
        dst.mkdir(parents=True,exist_ok=True)
        if a.kind=="post":
            sources=[f"karuzele/P{num:02d}_slajd_{i}.png" for i in range(1,5)] if item["post_format"]=="karuzela" else [item["post_graphic"]]
            outputs=[]
            for i,src in enumerate(sources,1):
                with Image.open(io.BytesIO(z.read(ROOT+src))) as im:
                    assert im.size==(1080,1350),"Image dimensions invalid"
                    filename=f"post_{i}.jpg"
                    im.convert("RGB").save(dst/filename,quality=92,optimize=True)
                    outputs.append(filename)
            caption=item["opis_posta"]
        else:
            filename="rolka_podglad_DRAFT.mp4"
            (dst/filename).write_bytes(z.read(ROOT+item["reel_video"]))
            (dst/"lektor_DRAFT.mp3").write_bytes(z.read(ROOT+item["audio_draft"]))
            (dst/"napisy_DRAFT.srt").write_bytes(z.read(ROOT+f"napisy_srt/R{num:02d}.srt"))
            outputs=[filename]
            caption=item["opis_rolki"]
        (dst/"opis.txt").write_text(caption,encoding="utf8")
        record={
            "id":("P" if a.kind=="post" else "R")+f"{num:02d}",
            "date":a.date,"hour":item["post_godzina"] if a.kind=="post" else item["rolka_godzina"],
            "timezone":"Europe/Warsaw","account":"@jem_bezpiecznie",
            "brand":"Quality Assurance Support","files":outputs,
            "source":item["zrodlo_link"],"source_context":item["zrodlo_temat"],
            "state":"BLOCKED_QA","published":False,"public_link":None,
            "qa":{"factual":False,"creative":False,"voice":False,"captions":False,"e2e":False},
            "paid_api_used":False
        }
        (dst/"manifest.json").write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding="utf8")
        print(json.dumps({"id":record["id"],"state":record["state"],"files":outputs},ensure_ascii=False))
if __name__=="__main__":main()
