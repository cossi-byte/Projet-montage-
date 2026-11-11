#!/usr/bin/env python3
"""Construit la bande-son de « Koko et le petit œuf ».

- voix : synthèse vocale Piper (voix françaises), transposée vers l'aigu pour
  obtenir des timbres d'enfant / de personnages ;
- musique : entièrement synthétisée (marimba, ukulélé, basse, percussions) ;
- bruitages : boing, pop, sifflets, splash, etc. synthétisés ;
- produit build/audio.wav et film/lipsync.json (ouverture de bouche par image).
"""
import json, os, subprocess, sys, wave
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 44100
story = json.load(open(os.path.join(ROOT, "story.json"), encoding="utf-8"))
DUR, FPS = story["duration"], story["fps"]
N = int(DUR * SR)
BUILD = os.path.join(ROOT, "build")
VOX = os.path.join(BUILD, "vox")
os.makedirs(VOX, exist_ok=True)
rng = np.random.default_rng(7)


# ---------------------------------------------------------------- utilitaires
def read_wav(path):
    with wave.open(path) as w:
        sr = w.getframerate()
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    return x, sr


def resample(x, ratio):
    """Rééchantillonne : longueur de sortie = len(x) * ratio (interp. linéaire)."""
    n = max(1, int(len(x) * ratio))
    return np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x).astype(np.float32)


def lowpass(x, fc):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X / (1 + (f / fc) ** 4), len(x)).astype(np.float32)


def highpass(x, fc):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X * (f / fc) ** 4 / (1 + (f / fc) ** 4), len(x)).astype(np.float32)


def add(buf, x, t, gain=1.0, pan=0.0):
    """Ajoute le signal mono x dans le tampon stéréo à l'instant t (s)."""
    i = int(t * SR)
    if i >= N or i < 0:
        return
    x = x[: N - i]
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    buf[i:i + len(x), 0] += x * gain * l * 1.414
    buf[i:i + len(x), 1] += x * gain * r * 1.414


def tt(d):
    return np.arange(int(d * SR)) / SR


# ---------------------------------------------------------------------- voix
def tts(who, text, max_dur=None):
    v = story["voices"][who]
    f = 2 ** (v["semitones"] / 12)
    pace = v["pace"]
    for attempt in range(4):
        raw = os.path.join(VOX, "raw.wav")
        cmd = [sys.executable, "-m", "piper", "-m", os.path.join(ROOT, "voices", v["model"] + ".onnx"),
               "-f", raw, "--length-scale", f"{pace * f:.3f}", "--noise-scale", "0.75", "--noise-w-scale", "0.9"]
        if "speaker" in v:
            cmd += ["-s", str(v["speaker"])]
        subprocess.run(cmd, input=text.encode("utf-8"), check=True, capture_output=True)
        x, sr = read_wav(raw)
        # transposition : lecture f fois plus vite (hauteur ET formants montent -> timbre d'enfant)
        x = resample(x, SR / sr / f)
        # coupe les silences
        e = np.abs(x) > 0.02
        if e.any():
            a = max(0, np.argmax(e) - 400)
            b = min(len(x), len(x) - np.argmax(e[::-1]) + 2000)
            x = x[a:b]
        d = len(x) / SR
        if not max_dur or d <= max_dur:
            break
        pace *= max(0.75, max_dur / d * 0.97)
    x = x / (np.abs(x).max() + 1e-6) * 0.8 * v["gain"]
    fade = np.minimum(1, np.arange(len(x))[::-1] / 1500)
    return x * fade


def giggle(who, n):
    """Petit rire synthétique : n « ha » qui descendent."""
    base = {"koko": 520, "monkey": 640, "chick": 900}.get(who, 520)
    out = np.zeros(int((n * 0.17 + 0.2) * SR), np.float32)
    for k in range(n):
        d = 0.12
        t = tt(d)
        f = base * (1.25 - 0.05 * k) * (1 - 0.25 * t / d)
        ph = 2 * np.pi * np.cumsum(f) / SR
        src = sum(np.sin(h * ph) / h for h in range(1, 9))
        X = np.fft.rfft(src); fr = np.fft.rfftfreq(len(src), 1 / SR)
        form = np.exp(-((fr - 1000) / 450) ** 2) + 0.6 * np.exp(-((fr - 1700) / 500) ** 2) + 0.15
        y = np.fft.irfft(X * form, len(src)) * np.sin(np.pi * t / d) ** 0.7
        i = int(k * 0.17 * SR)
        out[i:i + len(y)] += y.astype(np.float32) * (1 - 0.06 * k)
    return out / np.abs(out).max() * 0.6


