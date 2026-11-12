#!/usr/bin/env python3
"""Film promo v2 : voix off qui raconte le parcours, montage calé sur la voix.

    python3 tools/build_promo2.py            # promo/out/cossi-agbokou-promo-v2.mp4
    python3 tools/build_promo2.py --stills   # planche d'images tests

Voix : Piper (fr_FR-tom-medium, dans voices/). Contact du carton final :
variable PROMO_CONTACT (« e-mail|téléphone »).
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

ROOT, OUT = bp.ROOT, bp.OUT
W, H, FPS = bp.W, bp.H, bp.FPS
NAVY, CREAM, GOLD, RED = bp.NAVY, bp.CREAM, bp.GOLD, bp.RED
PAPER = (243, 237, 221)
INK = (16, 20, 44)
DGOLD = (176, 128, 20)
ease, smooth = bp.ease, bp.smooth
SR = 44100
VOICE = ROOT / "voices" / "fr_FR-tom-medium.onnx"
MONO = "/usr/share/fonts/truetype/jetbrains-mono/JetBrainsMono-Bold.ttf"
if not Path(MONO).exists():
    MONO = "/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf"

# ------------------------------------------------------------------ voix off
# (identifiant, texte dit, silence après)
CUES = [
    ("c1", "Avant le premier clap, il y a une page blanche.", 0.55),
    ("c2", "Cossi Agbokou la remplit.", 0.50),
    ("c3", "Quarante épisodes, pour la série La Calebasse du Destin.", 0.30),
    ("c4", "Une vingtaine de sitcoms.", 0.30),
    ("c5", "Deux longs-métrages : Prémonition, et Karma.", 0.30),
    ("c6", "Un documentaire : Les dix mille cascades de Palimé.", 0.60),
    ("c7", "Pour lui, écrire, c'est déjà produire.", 0.25),
    ("c7b", "Chaque scène est pensée pour être tournée.", 0.65),
    ("c8", "Puis il passe à la réalisation.", 0.30),
    ("c9a", "Karma.", 0.14), ("c9b", "Prémonition.", 0.14), ("c9c", "Xola.", 0.14),
    ("c9d", "Mon Patron.", 0.14), ("c9e", "Afi.", 0.35),
    ("c10", "Il dirige les acteurs, et tourne en caméra RED, huit K.", 0.65),
    ("c11", "Et quand il faut tenir un plateau, il le tient.", 0.35),
    ("c12", "Directeur de production de quatre sitcoms, et des émissions Global Africa, pour Télé Sud.", 0.35),
    ("c13", "Assistant de production chez Shama Production.", 0.40),
    ("c14a", "Le planning.", 0.16), ("c14b", "L'équipe.", 0.16), ("c14c", "Le budget.", 0.65),
    ("c15", "Diplômé de l'Isma. Neuf structures partenaires, dans quatre pays.", 0.30),
    ("c16a", "Bénin.", 0.12), ("c16b", "Togo.", 0.12), ("c16c", "Cameroun.", 0.12), ("c16d", "France.", 0.70),
    ("c17", "Cossi Agbokou.", 0.35),
    ("c18a", "Scénariste.", 0.14), ("c18b", "Réalisateur.", 0.14), ("c18c", "Assistant de production.", 0.45),
    ("c19", "Votre prochain tournage commence avec lui.", 0.0),
]
VO_START, TAIL = 1.5, 2.6
T, D, CLIPS = {}, {}, {}
DUR = 0.0


def tts(cid, text):
    vo = OUT / "vo"
    vo.mkdir(parents=True, exist_ok=True)
    path = vo / f"{cid}.wav"
    stamp = vo / f"{cid}.txt"
    if not path.exists() or not stamp.exists() or stamp.read_text() != text:
        subprocess.run([sys.executable, "-m", "piper", "-m", str(VOICE), "-f", str(path),
                        "--length-scale", "1.02"], input=text.encode(), check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        stamp.write_text(text)
    with wave.open(str(path)) as f:
        sr = f.getframerate()
        x = np.frombuffer(f.readframes(f.getnframes()), dtype=np.int16).astype(np.float64) / 32768
    loud = np.where(np.abs(x) > 0.02)[0]
    x = x[max(0, loud[0] - 400):loud[-1] + 1500]
    # Voix un peu plus grave et plus posée
    n = int(len(x) * SR / sr * 1.06)
    x = np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x)
    return x / np.abs(x).max() * 0.9


def build_timeline():
    global DUR
    t = VO_START
    for cid, text, gap in CUES:
        CLIPS[cid] = tts(cid, text)
        T[cid], D[cid] = t, len(CLIPS[cid]) / SR
        t += D[cid] + gap
    DUR = math_ceil(t + TAIL)


def math_ceil(x):
    return float(int(x * 2 + 0.999) / 2)


# ------------------------------------------------------------------- dessin

@functools.lru_cache(None)
def fnt(name, size):
    if name == "mono":
        return ImageFont.truetype(MONO, size)
    return ImageFont.truetype(str(bp.FONT_DIR / f"{name}.otf"), size)


_probe = ImageDraw.Draw(Image.new("RGB", (8, 8)))


@functools.lru_cache(None)
def fit(text, name="InterDisplay-Black", maxw=936, maxsize=190):
    size = maxsize
    while size > 20 and _probe.textlength(text, font=fnt(name, size)) > maxw:
        size -= 4
    return fnt(name, size)


_layers = {}


def layer(*items):
    key = repr(items)
    if key not in _layers:
        _layers[key] = bp.text_layer(list(items))
    return _layers[key]


def show(frame, t, start, *items, slide=50, dur=0.38):
    if t >= start:
        bp.put_anim(frame, layer(*items), t, start, slide=slide, dur=dur)


def flash(frame, t, cuts, strong=()):
    for c in cuts:
        if 0 <= t - c < 0.13:
            a = (1 - (t - c) / 0.13) * (0.6 if c in strong else 0.32)
            return Image.blend(frame, Image.new("RGB", (W, H), (255, 250, 235)), a)
    return frame


def shot(frame, name, t, t0, t1, z0, z1, c0, c1, punch=True):
    p = min(1.0, max(0.0, (t - t0) / (t1 - t0)))
    k = 1 + (0.07 * (1 - ease((t - t0) / 0.28)) if punch else 0)
    frame.paste(bp.window(name, p, z0 * k, z1 * k, c0, c1), (0, 0))
    frame.paste(bp.FADE, (0, 0), bp.FADE)
    bp.put(frame, bp.TAG)


@functools.lru_cache(None)
def backdrop(name, dark=0.72):
    src = bp.photo(name)
    s = max(W / src.width, H / src.height)
    im = src.resize((int(src.width * s) + 1, int(src.height * s) + 1), Image.BICUBIC)
    x, y = (im.width - W) // 2, (im.height - H) // 2
    im = im.crop((x, y, x + W, y + H)).filter(ImageFilter.GaussianBlur(14))
    return Image.blend(im, Image.new("RGB", (W, H), NAVY), dark)


P1, P2, P3 = "01-portrait-plateau-tv.jpg", "02-clap-moniteur-red.jpg", "03-equipe-image-son.jpg"
P4, P5 = "04-prise-de-vue-decor-naturel.jpg", "05-installation-machinerie.jpg"
P6, P7 = "06-retour-moniteur.jpg", "07-projection-evenement.jpg"

# ------------------------------------------------------------------- scènes

ROWS = [("c3", 40, "", "épisodes", "La Calebasse du Destin"),
        ("c4", 20, "~", "sitcoms", "Novo Image Bénin"),
        ("c5", 2, "", "longs-métrages", "Prémonition · Karma"),
        ("c6", 1, "", "documentaire", "Les 10 000 Cascades de Kpalimé")]
CPS = 26  # caractères tapés par seconde


def typed(d, text, font, xy, color, t, t0, cursor=True):
    n = int(max(0, (t - t0) * CPS))
    d.text(xy, text[:n], font=font, fill=color)
    if cursor and 0 <= n <= len(text) + 8 and int(t * 4) % 2 == 0:
        x = xy[0] + d.textlength(text[:n], font=font)
        d.rectangle((x + 4, xy[1] + 6, x + 4 + font.size * 0.5, xy[1] + font.size), fill=RED)


def typed_ticks():
    """Instants des frappes de machine à écrire, pour la bande-son."""
    out = []
    lines = [(T["c2"] + 0.05, "ÉCRIT PAR"), (T["c2"] + 0.45, "COSSI AGBOKOU")]
    lines += [(T[c] + 0.35, sub) for c, _, _, _, sub in ROWS]
    for t0, text in lines:
        out += [t0 + i / CPS for i, ch in enumerate(text) if ch != " "]
    return out


def scene_page(frame, t):
    frame.paste(PAPER, (0, 0, W, H))
    d = ImageDraw.Draw(frame)
    d.line((60, 0, 60, H), fill=(214, 150, 150), width=3)
    for y in range(560, 1700, 62):
        d.line((0, y, W, y), fill=(226, 219, 200), width=2)
    if t < T["c2"]:  # page blanche, curseur seul
        if int(t * 4) % 2 == 0:
            d.rectangle((96, 262, 122, 310), fill=RED)
        return
    typed(d, "ÉCRIT PAR", fnt("mono", 44), (96, 210), DGOLD, t, T["c2"] + 0.05, cursor=False)
    typed(d, "COSSI AGBOKOU", fit("COSSI AGBOKOU", maxw=900, maxsize=120), (92, 280), INK, t, T["c2"] + 0.45)
    d.rectangle((96, 440, 96 + 180 * ease((t - T["c2"] - 0.9) / 0.4), 450), fill=RED)
    for i, (cue, num, pre, word, sub) in enumerate(ROWS):
        if t < T[cue]:
            break
        y = 590 + i * 262
        k = ease((t - T[cue]) / 0.45)
        val = pre + str(int(round(num * k)))
        d.text((410, y + 190 - 30 * (1 - k)), val, font=fnt("InterDisplay-Black", 168), fill=DGOLD, anchor="rs")
        d.text((446, y + 30), word, font=fit(word, maxw=560, maxsize=84), fill=INK)
        typed(d, sub, fnt("mono", 33), (448, y + 140), INK, t, T[cue] + 0.35)


def scene_quote(frame, t):
    d = ImageDraw.Draw(frame)
    d.rectangle((72, 520, 84, 520 + 640 * ease((t - T["c7"]) / 0.6)), fill=RED)
    words = [("Écrire,", CREAM, 0.30), ("c'est déjà", CREAM, 0.52), ("produire.", GOLD, 0.74)]
    for i, (w, col, fr) in enumerate(words):
        show(frame, t, T["c7"] + D["c7"] * fr, (w, fit(w, maxw=860, maxsize=200), col, 124, 520 + i * 215))
    show(frame, t, T["c7b"] + 0.1,
         ("Chaque scène est pensée", fnt("Inter-MediumItalic", 54), CREAM, 124, 1250),
         ("pour être tournée.", fnt("Inter-MediumItalic", 54), CREAM, 124, 1322))


FILMS = [("c9a", "Karma", P4, 1.05, (0.50, 0.50)), ("c9b", "Prémonition", P6, 1.00, (0.45, 0.50)),
         ("c9c", "Xola", P2, 1.25, (0.55, 0.58)), ("c9d", "Mon Patron", P4, 1.55, (0.72, 0.52)),
         ("c9e", "Afi", P6, 1.30, (0.60, 0.50))]


def scene_direct(frame, t):
    if t < T["c9a"]:
        shot(frame, P4, t, T["c8"], T["c9a"], 1.00, 1.12, (0.45, 0.5), (0.55, 0.52))
        show(frame, t, T["c8"] + 0.1, ("Il réalise.", fnt("InterDisplay-Black", 170), CREAM, 66, 1300),
             ("rect", GOLD, (72, 1512, 252, 1520)))
    elif t < T["c10"]:
        for i, (cue, title, ph, z, c) in enumerate(FILMS):
            end = T[FILMS[i + 1][0]] if i + 1 < len(FILMS) else T["c10"]
            if T[cue] <= t < end:
                shot(frame, ph, t, T[cue], end, z, z * 1.06, c, c)
                bp.put(frame, layer(("RÉALISATEUR", fnt("Inter-Bold", 38), GOLD, 72, 1310)))
                show(frame, t, T[cue], (title, fit(title, maxsize=210), CREAM, 66, 1360), slide=70, dur=0.22)
                bp.put(frame, layer((f"{i + 1} / 5", fnt("mono", 34), GOLD, 72, 1640)))
    else:
        shot(frame, P2, t, T["c10"], T["c11"], 1.30, 1.55, (0.56, 0.56), (0.57, 0.56))
        show(frame, t, T["c10"] + 0.1, ("Direction d'acteurs", fit("Direction d'acteurs", maxsize=110), CREAM, 66, 1300))
        show(frame, t, T["c10"] + D["c10"] * 0.48, ("RED 8K", fnt("InterDisplay-Black", 230), GOLD, 62, 1420), slide=80)


def scene_prod(frame, t):
    if t < T["c13"]:
        shot(frame, P3, t, T["c11"], T["c13"], 1.20, 1.00, (0.5, 0.42), (0.5, 0.5))
        if t < T["c12"]:
            show(frame, t, T["c11"] + D["c11"] * 0.55,
                 ("Il tient", fnt("InterDisplay-Black", 170), CREAM, 66, 1290),
                 ("le plateau.", fnt("InterDisplay-Black", 170), GOLD, 66, 1460))
        else:
            show(frame, t, T["c12"] + 0.05, ("DIRECTEUR DE PRODUCTION", fnt("Inter-Bold", 40), GOLD, 72, 1300))
            show(frame, t, T["c12"] + D["c12"] * 0.30, ("4 sitcoms", fnt("InterDisplay-Black", 170), CREAM, 66, 1352))
            show(frame, t, T["c12"] + D["c12"] * 0.58,
                 ("Global Africa · Télé Sud", fit("Global Africa · Télé Sud", "Inter-SemiBold", 936, 70), CREAM, 72, 1570))
    elif t < T["c14a"]:
        shot(frame, P5, t, T["c13"], T["c14a"], 1.00, 1.05, (0.30, 0.5), (0.70, 0.5))
        show(frame, t, T["c13"] + 0.05, ("ASSISTANT DE PRODUCTION", fnt("Inter-Bold", 40), GOLD, 72, 1300))
        show(frame, t, T["c13"] + D["c13"] * 0.5, ("Shama", fnt("InterDisplay-Black", 170), CREAM, 66, 1352),
             ("Production", fnt("InterDisplay-Black", 170), CREAM, 66, 1520))
    else:
        frame.paste(backdrop(P3, 0.86), (0, 0))
        words = [("c14a", "Le planning.", CREAM), ("c14b", "L'équipe.", CREAM), ("c14c", "Le budget.", GOLD)]
        for i, (cue, w, col) in enumerate(words):
            if t >= T[cue]:
                y = 560 + i * 260
                show(frame, t, T[cue], ("rect", RED, (72, y + 60, 100, y + 150)),
                     (w, fit(w, maxw=880, maxsize=170), col, 132, y), slide=80, dur=0.25)


PARTNERS = [("Novo Image / Akebulan Studio 55", "BÉNIN"), ("Télé Sud", "FRANCE"), ("A+ Bénin", "BÉNIN"),
            ("Shama Production", "TOGO"), ("Daayek Production", "TOGO"), ("Joker Groupe", "TOGO"),
            ("Nbiko TV", "CAMEROUN"), ("Undercover Brothers Ent.", "FRANCE"), ("Toofan", "TOGO")]
COUNTRIES = [("c16a", "Bénin"), ("c16b", "Togo"), ("c16c", "Cameroun"), ("c16d", "France")]


def scene_network(frame, t):
    frame.paste(backdrop(P7, 0.80), (0, 0))
    show(frame, t, T["c15"] + 0.05, ("DIPLÔMÉ DE L'", fnt("Inter-Bold", 40), CREAM, 72, 190),
         ("ISMA", fnt("InterDisplay-Black", 200), GOLD, 64, 232),
         ("Réalisation Cinéma et Télévision", fnt("Inter-MediumItalic", 42), CREAM, 72, 452))
    t0 = T["c15"] + D["c15"] * 0.36
    show(frame, t, t0, ("rect", RED, (72, 560, 252, 570)),
         ("9 STRUCTURES PARTENAIRES", fnt("Inter-Bold", 40), GOLD, 72, 596))
    step = (T["c16a"] - t0 - 0.3) / len(PARTNERS)
    for i, (name, country) in enumerate(PARTNERS):
        y = 676 + i * 78
        show(frame, t, t0 + 0.15 + i * step, (name, fnt("Inter-SemiBold", 44), CREAM, 72, y),
             (country, fnt("Inter-Bold", 26), GOLD, 1008 - _probe.textlength(country, font=fnt("Inter-Bold", 26)), y + 14),
             slide=30, dur=0.25)
    for i, (cue, name) in enumerate(COUNTRIES):
        if t >= T[cue]:
            x, y = 72 + (i % 2) * 480, 1440 + (i // 2) * 150
            show(frame, t, T[cue], (name, fit(name, maxw=450, maxsize=112), GOLD if i % 2 else CREAM, x, y),
                 slide=60, dur=0.22)


CONTACT = bp.CONTACT


def scene_sign(frame, t):
    t0 = T["c17"]
    p = min(1.0, (t - t0) / (DUR - t0))
    frame.paste(bp.window(P1, smooth(p), 1.55, 1.12, (0.47, 0.25), (0.47, 0.33)), (0, 0))
    frame.paste(bp.FADE, (0, 0), bp.FADE)
    veil = Image.new("RGB", (W, H), NAVY)
    frame.paste(Image.blend(frame, veil, 0.78 * smooth((t - t0 - 0.9) / 0.8)), (0, 0))
    cx = W // 2
    show(frame, t, t0 + 0.05, ("COSSI", bp.F_NAME, CREAM, cx, 620, "c"), ("AGBOKOU", bp.F_NAME, GOLD, cx, 782, "c"),
         ("rect", RED, (cx - 90, 992, cx + 90, 1002)), slide=70)
    roles = [("c18a", "Scénariste"), ("c18b", "Réalisateur"), ("c18c", "Assistant de production")]
    for i, (cue, r) in enumerate(roles):
        show(frame, t, T[cue], (r, fnt("Inter-SemiBold", 58), CREAM, cx, 1050 + i * 80, "c"), dur=0.25)
    show(frame, t, T["c19"] + 0.05, ("Votre prochain tournage", fnt("Inter-MediumItalic", 54), GOLD, cx, 1340, "c"),
         ("commence ici.", fnt("Inter-MediumItalic", 54), GOLD, cx, 1408, "c"))
    show(frame, t, T["c19"] + D["c19"] + 0.1, ("COTONOU · BÉNIN", fnt("Inter-Bold", 40), CREAM, cx, 1540, "c"),
         *[(c, fnt("Inter-SemiBold", 50), CREAM, cx, 1610 + 72 * i, "c") for i, c in enumerate(CONTACT)])


CLAP_T = 0.6


def render(t):
    frame = Image.new("RGB", (W, H), NAVY)
    t_page = T["c1"] + D["c1"] * 0.62
    cuts = [CLAP_T, t_page, T["c7"], T["c8"]] + [T[c[0]] for c in FILMS] + [
        T["c10"], T["c11"], T["c13"], T["c14a"], T["c15"], T["c17"]]
    if t < t_page:
        if t >= CLAP_T:
            shot(frame, P2, t, CLAP_T, t_page, 1.0, 1.35, (0.5, 0.5), (0.56, 0.58))
            frame.paste(layer(("rect", NAVY, (0, 0, 420, 130))), (0, 0), layer(("rect", NAVY, (0, 0, 420, 130))))
            show(frame, t, T["c1"], ("Avant le premier clap…", fit("Avant le premier clap…", maxsize=96), CREAM, 66, 1340))
    elif t < T["c7"]:
        scene_page(frame, t)
    elif t < T["c8"]:
        scene_quote(frame, t)
    elif t < T["c11"]:
        scene_direct(frame, t)
    elif t < T["c15"]:
        scene_prod(frame, t)
    elif t < T["c17"]:
        scene_network(frame, t)
    else:
        scene_sign(frame, t)
    frame = flash(frame, t, cuts, strong=(CLAP_T, t_page, T["c17"]))
    # Barre de progression dorée
    ImageDraw.Draw(frame).rectangle((0, H - 8, W * t / DUR, H), fill=GOLD)
    if t > DUR - 0.5:
        frame = Image.blend(frame, Image.new("RGB", (W, H), (0, 0, 0)), (t - (DUR - 0.5)) / 0.5)
    return frame


# ---------------------------------------------------------------- bande-son

def build_audio(path):
    n = int(SR * DUR)
    music, voice, fx = np.zeros(n), np.zeros(n), np.zeros(n)
    rng = np.random.default_rng(11)

    def add(buf, sig, at, gain=1.0):
        i = int(at * SR)
        if 0 <= i < n:
            sig = sig[: n - i]
            buf[i:i + len(sig)] += sig * gain

    def env(length, decay):
        x = np.arange(int(length * SR)) / SR
        return x, np.exp(-x / decay)

    def kick():
        x, e = env(0.35, 0.09)
        return np.sin(2 * np.pi * np.cumsum(46 + 110 * np.exp(-x / 0.03)) / SR) * e

    def tone(freq):
        x, e = env(0.22, 0.06)
        return np.sin(2 * np.pi * np.cumsum(freq * (1 + 0.25 * np.exp(-x / 0.02))) / SR) * e

    def noise(length, decay):
        x, e = env(length, decay)
        return np.diff(rng.standard_normal(len(x)), prepend=0) * e

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
        x, e = env(length, 0.22 * length / 0.42)
        return np.tanh((np.sin(2 * np.pi * freq * x) + 0.35 * np.sin(4 * np.pi * freq * x)) * 1.6) * e * np.minimum(1, x / 0.005)

    def grid(t0, t1, step):
        t = np.ceil(t0 / step) * step
        while t < t1:
            yield t
            t += step

    k, cl = kick(), clap()
    tB, tC, tD, tE, tF, tG = T["c2"], T["c7"], T["c8"], T["c11"], T["c15"], T["c17"]
    add(fx, cl, CLAP_T, 0.9)
    add(music, k, CLAP_T, 0.8)
    # Écriture : pulsation légère
    for t in grid(tB, tC - 0.3, 0.5):
        add(music, k, t, 0.45)
    for t in grid(tB, tC - 0.3, 0.25):
        add(music, noise(0.06, 0.012), t, 0.08)
    # Citation : un seul coup grave
    add(music, bass(55.0, 2.2), tC, 0.7)
    add(music, k, tC, 0.9)
    # Réalisation, production, réseau : rythme complet
    stop = tG - 0.45
    for t in grid(tD, stop, 0.5):
        add(music, k, t, 0.9)
    for t in grid(tD, stop, 0.125):
        add(music, noise(0.06, 0.012), t, 0.16 if int(round(t / 0.125)) % 2 == 0 else 0.09)
    pattern = [(0.0, 196), (0.375, 262), (0.75, 196), (1.0, 147), (1.25, 262), (1.625, 196), (1.75, 220)]
    for t in grid(tD, stop - 1.9, 2.0):
        for off, f in pattern:
            add(music, tone(f), t + off, 0.32)
    riff = [(0.0, 55.0), (0.75, 55.0), (1.0, 65.41), (1.5, 49.0), (1.75, 55.0)]
    for t in grid(tB, tC - 1.0, 2.0):
        for off, f in riff:
            add(music, bass(f), t + off, 0.32)
    for t in grid(tD, stop - 1.9, 2.0):
        for off, f in riff:
            add(music, bass(f), t + off, 0.5)
    notes = [440, 523.25, 587.33, 659.25, 783.99, 659.25, 587.33, 523.25]
    for i, t in enumerate(grid(tE, stop, 0.25)):
        add(music, pluck(notes[i % 8]), t, 0.17)
    rise = noise(3.0, 99)
    add(music, rise * np.linspace(0, 1, len(rise)) ** 2, stop - 3.0, 0.11)
    # Signature
    add(music, k, tG, 1.1)
    add(fx, cl, tG, 0.7)
    add(music, bass(55.0, 2.6), tG, 0.6)
    for j, f in enumerate((440, 659.25, 880)):
        add(music, pluck(f, 1.6), tG + 0.5 * j, 0.2)
    for i, t in enumerate(grid(tG + 2.0, DUR - 1.6, 1.0)):
        add(music, k, t, 0.45)
        add(music, pluck(440 if i % 2 == 0 else 523.25, 0.9), t + 0.5, 0.11)
    add(fx, cl, DUR - 1.2, 0.8)
    # Nappe
    x = np.arange(n) / SR
    pad = sum(np.sin(2 * np.pi * f * x + ph) for f, ph in ((110, 0), (164.81, 1), (220, 2), (261.63, 3)))
    music += pad * np.interp(x, [0, 1.5, tC, tD, stop, tG, tG + 0.4, DUR - 1, DUR], [0, .6, .9, 1, 1, 0, 1, .8, 0]) * 0.04
    # Frappes de machine à écrire
    for t in typed_ticks():
        add(fx, noise(0.03, 0.004), t, 0.10 + 0.05 * rng.random())
    # Voix
    for cid, _, _ in CUES:
        add(voice, CLIPS[cid], T[cid])
    music /= np.abs(music).max()
    win = int(0.12 * SR)
    duck = np.convolve(np.abs(voice), np.ones(win) / win, "same")
    duck = np.clip(duck / 0.12, 0, 1)
    duck = np.convolve(duck, np.ones(win) / win, "same")
    music *= 0.62 * (1 - 0.62 * duck)
    wet = np.zeros(n)
    dry = music + fx * 0.6
    for delay, g in ((0.031, 0.30), (0.047, 0.24), (0.073, 0.18), (0.113, 0.12), (0.167, 0.08)):
        dly = int(delay * SR)
        wet[dly:] += dry[:-dly] * g + voice[:-dly] * g * 0.22
    left, right = dry + voice + wet, dry + voice + np.roll(wet, 233)
    stereo = np.stack([left, right], axis=1)
    stereo = np.tanh(stereo * 1.15) * 0.92
    with wave.open(str(path), "wb") as f:
        f.setnchannels(2)
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes((stereo * 32767).astype(np.int16).tobytes())


# -------------------------------------------------------------------- rendu

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    build_timeline()
    print(f"durée : {DUR:.1f} s")
    if "--stills" in sys.argv:
        times = [1.0, T["c1"] + D["c1"] * 0.9, T["c3"] + 1.0, T["c6"] + D["c6"], T["c7b"] + 1.0, T["c8"] + 1.0,
                 T["c9b"] + 0.4, T["c9d"] + 0.4, T["c10"] + D["c10"], T["c11"] + D["c11"], T["c12"] + D["c12"],
                 T["c13"] + D["c13"], T["c14c"] + 0.5, T["c15"] + D["c15"], T["c16d"] + 0.5, T["c18c"] + 0.3,
                 DUR - 1.0]
        sheet = Image.new("RGB", (270 * 9, 480 * 2))
        for i, t in enumerate(times):
            sheet.paste(render(t).resize((270, 480)), ((i % 9) * 270, (i // 9) * 480))
        sheet.save(OUT / "v2-planche.jpg", quality=85)
        print({k: round(v, 2) for k, v in T.items()})
        return
    wav = OUT / "promo2.wav"
    build_audio(wav)
    if "--audio" in sys.argv:
        return
    mp4 = OUT / "cossi-agbokou-promo-v2.mp4"
    cmd = ["ffmpeg", "-y", "-loglevel", "error",
           "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           "-i", str(wav), "-vf", "noise=alls=3:allf=t,vignette=PI/6",
           "-c:v", "libx264", "-preset", "medium", "-crf", "22", "-maxrate", "5M", "-bufsize", "10M",
           "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", str(mp4)]
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
