#!/usr/bin/env python3
"""Bande-son de la pub COSSI AGBOKOU (30 s), entièrement synthétisée avec numpy.

Musique afro-house / amapiano à 115 BPM : kick 4/4, log drum (basse percussive glissée),
shaker, claps, congas, accords de piano jazzy, nappe.
Bruitages calés sur l'image : whoosh, pops, riser, impact, clic, tic du compteur.
Sortie : build/cossi/audio.wav (44,1 kHz stéréo).
"""
import os, wave
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "build", "cossi")
os.makedirs(OUT, exist_ok=True)
SR, DUR = 44100, 30.0
N = int(SR * DUR)
BPM = 115
B = 60 / BPM
S16 = B / 4
# mêmes repères que pub.js
S2, S3, S4, S5, S6 = 6 * B, 14 * B, 23 * B, 40 * B, 48 * B
SV = [b * B for b in (23, 27, 30, 33, 36)]
BURST = [(6 + k) * B / 4 for k in range(8)]
CLICK, FINAL = 55 * B, 56 * B
rng = np.random.default_rng(11)


def tt(d):
    return np.arange(int(d * SR)) / SR


def add(buf, x, t, g=1.0, pan=0.0):
    i = int(round(t * SR))
    if i < 0:
        x, i = x[-i:], 0
    if i >= N:
        return
    x = x[: N - i]
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    buf[i:i + len(x), 0] += x * g * l * 1.414
    buf[i:i + len(x), 1] += x * g * r * 1.414


def filt(x, lo=None, hi=None, order=2):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR) + 1e-9
    if hi:
        X /= np.sqrt(1 + (f / hi) ** (2 * order))
    if lo:
        X *= (f / lo) ** order / np.sqrt(1 + (f / lo) ** (2 * order))
    return np.fft.irfft(X, len(x)).astype(np.float32)


def noise(d):
    return rng.standard_normal(int(d * SR)).astype(np.float32)


def env(t, a, d):
    return (1 - np.exp(-t / max(a, 1e-4))) * np.exp(-t / d)


def note(n):  # n = numéro MIDI
    return 440 * 2 ** ((n - 69) / 12)


# ------------------------------------------------------------ instruments
def kick():
    t = tt(0.45)
    f = 48 + 110 * np.exp(-t * 32)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7.5)
    x += 0.35 * filt(noise(0.45), lo=1500) * np.exp(-t * 180)
    return np.tanh(1.6 * x) * 0.9


def logdrum(f, d=0.5):
    t = tt(d)
    fr = f * (1 + 0.9 * np.exp(-t * 28))          # glissé caractéristique
    ph = 2 * np.pi * np.cumsum(fr) / SR
    x = np.sin(ph) + 0.45 * np.sin(2 * ph + 0.3) + 0.15 * np.sin(3 * ph)
    x = np.tanh(2.6 * x * env(t, 0.002, 0.16 + 0.1 * (f < 70)))
    return x * 0.55


def clap():
    t = tt(0.3)
    x = np.zeros_like(t)
    n = filt(noise(0.3), lo=900, hi=4000)
    for k, o in enumerate((0, 0.009, 0.018, 0.027)):
        i = int(o * SR)
        x[i:] += n[: len(x) - i] * np.exp(-t[: len(x) - i] * (90 if k < 3 else 16))
    return x * 0.5


def shaker(acc=1.0):
    t = tt(0.07)
    return filt(noise(0.07), lo=6000) * env(t, 0.006, 0.018) * 0.25 * acc


def hat_open():
    t = tt(0.25)
    return filt(noise(0.25), lo=7500) * env(t, 0.002, 0.07) * 0.22


def conga(f):
    t = tt(0.3)
    fr = f * (1 + 0.25 * np.exp(-t * 40))
    return np.sin(2 * np.pi * np.cumsum(fr) / SR) * env(t, 0.001, 0.09) * 0.35


