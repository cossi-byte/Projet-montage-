# DJ DESMUS — Le roi de la nuit

Film hommage vertical 9:16, 1080×1920, 30 i/s. Trois versions :

| Version | Fichier | Usage |
|---|---|---|
| 60 s | [`out/dj-desmus-60s.mp4`](../out/dj-desmus-60s.mp4) | Reels / TikTok / YouTube Shorts |
| 30 s | [`out/dj-desmus-30s.mp4`](../out/dj-desmus-30s.mp4) | Statut WhatsApp (max 30 s ≈ 1 statut) |
| 15 s | [`out/dj-desmus-15s.mp4`](../out/dj-desmus-15s.mp4) | Statut WhatsApp court / teaser |

Les 30 s et 15 s **coupent dans la voix off sans la réécrire** : on garde seulement certaines phrases, dans l'ordre.

> Cette version est une **maquette finie montée avec les 6 photos du shooting**.
> Les plans « ville de nuit », « tour du 2 Février », néons, fumée et lasers sont des
> décors générés. Avec les rushs vidéo listés plus bas, on remplace plan par plan
> sans toucher au rythme : les timecodes restent identiques.

---

## Voix off

Texte utilisé mot pour mot. Voix masculine grave, lente, synthèse neuronale, traitée comme une voix studio
(grave chaud, compression, présence, petite pièce). Chaque phrase est générée séparément pour suivre la direction :
murmure au début (−9 dB, débit −14 %), montée progressive, appui fort sur **EST** (prise séparée,
+3 dB, 120 ms de suspension avant) et explosion sur **DESMUS** (+4 dB, écho de bande-annonce).
Chaque `[pause]` = 1,00 s de silence exact.

Prononciation vérifiée par transcription automatique du mix final (la voix reste intelligible sur la musique).
« DJ » et « VJ » sont prononcés à l'anglaise (« dee-jay »), comme en club à Lomé.

> **Limite** : il n'existe pas aujourd'hui de voix de synthèse neuronale avec accent d'Afrique de l'Ouest dans
> le moteur utilisé ; la voix est en français standard. Pour l'accent exact, enregistrer un comédien sur la
> piste `build/voix_60.wav` (même calage) et relancer `audio.py` : tout le montage suit.

## Montage 60 s — timecodes, image, son

