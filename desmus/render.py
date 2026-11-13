"""Image de la vidéo DJ Desmus (1080x1920, 30 i/s), rendue image par image.

python3 render.py 60 [--still 12.5 ...]   -> build/desmus_60.mp4 (ou des images fixes)
"""
import json, math, os, subprocess, sys
from functools import lru_cache
from multiprocessing import Pool
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

from timeline import W, H, FPS, BEAT, HERE, seg, snap

A = os.path.join(HERE, "assets")
F = os.path.join(HERE, "fonts")
B = os.path.join(HERE, "build")
CFG = json.load(open(os.path.join(HERE, "config.json")))
rng = np.random.default_rng(229)

GOLD_STOPS = [(0, (255, 246, 205)), (0.32, (243, 205, 98)), (0.55, (196, 139, 42)), (0.72, (248, 214, 120)),
              (1, (156, 104, 30))]
GOLD = (243, 197, 82)


# ====================================================================== utilitaires
def ease(x):
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


def out_expo(x):
    x = min(1.0, max(0.0, x))
    return 1 - 2 ** (-10 * x) if x < 1 else 1.0


def font(name, size, var=None):
    return _font(name, size, var)


@lru_cache(maxsize=None)
def _font(name, size, var):
    f = ImageFont.truetype(os.path.join(F, name), size)
    if var:
        f.set_variation_by_name(var)
    return f


def grade(img, warm=1.0):
    """Look club : noirs profonds, ombres bleu nuit, hautes lumières dorées."""
    x = np.asarray(img.convert("RGB"), np.float32) / 255
    x = np.clip((x - 0.035) / 0.965, 0, 1) ** 1.15
    x = np.clip(0.5 + (x - 0.5) * 1.12, 0, 1)
    lum = (x @ np.array([0.2126, 0.7152, 0.0722], np.float32))[..., None]
    x = x + (1 - lum) ** 2 * np.array([-0.025, -0.005, 0.045]) + lum ** 2 * np.array([0.05, 0.02, -0.035]) * warm
    x = lum + (x - lum) * 1.12
    return Image.fromarray((np.clip(x, 0, 1) * 255).astype(np.uint8))


def upscale(img, f=2):
    im = img.resize((img.width * f, img.height * f), Image.LANCZOS)
    return im.filter(ImageFilter.UnsharpMask(radius=2.2, percent=70, threshold=2))


def view(img, cx, cy, zoom=1.0, rot=0.0, out=(W, H)):
    """Cadre (cx, cy en fraction de l'image) avec zoom (1 = plein cadre) et rotation légère."""
    iw, ih = img.size
    ow, oh = out
    s = max(ow / iw, oh / ih) * zoom
    vw, vh = ow / s, oh / s
    x0 = min(max(cx * iw - vw / 2, 0), iw - vw)
    y0 = min(max(cy * ih - vh / 2, 0), ih - vh)
    if rot:
        a = math.radians(rot)
        c, s_ = math.cos(a) / s, math.sin(a) / s
        mx, my = x0 + vw / 2, y0 + vh / 2
        data = (c, s_, mx - c * ow / 2 - s_ * oh / 2, -s_, c, my + s_ * ow / 2 - c * oh / 2)
    else:
        data = (1 / s, 0, x0, 0, 1 / s, y0)
    return np.asarray(img.transform(out, Image.AFFINE, data, Image.BILINEAR), np.float32) / 255


def to_np(img):
    return np.asarray(img, np.float32) / 255


def screen(a, b):
    return 1 - (1 - a) * (1 - b)


def blit(frame, rgba, x, y, alpha=1.0):
    """Colle une image RGBA (numpy float, alpha prémultiplié non) en (x, y) coin haut-gauche."""
    if alpha <= 0.003:
        return
    h, w = rgba.shape[:2]
    x, y = int(round(x)), int(round(y))
    fx0, fy0 = max(0, x), max(0, y)
    fx1, fy1 = min(W, x + w), min(H, y + h)
    if fx0 >= fx1 or fy0 >= fy1:
        return
    sub = rgba[fy0 - y:fy1 - y, fx0 - x:fx1 - x]
    a = sub[..., 3:4] * alpha
    frame[fy0:fy1, fx0:fx1] = frame[fy0:fy1, fx0:fx1] * (1 - a) + sub[..., :3] * a


def blit_add(frame, rgb, x, y, k=1.0):
    h, w = rgb.shape[:2]
    x, y = int(round(x)), int(round(y))
    fx0, fy0, fx1, fy1 = max(0, x), max(0, y), min(W, x + w), min(H, y + h)
    if fx0 < fx1 and fy0 < fy1:
        frame[fy0:fy1, fx0:fx1] += rgb[fy0 - y:fy1 - y, fx0 - x:fx1 - x] * k


# ====================================================================== texte
def gold_fill(h, w):
    ys = np.linspace(0, 1, h)
    cols = np.stack([np.interp(ys, [s for s, _ in GOLD_STOPS], [c[i] for _, c in GOLD_STOPS]) for i in range(3)], 1)
    return np.repeat(cols[:, None, :], w, 1) / 255