def piano(freqs, d=0.9, g=1.0):
    t = tt(d)
    x = np.zeros_like(t)
    for f in freqs:
        for k in range(1, 7):
            x += (1 / k ** 1.4) * np.sin(2 * np.pi * f * k * (1 + 0.0004 * k) * t + k) * np.exp(-t * (2.2 + 1.6 * k))
    x *= (1 - np.exp(-t / 0.003))
    return x * 0.11 * g / max(1, len(freqs) ** 0.5)


def pad(freqs, d):
    t = tt(d)
    x = np.zeros_like(t)
    for f in freqs:
        for det in (-0.004, 0, 0.004):
            ph = 2 * np.pi * f * (1 + det) * t
            x += np.sin(ph) + 0.3 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph)
    a = np.minimum(1, t / 0.25) * np.minimum(1, (d - t) / 0.3)
    return filt(x * a, hi=1800) * 0.018


def bell(f, d=1.2):
    t = tt(d)
    x = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * dd) for r, a, dd in ((1, 1, 3), (2.76, 0.4, 6), (5.4, 0.2, 9)))
    return x * (1 - np.exp(-t / 0.002)) * 0.12


# ------------------------------------------------------------ bruitages
def warp(x, rate):
    """Lecture à vitesse variable : déplace le spectre (whoosh, riser)."""
    pos = np.cumsum(rate)
    pos = pos / pos[-1] * (len(x) - 2) if pos[-1] > len(x) - 2 else pos
    return np.interp(pos, np.arange(len(x)), x).astype(np.float32)


def whoosh(d=0.55, up=True):
    n = filt(noise(d * 3), lo=300, hi=2500)
    t = tt(d)
    s = t / d
    rate = 0.6 + 2.2 * (np.sin(np.pi * s) if up else 1 - s)
    x = warp(n, rate)[: len(t)]
    a = np.sin(np.pi * np.clip(s, 0, 1)) ** 2 * (1 + 0.6 * s)
    return filt(x * a, hi=9000) * 0.28


def pop(f=900):
    t = tt(0.12)
    fr = f * (1 + 1.4 * np.exp(-t * 60))
    x = np.sin(2 * np.pi * np.cumsum(fr) / SR) * env(t, 0.001, 0.03)
    return x * 0.38


def deflate(f0=900, d=0.7):
    t = tt(d)
    fr = f0 * np.exp(-t * 3) * (1 + 0.04 * np.sin(2 * np.pi * 9 * t))
    return np.sin(2 * np.pi * np.cumsum(fr) / SR) * env(t, 0.01, 0.25) * 0.14


def riser(d):
    t = tt(d)
    s = t / d
    n = filt(noise(d * 3), lo=400, hi=3000)
    x = warp(n, 0.3 + 2.6 * s ** 2)[: len(t)] * s ** 2.2 * 0.35
    f = 180 * 2 ** (3 * s ** 1.6)
    x += np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.07 * s ** 1.5 * (1 + 0.3 * np.sin(2 * np.pi * 6 * t))
    return x


def impact():
    t = tt(2.0)
    f = 30 + 60 * np.exp(-t * 6)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.2) * 0.8
    x += filt(noise(2.0), lo=200, hi=6000) * np.exp(-t * 4) * 0.25
    return np.tanh(1.3 * x)


def click():
    t = tt(0.06)
    x = filt(noise(0.06), lo=2000) * np.exp(-t * 600) * 0.5
    x += np.sin(2 * np.pi * 2600 * t) * np.exp(-t * 120) * 0.25
    x += np.sin(2 * np.pi * 1300 * t) * np.exp(-t * 60) * 0.15
    return x


def shutter():
    a = click()
    out = np.zeros(int(0.12 * SR), np.float32)
    out[: len(a)] += a
    out[int(0.055 * SR): int(0.055 * SR) + len(a)] += a * 0.7
    return out


def tick():
    t = tt(0.03)
    return np.sin(2 * np.pi * 3200 * t) * np.exp(-t * 200) * 0.16