| TC | Voix off | Image | Son |
|---|---|---|---|
| 0:00 – 0:05 | *(0:02,6)* « Il y a ceux qui passent de la musique. » *(murmure)* | Écran noir. Une lumière balaie lentement une main qui pose un casque. Poussière dorée. | Basses sourdes en battement de cœur, crépitement vinyle, nappe filtrée |
| 0:04,5 | [pause 1 s] | Noir | Silence musical, basses seules |
| 0:05,5 | « Et il y a lui. » | **Coupe sur « lui »** : flash, son portrait casque rose, push-in | Impact + sub-boom |
| 0:06,9 | « Hôtel 2 Février. Aské Night Club. » | Lomé de nuit, la tour du 2 Février illuminée, bokeh. Titres or « HÔTEL 2 FÉVRIER » puis « ASKÉ NIGHT CLUB » | Whoosh, accords rhodes, shaker |
| 0:10,6 | « C'est là, au sommet de Lomé, qu'il a imposé son nom. » | Tilt-up le long de la tour jusqu'au sommet, titre « LOMÉ ». **Coupe sur « imposé »** : il ajuste ses lunettes | Montée |
| 0:14,4 | « Aujourd'hui, il règne sur le ZanziBar. » | Entrée en cabine au ralenti : profil qui traverse le cadre, néons magenta/cyan, fumée. Enseigne néon « ZANZIBAR » qui s'allume en clignotant | Log drums amapiano entrent, braam |
| 0:17,6 | « Quand la nuit tombe sur la capitale, elle sait déjà qui l'attend. » | Le ciel de Lomé passe du crépuscule à la nuit, les fenêtres s'allument une à une. **Coupe sur « elle »** : très gros plan lunettes | Groove filtré |
| 0:21,5 | « Quand il monte sur scène, les conversations s'arrêtent. » | Contre-plongée, silhouette à contre-jour, rayons et fumée. Sur « s'arrêtent » : **image figée + désaturée** | Impact, puis **toute la musique coupe net** |
| 0:24,9 | « Quand il pose la main sur les platines, la piste n'appartient plus à personne. » | Les mains (néon). **Coupe sur « la piste »** : foule, lasers, stroboscope | Le groove repart plein + scratch vinyle sur « platines » |
| 0:29,3 | « Elle lui appartient. » | Plan large sur scène, bras levés, lasers, flash | Crash + clameur de foule |
| 0:31,1 | « Du Togo au Bénin, du 228 au 229, » | Drapeaux Togo puis Bénin, « 228 — 229 » en or | Groove |
| 0:34,3 | « onze mille personnes le suivent. » | Compteur doré qui monte jusqu'à **11 000** | Groove |
| 0:36,3 | « Pas par hasard. Par fidélité. » | Son sourire, casque aux dents. **Punch-in sur « Par fidélité »** | Groove |
| 0:39,4 | « DJ. VJ. Animateur. Producteur. » | 4 plans noir & blanc très courts, **une coupe par mot**, chaque mot en or plein cadre | 4 impacts secs, groove coupé |
| 0:43,5 | « Un seul homme. Une seule signature. » | Silhouette à contre-jour doré, un trait d'or se dessine sur « signature » | Nappe + rhodes |
| 0:46,7 | « On ne l'invite pas pour mettre l'ambiance. » | Portrait face, lumière néon | Le groove repart |
| 0:49,1 | « On l'invite parce qu'il **EST** l'ambiance. » | Scène + lasers → sur **EST** : flash, « EST » géant doré, shake → retour foule | **Silence total + impact sur EST**, puis groove |
| 0:52,9 | « Le roi de la nuit a un nom. » | Profil, push-in lent, l'image s'éteint | Riser qui monte, tout se filtre |
| 0:54,5 | [pause 1 s] | Presque noir, poussière d'or | Riser seul |
| 0:55,5 | « DJ… » | « DJ » en or sur noir | Cymbale inversée, puis 0,5 s de vide |
| **0:56,9** | « **DESMUS.** » | **DROP** : son visage plein cadre, flash, shake, « DESMUS » géant doré | Drop amapiano plein, impact, braam, crash, écho sur le nom |
| 0:58,1 – 1:00 | — | Carton final : **DJ DESMUS** en lettres dorées + BOOKING + contact | Le groove joue à fond jusqu'à la fin |

Toutes les coupes « de fin de phrase » sont calées sur la grille musicale (croche à 112 BPM), et la grille est
calée pour qu'une mesure démarre pile sur « DESMUS ».

## Version 30 s (statut WhatsApp)

« Il y a ceux qui passent de la musique. [pause] Et il y a lui. / Hôtel 2 Février. Aské Night Club. /
Aujourd'hui, il règne sur le ZanziBar. / Quand il pose la main sur les platines, la piste n'appartient plus à
personne. / Elle lui appartient. / DJ. VJ. Animateur. Producteur. / Le roi de la nuit a un nom. [pause] DJ… DESMUS. »
Drop à 0:26,9, carton final jusqu'à 0:30.

## Version 15 s

« Il y a ceux qui passent de la musique. [pause] Et il y a lui. / On l'invite parce qu'il EST l'ambiance. /
Le roi de la nuit a un nom. [pause] DJ… DESMUS. » Drop à 0:12,8, carton final jusqu'à 0:15.

---

## Liste des rushs à tourner (pour la version définitive)

Tourner en **4K vertical (9:16) ou 4K horizontal recadrable**, 50/60 i/s (pour les ralentis), profil log si
possible, objectifs lumineux (f/1.8 – 2.8). Lumière club : néons magenta/cyan + une source chaude dorée en contre.

