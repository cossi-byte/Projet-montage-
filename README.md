# Koko et le petit œuf 🐘🥚

Film d'animation 3D pour les 3-6 ans — 3 minutes, 16:9, 1080p, 24 images/s.

**Le film : [`out/koko-et-le-petit-oeuf.mp4`](out/koko-et-le-petit-oeuf.mp4)**

Tout est généré par du code, sans aucun fichier externe (ni modèle 3D, ni musique, ni image) :

| Élément | Comment |
|---|---|
| Image | three.js (WebGL), rendue image par image dans Chromium sans écran |
| Voix | synthèse vocale [Piper](https://github.com/rhasspy/piper) en français, transposée vers l'aigu |
| Musique | synthétisée en Python/numpy (marimba, ukulélé, basse, percussions, 120 bpm) |
| Bruitages | synthétisés (boing, pop, sifflets, splash, rires, « piou piou ») |

## L'histoire

1. **Accroche (0-6 s)** — un œuf tombe du ciel et rebondit (boing !) sur la tête de Koko.
2. **Aventure** — Koko cherche la maman de l'œuf. Trois rencontres sur le même modèle
   (« Bonjour ! C'est ton œuf ? — Non… mais je vais t'aider ! ») :
   - le **singe** et le gros tronc (Koko rebondit dessus, le singe lui lance une liane) ;
   - la **tortue** et la rivière (Koko glisse, l'œuf atterrit sur un « rocher »… qui est la tortue) ;
   - la **girafe** et l'arbre géant (la pyramide d'amis s'écroule, la girafe fait l'ascenseur).
3. **Fin heureuse** — l'œuf éclot dans le nid, la maman oiseau arrive, câlin, et tout le monde danse.

Le refrain revient trois fois :
> *Petit œuf, petit œuf, où est ta maman ?  
> Tous ensemble, on la cherche en chantant !*

L'entraide n'est jamais expliquée : chaque animal aide, puis rejoint le groupe.

## Fichiers

- `story.json` — dialogues minutés, voix, bruitages
- `film/characters.js` — Koko, le singe, la tortue, la girafe, les oiseaux, l'œuf
- `film/world.js` — la jungle, la rivière, les fleurs lumineuses, les effets
- `film/film.js` — les 43 plans (caméra, gestes, émotions)
- `tools/build_audio.py` — bande-son + synchro des bouches
- `tools/render.mjs` — rendu et assemblage

## Refaire le film

Prérequis : Node 20+, Python 3 avec `numpy` et `piper-tts`, `ffmpeg`, Playwright (Chromium).

```bash
npm install
# voix françaises Piper (≈ 200 Mo, non versionnées)
mkdir -p voices && cd voices
for v in siwis/medium/fr_FR-siwis-medium tom/medium/fr_FR-tom-medium upmc/medium/fr_FR-upmc-medium; do
  for e in onnx onnx.json; do
    curl -LO "https://huggingface.co/rhasspy/piper-voices/resolve/main/fr/fr_FR/$v.$e"
  done
done; cd ..

npm run audio      # build/audio.wav + film/lipsync.json
npm run render     # out/koko-et-le-petit-oeuf.mp4
```

Aperçu en direct (sans le son) : `npm run preview`, puis ouvrir
`http://localhost:8123/film/index.html?play=1&w=960`.

Images tests : `node tools/render.mjs --stills 3,25.5,128.5`.

---

## Studio audiovisuel (`studio/`)

Système de transfert de vidéos jusqu'à 64 Go (par morceaux, reprise, SHA-256), d'analyse
automatique (plans, transcription, vignettes, rapport, EDL), de montage assisté et d'outils
commerciaux. Voir [`studio/README.md`](studio/README.md) et [`studio/docs/`](studio/docs/).
