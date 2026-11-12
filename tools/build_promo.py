#!/usr/bin/env python3
"""Film promo de 32 s (9:16, 1080x1920, 30 i/s) à partir des photos du portfolio.

Les photos sont animées par zooms et panoramiques, étalonnées (bleu nuit / or),
titrées, puis assemblées avec une bande-son synthétisée.

    python3 tools/build_promo.py            # promo/out/cossi-agbokou-promo.mp4
    python3 tools/build_promo.py --stills   # images tests dans promo/out/stills/

Le contact du carton final vient de la variable PROMO_CONTACT
(« e-mail|téléphone »), pour ne pas l'écrire dans le dépôt.
"""
import math
import os
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
PHOTOS = ROOT / "promo" / "photos"
OUT = ROOT / "promo" / "out"
W, H, FPS, DUR = 1080, 1920, 30, 32.0
WIN_H = 1350  # hauteur de la fenêtre photo (format 4:5)

NAVY = (11, 15, 36)
CREAM = (245, 239, 222)
GOLD = (214, 164, 49)
RED = (190, 30, 45)

FONT_DIR = Path("/usr/share/fonts/opentype/inter")


def font(name, size):
    return ImageFont.truetype(str(FONT_DIR / f"{name}.otf"), size)


F_BIG = font("InterDisplay-Black", 150)
F_NAME = font("InterDisplay-Black", 168)
F_MID = font("InterDisplay-Black", 104)
F_NUM = font("InterDisplay-Black", 520)
F_SUB = font("Inter-SemiBold", 46)
F_SUBI = font("Inter-MediumItalic", 46)
F_TAG = font("Inter-Bold", 28)
F_CAP = font("Inter-Bold", 40)


def ease(x):
    x = min(1.0, max(0.0, x))
    return 1 - (1 - x) ** 3


def smooth(x):
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


# ---------------------------------------------------------------- étalonnage

def grade(img):
    """Contraste doux, ombres bleu nuit, hautes lumières dorées."""
    a = np.asarray(img.convert("RGB"), dtype=np.float32) / 255.0
    a = np.clip(0.5 + (a - 0.5) * 1.12, 0, 1)
    lum = (a * np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)).sum(-1, keepdims=True)
    a = lum + (a - lum) * 1.08
    a += (1 - lum) ** 2 * np.array([-0.030, 0.000, 0.060], dtype=np.float32)
    a += lum ** 2 * np.array([0.050, 0.022, -0.045], dtype=np.float32)
    return Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))


_photos = {}
FLAT = "--flat" in sys.argv  # sans étalonnage, pour étalonner soi-même dans DaVinci


def write_lut(path, size=33):
    """Exporte l'étalonnage au format .cube (DaVinci Resolve, Premiere, CapCut)."""
    g = np.linspace(0, 1, size, dtype=np.float32)
    b, gg, r = np.meshgrid(g, g, g, indexing="ij")  # le rouge varie le plus vite
    rgb = np.stack([r, gg, b], -1).reshape(1, -1, 3)
    out = np.asarray(grade(Image.fromarray((rgb * 255).round().astype(np.uint8))), dtype=np.float32) / 255
    with open(path, "w") as f:
        f.write(f'TITLE "Cossi Agbokou - bleu nuit et or"\nLUT_3D_SIZE {size}\n')
        for v in out.reshape(-1, 3):
            f.write(f"{v[0]:.5f} {v[1]:.5f} {v[2]:.5f}\n")


def photo(name):
    if name not in _photos:
        img = Image.open(PHOTOS / name).convert("RGB")
        _photos[name] = img if FLAT else grade(img)
    return _photos[name]


def window(name, p, z0, z1, c0, c1):
    """Recadre la photo au format 4:5 avec zoom et déplacement progressifs."""
    src = photo(name)
    sw, sh = src.size
    asp = W / WIN_H
    z = z0 + (z1 - z0) * p
    ch = min(sh, sw / asp) / z
    cw = ch * asp
    cx = (c0[0] + (c1[0] - c0[0]) * p) * sw
    cy = (c0[1] + (c1[1] - c0[1]) * p) * sh
    cx = min(max(cx, cw / 2), sw - cw / 2)
    cy = min(max(cy, ch / 2), sh - ch / 2)
    box = (cx - cw / 2, cy - ch / 2, cx + cw / 2, cy + ch / 2)
    return src.resize((W, WIN_H), Image.BICUBIC, box=box)


