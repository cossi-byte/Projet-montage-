#!/usr/bin/env python3
"""Outils de travail sur les vidéos analysées. Aucun ne modifie jamais un original.

  studio.py bibliotheque                          liste les vidéos et l'état de leur analyse
  studio.py chercher ID "texte"                   retrouve une réplique (timecodes + plan)
  studio.py extraire ID 00:10:00 00:12:30 [--qualite proxy|copie|master] [--nom extrait]
  studio.py montage plan.json                     assemble un pré-montage + EDL depuis un plan
  studio.py exporter FICHIER --format vertical|carre|youtube|instagram|tiktok
                     [--sous-titres fichier.srt] [--normaliser] [--debruiter]

Toutes les sorties vont dans <library>/exports/.

Format d'un plan de montage (plan.json) :
  {"titre": "Bande-annonce", "source": "proxy",            # proxy (rapide) ou original
   "clips": [{"video": "5183f9dc", "debut": "00:00:06", "fin": "00:00:14", "note": "accroche"},
             {"video": "5183f9dc", "debut": "00:02:30", "fin": "00:02:45"}]}
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import LIBRARY, ffprobe, find_original, fps_of, hms, parse_time, project_dir, run, source_name, srt_time, tc  # noqa: E402

EXPORTS = LIBRARY / "exports"

PRESETS = {  # largeur, hauteur, débit vidéo max
    "vertical": (1080, 1920, "12M"), "tiktok": (1080, 1920, "12M"), "reels": (1080, 1920, "12M"),
    "carre": (1080, 1080, "10M"), "instagram": (1080, 1350, "10M"), "youtube": (1920, 1080, "16M"),
    "youtube4k": (3840, 2160, "45M"),
}


def norm(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s.lower()) if unicodedata.category(c) != "Mn")


def out_path(name: str, ext: str = ".mp4") -> Path:
    EXPORTS.mkdir(parents=True, exist_ok=True)
    stem = re.sub(r"[^\w.-]+", "_", name)[:80]
    p = EXPORTS / f"{stem}{ext}"
    k = 2
    while p.exists():  # jamais d'écrasement
        p = EXPORTS / f"{stem}_{k}{ext}"
        k += 1
    return p


def cmd_bibliotheque(a):
    for meta in sorted((LIBRARY / "originals").glob("*.meta.json")):
        m = json.loads(meta.read_text())
        stp = LIBRARY / "projects" / m["id"] / "status.json"
        s = json.loads(stp.read_text()) if stp.exists() else {}
        print(f"{m['id']}  {m['size'] / 1e9:7.2f} Go  {s.get('state', 'non analysée'):10}  {m['filename']}")


def cmd_chercher(a):
    proj = project_dir(a.id)
    fps = fps_of(json.loads((proj / "technique.json").read_text()))
    segs = json.loads((proj / "transcription.json").read_text())["segments"]
    scenes = json.loads((proj / "scenes.json").read_text())
    q = norm(a.texte)
    hits = [s for s in segs if q in norm(s["text"])]
    if not hits:  # recherche souple : tous les mots présents
        words = q.split()
        hits = [s for s in segs if all(w in norm(s["text"]) for w in words)]
    for s in hits:
        sc = next((x for x in scenes if x["start"] <= s["start"] < x["end"]), None)
        where = f"plan #{sc['index']} ({proj / sc['vignette']})" if sc else ""
        print(f"{tc(s['start'], fps)} → {tc(s['end'], fps)}  {s['text']}   {where}")
    print(f"{len(hits)} résultat(s)")


def source_for(vid: str, qualite: str) -> Path:
    return project_dir(vid) / "proxy.mp4" if qualite == "proxy" else find_original(vid)


def extract(src: Path, start: float, end: float, dest: Path, qualite: str) -> None:
    base = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-ss", f"{start:.3f}", "-i", str(src),
            "-t", f"{end - start:.3f}"]
    if qualite == "copie":  # sans réencodage : instantané, coupe à l'image clé la plus proche
        run(base + ["-c", "copy", "-avoid_negative_ts", "make_zero", str(dest)])
    elif qualite == "master":  # réencodage haute qualité, coupe à l'image près
        run(base + ["-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-b:a", "320k", "-movflags", "+faststart", str(dest)])
    else:  # proxy
        run(base + ["-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "aac", "-b:a", "128k",
                    str(dest)])


def cmd_extraire(a):
    s, e = parse_time(a.debut), parse_time(a.fin)
    dest = out_path(a.nom or f"{a.id}_{hms(s).replace(':', '')}-{hms(e).replace(':', '')}")
    extract(source_for(a.id, a.qualite), s, e, dest, a.qualite)
    print(f"✔ {dest}")


def cmd_montage(a):
    plan = json.loads(Path(a.plan).read_text())
    qual = "proxy" if plan.get("source", "proxy") == "proxy" else "master"
    work = out_path(plan.get("titre", "montage"), "")
    work.mkdir(parents=True)
    parts, edl, rec, fps, subs = [], [], 3600.0, 25.0, []
    for i, c in enumerate(plan["clips"], 1):
        s, e = parse_time(c["debut"]), parse_time(c["fin"])
        src = source_for(c["video"], qual)
        fps = fps_of(ffprobe(find_original(c["video"])))
        p = work / f"{i:03d}.mp4"
        # normalise chaque morceau (même taille / cadence / audio) pour un assemblage sans accroc
        run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-ss", f"{s:.3f}", "-i", str(src), "-t", f"{e - s:.3f}",
             "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=25",
             "-c:v", "libx264", "-preset", "veryfast" if qual == "proxy" else "slow", "-crf", "20" if qual == "proxy" else "16",
             "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "48000", "-ac", "2", "-b:a", "192k", str(p)])
        parts.append(p)
        clip = source_name(find_original(c["video"]))
        edl += [f"{i:03d}  AX       AA/V  C        {tc(s, fps)} {tc(e, fps)} {tc(rec, fps)} {tc(rec + e - s, fps)}",
                f"* FROM CLIP NAME: {clip}"] + ([f"* COMMENT: {c['note']}"] if c.get("note") else []) + [""]
        tj = project_dir(c["video"]) / "transcription.json"
        for seg in (json.loads(tj.read_text())["segments"] if tj.exists() else []):
            if min(e, seg["end"]) - max(s, seg["start"]) >= 0.5:  # réplique recalée sur la timeline du montage
                subs.append((rec - 3600 + max(0, seg["start"] - s), rec - 3600 + min(e, seg["end"]) - s, seg["text"]))
        rec += e - s
    lst = work / "liste.txt"
    lst.write_text("".join(f"file '{p.name}'\n" for p in parts))
    final = work / f"{work.name}.mp4"
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(lst),
         "-c", "copy", "-movflags", "+faststart", str(final)])
    (work / f"{work.name}.edl").write_text("\n".join([f"TITLE: {plan.get('titre', 'MONTAGE')[:60]}",
                                                      "FCM: NON-DROP FRAME", ""] + edl))
    (work / f"{work.name}.srt").write_text("".join(
        f"{i}\n{srt_time(a)} --> {srt_time(b)}\n{t}\n\n" for i, (a, b, t) in enumerate(subs, 1)), encoding="utf-8")
    for p in parts:
        p.unlink()
    lst.unlink()
    print(f"✔ Pré-montage : {final}\n✔ EDL (Premiere / Resolve) : {work / (work.name + '.edl')}\n"
          f"✔ Sous-titres recalés : {work / (work.name + '.srt')}\n"
          f"  Durée : {hms(rec - 3600)}")


def cmd_exporter(a):
    src = Path(a.fichier)
    w, h, br = PRESETS[a.format]
    vf = [f"scale={w}:{h}:force_original_aspect_ratio=increase", f"crop={w}:{h}"]  # recadrage centré
    if a.flou:  # garde toute l'image, fond flouté
        vf = [f"split[a][b];[a]scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},boxblur=30[bg];"
              f"[b]scale={w}:{h}:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2"]
    if a.sous_titres:
        srt = str(Path(a.sous_titres).resolve()).replace("\\", "/").replace(":", r"\:").replace("'", r"\'")
        vf.append(f"subtitles='{srt}':force_style='FontName=DejaVu Sans,FontSize=14,Outline=2,MarginV=60'")
    af = []
    if a.debruiter:
        af.append("afftdn=nf=-25")
    if a.normaliser:
        af.append("loudnorm=I=-14:TP=-1:LRA=11")  # niveau recommandé pour YouTube / TikTok / Instagram
    dest = out_path(f"{src.stem}_{a.format}")
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(src), "-filter_complex" if a.flou else "-vf",
           ",".join(vf), "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-maxrate", br, "-bufsize", br,
           "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart"]
    if af:
        cmd += ["-af", ",".join(af)]
    run(cmd + [str(dest)])
    print(f"✔ {dest}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("bibliotheque").set_defaults(f=cmd_bibliotheque)
    p = sub.add_parser("chercher"); p.add_argument("id"); p.add_argument("texte"); p.set_defaults(f=cmd_chercher)
    p = sub.add_parser("extraire"); p.add_argument("id"); p.add_argument("debut"); p.add_argument("fin")
    p.add_argument("--qualite", choices=["proxy", "copie", "master"], default="copie"); p.add_argument("--nom")
    p.set_defaults(f=cmd_extraire)
    p = sub.add_parser("montage"); p.add_argument("plan"); p.set_defaults(f=cmd_montage)
    p = sub.add_parser("exporter"); p.add_argument("fichier"); p.add_argument("--format", choices=PRESETS, required=True)
    p.add_argument("--sous-titres"); p.add_argument("--normaliser", action="store_true")
    p.add_argument("--debruiter", action="store_true"); p.add_argument("--flou", action="store_true",
                                                                       help="fond flouté au lieu d'un recadrage")
    p.set_defaults(f=cmd_exporter)
    a = ap.parse_args()
    a.f(a)


if __name__ == "__main__":
    main()