# ------------------------------------------------------------ composition
music = np.zeros((N, 2), np.float32)   # groove (bus filtrable)
drums = np.zeros((N, 2), np.float32)   # kick séparé (coupé pendant le problème)
sfx = np.zeros((N, 2), np.float32)
send = np.zeros((N, 2), np.float32)    # vers la réverbe

# Fm9 | Dbmaj9 | Bbm9 | C7(b9)  — voicings mi-graves
CHORDS = [[53, 56, 60, 63, 67], [49, 53, 56, 60, 63], [46, 49, 53, 56, 60], [48, 52, 55, 58, 61]]
LOG = [  # (pas de double-croche, note MIDI) par mesure — motif amapiano syncopé
    [(0, 41), (3, 41), (6, 44), (8, 41), (10, 48), (11, 46), (14, 44)],
    [(0, 37), (3, 37), (6, 41), (8, 37), (10, 44), (12, 41), (14, 49)],
    [(0, 34), (3, 34), (6, 41), (8, 34), (10, 46), (11, 44), (14, 41)],
    [(0, 36), (3, 36), (6, 43), (8, 36), (10, 48), (13, 46), (15, 43)],
]
PIANO_STEPS = [(0, 0.5), (3, 0.6), (6, 0.8), (10, 0.7), (14, 0.6)]
CONGA = [(2, 220, -0.4), (5, 330, 0.4), (7, 220, -0.4), (9, 165, 0.3), (13, 330, -0.3), (15, 247, 0.4)]