def build_voice():
    buf = np.zeros((N, 2), np.float32)
    env = {}  # enveloppes par personnage pour la synchro des bouches
    pans = {"narr": 0, "koko": -0.1, "monkey": 0.3, "turtle": 0.25, "giraffe": 0.3, "mama": 0.2, "chick": -0.2}
    lines = sorted(story["lines"], key=lambda l: l["t"])
    last_end = {}
    for ln in lines:
        who = ln["who"]
        speakers = story["choirs"].get(who, [who])
        longest = 0
        for k, sp in enumerate(speakers):
            x = giggle(sp, ln["giggle"]) if "giggle" in ln else tts(sp, ln["text"], ln.get("max"))
            if len(speakers) > 1:  # chœur : tout le monde tient dans la même durée
                target = ln["max"] * SR
                if len(x) > target:
                    x = resample(x, target / len(x))
            g = 0.9 if len(speakers) == 1 else 0.62
            off = 0.0 if k == 0 else rng.uniform(0.0, 0.035)
            add(buf, x, ln["t"] + off, g, pans.get(sp, 0) + (0 if len(speakers) == 1 else (k - len(speakers) / 2) * 0.3))
            e = env.setdefault(sp, np.zeros(N, np.float32))
            i = int((ln["t"] + off) * SR)
            e[i:i + len(x)] = np.maximum(e[i:i + len(x)], np.abs(x[: N - i]))
            longest = max(longest, len(x) / SR)
        end = ln["t"] + longest
        warn = ""
        for sp in speakers:
            if last_end.get(sp, 0) > ln["t"]:
                warn = "  <-- CHEVAUCHEMENT"
            last_end[sp] = end
        print(f"{ln['t']:7.2f} -> {end:7.2f}  {who:8s} {ln['text']}{warn}")
    return buf, env


# ------------------------------------------------------------------- musique
NOTE = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def hz(name):
    n, o = name[:-1], int(name[-1])
    semi = NOTE[n[0]] + (1 if "#" in n else 0)
    return 440 * 2 ** ((semi - 9) / 12 + (o - 4))


def marimba(f, d=0.6):
    t = tt(d)
    return (np.sin(2 * np.pi * f * t) * np.exp(-t * 7) + 0.35 * np.sin(2 * np.pi * 4 * f * t) * np.exp(-t * 22)
            + 0.1 * np.sin(2 * np.pi * 10 * f * t) * np.exp(-t * 40)) * np.minimum(1, t * 800)


def bell(f, d=1.0):
    t = tt(d)
    return (np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * 2.76 * f * t) * np.exp(-t * 6)
            + 0.25 * np.sin(2 * np.pi * 5.4 * f * t) * np.exp(-t * 10)) * np.exp(-t * 4.5) * np.minimum(1, t * 900)


def whistle(f, d):
    t = tt(d)
    vib = 1 + 0.008 * np.sin(2 * np.pi * 5.5 * t) * np.minimum(1, t * 4)
    env = np.minimum(1, t * 40) * np.minimum(1, (d - t) * 25)
    ph = 2 * np.pi * np.cumsum(f * vib) / SR
    return (np.sin(ph) + 0.15 * np.sin(2 * ph)) * env


def pluck(f, d=0.7):
    t = tt(d)
    s = sum(np.sin(2 * np.pi * f * k * t) * np.exp(-t * (4 + 2.5 * k)) / k for k in range(1, 7))
    return s * np.minimum(1, t * 1500)


def bass(f, d=0.45):
    t = tt(d)
    return (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t)) * np.minimum(1, t * 200) * np.exp(-t * 5)


def kick():
    t = tt(0.25)
    return np.sin(2 * np.pi * np.cumsum(45 + 90 * np.exp(-t * 30)) / SR) * np.exp(-t * 14)


def shaker(d=0.05):
    t = tt(d)
    return highpass(rng.standard_normal(len(t)).astype(np.float32), 6000) * np.exp(-t * 70)


def clap():
    t = tt(0.12)
    n = rng.standard_normal(len(t)).astype(np.float32)
    n = lowpass(highpass(n, 900), 3500)
    return n * (np.exp(-t * 45) + 0.6 * np.exp(-np.abs(t - 0.012) * 300) + 0.5 * np.exp(-np.abs(t - 0.024) * 300))


