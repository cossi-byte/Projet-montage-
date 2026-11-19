# Balou l'éléphant 🐘 — LOT 1

Chaîne YouTube de dessins animés pour les 2-6 ans. Les scénarios sont dans [`../balou-lot1/`](../balou-lot1/).

Les épisodes sont **rendus entièrement par du code**, comme « Koko et le petit œuf », sans service payant :

| Élément | Comment |
|---|---|
| Image | three.js (WebGL) dans Chromium sans écran, 1080p, 24 images/s |
| Voix | synthèse vocale Piper en français, transposée vers l'aigu (Balou, Pico, enfants) |
| Chanson | paroles scandées en rythme par un chœur de voix de synthèse, mélodie jouée par les instruments |
| Musique et bruitages | synthétisés en Python/numpy (ukulélé, marimba, trompette jouet « pouêt »…) |

## Fichiers

- `lib/characters.js` — Balou, Maman Éléphant, Pico, Zazou, Monsieur Hippo
- `lib/world.js` — la Vallée des Baobabs (maison-baobab, jardin, lac, village, arc-en-ciel) et les effets
- `epXX/story.json` — répliques minutées, chœurs, sections musicales, bruitages
- `epXX/film.js` — la mise en scène plan par plan
- `tools/build_audio.py`, `tools/render.mjs` — bande-son et rendu

## Fabriquer un épisode

Prérequis : voir le README à la racine (Node, Python + numpy + piper-tts, ffmpeg, voix Piper dans `voices/`).

```bash
npm install
python3 balou/tools/build_audio.py 01        # build/balou-ep01/audio.wav + balou/ep01/lipsync.json
node balou/tools/render.mjs --ep 01          # out/balou-ep01.mp4
node balou/tools/render.mjs --ep 01 --stills 20,85,150   # images tests
```
