#!/usr/bin/env python3
"""Repères de la chanson « Miko Miko Bam » (temps en secondes dans miko/song.mp3).
Écrit miko/timing.json : frappes de mains, coups de pied, sous-titres."""
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = 0.4418            # un temps (136 bpm)
CHORUS = [11.98, 19.05, 34.14, 41.20, 67.70, 74.76, 95.94, 110.04, 117.11]   # début de chaque refrain
BAM = 127.62          # le grand « BAM » final
ENCORE = 134.62       # reprise de la danse après la chute
END = 144.75          # dernier coup

claps, stomps, caps = [], [], []
def chorus(c, cap=True):
    for line, beats in enumerate([(0, 1), (4, 5), (8, 9, 10, 11), (12, 13)]):
        claps.extend(c + b * B for b in beats)
        if line != 2: stomps.append(c + (beats[-1] + 1) * B)
        if cap: caps.append([c + line * 4 * B - 0.1, c + (line + 1) * 4 * B - 0.1, "Miko miko, miko miko," if line == 2 else "Miko miko BAM !"])
for c in CHORUS: chorus(c)
t = ENCORE
while t + 16 * B < END + 0.5: chorus(t, False); t += 16 * B
claps += [29.94, 30.38]            # « Tape, tape dans tes mains »
stomps += [57.10, BAM, END]        # « ça fait bam ! », la chute, la pose finale

def lines(t0, step, texts):
    for i, s in enumerate(texts): caps.append([t0 + i * step, t0 + (i + 1) * step - 0.08, s])
caps += [[0.3, 1.9, "Miko Miko Bam"], [2.0, 6.3, "Coucou ! C'est Malou, le petit éléphant !"], [6.8, 8.4, "Tu danses avec moi ?"], [8.5, 10.4, "Regarde bien !"]]
lines(26.40, 4 * B, ["Voici Malou l'éléphant,", "Il danse, il est content !", "Tape, tape dans tes mains,", "Comme Malou, c'est très bien !"])
lines(48.26, 8 * B, ["Lève ton pied tout là-haut,", "Comme un éléphant bien gros !", "Pose-le fort, ça fait « BAM » !", "Ça réveille l'hippopotame !"])
caps += [[62.4, 64.6, "Oh oh ! Malou veut danser plus vite !"], [64.7, 65.9, "Tu es prêt ?"], [65.95, 67.5, "Un, deux, trois !"]]
lines(81.84, 8 * B, ["Fais ta trompe avec ton bras,", "Balance-la, comme ça !", "Tourne, tourne sur tes pieds,", "Et on va recommencer !"])
caps += [[102.36, 103.7, "Encore plus vite ?"], [103.8, 105.2, "Très, très vite !"], [105.3, 107.5, "Tiens bien tes oreilles…"], [107.6, 109.7, "C'est parti !"],
         [124.3, 127.4, "Miko… miko…"], [BAM, BAM + 2.2, "BAM !"]]
caps.sort()
json.dump({"B": B, "T0": CHORUS[0], "BAM": BAM, "ENCORE": ENCORE, "END": END, "chorus": CHORUS,
           "claps": sorted(round(x, 3) for x in claps), "stomps": sorted(round(x, 3) for x in stomps),
           "caps": [[round(a, 2), round(b, 2), s] for a, b, s in caps]},
          open(os.path.join(ROOT, "miko", "timing.json"), "w"), ensure_ascii=False, indent=0)
print(len(claps), "frappes,", len(stomps), "coups de pied,", len(caps), "sous-titres")