CHORDS = {"C": ["C3", "E3", "G3", "C4"], "G": ["B2", "D3", "G3", "B3"], "Am": ["A2", "C3", "E3", "A3"],
          "F": ["A2", "C3", "F3", "A3"]}
ROOTS = {"C": "C2", "G": "G1", "Am": "A1", "F": "F1"}
VERSE_CH = ["C", "G", "Am", "F"]
REFR_CH = ["C", "F", "G", "C"]
# mélodies : (temps dans la mesure en noires, note, durée en noires)
VERSE_MEL = [
    [(0, "E5", 1), (1, "G5", .5), (1.5, "E5", .5), (2, "C5", 1), (3, "E5", 1)],
    [(0, "D5", 1), (1, "G5", .5), (1.5, "D5", .5), (2, "B4", 1), (3, "D5", 1)],
    [(0, "C5", 1), (1, "E5", .5), (1.5, "C5", .5), (2, "A4", 1), (3, "C5", 1)],
    [(0, "A4", .5), (.5, "C5", .5), (1, "F5", 1), (2, "E5", .5), (2.5, "D5", .5), (3, "G4", 1)],
]
REFR_MEL = [
    [(0, "E5", .5), (.5, "E5", .5), (1, "G5", 1), (2, "E5", .5), (2.5, "E5", .5), (3, "G5", 1)],
    [(0, "A5", .5), (.5, "A5", .5), (1, "G5", .5), (1.5, "F5", .5), (2, "E5", 2)],
    [(0, "D5", .5), (.5, "E5", .5), (1, "F5", 1), (2, "G5", 2)],
    [(0, "G5", .5), (.5, "A5", .5), (1, "G5", .5), (1.5, "E5", .5), (2, "D5", .5), (2.5, "D5", .5), (3, "C5", 1)],
]


def section(t):
    """(niveau 0-3, type de mélodie) selon le moment du film."""
    refr = [(47, 55), (85, 93), (150, 158), (166, 174)]
    for a, b in refr:
        if a <= t < b:
            return 3, "refrain"
    if t < 2: return 1, "verse"
    if t < 6: return 1, None          # l'œuf tombe : on laisse la place aux boings
    if t < 14: return 1, None
    if t < 18: return 2, "verse"      # départ à l'aventure
    if t < 39: return 1, None         # rencontre du singe
    if t < 47: return 2, "verse"      # liane
    if t < 59: return 2, "verse"
    if t < 76: return 1, None         # rencontre de la tortue
    if t < 85: return 2, "verse"      # traversée
    if t < 97: return 2, "verse"
    if t < 115: return 1, None        # rencontre de la girafe
    if t < 120: return 2, "verse"     # ascenseur girafe
    if t < 128: return 0, None        # suspense tout doux
    if t < 146: return 2, "verse"     # retrouvailles
    if t < 150: return 1, None
    if t < 176: return 3, "verse"     # danse
    return 0, None


