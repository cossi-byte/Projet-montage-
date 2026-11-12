#!/usr/bin/env python3
"""Film promo v3, format « ce qu'il faut savoir » : carte centrale sur fond doré,
légendes aux mots-clés surlignés, écrans de mots-clés, voix off explicative.

    python3 tools/promo3_voice.py            # voix (environnement Chatterbox), une fois
    python3 tools/build_promo3.py            # promo/out/cossi-agbokou-promo-v3.mp4
    python3 tools/build_promo3.py --stills   # planche d'images tests

Contact du carton final : variable PROMO_CONTACT (« e-mail|téléphone »).
"""
import functools
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_promo as bp  # noqa: E402

OUT = bp.OUT
import os  # noqa: E402

VO = OUT / os.environ.get("PROMO_VOICE_DIR", "vo3")
TEMPO = os.environ.get("PROMO_VOICE_TEMPO", "0.92")
NAME = os.environ.get("PROMO_NAME", "cossi-agbokou-promo-v3")
W, H, FPS, SR = 1080, 1920, 30, 44100
NAVY, CREAM, GOLD, RED = bp.NAVY, bp.CREAM, bp.GOLD, bp.RED
WHITE = (255, 255, 255)
BG = (222, 170, 44)
CX0, CY0, CW, CH, RAD = 96, 170, 888, 1540, 44
ease, smooth = bp.ease, bp.smooth
P1, P2, P3 = "01-portrait-plateau-tv.jpg", "02-clap-moniteur-red.jpg", "03-equipe-image-son.jpg"
P4, P5 = "04-prise-de-vue-decor-naturel.jpg", "05-installation-machinerie.jpg"
P6, P7 = "06-retour-moniteur.jpg", "07-projection-evenement.jpg"

# ----------------------------------------------------------------- déroulé
# (phrase, silence après, [(fraction de départ, type, paramètres)])
SEGMENTS = [
    ("s01", 0.30, [(0, "photo", (P2, 1.00, 1.25, (0.50, 0.50), (0.56, 0.58),
                                "*40 épisodes*, *20 sitcoms*, *2 longs-métrages*… un même nom au générique"))]),
    ("s02", 0.50, [(0, "photo", (P1, 1.05, 1.30, (0.47, 0.40), (0.47, 0.30),
                                "*Cossi Agbokou* : ce qu'il faut savoir"))]),
    ("s03", 0.30, [(0, "navy", "isma"), (0.66, "inter", "L'écriture")]),
    ("s04", 0.30, [(0, "navy", "counts")]),
    ("s05", 0.50, [(0, "photo", (P6, 1.00, 1.10, (0.40, 0.50), (0.60, 0.50),
                                "Longs-métrages *Prémonition* et *Karma*. Documentaire *Les 10 000 Cascades de Kpalimé*"))]),
    ("s06", 0.30, [(0, "inter", "Sur le plateau")]),
    ("s07", 0.30, [(0, "photo", (P4, 1.00, 1.18, (0.42, 0.52), (0.62, 0.54),
                                "Réalisateur : *Karma*, *Prémonition*, *Xola*, *Mon Patron*, *Afi*")),
                   (0.66, "photo", (P2, 1.35, 1.60, (0.56, 0.56), (0.57, 0.56), "Tournage en *RED 8K*"))]),
    ("s08", 0.30, [(0, "photo", (P3, 1.20, 1.00, (0.50, 0.42), (0.50, 0.50),
                                "Directeur de production : *4 sitcoms* et les émissions *Global Africa* pour Télé Sud"))]),
    ("s09", 0.50, [(0, "photo", (P5, 1.00, 1.05, (0.30, 0.50), (0.72, 0.50),
                                "Assistant de production chez *Shama Production* : Dear Me, Togoville, "
                                "Autrefois nos pères, maintenant nos terres"))]),
    ("s10", 0.25, [(0, "inter", "Son atout"), (0.34, "navy", "atout")]),
    ("s11", 0.50, [(0, "navy", "atout")]),
    ("s12", 0.35, [(0, "photo", (P7, 1.05, 1.05, (0.32, 0.50), (0.68, 0.50),
                                "*9 structures*, *4 pays* : Bénin, Togo, Cameroun, France"))]),
    ("s13", 0.20, [(0, "photo", (P1, 1.60, 1.35, (0.47, 0.24), (0.47, 0.28),
                                "Producteur, diffuseur, réalisateur : vous préparez *une série*, *un film*, "
                                "*une émission* ?"))]),
    ("s14", 0.00, [(0, "navy", "contact")]),
]
START, TAIL, OUTRO = 0.5, 3.4, 1.8
T, D, CLIPS, BEATS = {}, {}, {}, []
DUR = 0.0


