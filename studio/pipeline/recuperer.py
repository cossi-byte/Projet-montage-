#!/usr/bin/env python3
"""Récupère une vidéo depuis un lien (Google Drive partagé ou URL directe) et la range dans la bibliothèque.

    python3 recuperer.py "https://drive.google.com/file/d/XXXX/view?usp=sharing" [--sha256 ATTENDU] [--analyser]

- Téléchargement en flux avec reprise (relancer la commande reprend là où ça s'est arrêté).
- SHA-256 calculé et comparé à celui fourni (ou à celui du fichier .proxy.json du téléphone).
- Rangement dans library/originals/ en lecture seule, comme une réception par le serveur.
- Lien Google Drive : le fichier doit être partagé « Tous les utilisateurs disposant du lien ».
  Pensez à retirer le partage une fois la récupération faite.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import time
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import LIBRARY  # noqa: E402

UA = {"User-Agent": "studio-recuperer/1.0"}


def drive_direct(url: str) -> str:
    m = re.search(r"/d/([\w-]{20,})", url) or re.search(r"[?&]id=([\w-]{20,})", url)
    if "drive.google.com" in url and m:
        return f"https://drive.usercontent.google.com/download?id={m.group(1)}&export=download&confirm=t"
    return url


def filename_from(resp, url: str) -> str:
    cd = resp.headers.get("Content-Disposition", "")
    m = re.search(r"filename\*=UTF-8''([^;]+)", cd) or re.search(r'filename="?([^";]+)"?', cd)
    name = urllib.parse.unquote(m.group(1)) if m else Path(urllib.parse.urlsplit(url).path).name
    return re.sub(r"[^\w.\- ]+", "_", name).strip(" .") or "video.mp4"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("url")
    ap.add_argument("--sha256", help="empreinte attendue (sinon prise dans le .proxy.json s'il est fourni)")
    ap.add_argument("--json", help="lien ou chemin du fichier .proxy.json créé par le téléphone")
    ap.add_argument("--library", type=Path, default=LIBRARY)
    ap.add_argument("--analyser", action="store_true", help="lancer l'analyse complète ensuite")
    a = ap.parse_args()

    url = drive_direct(a.url)
    incoming = a.library / "incoming"
    originals = a.library / "originals"
    incoming.mkdir(parents=True, exist_ok=True)
    originals.mkdir(parents=True, exist_ok=True)
    key = hashlib.sha1(url.encode()).hexdigest()[:16]
    part, state_p = incoming / f"dl_{key}.part", incoming / f"dl_{key}.json"
    state = json.loads(state_p.read_text()) if state_p.exists() else {"url": url}

    for attempt in range(1, 9):
        have = part.stat().st_size if part.exists() else 0
        req = urllib.request.Request(url, headers={**UA, **({"Range": f"bytes={have}-"} if have else {})})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                if "text/html" in r.headers.get("Content-Type", ""):
                    raise SystemExit("Le lien renvoie une page web, pas un fichier : vérifiez que le partage est "
                                     "« Tous les utilisateurs disposant du lien ».")
                state.setdefault("filename", filename_from(r, a.url))
                if have and r.status != 206:  # le serveur ignore la reprise : on repart de zéro
                    have = 0
                    part.unlink(missing_ok=True)
                total = have + int(r.headers.get("Content-Length", 0) or 0)
                state["total"] = total
                state_p.write_text(json.dumps(state))
                done, t0 = have, time.time()
                with open(part, "ab") as f:
                    while chunk := r.read(4 * 1024**2):
                        f.write(chunk)
                        done += len(chunk)
                        sp = (done - have) / max(1e-3, time.time() - t0)
                        print(f"\r{done / 1e9:.2f} / {total / 1e9:.2f} Go  {sp / 1e6:.1f} Mo/s   ", end="", flush=True)
            print()
            break
        except (OSError, urllib.error.URLError) as e:
            print(f"\nCoupure ({e}) — reprise dans {2 ** attempt} s…")
            time.sleep(2 ** attempt)
    else:
        raise SystemExit("Échec du téléchargement après 8 tentatives (relancer la commande pour reprendre).")

    if state.get("total") and part.stat().st_size != state["total"]:
        raise SystemExit("Taille incomplète : relancez la commande pour reprendre.")

    expected, sidecar = (a.sha256 or "").lower() or None, None
    if a.json:
        raw = (urllib.request.urlopen(urllib.request.Request(drive_direct(a.json), headers=UA)).read()
               if a.json.startswith("http") else Path(a.json).read_bytes())
        sidecar = json.loads(raw)

    h = hashlib.sha256()
    with open(part, "rb") as f:
        while b := f.read(8 * 1024**2):
            h.update(b)
    digest = h.hexdigest()
    if expected and expected != digest:
        raise SystemExit(f"SHA-256 différent de l'attendu ({digest}) : fichier conservé dans {part}, non rangé.")

    vid = uuid.uuid4().hex[:8]
    dest = originals / f"{vid}__{state['filename']}"
    os.replace(part, dest)
    os.chmod(dest, 0o444)
    state_p.unlink(missing_ok=True)
    (originals / f"{dest.name}.sha256").write_text(f"{digest}  {dest.name}\n")
    meta = {"id": vid, "filename": state["filename"], "original": dest.name, "size": dest.stat().st_size,
            "sha256": digest, "verified_against_client": bool(expected), "source": a.url,
            "received_at": time.strftime("%Y-%m-%d %H:%M:%S")}
    if sidecar:
        meta["proxy_de"] = sidecar
    (originals / f"{dest.name}.meta.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False))
    print(f"✔ Rangé : {dest}\n  id : {vid}   SHA-256 : {digest}")
    if a.analyser:
        return subprocess.call([sys.executable, str(Path(__file__).parent / "analyze.py"), str(dest),
                                "--library", str(a.library)])
    return 0


if __name__ == "__main__":
    sys.exit(main())