def build_music():
    buf = np.zeros((N, 2), np.float32)
    beat = 0.5
    for bar in range(int(DUR / 2)):
        t0 = bar * 2.0
        lvl, mel = section(t0)
        if t0 >= 176:
            break
        chords = REFR_CH if mel == "refrain" else VERSE_CH
        ch = chords[bar % 4]
        if lvl == 0:  # nappes douces + petites clochettes
            for i, n in enumerate(CHORDS[ch][1:]):
                add(buf, bell(hz(n) * 2, 1.8), t0 + i * 0.5, 0.05, (i - 1) * 0.5)
            continue
        # basse
        add(buf, bass(hz(ROOTS[ch]) * 2), t0, 0.30)
        add(buf, bass(hz(ROOTS[ch]) * 2), t0 + 2 * beat, 0.24)
        if lvl >= 2:
            add(buf, bass(hz(ROOTS[ch]) * 3, 0.25), t0 + 3.5 * beat, 0.16)
        # ukulélé à contretemps
        for b in (0.5, 1.5, 2.5, 3.5) if lvl >= 2 else (1, 3):
            for i, n in enumerate(CHORDS[ch]):
                add(buf, pluck(hz(n) * 2, 0.5), t0 + b * beat + i * 0.012, 0.045 if lvl >= 2 else 0.035, -0.4)
        # arpège marimba doux (toujours là : fil conducteur)
        for i, n in enumerate([0, 1, 2, 3, 2, 1, 2, 1] if lvl >= 2 else [0, 2, 1, 3]):
            step = 0.5 if lvl >= 2 else 1.0
            add(buf, marimba(hz(CHORDS[ch][n]) * 2), t0 + i * step * beat, 0.08, 0.45)
        # percussions
        if lvl >= 2:
            add(buf, kick(), t0, 0.5); add(buf, kick(), t0 + 2 * beat, 0.45)
            for i in range(8):
                add(buf, shaker(), t0 + i * 0.5 * beat, 0.05 if i % 2 else 0.08, 0.3)
        else:
            for i in (1, 3):
                add(buf, shaker(), t0 + i * beat, 0.05, 0.3)
        if lvl >= 3:
            add(buf, clap(), t0 + beat, 0.22, -0.2); add(buf, clap(), t0 + 3 * beat, 0.22, 0.2)
            add(buf, kick(), t0 + 2.5 * beat, 0.3)
        # mélodie
        if mel:
            M = (REFR_MEL if mel == "refrain" else VERSE_MEL)[bar % 4]
            for (b, n, d) in M:
                f = hz(n)
                if mel == "refrain":
                    add(buf, whistle(np.full(int(d * beat * SR * 0.92), f), d * beat * 0.92), t0 + b * beat, 0.085, 0.1)
                    add(buf, bell(f * 2, 0.7), t0 + b * beat, 0.07, -0.2)
                    add(buf, marimba(f, 0.6), t0 + b * beat, 0.13, 0.0)
                else:
                    add(buf, marimba(f, 0.6), t0 + b * beat, 0.11 if lvl < 3 else 0.14, 0.1)
                    if lvl >= 3:
                        add(buf, bell(f * 2, 0.6), t0 + b * beat, 0.04, -0.3)
    # accord final « ta-da »
    for i, n in enumerate(["C4", "E4", "G4", "C5", "E5", "G5", "C6"]):
        add(buf, bell(hz(n), 2.5), 176 + i * 0.09, 0.09, (i - 3) * 0.2)
        add(buf, marimba(hz(n), 1.2), 176 + i * 0.09, 0.1, (3 - i) * 0.2)
    add(buf, bass(hz("C2") * 2, 1.5), 176, 0.3)
    return buf


# ----------------------------------------------------------------- bruitages
def sfx(kind, p=1.0, d=None):
    if kind == "boing":
        t = tt(0.55)
        f = (170 + 260 * np.sqrt(t / 0.55)) * p * (1 + 0.22 * np.sin(2 * np.pi * 17 * t) * np.exp(-t * 3))
        ph = 2 * np.pi * np.cumsum(f) / SR
        return (np.sin(ph) + 0.4 * np.sin(2 * ph) + 0.2 * np.sin(3 * ph)) * np.exp(-t * 5) * np.minimum(1, t * 300) * 0.7
    if kind == "pop":
        t = tt(0.09)
        f = (350 + 1500 * (t / 0.09)) * p
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 38) * np.minimum(1, t * 2000) * 0.8
    if kind == "bigpop":
        a = sfx("pop", 0.6)
        t = tt(0.3)
        b = lowpass(rng.standard_normal(len(t)).astype(np.float32), 2500) * np.exp(-t * 18) * 0.5
        b[: len(a)] += a
        return b
    if kind in ("whistle_down", "whistle_up"):
        d = d or 1.2
        t = tt(d)
        u = t / d
        f = 1900 * (0.28 ** u) if kind == "whistle_down" else 520 * (3.4 ** u)
        return whistle(f, d) * 0.28
    if kind == "whoosh":
        t = tt(0.7)
        n = rng.standard_normal(len(t)).astype(np.float32)
        return lowpass(highpass(n, 500), 2500) * np.sin(np.pi * t / 0.7) ** 2 * 0.35
    if kind == "thud":
        t = tt(0.25)
        return (np.sin(2 * np.pi * np.cumsum(60 + 80 * np.exp(-t * 25)) / SR) * np.exp(-t * 16)
                + lowpass(rng.standard_normal(len(t)).astype(np.float32), 600) * np.exp(-t * 30) * 0.4) * 0.8
    if kind == "splash":
        t = tt(0.8)
        n = lowpass(highpass(rng.standard_normal(len(t)).astype(np.float32), 700), 5000)
        x = n * np.exp(-t * 6) * np.minimum(1, t * 60) * 0.3
        for k in range(6):  # petites bulles
            b = sfx("pop", rng.uniform(1.2, 2.2)) * 0.3
            i = int(rng.uniform(0.05, 0.6) * SR)
            x[i:i + len(b)] += b[: len(x) - i]
        return x
    if kind == "crack":
        x = np.zeros(int(0.3 * SR), np.float32)
        for k in range(4):
            t = tt(0.03)
            c = highpass(rng.standard_normal(len(t)).astype(np.float32), 1800) * np.exp(-t * 160) * 0.6
            i = int(rng.uniform(0, 0.22) * SR)
            x[i:i + len(c)] += c
        return x
    if kind == "sparkle":
        x = np.zeros(int(1.2 * SR), np.float32)
        for k in range(10):
            f = hz(rng.choice(["C7", "E7", "G7", "A6", "D7", "C8"]))
            b = bell(f, 0.5) * 0.11
            i = int(k * 0.07 * SR + rng.uniform(0, 0.02) * SR)
            x[i:i + len(b)] += b[: len(x) - i]
        return x
    if kind == "chirp":
        t = tt(0.13)
        u = t / 0.13
        f = 2600 + 1500 * np.sin(np.pi * u)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * u) ** 0.6 * 0.3
    if kind == "flap":
        t = tt(0.2)
        return lowpass(rng.standard_normal(len(t)).astype(np.float32), 900) * np.sin(np.pi * t / 0.2) ** 2 * 0.45
    if kind == "tada":
        x = np.zeros(int(1.6 * SR), np.float32)
        for i, n in enumerate(["C5", "E5", "G5", "C6"]):
            b = bell(hz(n), 1.0) * 0.2
            j = int(i * 0.08 * SR)
            x[j:j + len(b)] += b[: len(x) - j]
        return x
    raise ValueError(kind)


