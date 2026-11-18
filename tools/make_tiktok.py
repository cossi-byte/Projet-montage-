#!/usr/bin/env python3
"""Découpe le film 16:9 en clips TikTok 9:16 (1080x1920) avec accroche + sous-titres."""
import json, re, subprocess, pathlib
EMOJI = re.compile("[\U0001F000-\U0001FFFF\u2600-\u27BF\uFE0F]")
ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "out/koko-et-le-petit-oeuf.mp4"
OUT = ROOT / "tiktok"; OUT.mkdir(exist_ok=True)
BUILD = ROOT / "build/tiktok"; BUILD.mkdir(parents=True, exist_ok=True)
lines = json.load(open(ROOT / "story.json"))["lines"]
NAMES = {"choir1": "♪", "choir2": "♪", "choir3": "♪"}

# (fichier, début, fin, accroche à l'écran)
CLIPS = [
    ("01-oeuf-tombe-du-ciel", 0.0, 17.5, "Un œuf tombe du ciel…\nsur la tête de Koko 🥚🐘"),
    ("02-singe-tronc",        17.5, 46.5, "Il n'arrivera jamais\nà passer ce tronc… 😱"),
    ("03-refrain",            46.6, 55.2, "La chanson que ton enfant\nva chanter toute la journée 🎶"),
    ("04-tortue-riviere",     55.2, 84.8, "Attends de voir\nsur quoi l'œuf atterrit 🐢"),
    ("05-girafe-pyramide",    93.0, 123.5, "La pyramide des amis…\nça va mal finir 😂"),
    ("06-eclosion",          123.5, 146.0, "L'œuf bouge…\nqui va sortir ? 🐣"),
    ("07-danse-finale",      146.0, 180.0, "Tout le monde danse !\nLe final 💃"),
    ("08-oups",              158.5, 171.0, "Oups ! 😂"),
]

def ts(t):
    h, r = divmod(max(t, 0), 3600); m, s = divmod(r, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"

def ass_for(start, end, hook):
    hdr = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Hook,DejaVu Sans,74,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,6,2,8,60,60,230,1
Style: Sub,DejaVu Sans,64,&H0000F0FF,&H00FFFFFF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,6,2,2,60,60,440,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    ev = [f"Dialogue: 0,{ts(0)},{ts(end-start)},Hook,,0,0,0,,{EMOJI.sub('', hook).strip().replace(' '+chr(10), chr(10)).replace(chr(10), r'\N')}"]
    starts = [l["t"] for l in lines]
    for i, l in enumerate(lines):
        if l["text"].startswith("("): continue
        a = l["t"]; b = min(a + l.get("max", 2.2), starts[i+1] if i+1 < len(starts) else a+2.5)
        if b <= start or a >= end: continue
        txt = l["text"]
        if l["who"] in NAMES: txt = f"♪ {txt} ♪"
        ev.append(f"Dialogue: 0,{ts(a-start)},{ts(min(b,end)-start)},Sub,,0,0,0,,{txt}")
    return hdr + "\n".join(ev) + "\n"

for name, a, b, hook in CLIPS:
    ass = BUILD / f"{name}.ass"; ass.write_text(ass_for(a, b, hook))
    vf = (
        "[0:v]split[a][b];"
        "[a]scale=-2:1920,crop=1080:1920,gblur=sigma=30,eq=brightness=-0.08[bg];"
        "[b]crop=1440:1080,scale=1080:810[fg];"
        f"[bg][fg]overlay=0:555,ass={ass}[v]"
    )
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(a), "-t", str(b - a), "-i", str(SRC),
        "-filter_complex", vf, "-map", "[v]", "-map", "0:a",
        "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-r", "30",
        "-c:a", "aac", "-b:a", "160k", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11",
        "-movflags", "+faststart", str(OUT / f"{name}.mp4")], check=True)
    print("ok", name, round(b - a, 1), "s")