| # | Plan | Remplace (TC) | Détail |
|---|---|---|---|
| 1 | **Main qui pose un casque** sur les platines, insert macro | 0:00 – 0:05 | Fond noir, une seule lumière rasante qui balaie. 3 prises, ralenti 50 %. |
| 2 | **Lomé de nuit**, vue générale avec la tour de l'Hôtel 2 Février | 0:06,9 | Depuis un toit ou au drone (autorisation !). Plan fixe 10 s + léger travelling. |
| 3 | **Tour du 2 Février**, tilt-up de la base au sommet | 0:10,6 | Contre-plongée, 8 s, mouvement lent et régulier. |
| 4 | **Façade / enseigne de l'Aské** ou de l'hôtel de nuit | 0:08 (option) | 3 s, néons si possible. |
| 5 | **Entrée en cabine au ZanziBar, au ralenti** | 0:14,4 | Il entre dans la cabine, de profil ou de dos, néons + machine à fumée. 60 i/s. |
| 6 | **Enseigne / logo ZanziBar** allumé | 0:16 | Gros plan, 3 s. Si possible, l'enseigne qui s'allume. |
| 7 | **Timelapse crépuscule → nuit** sur Lomé | 0:17,6 | 20 min de tournage → 3 s. Les lumières de la ville s'allument. |
| 8 | **Gros plan yeux / lunettes** | 0:19,5 | Il tourne lentement la tête vers l'objectif. |
| 9 | **Montée sur scène en contre-plongée, silhouette à contre-jour** | 0:21,5 | Caméra au sol, projecteur ou laser derrière lui, fumée. 5 s. |
| 10 | **Mains sur les platines** (jog, fader, effet) | 0:24,9 | Inserts serrés, 3-4 gestes différents, ralenti. |
| 11 | **Foule en transe, mains levées** | 0:27 – 0:30,6 | Depuis la cabine vers la piste + depuis la piste vers lui. Lasers. Plusieurs nuits pour avoir une salle pleine. |
| 12 | **Plan large : lui + foule** dans le même cadre | 0:29,3 | Depuis le fond de salle, en hauteur. |
| 13 | **Écran de téléphone : son compte** (11 000 abonnés) | 0:34,3 | Option, ou screen-record propre. |
| 14 | **Prestations au Bénin** (229) | 0:31,1 | Tout rush existant d'une soirée à Cotonou. |
| 15 | **4 plans « métiers »** : DJ (platines), VJ (écrans/visuels), Animateur (micro, foule), Producteur (studio, DAW, casque) | 0:39,4 | 1-2 s chacun, même cadrage serré, lumière contrastée. |
| 16 | **Silhouette de profil à contre-jour doré** | 0:43,5 | Fond lumineux, lui en ombre chinoise. |
| 17 | **Micro en main qui fait réagir la salle** | 0:46,7 – 0:52 | Le moment où toute la salle crie. |
| 18 | **Profil, lumière qui s'éteint progressivement** | 0:52,9 | Plan fixe, on baisse la lumière en direct. |
| 19 | **Visage plein cadre, regard caméra**, lunettes | 0:56,9 (DROP) | Le plan le plus important. Il retire ou ajuste ses lunettes sur le temps. 60 i/s. |
| 20 | **Plan final** : lui en cabine, de face, foule floue derrière | 0:58 – 1:00 | Fond pour le carton BOOKING. |
| + | **Son d'ambiance de foule** réel au ZanziBar | partout | 2 min de clameur, sans musique si possible. |

---

## Refaire / modifier

Prérequis : Python 3 avec `numpy`, `pillow`, `edge-tts` ; `ffmpeg`.

```bash
cd desmus
# 1. contact du carton final
$EDITOR config.json            # booking_phone, booking_handle, booking_place
# 2. voix (mise en cache dans build/voice)
python3 voice.py
# 3. bande-son + événements (60, 30, 15)
python3 audio.py
# 4. image + mixage final -> ../out/dj-desmus-<v>s.mp4
python3 render.py 60 && python3 render.py 30 && python3 render.py 15
# image de contrôle à un instant donné
python3 render.py 60 --still 56.9
```

- `voice.py` — texte de la voix off, débit/hauteur/intensité phrase par phrase, chaîne de traitement studio
- `timeline.py` — placement des phrases et des [pause], phrases gardées pour 30 s / 15 s
- `audio.py` — musique amapiano (log drums, rhodes, shaker, kick, clap), design sonore bande-annonce, ducking sous la voix
- `render.py` — plans, étalonnage, effets (flash, zoom-punch, shake, aberration chromatique, grain), titres et sous-titres
- `assets/` — les 6 photos du shooting ; `fonts/` — Anton, Cinzel, Montserrat, Bebas Neue (licence OFL)

Musique et effets sonores entièrement synthétisés : aucun droit d'auteur à gérer sur TikTok / Instagram.
