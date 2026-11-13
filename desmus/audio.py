"""Bande-son DJ Desmus : amapiano instrumental + design sonore bande-annonce + voix.

Tout est synthétisé (aucun sample externe, aucun droit à payer).
Sortie : build/mix_<v>.wav + build/events_<v>.json (instants d'impact pour l'image).
"""
import json, os, subprocess, sys
import numpy as np
from timeline import build, seg, BEAT, BAR, HERE

SR = 48000
rng = np.random.default_rng(228)
VOICE = os.path.join(HERE, "build", "voice")


# ---------------------------------------------------------------- outils DSP
def t_(d):
    return np.arange(int(d * SR)) / SR


def fft_filter(x, lo=None, hi=None, slope=4):
    """Filtre passe-bande doux appliqué dans le domaine fréquentiel (statique)."""
    n = len(x)
    N = 1 << (n - 1).bit_length()
    X = np.fft.rfft(x, N, axis=0)
    f = np.fft.rfftfreq(N, 1 / SR)
    g = np.ones_like(f)
    if hi:
        g *= 1 / np.sqrt(1 + (f / hi) ** (2 * slope))
    if lo:
        g *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-3)) ** (2 * slope))
    if X.ndim == 2:
        g = g[:, None]
    return np.fft.irfft(X * g, N, axis=0)[:n]


def sweep_filter(x, cut_env, cuts=(250, 600, 1400, 3200, 8000, 18000)):
    """Filtre passe-bas variable : fondu entre versions filtrées (cut_env en Hz)."""
    versions = [fft_filter(x, hi=c) for c in cuts]
    lc = np.log(np.clip(cut_env, cuts[0], cuts[-1]))
    lcs = np.log(cuts)
    out = np.zeros_like(x)
    for i in range(len(cuts) - 1):
        w = np.clip((lc - lcs[i]) / (lcs[i + 1] - lcs[i]), 0, 1)
        inside = (lc >= lcs[i]) & (lc <= lcs[i + 1])
        wi = np.where(inside, w, 0)
        a = versions[i] if x.ndim == 1 else versions[i]
        if x.ndim == 2:
            out += np.where(inside[:, None], a * (1 - wi)[:, None] + versions[i + 1] * wi[:, None], 0)
        else:
            out += np.where(inside, a * (1 - wi) + versions[i + 1] * wi, 0)
    return out


def conv(x, ir):
    n = len(x) + len(ir) - 1
    N = 1 << (n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, N) * np.fft.rfft(ir, N), N)[:len(x)]


