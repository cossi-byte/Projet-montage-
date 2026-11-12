#!/usr/bin/env python3
"""Bande-son de « La chanson des couleurs » (3 min, 110 BPM, do majeur).

- chœur d'enfants : synthèse vocale Piper (voix françaises), puis chaque syllabe est
  recalée sur sa note et sa durée avec le vocodeur WORLD (hauteur imposée, formants
  remontés pour un timbre d'enfant) ; quatre voix légèrement différentes forment le chœur ;
- instruments synthétisés : xylophone, ukulélé, petite basse, claquements de mains ;
- produit build/couleurs/audio.wav et couleurs/film/audio.json (bouches + claquements).
"""
import json, os, sys, wave
from multiprocessing import Pool
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
BUILD = os.path.join(ROOT, "build", "couleurs")
os.makedirs(BUILD, exist_ok=True)
song = json.load(open(os.path.join(os.path.dirname(HERE), "song.json"), encoding="utf-8"))
SR, FPS, DUR = 44100, song["fps"], song["duration"]
B = 60 / song["bpm"]            # une noire
BAR = 4 * B
N = int(DUR * SR)
rng = np.random.default_rng(11)

NOTE = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def midi(name):
    return 12 * (int(name[-1]) + 1) + NOTE[name[0]] + (1 if "#" in name else 0)


def hz(m):
    return 440 * 2 ** ((m - 69) / 12)


def parse(notes):
    """« E4:1 G4:.5 » -> [(midi, durée en noires)]"""
    return [(midi(a), float(b)) for a, b in (n.split(":") for n in notes.split())]


# ------------------------------------------------------------ plan du morceau
def plan():
    """Déroule song.json : lignes chantées, accords, claquements (temps en noires)."""
    lines, chords, claps, marks = [], [], [], []
    for sec in song["form"]:
        kind, bar0 = sec["kind"], sec["bar"]
        d = song["verses"][sec["color"]] if kind == "verse" else song[kind]
        marks.append({"kind": kind, "bar": bar0, "bars": d.get("bars", sec.get("bars")), "color": sec.get("color")})
        tpl = song["verse_chords"] if kind == "verse" else d["chords"]
        for b, row in enumerate(tpl):
            for beat, ch in row:
                chords.append(((bar0 + b) * 4 + beat, ch))
        for (b, beat, text, notes) in d["lines"]:
            # « | » découpe le vers en petits groupes chantés séparément (articulation plus nette)
            at, nts = (bar0 + b) * 4 + beat, parse(notes)
            for part in text.split("|"):
                k = int(part[0]) if part[0].isdigit() else len(nts)
                part = part.lstrip("0123456789")
                lines.append({"beat": at, "text": part.strip(), "notes": nts[:k], "kind": kind})
                at += sum(d_ for _, d_ in nts[:k]); nts = nts[k:]
            assert not nts, text
        for (b, beat) in (song["verse_claps"] if kind == "verse" else d.get("claps", [])):
            claps.append((bar0 + b) * 4 + beat)
        for (b, beat, notes) in (song["verse_xylo"] if kind == "verse" else d.get("xylo", [])):
            lines.append({"beat": (bar0 + b) * 4 + beat, "text": None, "notes": parse(notes), "kind": kind})
    return lines, sorted(chords), sorted(claps), marks


# ----------------------------------------------------------------- le chant
CHOIR = [  # (modèle, locuteur, formants, désaccord en cents, panoramique)
    ("fr_FR-siwis-medium", None, 1.15, 0, -0.15),
    ("fr_FR-siwis-medium", None, 1.23, 9, 0.35),
    ("fr_FR-siwis-medium", None, 1.30, -8, -0.45),
    ("fr_FR-upmc-medium", 0, 1.16, 5, 0.2),
]
_voice = {}


def tts(model, spk, text):
    from piper import PiperVoice, SynthesisConfig
    if model not in _voice:
        _voice[model] = PiperVoice.load(os.path.join(ROOT, "voices", model + ".onnx"))
    cfg = SynthesisConfig(length_scale=1.25, noise_scale=0.5, noise_w_scale=0.6, speaker_id=spk)
    ch = list(_voice[model].synthesize(text, cfg))
    x = np.concatenate([c.audio_float_array for c in ch]).astype(np.float64)
    e = np.abs(x) > 0.02
    a, b = max(0, np.argmax(e) - 200), len(x) - np.argmax(e[::-1]) + 600
    return x[a:b], ch[0].sample_rate