@lru_cache(maxsize=512)
def text_img(text, fname, size, var=None, fill="white", track=0, glow=0, stroke=0, shadow=True):
    """Texte en RGBA float (h, w, 4) : blanc, or, ou couleur ; halo et ombre portée."""
    f = font(fname, size, var)
    widths = [f.getlength(ch) for ch in text]
    tw = int(sum(widths) + track * (len(text) - 1)) + 2
    asc, desc = f.getmetrics()
    pad = int(max(glow * 2.2, stroke * 2, 18))
    w, h = tw + 2 * pad, asc + desc + 2 * pad
    mask = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(mask)
    x = pad
    for ch, cw in zip(text, widths):
        d.text((x, pad), ch, font=f, fill=255)
        x += cw + track
    m = to_np(mask)
    if fill == "gold":
        rgb = gold_fill(h, w)
        top = np.nonzero(m.max(1) > 0.5)[0]
        if len(top):  # le dégradé suit la hauteur réelle des lettres
            y0, y1 = top[0], top[-1] + 1
            g = gold_fill(y1 - y0, w)
            rgb = np.concatenate([np.repeat(g[:1], y0, 0), g, np.repeat(g[-1:], h - y1, 0)], 0)
    else:
        col = (1, 1, 1) if fill == "white" else tuple(c / 255 for c in fill)
        rgb = np.ones((h, w, 3), np.float32) * np.array(col, np.float32)
    out = np.zeros((h, w, 4), np.float32)
    if shadow:
        sh = to_np(mask.filter(ImageFilter.GaussianBlur(max(6, size // 10))))
        sh = np.roll(sh, (size // 22, 0), (0, 1)) * 0.75
        out[..., 3] = sh
    if stroke:
        st = to_np(mask.filter(ImageFilter.MaxFilter(stroke * 2 + 1)))
        out[..., :3] = out[..., :3] * (1 - st[..., None])
        out[..., 3] = np.maximum(out[..., 3], st * 0.85)
    if glow:
        gl = to_np(mask.filter(ImageFilter.GaussianBlur(glow)))
        gcol = np.array(GOLD if fill == "gold" else ((255, 255, 255) if fill == "white" else fill), np.float32) / 255
        a = np.clip(gl * 0.9, 0, 1)
        out[..., :3] = out[..., :3] * (1 - a[..., None]) + gcol * a[..., None]
        out[..., 3] = np.maximum(out[..., 3], a)
    a = m[..., None]
    out[..., :3] = out[..., :3] * (1 - a) + rgb * a
    out[..., 3] = np.maximum(out[..., 3], m)
    return out


def scaled(img, s):
    if abs(s - 1) < 0.005:
        return img
    h, w = img.shape[:2]
    pil = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8), "RGBA")
    pil = pil.resize((max(1, int(w * s)), max(1, int(h * s))), Image.BILINEAR)
    return to_np(pil)


def title(frame, text, cy, t, t_in, t_out=None, fname="Anton-Regular.ttf", size=150, var=None, fill="gold",
          track=6, glow=20, from_scale=1.25, cx=W / 2, shine=False):
    """Titre animé : entrée zoom arrière + fondu, sortie fondu."""
    if t < t_in or (t_out is not None and t > t_out + 0.2):
        return
    p = out_expo((t - t_in) / 0.45)
    a = min(1, (t - t_in) / 0.12)
    if t_out is not None:
        a *= 1 - ease((t - t_out) / 0.2)
    img = text_img(text, fname, size, var, fill, track, glow)
    s = from_scale + (1 - from_scale) * p
    if shine and fill == "gold":
        img = img.copy()
        h, w = img.shape[:2]
        xx = np.arange(w)[None, :] + np.arange(h)[:, None] * 0.5
        pos = ((t - t_in) * 0.55 % 1.6 - 0.3) * (w + h)
        band = np.exp(-((xx - pos) / (w * 0.05)) ** 2)[..., None] * 0.65
        img[..., :3] = np.clip(img[..., :3] + band * img[..., 3:4], 0, 1)
    img = scaled(img, s)
    h, w = img.shape[:2]
    blit(frame, img, cx - w / 2, cy - h / 2, a)


# ====================================================================== décors
def load_assets():
    P = {}
    P["p1"] = grade(Image.open(f"{A}/p1_casque_rose.jpg"))
    P["p2"] = grade(Image.open(f"{A}/p2_profil_casque_main.jpg"))
    P["p3"] = grade(upscale(Image.open(f"{A}/p3_rose_mains.jpg")))
    P["p4"] = grade(upscale(Image.open(f"{A}/p4_sourire_casque.jpg")))
    P["p5"] = grade(upscale(Image.open(f"{A}/p5_scene_foule.jpg")))
    P["p6"] = grade(upscale(Image.open(f"{A}/p6_lunettes.jpg")))
    P["p2sil"] = silhouette(Image.open(f"{A}/p2_profil_casque_main.jpg"))
    P["p5sil"] = backlit(P["p5"])
    for k in ["p1", "p2", "p3", "p4", "p5", "p6"]:
        P[k + "bw"] = mono(P[k])
    P["p4blur"] = P["p4"].filter(ImageFilter.GaussianBlur(22))
    P["p6blur"] = P["p6"].filter(ImageFilter.GaussianBlur(18))
    P["city_night"], P["city_dusk"], P["windows"] = city()
    P["smoke"] = smoke_tex()
    P["dust"] = dust_tex()
    P["bokeh"] = bokeh_tex()
    P["vignette"] = vignette()
    P["grain"] = [(rng.standard_normal((H // 2, W // 2)).astype(np.float32)) for _ in range(10)]
    return P


def mono(img):
    g = ImageOps.grayscale(img)
    g = ImageOps.autocontrast(g, cutoff=1)
    x = to_np(g)[..., None]
    x = np.clip((x - 0.06) / 0.94, 0, 1) ** 1.25
    tint = x * np.array([1.0, 0.97, 0.9]) # noir et blanc légèrement chaud
    return Image.fromarray((np.clip(tint, 0, 1) * 255).astype(np.uint8))


def silhouette(img):
    """Contre-jour : le sujet devient une silhouette, le fond un mur de lumière."""
    img = img.convert("RGB")
    x = to_np(img)
    w0, h0 = img.size
    bg = np.median(np.concatenate([x[:80, :80].reshape(-1, 3), x[:80, -80:].reshape(-1, 3)]), 0)
    d = np.sqrt(((x - bg) ** 2).sum(-1))
    lum = x.mean(-1)
    m = ((d > 0.19) | (lum < 0.28)).astype(np.float32)
    mi = Image.fromarray((m * 255).astype(np.uint8)).resize((w0 // 4, h0 // 4), Image.BILINEAR)
    mi = mi.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MedianFilter(7)).filter(ImageFilter.GaussianBlur(2))
    mi = mi.resize((w0, h0), Image.BICUBIC).point(lambda v: 255 if v > 128 else 0).filter(ImageFilter.GaussianBlur(2))
    m = to_np(mi)[..., None]
    h, w = m.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    r = np.sqrt(((xx - w * 0.62) / w) ** 2 + ((yy - h * 0.32) / h) ** 2)
    light = np.clip(1.15 - r * 1.6, 0, 1)[..., None] ** 1.4
    back = light * np.array([1.0, 0.72, 0.38]) + (1 - light) * np.array([0.08, 0.02, 0.09])
    rim = to_np(mi.filter(ImageFilter.GaussianBlur(14)))[..., None]
    edge = np.clip((rim - m) * 3 + (m - to_np(mi.filter(ImageFilter.MinFilter(9)))[..., None]) * 0.8, 0, 1)
    subj = x * 0.07
    out = back * (1 - m) + subj * m + edge * np.array([1.0, 0.8, 0.45]) * light * 1.4
    return Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8))


def backlit(img):
    x = to_np(img)
    h, w = x.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    r = np.sqrt(((xx - w * 0.5) / w) ** 2 + ((yy - h * 0.25) / h * 1.3) ** 2)
    glow = np.clip(1 - r * 2.0, 0, 1)[..., None] ** 2
    dark = x ** 1.7 * 0.55
    out = screen(dark, glow * np.array([1.0, 0.55, 0.85]) * 0.75)
    return Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8))


def city():
    """Lomé de nuit : skyline, palmiers, et la tour de l'Hôtel 2 Février au centre."""
    cw, ch = 1080, 2700
    yy = np.linspace(0, 1, ch)[:, None, None]
    night = np.clip((1 - yy) * np.array([0.02, 0.03, 0.10]) + yy * np.array([0.22, 0.06, 0.20]), 0, 1)
    hor = np.exp(-((yy - 0.80) / 0.08) ** 2) * np.array([0.45, 0.18, 0.12])
    night = np.repeat(night + hor, cw, 1).astype(np.float32)
    dusk = np.clip((1 - yy) * np.array([0.10, 0.10, 0.28]) + yy * np.array([0.85, 0.40, 0.30]), 0, 1)
    dusk = np.repeat(dusk + hor * 1.2, cw, 1).astype(np.float32)
    stars = np.zeros((ch, cw), np.float32)
    idx = rng.integers(0, ch * cw // 2, 900)
    stars.flat[idx] = rng.uniform(0.2, 0.9, 900)
    stars = to_np(Image.fromarray((stars * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))) * 2.5
    night += stars[..., None]

    sil = Image.new("L", (cw, ch), 0)      # masque des bâtiments
    win = np.full((ch, cw), np.inf, np.float32)  # seuil d'allumage de chaque fenêtre
    d = ImageDraw.Draw(sil)
    base = int(ch * 0.86)
    # tour (≈ 36 étages), centrée
    tx0, tx1, ttop = 400, 680, int(ch * 0.30)
    d.rectangle([tx0, ttop, tx1, base], fill=255)
    d.rectangle([tx0 + 40, ttop - 70, tx1 - 40, ttop], fill=255)    # couronne
    d.rectangle([538, ttop - 260, 542, ttop - 70], fill=255)          # antenne
    floors = 36
    fh = (base - ttop) / floors
    for f_ in range(floors):
        for c in range(9):
            x0 = tx0 + 14 + c * 29
            y0 = int(ttop + f_ * fh + 8)
            win[y0:y0 + int(fh * 0.5), x0:x0 + 18] = rng.uniform(0, 1) * 0.9
    # immeubles bas
    x = -20
    while x < cw:
        bw = int(rng.uniform(60, 170))
        bh = int(rng.uniform(90, 330))
        if tx0 - 40 < x + bw / 2 < tx1 + 40:
            bh = int(rng.uniform(60, 160))
        d.rectangle([x, base - bh, x + bw, base], fill=255)
        for yy_ in range(base - bh + 12, base - 20, 26):
            for xx_ in range(x + 8, x + bw - 14, 22):
                if rng.random() < 0.55:
                    win[yy_:yy_ + 11, xx_:xx_ + 9] = rng.uniform(0, 1)
        x += bw + int(rng.uniform(-10, 12))
    d.rectangle([0, base, cw, ch], fill=255)
    # palmiers (côte de Lomé)
    for px, ph in [(90, 520), (210, 430), (880, 560), (990, 440)]:
        top = (px + 25, base - ph)
        pts = [(px - 8, base), (px + 8, base), (top[0] + 4, top[1]), (top[0] - 4, top[1])]
        d.polygon(pts, fill=255)
        for k in range(9):
            ang = -math.pi + k * math.pi / 8
            L = 150
            ex, ey = top[0] + math.cos(ang) * L, top[1] + math.sin(ang) * L * 0.35 + 70 * abs(math.cos(ang))
            mx, my = top[0] + math.cos(ang) * L * 0.5, top[1] - 25
            d.line([top, (mx, my), (ex, ey)], fill=255, width=14, joint="curve")
    S = to_np(sil)[..., None]
    lit = np.isfinite(win)
    # fenêtres : jaune sodium / blanc chaud / quelques néons magenta
    wc = np.zeros((ch, cw, 3), np.float32)
    colors = np.array([[1.0, 0.78, 0.38], [1.0, 0.9, 0.7], [0.95, 0.35, 0.8], [0.4, 0.8, 1.0]], np.float32)
    pick = rng.choice(4, size=(ch, cw), p=[0.55, 0.3, 0.1, 0.05])
    wc[lit] = colors[pick[lit]]
    building = np.array([0.025, 0.02, 0.04], np.float32)
    # arête dorée de la tour
    edge = np.zeros((ch, cw), np.float32)
    edge[ttop:base, tx1 - 6:tx1] = 0.6
    edge[ttop - 70:ttop, tx0 + 40:tx1 - 40][:4] = 0.9
    night_img = night * (1 - S) + building * S + edge[..., None] * np.array([1.0, 0.75, 0.35])
    dusk_img = dusk * (1 - S) + building * 1.5 * S
    glow = to_np(Image.fromarray((np.clip(wc, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(9)))
    windows = {"color": wc, "thr": win, "glow": glow, "beacon": (540, ttop - 262)}
    return night_img.astype(np.float32), dusk_img.astype(np.float32), windows


def city_frame(P, t, cy, zoom, lights=1.0, dusk=0.0, out=(W, H)):
    win = P["windows"]
    on = (win["thr"] < lights)[..., None]
    base = P["city_night"] * (1 - dusk) + P["city_dusk"] * dusk
    img = base + on * win["color"] * 0.95 + win["glow"] * 0.55 * lights
    bx, by = win["beacon"]
    if math.sin(t * 2 * math.pi * 0.7) > 0.3:  # feu d'obstacle rouge
        yy, xx = np.ogrid[by - 40:by + 40, bx - 40:bx + 40]
        g = np.exp(-((xx - bx) ** 2 + (yy - by) ** 2) / 150.0)
        img[by - 40:by + 40, bx - 40:bx + 40] += g[..., None] * np.array([1.0, 0.1, 0.05])
    pil = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8))
    return view(pil, 0.5, cy, zoom, out=out)


def noise_tex(h, w, octaves=5, seed=0):
    r = np.random.default_rng(seed)
    acc = np.zeros((h, w), np.float32)
    amp, tot = 1.0, 0
    for o in range(octaves):
        sh, sw = max(2, h // (2 ** (octaves - o + 1))), max(2, w // (2 ** (octaves - o + 1)))
        n = Image.fromarray((r.random((sh, sw)) * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
        acc += to_np(n) * amp
        tot += amp
        amp *= 0.55
    acc /= tot
    return (acc - acc.min()) / (acc.max() - acc.min())


def smoke_tex():
    n = noise_tex(1200, 900, 6, 3)
    return np.clip((n - 0.35) * 1.8, 0, 1) ** 1.5


def smoke_layer(P, t, strength=0.5, color=(0.9, 0.55, 0.9), speed=1.0):
    S = P["smoke"]
    h, w = S.shape
    oy = int((t * 22 * speed) % (h - 960))
    ox = int((t * 14 * speed) % (w - 540))
    a = S[oy:oy + 960, ox:ox + 540]
    b = S[::-1][(oy // 2):(oy // 2) + 960, (w - 540 - ox):(w - ox)]
    s = np.clip((a + b) * 0.7, 0, 1)
    s = np.repeat(np.repeat(s, 2, 0), 2, 1)[:H, :W]
    return s[..., None] * np.array(color, np.float32) * strength


def dust_tex():
    """Poussière dorée en suspension (texture haute qu'on fait défiler)."""
    h, w = H * 2, W
    im = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(im)
    for _ in range(420):
        x, y, r = rng.uniform(0, w), rng.uniform(0, h), rng.uniform(1, 4.5)
        d.ellipse([x - r, y - r, x + r, y + r], fill=int(rng.uniform(80, 255)))
    a = to_np(im.filter(ImageFilter.GaussianBlur(1.6))) + to_np(im.filter(ImageFilter.GaussianBlur(7))) * 0.8
    return a


def dust_layer(P, t, k=0.6):
    D = P["dust"]
    oy = int((t * 45) % H)
    return D[H - oy:2 * H - oy][..., None] * np.array([1.0, 0.8, 0.45], np.float32) * k


def bokeh_tex():
    w, h = W + 400, H + 400
    im = Image.new("RGB", (w, h), 0)
    d = ImageDraw.Draw(im)
    cols = [(255, 170, 60), (255, 80, 170), (90, 170, 255), (255, 220, 140)]
    for _ in range(70):
        x, y, r = rng.uniform(0, w), rng.uniform(0, h), rng.uniform(18, 70)
        c = cols[rng.integers(0, 4)]
        k = rng.uniform(0.25, 0.7)
        d.ellipse([x - r, y - r, x + r, y + r], fill=tuple(int(v * k) for v in c))
    return to_np(im.filter(ImageFilter.GaussianBlur(5)))


def bokeh_layer(P, t, k=0.5):
    Bk = P["bokeh"]
    ox = int(200 + 150 * math.sin(t * 0.25))
    oy = int(200 + 150 * math.cos(t * 0.21))
    return Bk[oy:oy + H, ox:ox + W] * k


def lasers(t, k=1.0, n=7, origin=(W / 2, -60), hue=None):
    im = Image.new("RGB", (W // 2, H // 2), 0)
    d = ImageDraw.Draw(im)
    ox, oy = origin[0] / 2, origin[1] / 2
    cols = hue or [(80, 230, 255), (255, 60, 200), (120, 255, 140)]
    for i in range(n):
        ang = math.radians(90 + 55 * math.sin(t * 1.3 + i * 0.9) * (1 if i % 2 else -1))
        ex, ey = ox + math.cos(ang) * 2200, oy + math.sin(ang) * 2200
        d.line([(ox, oy), (ex, ey)], fill=cols[i % len(cols)], width=2)
    sharp = to_np(im)
    soft = to_np(im.filter(ImageFilter.GaussianBlur(6)))
    x = sharp + soft * 2.5
    x = np.repeat(np.repeat(x, 2, 0), 2, 1)
    return x * k


def vignette():
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    r = np.sqrt(((xx - W / 2) / (W * 0.62)) ** 2 + ((yy - H / 2) / (H * 0.6)) ** 2)
    return np.clip(1 - (r - 0.55) * 0.9, 0.25, 1)[..., None] ** 1.5


def neon_wash(img, k=0.5):
    """Lumière néon : magenta à gauche, cyan à droite."""
    g = np.linspace(0, 1, W, dtype=np.float32)[None, :, None]
    col = (1 - g) * np.array([1.0, 0.15, 0.7]) + g * np.array([0.1, 0.8, 1.0])
    lum = img.mean(-1, keepdims=True)
    return img * (1 - k * 0.5) + lum * col * k * 1.1 + col * 0.05 * k


def neon_tubes(t, flick=1.0):
    im = Image.new("RGB", (W // 2, H // 2), 0)
    d = ImageDraw.Draw(im)
    d.line([(30, 120), (30, 820)], fill=(255, 40, 190), width=5)
    d.line([(510, 80), (510, 700)], fill=(40, 220, 255), width=5)
    d.line([(60, 60), (300, 60)], fill=(255, 40, 190), width=4)
    sharp, soft = to_np(im), to_np(im.filter(ImageFilter.GaussianBlur(12)))
    x = np.repeat(np.repeat(sharp + soft * 3, 2, 0), 2, 1)
    return x * flick


def flag_bar(kind, w=360, h=220):
    """Drapeaux simplifiés (bandes) pour Togo et Bénin."""
    im = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(im)
    if kind == "togo":
        for i in range(5):
            d.rectangle([0, i * h / 5, w, (i + 1) * h / 5], fill=(0, 106, 78) if i % 2 == 0 else (255, 206, 0))
        d.rectangle([0, 0, h * 3 / 5, h * 3 / 5], fill=(210, 16, 52))
        cx, cy, r = h * 3 / 10, h * 3 / 10, h * 0.2
        pts = [(cx + r * math.cos(math.radians(-90 + k * 36)) * (1 if k % 2 == 0 else 0.4),
                cy + r * math.sin(math.radians(-90 + k * 36)) * (1 if k % 2 == 0 else 0.4)) for k in range(10)]
        d.polygon(pts, fill=(255, 255, 255))
    else:
        d.rectangle([0, 0, w * 0.4, h], fill=(0, 135, 81))
        d.rectangle([w * 0.4, 0, w, h / 2], fill=(252, 209, 22))
        d.rectangle([w * 0.4, h / 2, w, h], fill=(232, 17, 45))
    a = np.ones((h, w, 1), np.float32)
    return np.concatenate([to_np(im), a], -1)


# ====================================================================== plan de montage
def plan(tl):
    """Liste des plans : (début, type, paramètres). Chaque plan dure jusqu'au suivant."""
    S = lambda sid: seg(tl, sid)

    def word_t(sid, prefix, default=None):
        s = S(sid)
        for a, b, w in s["words"]:
            if w.lower().startswith(prefix.lower()):
                return a
        return default if default is not None else s["t0"]

    shots = [(0.0, "hand", {})]
    lui = word_t("s02", "lui")
    shots.append((lui, "photo", dict(img="p1", c0=(0.55, 0.42, 1.25), c1=(0.52, 0.36, 1.45), flash=1)))
    if S("s03"):
        shots.append((snap(tl, S("s03")["t0"] - 0.15), "city", dict(cy0=0.62, cy1=0.55, z0=1.0, z1=1.12)))
    if S("s04"):
        shots.append((snap(tl, S("s04")["t0"] - 0.1), "tower", {}))
        shots.append((snap(tl, word_t("s04", "imposé") - 0.05), "photo",
                      dict(img="p6", c0=(0.5, 0.3, 1.25), c1=(0.5, 0.27, 1.4), punch=1)))
    if S("s05"):
        shots.append((snap(tl, S("s05")["t0"] - 0.15), "zanzibar", {}))
    if S("s06"):
        shots.append((snap(tl, S("s06")["t0"] - 0.15), "nightfall", {}))
        shots.append((snap(tl, word_t("s06", "elle") - 0.05), "photo",
                      dict(img="p1", c0=(0.38, 0.29, 2.3), c1=(0.37, 0.29, 2.6), punch=1, cool=1)))
    if S("s07"):
        shots.append((S("s07")["t0"] - 0.05, "stage", dict(freeze=S("s07")["t1"])))
    if S("s08"):
        shots.append((snap(tl, S("s08")["t0"] - 0.05), "photo",
                      dict(img="p3", c0=(0.4, 0.62, 1.55), c1=(0.33, 0.6, 1.85), punch=1, neon=0.35)))
        t_piste = word_t("s08", "la", None)
        ws = [w for w in S("s08")["words"] if w[2] == "la"]
        t_piste = ws[-1][0] if ws else S("s08")["t0"] + 2
        shots.append((snap(tl, t_piste - 0.05), "crowd", {}))
    if S("s09"):
        shots.append((S("s09")["t0"] - 0.03, "anthem", {}))
    if S("s10"):
        shots.append((snap(tl, S("s10")["t0"] - 0.1), "flags", {}))
    if S("s11"):
        shots.append((snap(tl, S("s11")["t0"] - 0.05), "counter", {}))
    if S("s12"):
        shots.append((snap(tl, S("s12")["t0"] - 0.08), "photo",
                      dict(img="p4", c0=(0.5, 0.45, 1.0), c1=(0.5, 0.42, 1.1), punch=1)))
        shots.append((snap(tl, word_t("s12", "Par", None) if False else [w for w in S("s12")["words"] if w[2] == "Par"][-1][0] - 0.03),
                      "photo", dict(img="p4", c0=(0.47, 0.33, 1.9), c1=(0.47, 0.33, 2.05), punch=1)))
    roles = [("s13a", "DJ", "p1bw", (0.55, 0.4, 1.3)), ("s13b", "VJ", "p5bw", (0.5, 0.4, 1.1)),
             ("s13c", "ANIMATEUR", "p3bw", (0.5, 0.45, 1.2)), ("s13d", "PRODUCTEUR", "p2bw", (0.45, 0.42, 1.25))]
    for sid, word, img, c in roles:
        if S(sid):
            shots.append((S(sid)["t0"] - 0.02, "role", dict(word=word, img=img, c=c)))
    if S("s14"):
        shots.append((snap(tl, S("s14")["t0"] - 0.1), "signature", {}))
    if S("s15"):
        shots.append((snap(tl, S("s15")["t0"] - 0.08), "photo",
                      dict(img="p6", c0=(0.5, 0.42, 1.0), c1=(0.5, 0.38, 1.12), punch=1, neon=0.25)))
    if S("s16a"):
        shots.append((snap(tl, S("s16a")["t0"] - 0.08), "crowd", dict(wide=1)))
        shots.append((S("s16b")["t0"] - 0.02, "est", {}))
        shots.append((S("s16c")["t0"] - 0.02, "anthem", dict(short=1)))
    shots.append((snap(tl, S("s17")["t0"] - 0.1), "king", dict(t_end=S("s17")["t1"])))
    shots.append((S("s18a")["t0"] - 0.05, "dark", {}))
    shots.append((tl["drop"], "drop", {}))
    shots.append((tl["drop"] + (0.9 if tl["length"] <= 15 else 1.15), "card", {}))
    shots.sort(key=lambda s: s[0])
    return shots


# ====================================================================== rendu des plans
def lerp3(a, b, p):
    return tuple(x + (y - x) * p for x, y in zip(a, b))


def render_shot(P, kind, prm, t, lt, dur, tl):
    p = lt / max(dur, 1e-3)
    if kind == "hand":
        # écran noir, puis une lumière balaie la main qui pose le casque
        cy = 0.40 + 0.05 * ease(p)
        img = view(P["p2"], 0.27, cy, 2.35 - 0.2 * p)
        yy, xx = np.ogrid[0:H, 0:W]
        lx = W * (0.2 + 0.6 * ease((t - 0.8) / 4.0))
        spot = np.exp(-(((xx - lx) / 520.0) ** 2 + ((yy - H * 0.47) / 760.0) ** 2)).astype(np.float32)
        k = ease((t - 0.7) / 2.2) * 1.15
        img = img * (spot[..., None] * k) * np.array([1.05, 0.85, 1.0])
        return img + dust_layer(P, t, 0.15 * k)
    if kind == "photo":
        c = lerp3(prm["c0"], prm["c1"], ease(p) * 0.6 + p * 0.4)
        img = view(P[prm["img"]], *c)
        if prm.get("neon"):
            img = neon_wash(img, prm["neon"])
        if prm.get("cool"):
            img = img * np.array([0.85, 0.92, 1.12])
        return img
    if kind == "city":
        img = city_frame(P, t, prm["cy0"] + (prm["cy1"] - prm["cy0"]) * ease(p), prm["z0"] + (prm["z1"] - prm["z0"]) * p)
        return screen(img, bokeh_layer(P, t, 0.35))
    if kind == "tower":
        img = city_frame(P, t, 0.62 - 0.5 * ease(p), 1.15 + 0.9 * ease(p))
        return screen(img, bokeh_layer(P, t, 0.25 * (1 - p)))
    if kind == "zanzibar":
        # entrée au ralenti : il traverse le cadre, néons, fumée
        cx = 0.62 - 0.22 * p
        img = view(P["p2"], cx, 0.42, 1.18 + 0.08 * p)
        img = neon_wash(img, 0.75)
        fl = 1.0 if (lt > 0.25 or int(lt * 30) % 3) else 0.2
        img = screen(img, neon_tubes(t, 0.7 * fl))
        img = screen(img, smoke_layer(P, t, 0.45, (0.8, 0.45, 0.95), 0.6))
        return img
    if kind == "nightfall":
        lights = min(1, max(0, (p - 0.15) * 1.6))
        img = city_frame(P, t, 0.55, 1.05 + 0.1 * p, lights=lights, dusk=1 - ease(p * 1.3))
        return img
    if kind == "stage":
        frozen = t >= prm["freeze"]
        tt = prm["freeze"] if frozen else t
        q = (tt - (t - lt)) / max(dur, 1e-3)
        img = view(P["p5sil"], 0.5, 0.42 - 0.05 * q, 1.0 + 0.12 * q)
        img = screen(img, smoke_layer(P, tt, 0.35, (0.9, 0.5, 0.8), 0.5))
        rays = lasers(tt * 0.3, 0.35, 5, (W * 0.5, H * 0.2), [(255, 200, 140)])
        img = screen(img, rays)
        if frozen:  # silence : l'image se fige et se désature
            g = img.mean(-1, keepdims=True)
            img = g * np.array([0.95, 0.93, 0.9]) * 0.9
        return img
    if kind == "crowd":
        if prm.get("wide"):
            img = view(P["p5"], 0.5, 0.5, 1.0 + 0.1 * p)
        else:
            img = view(P["p5"], 0.42 + 0.06 * p, 0.83, 1.75 + 0.15 * p)
        img = screen(img, lasers(t, 0.8))
        strobe = 0.25 if (int(t / (BEAT / 2)) % 2 == 0) else 0.0
        return img + strobe * 0.25
    if kind == "anthem":
        img = view(P["p5"], 0.5, 0.36, 1.05 + 0.12 * ease(p))
        img = screen(img, lasers(t * 1.4, 1.0, 9))
        img = screen(img, smoke_layer(P, t, 0.3, (0.6, 0.4, 1.0), 1.5))
        return img
    if kind == "flags":
        img = view(P["p4blur"], 0.5, 0.5, 1.2) * 0.25
        img = screen(img, bokeh_layer(P, t, 0.45))
        return img
    if kind == "counter":
        img = view(P["p6blur"], 0.5, 0.45, 1.1 + 0.08 * p) * 0.35
        return screen(img, dust_layer(P, t, 0.5))
    if kind == "role":
        z = prm["c"][2] * (1.12 - 0.12 * out_expo(lt / 0.5))
        return view(P[prm["img"]], prm["c"][0], prm["c"][1], z) * 0.85
    if kind == "signature":
        img = view(P["p2sil"], 0.55 - 0.05 * p, 0.42, 1.08 + 0.1 * p)
        return screen(img, dust_layer(P, t, 0.45))
    if kind == "est":
        img = np.zeros((H, W, 3), np.float32)
        return screen(img, smoke_layer(P, t, 0.35, (1.0, 0.75, 0.4), 2.0))
    if kind == "king":
        darken = 1 - 0.85 * ease((t - prm["t_end"]) / 0.9)
        img = view(P["p1"], 0.42, 0.33, 1.6 + 0.3 * p) * darken
        return screen(img, dust_layer(P, t, 0.35))
    if kind == "dark":
        img = view(P["p1"], 0.42, 0.33, 2.0) * 0.06
        return screen(img, dust_layer(P, t, 0.5))
    if kind == "drop":
        img = view(P["p6"], 0.48, 0.31, 1.95 - 0.25 * out_expo(lt / 0.8))
        return img
    if kind == "card":
        img = view(P["p6"], 0.48, 0.3, 1.7 + 0.04 * lt) * 0.28
        img = screen(img, dust_layer(P, t, 0.55))
        return img
    raise ValueError(kind)


def overlays(P, frame, kind, prm, t, lt, dur, tl):
    S = lambda sid: seg(tl, sid)
    if kind == "city" and S("s03"):
        ws = S("s03")["words"]
        title(frame, "HÔTEL 2 FÉVRIER", 430, t, ws[0][0], None, "Cinzel.ttf", 86, "Black", "gold", 4, 18)
        ak = [w for w in ws if w[2].lower().startswith("ass")]
        if ak:
            title(frame, "ASKÉ NIGHT CLUB", 540, t, ak[0][0], None, "Montserrat.ttf", 52, "Bold", "white", 14, 10,
                  1.1)
    if kind == "tower" and S("s04"):
        ws = [w for w in S("s04")["words"] if w[2].startswith("Lom")]
        if ws:
            title(frame, "LOMÉ", 380, t, ws[0][0], None, "Cinzel.ttf", 120, "Black", "gold", 22, 22)
    if kind == "zanzibar" and S("s05"):
        ws = [w for w in S("s05")["words"] if w[2].lower().startswith("zanz")]
        t_in = ws[0][0] if ws else S("s05")["t0"] + 1.5
        if t >= t_in:
            fl = 1.0 if (t - t_in > 0.35 or int((t - t_in) * 30) % 2) else 0.25
            title(frame, "ZANZIBAR", 470, t, t_in, None, "Anton-Regular.ttf", 190, None, (255, 70, 200), 10, 26, 1.0)
            img = text_img("ZANZIBAR", "Anton-Regular.ttf", 190, None, (255, 230, 250), 10, 0, 0, False)
            h, w = img.shape[:2]
            blit(frame, img, W / 2 - w / 2, 470 - h / 2, 0.55 * fl)
            title(frame, "LOMÉ", 610, t, t_in + 0.25, None, "Montserrat.ttf", 46, "Bold", (90, 220, 255), 26, 10, 1.0)
    if kind == "flags" and S("s10"):
        s = S("s10")
        ws = s["words"]
        t_b = [w for w in ws if w[2].startswith("Bén") or w[2].startswith("Ben")]
        t_b = t_b[0][0] if t_b else s["t0"] + 1
        nums = [w for w in ws if "deux" in w[2].lower()]
        t228 = nums[0][0] if nums else s["t0"] + 1.6
        t229 = nums[-1][0] if len(nums) > 1 else s["t0"] + 2.3
        for kind_, tin, y, num, x in [("togo", s["t0"], 640, "228", W * 0.27), ("benin", t_b, 640, "229", W * 0.73)]:
            if t >= tin:
                fb = flag_bar(kind_)
                a = ease((t - tin) / 0.25)
                sc = 0.8 + 0.2 * out_expo((t - tin) / 0.4)
                fb = scaled(fb, sc * 0.75)
                blit(frame, fb, x - fb.shape[1] / 2, y - fb.shape[0] / 2, a)
                lab = "TOGO" if kind_ == "togo" else "BÉNIN"
                title(frame, lab, y + 130, t, tin, None, "Montserrat.ttf", 44, "ExtraBold", "white", 12, 6, 1.1, x)
        title(frame, "228", 1000, t, t228, None, "Anton-Regular.ttf", 210, None, "gold", 4, 20, 1.3, W * 0.27)
        if t >= t228 + 0.2:
            p = ease((t - t228 - 0.2) / 0.4)
            y = 1000
            x0, x1 = W * 0.44, W * 0.44 + (W * 0.12) * p
            frame[y - 4:y + 4, int(x0):int(x1)] = np.array(GOLD) / 255
        title(frame, "229", 1000, t, t229, None, "Anton-Regular.ttf", 210, None, "gold", 4, 20, 1.3, W * 0.73)
    if kind == "counter" and S("s11"):
        s = S("s11")
        p = out_expo((t - s["t0"]) / (s["t1"] - s["t0"] - 0.2))
        n = int(round(11000 * p / 10) * 10) if p < 1 else 11000
        txt = f"{n:,}".replace(",", " ")
        img = text_img(txt, "Anton-Regular.ttf", 250, None, "gold", 6, 26)
        h, w = img.shape[:2]
        blit(frame, img, W / 2 - w / 2, 760 - h / 2, ease((t - s["t0"] + 0.1) / 0.2))
        title(frame, "ABONNÉS · FIDÈLES", 935, t, s["t0"] + 0.4, None, "Montserrat.ttf", 44, "Bold", "white", 16, 8,
              1.1)
    if kind == "role":
        title(frame, prm["word"], 820, t, t - lt, None, "Anton-Regular.ttf", 260 if len(prm["word"]) < 4 else 170,
              None, "gold", 8, 26, 1.6)
    if kind == "signature" and S("s14"):
        ws = [w for w in S("s14")["words"] if w[2].lower().startswith("signature")]
        if ws and t >= ws[0][0] - 0.3:
            p = out_expo((t - ws[0][0] + 0.3) / 0.9)
            y = 1180
            x0 = W / 2 - 380 * p
            x1 = W / 2 + 380 * p
            frame[y - 3:y + 3, int(x0):int(x1)] = screen(frame[y - 3:y + 3, int(x0):int(x1)], np.array(GOLD) / 255)
    if kind == "est" and S("s16b"):
        title(frame, "EST", 820, t, S("s16b")["t0"], None, "Anton-Regular.ttf", 420, None, "gold", 10, 34, 1.7)
    if kind == "dark" and S("s18a"):
        title(frame, "DJ", 840, t, S("s18a")["t0"], None, "Cinzel.ttf", 150, "Black", "gold", 30, 18, 1.15)
    if kind == "drop":
        title(frame, "DESMUS", 960, t, tl["drop"], None, "Cinzel.ttf", 210, "Black", "gold", 10, 30, 1.8, shine=True)
    if kind == "card":
        t0 = t - lt
        title(frame, "DJ", 640, t, t0, None, "Cinzel.ttf", 130, "Black", "gold", 34, 22, 1.0, shine=True)
        title(frame, "DESMUS", 820, t, t0, None, "Cinzel.ttf", 200, "Black", "gold", 10, 30, 1.0, shine=True)
        if t >= t0 + 0.3:
            p = out_expo((t - t0 - 0.3) / 0.6)
            frame[960:964, int(W / 2 - 300 * p):int(W / 2 + 300 * p)] = np.array(GOLD) / 255
        title(frame, "BOOKING", 1060, t, t0 + 0.35, None, "Montserrat.ttf", 58, "ExtraBold", "white", 22, 8, 1.15)
        title(frame, CFG["booking_phone"], 1160, t, t0 + 0.55, None, "Montserrat.ttf", 64, "Bold", "gold", 4, 10,
              1.1)
        if CFG["booking_handle"]:
            title(frame, CFG["booking_handle"], 1250, t, t0 + 0.7, None, "Montserrat.ttf", 46, "SemiBold", "white", 4, 6,
              1.1)
        title(frame, CFG["booking_place"], 1330 if CFG["booking_handle"] else 1250, t, t0 + 0.85, None, "Montserrat.ttf", 34, "SemiBold",
              (200, 190, 170), 10, 0, 1.1)


# ====================================================================== sous-titres
NO_SUBS = {"s13a", "s13b", "s13c", "s13d", "s16b", "s18a", "s18b"}


def sub_chunks(tl):
    """Découpe en groupes de 2-4 mots, avec l'instant d'apparition de chaque mot affiché."""
    chunks = []
    for s in tl["segments"]:
        if s["id"] in NO_SUBS:
            continue
        shown = s["show"].split()
        bw = s["words"]
        if len(bw) == len(shown):
            times = [(a, b) for a, b, _ in bw]
        else:  # alignement proportionnel aux lettres entre premier et dernier mot prononcé
            a0, a1 = (bw[0][0], bw[-1][1]) if bw else (s["t0"], s["t1"])
            L = [len(w) + 1 for w in shown]
            cs = np.cumsum([0] + L) / sum(L)
            times = [(a0 + (a1 - a0) * cs[i], a0 + (a1 - a0) * cs[i + 1]) for i in range(len(shown))]
        cur = []
        for (a, b), w in zip(times, shown):
            cur.append((a, b, w))
            if len(cur) >= 3 or w[-1] in ".,!?" and len(cur) >= 2 or (len(cur) == 2 and len(w) > 9):
                chunks.append(cur)
                cur = []
        if cur:
            if len(cur) == 1 and chunks and chunks[-1][0][0] >= s["t0"] - 0.01 and len(chunks[-1]) < 4:
                chunks[-1] = chunks[-1] + cur
            else:
                chunks.append(cur)
    out = []
    for i, c in enumerate(chunks):
        end = c[-1][1] + 0.25
        if i + 1 < len(chunks):
            end = min(end, chunks[i + 1][0][0])
        out.append((c[0][0], end, c))
    return out


def draw_subs(frame, chunks, t):
    for c0, c1, words in chunks:
        if not (c0 <= t < c1):
            continue
        size = 72
        items = []
        for a, b, w in words:
            if t < a:
                break
            active = a <= t < b + 0.05 or (w is words[-1][2] and t >= a)
            fill = "gold" if active else "white"
            img = text_img(w.upper(), "Montserrat.ttf", size, "ExtraBold", fill, 1, 0, 4, True)
            pop = 1 + 0.18 * (1 - out_expo((t - a) / 0.18)) if active else 1
            items.append(scaled(img, pop) if pop > 1.01 else img)
        if not items:
            return
        gap = -22
        lines, line, lw = [], [], 0
        for im in items:
            w = im.shape[1]
            if line and lw + w + gap > 960:
                lines.append(line)
                line, lw = [], 0
            line.append(im)
            lw += w + gap
        lines.append(line)
        y = 1400 - (len(lines) - 1) * 46
        for line in lines:
            tot = sum(im.shape[1] for im in line) + gap * (len(line) - 1)
            x = W / 2 - tot / 2
            for im in line:
                blit(frame, im, x, y - im.shape[0] / 2)
                x += im.shape[1] + gap
            y += 92
        return


# ====================================================================== image complète
class Renderer:
    def __init__(self, version):
        ev = json.load(open(os.path.join(B, f"events_{version}.json")))
        self.tl, self.ev = ev["timeline"], ev["events"]
        self.L = self.tl["length"]
        self.shots = plan(self.tl)
        self.chunks = sub_chunks(self.tl)
        self.P = None

    def shot_at(self, t):
        i = max(k for k, s in enumerate(self.shots) if s[0] <= t)
        t0, kind, prm = self.shots[i]
        t1 = self.shots[i + 1][0] if i + 1 < len(self.shots) else self.L
        return i, t0, t1, kind, prm

    def frame(self, t):
        if self.P is None:
            self.P = load_assets()
        P = self.P
        i, t0, t1, kind, prm = self.shot_at(t)
        lt = t - t0
        img = render_shot(P, kind, prm, t, lt, t1 - t0, self.tl)
        # zoom-punch à chaque coupe (style « highlights »)
        punch = 0.0
        if i > 0 and lt < 0.3:
            punch = 0.07 * (1 - out_expo(lt / 0.3)) * (1.6 if kind in ("role", "drop", "est", "anthem") else 1)
        # impacts : flash, tremblement, aberration chromatique
        flash = shake = ca = 0.0
        for ti in self.ev["impacts"]:
            d = t - ti
            if 0 <= d < 0.6:
                k = 1.4 if abs(ti - self.ev["drop"]) < 0.01 else 1.0
                flash = max(flash, (1 - d / 0.22) * 0.85 * k if d < 0.22 else 0)
                shake = max(shake, 26 * k * math.exp(-d * 7))
                ca = max(ca, 12 * k * math.exp(-d * 6))
        for tw in self.ev["whooshes"]:
            d = t - tw
            if -0.12 <= d < 0.18:
                ca = max(ca, 6 * (1 - abs(d) / 0.18))
        # pulsation légère sur les temps quand le groove joue
        pulse = 0.0
        if kind in ("crowd", "anthem", "photo", "counter", "flags"):
            for tb in self.ev["beats"]:
                d = t - tb
                if 0 <= d < 0.2:
                    pulse = 0.06 * (1 - d / 0.2)
        if punch > 0.002:
            pil = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8))
            img = view(pil, 0.5, 0.5, 1 + punch)
        frame = np.clip(img * (1 + pulse), 0, 1.5)
        overlays(P, frame, kind, prm, t, lt, t1 - t0, self.tl)
        draw_subs(frame, self.chunks, t)
        if shake > 0.5:
            r = np.random.default_rng(int(t * 1000))
            dx, dy = (r.uniform(-1, 1, 2) * shake).astype(int)
            frame = np.roll(frame, (dy, dx), (0, 1))
        if ca > 0.5:
            c = int(ca)
            frame[..., 0] = np.roll(frame[..., 0], c, 1)
            frame[..., 2] = np.roll(frame[..., 2], -c, 1)
        frame = frame * P["vignette"]
        if flash > 0:
            frame = frame + flash * np.array([1.0, 0.92, 0.8], np.float32)
        g = P["grain"][int(t * FPS) % len(P["grain"])]
        g = np.repeat(np.repeat(g, 2, 0), 2, 1)[..., None]
        frame = frame + g * 0.028
        # fondu d'ouverture et de fermeture
        if t < 0.4:
            frame *= t / 0.4
        if t > self.L - 0.35:
            frame *= max(0, (self.L - t) / 0.35)
        return (np.clip(frame, 0, 1) * 255).astype(np.uint8)


_R = None


def _work(args):
    version, a, b, path = args
    global _R
    _R = _R or Renderer(version)
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                            "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "17",
                            "-pix_fmt", "yuv420p", path], stdin=subprocess.PIPE)
    for f in range(a, b):
        enc.stdin.write(_R.frame(f / FPS).tobytes())
    enc.stdin.close()
    enc.wait()
    return path


def render(version, workers=4):
    R = Renderer(version)
    n = int(round(R.L * FPS))
    k = 16
    bounds = [(version, n * i // k, n * (i + 1) // k, os.path.join(B, f"part_{version}_{i:02d}.mp4")) for i in range(k)]
    with Pool(workers) as pool:
        parts = list(pool.imap(_work, bounds))
    lst = os.path.join(B, f"parts_{version}.txt")
    open(lst, "w").write("".join(f"file '{p}'\n" for p in parts))
    out = os.path.join(HERE, "..", "out", f"dj-desmus-{version}s.mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst,
                    "-i", os.path.join(B, f"mix_{version}.wav"), "-map", "0:v", "-map", "1:a", "-c:v", "copy",
                    "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", "-shortest", out], check=True)
    for p in parts:
        os.remove(p)
    print("ok", os.path.normpath(out))


if __name__ == "__main__":
    v = sys.argv[1]
    if "--still" in sys.argv:
        R = Renderer(v)
        for ts in sys.argv[sys.argv.index("--still") + 1:]:
            Image.fromarray(R.frame(float(ts))).save(os.path.join(B, f"still_{v}_{ts}.jpg"), quality=88)
            print("still", ts, R.shot_at(float(ts))[3])
    else:
        render(v)