def make_fade():
    """Dégradé qui fond le bas de la photo dans le fond bleu nuit."""
    alpha = np.zeros((WIN_H, W), dtype=np.float32)
    y = np.arange(WIN_H, dtype=np.float32)
    alpha += (np.clip((y - 760) / (WIN_H - 760), 0, 1) ** 1.6)[:, None]
    alpha += (np.clip((170 - y) / 170, 0, 1) * 0.55)[:, None]
    layer = Image.new("RGBA", (W, WIN_H), NAVY + (0,))
    layer.putalpha(Image.fromarray((np.clip(alpha, 0, 1) * 255).astype(np.uint8)))
    return layer


FADE = make_fade()

# ------------------------------------------------------------------- titres


def wrap(draw, text, fnt, width):
    lines, cur = [], ""
    for word in text.split(" "):
        test = (cur + " " + word).strip()
        if draw.textlength(test, font=fnt) <= width or not cur:
            cur = test
        else:
            lines.append(cur)
            cur = word
    return lines + [cur]


def text_layer(items):
    """items : (texte, police, couleur, x, y[, 'c' pour centré]) ou ('rect', couleur, boîte)."""
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for it in items:
        if it[0] == "rect":
            d.rectangle(it[2], fill=it[1])
        else:
            anchor = "ma" if len(it) > 5 else "la"
            d.text((it[3], it[4]), it[0], font=it[1], fill=it[2], anchor=anchor)
    return layer


def sub_items(lines, y, x=72):
    """Lignes de sous-titre : (texte, couleur, italique)."""
    probe = ImageDraw.Draw(Image.new("RGB", (8, 8)))
    items = []
    for text, color, italic in lines:
        fnt = F_SUBI if italic else F_SUB
        for line in wrap(probe, text, fnt, W - 2 * x):
            items.append((line, fnt, color, x, y))
            y += 62
        y += 6
    return items


TAG = text_layer([
    ("rect", RED, (72, 78, 84, 108)),
    ("COSSI AGBOKOU", F_TAG, CREAM, 100, 76),
])

# (début, fin, [(retard, calque)])
TITLES = [
    (3.0, 7.0, [
        (0.10, text_layer([("COSSI", F_NAME, CREAM, 66, 1290), ("AGBOKOU", F_NAME, GOLD, 66, 1452)])),
        (0.45, text_layer([("rect", RED, (72, 1664, 252, 1674))]
                          + sub_items([("Fiction télévisée · Cotonou, Bénin", CREAM, False)], 1706))),
    ]),
    (12.0, 17.0, [
        (0.10, text_layer([("Je réalise.", F_BIG, CREAM, 66, 1300)])),
        (0.40, text_layer([("rect", GOLD, (72, 1492, 252, 1500))] + sub_items([
            ("Karma · Prémonition · Xola", GOLD, True),
            ("Mon Patron · Afi", GOLD, True),
            ("Tournage RED Digital Cinema 8K", CREAM, False)], 1530))),
    ]),
    (17.0, 22.0, [
        (0.10, text_layer([("Je produis.", F_BIG, CREAM, 66, 1300)])),
        (0.40, text_layer([("rect", GOLD, (72, 1492, 252, 1500))] + sub_items([
            ("Directeur de production · 4 sitcoms", GOLD, False),
            ("Émissions Global Africa — Télé Sud", CREAM, False)], 1530))),
    ]),
    (22.0, 26.0, [
        (0.10, text_layer([("9 structures.", F_MID, CREAM, 66, 1300), ("4 pays.", F_MID, GOLD, 66, 1410)])),
        (0.40, text_layer([("rect", GOLD, (72, 1560, 252, 1568))] + sub_items([
            ("Bénin · Togo · Cameroun · France", CREAM, False)], 1598))),
    ]),
]

