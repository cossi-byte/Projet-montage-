#!/usr/bin/env python3
"""Analyse complète d'une vidéo (de quelques secondes à 64 Go / plusieurs heures).

    python3 analyze.py /chemin/video.mp4 [--library DOSSIER] [--model small] [--language fr]

L'original n'est jamais modifié : il est seulement lu, une seule fois, pour produire
un proxy léger (480p) et la piste audio. Tout le reste travaille sur ces copies.
Chaque étape écrit ses fichiers puis est marquée comme faite : si l'analyse est
interrompue, relancer la même commande reprend à l'étape suivante.

Fichiers produits dans <library>/projects/<id>/ :
  technique.json      caractéristiques techniques (ffprobe)
  proxy.mp4           copie légère 480p pour visionner sur téléphone et analyser
  audio.wav           piste audio 16 kHz mono (pour la transcription)
  scenes.json / .csv  plans détectés, avec timecodes, dialogues, niveau sonore, score
  vignettes/          une image par plan
  planches/           planches contact (20 vignettes par image) pour l'analyse par Claude
  transcription.txt / .srt / .json
  chronologie.md      chronologie avec timecodes
  moments.md          moments forts candidats (repérage automatique, à valider)
  selection.edl       sélection importable dans Premiere Pro / DaVinci Resolve
  rapport.md / rapport.html   rapport de visionnage automatique
  pour_claude.md      condensé à donner à Claude pour l'analyse éditoriale
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import shutil
import sys
import time
import wave
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import LIBRARY, Status, ffprobe, fps_of, hms, run, source_name, srt_time, tc  # noqa: E402

MAX_SHOT = 120.0   # au-delà, un plan est subdivisé en segments pour garder une granularité utile
CHUNK_ASR = 900.0  # transcription par tranches de 15 min (mémoire constante)


# ------------------------------------------------------------------ étapes
def step_probe(src: Path, proj: Path) -> dict:
    p = proj / "technique.json"
    if not p.exists():
        p.write_text(json.dumps(ffprobe(src), indent=2))
    return json.loads(p.read_text())


def step_proxy(src: Path, proj: Path, probe: dict) -> None:
    """Une seule lecture de l'original → proxy 480p + audio 16 kHz."""
    proxy, wav = proj / "proxy.mp4", proj / "audio.wav"
    if proxy.exists() and (wav.exists() or not has_audio(probe)):
        return
    tmp_proxy, tmp_wav = proj / "proxy.tmp.mp4", proj / "audio.tmp.wav"
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-stats", "-i", str(src),
           "-map", "0:v:0", "-vf", "scale=-2:480", "-c:v", "libx264", "-preset", "veryfast", "-crf", "27",
           "-g", "48", "-pix_fmt", "yuv420p"]
    if has_audio(probe):
        cmd += ["-map", "0:a:0", "-c:a", "aac", "-b:a", "96k"]
    cmd += ["-movflags", "+faststart", str(tmp_proxy)]
    if has_audio(probe):
        cmd += ["-map", "0:a:0", "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", str(tmp_wav)]
    run(cmd)
    tmp_proxy.replace(proxy)
    if has_audio(probe):
        tmp_wav.replace(wav)


def has_audio(probe: dict) -> bool:
    return any(s.get("codec_type") == "audio" for s in probe.get("streams", []))


def step_scenes(proj: Path, duration: float) -> list[dict]:
    p = proj / "plans_bruts.json"
    if not p.exists():
        from scenedetect import AdaptiveDetector, SceneManager, open_video
        video = open_video(str(proj / "proxy.mp4"))
        sm = SceneManager()
        sm.add_detector(AdaptiveDetector())
        sm.auto_downscale = True
        sm.detect_scenes(video, show_progress=False)
        shots = [(a.seconds, b.seconds) for a, b in sm.get_scene_list()]
        if not shots:
            shots = [(0.0, duration)]
        p.write_text(json.dumps(shots))
    shots = json.loads(p.read_text())
    scenes = []
    for k, (a, b) in enumerate(shots, 1):
        n = max(1, math.ceil((b - a) / MAX_SHOT))
        for j in range(n):
            s, e = a + (b - a) * j / n, a + (b - a) * (j + 1) / n
            scenes.append({"plan": k, "segment": j + 1 if n > 1 else None, "start": round(s, 3), "end": round(e, 3)})
    for i, sc in enumerate(scenes, 1):
        sc["index"] = i
    return scenes