def sing(model, spk, formant, cents, text, notes):
    """Chante « text » : une note par syllabe. Renvoie (signal 44,1 kHz, syllabes trouvées ?)."""
    import pyworld as pw
    from scipy.signal import find_peaks, resample_poly
    x, sr = tts(model, spk, text)
    fp = 0.005
    f0, t = pw.harvest(x, sr, f0_floor=70, f0_ceil=500, frame_period=fp * 1000)
    sp, ap = pw.cheaptrick(x, f0, t, sr), pw.d4c(x, f0, t, sr)
    n, k = len(f0), len(notes)
    en = np.sqrt(sp.sum(axis=1)) * (f0 > 0)
    en = np.convolve(en, np.hanning(15) / 7.5, "same")
    # noyaux des syllabes = les k bosses d'énergie voisée les plus nettes
    for prom in (0.04, 0.015, 0.005):
        pk, pr = find_peaks(en, distance=9, prominence=en.max() * prom)
        if len(pk) >= k:
            break
    ok = len(pk) >= k
    if ok:
        pk = np.sort(pk[np.argsort(pr["prominences"])[-k:]])
        bd = [0] + [pk[i] + int(np.argmin(en[pk[i]:pk[i + 1]])) for i in range(k - 1)] + [n]
    else:
        bd = list(np.linspace(0, n, k + 1).astype(int))
        pk = [(bd[i] + bd[i + 1]) // 2 for i in range(k)]
    src, f0o, gate = [], [], []
    for i, (m, d) in enumerate(notes):
        tot = max(2, int(round(d * B / fp)))
        m_ = tot if d < 1.5 else int(tot * (0.86 if i == k - 1 else 0.94))   # petite respiration après les notes longues
        a, z, p = bd[i], bd[i + 1], int(pk[i])
        L = z - a
        if m_ <= L:
            seg = np.linspace(a, z - 1, m_)
        else:  # on garde l'attaque et la fin naturelles, on tient la voyelle au milieu
            h0, h1 = max(a, p - 3), min(z - 1, p + 3)
            hold = m_ - (L - (h1 - h0))
            seg = np.concatenate([np.arange(a, h0), np.linspace(h0, h1, hold), np.arange(h1 + 1, z)])
        g = np.ones(tot)
        seg = np.concatenate([seg, np.full(tot - len(seg), seg[-1])])
        if m_ < tot:
            g[m_:] = 0
        src.append(seg); gate.append(g)
        f0o.append(np.full(tot, hz(m + cents / 100)))
    src, f0o, gate = np.concatenate(src), np.concatenate(f0o), np.concatenate(gate)
    f0o = np.convolve(np.pad(f0o, 5, mode="edge"), np.ones(11) / 11, "valid")          # glissé entre les notes
    f0o *= 1 + 0.005 * np.sin(2 * np.pi * 5.2 * np.arange(len(f0o)) * fp + rng.uniform(0, 6))
    i0 = np.clip(np.floor(src).astype(int), 0, n - 1); i1 = np.minimum(i0 + 1, n - 1); w = (src - i0)[:, None]
    spn = sp[i0] * (1 - w) + sp[i1] * w
    apn = ap[i0] * (1 - w) + ap[i1] * w
    f0n = np.where(f0[np.clip(np.round(src).astype(int), 0, n - 1)] > 0, f0o, 0.0)
    nb = sp.shape[1]
    fi = np.arange(nb) / formant                                                         # formants vers l'aigu
    spw = np.stack([np.interp(fi, np.arange(nb), s) for s in spn])
    y = pw.synthesize(f0n, np.ascontiguousarray(spw), np.ascontiguousarray(apn), sr, fp * 1000)
    g = np.convolve(np.repeat(gate, int(sr * fp)), np.hanning(int(sr * 0.05)) / (sr * 0.025), "same")
    y = y[: len(g)] * g[: len(y)]
    y = resample_poly(y, SR, sr)
    return (y / (np.sqrt((y ** 2).mean()) + 1e-9) * 0.1).astype(np.float32), ok


def _job(a):
    vi, text, notes, take = a
    m, spk, fo, ce, _ = CHOIR[vi]
    return sing(m, spk, fo, ce, text, notes)


def add(buf, x, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= N or i < 0:
        return
    x = x[: N - i]
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    buf[i:i + len(x), 0] += x * gain * l * 1.414
    buf[i:i + len(x), 1] += x * gain * r * 1.414


TAKES = int(os.environ.get("TAKES", 4))


def _norm(t):
    import unicodedata
    t = unicodedata.normalize("NFD", t.lower())
    return "".join(c for c in t if c.isalpha() or c == " ").strip()


def best_takes(uniq):
    """Plusieurs prises par groupe de mots ; on garde celle qu'une reconnaissance vocale
    (Whisper) comprend le mieux : c'est notre « oreille » pour l'articulation."""
    import pickle, difflib
    from scipy.signal import resample_poly
    cache_f = os.path.join(BUILD, "prises.pkl")
    cache = pickle.load(open(cache_f, "rb")) if os.path.exists(cache_f) else {}
    todo = [u for u in uniq if u not in cache]
    if todo:
        jobs = [(vi, text, list(notes), k) for (text, notes) in todo for k in range(TAKES) for vi in range(len(CHOIR))]
        with Pool(4) as p:
            res = p.map(_job, jobs, chunksize=2)
        from faster_whisper import WhisperModel
        asr = WhisperModel("small", device="cpu", compute_type="int8")
        nv = len(CHOIR)
        for ui, u in enumerate(todo):
            scored = []
            for k in range(TAKES):
                ys = res[(ui * TAKES + k) * nv:(ui * TAKES + k + 1) * nv]
                n = max(len(y) for y, _ in ys)
                mono = np.zeros(n + SR // 2, np.float32)
                for y, _ in ys:
                    mono[SR // 4:SR // 4 + len(y)] += y
                x = resample_poly(mono / (np.abs(mono).max() + 1e-9) * 0.8, 160, 441).astype(np.float32)
                segs, _ = asr.transcribe(x, language="fr", beam_size=3, condition_on_previous_text=False)
                heard = _norm(" ".join(sg.text for sg in segs))
                sc = difflib.SequenceMatcher(None, _norm(u[0]), heard).ratio() + 0.02 * sum(ok for _, ok in ys)
                scored.append((sc, k, heard))
            sc, k, heard = max(scored)
            cache[u] = [y for y, _ in res[(ui * TAKES + k) * nv:(ui * TAKES + k + 1) * nv]]
            pickle.dump(cache, open(cache_f, "wb"))
            print(f"  {u[0]:32s} -> « {heard} »  ({sc:.2f}, prise {k + 1}/{TAKES}; autres : {', '.join(f'{x[0]:.2f}' for x in sorted(scored))})", flush=True)
        pickle.dump(cache, open(cache_f, "wb"))
    return cache


def build_choir(lines):
    sung = [l for l in lines if l["text"]]
    uniq = list(dict.fromkeys((l["text"], tuple(l["notes"])) for l in sung))
    out = best_takes(uniq)
    buf = np.zeros((N, 2), np.float32)
    for l in sung:
        for vi, y in enumerate(out[(l["text"], tuple(l["notes"]))]):
            add(buf, y, l["beat"] * B + rng.uniform(0, 0.018) - 0.03, 1.0, CHOIR[vi][4])
    return buf


# ------------------------------------------------------------- instruments
def tt(d):
    return np.arange(int(d * SR)) / SR


def lowpass(x, fc):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X / (1 + (f / fc) ** 4), len(x)).astype(np.float32)


def highpass(x, fc):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X * (f / fc) ** 4 / (1 + (f / fc) ** 4), len(x)).astype(np.float32)


def xylo(f, d=0.7):
    t = tt(d)
    return (np.sin(2 * np.pi * f * t) * np.exp(-t * 8) + 0.45 * np.sin(2 * np.pi * 3 * f * t) * np.exp(-t * 16)
            + 0.18 * np.sin(2 * np.pi * 6.27 * f * t) * np.exp(-t * 45)) * np.minimum(1, t * 1200)


def uke(f, d=0.6):
    t = tt(d)
    s = sum(np.sin(2 * np.pi * f * k * t + k) * np.exp(-t * (5 + 3 * k)) / k ** 1.2 for k in range(1, 8))
    return s * np.minimum(1, t * 2500)


def bass(f, d=0.5):
    t = tt(d)
    return (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t)) * np.minimum(1, t * 200) * np.exp(-t * 5)


def clap():
    t = tt(0.14)
    n = lowpass(highpass(rng.standard_normal(len(t)).astype(np.float32), 800), 3800)
    return n * (np.exp(-t * 42) + 0.6 * np.exp(-np.abs(t - 0.011) * 300) + 0.5 * np.exp(-np.abs(t - 0.023) * 300))


def bell(f, d=1.2):
    t = tt(d)
    return (np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * 2.76 * f * t) * np.exp(-t * 6)) * np.exp(-t * 4) * np.minimum(1, t * 900)