def load_voice(cid):
    path = VO / f"{cid}.wav"
    if not path.exists():  # durée estimée tant que la voix n'est pas prête
        return np.zeros(int(SR * 6.0))
    slow = VO / "ralenti" / f"{cid}.wav"  # débit ralenti de 8 %, hauteur de voix inchangée
    if not slow.exists() or slow.stat().st_mtime < path.stat().st_mtime:
        slow.parent.mkdir(exist_ok=True)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(path), "-af", f"atempo={TEMPO}",
                        "-ar", str(SR), "-ac", "1", "-c:a", "pcm_s16le", str(slow)], check=True)
    with wave.open(str(slow)) as f:
        sr, ch, sw = f.getframerate(), f.getnchannels(), f.getsampwidth()
        raw = f.readframes(f.getnframes())
    x = np.frombuffer(raw, dtype=np.int16 if sw == 2 else np.float32).astype(np.float64)
    x = x.reshape(-1, ch).mean(1)
    x /= max(1e-9, np.abs(x).max())
    loud = np.where(np.abs(x) > 0.02)[0]
    x = x[max(0, loud[0] - int(0.02 * sr)):loud[-1] + int(0.08 * sr)]
    x = np.interp(np.linspace(0, len(x) - 1, int(len(x) * SR / sr)), np.arange(len(x)), x)
    fade = int(0.02 * SR)
    x[:fade] *= np.linspace(0, 1, fade)
    x[-fade:] *= np.linspace(1, 0, fade)
    return x * 0.9


def build_timeline():
    global DUR
    t = START
    for cid, gap, beats in SEGMENTS:
        CLIPS[cid] = load_voice(cid)
        T[cid], D[cid] = t, len(CLIPS[cid]) / SR
        for frac, kind, params in beats:
            BEATS.append([t + frac * D[cid], kind, params, cid])
        t += D[cid] + gap
    DUR = round(t + TAIL, 1)
    # deux temps consécutifs sur le même carton bleu nuit n'en font qu'un
    merged = []
    for b in BEATS:
        if merged and merged[-1][1] == "navy" and b[1] == "navy" and merged[-1][2] == b[2]:
            continue
        merged.append(b)
    BEATS[:] = merged


# ------------------------------------------------------------------- dessin

@functools.lru_cache(None)
def fnt(name, size):
    return ImageFont.truetype(str(bp.FONT_DIR / f"{name}.otf"), size)


_probe = ImageDraw.Draw(Image.new("RGB", (8, 8)))