def build_sfx():
    buf = np.zeros((N, 2), np.float32)
    for e in story["sfx"]:
        x = sfx(e["k"], e.get("p", 1.0), e.get("d"))
        add(buf, x.astype(np.float32), e["t"], 0.9, rng.uniform(-0.3, 0.3))
        if e["k"] == "chirp":  # « piou piou » = deux notes
            add(buf, x.astype(np.float32), e["t"] + 0.17, 0.9, 0.1)
    return buf


# --------------------------------------------------------------------- mixage
def smooth_env(x, ms):
    k = int(SR * ms / 1000)
    c = np.cumsum(np.insert(x, 0, 0))
    out = (c[k:] - c[:-k]) / k
    return np.pad(out, (k // 2, len(x) - len(out) - k // 2), mode="edge")


def main():
    print("== voix ==")
    voice, env = build_voice()
    print("== musique ==")
    music = build_music()
    print("== bruitages ==")
    fx = build_sfx()

    # la musique s'efface doucement sous les voix
    vmono = np.abs(voice).max(axis=1)
    active = smooth_env((smooth_env(vmono, 60) > 0.01).astype(np.float32), 350)
    duck = 1 - 0.5 * np.clip(active, 0, 1)
    mix = music * duck[:, None] * 1.25 + voice * 1.15 + fx * 0.8
    # fondus d'entrée / sortie
    fade = np.minimum(1, np.arange(N) / (0.3 * SR)) * np.minimum(1, (N - np.arange(N)) / (1.2 * SR))
    mix *= fade[:, None]
    mix = np.tanh(mix * 1.1) / np.tanh(1.1)          # limiteur doux
    mix = mix / np.abs(mix).max() * 0.94
    with wave.open(os.path.join(BUILD, "audio.wav"), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((mix * 32767).astype(np.int16).tobytes())

    # synchro labiale : ouverture de bouche par image et par personnage
    lips = {}
    hop = SR // FPS
    for who, e in env.items():
        s = smooth_env(e, 50)
        f = s[: (N // hop) * hop].reshape(-1, hop).max(axis=1)
        f = np.clip(f / 0.35, 0, 1)
        lips[who] = [round(float(v), 2) for v in f]
    json.dump(lips, open(os.path.join(ROOT, "film", "lipsync.json"), "w"))
    rms = float(np.sqrt((mix ** 2).mean()))
    print(f"OK build/audio.wav  ({DUR}s, rms={rms:.3f})  + film/lipsync.json")


if __name__ == "__main__":
    main()