# ukulélé accordé sol-do-mi-la : les quatre cordes de chaque accord
UKE = {"C": ["G4", "C4", "E4", "C5"], "F": ["A4", "C4", "F4", "A4"], "G": ["G4", "D4", "G4", "B4"],
       "Am": ["A4", "C4", "E4", "A4"]}
ROOT_N = {"C": "C3", "F": "F2", "G": "G2", "Am": "A2"}


def build_music(lines, chords, claps, marks):
    buf = np.zeros((N, 2), np.float32)
    end_beat = song["end_bar"] * 4
    chord_at = lambda beat: [c for b, c in chords if b <= beat + 1e-6][-1]
    level = {}
    for m in marks:
        for b in range(m["bars"]):
            level[m["bar"] + b] = {"intro": 1 if b < 2 else 2, "verse": 2, "refrain": 3, "final": 3 if b < 11 else 0}[m["kind"]]
    # ukulélé : croches, bas-haut, accents sur 2 et 4
    for h in range(int(end_beat * 2)):
        beat = h / 2
        lvl = level.get(int(beat // 4), 0)
        if not lvl:
            continue
        ch, up = chord_at(beat), h % 2 == 1
        if lvl == 1 and up:
            continue
        g = (0.05 if up else 0.075) * (1.25 if beat % 2 == 1 else 1) * (1.1 if lvl == 3 else 1)
        strings = UKE[ch][::-1] if up else UKE[ch]
        for i, nme in enumerate(strings[:3] if up else strings):
            add(buf, uke(hz(midi(nme))), beat * B + i * 0.011, g, -0.35)
    # basse douce + claquements
    for bar in range(song["end_bar"]):
        if not level.get(bar):
            continue
        for beat in (0, 2):
            add(buf, bass(hz(midi(ROOT_N[chord_at(bar * 4 + beat)]))), (bar * 4 + beat) * B, 0.3 if beat == 0 else 0.22)
    for c in claps:
        for k in range(3):   # plusieurs enfants tapent presque ensemble
            add(buf, clap(), c * B + rng.uniform(-0.012, 0.012), 0.2, (k - 1) * 0.5)
    # xylophone : double la mélodie une octave au-dessus + réponses instrumentales
    for l in lines:
        beat = l["beat"]
        for (m, d) in l["notes"]:
            if l["text"] is None or l["kind"] != "shout":
                add(buf, xylo(hz(m + 12)), beat * B, 0.17 if l["text"] is None else 0.11, 0.3)
            beat += d
    # accord final
    t0 = song["final"]["tada_bar"] * BAR + [m for m in marks if m["kind"] == "final"][0]["bar"] * BAR
    for i, nme in enumerate(["C4", "E4", "G4", "C5", "E5", "G5", "C6"]):
        add(buf, bell(hz(midi(nme)), 3.5), t0 + i * 0.07, 0.07, (i - 3) * 0.2)
        add(buf, xylo(hz(midi(nme)), 1.5), t0 + i * 0.07, 0.12, (3 - i) * 0.2)
    for nme in UKE["C"]:
        add(buf, uke(hz(midi(nme)), 2.5), t0, 0.12, -0.3)
    add(buf, bass(hz(midi("C3")), 2.0), t0, 0.35)
    return buf


def build_sfx(marks):
    """Petits « pop » quand un objet apparaît, clochettes sur le titre et l'arc-en-ciel."""
    buf = np.zeros((N, 2), np.float32)

    def sparkle(t, n=10):
        for k in range(n):
            f = hz(midi(str(rng.choice(["C7", "E7", "G7", "A6", "D7"]))))
            add(buf, bell(f, 0.5), t + k * 0.07 + rng.uniform(0, 0.02), 0.035, rng.uniform(-0.6, 0.6))

    def pop(t, p=1.0):
        x = tt(0.09)
        add(buf, np.sin(2 * np.pi * np.cumsum((350 + 1500 * x / 0.09) * p) / SR) * np.exp(-x * 38) * np.minimum(1, x * 2000), t, 0.16, rng.uniform(-0.4, 0.4))

    for m in marks:
        t = m["bar"] * BAR
        if m["kind"] == "intro":
            sparkle(4 * BAR, 14)
        elif m["kind"] == "verse":
            sparkle(t, 6)
            for i in range(3):
                pop(t + 4 * BAR + i * B * 0.5, 1 + 0.15 * i)
        elif m["kind"] == "final":
            sparkle(t, 16); sparkle(t + 2 * BAR, 12)
            for b in (4, 5):
                for i in range(3):
                    pop(t + b * BAR + [0, 1, 2][i] * B, 1 + 0.12 * i)
    return buf


def smooth_env(x, ms):
    k = int(SR * ms / 1000)
    c = np.cumsum(np.insert(x, 0, 0))
    out = (c[k:] - c[:-k]) / k
    return np.pad(out, (k // 2, len(x) - len(out) - k // 2), mode="edge")


def reverb(x, mix=0.16, d=0.9):
    from scipy.signal import fftconvolve
    t = tt(d)
    out = x.copy()
    for c in range(2):
        ir = rng.standard_normal(len(t)) * np.exp(-t * 6.5) * (t > 0.012)
        ir = lowpass(ir.astype(np.float32), 5000)
        ir /= np.sqrt((ir ** 2).sum())
        out[:, c] += fftconvolve(x[:, c], ir)[: len(x)] * mix
    return out


def write(path, x):
    with wave.open(path, "wb") as w:
        w.setnchannels(x.shape[1] if x.ndim > 1 else 1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())


def main():
    lines, chords, claps, marks = plan()
    print("== chœur ==")
    choir = build_choir(lines)
    choir = highpass(choir[:, 0], 150)[:, None] * [1, 0] + highpass(choir[:, 1], 150)[:, None] * [0, 1]
    write(os.path.join(BUILD, "choeur.wav"), choir / np.abs(choir).max() * 0.9)
    print("== musique ==")
    music = build_music(lines, chords, claps, marks)
    fx = build_sfx(marks)
    mix = reverb(choir * 1.9 + music * 0.95 + fx)
    fade = np.minimum(1, np.arange(N) / (0.2 * SR)) * np.minimum(1, (N - np.arange(N)) / (1.5 * SR))
    mix *= fade[:, None]
    mix = np.tanh(mix * 0.9) / np.tanh(0.9)
    mix = mix / np.abs(mix).max() * 0.94
    write(os.path.join(BUILD, "audio.wav"), mix)

    # ouverture des bouches par image + instants des claquements
    hop = SR // FPS
    e = smooth_env(np.abs(choir).max(axis=1), 45)
    f = e[: (N // hop) * hop].reshape(-1, hop).max(axis=1)
    f = np.clip(f / (np.percentile(f[f > 0.001], 80) + 1e-9), 0, 1)
    json.dump({"choir": [round(float(v), 2) for v in f], "claps": [round(c * B, 3) for c in claps]},
              open(os.path.join(os.path.dirname(HERE), "film", "audio.json"), "w"))
    print(f"OK build/couleurs/audio.wav ({DUR}s, rms={float(np.sqrt((mix ** 2).mean())):.3f}) + couleurs/film/audio.json")


if __name__ == "__main__":
    main()