@functools.lru_cache(None)
def rich(text, size, maxw, color=WHITE, hl=GOLD, name="Inter-Bold", center=False):
    """Texte avec *mots surlignés*, coupé à la largeur donnée. Renvoie un calque RGBA."""
    font = fnt(name, size)
    words, on = [], False
    for part in text.split("*"):
        words += [(w, on) for w in part.split(" ") if w]
        on = not on
    # recolle la ponctuation isolée au mot précédent
    lines, cur, width = [], [], 0
    space = _probe.textlength(" ", font=font)
    for w, flag in words:
        ww = _probe.textlength(w, font=font)
        glue = w in (":", "?", "!", ";", "…") or w[0] in ",."
        if cur and width + space + ww > maxw and not glue:
            lines.append(cur)
            cur, width = [], 0
        cur.append((w, flag, ww, glue))
        width += ww + (0 if not cur[:-1] else space)
    lines.append(cur)
    lh = int(size * 1.24)
    img = Image.new("RGBA", (maxw, lh * len(lines) + 10), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for i, line in enumerate(lines):
        total = sum(ww for _, _, ww, _ in line) + space * (len(line) - 1)
        x = (maxw - total) / 2 if center else 0
        for w, flag, ww, glue in line:
            if w[0] in ",.…":  # pas d'espace avant la virgule ou le point
                x -= space
            d.text((x, i * lh), w, font=font, fill=hl if flag else color)
            x += ww + space
    return img


def put(img, lay, xy, t, start, slide=40, dur=0.35):
    k = ease((t - start) / dur)
    if k <= 0:
        return
    a = lay.getchannel("A")
    if k < 1:
        a = a.point(lambda v: int(v * k))
    img.paste(lay, (int(xy[0]), int(xy[1] + (1 - k) * slide)), a)


@functools.lru_cache(None)
def background():
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    r = np.hypot((x - W / 2) / W, (y - H * 0.45) / H)
    shade = np.clip(1.06 - 0.55 * r ** 1.6, 0, 1.1)[..., None]
    rng = np.random.default_rng(3)
    grain = rng.normal(0, 5.5, (H, W, 1)).astype(np.float32)
    a = np.array(BG, dtype=np.float32) * shade + grain
    img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    # signature verticale à gauche
    tag = Image.new("RGBA", (420, 60), (0, 0, 0, 0))
    d = ImageDraw.Draw(tag)
    d.rectangle((0, 12, 34, 46), fill=NAVY)
    d.rectangle((13, 18, 21, 40), fill=BG)
    d.rectangle((6, 25, 28, 33), fill=BG)
    d.text((46, 8), "COSSI AGBOKOU", font=fnt("Inter-Black", 34), fill=NAVY)
    tag = tag.rotate(90, expand=True)
    img.paste(tag, (22, 150), tag)
    return img


@functools.lru_cache(None)
def card_mask():
    m = Image.new("L", (CW, CH), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, CW - 1, CH - 1), RAD, fill=255)
    return m


@functools.lru_cache(None)
def card_shadow():
    s = Image.new("L", (CW + 160, CH + 160), 0)
    ImageDraw.Draw(s).rounded_rectangle((80, 96, CW + 80, CH + 96), RAD, fill=150)
    s = s.filter(ImageFilter.GaussianBlur(28))
    out = Image.new("RGBA", s.size, (60, 38, 0, 0))
    out.putalpha(s)
    return out


def cover(name, p, z0, z1, c0, c1):
    src = bp.photo(name)
    sw, sh = src.size
    asp = CW / CH
    z = z0 + (z1 - z0) * p
    ch = min(sh, sw / asp) / z
    cw = ch * asp
    cx = min(max((c0[0] + (c1[0] - c0[0]) * p) * sw, cw / 2), sw - cw / 2)
    cy = min(max((c0[1] + (c1[1] - c0[1]) * p) * sh, ch / 2), sh - ch / 2)
    return src.resize((CW, CH), Image.BICUBIC, box=(cx - cw / 2, cy - ch / 2, cx + cw / 2, cy + ch / 2))


@functools.lru_cache(None)
def photo_veil():
    """Voile sombre sur la photo, plus dense au centre où se pose la légende."""
    y = np.arange(CH, dtype=np.float32) / CH
    a = 0.34 + 0.44 * np.exp(-((y - 0.50) / 0.26) ** 2) + 0.35 * np.clip((y - 0.74) / 0.26, 0, 1)
    lay = Image.new("RGBA", (CW, CH), (6, 8, 20, 0))
    lay.putalpha(Image.fromarray((np.clip(a, 0, 0.92) * 255).astype(np.uint8)[:, None].repeat(CW, 1)))
    return lay


@functools.lru_cache(None)
def lower_third():
    bw, bh = CW - 120, 150
    lay = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    d.rounded_rectangle((0, 0, bw - 1, bh - 1), 14, fill=NAVY + (235,))
    third = bw // 3
    for i, c in enumerate((GOLD, CREAM, RED)):
        d.rectangle((i * third, 0, (i + 1) * third, 8), fill=c)
    d.text((bw / 2, 30), "COSSI AGBOKOU", font=fnt("Inter-Black", 40), fill=WHITE, anchor="ma")
    d.text((bw / 2, 88), "Scénariste · Réalisateur · Assistant de production", font=fnt("Inter-SemiBold", 27),
           fill=CREAM, anchor="ma")
    return lay


