#!/usr/bin/env python3
"""Client d'envoi par morceaux, avec reprise et vérification SHA-256.

Fonctionne avec Python seul (aucune dépendance) : Termux sur Android, Linux, macOS, Windows.

    export STUDIO_URL=https://mon-serveur.exemple   STUDIO_TOKEN=...
    python3 upload.py /sdcard/DCIM/rush01.mp4
    python3 upload.py --no-full-hash rush.mp4   # saute le calcul préalable du SHA-256 complet

Relancer la même commande après une coupure reprend l'envoi là où il s'était arrêté.
La mémoire utilisée reste d'environ (parallélisme x taille de morceau), quelle que soit
la taille du fichier.
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import hashlib
import http.client
import json
import os
import ssl
import sys
import threading
import time
import urllib.parse
from pathlib import Path

CACHE = Path.home() / ".studio_upload_cache.json"


def human(n: float) -> str:
    return f"{n / 1e9:.2f} Go" if n >= 1e9 else f"{n / 1e6:.1f} Mo"


class Api:
    def __init__(self, base: str, token: str):
        self.u = urllib.parse.urlsplit(base.rstrip("/"))
        self.token = token
        self.ctx = ssl.create_default_context(cafile=os.environ.get("SSL_CERT_FILE") or None)

    def conn(self):
        if self.u.scheme == "https":
            return http.client.HTTPSConnection(self.u.hostname, self.u.port or 443, timeout=300, context=self.ctx)
        return http.client.HTTPConnection(self.u.hostname, self.u.port or 80, timeout=300)

    def call(self, method: str, path: str, body=None, headers=None):
        h = {"Authorization": f"Bearer {self.token}", **(headers or {})}
        if isinstance(body, (dict, list)):
            body, h["Content-Type"] = json.dumps(body).encode(), "application/json"
        c = self.conn()
        try:
            c.request(method, self.u.path + path, body=body, headers=h)
            r = c.getresponse()
            data = r.read()
        finally:
            c.close()
        try:
            payload = json.loads(data) if data else None
        except ValueError:
            payload = data.decode(errors="replace")
        return r.status, payload


def full_sha256(path: Path) -> str:
    st = path.stat()
    key = f"{path.resolve()}|{st.st_size}|{int(st.st_mtime)}"
    cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}
    if key in cache:
        return cache[key]
    h, done, t0 = hashlib.sha256(), 0, time.time()
    with open(path, "rb") as f:
        while b := f.read(8 * 1024**2):
            h.update(b)
            done += len(b)
            if time.time() - t0 > 1:
                print(f"\rSHA-256 local : {100 * done / st.st_size:5.1f} %", end="", flush=True)
    print(f"\rSHA-256 local : 100.0 %")
    cache[key] = h.hexdigest()
    CACHE.write_text(json.dumps(cache))
    return cache[key]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("file", type=Path)
    ap.add_argument("--url", default=os.environ.get("STUDIO_URL", "http://127.0.0.1:8765"))
    ap.add_argument("--token", default=os.environ.get("STUDIO_TOKEN", ""))
    ap.add_argument("--chunk-mb", type=int, default=32)
    ap.add_argument("--parallel", type=int, default=3)
    ap.add_argument("--no-full-hash", action="store_true", help="ne pas calculer le SHA-256 complet avant l'envoi")
    ap.add_argument("--stop-after", type=int, default=0, help="(test) s'arrêter après N morceaux pour simuler une coupure")
    a = ap.parse_args()

    path: Path = a.file
    size = path.stat().st_size
    api = Api(a.url, a.token)
    expected = None if a.no_full_hash else full_sha256(path)

    code, st = api.call("POST", "/api/uploads", {"filename": path.name, "size": size,
                                                 "chunk_size": a.chunk_mb * 1024**2, "sha256": expected})
    if code != 200:
        print(f"Refus du serveur ({code}) : {st}", file=sys.stderr)
        return 1
    todo = [i for i in range(st["total_chunks"]) if i not in set(st["received"])]
    if st["received"]:
        print(f"Reprise : {len(st['received'])}/{st['total_chunks']} morceaux déjà sur le serveur.")
    done = [st["received_bytes"]]
    lock, t0, b0 = threading.Lock(), time.time(), st["received_bytes"]
    sent = [0]
    stop = threading.Event()

    def send(i: int) -> None:
        start = i * st["chunk_size"]
        length = min(st["chunk_size"], size - start)
        for attempt in range(1, 9):
            if stop.is_set():
                return
            try:
                with open(path, "rb") as f:
                    f.seek(start)
                    data = f.read(length)
                digest = hashlib.sha256(data).hexdigest()
                code, resp = api.call("PUT", f"/api/uploads/{st['id']}/chunks/{i}", data,
                                      {"X-Chunk-SHA256": digest, "Content-Type": "application/octet-stream"})
                if code == 200:
                    with lock:
                        done[0] += length
                        sent[0] += 1
                        speed = (done[0] - b0) / max(1e-3, time.time() - t0)
                        eta = (size - done[0]) / max(speed, 1)
                        print(f"\r{human(done[0])} / {human(size)}  {100 * done[0] / size:5.1f} %  "
                              f"{human(speed)}/s  reste ≈ {eta / 60:.0f} min   ", end="", flush=True)
                        if a.stop_after and sent[0] >= a.stop_after:
                            stop.set()
                    return
                if code == 401:
                    raise SystemExit("Jeton invalide")
                print(f"\nMorceau {i} refusé ({code}: {resp}), nouvel essai…")
            except (OSError, http.client.HTTPException) as e:
                print(f"\nMorceau {i} : coupure réseau ({e}), nouvel essai dans {2 ** attempt} s…")
            time.sleep(min(60, 2 ** attempt))
        raise RuntimeError(f"Morceau {i} : échec après 8 tentatives")

    with cf.ThreadPoolExecutor(a.parallel) as ex:
        for fut in cf.as_completed([ex.submit(send, i) for i in todo]):
            fut.result()
    print()
    if stop.is_set():
        print(f"Arrêt volontaire après {sent[0]} morceaux (test de reprise). Relancez pour continuer.")
        return 3

    code, resp = api.call("POST", f"/api/uploads/{st['id']}/complete")
    if code not in (200, 202):
        print(f"Finalisation refusée ({code}) : {resp}", file=sys.stderr)
        return 1
    while True:
        code, s = api.call("GET", f"/api/uploads/{st['id']}")
        if s["status"] != "verifying":
            break
        print(f"\rVérification SHA-256 sur le serveur : {100 * (s.get('hash_progress') or 0):5.1f} %", end="", flush=True)
        time.sleep(2)
    print()
    if s["status"] != "done":
        print(f"ÉCHEC : {s.get('error')}", file=sys.stderr)
        return 2
    print(f"✔ Reçu et vérifié : {s['original']}\n  SHA-256 serveur : {s['sha256']}")
    if expected:
        print(f"  SHA-256 local   : {expected}  ({'identique' if expected == s['sha256'] else 'DIFFÉRENT'})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
