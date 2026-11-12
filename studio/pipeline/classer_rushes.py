#!/usr/bin/env python3
"""Catalogue et classe des rushes SANS les déplacer ni les modifier.

    python3 classer_rushes.py /chemin/carte_SD_ou_dossier  [--sortie /chemin/classement] [--sha256]

Produit :
  catalogue.csv  — un fichier par ligne : date de tournage, caméra, durée, résolution,
                   cadence, codec, audio, taille, chemin (et SHA-256 avec --sha256)
  classement/    — arborescence de liens vers les originaux :
                   par_date/2026-11-12/…, par_camera/Sony_ILCE-7SM3/…, par_type/4K_50p/…
Les originaux restent exactement où ils sont. Supprimer le dossier « classement » ne
supprime aucune vidéo.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path

EXT = {".mp4", ".mov", ".mxf", ".m4v", ".mts", ".m2ts", ".avi", ".mkv", ".wav", ".mp3", ".m4a", ".braw"}


def probe(p: Path) -> dict:
    r = subprocess.run(["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(p)],
                       capture_output=True, text=True)
    return json.loads(r.stdout or "{}")


def info(p: Path, with_hash: bool) -> dict:
    d = probe(p)
    fmt, tags = d.get("format", {}), d.get("format", {}).get("tags", {})
    v = next((s for s in d.get("streams", []) if s.get("codec_type") == "video"), {})
    a = next((s for s in d.get("streams", []) if s.get("codec_type") == "audio"), {})
    ct = tags.get("creation_time") or v.get("tags", {}).get("creation_time")
    try:
        date = datetime.fromisoformat(ct.replace("Z", "+00:00")) if ct else None
    except ValueError:
        date = None
    date = date or datetime.fromtimestamp(p.stat().st_mtime)
    cam = " ".join(x for x in (tags.get("com.apple.quicktime.make") or tags.get("make"),
                               tags.get("com.apple.quicktime.model") or tags.get("model")) if x)
    cam = cam or tags.get("encoder") or tags.get("major_brand") or "inconnue"
    fps = ""
    if v.get("avg_frame_rate", "0/0") != "0/0":
        n, dd = v["avg_frame_rate"].split("/")
        fps = round(float(n) / float(dd), 2) if float(dd) else ""
    h = v.get("height")
    res = "4K" if h and h >= 2000 else "2.7K" if h and h >= 1500 else "1080" if h and h >= 1000 else (f"{h}p" if h else "audio")
    row = {"fichier": p.name, "date": date.strftime("%Y-%m-%d %H:%M:%S"), "camera": cam,
           "duree_s": round(float(fmt.get("duration", 0)), 2), "largeur": v.get("width", ""), "hauteur": h or "",
           "cadence": fps, "codec": v.get("codec_name", ""), "audio": f"{a.get('codec_name', '')} {a.get('channels', '')}ch".strip(),
           "taille_go": round(p.stat().st_size / 1e9, 3), "type": f"{res}_{int(fps) if fps else ''}p".rstrip("_p"),
           "timecode": tags.get("timecode") or v.get("tags", {}).get("timecode", ""), "chemin": str(p)}
    if with_hash:
        hh = hashlib.sha256()
        with open(p, "rb") as f:
            while b := f.read(8 * 1024**2):
                hh.update(b)
        row["sha256"] = hh.hexdigest()
    return row


def link(target: Path, folder: Path) -> None:
    folder.mkdir(parents=True, exist_ok=True)
    dst = folder / target.name
    if not dst.exists() and not dst.is_symlink():
        os.symlink(target, dst)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("dossier", type=Path)
    ap.add_argument("--sortie", type=Path)
    ap.add_argument("--sha256", action="store_true", help="calcule l'empreinte de chaque fichier (long)")
    a = ap.parse_args()
    out = a.sortie or a.dossier.parent / f"{a.dossier.name}_classement"
    files = sorted(p for p in a.dossier.rglob("*") if p.is_file() and p.suffix.lower() in EXT and not p.is_symlink())
    if not files:
        print("Aucun fichier média trouvé.")
        return 1
    out.mkdir(parents=True, exist_ok=True)
    rows = []
    for i, p in enumerate(files, 1):
        print(f"[{i}/{len(files)}] {p.name}", flush=True)
        r = info(p, a.sha256)
        rows.append(r)
        safe = lambda s: re.sub(r"[^\w.-]+", "_", str(s)).strip("_") or "inconnu"
        link(p.resolve(), out / "par_date" / r["date"][:10])
        link(p.resolve(), out / "par_camera" / safe(r["camera"]))
        link(p.resolve(), out / "par_type" / safe(r["type"]))
    rows.sort(key=lambda r: r["date"])
    with open(out / "catalogue.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    total = sum(r["duree_s"] for r in rows)
    print(f"✔ {len(rows)} fichiers, {total / 3600:.2f} h de rushes, {sum(r['taille_go'] for r in rows):.1f} Go\n"
          f"  Catalogue : {out / 'catalogue.csv'}\n  Classement (liens) : {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