def reverb_ir(dur=2.2, decay=3.0, bright=6000, seed=1):
    r = np.random.default_rng(seed)
    t = t_(dur)
    L = r.standard_normal(len(t)) * np.exp(-t * decay)
    R = r.standard_normal(len(t)) * np.exp(-t * decay)
    L, R = fft_filter(L, lo=150, hi=bright), fft_filter(R, lo=150, hi=bright)
    L[:int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
    R[:int(0.017 * SR)] *= np.linspace(0, 1, int(0.017 * SR))
    return L / np.abs(L).sum() * 40, R / np.abs(R).sum() * 40


IR = reverb_ir()


def verb(mono_or_st, wet=0.3):
    x = mono_or_st if mono_or_st.ndim == 2 else np.stack([mono_or_st, mono_or_st], 1)
    m = x.mean(1)
    return x * (1 - wet * 0.3) + wet * np.stack([conv(m, IR[0]), conv(m, IR[1])], 1)


def place(track, sample, t, gain=1.0, pan=0.0):
    i = int(round(t * SR))
    if i >= len(track):
        return
    if sample.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        sample = np.stack([sample * l, sample * r], 1) * np.sqrt(2)
    j = min(len(track), i + len(sample))
    a = max(0, i)
    track[a:j] += sample[a - i:j - i] * gain


def note(n):  # numéro MIDI -> Hz
    return 440 * 2 ** ((n - 69) / 12)


# ---------------------------------------------------------------- instruments
def rhodes(f, dur=1.2, vel=1.0):
    t = t_(dur)
    x = np.zeros_like(t)
    for k, a in [(1, 1), (2, 0.35), (3, 0.12), (4, 0.06)]:
        x += a * np.sin(2 * np.pi * f * k * t * (1 + 0.0004 * k)) * np.exp(-t * (1.8 + 1.4 * k))
    bell = 0.25 * np.sin(2 * np.pi * f * 7.1 * t) * np.exp(-t * 18)
    x = (x + bell) * (1 + 0.12 * np.sin(2 * np.pi * 4.5 * t))
    x *= np.minimum(1, t / 0.004)
    rel = int(0.08 * SR)
    x[-rel:] *= np.linspace(1, 0, rel)
    return np.tanh(x * 0.9 * vel) * 0.5


def logdrum(f, dur=0.5, vel=1.0):
    t = t_(dur)
    fr = f * (1 + 0.9 * np.exp(-t * 38))
    ph = 2 * np.pi * np.cumsum(fr) / SR
    body = np.sin(ph) + 0.35 * np.sin(2 * ph + 0.4) + 0.12 * np.sin(3 * ph)
    env = np.exp(-t * 6.5) * np.minimum(1, t / 0.002)
    knock = fft_filter(rng.standard_normal(len(t)), lo=600, hi=2500) * np.exp(-t * 90) * 0.6
    return np.tanh(2.6 * body * env * vel) * 0.55 + knock * vel


def kick(vel=1.0):
    t = t_(0.45)
    fr = 48 + 110 * np.exp(-t * 32)
    x = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t * 7)
    click = fft_filter(rng.standard_normal(len(t)), lo=2000) * np.exp(-t * 250) * 0.2
    return np.tanh(1.6 * x) * 0.9 * vel + click


CLAP = None


def clap():
    global CLAP
    if CLAP is None:
        t = t_(0.35)
        env = np.zeros_like(t)
        for d in (0, 0.011, 0.023):
            env += np.where(t >= d, np.exp(-(t - d) * 120), 0)
        env += np.exp(-t * 18) * 0.35
        CLAP = fft_filter(rng.standard_normal(len(t)), lo=900, hi=4200) * env * 0.5
    return CLAP


def shaker(vel=1.0):
    t = t_(0.07)
    return fft_filter(rng.standard_normal(len(t)), lo=6500) * np.exp(-t * 60) * 0.18 * vel * np.minimum(1, t / 0.01)


def rim(vel=1.0):
    t = t_(0.12)
    x = np.sin(2 * np.pi * 820 * t) * np.exp(-t * 55) + 0.5 * np.sin(2 * np.pi * 1630 * t) * np.exp(-t * 80)
    return x * 0.22 * vel


def saw_pad(freqs, dur):
    t = t_(dur)
    x = np.zeros_like(t)
    for f in freqs:
        for det in (-0.006, 0, 0.0055):
            x += 2 * ((f * (1 + det) * t + rng.random()) % 1) - 1
    x /= len(freqs) * 3
    a = int(0.6 * SR)
    env = np.ones_like(t)
    env[:a] = np.linspace(0, 1, a) ** 2
    env[-a:] *= np.linspace(1, 0, a)
    return x * env


def sub_boom(dur=2.6, f0=62, f1=31):
    t = t_(dur)
    fr = f1 + (f0 - f1) * np.exp(-t * 2.2)
    x = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t * 1.6)
    return np.tanh(1.8 * x) * 0.9


def impact(big=1.0):
    t = t_(3.0)
    boom = sub_boom(3.0, 70, 30)
    crack = fft_filter(rng.standard_normal(len(t)), hi=5000) * np.exp(-t * 14) * 0.6
    metal = fft_filter(rng.standard_normal(len(t)), lo=3000) * np.exp(-t * 4) * 0.12
    x = (boom + crack + metal) * big
    return verb(x, 0.45)


