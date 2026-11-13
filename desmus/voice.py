"""Voix off DJ Desmus : synthèse neuronale phrase par phrase + traitement studio.

Chaque phrase du texte (mot pour mot) est générée séparément pour contrôler
débit, hauteur et intensité : murmure au début, montée, explosion sur le nom.
`tts` = ce que la voix prononce (orthographe phonétique si besoin),
`show` = ce qui s'affiche en sous-titre (texte exact de la voix off).
"""
import asyncio, json, os, ssl, subprocess, sys
import numpy as np
import edge_tts, edge_tts.communicate as C

CA = "/root/.ccr/ca-bundle.crt"
if os.path.exists(CA):
    C._SSL_CTX = ssl.create_default_context(cafile=CA)

VOICE = os.environ.get("DESMUS_VOICE", "fr-FR-RemyMultilingualNeural")
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "build", "voice")
SR = 48000

# id, texte prononcé, texte affiché, débit, hauteur, gain dB (après normalisation)
SEGMENTS = [
    ("s01", "Il y a ceux qui passent de la musique.", "Il y a ceux qui passent de la musique.", "-14%", "-12Hz", -9),
    ("s02", "Et il y a lui.", "Et il y a lui.", "-22%", "-14Hz", -7),
    ("s03", "Hôtel Deux Février. Asské Night Club.", "Hôtel 2 Février. Aské Night Club.", "-12%", "-12Hz", -5),
    ("s04", "C'est là, au sommet de Lomé, qu'il a imposé son nom.", "C'est là, au sommet de Lomé, qu'il a imposé son nom.", "-10%", "-11Hz", -5),
    ("s05", "Aujourd'hui, il règne sur le Zanzibar.", "Aujourd'hui, il règne sur le ZanziBar.", "-12%", "-12Hz", -4),
    ("s06", "Quand la nuit tombe sur la capitale, elle sait déjà qui l'attend.", "Quand la nuit tombe sur la capitale, elle sait déjà qui l'attend.", "-10%", "-11Hz", -4),
    ("s07", "Quand il monte sur scène, les conversations s'arrêtent.", "Quand il monte sur scène, les conversations s'arrêtent.", "-8%", "-10Hz", -3),
    ("s08", "Quand il pose la main sur les platines, la piste n'appartient plus à personne.", "Quand il pose la main sur les platines, la piste n'appartient plus à personne.", "-6%", "-10Hz", -3),
    ("s09", "Elle lui appartient.", "Elle lui appartient.", "-20%", "-12Hz", -1),
    ("s10", "Du Togo au Bénin, du deux-deux-huit au deux-deux-neuf,", "Du Togo au Bénin, du 228 au 229,", "-4%", "-9Hz", -2),
    ("s11", "onze mille personnes le suivent.", "onze mille personnes le suivent.", "-6%", "-10Hz", -2),
    ("s12", "Pas par hasard. Par fidélité.", "Pas par hasard. Par fidélité.", "-12%", "-11Hz", -2),
    ("s13a", "Dee-jay.", "DJ.", "-5%", "-10Hz", 0),
    ("s13b", "Vee-jay.", "VJ.", "-5%", "-10Hz", 0),
    ("s13c", "Animateur.", "Animateur.", "-5%", "-10Hz", 0),
    ("s13d", "Producteur.", "Producteur.", "-5%", "-10Hz", 0),
    ("s14", "Un seul homme. Une seule signature.", "Un seul homme. Une seule signature.", "-12%", "-11Hz", -1),
    ("s15", "On ne l'invite pas pour mettre l'ambiance.", "On ne l'invite pas pour mettre l'ambiance.", "-6%", "-10Hz", -1),
    ("s16a", "On l'invite parce qu'il", "On l'invite parce qu'il", "-6%", "-10Hz", -1),
    ("s16b", "EST", "EST", "-25%", "-8Hz", 3),
    ("s16c", "l'ambiance.", "l'ambiance.", "-14%", "-11Hz", 0),
    ("s17", "Le roi de la nuit a un nom.", "Le roi de la nuit a un nom.", "-12%", "-13Hz", -1),
    ("s18a", "Dee-jay...", "DJ...", "-20%", "-12Hz", 0),
    ("s18b", "DESMUS !", "DESMUS.", "-22%", "-6Hz", 4),
]


async def synth(seg):
    sid, tts, show, rate, pitch, _ = seg
    mp3 = os.path.join(OUT, sid + ".mp3")
    words = []
    if os.path.exists(mp3) and os.path.exists(mp3 + ".json"):
        return
    com = edge_tts.Communicate(tts, VOICE, rate=rate, pitch=pitch, boundary="WordBoundary")
    with open(mp3, "wb") as f:
        async for ch in com.stream():
            if ch["type"] == "audio":
                f.write(ch["data"])
            elif ch["type"] == "WordBoundary":
                words.append([ch["offset"] / 1e7, (ch["offset"] + ch["duration"]) / 1e7, ch["text"]])
    json.dump(words, open(mp3 + ".json", "w"), ensure_ascii=False)


def decode(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()


def studio(path_in, path_out, gain_db):
    """Chaîne « voix de bande-annonce » : grave chaud, compression, présence, légère pièce."""
    af = ",".join([
        "highpass=f=55",
        "equalizer=f=110:t=q:w=1.0:g=4",      # coffre
        "equalizer=f=320:t=q:w=1.2:g=-2.5",   # enlève le carton
        "equalizer=f=3200:t=q:w=1.5:g=2",     # présence
        "deesser=i=0.35",
        "acompressor=threshold=-22dB:ratio=3.5:attack=8:release=120:makeup=4",
        "aecho=0.85:0.5:38|61:0.11|0.07",     # petite pièce, pas de cathédrale
        "loudnorm=I=-16:TP=-1.5:LRA=7",
        f"volume={gain_db}dB",
    ])
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", path_in, "-af", af, "-ar", str(SR), "-ac", "1",
                    path_out], check=True)


async def main():
    os.makedirs(OUT, exist_ok=True)
    for seg in SEGMENTS:
        await synth(seg)
    meta = {}
    for sid, tts, show, rate, pitch, gain in SEGMENTS:
        mp3 = os.path.join(OUT, sid + ".mp3")
        wav = os.path.join(OUT, sid + ".wav")
        studio(mp3, wav, gain)
        a = decode(wav)
        # recadre au premier/dernier échantillon audible
        env = np.abs(a) > 10 ** (-48 / 20)
        idx = np.nonzero(env)[0]
        lead = idx[0] / SR if len(idx) else 0
        a = a[idx[0]: idx[-1] + int(0.06 * SR)] if len(idx) else a
        np.save(os.path.join(OUT, sid + ".npy"), a.astype(np.float32))
        raw_words = json.load(open(mp3 + ".json"))
        off = lead  # le recadrage décale tous les mots d'autant
        words = [[max(0, w0 - off), max(0, w1 - off), t] for w0, w1, t in raw_words]
        meta[sid] = {"dur": len(a) / SR, "tts": tts, "show": show, "words": words}
        print(f"{sid}: {len(a)/SR:5.2f}s  {show}")
    json.dump(meta, open(os.path.join(OUT, "meta.json"), "w"), ensure_ascii=False, indent=1)
    print("total parole:", round(sum(m["dur"] for m in meta.values()), 2))


if __name__ == "__main__":
    asyncio.run(main())