total_beats = int(DUR / B) + 1
for bar_i in range(total_beats // 4 + 1):
    t_bar = bar_i * 4 * B
    ci = bar_i % 4
    for step in range(16):
        ts = t_bar + step * S16
        if ts >= FINAL:
            break
        beat = ts / B
        problem = S2 <= ts < S3
        build = 12 * B <= ts < S3
        # kick 4/4 (absent pendant le problème)
        if step % 4 == 0 and not problem:
            add(drums, kick(), ts, 0.95)
        if step in (4, 12) and not problem:
            add(music, clap(), ts, 0.55, 0.05)
            add(send, clap(), ts, 0.15)
        # shaker en doubles-croches, accent sur le contretemps
        acc = [1.0, 0.45, 0.75, 0.5][step % 4]
        add(music, shaker(acc), ts + 0.006 * (step % 2), 1.0, 0.35)
        if step % 4 == 2 and not problem:
            add(music, hat_open(), ts, 1.0, -0.25)
        # congas
        if not problem:
            for st, f, pan in CONGA:
                if st == step:
                    add(music, conga(f), ts, 0.8, pan)
        # log drum
        if not problem and ts >= 0:
            for st, n in LOG[ci]:
                if st == step:
                    add(music, logdrum(note(n + 12)), ts, 0.95)
        # accords de piano
        for st, g in PIANO_STEPS:
            if st == step:
                fr = [note(n) for n in CHORDS[ci]]
                p = piano(fr, 0.8, g)
                add(music, p, ts, 1.0, 0.15)
                add(send, p, ts, 0.5)
        # roulement de clap qui monte avant la révélation
        if build:
            sub = 2 if beat >= 13 else 1
            for k in range(sub):
                tb = ts + k * S16 / sub
                add(sfx, clap(), tb, 0.12 + 0.35 * (tb - 12 * B) / (2 * B), 0)
    # nappe par mesure
    if t_bar < FINAL:
        add(music, pad([note(n + 12) for n in CHORDS[ci][1:4]], 4 * B + 0.3), t_bar, 1.0)

# accord final + kick + impact
add(drums, kick(), FINAL, 1.0)
fin = piano([note(n) for n in CHORDS[0]] + [note(72)], 2.6, 1.4)
add(music, fin, FINAL, 1.0)
add(send, fin, FINAL, 1.0)
add(music, logdrum(note(53), 0.9), FINAL, 1.0)
add(sfx, impact(), FINAL, 0.35)
add(send, bell(note(84), 2.0), FINAL, 0.6)

# « le problème » : musique étouffée (passe-bas) et un peu plus basse
muff = np.stack([filt(music[:, c], hi=420, order=3) for c in range(2)], 1)
m = np.zeros(N, np.float32)
i2, i3 = int(S2 * SR), int(S3 * SR)
m[i2:i3] = 1
ramp = int(0.25 * SR)
m[i2:i2 + ramp] = np.linspace(0, 1, ramp)
music = music * (1 - m[:, None]) + muff * m[:, None] * 2.2

# ------------------------------------------------------------ bruitages
add(sfx, whoosh(0.5), 0.0, 0.8)
add(sfx, impact(), 0.0, 0.25)
for k, tb in enumerate(BURST):                          # pops des notifications
    for j in range(3):
        add(sfx, pop(700 + 140 * ((k * 3 + j) % 6)), tb + j * 0.02, 0.55 - j * 0.12, (-0.6, 0.0, 0.6)[j])
add(sfx, whoosh(0.6, up=False), S2 - 0.25, 0.7)          # tout retombe
for k in range(6):
    add(sfx, deflate(1000 - k * 80), S2 + 0.12 + k * 0.09, 0.8, (k % 3 - 1) * 0.5)
add(sfx, riser(S3 - 5.0), 5.0, 1.0)                       # montée avant le nom
add(sfx, impact(), S3, 0.9)                               # drop : le nom
add(send, bell(note(77), 2.0), S3, 0.5)
for k in range(9):                                        # scintillement pendant le tracé
    add(send, bell(note([65, 68, 72, 75, 77, 80, 84, 87, 89][k]), 1.2), S3 + 0.45 + k * 0.21, 0.32)
    add(sfx, bell(note([65, 68, 72, 75, 77, 80, 84, 87, 89][k]), 1.2), S3 + 0.45 + k * 0.21, 0.25, (k / 4 - 1) * 0.5)
add(sfx, whoosh(0.45), S3 + 2.15, 0.45)                   # COMMUNITY MANAGER
add(sfx, whoosh(0.55), 22.5 * B - 0.1, 0.75)              # le nom s'efface
add(sfx, pop(520), S4, 0.6)
for tsv in SV[1:]:                                        # morphing des icônes
    add(sfx, whoosh(0.5), tsv - 0.12, 0.75)
    add(sfx, pop(1100), tsv + 0.4, 0.25)
add(sfx, shutter(), SV[1] + 0.95, 0.9)                    # déclencheur photo
add(sfx, whoosh(0.6), S5 - 0.15, 0.8)                     # vers la bobine
for k in range(10):                                       # cliquetis du film
    add(sfx, tick(), S5 + 0.4 + k * 0.09, 0.6, 0.3)
add(sfx, whoosh(0.5), S5 + 1.05, 0.55)                    # pellicule -> fil
add(sfx, pop(800), S5 + 1.85, 0.4, -0.4)                  # Lomé
add(sfx, pop(1000), S5 + 2.05, 0.4, 0.4)                  # Cotonou
add(sfx, whoosh(0.6), S6 - 0.15, 0.8)                     # retour du téléphone
# tics du compteur d'abonnés (même courbe que l'image : ease-out quartique)
t0c, dc = S6 + 0.55, 1.3
for k in range(1, 26):
    v = k / 26
    x = 1 - (1 - v) ** 0.25
    add(sfx, tick(), t0c + dc * x, 0.9, 0.2)
add(sfx, pop(1300), S6 + 0.75, 0.45)                      # pastille rouge
add(sfx, whoosh(0.55), 52 * B - 0.1, 0.75)                # téléphone -> monogramme
for k, n in enumerate((72, 79, 84)):
    add(sfx, bell(note(n), 1.6), 52 * B + 0.45 + k * 0.07, 0.5)
    add(send, bell(note(n), 1.6), 52 * B + 0.45 + k * 0.07, 0.5)
add(sfx, whoosh(0.4), 52 * B + 0.3, 0.4)                  # texte final
add(sfx, pop(600), 54 * B - 0.2, 0.6)                     # apparition du bouton
add(sfx, click(), CLICK, 1.2)                             # clic sur le bouton

# ------------------------------------------------------------ mix
ir_t = tt(1.6)
ir = (rng.standard_normal(len(ir_t)) * np.exp(-ir_t / 0.38)).astype(np.float32)
ir = filt(ir, lo=200, hi=5000)
rev = np.stack([np.fft.irfft(np.fft.rfft(send[:, c], N + len(ir)) * np.fft.rfft(np.roll(ir, c * 37), N + len(ir)))[:N] for c in range(2)], 1)
rev *= 0.5 / (np.abs(rev).max() + 1e-9) * np.abs(send).max()

mix = drums * 1.0 + music * 0.9 + sfx * 1.0 + rev * 0.6
# légère compression « side-chain » du groove par le kick (pompe house)
duck = np.ones(N, np.float32)
for k in range(int(FINAL / B) + 1):
    tk = k * B
    if S2 <= tk < S3:
        continue
    i = int(tk * SR)
    seg = tt(B)
    j = min(N, i + len(seg))
    duck[i:j] *= 1 - 0.28 * np.exp(-seg[: j - i] / 0.09)
mix[:, 0] -= music[:, 0] * 0.9 * (1 - duck)
mix[:, 1] -= music[:, 1] * 0.9 * (1 - duck)
mix = filt(mix[:, 0], lo=28)[:, None] * np.array([1, 0]) + filt(mix[:, 1], lo=28)[:, None] * np.array([0, 1])
mix = np.tanh(mix / np.abs(mix).max() * 1.15) / np.tanh(1.15)

# ------------------------------------------------------------ voix off
VOICE = os.path.join(OUT, "voix.wav")
if os.path.exists(VOICE):
    with wave.open(VOICE) as w:
        sw = w.getsampwidth()
        raw = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16 if sw == 2 else np.int32)
        v = raw.reshape(-1, w.getnchannels()).mean(1).astype(np.float32) / (32768 if sw == 2 else 2 ** 31)
    v = np.pad(v, (0, max(0, N - len(v))))[:N]
    v = filt(v, lo=85)
    v = v + 0.6 * filt(v, lo=2000, hi=6000)   # présence : la voix passe devant sur un téléphone
    # compression douce (niveau régulier, comme un enregistrement studio)
    e = np.sqrt(np.convolve(v ** 2, np.ones(int(0.03 * SR)) / int(0.03 * SR), "same")) + 1e-5
    v = v * np.clip((e / 0.12) ** -0.35, 0.5, 3.0)
    v *= 0.5 / (np.abs(v).max() + 1e-9)
    # très légère acoustique de pièce
    vr = np.fft.irfft(np.fft.rfft(v, N + len(ir)) * np.fft.rfft(ir, N + len(ir)))[:N]
    v = v + vr * (0.04 * np.abs(v).max() / (np.abs(vr).max() + 1e-9))
    # la musique s'efface nettement sous la voix (−14 dB)
    ev = np.abs(v) > 0.02
    g = np.where(np.convolve(ev, np.ones(int(0.12 * SR)), "same") > 0, 0.2, 1.0).astype(np.float32)
    k = int(0.25 * SR)
    g = np.convolve(np.pad(g, (k, k), mode="edge"), np.ones(k) / k, "same")[k:-k]
    mix = mix * g[:, None] + np.stack([v, v], 1) * 1.9
    print("voix off mixée")
fade = int(0.35 * SR)
mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
mix *= 0.89 / np.abs(mix).max()

with wave.open(os.path.join(OUT, "audio.wav"), "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())
print("ok ->", os.path.join(OUT, "audio.wav"))
