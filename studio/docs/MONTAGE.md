# Environnement de montage : comment travailler avec Claude

## Le circuit

1. **Envoi** de l'original → reçu, vérifié (SHA-256), rangé en lecture seule.
2. **Analyse automatique** (`pipeline/analyze.py`) → proxy, plans, transcription, vignettes, planches, rapport, EDL.
3. **Visionnage par Claude** : il lit `pour_claude.md` (plans + dialogues + niveaux) et **regarde les planches contact**
   (20 vignettes horodatées par image). Il ne voit pas le film image par image : il voit une image par plan
   (ou par tranche de 2 min pour les plans longs) et l'intégralité des dialogues.
4. **Décisions éditoriales** : Claude rédige le conducteur, la sélection, le plan de montage (`plan.json`).
5. **Fabrication** : `studio.py montage plan.json` → pré-montage MP4 + EDL + SRT recalés ;
   `studio.py exporter` → formats réseaux sociaux.
6. **Finition** dans votre logiciel : import de l'EDL et du SRT dans Premiere Pro / DaVinci Resolve,
   ou pilotage direct via Filmit quand un ordinateur est relié.

## Demandes types à faire à Claude

| Vous dites | Claude fait |
|---|---|
| « Analyse la vidéo 4d505d34 et fais-moi un rapport de visionnage » | Lit le condensé, regarde les planches, écrit un rapport éditorial (structure, personnages, lieux, qualité technique, problèmes son/image) |
| « Retrouve le moment où le marié dit "oui" » | `studio.py chercher ID "oui"` → timecodes + vignette, puis vérifie visuellement |
| « Propose un découpage technique / un conducteur » | Tableau séquence par séquence avec timecodes source, intention, durée cible |
| « Sélectionne les meilleures prises de l'interview » | Compare les répétitions (dialogue quasi identique), juge la diction dans la transcription et le cadre sur les vignettes, propose un classement argumenté |
| « Monte une bande-annonce de 60 s » | Écrit `plan.json`, lance le montage, vous donne le MP4 + EDL + SRT |
| « Fais 3 versions verticales pour TikTok » | Exports 9:16 recadrés ou fond flouté, sous-titres incrustés, son normalisé à −14 LUFS |
| « Nettoie le son de l'interview » | Export avec `--debruiter` (débruitage FFmpeg `afftdn`) ; pour un vrai nettoyage, finition dans Resolve Fairlight / Audition |
| « Classe les rushes de la carte SD » | `classer_rushes.py` → catalogue CSV + classement par date / caméra / format, sans rien déplacer |

## Recettes par genre

**Mariage** — repères à chercher dans la transcription : « oui », « je le veux », « vous pouvez embrasser »,
discours, noms des mariés ; pics sonores = applaudissements, entrées, première danse. Livrables : film long
(chronologique), clip 3-4 min (musique + moments forts), teaser vertical 30-60 s.

**Publicité** — partir du script : Claude aligne chaque phrase du script sur les prises (transcription),
choisit la meilleure prise par plan, monte 30 s / 15 s / 6 s + versions 9:16 et 1:1.

**Documentaire / interviews** — « paper edit » : Claude lit toutes les transcriptions, regroupe les
citations par thème, propose une structure narrative avec les timecodes de chaque extrait.
Avec Filmit + RoughCut, ce paper edit peut être envoyé directement dans Premiere.

**Film / série** — dérushage par scène et par prise (ardoise filmée → vignette), comparaison des
prises, rapport de continuité visuelle à partir des vignettes, conducteur par séquence.

**Bande-annonce** — structure en 3 actes (situation, conflit, montée), répliques fortes repérées dans
la transcription, plans à forte énergie sonore, montage par `plan.json`, puis musique et rythme en finition.

## Synchronisation audio-vidéo

Pour un son enregistré à part (enregistreur Zoom/Tascam) : le plus fiable reste la synchronisation
automatique de **DaVinci Resolve** (*Auto Sync Audio → Based on Waveform*) ou de **Premiere**
(*Synchroniser → Audio*). Studio fournit les transcriptions des deux sources pour vérifier l'alignement.
Un outil de synchronisation automatique par forme d'onde n'est **pas encore** inclus dans Studio.

## Ce qui reste manuel (honnêtement)

- L'étalonnage, le mixage final, le motion design fin et le rythme musical se font dans votre logiciel.
- Sans ordinateur relié à Filmit, Claude ne peut pas ouvrir votre projet Premiere/Resolve : il vous donne
  EDL + SRT + exports à importer.
- La transcription Whisper fait des erreurs (noms propres, chansons, son saturé) : à relire avant diffusion.
- Le « score » des moments forts est statistique (son + parole). Le jugement artistique, c'est Claude
  sur les vignettes et le texte, puis vous.