def braam(dur=2.6, root=45):
    t = t_(dur)
    x = np.zeros_like(t)
    for n in (root, root + 12, root + 7 + 12, root + 24):
        for det in (-0.004, 0.004):
            x += 2 * ((note(n) * (1 + det) * t + rng.random()) % 1) - 1
    cut = 300 + 2400 * (1 - np.exp(-t * 3)) * np.exp(-t * 0.6)
    x = sweep_filter(x / 8, cut) * np.minimum(1, t / 0.02) * np.exp(-t * 0.9)
    return verb(np.tanh(2.2 * x) * 0.55, 0.35)


def whoosh(dur=0.55, up=True):
    t = t_(dur)
    n = rng.standard_normal(len(t))
    env = np.sin(np.pi * t / dur) ** 2
    cut = 600 + 7000 * (t / dur if up else 1 - t / dur)
    x = sweep_filter(n, cut) * env * 0.35
    pan = np.linspace(-0.8, 0.8, len(t))
    return np.stack([x * (1 - pan) / 2, x * (1 + pan) / 2], 1) * 1.6


def riser(dur):
    t = t_(dur)
    p = t / dur
    n = rng.standard_normal(len(t))
    x = sweep_filter(n, 300 + 12000 * p ** 2) * p ** 2.2 * 0.35
    tone = np.sin(2 * np.pi * np.cumsum(180 + 900 * p ** 2) / SR) * p ** 3 * 0.12
    return verb(x + tone, 0.3)


def rev_cymbal(dur=1.6):
    t = t_(dur)
    x = fft_filter(rng.standard_normal(len(t)), lo=4000) * (t / dur) ** 3 * 0.35
    return verb(x, 0.25)


def crash(dur=3.0):
    t = t_(dur)
    x = fft_filter(rng.standard_normal(len(t)), lo=3500) * np.exp(-t * 1.3) * 0.28
    return verb(x, 0.3)


def crowd(dur=2.4):
    t = t_(dur)
    x = np.zeros_like(t)
    for _ in range(40):  # voix lointaines qui crient « wooo »
        f = rng.uniform(180, 520)
        st = rng.uniform(0, 0.5)
        tt = np.clip(t - st, 0, None)
        fr = f * (1 + 0.25 * np.sin(2 * np.pi * rng.uniform(0.3, 1.2) * tt))
        v = np.sin(2 * np.pi * np.cumsum(fr) / SR)
        v = np.tanh(3 * v) * np.where(t > st, np.exp(-tt * rng.uniform(0.6, 1.4)), 0) * np.minimum(1, tt / 0.15)
        x += v
    x = fft_filter(x, lo=300, hi=3000) / 40
    noise = fft_filter(rng.standard_normal(len(t)), lo=400, hi=4000) * 0.08 * np.exp(-t * 0.6)
    env = np.minimum(1, t / 0.2) * np.minimum(1, (dur - t) / 0.6)
    return verb((x + noise) * env, 0.5) * 0.9


def crackle(dur):
    x = np.zeros(int(dur * SR))
    idx = rng.integers(0, len(x), int(dur * 25))
    x[idx] = rng.uniform(-1, 1, len(idx))
    return fft_filter(x, lo=1500, hi=9000) * 0.25


def scratch(src, dur=0.7):
    """Scratch de vinyle : on relit un accord en avant/arrière."""
    t = t_(dur)
    pos = 0.15 + 0.09 * np.sin(2 * np.pi * 4.2 * t) * np.sign(np.sin(2 * np.pi * 2.1 * t))
    i = np.clip((pos * SR).astype(int), 0, len(src) - 1)
    x = src[i] * np.minimum(1, np.abs(np.gradient(pos)) * SR * 0.9)
    return fft_filter(x, lo=250, hi=6000) * 0.9


# ---------------------------------------------------------------- composition
CHORDS = [  # i - VI - iv - V   (la mineur, soul/amapiano)
    (45, [60, 64, 67, 71]),        # Am9
    (41, [57, 60, 64, 67]),        # Fmaj9
    (38, [53, 57, 60, 64]),        # Dm9
    (40, [56, 59, 62, 65]),        # E7b9
]


def env_from(points, n):
    """Enveloppe linéaire par points (t, gain)."""
    tt = np.arange(n) / SR
    ts, gs = zip(*points)
    return np.interp(tt, ts, gs)