@functools.lru_cache(None)
def navy_base():
    y, x = np.mgrid[0:CH, 0:CW].astype(np.float32)
    a = np.array(NAVY, dtype=np.float32) * (1.55 - 0.75 * (y / CH))[..., None]
    a += (((x + y) % 46) < 2)[..., None] * 5.0
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def text(card, s, font, xy, fill, t, start, anchor="la", slide=40):
    lay = Image.new("RGBA", (CW, int(font.size * 1.4)), (0, 0, 0, 0))
    ImageDraw.Draw(lay).text((xy[0], 0), s, font=font, fill=fill, anchor=anchor)
    put(card, lay, (0, xy[1]), t, start, slide=slide)


CONTACT = bp.CONTACT


def navy_card(which, t, t0):
    card = navy_base().copy()
    d = ImageDraw.Draw(card)
    m = 70
    if which == "isma":
        text(card, "FORMATION", fnt("Inter-Bold", 40), (m, 330), CREAM, t, t0 + 0.05)
        text(card, "ISMA", fnt("InterDisplay-Black", 300), (m - 8, 380), GOLD, t, t0 + 0.15, slide=70)
        d.rectangle((m, 760, m + 200 * ease((t - t0 - 0.4) / 0.4), 772), fill=RED)
        put(card, rich("Institut Supérieur des Métiers de l'Audiovisuel", 50, CW - 2 * m, CREAM, name="Inter-SemiBold"),
            (m, 820), t, t0 + 0.5)
        put(card, rich("Licence en *Réalisation Cinéma et Télévision*", 58, CW - 2 * m), (m, 1010), t, t0 + 0.9)
    elif which == "counts":
        rows = [(0.08, 40, "", "épisodes écrits", "La Calebasse du Destin"),
                (0.56, 20, "~", "sitcoms écrites", "Novo Image Bénin")]
        for i, (fr, num, pre, label, sub) in enumerate(rows):
            st = T["s04"] + fr * D["s04"]
            if t < st:
                continue
            y = 190 + i * 640
            k = ease((t - st) / 0.6)
            d.text((m - 10, y), pre + str(int(round(num * k))), font=fnt("InterDisplay-Black", 330), fill=GOLD)
            text(card, label, fnt("Inter-Black", 76), (m, y + 380), WHITE, t, st + 0.15)
            text(card, sub, fnt("Inter-MediumItalic", 52), (m, y + 478), CREAM, t, st + 0.3)
    elif which == "atout":
        text(card, "SON ATOUT", fnt("Inter-Bold", 40), (m, 250), GOLD, t, t0 + 0.05)
        put(card, rich("Il connaît le *scénario* de l'intérieur.", 96, CW - 2 * m, name="InterDisplay-Black"),
            (m, 330), t, t0 + 0.15, slide=60)
        bullets = [(T["s11"] + 0.10 * D["s11"], "Repérer les scènes lourdes en moyens"),
                   (T["s11"] + 0.52 * D["s11"], "Organiser le tournage par séquences")]
        for i, (st, b) in enumerate(bullets):
            if t >= st:
                y = 900 + i * 240
                k = ease((t - st) / 0.35)
                d.rectangle((m, y + 8, m + 22, y + 8 + 110 * k), fill=RED)
                put(card, rich(b, 60, CW - 2 * m - 60, CREAM, name="Inter-SemiBold"), (m + 60, y), t, st)
    elif which == "contact":
        cx = CW // 2
        text(card, "COSSI", fnt("InterDisplay-Black", 156), (cx, 280), CREAM, t, t0 + 0.05, anchor="ma", slide=70)
        text(card, "AGBOKOU", fnt("InterDisplay-Black", 156), (cx, 450), GOLD, t, t0 + 0.15, anchor="ma", slide=70)
        d.rectangle((cx - 100 * ease((t - t0 - 0.4) / 0.4), 690, cx + 100 * ease((t - t0 - 0.4) / 0.4), 702), fill=RED)
        for i, r in enumerate(("Scénariste", "Réalisateur", "Assistant de production")):
            text(card, r, fnt("Inter-SemiBold", 58), (cx, 750 + i * 82), WHITE, t, t0 + 0.6 + i * 0.18, anchor="ma")
        text(card, "COTONOU · BÉNIN", fnt("Inter-Bold", 42), (cx, 1060), GOLD, t, t0 + 1.3, anchor="ma")
        st = T["s14"] + 0.55 * D["s14"]
        for i, c in enumerate(CONTACT):
            box = Image.new("RGBA", (CW, 110), (0, 0, 0, 0))
            bd = ImageDraw.Draw(box)
            bd.rounded_rectangle((m, 0, CW - m, 100), 18, fill=CREAM)
            bd.text((cx, 50), c, font=fnt("Inter-Bold", 50), fill=NAVY, anchor="mm")
            put(card, box, (0, 1180 + i * 128), t, st + i * 0.2)
    return card


