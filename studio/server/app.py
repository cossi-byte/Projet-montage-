"""Serveur de transfert de fichiers volumineux (jusqu'à 64 Gio) par morceaux, avec reprise.

Principes :
- le fichier final est pré-alloué ; chaque morceau est écrit directement à sa place
  (pas de copie intermédiaire : l'espace disque nécessaire = taille du fichier) ;
- chaque morceau est vérifié par SHA-256 avant d'être compté comme reçu ;
- l'état est enregistré sur disque après chaque morceau : un transfert interrompu
  (réseau, téléphone en veille, redémarrage du serveur) reprend là où il s'est arrêté ;
- à la fin, le SHA-256 du fichier complet est recalculé et comparé à celui fourni
  par le client (s'il l'a fourni), puis l'original est rangé en lecture seule ;
- la mémoire utilisée ne dépend pas de la taille du fichier (lecture en flux).

Lancement :  STUDIO_TOKEN=... uvicorn app:app --host 0.0.0.0 --port 8765
             (depuis le dossier studio/server ; voir studio/README.md)
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import os
import re
import secrets
import subprocess
import sys
import time
import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse

HERE = Path(__file__).resolve().parent
STUDIO = HERE.parent
DATA = Path(os.environ.get("STUDIO_DATA", STUDIO.parent / "library")).resolve()
TOKEN = os.environ.get("STUDIO_TOKEN", "")
MAX_SIZE = int(os.environ.get("STUDIO_MAX_SIZE", str(64 * 1024**3)))  # 64 Gio
DEFAULT_CHUNK = int(os.environ.get("STUDIO_CHUNK", str(32 * 1024**2)))  # 32 Mio
MIN_CHUNK, MAX_CHUNK = 1024**2, 256 * 1024**2
AUTOPROCESS = os.environ.get("STUDIO_AUTOPROCESS", "0") == "1"
ALLOWED_EXT = {".mp4", ".mov", ".m4v", ".mkv", ".mxf", ".avi", ".wav", ".mp3", ".m4a"}

INCOMING = DATA / "incoming"
ORIGINALS = DATA / "originals"
PROJECTS = DATA / "projects"
for d in (INCOMING, ORIGINALS, PROJECTS):
    d.mkdir(parents=True, exist_ok=True)

if not TOKEN and os.environ.get("STUDIO_INSECURE_NO_TOKEN") != "1":
    sys.exit("STUDIO_TOKEN manquant. Exemple : export STUDIO_TOKEN=$(python3 -c 'import secrets;print(secrets.token_urlsafe(24))')")

app = FastAPI(title="Studio — transfert et analyse vidéo", docs_url=None, redoc_url=None)
_locks: dict[str, asyncio.Lock] = {}


# ---------------------------------------------------------------- utilitaires
def check_auth(request: Request) -> None:
    if not TOKEN:
        return
    given = request.headers.get("authorization", "").removeprefix("Bearer ").strip()
    given = given or request.query_params.get("t", "") or request.cookies.get("studio_token", "")
    if not secrets.compare_digest(given, TOKEN):
        raise HTTPException(401, "Jeton d'accès invalide")


def safe_name(name: str) -> str:
    name = Path(name).name
    name = re.sub(r"[^\w.\- ]+", "_", name, flags=re.UNICODE).strip(" .") or "video.mp4"
    return name[:150]


def state_path(uid: str) -> Path:
    if not re.fullmatch(r"[0-9a-f]{32}", uid):
        raise HTTPException(404, "Transfert inconnu")
    return INCOMING / f"{uid}.json"


def load_state(uid: str) -> dict:
    p = state_path(uid)
    if not p.exists():
        raise HTTPException(404, "Transfert inconnu")
    return json.loads(p.read_text())


def save_state(st: dict) -> None:
    p = state_path(st["id"])
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps(st))
    os.replace(tmp, p)  # écriture atomique : jamais d'état à moitié écrit


def chunk_len(st: dict, i: int) -> int:
    start = i * st["chunk_size"]
    return min(st["chunk_size"], st["size"] - start)


def public(st: dict) -> dict:
    out = {k: st[k] for k in ("id", "filename", "size", "chunk_size", "total_chunks", "status",
                              "created", "expected_sha256", "sha256", "original", "error", "hash_progress")
           if k in st}
    out["received"] = sorted(st["received"])
    out["received_bytes"] = sum(chunk_len(st, i) for i in st["received"])
    return out


def sha256_file(path: Path, progress=None, bufsize=8 * 1024**2) -> str:
    h = hashlib.sha256()
    done, size = 0, path.stat().st_size
    with open(path, "rb", buffering=0) as f:
        while True:
            b = f.read(bufsize)
            if not b:
                break
            h.update(b)
            done += len(b)
            if progress:
                progress(done, size)
    return h.hexdigest()


def catalog() -> list[dict]:
    items = []
    for meta in sorted(ORIGINALS.glob("*.meta.json")):
        m = json.loads(meta.read_text())
        proj = PROJECTS / m["id"]
        m["analysis"] = json.loads((proj / "status.json").read_text()) if (proj / "status.json").exists() else None
        items.append(m)
    return items


# ---------------------------------------------------------------- transferts
@app.post("/api/uploads")
async def create_upload(request: Request):
    check_auth(request)
    body = await request.json()
    filename = safe_name(str(body.get("filename", "")))
    size = int(body.get("size", 0))
    if Path(filename).suffix.lower() not in ALLOWED_EXT:
        raise HTTPException(400, f"Extension non acceptée ({', '.join(sorted(ALLOWED_EXT))})")
    if not 0 < size <= MAX_SIZE:
        raise HTTPException(413, f"Taille hors limites (max {MAX_SIZE} octets)")
    chunk = int(body.get("chunk_size") or DEFAULT_CHUNK)
    chunk = max(MIN_CHUNK, min(MAX_CHUNK, chunk))
    expected = (body.get("sha256") or "").lower() or None
    if expected and not re.fullmatch(r"[0-9a-f]{64}", expected):
        raise HTTPException(400, "sha256 attendu invalide")

    # Reprise : un transfert inachevé du même fichier (nom + taille) est réutilisé.
    for p in INCOMING.glob("*.json"):
        st = json.loads(p.read_text())
        if st["filename"] == filename and st["size"] == size and st["status"] == "uploading":
            if expected and not st.get("expected_sha256"):
                st["expected_sha256"] = expected
                save_state(st)
            return public(st)

    usage = os.statvfs(DATA)
    if usage.f_bavail * usage.f_frsize < size + 512 * 1024**2:
        raise HTTPException(507, "Espace disque insuffisant sur le serveur")

    uid = uuid.uuid4().hex
    part = INCOMING / f"{uid}.part"
    with open(part, "wb") as f:
        f.truncate(size)  # fichier creux : l'espace n'est consommé qu'à l'écriture
    st = {"id": uid, "filename": filename, "size": size, "chunk_size": chunk,
          "total_chunks": (size + chunk - 1) // chunk, "received": [], "status": "uploading",
          "created": time.time(), "expected_sha256": expected}
    save_state(st)
    return public(st)


@app.get("/api/uploads")
async def list_uploads(request: Request):
    check_auth(request)
    return [public(json.loads(p.read_text())) for p in sorted(INCOMING.glob("*.json"))]


@app.get("/api/uploads/{uid}")
async def get_upload(uid: str, request: Request):
    check_auth(request)
    return public(load_state(uid))


@app.put("/api/uploads/{uid}/chunks/{index}")
async def put_chunk(uid: str, index: int, request: Request):
    check_auth(request)
    st = load_state(uid)
    if st["status"] != "uploading":
        raise HTTPException(409, f"Transfert à l'état « {st['status']} »")
    if not 0 <= index < st["total_chunks"]:
        raise HTTPException(400, "Numéro de morceau invalide")
    want_hash = request.headers.get("x-chunk-sha256", "").lower()
    if not re.fullmatch(r"[0-9a-f]{64}", want_hash):
        raise HTTPException(400, "En-tête X-Chunk-SHA256 manquant")
    expected_len = chunk_len(st, index)
    offset = index * st["chunk_size"]

    h = hashlib.sha256()
    written = 0
    fd = os.open(INCOMING / f"{uid}.part", os.O_WRONLY)
    try:
        async for piece in request.stream():
            if not piece:
                continue
            if written + len(piece) > expected_len:
                raise HTTPException(400, "Morceau trop long")
            os.pwrite(fd, piece, offset + written)
            h.update(piece)
            written += len(piece)
        os.fsync(fd)
    finally:
        os.close(fd)
    if written != expected_len:
        raise HTTPException(400, f"Morceau incomplet ({written}/{expected_len} octets) — à renvoyer")
    if h.hexdigest() != want_hash:
        raise HTTPException(422, "SHA-256 du morceau incorrect — à renvoyer")

    lock = _locks.setdefault(uid, asyncio.Lock())
    async with lock:
        st = load_state(uid)
        if index not in st["received"]:
            st["received"].append(index)
        save_state(st)
    return {"index": index, "ok": True, "received_count": len(st["received"]),
            "total_chunks": st["total_chunks"]}


def _finalize(uid: str) -> None:
    st = load_state(uid)
    part = INCOMING / f"{uid}.part"
    last = [0.0]

    def prog(done, size):
        if time.time() - last[0] > 2:
            last[0] = time.time()
            s = load_state(uid)
            s["hash_progress"] = round(done / size, 4)
            save_state(s)

    try:
        digest = sha256_file(part, prog)
        st = load_state(uid)
        st["sha256"], st["hash_progress"] = digest, 1.0
        if st.get("expected_sha256") and st["expected_sha256"] != digest:
            st["status"], st["error"] = "error", "SHA-256 final différent de celui annoncé : fichier rejeté"
            save_state(st)
            return
        dest = ORIGINALS / f"{uid[:8]}__{st['filename']}"
        os.replace(part, dest)
        os.chmod(dest, 0o444)  # l'original ne doit plus jamais être modifié
        (ORIGINALS / f"{dest.name}.sha256").write_text(f"{digest}  {dest.name}\n")
        meta = {"id": uid[:8], "filename": st["filename"], "original": dest.name, "size": st["size"],
                "sha256": digest, "verified_against_client": bool(st.get("expected_sha256")),
                "received_at": time.strftime("%Y-%m-%d %H:%M:%S")}
        (ORIGINALS / f"{dest.name}.meta.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False))
        st["status"], st["original"] = "done", dest.name
        save_state(st)
        if AUTOPROCESS:
            launch_analysis(dest)
    except Exception as e:  # noqa: BLE001
        st = load_state(uid)
        st["status"], st["error"] = "error", str(e)
        save_state(st)


@app.post("/api/uploads/{uid}/complete")
async def complete(uid: str, request: Request):
    check_auth(request)
    lock = _locks.setdefault(uid, asyncio.Lock())
    async with lock:
        st = load_state(uid)
        if st["status"] in ("verifying", "done"):
            return JSONResponse(public(st), status_code=202 if st["status"] == "verifying" else 200)
        missing = sorted(set(range(st["total_chunks"])) - set(st["received"]))
        if missing:
            raise HTTPException(409, {"message": "Morceaux manquants", "missing": missing[:50],
                                      "missing_count": len(missing)})
        st["status"] = "verifying"
        save_state(st)
    asyncio.get_running_loop().run_in_executor(None, _finalize, uid)
    return JSONResponse(public(st), status_code=202)


@app.delete("/api/uploads/{uid}")
async def abort(uid: str, request: Request):
    """Abandonne un transfert INACHEVÉ. Ne touche jamais à un original terminé."""
    check_auth(request)
    st = load_state(uid)
    if st["status"] not in ("uploading", "error"):
        raise HTTPException(409, "Seul un transfert inachevé peut être abandonné")
    (INCOMING / f"{uid}.part").unlink(missing_ok=True)
    state_path(uid).unlink(missing_ok=True)
    return {"aborted": uid}


# ---------------------------------------------------------------- bibliothèque
def launch_analysis(original: Path, extra: list[str] | None = None) -> None:
    log = PROJECTS / f"{original.name.split('__')[0]}.log"
    cmd = [sys.executable, str(STUDIO / "pipeline" / "analyze.py"), str(original), "--library", str(DATA)]
    subprocess.Popen(cmd + (extra or []), stdout=open(log, "ab"), stderr=subprocess.STDOUT,
                     start_new_session=True)


@app.get("/api/library")
async def library(request: Request):
    check_auth(request)
    return catalog()


@app.post("/api/library/{vid}/analyze")
async def analyze(vid: str, request: Request):
    check_auth(request)
    body = await request.json() if request.headers.get("content-length") not in (None, "0") else {}
    for m in catalog():
        if m["id"] == vid:
            if m["analysis"] and m["analysis"].get("state") == "running":
                raise HTTPException(409, "Analyse déjà en cours")
            extra = []
            if body.get("model"):
                extra += ["--model", re.sub(r"[^\w.-]", "", str(body["model"]))]
            if body.get("language"):
                extra += ["--language", re.sub(r"[^a-z]", "", str(body["language"]))]
            launch_analysis(ORIGINALS / m["original"], extra)
            return {"started": vid}
    raise HTTPException(404, "Vidéo inconnue")


@app.get("/files/{vid}/{path:path}")
async def project_file(vid: str, path: str, request: Request):
    """Sert les résultats d'analyse (rapport, vignettes, proxy) au téléphone."""
    check_auth(request)
    base = (PROJECTS / vid).resolve()
    target = (base / path).resolve()
    if not str(target).startswith(str(base) + os.sep) or not target.is_file():
        raise HTTPException(404, "Fichier introuvable")
    return FileResponse(target)


@app.get("/", response_class=HTMLResponse)
async def index():
    return (HERE / "static" / "index.html").read_text(encoding="utf-8")


@app.get("/healthz")
async def healthz():
    u = os.statvfs(DATA)
    return {"ok": True, "free_bytes": u.f_bavail * u.f_frsize, "max_upload": MAX_SIZE}