def step_transcribe(proj: Path, model_name: str, language: str | None) -> list[dict]:
    out = proj / "transcription.json"
    if out.exists():
        return json.loads(out.read_text())["segments"]
    wav = proj / "audio.wav"
    if not wav.exists():
        out.write_text(json.dumps({"language": None, "segments": [], "note": "pas de piste audio"}))
        return []
    import numpy as np
    from faster_whisper import WhisperModel
    model = WhisperModel(model_name, device="auto", compute_type="int8")
    partial = proj / "transcription.partial.json"
    state = json.loads(partial.read_text()) if partial.exists() else {"next": 0.0, "segments": [], "language": language}
    with wave.open(str(wav)) as w:
        rate, total = w.getframerate(), w.getnframes()
        dur = total / rate
        while state["next"] < dur:
            t0 = state["next"]
            w.setpos(int(t0 * rate))
            frames = w.readframes(int(CHUNK_ASR * rate))
            audio = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0
            segs, info = model.transcribe(audio, language=state["language"], vad_filter=True, beam_size=5,
                                          condition_on_previous_text=False)
            state["language"] = state["language"] or info.language
            for s in segs:
                txt = s.text.strip()
                if txt:
                    state["segments"].append({"start": round(t0 + s.start, 2), "end": round(t0 + s.end, 2),
                                              "text": txt, "avg_logprob": round(s.avg_logprob, 3)})
            state["next"] = t0 + CHUNK_ASR
            partial.write_text(json.dumps(state))
            print(f"  transcription : {hms(min(state['next'], dur))} / {hms(dur)}", flush=True)
    out.write_text(json.dumps({"language": state["language"], "model": model_name, "segments": state["segments"]},
                              ensure_ascii=False, indent=1))
    partial.unlink(missing_ok=True)
    return state["segments"]


def loudness_per_second(proj: Path) -> list[float]:
    """Niveau RMS (dBFS) seconde par seconde, lu en flux."""
    p = proj / "niveau_sonore.json"
    if p.exists():
        return json.loads(p.read_text())
    wav = proj / "audio.wav"
    levels = []
    if wav.exists():
        import numpy as np
        with wave.open(str(wav)) as w:
            rate = w.getframerate()
            while True:
                fr = w.readframes(rate)
                if not fr:
                    break
                x = np.frombuffer(fr, dtype=np.int16).astype(np.float32) / 32768.0
                levels.append(round(20 * math.log10(max(1e-6, float(np.sqrt(np.mean(x * x))))), 1))
    p.write_text(json.dumps(levels))
    return levels


def step_thumbs(proj: Path, scenes: list[dict]) -> None:
    d = proj / "vignettes"
    d.mkdir(exist_ok=True)
    for sc in scenes:
        f = d / f"plan_{sc['index']:04d}.jpg"
        sc["vignette"] = f"vignettes/{f.name}"
        if f.exists():
            continue
        t = sc["start"] + (sc["end"] - sc["start"]) / 2
        run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-ss", f"{t:.3f}", "-i", str(proj / "proxy.mp4"),
             "-frames:v", "1", "-vf", "scale=320:-2", "-q:v", "4", str(f)])