def photo_card(params, t, t0, t1):
    name, z0, z1, c0, c1, caption = params
    p = min(1.0, max(0.0, (t - t0) / max(0.1, t1 - t0)))
    punch = 1 + 0.06 * (1 - ease((t - t0) / 0.3))
    card = cover(name, p, z0 * punch, z1 * punch, c0, c1)
    card.paste(photo_veil(), (0, 0), photo_veil())
    cap = rich(caption, 68, CW - 130)
    put(card, cap, (66, CH * 0.50 - cap.height / 2), t, t0 + 0.12)
    lt = lower_third()
    put(card, lt, (60, CH - 220), t, t0 + 0.25, slide=30)
    return card


def render(t):
    frame = background().copy()
    idx = max(i for i, b in enumerate(BEATS) if b[0] <= t) if t >= BEATS[0][0] else 0
    t0, kind, params, _ = BEATS[idx]
    t1 = BEATS[idx + 1][0] if idx + 1 < len(BEATS) else DUR - OUTRO
    if t >= DUR - OUTRO:  # signature finale sur fond crème
        k = smooth((t - (DUR - OUTRO)) / 0.35)
        end = Image.new("RGB", (W, H), (248, 240, 214))
        d = ImageDraw.Draw(end)
        d.rounded_rectangle((W / 2 - 330, 860, W / 2 + 330, 990), 16, fill=NAVY)
        d.text((W / 2, 925), "COSSI AGBOKOU", font=fnt("Inter-Black", 66), fill=GOLD, anchor="mm")
        d.text((W / 2, 1040), "ÉCRIRE · RÉALISER · PRODUIRE", font=fnt("Inter-Bold", 34), fill=NAVY, anchor="mm")
        frame = Image.blend(frame, end, k)
    elif kind == "inter":
        lay = rich(params, 92, W - 240, NAVY, NAVY, "Inter-Medium", center=True)
        put(frame, lay, (120, H * 0.47 - lay.height / 2), t, t0 + 0.02, slide=24, dur=0.25)
    else:
        card = navy_card(params, t, t0) if kind == "navy" else photo_card(params, t, t0, t1)
        k = ease((t - t0) / 0.4)
        dx, dy = int((1 - k) * 90), int((1 - k) * 26)
        sh = card_shadow()
        frame.paste(sh, (CX0 - 80 + dx, CY0 - 80 + dy), sh)
        frame.paste(card, (CX0 + dx, CY0 + dy), card_mask())
    if t < 0.35:
        frame = Image.blend(Image.new("RGB", (W, H), BG), frame, t / 0.35)
    return frame


# ---------------------------------------------------------------- bande-son

