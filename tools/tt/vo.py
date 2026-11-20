"""Polski lektor do filmów TikToka (darmowe głosy Piper, open source). Autor: MT

Użycie jako moduł:  voiceover(video_in, tekst, video_out, voice="gosia")
Głosy: gosia (kobiecy), darkman (męski), mc_speech (męski) – pliki .onnx w katalogu PIPER_VOICES.
"""
import json, os, re, subprocess, tempfile

VOICES = os.environ.get("PIPER_VOICES", os.path.join(os.path.dirname(__file__), "voices"))
VOICE_FILES = {"gosia": "pl_PL-gosia-medium", "darkman": "pl_PL-darkman-medium", "mc_speech": "pl_PL-mc_speech-medium"}
WPS = 2.3  # słowa na sekundę dla głosów Piper przy length_scale 0.95

SAY = [
    (r"(https?://)?(www\.)?app\.jembezpiecznie\.com/?", "aplikacja jem bezpiecznie"),
    (r"(https?://)?qasupport\.jembezpiecznie\.com/?\S*", "Kju Ej Saport na jem bezpiecznie kropka kom"),
    (r"(https?://)?(www\.)?jembezpiecznie\.com/?\S*", "jem bezpiecznie kropka kom"),
    (r"\bQA ?SUPPORT\b|\bQASupport\b|\bQA Support\b", "Kju Ej Saport"),
    (r"\bHACCP\b", "hasap"), (r"\bBRCGS\b", "B R C G S"), (r"\bIFS\b", "I F S"), (r"\bCAPA\b", "kapa"),
    (r"\bGIS\b", "GIS"), (r"\bVIP\b", "wip"), (r"\bPRO\b", "pro"), (r"\bFREE\b", "fri"), (r"\bBASIC\b", "bejzik"),
    (r"\(link w bio\)|link w bio", "link w bio"), (r"→", ","), (r"·", ","), (r"\bzł\b", "złotych"),
]


def narration(text: str, max_seconds: float) -> str:
    t = re.sub(r"#\S+", "", text or "")
    t = re.sub(r"[\U0001F000-\U0001FAFF☀-➿️‍]", "", t)
    for a, b in SAY:
        t = re.sub(a, b, t, flags=re.I)
    t = re.sub(r"[„”\"*_]", "", t)
    lines = [l.strip(" -▪•:") for l in t.splitlines() if l.strip(" -▪•:")]
    t = " ".join(l if re.search(r"[.!?…:]$", l) else l + "." for l in lines)
    sentences = re.split(r"(?<=[.!?…])\s+", re.sub(r"\s+", " ", t).strip())
    out, words, limit = [], 0, max(6, int(max_seconds * WPS))
    for s in sentences:
        n = len(s.split())
        if out and words + n > limit:
            break
        if not out and n > limit:  # za długie pierwsze zdanie – utnij na przecinku
            s = " ".join(s.split()[:limit]).rstrip(",;") + "."
            n = limit
        out.append(s); words += n
    return " ".join(out)


def _dur(path: str) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], capture_output=True, text=True)
    return float(r.stdout.strip() or 0)


def _has_audio(path: str) -> bool:
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", path], capture_output=True, text=True)
    return bool(r.stdout.strip())


def tts(text: str, wav: str, voice: str = "gosia"):
    model = os.path.join(VOICES, VOICE_FILES[voice] + ".onnx")
    subprocess.run(["python3", "-m", "piper", "-m", model, "-f", wav, "--length-scale", "0.95", "--sentence-silence", "0.25"], input=text, text=True, check=True, capture_output=True)


def voiceover(video_in: str, text: str, video_out: str, voice: str = "gosia", max_extend: float = 6.0) -> dict:
    """Dodaje lektora; muzyka filmu zostaje cicho w tle. Gdy lektor jest dłuższy, ostatnia klatka trwa dłużej."""
    vdur = _dur(video_in)
    script = narration(text, vdur + max_extend - 1.2)
    with tempfile.TemporaryDirectory() as tmp:
        wav = os.path.join(tmp, "vo.wav")
        tts(script, wav, voice)
        adur = _dur(wav)
        total = max(vdur, adur + 1.2)
        pad = max(0.0, total - vdur)
        vf = f"tpad=stop_mode=clone:stop_duration={pad:.2f}" if pad > 0.05 else "null"
        if _has_audio(video_in):
            af = (f"[0:a]apad,atrim=0:{total:.2f},volume=0.22[m];[1:a]adelay=400|400,apad,atrim=0:{total:.2f},volume=1.35[v];"
                  f"[m][v]amix=inputs=2:duration=first:normalize=0,afade=t=out:st={max(0, total - 0.8):.2f}:d=0.8[a]")
        else:
            af = f"[1:a]adelay=400|400,apad,atrim=0:{total:.2f},volume=1.35[a]"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", video_in, "-i", wav, "-filter_complex", f"[0:v]{vf}[vv];{af}",
                        "-map", "[vv]", "-map", "[a]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p",
                        "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", video_out], check=True)
    return {"voice": voice, "script": script, "seconds": round(total, 1)}


if __name__ == "__main__":
    import sys
    print(json.dumps(voiceover(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else "gosia"), ensure_ascii=False))
