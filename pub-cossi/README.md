# COSSI AGBOKOU — Community Manager (pub motion design)

**La vidéo : [`out/cossi-agbokou-community-manager.mp4`](../out/cossi-agbokou-community-manager.mp4)**
— 9:16, 1080×1920, 30 s, 30 i/s, H.264 + AAC, son normalisé à −14 LUFS.

100 % motion design, généré par du code : aucune prise de vue, aucun personnage.
Les réseaux sociaux gérés (Facebook, TikTok, Instagram, LinkedIn) apparaissent sous forme d'icônes simplifiées redessinées au canvas.

| Élément | Comment |
|---|---|
| Image | canvas 2D (`pub.js`), chaque image = fonction du temps, rendue dans Chromium sans écran |
| Police | Montserrat (OFL, `fonts/`) |
| Musique | afro-house / amapiano à 115 BPM synthétisée en numpy (kick, log drum, shaker, claps, congas, piano jazzy Fm9–Dbmaj9–Bbm9–C7) |
| Voix off | française, générée localement avec [Chatterbox Multilingual](https://github.com/resemble-ai/chatterbox) (licence MIT) ; timbre de référence : un lecteur LibriVox du domaine public (corpus MLS, locuteur 5526, `voix_ref.wav`) ; chaque phrase est vérifiée par transcription automatique (faster-whisper) |
| Bruitages | whoosh, pops, riser, impact, déclencheur photo, tics du compteur, clic — calés sur l'image |

Palette « Nuit Royale » : `#0B1A33` fond · `#D4A537` or · `#F5F0E6` ivoire · `#C0392B` rouge (notifications, bouton).

## Découpage (calé sur les temps de la musique, 1 temps = 0,52 s)

| Temps | Scène |
|---|---|
| 0 – 3,1 s | **Accroche** : le smartphone rebondit, explosion de notifications en particules dorées (pops en doubles-croches). « Votre marque mérite d'être vue. » |
| 3,1 – 7,3 s | **Le problème** : les icônes grisent et tombent, fil vide, courbe d'engagement plate ; musique étouffée puis riser. « Publier ne suffit plus. » |
| 7,3 – 12 s | **Révélation** (drop) : la courbe plate devient la ligne dorée qui écrit « COSSI AGBOKOU » d'un seul trait, « COMMUNITY MANAGER » se révèle par masque, les motifs textiles s'illuminent. |
| 12 – 20,9 s | **Services** : un badge dont la forme et l'icône se transforment (morphing point à point) : calendrier → appareil photo → lecture/timeline → plume → graphique. |
| 20,9 – 25 s | **La différence** : le graphique devient une bobine, la pellicule se déroule et ses images deviennent un fil de publications. Carte Lomé ⇄ Cotonou. |
| 25 – 30 s | **Appel à l'action** : le fil entre dans le téléphone, compteur d'abonnés, le téléphone devient le monogramme « CA », coordonnées, bouton rouge « Contactez-moi » qui pulse et se fait cliquer. |

## Refaire la vidéo

Prérequis : Node 20+, Playwright (Chromium), Python 3 + numpy, ffmpeg.

```bash
# voix off (Python 3.10+ avec torch CPU, chatterbox-tts, faster-whisper, librosa, soundfile)
python pub-cossi/voix.py            # build/cossi/voix.wav (texte et minutage : voix.json)
python3 pub-cossi/audio.py          # build/cossi/audio.wav
node pub-cossi/render.mjs           # out/cossi-agbokou-community-manager.mp4 (~2 min)
node pub-cossi/render.mjs --stills 1,8.3,10.5,16,23,28.8   # images tests + planche contact
node pub-cossi/render.mjs --serve   # aperçu : http://localhost:8124/index.html?play=1
```

Les textes, couleurs et minutages sont en tête de `pub.js` (`C`, `T`, `SV`) et de `audio.py`.