def build_audio(path):
    n = int(SR * DUR)
    music, voice = np.zeros(n), np.zeros(n)
    rng = np.random.default_rng(5)

    def add(buf, sig, at, gain=1.0):
        i = int(at * SR)
        if 0 <= i < n:
            sig = sig[: n - i]
            buf[i:i + len(sig)] += sig * gain

    def env(length, decay):
        x = np.arange(int(length * SR)) / SR
        return x, np.exp(-x / decay)

    def kick():
        x, e = env(0.3, 0.08)
        return np.sin(2 * np.pi * np.cumsum(48 + 90 * np.exp(-x / 0.03)) / SR) * e

    def shaker():
        x, e = env(0.06, 0.012)
        return np.diff(rng.standard_normal(len(x)), prepend=0) * e

    def pluck(freq, length=0.6):
        x, e = env(length, 0.16)
        return (np.sin(2 * np.pi * freq * x) + 0.4 * np.sin(4 * np.pi * freq * x) * np.exp(-x / 0.04)) * e

    def bass(freq, length=0.45):
        x, e = env(length, 0.22)
        return np.tanh((np.sin(2 * np.pi * freq * x) + 0.3 * np.sin(4 * np.pi * freq * x)) * 1.5) * e * np.minimum(1, x / 0.005)

    def whoosh():
        x = np.arange(int(0.32 * SR)) / SR
        s = np.convolve(rng.standard_normal(len(x)), np.ones(30) / 30, "same")
        return s * np.sin(np.pi * x / 0.32) ** 2

    beat = 60 / 104
    end = DUR - OUTRO - 0.3
    k = kick()
    riff = [(0, 55.0), (1.5, 55.0), (2, 65.41), (3, 49.0), (3.5, 55.0)]
    mel = [440, 523.25, 659.25, 587.33, 523.25, 440, 392, 440]
    b = 0
    t = 0.0
    while t < end:
        add(music, k, t, 0.75 if b % 2 == 0 else 0.4)
        add(music, shaker(), t + beat / 2, 0.14)
        add(music, shaker(), t, 0.07)
        if b % 4 == 0:
            for off, f in riff:
                add(music, bass(f), t + off * beat, 0.5)
        if b >= 8 and b % 2 == 0:
            add(music, pluck(mel[(b // 2) % 8]), t + beat / 2, 0.16)
        t += beat
        b += 1
    x = np.arange(n) / SR
    pad = sum(np.sin(2 * np.pi * f * x + ph) for f, ph in ((110, 0), (164.81, 1), (220, 2), (329.63, 3)))
    music += pad * np.interp(x, [0, 1, end, DUR - 0.3, DUR], [0, 1, 1, 0.7, 0]) * 0.045
    for j, f in enumerate((440, 659.25, 880)):
        add(music, pluck(f, 1.8), DUR - OUTRO + 0.25 * j, 0.3)
    add(music, bass(55.0, 1.6), DUR - OUTRO, 0.7)
    for bt in BEATS[1:]:  # souffle léger à chaque changement de carte
        add(music, whoosh(), bt[0] - 0.12, 0.22)
    for cid, _, _ in SEGMENTS:
        add(voice, CLIPS[cid], T[cid])
    music /= np.abs(music).max()
    win = int(0.15 * SR)
    duck = np.clip(np.convolve(np.abs(voice), np.ones(win) / win, "same") / 0.1, 0, 1)
    duck = np.convolve(duck, np.ones(win) / win, "same")
    music *= 0.42 * (1 - 0.6 * duck)
    stereo = np.stack([music + voice, np.roll(music, 180) + voice], axis=1)
    stereo = np.tanh(stereo * 1.1) * 0.84
    with wave.open(str(path), "wb") as f:
        f.setnchannels(2)
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes((stereo * 32767).astype(np.int16).tobytes())


# -------------------------------------------------------------------- rendu

def main():
    build_timeline()
    print(f"durée : {DUR:.1f} s, {len(BEATS)} cartes")
    if "--stills" in sys.argv:
        times = [b[0] + min(2.2, 0.75 * ((BEATS[i + 1][0] if i + 1 < len(BEATS) else DUR - OUTRO) - b[0]))
                 for i, b in enumerate(BEATS)] + [DUR - OUTRO - 0.2, DUR - 0.6]
        cols = (len(times) + 1) // 2
        sheet = Image.new("RGB", (240 * cols, 427 * 2))
        for i, t in enumerate(times):
            sheet.paste(render(t).resize((240, 427)), ((i % cols) * 240, (i // cols) * 427))
        sheet.save(OUT / "v3-planche.jpg", quality=86)
        return
    wav = OUT / "promo3.wav"
    build_audio(wav)
    mp4 = OUT / f"{NAME}.mp4"
    cmd = ["ffmpeg", "-y", "-loglevel", "error",
           "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           "-i", str(wav), "-c:v", "libx264", "-preset", "medium", "-crf", "21", "-maxrate", "6M",
           "-bufsize", "12M", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-shortest",
           "-movflags", "+faststart", str(mp4)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    total = int(DUR * FPS)
    for i in range(total):
        proc.stdin.write(render(i / FPS).tobytes())
        if i % 300 == 0:
            print(f"  image {i}/{total}", flush=True)
    proc.stdin.close()
    if proc.wait() != 0:
        sys.exit("ffmpeg a échoué")
    wav.unlink()
    print("film :", mp4)


if __name__ == "__main__":
    main()
