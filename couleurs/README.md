# La chanson des couleurs 🎨

Comptine vidéo pour les 2-6 ans — 3 minutes, 16:9, 1080p, 24 images/s, 110 BPM.

**Le film : [`../out/la-chanson-des-couleurs.mp4`](../out/la-chanson-des-couleurs.mp4)**

Quatre enfants (toujours les mêmes, mêmes tenues) chantent et dansent dans la cour de
l'école et dans la salle de classe. Aucun animal, aucune mascotte. Comme pour *Koko*, tout
est généré par du code : image en three.js, chœur et instruments synthétisés.

## Déroulé

| Temps | Séquence |
|---|---|
| 0:00 – 0:15 | **Intro** : les enfants arrivent en dansant, le titre apparaît, « Un, deux, trois, quatre ! » |
| 0:15 – 2:31 | **Six couplets** (15 s) : rouge, bleu, jaune, vert, orange, violet — séparés par **cinq refrains** (9 s) |
| 2:31 – 3:00 | **Final** : arc-en-ciel, récapitulatif chanté deux fois, confettis, les enfants saluent |

> 6 couplets de 20 s + 5 refrains de 10 s feraient 2 min 50 : cela ne tient pas entre 0:15 et 2:30.
> À 110 BPM, les couplets durent donc 7 mesures (15,3 s) et les refrains 4 mesures (8,7 s).

Chaque couplet suit le même schéma, pour que les petits anticipent :

1. un enfant montre l'objet, l'écran se teinte, le nom s'affiche en grosses lettres ;
2. gros plan sur l'objet en action (le ballon rebondit, le cerf-volant vole, on dessine un pré…) ;
3. les trois amis montrent chacun autre chose de la même couleur (« Montre-moi du rouge ! ») ;
4. tout le monde saute en criant la couleur, puis trois claquements de mains.

| Couleur | Objet | Lieu |
|---|---|---|
| rouge | ballon | cour |
| bleu | cerf-volant | cour |
| jaune | banane | classe |
| vert | crayon | classe |
| orange | orange | cour |
| violet | fleur | cour |

Les tenues des enfants sont roses, turquoise, blanches et beiges : aucune des six couleurs
enseignées, pour ne pas brouiller le message. Les plans s'enchaînent par fondus, jamais de coupe sèche.

## Paroles

**Refrain** — *Tape, tape dans tes mains ! (clap clap) / Les couleurs, c'est trop bien ! /
Tape, tape avec moi ! / Les couleurs, quelle joie !*

- **Rouge, rouge, rouge**, mon ballon est rouge ! Il saute, il bouge, mon joli ballon rouge !
- **Bleu, bleu, bleu**, mon cerf-volant est bleu ! Il vole dans les cieux, tout là-haut, c'est merveilleux !
- **Jaune, jaune, jaune**, ma banane est jaune ! Comme le soleil, elle brille, c'est une merveille !
- **Vert, vert, vert**, mon crayon est vert ! Je dessine un pré, tout est vert, c'est l'été !
- **Orange, orange, orange**, mon fruit est une orange ! Je l'épluche, je la mange, miam, miam, la bonne orange !
- **Violet, violet, violet**, ma fleur est violette ! Elle sent bon, la coquette, dans mon bouquet violet !

Chaque couplet se termine par : *Montre-moi du rouge ! — Oui, c'est le rouge ! — ROUGE !*

**Final** — *Rouge, bleu, jaune, vert, orange, violet ! Toutes les couleurs font un arc-en-ciel !* (bis)
*Bravo, les amis ! La chanson est finie ! Au revoir !*

## Fichiers

- `song.json` — la partition : structure, accords, mélodie et paroles (une note par syllabe)
- `film/kids.js` — les quatre enfants et les objets
- `film/world.js` — la cour, la classe, l'arc-en-ciel, les confettis
- `film/film.js` — les plans, la caméra, les fondus, le lettrage
- `tools/build_audio.py` — chœur + xylophone, ukulélé, claquements de mains

Le chœur : les paroles sont dites par la synthèse vocale Piper, puis chaque syllabe est recalée
sur sa note avec le vocodeur WORLD (hauteur imposée, timbre remonté vers une voix d'enfant) ;
quatre voix forment le chœur. Pour chaque groupe de mots, plusieurs prises sont générées et
une reconnaissance vocale (Whisper) garde la plus intelligible.

## Refaire le film

Prérequis de *Koko* (voir le README à la racine), plus :

```bash
pip install pyworld scipy faster-whisper
npm install
npm run couleurs:audio    # build/couleurs/audio.wav + couleurs/film/audio.json
npm run couleurs:render   # out/la-chanson-des-couleurs.mp4
```

Aperçu en direct (sans le son) : `npm run couleurs:preview`, puis
`http://localhost:8123/couleurs/film/index.html?play=1&w=960`.
