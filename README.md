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

# Miko Miko Bam 🐘👏

Comptine à gestes pour les 2-6 ans — 2 min 31, 16:9, 1080p, 24 images/s.

**Le clip : [`out/miko-miko-bam.mp4`](out/miko-miko-bam.mp4)**

Malou, le petit éléphant à la salopette jaune, danse dans la savane avec le singe, la girafe
et l'hippopotame : « mi-ko » = on tape dans les mains, « bam » = on tape du pied.
Trois tours de plus en plus rapides, puis un grand BAM où tout le monde tombe par terre.

- `miko/song.mp3` — la chanson (générée à part, seul fichier externe)
- `miko/timing.json` — frappes de mains, coups de pied et sous-titres (écrit par `tools/miko_timing.py`)
- `miko/characters.js` — Malou et l'hippopotame (la girafe et le singe viennent de `film/characters.js`)
- `miko/world.js` — la savane : clairière, baobab, acacias, mare, poussière, confettis
- `miko/film.js` — les plans, calés sur la chanson
- `tools/miko_audio.sh` — bande-son en 3 tours (vitesse ×0,88, ×1, ×1,15, sans changer la hauteur des voix)

```bash
npm install
python3 tools/miko_timing.py     # miko/timing.json
tools/miko_audio.sh              # build/miko_audio.wav
node tools/render.mjs --film miko                              # out/miko-miko-bam.mp4
node tools/render.mjs --film miko --song 1 --stills 14,57.2,128  # images tests (temps de la chanson)
```