def make(version):
    tl = build(version)
    L = tl["length"]
    n = int(L * SR)
    g0 = tl["grid0"]
    drop = tl["drop"]
    S = lambda sid: seg(tl, sid)
    tr = {k: np.zeros((n, 2)) for k in ["pad", "keys", "log", "kick", "clap", "shk", "rim", "fx", "intro"]}
    events = {"impacts": [], "whooshes": [], "stops": [], "beats": []}

    # grille : on démarre la grille avant 0 pour que tout tombe juste
    nb = int((L - g0) / BEAT) + 8
    first_bar = -int(g0 / BAR) - 1
    for b in range(first_bar, int(L / BAR) + 2):
        tb = g0 + b * BAR
        root, ch = CHORDS[b % 4]
        if tb + BAR < 0 or tb > L:
            continue
        # pad (une mesure, accord tenu)
        pad = saw_pad([note(root + 12)] + [note(x) for x in ch], BAR + 0.6)
        place(tr["pad"], pad, max(tb, 0) if tb < 0 else tb, 0.5, 0)
        for step in range(16):
            ts = tb + step * BEAT / 4
            if ts < 0 or ts >= L:
                continue
            if step in (0, 6, 10):
                for k, m in enumerate(ch):
                    place(tr["keys"], rhodes(note(m), 0.9 if step else 1.4, 0.8 if step else 1.0), ts + 0.006 * k, 0.32, (k - 1.5) * 0.25)
            if step in (0, 3, 6, 10, 12, 14):
                f = note(root + (12 if step in (6, 14) else 0) + 12)
                if step == 12:
                    f = note(root + 7 + 12)
                place(tr["log"], logdrum(f / 2, 0.45, 1.0 if step in (0, 6) else 0.8), ts, 0.62)
            if step % 4 == 0:
                place(tr["kick"], kick(), ts, 0.7)
                events["beats"].append(round(ts, 3))
            if step in (4, 12):
                place(tr["clap"], verb(clap(), 0.35), ts, 0.55)
            place(tr["shk"], shaker(1.0 if step % 2 else 0.55), ts + (0.012 if step % 2 else 0), 0.9, 0.35)
            if step in (3, 7, 13):
                place(tr["rim"], rim(), ts, 0.9, -0.3)

    # ---------------- automation des pistes (sections)
    def T(sid, k="t0", d=0.0):
        s = S(sid)
        return None if s is None else s[k] + d

    pts = {k: [(0, 0)] for k in tr}

    def setg(names, t, g, fade=0.05):
        for nm in names:
            last = pts[nm][-1][1]
            pts[nm].append((t, last))
            pts[nm].append((t + fade, g))

    ALL = ["pad", "keys", "log", "kick", "clap", "shk", "rim"]
    # intro : nappe sombre seulement
    setg(["pad"], 0.0, 0.35, 2.5)
    s03 = T("s03")
    if s03:
        setg(["keys", "shk"], s03 - 0.05, 0.75, 0.3)
        setg(["pad"], s03, 0.6, 0.4)
    s05 = T("s05")
    if s05:
        setg(["log", "rim"], s05, 0.65, 0.2)
    s07 = T("s07")
    if s07:
        setg(ALL, s07 - 0.02, 1.0, 0.03)
        stop = T("s07", "t1")
        setg(ALL, stop - 0.02, 0.0, 0.02)          # « les conversations s'arrêtent » : tout coupe
        events["stops"].append(round(stop, 3))
        setg(ALL, T("s08") - 0.03, 1.0, 0.03)
    s08 = T("s08")
    if s08 and not s07:
        setg(ALL, s08 - 0.03, 1.0, 0.1)
    if T("s13a"):
        setg(ALL, T("s13a") - 0.03, 0.0, 0.03)    # 4 coups secs, plus de groove
        back = T("s14") or T("s17")
        setg(["pad", "keys", "shk"], back - 0.03, 0.8, 0.2)
        if T("s15"):
            setg(["log", "kick", "clap", "rim"], T("s15") - 0.03, 1.0, 0.05)
    if T("s16a") and not T("s15"):
        setg(ALL, T("s16a") - 0.03, 1.0, 0.1)
    if T("s16b"):
        setg(ALL, T("s16b") - 0.02, 0.0, 0.02)    # silence total sur « EST »
        setg(ALL, T("s16c") - 0.02, 1.0, 0.02)
    s17 = T("s17")
    setg(["kick", "clap", "log", "rim", "shk"], s17, 0.0, 0.6)
    setg(["keys"], s17, 0.4, 1.0)
    setg(["pad"], s17, 0.5, 1.0)
    setg(["pad", "keys"], T("s18a") - 0.1, 0.0, 0.4)
    setg(ALL, drop - 0.01, 1.25, 0.01)            # DROP
    setg(ALL, L - 0.7, 0.0, 0.65)

    mix = np.zeros((n, 2))
    for k in ALL:
        e = env_from(pts[k], n)
        mix += tr[k] * e[:, None]

    # intro : filtre fermé qui s'ouvre jusqu'au drop
    cut = np.full(n, 18000.0)
    tt = np.arange(n) / SR
    cut = np.where(tt < (s03 or 3), 450, cut)
    if s03:
        cut = np.where((tt >= s03) & (tt < (s07 or s08 or drop)), 2600, cut)
    cut = np.where((tt >= s17) & (tt < drop), 900 * np.exp(-(tt - s17) * 0.4) + 250, cut)
    mix = sweep_filter(mix, cut)

    # ---------------- design sonore
    fx = np.zeros((n, 2))
    # basses sourdes + battement de cœur pendant l'écran noir
    for k in range(12):
        tb = g0 + k * 2 * BEAT - BAR * 2
        while tb < 0:
            tb += BAR
        if tb < (S("s02")["t0"] if S("s02") else 4):
            place(fx, fft_filter(kick(), hi=180), tb, 0.5)
            place(fx, fft_filter(kick(0.6), hi=180), tb + 0.28, 0.35)
    place(fx, crackle(min(L, 6)), 0, 0.5)
    lui = [w for w in S("s02")["words"] if w[2].lower().startswith("lui")]
    t_lui = lui[0][0] if lui else S("s02")["t0"]
    place(fx, impact(0.9), t_lui, 0.8)
    events["impacts"].append(round(t_lui, 3))
    for sid in ["s03", "s05", "s06", "s07", "s10", "s12", "s14", "s15", "s17"]:
        if S(sid):
            place(fx, whoosh(0.5), S(sid)["t0"] - 0.35, 0.55)
            events["whooshes"].append(round(S(sid)["t0"], 3))
    if S("s03"):
        place(fx, sub_boom(), S("s03")["t0"], 0.6)
    if S("s05"):
        place(fx, braam(2.2, 45), S("s05")["t0"] + 1.2, 0.45)
    if S("s07"):
        place(fx, impact(0.6), S("s07")["t0"], 0.5)
        events["impacts"].append(S("s07")["t0"])
    if S("s08"):
        chord = sum(rhodes(note(m), 1.0) for m in CHORDS[0][1])
        w = [x for x in S("s08")["words"] if x[2].startswith("platines")]
        place(fx, scratch(chord, 0.75), (w[0][0] if w else S("s08")["t0"] + 1.2) + 0.15, 0.7)
    if S("s09"):
        place(fx, crash(), S("s09")["t0"], 0.8)
        place(fx, crowd(2.6), S("s09")["t0"] - 0.1, 0.55)
        events["impacts"].append(S("s09")["t0"])
    for sid in ["s13a", "s13b", "s13c", "s13d"]:
        if S(sid):
            place(fx, impact(0.55 if sid != "s13d" else 0.8), S(sid)["t0"], 0.6)
            r, chs = CHORDS[["s13a", "s13b", "s13c", "s13d"].index(sid)]
            place(fx, sum(rhodes(note(m), 0.9) for m in chs) * 0.5, S(sid)["t0"], 0.5)
            events["impacts"].append(S(sid)["t0"])
    if S("s16b"):
        place(fx, impact(1.0), S("s16b")["t0"], 0.75)
        events["impacts"].append(S("s16b")["t0"])
    # montée jusqu'au nom
    r0 = s17
    place(fx, riser(drop - r0 - 0.55), r0, 0.9)
    place(fx, rev_cymbal(1.2), drop - 1.2, 0.6)
    place(fx, sub_boom(2.0, 50, 28), S("s18a")["t0"], 0.45)
    place(fx, impact(1.4), drop, 1.0)
    place(fx, braam(3.2, 33), drop, 0.7)
    place(fx, crash(3.5), drop, 0.9)
    events["impacts"].append(drop)
    events["drop"] = drop

    # ---------------- voix
    voice = np.zeros(n)
    for s in tl["segments"]:
        a = np.load(os.path.join(VOICE, s["id"] + ".npy"))
        i = int(s["t0"] * SR)
        j = min(n, i + len(a))
        voice[i:j] += a[:j - i]
    # écho sur le nom
    name = S("s18b")
    a = np.load(os.path.join(VOICE, "s18b.npy"))
    for k, (d, g) in enumerate([(0.32, 0.35), (0.64, 0.18), (0.96, 0.08)]):
        i = int((name["t0"] + d) * SR)
        j = min(n, i + len(a))
        voice[i:j] += fft_filter(a, lo=300, hi=3500)[:j - i] * g
    vst = np.stack([voice, voice], 1)
    vst = vst + 0.10 * np.stack([conv(voice, IR[0]), conv(voice, IR[1])], 1)

    # ducking : la musique se baisse sous la voix
    env = np.abs(voice)
    k = int(0.03 * SR)
    env = np.convolve(env, np.ones(k) / k, "same")
    rel = np.exp(-1 / (0.35 * SR))
    # suivi d'enveloppe à relâchement lent (vectorisé par blocs)
    blk = 480
    e = env[: len(env) // blk * blk].reshape(-1, blk).max(1)
    out = np.zeros_like(e)
    cur = 0
    r = np.exp(-blk / (0.35 * SR))
    for i_, v in enumerate(e):
        cur = max(v, cur * r)
        out[i_] = cur
    env = np.repeat(out, blk)
    env = np.pad(env, (0, n - len(env)), mode="edge")
    duck = 1 - 0.62 * np.clip(env / 0.12, 0, 1)
    tt = np.arange(n) / SR
    duck = np.where(tt >= drop + 1.1, 1.0, duck)   # après le nom : la musique reprend tout

    master = mix * 0.55 * duck[:, None] + fx * 0.6 * np.clip(duck, 0.6, 1)[:, None] + vst * 1.0
    master = np.tanh(master * 1.1) / 1.1
    master[-int(0.05 * SR):] *= np.linspace(1, 0, int(0.05 * SR))[:, None]

    os.makedirs(os.path.join(HERE, "build"), exist_ok=True)
    raw = os.path.join(HERE, "build", f"raw_{version}.f32")
    master.astype(np.float32).tofile(raw)
    out = os.path.join(HERE, "build", f"mix_{version}.wav")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", raw,
                    "-af", "loudnorm=I=-14:TP=-1.5:LRA=9,alimiter=limit=0.89:attack=3:release=60:level=false", "-ar", str(SR), "-c:a", "pcm_s16le", out], check=True)
    os.remove(raw)
    # piste voix seule (pour retouches)
    vraw = os.path.join(HERE, "build", f"vraw_{version}.f32")
    vst.astype(np.float32).tofile(vraw)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", vraw,
                    os.path.join(HERE, "build", f"voix_{version}.wav")], check=True)
    os.remove(vraw)
    events["impacts"] = sorted(set(round(x, 3) for x in events["impacts"]))
    json.dump({"timeline": tl, "events": events}, open(os.path.join(HERE, "build", f"events_{version}.json"), "w"),
              ensure_ascii=False, indent=1)
    print("ok", out)


if __name__ == "__main__":
    for v in (sys.argv[1:] or ["60", "30", "15"]):
        make(v)
