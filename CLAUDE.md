# Instructions pour Claude — studio audiovisuel

Ce dépôt contient le film *Koko et le petit œuf* (racine) et le système **Studio** (`studio/`) :
transfert de vidéos jusqu'à 64 Go, analyse, montage assisté, outils commerciaux. Répondre en français.

## Règles absolues
- **Ne jamais supprimer, déplacer ni modifier un original** (`library/originals/`, rushes, cartes SD).
  Toute sortie va dans `library/projects/<id>/` ou `library/exports/` (jamais d'écrasement).
- Ne jamais envoyer, publier ou partager un fichier, un e-mail ou un message sans accord explicite.
- Aucune dépense, abonnement, génération payante (crédits CapCut/Canva/Adobe) sans accord explicite.
- Ne jamais écrire de jeton ou de mot de passe dans le dépôt (`studio/deploy/.env` est ignoré par git).
- Ne jamais prétendre avoir « vu » une vidéo entière : préciser ce qui a été traité (voir « Couverture
  de l'analyse » dans `rapport.md`).

## Confidentialité : ce dépôt GitHub est PUBLIC
- Ne jamais committer `library/` (vidéos, transcriptions, vignettes, rapports de clients) ni `studio/business/data/`
  (déjà dans `.gitignore` : ne pas forcer avec `git add -f`).
- Remettre les rapports à l'utilisateur en privé : fichier dans la session, ou page Artifact (privée par défaut).

## Préparer une nouvelle session (outils non préinstallés)
`pip install -q -r studio/requirements.txt` (1 à 2 min ; FFmpeg est déjà présent). Le modèle Whisper se
télécharge à la première transcription.

## Récupérer une vidéo envoyée par le téléphone (solution gratuite)
L'utilisateur fabrique un proxy sur son téléphone (`studio/client/preparer_proxy.sh`), le dépose sur Google
Drive et donne le lien de partage :
`python3 studio/pipeline/recuperer.py "LIEN_DRIVE" --json "LIEN_DU_.proxy.json" --analyser`
Lui rappeler ensuite de retirer le partage du lien. L'espace de la session est d'environ 30 Go et
s'efface à la fin : remettre les résultats avant de terminer.

## Où sont les données
`STUDIO_DATA` (par défaut `../library` à côté de `studio/`) :
`originals/` (lecture seule, + `.sha256` et `.meta.json`), `projects/<id>/` (analyses), `exports/`.

## Analyser une vidéo
1. `python3 studio/pipeline/analyze.py library/originals/<id>__nom.mp4 --language fr`
   (reprend où il s'était arrêté si interrompu ; `--model medium` pour plus de précision, plus lent).
2. Lire `projects/<id>/pour_claude.md`, puis **regarder les planches** `projects/<id>/planches/*.jpg`
   avec l'outil Read (20 vignettes horodatées par planche). Pour un plan précis : `vignettes/plan_NNNN.jpg`,
   ou extraire une image : `ffmpeg -ss T -i projects/<id>/proxy.mp4 -frames:v 1 /tmp/x.jpg`.
3. Rédiger l'analyse éditoriale demandée (rapport, découpage, conducteur, sélection) en citant les timecodes.

## Outils
- `studio/pipeline/studio.py bibliotheque | chercher ID "texte" | extraire ID début fin | montage plan.json | exporter fichier --format vertical`
- `studio/pipeline/classer_rushes.py DOSSIER` — catalogue sans rien déplacer
- `studio/business/devis_facture.py devis|facture fichier.json` — brouillons PDF
- Connecteurs : Canva (designs), CapCut/AITuber (vidéos IA, payant en crédits), Filmit (Premiere / Resolve /
  After Effects, uniquement si un ordinateur est relié — vérifier avec `filmit_status`).

Documentation : `studio/README.md` et `studio/docs/`.