def step_sheets(proj: Path, scenes: list[dict], fps: float) -> list[str]:
    from PIL import Image, ImageDraw
    d = proj / "planches"
    d.mkdir(exist_ok=True)
    cols, rows, W = 4, 5, 320
    sheets = []
    for n in range(0, len(scenes), cols * rows):
        f = d / f"planche_{n // (cols * rows) + 1:03d}.jpg"
        sheets.append(f"planches/{f.name}")
        if f.exists():
            continue
        group = scenes[n:n + cols * rows]
        thumbs = [Image.open(proj / s["vignette"]).convert("RGB") for s in group]
        H = max(t.height for t in thumbs)
        sheet = Image.new("RGB", (cols * W, rows * (H + 22)), "white")
        draw = ImageDraw.Draw(sheet)
        for k, (s, t) in enumerate(zip(group, thumbs)):
            x, y = (k % cols) * W, (k // cols) * (H + 22)
            sheet.paste(t, (x, y + 22))
            draw.text((x + 4, y + 5), f"#{s['index']}  {tc(s['start'], fps)}", fill="black")
        sheet.save(f, quality=82)
    return sheets


# ------------------------------------------------------------------ assemblage
def enrich(scenes, segments, levels):
    for sc in scenes:
        txt = [s["text"] for s in segments if s["end"] > sc["start"] and s["start"] < sc["end"]]
        sc["dialogue"] = " ".join(txt)
        dur = max(0.04, sc["end"] - sc["start"])
        sc["duree"] = round(dur, 2)
        sc["mots_par_s"] = round(len(sc["dialogue"].split()) / dur, 2)
        lv = levels[int(sc["start"]):max(int(sc["start"]) + 1, int(math.ceil(sc["end"])))]
        sc["niveau_moyen_db"] = round(sum(lv) / len(lv), 1) if lv else None
        sc["niveau_max_db"] = max(lv) if lv else None
    # score heuristique : niveau sonore relatif + densité de parole + pics
    def z(vals):
        v = [x for x in vals if x is not None]
        if len(v) < 2:
            return [0.0 for _ in vals]
        m = sum(v) / len(v)
        sd = (sum((x - m) ** 2 for x in v) / len(v)) ** 0.5 or 1
        return [((x - m) / sd if x is not None else 0.0) for x in vals]
    zl = z([s["niveau_moyen_db"] for s in scenes])
    zp = z([s["niveau_max_db"] for s in scenes])
    zw = z([s["mots_par_s"] for s in scenes])
    for s, a, b, c in zip(scenes, zl, zp, zw):
        s["score"] = round(0.4 * a + 0.3 * b + 0.3 * c, 2)
    return scenes


def write_outputs(src: Path, proj: Path, probe: dict, scenes, segments, sheets, fps, language, model):
    dur = float(probe["format"].get("duration", 0))
    (proj / "scenes.json").write_text(json.dumps(scenes, ensure_ascii=False, indent=1))
    with open(proj / "scenes.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["index", "plan", "segment", "tc_debut", "tc_fin", "debut_s", "fin_s", "duree_s",
                    "niveau_moyen_db", "niveau_max_db", "mots_par_s", "score", "vignette", "dialogue"])
        for s in scenes:
            w.writerow([s["index"], s["plan"], s["segment"] or "", tc(s["start"], fps), tc(s["end"], fps), s["start"],
                        s["end"], s["duree"], s["niveau_moyen_db"], s["niveau_max_db"], s["mots_par_s"], s["score"],
                        s["vignette"], s["dialogue"]])
    # transcription
    with open(proj / "transcription.txt", "w", encoding="utf-8") as f:
        for s in segments:
            f.write(f"[{hms(s['start'])}] {s['text']}\n")
    with open(proj / "transcription.srt", "w", encoding="utf-8") as f:
        for i, s in enumerate(segments, 1):
            f.write(f"{i}\n{srt_time(s['start'])} --> {srt_time(s['end'])}\n{s['text']}\n\n")
    # chronologie
    with open(proj / "chronologie.md", "w", encoding="utf-8") as f:
        f.write(f"# Chronologie — {src.name}\n\n| # | Début | Fin | Durée | Dialogue (extrait) |\n|---|---|---|---|---|\n")
        for s in scenes:
            d = s["dialogue"][:140].replace("|", "/")
            f.write(f"| {s['index']} | {tc(s['start'], fps)} | {tc(s['end'], fps)} | {s['duree']:.1f} s | {d} |\n")
    # moments forts candidats
    top = sorted(scenes, key=lambda s: s["score"], reverse=True)[:max(5, len(scenes) // 10)]
    top_sorted = sorted(top, key=lambda s: s["start"])
    with open(proj / "moments.md", "w", encoding="utf-8") as f:
        f.write("# Moments forts candidats (repérage automatique)\n\n"
                "Classement heuristique (niveau sonore + pics + densité de parole). Ce n'est pas un jugement "
                "artistique : à valider en regardant les vignettes et le proxy.\n\n")
        for s in sorted(top, key=lambda s: -s["score"]):
            f.write(f"- **#{s['index']}** {tc(s['start'], fps)} → {tc(s['end'], fps)} (score {s['score']}) "
                    f"— {s['dialogue'][:160] or '(sans dialogue)'}\n")
    write_edl(proj / "selection.edl", source_name(src), top_sorted, fps)
    # rapports
    v = next((s for s in probe["streams"] if s["codec_type"] == "video"), {})
    a = next((s for s in probe["streams"] if s["codec_type"] == "audio"), {})
    size_go = int(probe["format"].get("size", 0)) / 1e9
    tech = (f"- Fichier : `{src.name}` ({size_go:.2f} Go)\n- Durée : {hms(dur)}\n"
            f"- Vidéo : {v.get('codec_name')} {v.get('width')}×{v.get('height')} à {fps:.3f} i/s, "
            f"{v.get('pix_fmt')}\n- Audio : {a.get('codec_name', 'aucun')} {a.get('sample_rate', '')} Hz, "
            f"{a.get('channels', '')} canal(aux)\n- Débit global : {int(probe['format'].get('bit_rate', 0)) / 1e6:.1f} Mb/s\n")
    words = sum(len(s["text"].split()) for s in segments)
    coverage = (
        "## Ce qui a été traité (et ce qui ne l'a pas été)\n\n"
        f"- **Détection des plans** : toutes les images du proxy 480p ont été décodées et comparées "
        f"({len(set(s['plan'] for s in scenes))} plans, subdivisés en {len(scenes)} segments de {int(MAX_SHOT)} s max).\n"
        f"- **Transcription** : toute la piste audio ({hms(dur)}) avec Whisper « {model} », langue « {language} » "
        f"— {len(segments)} répliques, {words} mots. Fiabilité variable selon le son ; à relire avant diffusion.\n"
        f"- **Images regardées par Claude** : uniquement les vignettes (1 image par segment, "
        f"{len(scenes)} images) et les planches contact. Claude n'a pas visionné le film image par image.\n"
        "- **Moments forts** : repérage statistique (son et parole), pas un jugement artistique.\n")
    (proj / "rapport.md").write_text(
        f"# Rapport de visionnage — {src.name}\n\n_Généré le {time.strftime('%Y-%m-%d %H:%M')}_\n\n"
        f"## Technique\n\n{tech}\n{coverage}\n## Moments forts candidats\n\n"
        + "".join(f"- #{s['index']} {tc(s['start'], fps)} — {s['dialogue'][:120] or '(sans dialogue)'}\n"
                  for s in top_sorted)
        + "\n## Fichiers\n\n- `transcription.txt` / `.srt` — dialogues\n- `scenes.csv` / `.json` — plans\n"
          "- `chronologie.md` — chronologie complète\n- `planches/` — planches contact\n"
          "- `selection.edl` — sélection à importer dans Premiere Pro ou DaVinci Resolve\n", encoding="utf-8")
    write_html(proj, src, tech, coverage, scenes, fps)
    # condensé pour Claude
    with open(proj / "pour_claude.md", "w", encoding="utf-8") as f:
        f.write(f"# Condensé d'analyse — {src.name}\n\n{tech}\n{coverage}\n"
                f"## Planches contact à regarder\n\n" + "".join(f"- `{proj / s}`\n" for s in sheets) +
                "\n## Plans (index, timecodes, niveau, score, dialogue)\n\n")
        for s in scenes:
            f.write(f"#{s['index']} {tc(s['start'], fps)}-{tc(s['end'], fps)} ({s['duree']:.0f}s, "
                    f"{s['niveau_moyen_db']} dB, score {s['score']}) {s['dialogue'][:300]}\n")


def write_edl(path: Path, clip: str, scenes, fps: float) -> None:
    """EDL CMX3600 : importable dans Premiere Pro (Fichier > Importer) et DaVinci Resolve."""
    reel = "AX"
    lines = [f"TITLE: SELECTION {Path(clip).stem[:40]}", "FCM: NON-DROP FRAME", ""]
    rec = 3600.0  # piste d'enregistrement à 01:00:00:00
    for i, s in enumerate(scenes, 1):
        d = s["end"] - s["start"]
        lines.append(f"{i:03d}  {reel:<8} AA/V  C        {tc(s['start'], fps)} {tc(s['end'], fps)} "
                     f"{tc(rec, fps)} {tc(rec + d, fps)}")
        lines.append(f"* FROM CLIP NAME: {clip}")
        lines.append(f"* COMMENT: plan #{s['index']} score {s['score']}")
        lines.append("")
        rec += d
    path.write_text("\n".join(lines))


def write_html(proj: Path, src: Path, tech: str, coverage: str, scenes, fps) -> None:
    import html
    md2 = lambda t: "".join(f"<li>{html.escape(l[2:])}</li>" for l in t.splitlines() if l.startswith("- "))
    rows = "".join(
        f"<div class=s><img loading=lazy src='{s['vignette']}'><div><b>#{s['index']}</b> {tc(s['start'], fps)} "
        f"<small>({s['duree']:.0f} s · score {s['score']})</small><br>{html.escape(s['dialogue'][:240])}</div></div>"
        for s in scenes)
    (proj / "rapport.html").write_text(f"""<!doctype html><html lang=fr><meta charset=utf-8>
<meta name=viewport content="width=device-width,initial-scale=1"><title>Rapport — {html.escape(src.name)}</title>
<style>body{{font:15px/1.4 system-ui;margin:0;padding:16px;max-width:900px;margin:auto}}
.s{{display:flex;gap:10px;border-bottom:1px solid #ddd;padding:8px 0}}img{{width:160px;height:auto;flex:none}}
@media(prefers-color-scheme:dark){{body{{background:#151515;color:#eee}}}}</style>
<h1>{html.escape(src.name)}</h1><ul>{md2(tech)}</ul><h2>Couverture de l'analyse</h2><ul>{md2(coverage)}</ul>
<p><a href=proxy.mp4>Proxy</a> · <a href=transcription.srt>SRT</a> · <a href=scenes.csv>CSV</a>
· <a href=selection.edl>EDL</a></p><h2>Plans</h2>{rows}</html>""", encoding="utf-8")


# ------------------------------------------------------------------ main
def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("video", type=Path)
    ap.add_argument("--library", type=Path, default=LIBRARY)
    ap.add_argument("--id", help="identifiant du projet (par défaut : préfixe du nom de fichier)")
    ap.add_argument("--model", default="small", help="modèle Whisper : tiny, base, small, medium, large-v3")
    ap.add_argument("--language", default=None, help="fr, en… (détection automatique par défaut)")
    a = ap.parse_args()

    src = a.video.resolve()
    vid = a.id or (src.name.split("__")[0] if "__" in src.name else src.stem[:40])
    proj = a.library / "projects" / vid
    proj.mkdir(parents=True, exist_ok=True)
    st = Status(proj)
    st.set(state="running", source=str(src), started=st.data.get("started") or time.strftime("%Y-%m-%d %H:%M:%S"))
    usage = shutil.disk_usage(proj)
    print(f"Projet {vid} — espace libre {usage.free / 1e9:.1f} Go")
    t0 = time.time()
    try:
        steps = [("technique", None), ("proxy+audio", None), ("plans", None), ("transcription", None),
                 ("niveau sonore", None), ("vignettes", None), ("planches", None), ("rapports", None)]
        st.set(step=steps[0][0]); probe = step_probe(src, proj); st.done("technique")
        fps, dur = fps_of(probe), float(probe["format"].get("duration", 0))
        st.set(step="proxy+audio"); print("→ proxy + audio"); step_proxy(src, proj, probe); st.done("proxy+audio")
        st.set(step="plans"); print("→ détection des plans"); scenes = step_scenes(proj, dur); st.done("plans")
        st.set(step="transcription"); print("→ transcription")
        segments = step_transcribe(proj, a.model, a.language); st.done("transcription")
        language = json.loads((proj / "transcription.json").read_text()).get("language")
        st.set(step="niveau sonore"); levels = loudness_per_second(proj); st.done("niveau sonore")
        st.set(step="vignettes"); print("→ vignettes"); step_thumbs(proj, scenes); st.done("vignettes")
        st.set(step="planches"); sheets = step_sheets(proj, scenes, fps); st.done("planches")
        st.set(step="rapports"); scenes = enrich(scenes, segments, levels)
        write_outputs(src, proj, probe, scenes, segments, sheets, fps, language, a.model); st.done("rapports")
        st.set(state="done", step="terminé", duree_traitement_s=round(time.time() - t0))
        print(f"✔ Analyse terminée en {hms(time.time() - t0)} → {proj}")
        return 0
    except Exception as e:
        st.set(state="error", error=repr(e))
        raise


if __name__ == "__main__":
    sys.exit(main())
