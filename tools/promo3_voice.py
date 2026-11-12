#!/usr/bin/env python3
"""Voix off du film promo v3 : Chatterbox multilingue, chaque phrase vérifiée par transcription.

À lancer dans un environnement Python 3.11 où sont installés chatterbox-tts et faster-whisper.
Écrit promo/out/vo3/<id>.wav et un rapport rapport.txt.
"""
import difflib
import re
import sys
import unicodedata
from pathlib import Path

import torch
import torchaudio as ta
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
from faster_whisper import WhisperModel

import os

# PROMO_VOICE_DIR : dossier de sortie ; PROMO_VOICE_REF : extrait de 10 s qui donne le timbre ;
# PROMO_VOICE_ENERGY : vivacité de la diction (0.5 = neutre)
OUT = Path(__file__).resolve().parent.parent / "promo" / "out" / os.environ.get("PROMO_VOICE_DIR", "vo3")
REF = os.environ.get("PROMO_VOICE_REF") or None
ENERGY = float(os.environ.get("PROMO_VOICE_ENERGY", "0.5"))
# (identifiant, texte dit) — orthographe adaptée à la prononciation
LINES = [
    ("s01", "Quarante épisodes de série, une vingtaine de sitcoms, deux longs-métrages : un même nom au générique."),
    ("s02", "Cossi Agbokou, scénariste, réalisateur et assistant de production à Cotonou. Voici ce qu'il faut savoir."),
    ("s03", "Diplômé de l'Isma, en réalisation cinéma et télévision, il commence par l'écriture."),
    ("s04", "Kossi signe quarante épisodes de la série La Calebasse du Destin, et une vingtaine de sitcoms pour Novo Image Bénin."),
    ("s05", "Kossi écrit aussi les longs-métrages Prémonition et Karma, et le documentaire Les dix mille cascades de Palimé."),
    ("s06", "Mais Kossi Agbokou ne reste pas derrière son clavier."),
    ("s07", "Sur le plateau, Kossi réalise Karma, Prémonition, Sola, Mon Patron et Afi, avec des tournages en caméra Red Wicca."),
    ("s08", "Côté production, il a dirigé quatre sitcoms, ainsi que les émissions Global Africa, pour la chaîne Télé Sud."),
    ("s09", "Chez Chama Production, au Togo, il est assistant de production sur trois films de cinéma d'auteur."),
    ("s10", "Son atout : il connaît le scénario de l'intérieur."),
    ("s11", "Il sait repérer les scènes qui coûtent cher, et organiser un tournage par séquences."),
    ("s12", "Aujourd'hui, Kossi travaille avec neuf structures, dans quatre pays : le Bénin, le Togo, le Cameroun et la France."),
    ("s13", "Donc, si vous êtes producteur, diffuseur ou réalisateur, et que vous préparez une série, un film ou une émission,"),
    ("s14", "Cossi Agbokou est disponible à Cotonou. Ses contacts sont à l'écran."),
]


NUMBERS = {"40": "quarante", "20": "vingt", "2": "deux", "3": "trois", "4": "quatre", "8": "huit", "9": "neuf",
           "10": "dix", "000": "mille", "8k": "huit k"}


def norm(s):
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    words = re.sub(r"[^a-z0-9 ]+", " ", s).split()
    return " ".join(NUMBERS.get(w, w) for w in words).split()


def check(asr, path, text):
    """Transcrit, note la ressemblance et renvoie l'instant où finit le dernier mot attendu."""
    segs, _ = asr.transcribe(str(path), language="fr", word_timestamps=True)
    words = [w for s in segs for w in s.words]
    heard, owner = [], []
    for i, w in enumerate(words):
        for tok in norm(w.word):
            heard.append(tok)
            owner.append(i)
    target = norm(text)
    blocks = [b for b in difflib.SequenceMatcher(None, target, heard, autojunk=False).get_matching_blocks() if b.size]
    if not blocks:
        return 0.0, None, ""
    last = blocks[-1]
    # les derniers mots attendus peuvent être mal transcrits (noms propres) : on les garde quand même
    missing = len(target) - (last.a + last.size)
    end_tok = min(len(heard) - 1, last.b + last.size - 1 + missing)
    kept = heard[:end_tok + 1]
    score = difflib.SequenceMatcher(None, target, kept, autojunk=False).ratio()
    if missing > 3:  # la fin de la phrase manque vraiment
        score -= 0.25
    return score, words[owner[end_tok]].end, " ".join(w.word.strip() for w in words)


def main():
    only = set(sys.argv[1:])
    torch.set_num_threads(4)
    tts = ChatterboxMultilingualTTS.from_pretrained(device="cpu")
    asr = WhisperModel("small", device="cpu", compute_type="int8")
    OUT.mkdir(parents=True, exist_ok=True)
    report = open(OUT / "rapport.txt", "a")
    for cid, text in LINES:
        if only and cid not in only:
            continue
        if not only and (OUT / f"{cid}.wav").exists():
            continue
        best = (-1, None, "")
        for take in range(4):
            torch.manual_seed(100 + take * 7 + int(cid[1:]))
            wav = tts.generate(text, language_id="fr", audio_prompt_path=REF, exaggeration=ENERGY, cfg_weight=0.5,
                               temperature=0.7)
            tmp = OUT / f"{cid}.take{take}.wav"
            ta.save(str(tmp), wav, tts.sr)
            score, cut, heard = check(asr, tmp, text)
            if cut is not None:
                wav = wav[..., : int((cut + 0.12) * tts.sr)]
                ta.save(str(tmp), wav, tts.sr)
            dur = wav.shape[-1] / tts.sr
            line = f"{cid} prise {take} score {score:.2f} durée {dur:.1f}s | {heard}"
            print(line, flush=True)
            report.write(line + "\n")
            report.flush()
            if score > best[0]:
                best = (score, tmp, heard)
            if score >= 0.80:
                break
        best[1].rename(OUT / f"{cid}.wav")
        for f in OUT.glob(f"{cid}.take*.wav"):
            f.unlink()
        report.write(f"{cid} RETENU score {best[0]:.2f}\n")
        report.flush()
    print("terminé", flush=True)


if __name__ == "__main__":
    main()
