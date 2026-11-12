"""Fonctions partagées : timecodes, appels FFmpeg, bibliothèque."""
from __future__ import annotations

import json
import os
import subprocess
import time
from pathlib import Path

LIBRARY = Path(os.environ.get("STUDIO_DATA", Path(__file__).resolve().parents[2] / "library"))


def run(cmd: list[str], **kw) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, check=True, **kw)


def ffprobe(path: Path) -> dict:
    out = run(["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams",
               str(path)], capture_output=True).stdout
    return json.loads(out)


def fps_of(probe: dict) -> float:
    for s in probe.get("streams", []):
        if s.get("codec_type") == "video":
            num, den = (s.get("avg_frame_rate") or s.get("r_frame_rate") or "25/1").split("/")
            if float(den) and float(num):
                return float(num) / float(den)
    return 25.0


def tc(sec: float, fps: float = 25.0) -> str:
    """Timecode HH:MM:SS:FF (non drop-frame)."""
    fr = int(round(fps))
    total = int(round(sec * fr))
    f = total % fr
    s = total // fr
    return f"{s // 3600:02d}:{s // 60 % 60:02d}:{s % 60:02d}:{f:02d}"


def hms(sec: float) -> str:
    s = int(sec)
    return f"{s // 3600:02d}:{s // 60 % 60:02d}:{s % 60:02d}"


def srt_time(sec: float) -> str:
    ms = int(round(sec * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def parse_time(t: str) -> float:
    """Accepte 83.5, 01:23, 00:01:23, 00:01:23.5 ou 00:01:23:12 (avec fps 25 par défaut)."""
    t = str(t).strip()
    parts = t.split(":")
    if len(parts) == 4:
        h, m, s, f = map(float, parts)
        return h * 3600 + m * 60 + s + f / 25.0
    sec = 0.0
    for p in parts:
        sec = sec * 60 + float(p)
    return sec


def project_dir(video_id: str, library: Path = LIBRARY) -> Path:
    d = library / "projects" / video_id
    if not d.exists():
        raise SystemExit(f"Projet {video_id} introuvable dans {library / 'projects'}")
    return d


def find_original(video_id: str, library: Path = LIBRARY) -> Path:
    hits = [p for p in (library / "originals").glob(f"{video_id}__*") if not p.name.endswith((".json", ".sha256"))]
    if not hits:
        raise SystemExit(f"Original {video_id} introuvable dans {library / 'originals'}")
    return hits[0]


def source_name(path: Path) -> str:
    """Nom du fichier tel qu'il existe chez l'utilisateur (pour relier l'EDL dans Premiere / Resolve) :
    sans le préfixe interne « id__ » et, pour un proxy fait sur le téléphone, le nom de l'original."""
    meta = path.with_name(path.name + ".meta.json")
    if meta.exists():
        m = json.loads(meta.read_text())
        if m.get("proxy_de", {}).get("original"):
            return m["proxy_de"]["original"]
    name = path.name.split("__", 1)[-1]
    return name.replace(".proxy.", ".")


class Status:
    def __init__(self, proj: Path):
        self.path = proj / "status.json"
        self.data = json.loads(self.path.read_text()) if self.path.exists() else {"steps_done": []}

    def set(self, **kw) -> None:
        self.data.update(kw, updated=time.strftime("%Y-%m-%d %H:%M:%S"))
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(self.data, indent=2, ensure_ascii=False))
        os.replace(tmp, self.path)

    def done(self, step: str) -> None:
        if step not in self.data["steps_done"]:
            self.data["steps_done"].append(step)
        self.set()