CONTACT = [c.strip() for c in os.environ.get("PROMO_CONTACT", "").split("|") if c.strip()]
END_NAME = text_layer([
    ("COSSI", F_NAME, CREAM, W // 2, 760, "c"),
    ("AGBOKOU", F_NAME, GOLD, W // 2, 922, "c"),
    ("rect", RED, (W // 2 - 90, 1132, W // 2 + 90, 1142)),
])
END_ROLES = text_layer([
    ("Assistant de production", F_SUB, CREAM, W // 2, 1186, "c"),
    ("Réalisateur · Scénariste", F_SUB, CREAM, W // 2, 1250, "c"),
    ("COTONOU · BÉNIN", F_CAP, GOLD, W // 2, 1352, "c"),
] + [(c, F_SUB, CREAM, W // 2, 1450 + 66 * i, "c") for i, c in enumerate(CONTACT)])

WRITE_HEAD = text_layer([("J'écris.", F_BIG, CREAM, 66, 250), ("rect", GOLD, (72, 442, 252, 450))])
WRITE_A = text_layer([
    ("ÉPISODES ÉCRITS", F_CAP, CREAM, W // 2, 1250, "c"),
    ("La Calebasse du Destin", F_SUBI, GOLD, W // 2, 1320, "c"),
])
WRITE_B = text_layer([
    ("SITCOMS ÉCRITES", F_CAP, CREAM, W // 2, 1250, "c"),
    ("pour Novo Image Bénin", F_SUBI, GOLD, W // 2, 1320, "c"),
])


def put(frame, layer, alpha=1.0, dy=0):
    if alpha <= 0:
        return
    mask = layer.getchannel("A")
    if alpha < 1:
        mask = mask.point(lambda v: int(v * alpha))
    frame.paste(layer, (0, int(dy)), mask)


def put_anim(frame, layer, t, start, slide=46, dur=0.45):
    k = ease((t - start) / dur)
    put(frame, layer, k, (1 - k) * slide)


# -------------------------------------------------------------------- plans

# (début, fin, photo, zoom départ, zoom fin, centre départ, centre fin)
SHOTS = [
    (0.0, 3.0, "02-clap-moniteur-red.jpg", 1.00, 1.30, (0.50, 0.50), (0.56, 0.58)),
    (3.0, 7.0, "01-portrait-plateau-tv.jpg", 1.00, 1.16, (0.50, 0.45), (0.47, 0.34)),
    (12.0, 14.5, "04-prise-de-vue-decor-naturel.jpg", 1.04, 1.18, (0.46, 0.52), (0.58, 0.55)),
    (14.5, 17.0, "06-retour-moniteur.jpg", 1.00, 1.08, (0.40, 0.50), (0.60, 0.50)),
    (17.0, 20.0, "03-equipe-image-son.jpg", 1.18, 1.00, (0.50, 0.42), (0.50, 0.50)),
    (20.0, 22.0, "05-installation-machinerie.jpg", 1.00, 1.04, (0.30, 0.50), (0.70, 0.50)),
    (22.0, 26.0, "07-projection-evenement.jpg", 1.04, 1.04, (0.34, 0.50), (0.66, 0.50)),
    (26.0, 32.0, "01-portrait-plateau-tv.jpg", 1.50, 1.16, (0.47, 0.26), (0.47, 0.33)),
]
CUTS = [3.0, 7.0, 9.5, 12.0, 14.5, 17.0, 20.0, 22.0, 26.0]


def write_scene(frame, t):
    """Plan 3 : carton typographique, compteurs dorés."""
    d = ImageDraw.Draw(frame)
    for i in range(7):  # lignes de page discrètes
        y = 560 + i * 150
        d.line((72, y, W - 72, y), fill=(22, 28, 58), width=2)
    put_anim(frame, WRITE_HEAD, t, 7.1)
    if t < 9.5:
        n = int(round(40 * ease((t - 7.2) / 1.5)))
        label, cap = str(n), WRITE_A
        start = 7.2
    else:
        n = int(round(20 * ease((t - 9.5) / 1.1)))
        label, cap = "~" + str(n), WRITE_B
        start = 9.5
    fnt = F_NUM if len(label) < 3 else font("InterDisplay-Black", 430)
    d.text((W // 2, 950), label, font=fnt, fill=GOLD, anchor="mm")
    put_anim(frame, cap, t, start + 0.25)


def render(t):
    frame = Image.new("RGB", (W, H), NAVY)
    if 7.0 <= t < 12.0:
        write_scene(frame, t)
    else:
        for t0, t1, name, z0, z1, c0, c1 in SHOTS:
            if t0 <= t < t1:
                p = smooth((t - t0) / (t1 - t0)) * 0.6 + (t - t0) / (t1 - t0) * 0.4
                frame.paste(window(name, p, z0, z1, c0, c1), (0, 0))
                frame.paste(FADE, (0, 0), FADE)
                break
        if 7.0 <= t < 26.0 or 12.0 <= t:
            put(frame, TAG, 1.0 if t < 27.5 else max(0.0, 1 - (t - 27.5) / 0.4))
    for t0, t1, layers in TITLES:
        if t0 <= t < t1:
            for delay, layer in layers:
                put_anim(frame, layer, t, t0 + delay)
    if t >= 27.6:  # carton final
        k = smooth((t - 27.6) / 0.7)
        veil = Image.new("RGB", (W, H), NAVY)
        frame = Image.blend(frame, veil, 0.80 * k)
        put_anim(frame, END_NAME, t, 28.0)
        put_anim(frame, END_ROLES, t, 28.5)
    for c in CUTS:  # éclair blanc à chaque coupe
        if 0 <= t - c < 0.14:
            a = (1 - (t - c) / 0.14) * (0.55 if c in (3.0, 26.0) else 0.30)
            frame = Image.blend(frame, Image.new("RGB", (W, H), (255, 250, 235)), a)
    if t < 0.4:
        frame = Image.blend(Image.new("RGB", (W, H), (0, 0, 0)), frame, t / 0.4)
    if t > DUR - 0.5:
        frame = Image.blend(frame, Image.new("RGB", (W, H), (0, 0, 0)), (t - (DUR - 0.5)) / 0.5)
    return frame


# ---------------------------------------------------------------- bande-son

SR = 44100


def build_audio(path):
    n = int(SR * DUR)
    mix = np.zeros(n, dtype=np.float64)
    rng = np.random.default_rng(7)

    def add(sig, at, gain=1.0):
        i = int(at * SR)
        if i >= n:
            return
        sig = sig[: n - i]
        mix[i:i + len(sig)] += sig * gain

    def env(length, decay):
        x = np.arange(int(length * SR)) / SR
        return x, np.exp(-x / decay)

    def kick():
        x, e = env(0.35, 0.09)
        f = 46 + 110 * np.exp(-x / 0.03)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * e

    def tone(freq, length=0.22, decay=0.06, drop=0.25):
        x, e = env(length, decay)
        f = freq * (1 + drop * np.exp(-x / 0.02))
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * e

    def noise(length, decay, bright=True):
        x, e = env(length, decay)
        s = rng.standard_normal(len(x))
        s = np.diff(s, prepend=0) if bright else np.convolve(s, np.ones(24) / 24, "same")
        return s * e

    def clap():
        out = np.zeros(int(0.5 * SR))
        for off in (0.0, 0.011, 0.023):
            b = noise(0.3, 0.035)
            i = int(off * SR)
            out[i:i + len(b)] += b[: len(out) - i]
        return out * 0.5

    def pluck(freq, length=0.5):
        x, e = env(length, 0.14)
        return (np.sin(2 * np.pi * freq * x) + 0.4 * np.sin(4 * np.pi * freq * x) * np.exp(-x / 0.04)) * e

    def bass(freq, length=0.42):
        x, e = env(length, 0.22)
        s = np.sin(2 * np.pi * freq * x) + 0.35 * np.sin(4 * np.pi * freq * x)
        return np.tanh(s * 1.6) * e * np.minimum(1, x / 0.005)

    beat = 0.5
    k, cl = kick(), clap()
    # Ouverture : battement lent, puis clap sur la coupe
    for b in (0.4, 1.4, 2.2, 2.6):
        add(k, b, 0.55)
    add(cl, 3.0, 0.9)
    # Grosse caisse sur chaque temps
    t = 3.0
    while t < 25.5:
        add(k, t, 0.55 if t < 7 else 0.9)
        t += beat
    # Shaker en doubles croches
    t = 7.0
    while t < 25.5:
        step = int(round((t - 7.0) / 0.125))
        add(noise(0.06, 0.012), t, 0.10 if step % 2 else 0.17)
        t += 0.125
    # Tambours syncopés
    pattern = [(0.0, 196), (0.375, 262), (0.75, 196), (1.0, 147), (1.25, 262), (1.625, 196), (1.75, 220)]
    t = 12.0
    while t < 25.5:
        for off, f in pattern:
            add(tone(f), t + off, 0.33)
        t += 2.0
    # Basse (la mineur)
    riff = [(0.0, 55.0), (0.75, 55.0), (1.0, 65.41), (1.5, 49.0), (1.75, 55.0)]
    t = 7.0
    while t < 25.5:
        for off, f in riff:
            add(bass(f), t + off, 0.5)
        t += 2.0
    # Motif pentatonique façon balafon
    notes = [440, 523.25, 587.33, 659.25, 783.99, 659.25, 587.33, 523.25]
    t, i = 17.0, 0
    while t < 25.5:
        add(pluck(notes[i % 8]), t, 0.20)
        if i % 4 == 2:
            add(pluck(notes[(i + 2) % 8] * 2), t + 0.125, 0.10)
        t += 0.25
        i += 1
    # Nappe
    x = np.arange(n) / SR
    pad = sum(np.sin(2 * np.pi * f * x + ph) for f, ph in ((110, 0), (164.81, 1), (220, 2), (261.63, 3)))
    swell = np.interp(x, [0, 3, 7, 22, 25.4, 25.5, 26, 26.3, 31, 32], [0, .5, .7, 1, 1, 0, 0, 1, .8, 0])
    mix += pad * swell * 0.035
    # Montée de bruit avant la signature
    rise = noise(3.5, 99, bright=True)
    add(rise * np.linspace(0, 1, len(rise)) ** 2, 22.0, 0.12)
    # Silence de 25,5 à 26, puis signature
    mix[int(25.5 * SR):int(26.0 * SR)] *= np.linspace(1, 0, int(0.5 * SR)) ** 4
    add(k, 26.0, 1.1)
    add(cl, 26.0, 0.8)
    add(bass(55.0, 2.5), 26.0, 0.6)
    for j, f in enumerate((440, 659.25, 880)):
        add(pluck(f, 1.6), 26.0 + 0.5 * j, 0.22)
    t = 28.0
    while t < 31.0:
        add(k, t, 0.5)
        add(pluck(440 if int(t) % 2 == 0 else 523.25, 0.9), t + 0.5, 0.12)
        t += 1.0
    add(cl, 31.0, 0.9)

    # Réverbération légère, puis limiteur doux
    wet = np.zeros(n)
    for delay, g in ((0.031, 0.30), (0.047, 0.24), (0.073, 0.18), (0.113, 0.12), (0.167, 0.08)):
        dly = int(delay * SR)
        wet[dly:] += mix[:-dly] * g
    left = mix + wet
    right = mix + np.roll(wet, 233)
    stereo = np.stack([left, right], axis=1)
    stereo = np.tanh(stereo / np.abs(stereo).max() * 1.5) * 0.89
    with wave.open(str(path), "wb") as f:
        f.setnchannels(2)
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes((stereo * 32767).astype(np.int16).tobytes())


# -------------------------------------------------------------------- rendu

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    if "--lut" in sys.argv:
        write_lut(OUT / "cossi-bleu-nuit-or.cube")
        print("LUT :", OUT / "cossi-bleu-nuit-or.cube")
        return
    if "--stills" in sys.argv:
        stills = OUT / "stills"
        stills.mkdir(exist_ok=True)
        for t in (1.5, 5.5, 8.8, 11.2, 13.5, 16.0, 18.5, 21.0, 24.5, 27.0, 30.5):
            render(t).save(stills / f"t{t:04.1f}.jpg", quality=88)
        print("images tests :", stills)
        return
    wav = OUT / "promo.wav"
    build_audio(wav)
    mp4 = OUT / ("cossi-agbokou-promo-non-etalonne.mp4" if FLAT else "cossi-agbokou-promo.mp4")
    cmd = ["ffmpeg", "-y", "-loglevel", "error",
           "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           "-i", str(wav),
           "-vf", "null" if FLAT else "noise=alls=3:allf=t,vignette=PI/5.5",
           "-c:v", "libx264", "-preset", "medium", "-crf", "23", "-maxrate", "4M", "-bufsize", "8M", "-pix_fmt", "yuv420p",
           "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", str(mp4)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    total = int(DUR * FPS)
    for i in range(total):
        proc.stdin.write(render(i / FPS).tobytes())
        if i % 150 == 0:
            print(f"  image {i}/{total}", flush=True)
    proc.stdin.close()
    if proc.wait() != 0:
        sys.exit("ffmpeg a échoué")
    wav.unlink()
    print("film :", mp4)


if __name__ == "__main__":
    main()
