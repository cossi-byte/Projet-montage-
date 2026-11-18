#!/usr/bin/env python3
"""Voix off de la pub (français), générée localement avec Chatterbox Multilingual (MIT).

Pour chaque phrase de voix.json : plusieurs prises, contrôle par transcription
automatique (faster-whisper), on garde la prise la plus fidèle qui tient dans le temps.
Sortie : build/cossi/voix/NN.wav + build/cossi/voix.wav (piste posée sur 30 s, 44,1 kHz).

    python pub-cossi/voix.py --ref voix_ref.wav [--takes 4]
"""
import argparse, json, os, re, unicodedata
import numpy as np, soundfile as sf, librosa

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "build", "cossi", "voix")
os.makedirs(OUT, exist_ok=True)
ap = argparse.ArgumentParser()
ap.add_argument("--ref", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "voix_ref.wav"))
ap.add_argument("--takes", type=int, default=4)
ap.add_argument("--only", default=None, help="indices à regénérer, ex. 2,5")
ap.add_argument("--exag", type=float, default=0.7)
ap.add_argument("--cfg", type=float, default=0.3)
a = ap.parse_args()
lines = json.load(open(os.path.join(os.path.dirname(__file__), "voix.json"), encoding="utf-8"))["lines"]
SR = 44100


def norm(s):
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z ]", " ", s.replace("œ", "oe")).split()


def align(ref, words):
    """Aligne dans l'ordre les mots attendus sur les mots reconnus (avec horodatage).
    Renvoie (part de mots manquants, fin du dernier mot attendu en s, mots parasites avant).
    Le nom propre est ignoré : la reconnaissance ne le connaît pas."""
    from difflib import SequenceMatcher
    r = [w for w in norm(ref) if w not in ("cossi", "agbokou")]
    hw = [(n, w.end) for w in words for n in norm(w.word)]
    j, miss, end, extra = 0, 0, None, 0
    for w in r:
        k = next((k for k in range(j, min(len(hw), j + 4)) if SequenceMatcher(None, w, hw[k][0]).ratio() >= 0.75), None)
        if k is None:
            miss += 1
            continue
        extra += k - j
        j, end = k + 1, hw[k][1]
    return miss / max(1, len(r)), end, extra


def trim(x, sr):
    yt, idx = librosa.effects.trim(x, top_db=38, frame_length=1024, hop_length=256)
    i0, i1 = max(0, idx[0] - int(0.03 * sr)), min(len(x), idx[1] + int(0.08 * sr))
    return x[i0:i1]


import torch
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
from faster_whisper import WhisperModel
torch.set_num_threads(os.cpu_count())
tts = ChatterboxMultilingualTTS.from_pretrained(device="cpu")
asr = WhisperModel("small", device="cpu", compute_type="int8")
only = set(map(int, a.only.split(","))) if a.only else None

for i, L in enumerate(lines):
    path = os.path.join(OUT, f"{i:02d}.wav")
    if only is not None and i not in only and os.path.exists(path):
        continue
    best = None
    for k in range(a.takes):
        torch.manual_seed(1000 * i + k)
        kw = dict(language_id="fr", exaggeration=a.exag, cfg_weight=a.cfg, temperature=0.75)
        if a.ref:
            kw["audio_prompt_path"] = a.ref
        wav = tts.generate(L["text"], **kw).squeeze().numpy()
        x = trim(librosa.resample(wav, orig_sr=tts.sr, target_sr=SR), SR)
        segs, _ = asr.transcribe(librosa.resample(x, orig_sr=SR, target_sr=16000), language="fr", beam_size=3, word_timestamps=True)
        segs = list(segs)
        words = [w for sg in segs for w in sg.words]
        hyp = " ".join(sg.text for sg in segs)
        err, end, extra = align(L["text"], words)
        if end is not None:                      # coupe ce qui suit le dernier mot attendu
            x = x[: min(len(x), int((end + 0.14) * SR))]
            fo = int(0.04 * SR); x[-fo:] *= np.linspace(1, 0, fo)
        dur = len(x) / SR
        over = max(0, dur / L["max"] - 1)
        cost = err * 3 + over * 2 + extra * 0.5
        print(f"[{i:02d}] prise {k}: {dur:.2f}s / {L['max']}s  err={err:.2f} extra={extra}  « {hyp.strip()} »", flush=True)
        if best is None or cost < best[0]:
            best = (cost, x, dur)
        if err == 0 and over == 0 and extra == 0:
            break
    sf.write(path, best[1], SR)

# pose sur la timeline 30 s (accélération douce si une phrase déborde, max ×1,2)
track = np.zeros(int(30 * SR), np.float32)
for i, L in enumerate(lines):
    x, _ = sf.read(os.path.join(OUT, f"{i:02d}.wav"), dtype="float32")
    dur = len(x) / SR
    if dur > L["max"]:
        x = librosa.effects.time_stretch(x, rate=min(L.get("maxrate", 1.2), dur / L["max"]))
    s = int(L["t"] * SR)
    x = x[: len(track) - s]
    track[s:s + len(x)] += x
track *= 0.95 / (np.abs(track).max() + 1e-9)
sf.write(os.path.join(ROOT, "build", "cossi", "voix.wav"), track, SR)
print("ok -> build/cossi/voix.wav")
